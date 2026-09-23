import json
from pathlib import Path
from typing import Dict, List, Any

DEFAULT_DIR = Path.home() / ".jena"
MEMORY_FILE = DEFAULT_DIR / "memory.json"
HISTORY_FILE = DEFAULT_DIR / "history.json"

class MemoryManager:
    def __init__(self):
        DEFAULT_DIR.mkdir(parents=True, exist_ok=True)
        self.memory_file = MEMORY_FILE
        self.history_file = HISTORY_FILE
        self._load()

    def _load(self):
        if not self.memory_file.exists():
            self.memory = {
                "user_preferences": {},
                "learned_facts": {},
                "projects": {}
            }
            self._save_memory()
        else:
            try:
                with open(self.memory_file, "r", encoding="utf-8") as f:
                    self.memory = json.load(f)
            except Exception:
                self.memory = {"user_preferences": {}, "learned_facts": {}, "projects": {}}

        if not self.history_file.exists():
            self.history = []
            self._save_history()
        else:
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    self.history = json.load(f)
            except Exception:
                self.history = []

    def _save_memory(self):
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(self.memory, f, indent=2, ensure_ascii=False)

    def _save_history(self):
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(self.history[-50:], f, indent=2, ensure_ascii=False)

    def save_fact(self, category: str, key: str, value: Any) -> str:
        if category not in self.memory:
            self.memory[category] = {}
        self.memory[category][key] = value
        self._save_memory()
        return f"Fact saved: [{category}] {key} = {value}"

    def get_all_facts(self) -> Dict[str, Any]:
        return self.memory

    def get_facts_summary(self) -> str:
        lines = []
        for cat, items in self.memory.items():
            if items:
                lines.append(f"## {cat.upper()}:")
                for k, v in items.items():
                    lines.append(f"- {k}: {v}")
        return "\n".join(lines) if lines else "No persistent memories saved yet."

    def add_message(self, role: str, content: str):
        self.history.append({"role": role, "content": content})
        self._save_history()

    def get_recent_history(self, limit: int = 10) -> List[Dict[str, str]]:
        return self.history[-limit:]

    def clear_history(self):
        self.history = []
        self._save_history()

    def clear_memory(self):
        self.memory = {"user_preferences": {}, "learned_facts": {}, "projects": {}}
        self._save_memory()
