import subprocess
import os

def execute_bash(command: str, timeout: int = 120) -> str:
    """Execute a bash command in Termux/Linux and return stdout and stderr."""
    try:
        proc = subprocess.run(
            command,
            shell=True,
            executable="/bin/bash" if os.path.exists("/bin/bash") else "/data/data/com.termux/files/usr/bin/bash",
            capture_output=True,
            text=True,
            timeout=timeout
        )
        output = []
        if proc.stdout:
            output.append(f"STDOUT:\n{proc.stdout.strip()}")
        if proc.stderr:
            output.append(f"STDERR:\n{proc.stderr.strip()}")
        output.append(f"EXIT CODE: {proc.returncode}")

        # Auto-detect if command touched Jena files or renamed directories
        cmd_lower = command.lower()
        if any(keyword in cmd_lower for keyword in ["jena", "git", "setup.sh", ".bashrc", ".zshrc"]):
            from core.self_manager import sync_system_integrations, record_modification, get_base_dir
            sync_system_integrations()
            record_modification(str(get_base_dir()))

        return "\n".join(output) if output else "Command executed successfully with no output."
    except subprocess.TimeoutExpired:
        return f"Error: Command timed out after {timeout} seconds."
    except Exception as e:
        return f"Execution error: {str(e)}"

def sync_system() -> str:
    """Synchronize global symlink (/usr/bin/jena) and shell aliases (.bashrc, .zshrc) to current location."""
    from core.self_manager import sync_system_integrations
    report = sync_system_integrations()
    return f"System integrations synchronized successfully:\n{report}"

def restart_agent(reason: str = "Manual restart requested") -> str:
    """Apply all pending updates to Jena's system files/folders, verify syntax integrity, and restart Jena."""
    from core.self_manager import request_restart, apply_and_restart
    request_restart(reason)
    ok, msg = apply_and_restart(reason)
    return f"Restart status: {msg}"

def install_package(package: str, manager: str = "pkg") -> str:
    """Install a missing tool or package using pkg, apt, or pip."""
    manager = manager.lower().strip()
    if manager in ["pkg", "apt"]:
        cmd = f"pkg install -y {package}"
    elif manager in ["pip", "pip3"]:
        cmd = f"pip install {package}"
    elif manager in ["npm"]:
        cmd = f"npm install -g {package}"
    else:
        return f"Unsupported package manager '{manager}'. Use pkg, pip, or npm."
    return execute_bash(cmd, timeout=300)

