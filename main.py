#!/data/data/com.termux/files/usr/bin/python3
import sys
import os
import argparse
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import load_config, save_config_file, DEFAULT_MODELS, is_model_compatible
from providers import get_provider
from core.memory import MemoryManager
from core.agent import JenaAgent
from core.self_manager import sync_system_integrations, has_pending_restart, apply_and_restart, request_restart

BANNER = """
======================================================
  🤖 JENA — Autonomous AI Agent (Termux / Linux)
  Default Language: Roman Urdu | Self-Learning & Coding
======================================================
"""

def configure_interactive():
    print("\n--- Jena Configuration Setup ---")
    current = load_config()

    print(f"1. Current Provider: {current.get('provider')} (Options: gemini, groq, openai)")
    provider = input(f"Select provider [{current.get('provider')}]: ").strip().lower() or current.get("provider")

    updates = {"provider": provider}

    if provider == "gemini":
        print(f"Current Gemini API Key: {'*' * 8 if current.get('gemini_api_key') else 'Not set'}")
        key = input("Enter Gemini API Key (Enter to keep current): ").strip()
        if key:
            updates["gemini_api_key"] = key
    elif provider == "groq":
        print(f"Current Groq API Key: {'*' * 8 if current.get('groq_api_key') else 'Not set'}")
        key = input("Enter Groq API Key (Enter to keep current): ").strip()
        if key:
            updates["groq_api_key"] = key
    elif provider == "openai":
        print(f"Current OpenAI API Key: {'*' * 8 if current.get('openai_api_key') else 'Not set'}")
        key = input("Enter OpenAI API Key (Enter to keep current): ").strip()
        if key:
            updates["openai_api_key"] = key

    default_model = DEFAULT_MODELS.get(provider, "qwen/qwen3.8-27b")
    current_model = current.get("model")
    if not is_model_compatible(provider, current_model):
        current_model = default_model
    raw_model = input(f"Enter Model Name [{current_model}]: ").strip()
    model = "".join(c for c in raw_model if c.isprintable()).strip() if raw_model else current_model
    updates["model"] = model or default_model

    curr_temp = current.get("temperature", 0.3)
    raw_temp = input(f"Enter Temperature [{curr_temp}]: ").strip()
    if raw_temp:
        try:
            updates["temperature"] = float(raw_temp)
        except ValueError:
            pass

    curr_tokens = current.get("max_tokens", 700)
    raw_tokens = input(f"Enter Max Output Tokens [{curr_tokens}]: ").strip()
    if raw_tokens:
        try:
            updates["max_tokens"] = int(raw_tokens)
        except ValueError:
            pass

    curr_turns = current.get("history_turns", 3)
    raw_turns = input(f"Enter Chat History Turns [{curr_turns}]: ").strip()
    if raw_turns:
        try:
            updates["history_turns"] = int(raw_turns)
        except ValueError:
            pass

    # Sanitize all updates
    for k in list(updates.keys()):
        if isinstance(updates[k], str):
            updates[k] = "".join(c for c in updates[k] if c.isprintable()).strip()

    save_config_file(updates)
    print("\n✅ Configuration kamyabi se save ho gayi hai!\n")

