"""
Jena Local Intelligence Engine
Autonomous local execution for system checks, hardware inspection, math,
local file exploration, and agent self-maintenance without LLM API dependency.
"""

import os
import sys
import re
import ast
import json
import shutil
import socket
import platform
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

class LocalIntelligence:
    """Provides fast, local, offline heuristics and execution for common tasks."""

    DAYS_URDU = {
        "Monday": "Peer (Monday)",
        "Tuesday": "Mangal (Tuesday)",
        "Wednesday": "Budh (Wednesday)",
        "Thursday": "Jumerat (Thursday)",
        "Friday": "Juma (Friday)",
        "Saturday": "Hafta (Saturday)",
        "Sunday": "Itwar (Sunday)"
    }

    MONTHS_URDU = {
        1: "January", 2: "February", 3: "March", 4: "April",
        5: "May", 6: "June", 7: "July", 8: "August",
        9: "September", 10: "October", 11: "November", 12: "December"
    }

    @staticmethod
    def is_complex_or_creative_request(text: str) -> bool:
        """Return True if prompt requires creative AI, coding, or deep explanation."""
        creative_keywords = [
            "script", "code", "likho", "banao", "create", "write", "generate",
            "function", "class", "program", "debug", "karo aur", "explain",
            "search", "web", "google", "kya hota hai", "tariqa", "tarika",
            "solve", "karke dikhao", "fix", "install", "git", "commit"
        ]
        text_lower = text.lower()
        for kw in creative_keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                return True
        return False

    @staticmethod
    def get_battery_info() -> str:
        """Inspect battery status using termux-battery-status or Linux sysfs."""
        # 1. Try termux-battery-status
        bin_path = "/data/data/com.termux/files/usr/bin/termux-battery-status"
        cmd = [bin_path] if os.path.exists(bin_path) else ["termux-battery-status"]
        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5
            )
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                pct = data.get("percentage", "N/A")
                status = data.get("status", "Unknown")
                temp = data.get("temperature", 0)
                temp_c = f"{temp:.1f}°C" if isinstance(temp, (int, float)) else str(temp)
                health = data.get("health", "Good")
                plugged = data.get("plugged", "UNPLUGGED")

                return (
                    f"⚡ **Jena Local Battery Report:**\n"
                    f"- 🔋 **Percentage:** `{pct}%`\n"
                    f"- 🔌 **Status:** `{status}` ({plugged})\n"
                    f"- 🌡️ **Temperature:** `{temp_c}`\n"
                    f"- 💚 **Health:** `{health}`\n\n"
                    f"*(Yeh information Termux Hardware API se bina AI API use kiye foran nikali gayi hai.)*"
                )
        except Exception:
            pass

        # 2. Fallback to /sys/class/power_supply
        try:
            capacity_file = Path("/sys/class/power_supply/battery/capacity")
            status_file = Path("/sys/class/power_supply/battery/status")
            if capacity_file.exists():
                pct = capacity_file.read_text().strip()
                status = status_file.read_text().strip() if status_file.exists() else "Unknown"
                return (
                    f"⚡ **Jena Local Battery Report:**\n"
                    f"- 🔋 **Percentage:** `{pct}%`\n"
                    f"- 🔌 **Status:** `{status}`\n\n"
                    f"*(Sysfs hardware node se direct parha gaya.)*"
                )
        except Exception:
            pass

        return "⚠️ Battery status daryaft nahi ho saka (Termux:API install ya active nahi hai)."

    @staticmethod
    def get_ram_info() -> str:
        """Read RAM statistics directly from /proc/meminfo."""
        try:
            meminfo = {}
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        k = parts[0].strip()
                        v = parts[1].strip().split()[0]
                        try:
                            meminfo[k] = int(v)  # in kB
                        except ValueError:
                            pass

            total_mb = meminfo.get("MemTotal", 0) // 1024
            avail_mb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0)) // 1024
            free_mb = meminfo.get("MemFree", 0) // 1024
            used_mb = max(0, total_mb - avail_mb)
            pct_used = (used_mb / total_mb * 100) if total_mb else 0

            return (
                f"🧠 **Jena Local RAM Report:**\n"
                f"- 📊 **Total RAM:** `{total_mb} MB` ({total_mb / 1024:.2f} GB)\n"
                f"- 🟢 **Available / Free:** `{avail_mb} MB`\n"
                f"- 🔴 **Used RAM:** `{used_mb} MB` ({pct_used:.1f}%)\n\n"
                f"*(RAM ka jaiza `/proc/meminfo` se foran calculate kiya gaya hai.)*"
            )
        except Exception as e:
            return f"RAM check karne mein masla pesh aya: {e}"

    @staticmethod
    def get_storage_info() -> str:
        """Inspect storage space using shutil.disk_usage."""
        try:
            target_path = Path.home()
            usage = shutil.disk_usage(str(target_path))
            total_gb = usage.total / (1024 ** 3)
            used_gb = usage.used / (1024 ** 3)
            free_gb = usage.free / (1024 ** 3)
            pct_free = (usage.free / usage.total * 100) if usage.total else 0

            return (
                f"💾 **Jena Local Storage Report:**\n"
                f"- 📂 **Target Folder:** `{target_path}`\n"
                f"- 📦 **Total Space:** `{total_gb:.2f} GB`\n"
                f"- 🔴 **Used Space:** `{used_gb:.2f} GB`\n"
                f"- 🟢 **Free Space:** `{free_gb:.2f} GB` ({pct_free:.1f}% free)\n\n"
                f"*(Storage stats bina kisi AI token ke direct disk check se calculate kiye gaye hain.)*"
            )
        except Exception as e:
            return f"Storage check karne mein masla pesh aya: {e}"

    @staticmethod
    def get_datetime_info() -> str:
        """Get formatted local date and time in Roman Urdu."""
        now = datetime.now()
        day_en = now.strftime("%A")
        day_ur = LocalIntelligence.DAYS_URDU.get(day_en, day_en)
        month_name = LocalIntelligence.MONTHS_URDU.get(now.month, now.strftime("%B"))
        time_12 = now.strftime("%I:%M:%S %p")
        date_str = f"{now.day} {month_name} {now.year}"

        return (
            f"🕒 **Waqt Aur Tarikh:**\n"
            f"- ⏰ **Current Time:** `{time_12}`\n"
            f"- 📅 **Date:** `{date_str}`\n"
            f"- 🗓️ **Din:** `{day_ur}`\n"
        )

    @staticmethod
    def get_system_specs() -> str:
        """Get Linux / Android system specifications and uptime."""
        try:
            # Uptime
            uptime_str = "Unknown"
            uptime_file = Path("/proc/uptime")
            if uptime_file.exists():
                seconds = float(uptime_file.read_text().split()[0])
                hours = int(seconds // 3600)
                mins = int((seconds % 3600) // 60)
                uptime_str = f"{hours} ghante {mins} minute"

            uname = platform.uname()
            py_ver = platform.python_version()
            cpu_count = os.cpu_count() or "Unknown"

            return (
                f"🖥️ **Jena System Hardware & Environment:**\n"
                f"- 📱 **OS / Platform:** `{uname.system} {uname.release}` (Android/Termux)\n"
                f"- ⚙️ **Architecture:** `{uname.machine}`\n"
                f"- ⚡ **CPU Cores:** `{cpu_count}`\n"
                f"- ⏳ **Device Uptime:** `{uptime_str}`\n"
                f"- 🐍 **Python Version:** `{py_ver}`\n"
                f"- 📂 **Jena Working Directory:** `{os.getcwd()}`\n"
            )
        except Exception as e:
            return f"System specs check karne mein error: {e}"

    @staticmethod
    def get_network_info() -> str:
        """Check network connectivity and local IP."""
        is_online = False
        local_ip = "127.0.0.1"
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1.5)
            s.connect(("8.8.8.8", 53))
            local_ip = s.getsockname()[0]
            is_online = True
            s.close()
        except Exception:
            is_online = False

        status_text = "🟢 Connected (Internet Active)" if is_online else "🔴 Offline / Disconnected"
        return (
            f"🌐 **Jena Local Network Status:**\n"
            f"- 📶 **Status:** {status_text}\n"
            f"- 📌 **Local Device IP:** `{local_ip}`\n"
        )

    @staticmethod
    def list_current_directory() -> str:
        """List current directory contents locally with clean formatting."""
        try:
            cwd = Path.cwd()
            items = sorted(cwd.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            lines = [f"📂 **Directory Contents:** `{cwd}` ({len(items)} items)\n"]
            dirs_count = 0
            files_count = 0

            for it in items[:30]:
                if it.is_dir():
                    dirs_count += 1
                    lines.append(f"- 📁 **{it.name}/**")
                else:
                    files_count += 1
                    size_kb = it.stat().st_size / 1024
                    lines.append(f"- 📄 `{it.name}` ({size_kb:.1f} KB)")

            if len(items) > 30:
                lines.append(f"\n*(...aur {len(items) - 30} mazeed items)*")

            lines.append(f"\n*Summary: {dirs_count} Folders, {files_count} Files.*")
            return "\n".join(lines)
        except Exception as e:
            return f"Directory list karne mein error: {e}"

    @staticmethod
    def safe_calculate(query: str) -> Optional[str]:
        """Safely evaluate basic mathematical expressions."""
        clean_expr = re.sub(r'^(hisab\s+karo|calculate|math|compute|\=)\s*', '', query.strip(), flags=re.IGNORECASE)
        # Check if it looks like a math expression: numbers and operators
        if not re.search(r'[\d]', clean_expr):
            return None
        if not re.search(r'[\+\-\*\/\%\^]', clean_expr):
            return None

        # Replace ^ with **
        clean_expr = clean_expr.replace('^', '**').replace('x', '*').replace('X', '*')

        # Disallow unsafe chars
        if re.search(r'[a-zA-Z_]', clean_expr):
            # Allow common math keywords only if no code
            return None

        try:
            node = ast.parse(clean_expr, mode='eval')
            # Check safe AST
            for subnode in ast.walk(node):
                if not isinstance(subnode, (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
                                            ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv,
                                            ast.Mod, ast.Pow, ast.USub, ast.UAdd)):
                    return None

            result = eval(compile(node, '<string>', 'eval'), {"__builtins__": None}, {})
            if isinstance(result, float) and result.is_integer():
                result = int(result)

            return (
                f"🧮 **Hisab / Calculation Result:**\n"
                f"`{clean_expr}` = **`{result}`**\n\n"
                f"*(Local Engine ne bina kisi external AI token ke calculation mukammal ki.)*"
            )
        except Exception:
            return None

    @staticmethod
    def get_local_help() -> str:
        """Display capabilities of Jena's Local Intelligence."""
        return """⚡ **Jena Local Intelligence Capabilities:**

Main sirf external AI (Groq/Gemini/OpenAI) par munhasir nahi hoon. Mere andar mera apna Local Engine mojood hai jo bina internet aur zero API tokens ke foran yeh kaam kar sakta hai:

1. 🔋 **Battery Health:** `battery status`, `charge check karo`
2. 🧠 **RAM & Memory:** `ram check karo`, `kitni ram bachi hai`
3. 💾 **Storage & Disk:** `storage check karo`, `space kitni hai`
4. 🕒 **Date & Time:** `waqt kya hua hai`, `aaj kya date hai`
5. 🖥️ **System Specs & Uptime:** `system specs`, `uptime`
6. 🌐 **Network & Connectivity:** `internet check karo`, `my ip`
7. 📂 **Directory & Files:** `files dikhao`, `pwd`, `list files`
8. 🧮 **Instant Math:** `hisab karo 45 * 120`, `calculate 1024 / 8`
9. 🧠 **Memory Recall:** `memory`, `kya yaad hai`
10. 🔄 **Self Maintenance:** `sync karo`, `restart`

*Complex tasks, coding, debugging aur creative sawaalaat ke liye mera full ReAct AI loop khud-ba-khud kaam sambhal leta hai!*"""

    @classmethod
    def try_handle(cls, user_input: str, memory_mgr=None) -> Optional[str]:
        """
        Evaluate user query against local heuristics.
        Returns formatted Roman Urdu string if handled, or None if delegated to AI.
        """
        if not user_input or not isinstance(user_input, str):
            return None

        clean = user_input.strip()
        low = clean.lower()

        # If user is asking for programming, script generation, or complex queries, do not intercept
        if cls.is_complex_or_creative_request(clean):
            return None

        # 1. Local Help / Capabilities query
        if any(kw in low for kw in ["local help", "offline kaam", "bina ai", "local engine", "local features"]):
            return cls.get_local_help()

        # 2. Battery queries
        if re.search(r'\b(battery|charge|charging|battery percentage|battery status)\b', low):
            return cls.get_battery_info()

        # 3. RAM / Memory queries
        if re.search(r'\b(ram|memory usage|free ram|kitni ram)\b', low):
            return cls.get_ram_info()

        # 4. Storage / Disk queries
        if re.search(r'\b(storage|disk space|free storage|kitni space|rom)\b', low):
            return cls.get_storage_info()

        # 5. Date & Time queries
        if re.search(r'\b(waqt|time kya|aaj kya date|tarikh|konsa din|current time|clock|ghari)\b', low):
            return cls.get_datetime_info()

        # 6. System Hardware / Specs / Uptime
        if re.search(r'\b(uptime|specs|hardware specs|system specs|device specs|kitni der se on)\b', low):
            return cls.get_system_specs()

        # 7. Network / IP
        if re.search(r'\b(internet check|network status|my ip|ip address|online ho)\b', low):
            return cls.get_network_info()

        # 8. Directory / Current Folder Listing
        if re.search(r'\b(list files|files dikhao|folder mein kya|directory check|yahan kya files)\b', low) or low in ["ls", "dir"]:
            return cls.list_current_directory()

        if re.search(r'\b(pwd|cwd|current directory|kahan khari ho|working directory)\b', low) or low == "pwd":
            return f"📂 **Current Working Directory:**\n`{os.getcwd()}`\n"

        # 9. Persistent Memory Recall
        if re.search(r'\b(kya yaad hai|memory dikhao|facts batao|yaadain|recall memory)\b', low):
            if memory_mgr:
                summary = memory_mgr.get_facts_summary()
                return f"🧠 **Jena Long-Term Memory:**\n\n{summary}"
            return "Memory manager initialize nahi hai."

        # 10. Self Maintenance (Sync & Restart)
        if low in ["sync", "sync karo", "sync system"]:
            from core.self_manager import sync_system_integrations
            rep = sync_system_integrations()
            return f"🔄 **System Integrations Synced:**\n{rep}"

        # 11. Safe Math Calculations
        math_res = cls.safe_calculate(clean)
        if math_res:
            return math_res

        # 12. Friendly Greeting / Identity (Zero Token Cost!)
        if re.match(r'^(salam|assalam-o-alaikum|assalam o alaikum|hello jena|hi jena|hey jena|kaise ho jena)\b', low):
            return (
                "Walaikum Assalam! Main Jena hoon — aapki autonomous AI agent aur pair programmer. "
                "Main local engine aur fast AI dono se equip hoon. Farmayein, main aapki kis tarah madad kar sakti hoon?"
            )

        if low in ["tum kon ho", "who are you", "apna intro do", "apna taruf", "apna tarruf"]:
            return (
                "Main **Jena** hoon, aik autonomous AI agent jo Termux aur Linux ke liye design ki gayi hai. "
                "Mujh mein dohra dimaagh hai: aik **Local Intelligence Engine** jo hardware, battery, storage, time, aur calculations "
                "bina internet ke foran hal karta hai, aur doosra **High-Speed AI Engine** (Groq/Gemini) jo coding, reasoning, aur complex tasks handle karta hai."
            )

        return None
