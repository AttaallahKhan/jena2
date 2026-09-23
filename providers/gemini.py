import json
import urllib.request
import urllib.error
from typing import List, Dict, Any
from providers.base import BaseProvider, ProviderResponse, ToolCall
from tools.registry import get_gemini_tools

class GeminiProvider(BaseProvider):
    def __init__(self, api_key: str, model: str = "gemini-3.8-flash", temperature: float = 0.3, max_tokens: int = 700):
        super().__init__(api_key, model, temperature, max_tokens)
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"


    def _convert_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        contents = []
        for msg in messages:
            role = msg.get("role")
            if role == "system":
                continue # Gemini handles system via system_instruction
            
            # Map role
            gemini_role = "user" if role in ["user", "tool"] else "model"

            # Check if this is a tool result
            if role == "tool":
                tool_name = msg.get("name", "tool_result")
                result_content = msg.get("content", "")
                contents.append({
                    "role": "user",
                    "parts": [{
                        "functionResponse": {
                            "name": tool_name,
                            "response": {"name": tool_name, "content": result_content}
                        }
                    }]
                })
            elif role == "assistant" and (msg.get("tool_calls") or msg.get("raw_parts")):
                if msg.get("raw_parts"):
                    contents.append({"role": "model", "parts": msg["raw_parts"]})
                else:
                    parts = []
                    if msg.get("content"):
                        parts.append({"text": msg["content"]})
                    for tc in msg.get("tool_calls", []):
                        if tc.get("raw_part"):
                            parts.append(tc["raw_part"])
                        else:
                            p = {
                                "functionCall": {
                                    "name": tc.get("name"),
                                    "args": tc.get("arguments", {})
                                }
                            }
                            if tc.get("thought_signature"):
                                p["thoughtSignature"] = tc["thought_signature"]
                            parts.append(p)
                    contents.append({"role": "model", "parts": parts})
            else:
                text_content = msg.get("content", "")
                contents.append({
                    "role": gemini_role,
                    "parts": [{"text": text_content}]
                })
        return contents

    def generate(self, messages: List[Dict[str, Any]], system_prompt: str) -> ProviderResponse:
        import time
        if not self.api_key:
            return ProviderResponse(text="Error: GEMINI_API_KEY set nahi hai. Barah-e-karam apna Google AI Studio API key configure karein (`jena --config`).")

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": self._convert_messages(messages),
            "tools": get_gemini_tools(),
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": self.max_tokens
            }
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.endpoint,
            data=data_bytes,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "JenaAgent/1.0"
            },
            method="POST"
        )

        max_retries = 3
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

                if not err_text.strip():
                    if e.code == 404:
                        err_text = f"Model '{self.model}' Google Generative Language API par nahi mila ya generateContent support nahi karta. 'gemini-3.6-flash' istemal karein."
                    else:
                        err_text = f"HTTP Error {e.code}"

                if e.code in [429, 503] and attempt < max_retries - 1:
                    time.sleep(2.5 * (attempt + 1))
                    continue

                return ProviderResponse(text=f"Gemini API Error ({e.code}): {err_text}")
            except Exception as e:
                return ProviderResponse(text=f"Request Failed: {str(e)}")

        if not result:
            return ProviderResponse(text="Gemini se jawab nahi mil saka.")

        candidates = result.get("candidates", [])
        if not candidates:
            return ProviderResponse(text="Gemini ne koi candidate response nahi diya.")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_pieces = []
        tool_calls = []

        call_idx = 1
        for part in parts:
            if "text" in part:
                text_pieces.append(part["text"])
            if "functionCall" in part:
                fn = part["functionCall"]
                tool_calls.append(ToolCall(
                    id=fn.get("id") or f"call_{call_idx}",
                    name=fn.get("name", ""),
                    arguments=fn.get("args", {}),
                    thought_signature=part.get("thoughtSignature"),
                    raw_part=part
                ))
                call_idx += 1

        full_text = "\n".join(text_pieces).strip() if text_pieces else None
        return ProviderResponse(text=full_text, tool_calls=tool_calls, raw_response=result)