def main():
    parser = argparse.ArgumentParser(
        description="Jena: Autonomous AI Agent for Termux/Linux",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("query", nargs="*", help="Goal or message for Jena. Agar khali chora to interactive mode chalega.")
    parser.add_argument("--config", action="store_true", help="API keys aur provider settings configure karein.")
    parser.add_argument("--provider", help="Provider override karein (groq, gemini, openai).")
    parser.add_argument("--model", help="Model name override karein.")
    parser.add_argument("--temperature", type=float, help="Temperature override karein (e.g. 0.3).")
    parser.add_argument("--max-tokens", type=int, help="Max output tokens override karein (e.g. 700).")
    parser.add_argument("--history-turns", type=int, help="Chat history turns limit override karein (e.g. 3).")
    parser.add_argument("--clear-history", action="store_true", help="Session chat history delete karein.")
    parser.add_argument("--clear-memory", action="store_true", help="Long-term memory reset karein.")
    parser.add_argument("--web", action="store_true", help="Launch Jena Web GUI (HTML/CSS/JS + Node.js).")
    parser.add_argument("--port", type=int, default=8080, help="Web GUI server port (default: 8080).")
    parser.add_argument("--sync", action="store_true", help="Synchronize system links (/usr/bin/jena) and shell aliases.")
    parser.add_argument("--restart", action="store_true", help="Apply pending updates and restart Jena.")

    args = parser.parse_args()

    # Always ensure system integrations (symlink and aliases) are synchronized to current location
    try:
        sync_system_integrations()
    except Exception:
        pass

    if args.sync:
        print("\n🔧 Jena System Integration Sync:")
        print(sync_system_integrations())
        print("\n✅ System integration mukammal ho gayi hai.\n")
        return

    if args.restart:
        apply_and_restart("Manual restart requested via CLI flag.")
        return

    if args.web:
        web_server = BASE_DIR / "web" / "server.js"
        port = str(args.port)
        print(f"\n🌐 Jena Web GUI shuru ho raha hai (Port: {port})...")
        print(f"📱 Browser mein kholein: http://localhost:{port}\n")
        try:
            os.execvp("node", ["node", str(web_server), "--port", port])
        except FileNotFoundError:
            print("❌ Error: 'node' command nahi mila. Barah-e-karam Termux mein 'pkg install nodejs' karein.")
        return

    memory_mgr = MemoryManager()

    if args.clear_history:
        memory_mgr.clear_history()
        print("✅ Chat history saaf ho gayi hai.")
        return

    if args.clear_memory:
        memory_mgr.clear_memory()
        print("✅ Long-term memory reset ho gayi hai.")
        return

    if args.config:
        configure_interactive()
        return

    config = load_config()
    if args.provider:
        new_provider = args.provider.lower()
        if new_provider != config.get("provider") and not args.model:
            config["model"] = DEFAULT_MODELS.get(new_provider, "gemini-3.6-flash")
        config["provider"] = new_provider
    if args.model:
        config["model"] = args.model

    if not is_model_compatible(config.get("provider", "groq"), config.get("model")):
        config["model"] = DEFAULT_MODELS.get(config.get("provider", "groq"), "qwen/qwen3.8-27b")
    if args.temperature is not None:
        config["temperature"] = args.temperature
    if args.max_tokens is not None:
        config["max_tokens"] = args.max_tokens
    if args.history_turns is not None:
        config["history_turns"] = args.history_turns

    active_provider = config.get("provider", "groq")
    active_key = config.get(f"{active_provider}_api_key", "")

    if not active_key:
        print(f"\n⚠️  Khabardar: {active_provider.upper()} API Key set nahi hai!")
        print("Aap `jena --config` chala kar foran apna API key save kar sakte hain, ya phir:")
        print(f"export {active_provider.upper()}_API_KEY='your_api_key_here'\n")

    try:
        provider_instance = get_provider(config)
    except Exception as e:
        print(f"Error initializing provider: {e}")
        return

    agent = JenaAgent(
        provider=provider_instance,
        memory_mgr=memory_mgr,
        max_iterations=config.get("max_iterations", 20),
        history_turns=config.get("history_turns", 3)
    )

    # If single-shot task is passed via CLI args
    if args.query:
        goal = " ".join(args.query)
        result = agent.run_turn(goal, verbose=True)
        print("\n" + result + "\n")
        return

    # Interactive REPL mode
    print(BANNER)
    print(f"Active Provider: {config['provider'].upper()} | Model: {config['model']} | Temp: {config.get('temperature', 0.3)} | MaxTokens: {config.get('max_tokens', 700)} | History: {config.get('history_turns', 3)} turns")
    print("Main Jena hoon! Farmayein, main aapki kis tarah madad kar sakti hoon?")
    print("(Baahir nikalne ke liye 'exit' ya 'quit' likhein, settings ke liye 'config')\n")


    while True:
        try:
            user_input = input("Aap > ").strip()
            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", "q"]:
                print("\nAllah Hafiz! Phir milte hain. Apna khayal rakhiyega.\n")
                break

            if user_input.lower() == "config":
                configure_interactive()
                continue

            if user_input.lower() in ["restart", "reload"]:
                apply_and_restart("User requested restart.")
                continue

            if user_input.lower() == "clear":
                os.system("clear")
                continue

            result = agent.run_turn(user_input, verbose=True)
            print(f"\n[Jena]:\n{result}\n")

            if has_pending_restart():
                apply_and_restart("System files/folders update ho gayi hain. Changes apply karke restart ho rahi hoon...")


        except KeyboardInterrupt:
            print("\n\nAlvida! Session band kiya ja raha hai.\n")
            break
        except Exception as e:
            print(f"\nAnokha Error pesh aya: {str(e)}\n")

if __name__ == "__main__":
    main()
