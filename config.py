import os
import json
from pathlib import Path

DEFAULT_CONFIG_DIR = Path.home() / ".jena"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.json"

BASE_DIR = Path(__file__).resolve().parent

DEFAULT_MODELS = {
    "groq": "qwen/qwen3.8-27b",
    "gemini": "gemini-3.6-flash",
    "openai": "gpt-4o-mini"
}

def is_model_compatible(provider: str, model: str) -> bool:
    if not model or not isinstance(model, str):
        return False
    prov = provider.lower()
    m = model.lower()
    if prov == "gemini":
        return not ("/" in m or m.startswith("gpt") or m.startswith("llama") or m.startswith("qwen"))
    elif prov == "groq":
        return not (m.startswith("gemini") or m.startswith("gpt"))
    elif prov == "openai":
        return not (m.startswith("gemini") or "/" in m)
    return True

def load_dotenv_files():
    for env_path in [BASE_DIR / ".env", DEFAULT_CONFIG_DIR / ".env"]:
        if env_path.exists():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass

def ensure_config_dir():
    DEFAULT_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

def load_config():
    ensure_config_dir()
    load_dotenv_files()
    
    defaults = {
        "provider": "groq",
        "model": "qwen/qwen3.8-27b",
        "gemini_api_key": "",
        "groq_api_key": "",
        "openai_api_key": "",
        "max_iterations": 20,
        "temperature": 0.3,
        "max_tokens": 700,
        "history_turns": 3,
        "language": "Roman Urdu"
    }

    config = dict(defaults)

    if DEFAULT_CONFIG_FILE.exists():
        try:
            with open(DEFAULT_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                for k, v in saved.items():
                    if v is not None:
                        config[k] = v
        except Exception:
            pass

    env_mappings = {
        "JENA_PROVIDER": "provider",
        "GEMINI_API_KEY": "gemini_api_key",
        "GROQ_API_KEY": "groq_api_key",
        "OPENAI_API_KEY": "openai_api_key",
        "JENA_MODEL": "model",
        "JENA_MAX_ITERATIONS": "max_iterations",
        "JENA_TEMPERATURE": "temperature",
        "JENA_MAX_TOKENS": "max_tokens",
        "JENA_HISTORY_TURNS": "history_turns",
    }
    for env_var, cfg_key in env_mappings.items():
        if env_var in os.environ and os.environ[env_var].strip():
            val = os.environ[env_var].strip()
            if cfg_key in ["max_iterations", "max_tokens", "history_turns"]:
                try:
                    config[cfg_key] = int(val)
                except ValueError:
                    pass
            elif cfg_key == "temperature":
                try:
                    config[cfg_key] = float(val)
                except ValueError:
                    pass
            elif cfg_key == "provider":
                config[cfg_key] = val.lower()
            else:
                config[cfg_key] = val

    config["temperature"] = float(config.get("temperature", 0.3))
    config["max_tokens"] = int(config.get("max_tokens", 700))
    config["history_turns"] = int(config.get("history_turns", 3))
    config["max_iterations"] = int(config.get("max_iterations", 20))

    # Sanitize non-printable characters or whitespace from keys/model
    for k in ["provider", "model", "gemini_api_key", "groq_api_key", "openai_api_key"]:
        if isinstance(config.get(k), str):
            config[k] = "".join(c for c in config[k] if c.isprintable()).strip()

    # Fallback default model if not set or incompatible with provider
    active_prov = config.get("provider", "groq")
    if not config.get("model") or not is_model_compatible(active_prov, config.get("model")):
        config["model"] = DEFAULT_MODELS.get(active_prov, "qwen/qwen3.8-27b")

    return config

def save_config_file(data: dict):
    ensure_config_dir()
    current = {}
    if DEFAULT_CONFIG_FILE.exists():
        try:
            with open(DEFAULT_CONFIG_FILE, "r", encoding="utf-8") as f:
                current = json.load(f)
        except Exception:
            current = {}
    current.update(data)
    with open(DEFAULT_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current
