import json
from typing import Dict, Any, List
from tools.system_tools import execute_bash, install_package, sync_system, restart_agent
from tools.file_tools import read_file, write_file, edit_file, delete_file, list_directory
from tools.web_tools import search_web, fetch_url

TOOL_DEFINITIONS = [
    {
        "name": "execute_bash",
        "description": "Run bash command in Termux and return stdout/stderr.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Bash command string."}
            },
            "required": ["command"]
        }
    },
    {
        "name": "install_package",
        "description": "Install package via pkg, pip, or npm.",
        "parameters": {
            "type": "object",
            "properties": {
                "package": {"type": "string", "description": "Package name."},
                "manager": {"type": "string", "description": "Manager: 'pkg', 'pip', or 'npm'."}
            },
            "required": ["package"]
        }
    },
    {
        "name": "read_file",
        "description": "Read file lines with pagination.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path."},
                "start_line": {"type": "integer", "description": "Start line (1-indexed)."},
                "max_lines": {"type": "integer", "description": "Max lines to read."}
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write or overwrite file with content.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Target file path."},
                "content": {"type": "string", "description": "Text content."},
                "overwrite": {"type": "boolean", "description": "Overwrite existing (default true)."}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "edit_file",
        "description": "Replace exact substring in file.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path."},
                "search_text": {"type": "string", "description": "Exact text to find."},
                "replace_text": {"type": "string", "description": "Replacement text."}
            },
            "required": ["path", "search_text", "replace_text"]
        }
    },
    {
        "name": "delete_file",
        "description": "Delete a file or directory.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to delete."}
            },
            "required": ["path"]
        }
    },
    {
        "name": "list_directory",
        "description": "List files and subdirectories in path.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Folder path (default .)."}
            }
        }
    },
    {
        "name": "search_web",
        "description": "Search DuckDuckGo web.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query."}
            },
            "required": ["query"]
        }
    },
    {
        "name": "fetch_url",
        "description": "Fetch webpage text content.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to scrape."}
            },
            "required": ["url"]
        }
    },
    {
        "name": "save_memory",
        "description": "Save fact or preference to persistent memory.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Category name."},
                "key": {"type": "string", "description": "Fact identifier."},
                "value": {"type": "string", "description": "Fact content."}
            },
            "required": ["category", "key", "value"]
        }
    },
    {
        "name": "recall_memory",
        "description": "Recall long-term memory facts.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "restart_agent",
        "description": "Apply all pending updates to Jena's system files/folders, verify syntax integrity, update system symlinks/aliases, and cleanly restart Jena.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Reason for restarting Jena."}
            }
        }
    },
    {
        "name": "sync_system",
        "description": "Synchronize Jena's global command (/usr/bin/jena), shell aliases (.bashrc, .zshrc), and system paths to current folder.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
]

def get_gemini_tools():
    """Convert definitions to Gemini functionDeclarations format."""
    declarations = []
    for tool in TOOL_DEFINITIONS:
        declarations.append({
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"]
        })
    return [{"function_declarations": declarations}]

def get_openai_tools():
    """Convert definitions to OpenAI/Groq tools format."""
    return [{"type": "function", "function": tool} for tool in TOOL_DEFINITIONS]

def execute_tool(name: str, args: Dict[str, Any], memory_mgr=None) -> str:
    """Dispatch tool execution by name with given arguments."""
    try:
        if name == "execute_bash":
            return execute_bash(args.get("command", ""))
        elif name == "install_package":
            return install_package(args.get("package", ""), args.get("manager", "pkg"))
        elif name == "read_file":
            return read_file(
                args.get("path", ""),
                int(args.get("start_line", 1)),
                int(args.get("max_lines", 150))
            )
        elif name == "write_file":
            return write_file(
                args.get("path", ""),
                args.get("content", ""),
                args.get("overwrite", True)
            )
        elif name == "edit_file":
            return edit_file(
                args.get("path", ""),
                args.get("search_text", ""),
                args.get("replace_text", "")
            )
        elif name == "delete_file":
            return delete_file(args.get("path", ""))
        elif name == "list_directory":
            return list_directory(args.get("path", "."))
        elif name == "search_web":
            return search_web(args.get("query", ""))
        elif name == "fetch_url":
            return fetch_url(args.get("url", ""))
        elif name == "save_memory":
            if memory_mgr:
                return memory_mgr.save_fact(
                    args.get("category", "learned_facts"),
                    args.get("key", "note"),
                    args.get("value", "")
                )
            return "Memory manager not initialized."
        elif name == "recall_memory":
            if memory_mgr:
                return memory_mgr.get_facts_summary()
            return "Memory manager not initialized."
        elif name == "restart_agent":
            return restart_agent(args.get("reason", "Self update requested"))
        elif name == "sync_system":
            return sync_system()
        else:
            return f"Error: Unknown tool '{name}'."
    except Exception as e:
        return f"Error executing tool '{name}': {str(e)}"
