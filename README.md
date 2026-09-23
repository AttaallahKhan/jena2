# 🤖 Jena — Autonomous AI Agent (Termux / Linux)

Jena ek fully autonomous, self-learning AI agent hai jo Termux aur Linux environment ke liye banai gayi hai. Yeh aapke commands execute kar sakti hai, files create/edit/delete kar sakti hai, missing tools install kar sakti hai, internet search kar sakti hai, aur programming/debugging khud handle karti hai.

---

## 🌟 Core Features & Capabilities

1. **Autonomous Execution (ReAct Loop):** Aap ek task ya goal dete hain, Jena khud steps plan karti hai, tools execute karti hai, errors debug karti hai, aur kaam mukammal karti hai.
2. **Multi-Provider Support & Blazing Fast Inference:**
   - **Groq (Default):** `qwen/qwen3.8-27b` — ultra fast (<0.5s response).
   - **Google Gemini:** `gemini-2.0-flash` / `gemini-3.8-flash`.
   - **OpenAI:** `gpt-4o-mini`.
3. **Optimized Parameters:**
   - Default Provider: `groq`
   - Max Output Tokens: `700`
   - Chat History: `3 turns`
   - Temperature: `0.3`
   - IPv4-first socket priority (Termux timeout fix)
4. **Built-in Tools (13 Tools):**
   - `execute_bash`, `install_package`, `read_file`, `write_file`, `edit_file`, `delete_file`, `list_directory`, `search_web`, `fetch_url`, `save_memory`, `recall_memory`, `restart_agent`, `sync_system`.
5. **Local Intelligence Engine (Zero Token / Offline Heuristics):**
   - Battery, RAM, Storage, System specs, Uptime, Network IP, Date & Time, Instant Math calculations.
   - External AI API par 100% depend hue baghair local tasks ko <0.1s mein bina kisi token ke hal karna.
6. **Mukammal User Manual:**
   - Tafseeli rahnumai ke liye [USER_MANUAL.md](USER_MANUAL.md) mulaheza farmayein.


---

## 🚀 Quick Setup & Usage

### 1. API Key Configure Karein
Terminal mein likhein:
```bash
jena --config
```
Ya phir environment variable export karein:
```bash
export GEMINI_API_KEY="your_api_key_here"
```

### 2. Interactive Chat Mode
Termux mein kahin se bhi sirf `jena` likhein:
```bash
jena
```

### 3. Single-Goal Autonomous Task
Directly CLI se task chalayein:
```bash
jena "Ek python script likho jo battery percentage check kare aur run karke dikhao"
```

### 4. Web GUI Mode (Browser Interface)
Browser mein modern graphic interface chalane ke liye:
```bash
jena --web
```
Ya phir npm / script ke zariye:
```bash
npm start
# Ya
./start_web.sh
```
Browser mein kholein: **`http://localhost:8080`**

### 5. Useful Commands
- `jena --web` : Modern Web GUI shuru karein (Port 8080).
- `jena --web --port 3000` : Custom port par Web GUI chalayein.
- `jena --help` : Tamam options dekhne ke liye.
- `jena --config` : API key ya provider badalne ke liye.
- `jena --provider groq` : Temporary tor par Groq istemal karne ke liye.
- `jena --clear-history` : Chat history saaf karne ke liye.
- `jena --clear-memory` : Long-term facts reset karne ke liye.
- `jena --sync` : System symlink aur shell aliases ko current directory se sync karne ke liye.
- `jena --restart` : Jena ko integrity check ke baad restart karne ke liye.

---

## 📁 Directory Structure
```
jena2/
├── config.py           # Configuration manager (~/.jena/config.json)
├── core/
│   ├── agent.py        # ReAct autonomous loop
│   ├── memory.py       # Short-term history & long-term memory
│   └── persona.py      # Jena persona & system prompt
├── providers/
│   ├── base.py         # Base provider class
│   ├── gemini.py       # Google Gemini REST provider
│   ├── groq.py         # Groq REST provider
│   └── openai_provider.py # OpenAI-compatible REST provider
├── tools/
│   ├── system_tools.py # Bash execution & package installation
│   ├── file_tools.py   # File operations (read/write/edit/delete)
│   ├── web_tools.py    # DuckDuckGo search & web scraping
│   └── registry.py     # Tool schemas & dispatcher
├── web/
│   ├── bridge.py       # Python event stream bridge
│   ├── server.js       # Node.js SSE server & REST API
│   └── public/         # Modern Web GUI (HTML, CSS, JS)
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
├── main.py             # CLI entrypoint (--web supported)
├── package.json        # Node.js package & scripts
├── start_web.sh        # One-click Web GUI launcher
├── setup.sh            # Global installer
└── README.md           # Documentation
```
