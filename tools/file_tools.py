import os
import shutil
from pathlib import Path
from core.self_manager import is_self_path, record_modification

def resolve_path(path_str: str) -> Path:
    p = Path(path_str).expanduser()
    if not p.is_absolute():
        p = Path.cwd() / p
    return p.resolve()

def read_file(path: str, start_line: int = 1, max_lines: int = 150) -> str:
    """Read contents of a file with line numbers."""
    target = resolve_path(path)
    if not target.exists():
        return f"Error: File '{target}' does not exist."
    if target.is_dir():
        return f"Error: '{target}' is a directory, not a file. Use list_directory instead."
    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        total_lines = len(lines)
        start_idx = max(0, start_line - 1)
        end_idx = min(total_lines, start_idx + max_lines)
        sliced = lines[start_idx:end_idx]
        
        output = [f"File: {target} (Showing lines {start_idx + 1} to {end_idx} of {total_lines})"]
        for idx, line in enumerate(sliced, start=start_idx + 1):
            output.append(f"{idx}: {line.rstrip()}")
        return "\n".join(output)
    except Exception as e:
        return f"Error reading file '{target}': {str(e)}"

def write_file(path: str, content: str, overwrite: bool = True) -> str:
    """Create or overwrite a file with given content."""
    target = resolve_path(path)
    if target.exists() and not overwrite:
        return f"Error: File '{target}' already exists and overwrite is set to False."
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        if is_self_path(str(target)):
            record_modification(str(target))
        return f"Successfully wrote {len(content)} characters to '{target}'."
    except Exception as e:
        return f"Error writing file '{target}': {str(e)}"

def edit_file(path: str, search_text: str, replace_text: str) -> str:
    """Replace an exact substring within a file with new content."""
    target = resolve_path(path)
    if not target.exists():
        return f"Error: File '{target}' does not exist."
    try:
        with open(target, "r", encoding="utf-8") as f:
            content = f.read()
        if search_text not in content:
            return f"Error: Target search string was not found in '{target}'."
        count = content.count(search_text)
        new_content = content.replace(search_text, replace_text, 1)
        with open(target, "w", encoding="utf-8") as f:
            f.write(new_content)
        if is_self_path(str(target)):
            record_modification(str(target))
        return f"Successfully updated '{target}' (replaced 1 of {count} occurrences)."
    except Exception as e:
        return f"Error editing file '{target}': {str(e)}"

def delete_file(path: str) -> str:
    """Delete a file or empty/non-empty directory."""
    target = resolve_path(path)
    if not target.exists():
        return f"Error: Path '{target}' does not exist."
    try:
        is_self = is_self_path(str(target))
        if target.is_dir():
            shutil.rmtree(target)
            if is_self:
                record_modification(str(target))
            return f"Successfully deleted directory '{target}'."
        else:
            target.unlink()
            if is_self:
                record_modification(str(target))
            return f"Successfully deleted file '{target}'."
    except Exception as e:
        return f"Error deleting '{target}': {str(e)}"

def list_directory(path: str = ".") -> str:
    """List files and subdirectories in a given path."""
    target = resolve_path(path)
    if not target.exists():
        return f"Error: Directory '{target}' does not exist."
    if not target.is_dir():
        return f"Error: '{target}' is a file, not a directory."
    try:
        entries = []
        for entry in sorted(target.iterdir()):
            kind = "DIR " if entry.is_dir() else "FILE"
            size = entry.stat().st_size if entry.is_file() else "-"
            entries.append(f"[{kind}] {entry.name:<28} (size: {size})")
        return f"Contents of {target}:\n" + ("\n".join(entries) if entries else "(Directory is empty)")
    except Exception as e:
        return f"Error listing directory '{target}': {str(e)}"
