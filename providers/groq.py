from providers.openai_provider import OpenAICompatibleProvider

class GroqProvider(OpenAICompatibleProvider):
    def __init__(self, api_key: str, model: str = "qwen/qwen3.8-27b", temperature: float = 0.3, max_tokens: int = 700):
        super().__init__(
            api_key=api_key,
            model=model,
            endpoint="https://api.groq.com/openai/v1/chat/completions",
            provider_name="Groq",
            temperature=temperature,
            max_tokens=max_tokens
        )

