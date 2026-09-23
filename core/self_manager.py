import os
import sys
import py_compile
import re
from pathlib import Path
from typing import Tuple, List, Set

BASE_DIR = Path(__file__).resolve().parent.parent
HOME_DIR = Path.home()
CONFIG_DIR = HOME_DIR / ".jena"
BIN_TARGET = Path("/data/data/com.termux/files/usr/bin/jena")

_MODIFIED_FILES: Set[str] = set()
_PENDING_RESTART: bool = False
_RESTART_REASON: str = ""

def get_base_dir() -> Path:
    """Return canonical base directory of Jena."""
    return BASE_DIR

def is_self_path(path_str: str) -> bool:
    """Check if the given path belongs to Jena's system files or folders."""
    try:
        p = Path(path_str).expanduser().resolve()
        # Jena's root directory or any file inside it
        try:
            p.relative_to(BASE_DIR)
            return True
        except ValueError:
            pass

        # Jena's config directory (~/.jena/config.json, etc., excluding session logs)
        try:
            rel = p.relative_to(CONFIG_DIR)
            if rel.name not in ["history.json", "memory.json"]:
                return True
        except ValueError:
            pass

        # Shell startup files and binary symlink
        if p in [HOME_DIR / ".bashrc", HOME_DIR / ".zshrc", BIN_TARGET]:
            return True

        # Check if filename is jena or jena2
        if "jena" in p.name.lower() or "jena2" in str(p).lower():
            return True

    except Exception:
        pass
    return False

def record_modification(path_str: str):
    """Record that a Jena system file was modified."""
    global _PENDING_RESTART, _RESTART_REASON
    try:
        norm = str(Path(path_str).expanduser().resolve())
    except Exception:
        norm = str(path_str)
    _MODIFIED_FILES.add(norm)
    _PENDING_RESTART = True
    if not _RESTART_REASON:
        _RESTART_REASON = f"System file modified: {Path(norm).name}"

def request_restart(reason: str = "Self update requested"):
    """Explicitly request an agent restart."""
    global _PENDING_RESTART, _RESTART_REASON
    _PENDING_RESTART = True
    _RESTART_REASON = reason

def has_pending_restart() -> bool:
    """Check if there is a pending restart requested."""
    return _PENDING_RESTART

def clear_pending_restart():
    """Clear pending restart flags."""
    global _PENDING_RESTART, _RESTART_REASON, _MODIFIED_FILES
    _PENDING_RESTART = False
    _RESTART_REASON = ""
    _MODIFIED_FILES.clear()

def get_restart_reason() -> str:
    """Get the reason for the pending restart."""
    return _RESTART_REASON

def get_modified_files() -> List[str]:
    """Get list of modified system files."""
    return sorted(list(_MODIFIED_FILES))

