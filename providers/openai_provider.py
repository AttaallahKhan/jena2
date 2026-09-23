import json
import urllib.request
import urllib.error
from typing import List, Dict, Any
from providers.base import BaseProvider, ProviderResponse, ToolCall
from tools.registry import get_openai_tools

class OpenAICompatibleProvider(BaseProvider):
    def __init__(self, api_key: str, model: str, endpoint: str, provider_name: str = "OpenAI", temperature: float = 0.3, max_tokens: int = 700):
        super().__init__(api_key, model, temperature, max_tokens)
        self.endpoint = endpoint
        self.provider_name = provider_name

    def generate(self, messages: List[Dict[str, Any]], system_prompt: str) -> ProviderResponse:
        if not self.api_key:
            return ProviderResponse(text=f"Error: {self.provider_name} API Key set nahi hai. Barah-e-karam apna key configure karein (`jena --config`).")

        # Format messages with system prompt at top
        formatted = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            m = dict(msg)
            # Ensure tool calls arguments are stringified for assistant messages if needed
            if m.get("role") == "assistant" and "tool_calls" in m:
                clean_tcs = []
                for tc in m["tool_calls"]:
                    clean_tcs.append({
                        "id": tc.get("id", "call_1"),
                        "type": "function",
                        "function": {
                            "name": tc.get("name"),
                            "arguments": json.dumps(tc.get("arguments", {})) if isinstance(tc.get("arguments"), dict) else str(tc.get("arguments", "{}"))
                        }
                    })
                m["tool_calls"] = clean_tcs
            formatted.append(m)

        payload = {
            "model": self.model,
            "messages": formatted,
            "tools": get_openai_tools(),
            "tool_choice": "auto",
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.endpoint,
            data=data_bytes,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "curl/8.5.0"
            },

            method="POST"
        )

        import time, re
        max_retries = 2
        result = None
        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    result = json.loads(resp.read().decode("utf-8"))
                    break
            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8", errors="replace")
                try:
                    err_json = json.loads(err_msg)
                    err_text = err_json.get("error", {}).get("message", err_msg)
                except Exception:
                    err_text = err_msg

                if e.code == 429 and attempt < max_retries - 1:
                    match = re.search(r"try again in ([\d\.]+)s", err_text, re.IGNORECASE)
                    wait_sec = float(match.group(1)) if match else 2.0
                    if wait_sec <= 6.0:
                        time.sleep(wait_sec + 0.5)
                        continue
                return ProviderResponse(text=f"{self.provider_name} API Error ({e.code}): {err_text}")
            except Exception as e:
                return ProviderResponse(text=f"Request to {self.provider_name} Failed: {str(e)}")

        if not result:
            return ProviderResponse(text=f"{self.provider_name} se jawab nahi mil saka.")


        choices = result.get("choices", [])
        if not choices:
            return ProviderResponse(text=f"{self.provider_name} ne koi response generate nahi kiya.")

        msg = choices[0].get("message", {})
        text_content = msg.get("content")
        raw_tool_calls = msg.get("tool_calls", [])

        tool_calls = []
        for tc in raw_tool_calls:
            fn = tc.get("function", {})
            raw_args = fn.get("arguments", "{}")
            try:
                parsed_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except Exception:
                parsed_args = {}
            tool_calls.append(ToolCall(
                id=tc.get("id", "call_id"),
                name=fn.get("name", ""),
                arguments=parsed_args
            ))

        return ProviderResponse(text=text_content, tool_calls=tool_calls, raw_response=result)
