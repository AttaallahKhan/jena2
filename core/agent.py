import os
import sys
from typing import List, Dict, Any
from core.persona import SYSTEM_PROMPT
from core.memory import MemoryManager
from tools.registry import execute_tool
from providers.base import BaseProvider
from core.self_manager import (
    has_pending_restart,
    verify_code_integrity,
    sync_system_integrations,
    get_restart_reason,
    get_modified_files,
    BASE_DIR
)
from core.local_engine import LocalIntelligence

class JenaAgent:
    def __init__(self, provider: BaseProvider, memory_mgr: MemoryManager, max_iterations: int = 20, history_turns: int = 3):
        self.provider = provider
        self.memory_mgr = memory_mgr
        self.max_iterations = max_iterations
        self.history_turns = max(1, int(history_turns))
        self.messages: List[Dict[str, Any]] = []
        self._init_history_context()

    def _init_history_context(self):
        """Load the last history_turns conversation turns from saved session history."""
        history = getattr(self.memory_mgr, "history", [])
        if not history:
            return
        user_indices = [i for i, m in enumerate(history) if m.get("role") == "user"]
        if not user_indices:
            return
        start_idx = user_indices[-min(self.history_turns, len(user_indices))]
        self.messages = [dict(m) for m in history[start_idx:]]

    def _prune_messages_for_new_turn(self):
        """Retain only the last (history_turns - 1) completed turns before appending a new user turn.
        Condense past turns to user query and final assistant answer, removing intermediate tool calls
        to drastically reduce input tokens and prevent provider rate limits.
        """
        condensed = []
        for msg in self.messages:
            if msg.get("role") == "user":
                condensed.append(msg)
            elif msg.get("role") == "assistant" and not msg.get("tool_calls"):
                condensed.append(msg)

        user_indices = [i for i, m in enumerate(condensed) if m.get("role") == "user"]
        keep_turns = max(0, self.history_turns - 1)
        if keep_turns == 0:
            self.messages = []
        elif len(user_indices) > keep_turns:
            cutoff = user_indices[-keep_turns]
            self.messages = condensed[cutoff:]
        else:
            self.messages = condensed

    def _build_system_prompt(self) -> str:
        cwd = os.getcwd()
        memory_summary = self.memory_mgr.get_facts_summary()
        context = f"\n\n### ENVIRONMENT CONTEXT\n- Current Working Directory: {cwd}\n- Jena Core Directory: {BASE_DIR}\n- Operating System: Linux (Termux Android)\n"
        context += f"\n### LONG-TERM MEMORY FACTS\n{memory_summary}\n"
        return SYSTEM_PROMPT + context

    def run_turn(self, user_input: str, verbose: bool = True) -> str:
        # Check Local Intelligence first (Zero API tokens, offline, instant response)
        local_ans = LocalIntelligence.try_handle(user_input, memory_mgr=self.memory_mgr)
        if local_ans:
            if verbose:
                print("\n⚡ [Jena Local Engine]: Local execution mukammal (Zero AI Tokens).\n", flush=True)
            self.messages.append({"role": "user", "content": user_input})
            self.messages.append({"role": "assistant", "content": local_ans})
            self.memory_mgr.add_message("user", user_input)
            self.memory_mgr.add_message("assistant", local_ans)
            return local_ans

        self._prune_messages_for_new_turn()
        system_prompt = self._build_system_prompt()
        self.messages.append({"role": "user", "content": user_input})
        self.memory_mgr.add_message("user", user_input)

        if verbose:
            print("\n[Jena] Soch rahi hoon...", flush=True)

        for step in range(self.max_iterations):
            response = self.provider.generate(self.messages, system_prompt)

            # If there's direct text with or without tool calls
            if response.text and verbose and response.tool_calls:
                print(f"\n[Jena]: {response.text.strip()}\n", flush=True)

            # If there are tool calls to execute
            if response.tool_calls:
                # Record assistant message with tool calls and preserved raw_parts
                asst_msg = {
                    "role": "assistant",
                    "content": response.text or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "name": tc.name,
                            "arguments": tc.arguments,
                            "thought_signature": getattr(tc, "thought_signature", None),
                            "raw_part": getattr(tc, "raw_part", None)
                        }
                        for tc in response.tool_calls
                    ]
                }
                if getattr(response, "raw_response", None) and isinstance(response.raw_response, dict):
                    cands = response.raw_response.get("candidates", [])
                    if cands:
                        raw_parts = cands[0].get("content", {}).get("parts")
                        if raw_parts:
                            asst_msg["raw_parts"] = raw_parts

                self.messages.append(asst_msg)

                for tc in response.tool_calls:
                    if verbose:
                        args_preview = str(tc.arguments)
                        if len(args_preview) > 100:
                            args_preview = args_preview[:97] + "..."
                        print(f"⚙️  [Tool: {tc.name}] -> {args_preview}", flush=True)

                    tool_output = execute_tool(tc.name, tc.arguments, self.memory_mgr)

                    if verbose:
                        preview = str(tool_output).strip()
                        first_line = preview.splitlines()[0] if preview.splitlines() else "Done"
                        if len(first_line) > 80:
                            first_line = first_line[:77] + "..."
                        print(f"   ↳ Nateeja: {first_line}", flush=True)

                    # Truncate oversized output to conserve input token rate limits
                    str_output = str(tool_output)
                    if len(str_output) > 2000:
                        str_output = str_output[:1000] + "\n... [Output truncated to conserve tokens] ...\n" + str_output[-500:]

                    # Append tool result
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tc.name,
                        "content": str_output
                    })

                # Continue autonomous loop to evaluate result
                continue

            # No tool calls: Final response from model
            final_text = response.text or "Kaam mukammal ho gaya!"
            if has_pending_restart():
                ok, check_msg = verify_code_integrity()
                if not ok:
                    final_text += f"\n\n⚠️ [Jena Self-Integrity Alert]: Code mein syntax error aya: {check_msg}. Isay foran theek karein."
                else:
                    sync_system_integrations()
                    mod_files = [os.path.basename(f) for f in get_modified_files()]
                    file_str = ", ".join(mod_files) if mod_files else "System files"
                    final_text += f"\n\n🔄 [Jena Self-Update]: {file_str} kamyabi se update ho gaye hain aur code integrity verify ho chuki hai."

            self.messages.append({"role": "assistant", "content": final_text})
            self.memory_mgr.add_message("assistant", final_text)
            return final_text

        timeout_msg = "Maazrat, maine maximum steps (iterations) poore kar liye hain. Barah-e-karam task ki progress check karein."
        self.messages.append({"role": "assistant", "content": timeout_msg})
        return timeout_msg
