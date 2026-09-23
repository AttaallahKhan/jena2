#!/data/data/com.termux/files/usr/bin/python3
"""
Jena Web Bridge — Real-time event streaming bridge for Jena Web GUI.
Emits line-delimited JSON events to stdout for consumption by Node.js.
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import load_config, save_config_file, DEFAULT_MODELS, is_model_compatible
from providers import get_provider
from core.memory import MemoryManager
from core.agent import JenaAgent
from tools.registry import execute_tool
from core.self_manager import has_pending_restart, verify_code_integrity, sync_system_integrations, get_modified_files
from core.local_engine import LocalIntelligence

def emit_event(event_type: str, **kwargs):
    """Emit a JSON event line to stdout and flush immediately."""
    payload = {"type": event_type, **kwargs}
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()

class StreamingJenaAgent(JenaAgent):
    """Subclass of JenaAgent that yields structured ReAct execution events."""

    def run_turn_stream(self, user_input: str):
        # Check Local Intelligence first (Zero API tokens, offline, instant response)
        local_ans = LocalIntelligence.try_handle(user_input, memory_mgr=self.memory_mgr)
        if local_ans:
            emit_event("status", message="⚡ Local Intelligence Engine active...", step=1)
            emit_event("thought", content="⚡ Yeh query Jena ke Local Intelligence Engine ne bina kisi external AI API call ke hal ki hai.", step=1)
            self.messages.append({"role": "user", "content": user_input})
            self.messages.append({"role": "assistant", "content": local_ans})
            self.memory_mgr.add_message("user", user_input)
            self.memory_mgr.add_message("assistant", local_ans)
            emit_event("done", result=local_ans, step=1)
            return

        self._prune_messages_for_new_turn()
        system_prompt = self._build_system_prompt()
        self.messages.append({"role": "user", "content": user_input})
        self.memory_mgr.add_message("user", user_input)

        emit_event("status", message="Soch rahi hoon...", step=0)

        for step in range(self.max_iterations):
            current_step = step + 1
            emit_event("step_start", step=current_step)

            try:
                response = self.provider.generate(self.messages, system_prompt)
            except Exception as e:
                err_msg = f"Provider Error: {str(e)}"
                emit_event("error", error=err_msg, step=current_step)
                return

            # Intermediate thought text if present
            if response.text and response.tool_calls:
                emit_event("thought", content=response.text.strip(), step=current_step)

            if response.tool_calls:
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
                    emit_event("tool_start",
                               tool=tc.name,
                               arguments=tc.arguments,
                               step=current_step)

                    try:
                        tool_output = execute_tool(tc.name, tc.arguments, self.memory_mgr)
                    except Exception as err:
                        tool_output = f"Tool Execution Error: {str(err)}"

                    str_output = str(tool_output)
                    emit_event("tool_output",
                               tool=tc.name,
                               output=str_output,
                               step=current_step)

                    # Truncate for prompt context conservation
                    if len(str_output) > 2000:
                        str_output = str_output[:1000] + "\n... [Output truncated to conserve tokens] ...\n" + str_output[-500:]

                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tc.name,
                        "content": str_output
                    })

                emit_event("status", message="Tool execution mukammal, agla qadam soch rahi hoon...", step=current_step)
                continue

            # No tool calls: Final response from model
            final_text = response.text or "Kaam mukammal ho gaya!"
            if has_pending_restart():
                ok, check_msg = verify_code_integrity()
                if not ok:
                    final_text += f"\n\n⚠️ [Integrity Alert]: Code mein syntax error detect hua: {check_msg}."
                else:
                    sync_system_integrations()
                    mod_files = [os.path.basename(f) for f in get_modified_files()]
                    file_str = ", ".join(mod_files) if mod_files else "System files"
                    final_text += f"\n\n🔄 [Jena Self-Update]: {file_str} kamyabi se update aur sync ho chuke hain."
                    emit_event("system_restart", message=f"{file_str} updated and synced.")

            self.messages.append({"role": "assistant", "content": final_text})
            self.memory_mgr.add_message("assistant", final_text)
            emit_event("done", result=final_text, step=current_step)
            return

        timeout_msg = "Maazrat, maine maximum steps (iterations) poore kar liye hain. Barah-e-karam task ki progress check karein."
        self.messages.append({"role": "assistant", "content": timeout_msg})
        self.memory_mgr.add_message("assistant", timeout_msg)
        emit_event("done", result=timeout_msg, step=self.max_iterations)


def main():
    parser = argparse.ArgumentParser(description="Jena Streaming Web Bridge")
    parser.add_argument("--query", help="User message/task for Jena")
    parser.add_argument("--provider", help="Provider override (groq, gemini, openai)")
    parser.add_argument("--model", help="Model override")
    parser.add_argument("--temperature", type=float, help="Temperature override")
    parser.add_argument("--max-tokens", type=int, help="Max tokens override")
    parser.add_argument("--stdin", action="store_true", help="Read query from stdin")
    args = parser.parse_args()

    # Load configuration
    config = load_config()

    if args.provider:
        new_prov = args.provider.lower()
        if new_prov != config.get("provider") and not args.model:
            config["model"] = DEFAULT_MODELS.get(new_prov, "qwen/qwen3.8-27b")
        config["provider"] = new_prov

    if args.model:
        config["model"] = args.model

    if not is_model_compatible(config.get("provider", "groq"), config.get("model")):
        config["model"] = DEFAULT_MODELS.get(config.get("provider", "groq"), "qwen/qwen3.8-27b")

    if args.temperature is not None:
        config["temperature"] = args.temperature
    if args.max_tokens is not None:
        config["max_tokens"] = args.max_tokens

    # Verify provider key
    active_provider = config.get("provider", "groq")
    active_key = config.get(f"{active_provider}_api_key", "")
    if not active_key:
        emit_event("error", error=f"{active_provider.upper()} API Key set nahi hai! Web GUI Settings mein API key configure karein.")
        return

    try:
        provider_instance = get_provider(config)
    except Exception as e:
        emit_event("error", error=f"Provider initialization fail ho gayi: {str(e)}")
        return

    memory_mgr = MemoryManager()
    agent = StreamingJenaAgent(
        provider=provider_instance,
        memory_mgr=memory_mgr,
        max_iterations=config.get("max_iterations", 20),
        history_turns=config.get("history_turns", 3)
    )

    query = args.query
    if args.stdin or not query:
        query = sys.stdin.read().strip()

    if not query:
        emit_event("error", error="Koi query ya task nahi mila.")
        return

    try:
        agent.run_turn_stream(query)
    except Exception as e:
        emit_event("error", error=f"Unhandled error during agent execution: {str(e)}")

if __name__ == "__main__":
    main()
