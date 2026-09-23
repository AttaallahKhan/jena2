from providers.gemini import GeminiProvider
from providers.groq import GroqProvider
from providers.openai_provider import OpenAICompatibleProvider

from config import DEFAULT_MODELS, is_model_compatible

def get_provider(config: dict):
    provider_type = config.get("provider", "groq").lower()
    model = config.get("model")
    temperature = float(config.get("temperature", 0.3))
    max_tokens = int(config.get("max_tokens", 700))

    if not is_model_compatible(provider_type, model):
        model = DEFAULT_MODELS.get(provider_type, "gemini-3.6-flash")

    if provider_type == "groq":
        api_key = config.get("groq_api_key", "")
        return GroqProvider(
            api_key=api_key,
            model=model or "qwen/qwen3.8-27b",
            temperature=temperature,
            max_tokens=max_tokens
        )
    elif provider_type == "gemini":
        api_key = config.get("gemini_api_key", "")
        return GeminiProvider(
            api_key=api_key,
            model=model or "gemini-3.6-flash",
            temperature=temperature,
            max_tokens=max_tokens
        )
    elif provider_type == "openai":
        api_key = config.get("openai_api_key", "")
        return OpenAICompatibleProvider(
            api_key=api_key,
            model=model or "gpt-4o-mini",
            endpoint="https://api.openai.com/v1/chat/completions",
            provider_name="OpenAI",
            temperature=temperature,
            max_tokens=max_tokens
        )
    else:
        raise ValueError(f"Unknown provider '{provider_type}'. Supported: groq, gemini, openai")