def sync_system_integrations() -> str:
    """
    Ensure all global symlinks and shell aliases point to the current Jena directory.
    Fixes issues if folder is renamed (e.g. jena-agent -> jena2).
    """
    main_py = BASE_DIR / "main.py"
    logs = []

    # 1. Ensure main.py is executable
    if main_py.exists():
        try:
            main_py.chmod(0o755)
            logs.append(f"Executable permissions ensured for '{main_py}'.")
        except Exception as e:
            logs.append(f"chmod error: {e}")

    # 2. Update /usr/bin/jena symlink
    if BIN_TARGET.parent.exists() and BIN_TARGET.parent.is_dir():
        try:
            if BIN_TARGET.is_symlink() or BIN_TARGET.exists():
                try:
                    BIN_TARGET.unlink()
                except Exception:
                    pass
            BIN_TARGET.symlink_to(main_py)
            logs.append(f"Symlink updated: {BIN_TARGET} -> {main_py}")
        except Exception as e:
            logs.append(f"Error updating {BIN_TARGET}: {e}")

    # 3. Update shell aliases (.bashrc, .zshrc)
    alias_cmd = f"alias jena='python3 {main_py}'"
    for rc_name in [".bashrc", ".zshrc"]:
        rc_path = HOME_DIR / rc_name
        if rc_path.exists():
            try:
                content = rc_path.read_text(encoding="utf-8")
                # Pattern to match any existing jena alias
                pattern = r"^alias jena=.*$"
                if re.search(pattern, content, flags=re.MULTILINE):
                    new_content = re.sub(pattern, alias_cmd, content, flags=re.MULTILINE)
                    if new_content != content:
                        rc_path.write_text(new_content, encoding="utf-8")
                        logs.append(f"Updated alias in {rc_name}: {alias_cmd}")
                else:
                    new_content = content.rstrip() + f"\n\n# Jena Autonomous AI Agent\n{alias_cmd}\n"
                    rc_path.write_text(new_content, encoding="utf-8")
                    logs.append(f"Added alias to {rc_name}: {alias_cmd}")
            except Exception as e:
                logs.append(f"Error updating {rc_name}: {e}")

    # 4. Update ~/USER_MANUAL.md symlink if present
    manual_link = HOME_DIR / "USER_MANUAL.md"
    manual_src = BASE_DIR / "USER_MANUAL.md"
    if manual_src.exists():
        try:
            if manual_link.is_symlink() or manual_link.exists():
                try:
                    manual_link.unlink()
                except Exception:
                    pass
            manual_link.symlink_to(manual_src)
            logs.append(f"Symlink updated: {manual_link} -> {manual_src}")
        except Exception as e:
            logs.append(f"Error updating {manual_link}: {e}")

    return "\n".join(logs)

def verify_code_integrity() -> Tuple[bool, str]:
    """
    Check python files in Jena codebase for syntax errors before restarting.
    Prevents restarting into a broken or bricked state.
    """
    # Check all python files under BASE_DIR
    py_files = list(BASE_DIR.glob("**/*.py"))
    for py_file in py_files:
        if "__pycache__" in str(py_file):
            continue
        try:
            py_compile.compile(str(py_file), doraise=True)
        except py_compile.PyCompileError as err:
            return False, f"Syntax error detected in '{py_file.name}': {err}"
        except Exception as e:
            return False, f"Integrity check failed for '{py_file.name}': {e}"

    return True, "Code integrity check passed successfully."

def apply_and_restart(reason: str = "") -> Tuple[bool, str]:
    """
    Verify integrity, sync system paths, and cleanly restart Jena process.
    """
    global _PENDING_RESTART, _RESTART_REASON

    active_reason = reason or _RESTART_REASON or "System files updated."

    # Step 1: Verify code syntax integrity
    ok, msg = verify_code_integrity()
    if not ok:
        return False, f"Restart aborted due to integrity check failure: {msg}"

    # Step 2: Synchronize system symlinks and shell aliases
    sync_report = sync_system_integrations()

    # Step 3: Check execution environment
    main_script = str(BASE_DIR / "main.py")
    if not os.path.exists(main_script):
        return False, f"Cannot restart: {main_script} does not exist."

    # If running in web bridge, don't execv the bridge child; just report success
    if "bridge.py" in sys.argv[0]:
        clear_pending_restart()
        return True, f"Web Bridge: System integrations synced and changes applied.\n{sync_report}"

    # CLI restart via os.execv
    print(f"\n🔄 [Jena Self-Update]: {active_reason}")
    print("Nayi tabdeeliyan apply kar li gayi hain. Jena restart ho rahi hai...\n", flush=True)
    sys.stdout.flush()
    sys.stderr.flush()

    clear_pending_restart()

    # Reconstruct execution args
    args = [sys.executable, main_script]
    # Filter out one-off restart / sync flags so it doesn't loop
    for arg in sys.argv[1:]:
        if arg not in ["--restart", "--sync"] and arg not in args:
            args.append(arg)

    try:
        os.execv(sys.executable, args)
    except Exception as e:
        return False, f"Failed to restart process: {e}"

    return True, "Restart initiated."
