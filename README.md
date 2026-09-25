# 🤖 JENA v0.3 — Autonomous Hybrid AI Agent (Termux / Linux)

Jena v0.3 ko ground zero se aik ultra-minimalist, lightweight aur powerful architecture par re-architect kiya gaya hai. Ab Jena mein files ki taadad bohot kam hai aur iska poora backend pure Node.js native engine par zero dependencies ke sath chalta hai.

---

## 🌟 Core Features (Jena v0.3)

1. **Termux-Native Micro-Kernel + Pluggable Tools Architecture (v0.3):**
   - **Entry Point (`server.js`):** Lightweight HTTP/SSE server, auto-port recovery, and CLI router (~550 lines).
   - **Engines (`src/engines/`):**
     - `local.js` : Deterministic offline intent classifier & dispatcher (0 tokens).
     - `cloud.js` : High-speed streaming AI engine (Groq, Gemini, OpenAI) + Connection Tester.
   - **Pluggable Tools (`src/tools/`):**
     - `fs.js` : Termux filesystem tools, EXDEV-safe cross-storage copy/move (Termux ↔ Phone).
     - `terminal.js` : Safe bash execution with automated `-y` flag handling.
     - `system.js` : Termux hardware specs, battery, RAM, storage, and instant math.
     - `device.js` : Mobile hardware controls (Torch, Front/Back Camera, Media Scanner).
     - `git.js` : Git status, diff, log, and auto-commit & push to GitHub.
     - `gui.js` : Self-inspection and live DOM/CSS mutation.
     - `scaffold.js` : Offline full-stack web scaffolding & concept cheatsheets.
   - **Configuration & State (`src/`):**
     - `config.js` : Multi-key rotation, Token tracker, provider configurations.
     - `logger.js` : Append-only conversation JSONL and failure audits.
     - `persona.js` : Autonomous female Jena persona prompt.
   - **Client Web UI (`public/`):**
     - `index.html` : Cybernetic responsive interface with integrated Code Editor & File Tree.
     - `style.css` : Dark-mode cybernetic styling and design tokens.
     - `app.js` : Reactive client router, Monaco-like lightweight editor, and SSE stream parser.

2. **Dohra Dimaagh & Mode Switch (Hybrid AI Architecture):**
   - 🔘 **Local / Online Mode Switch:** Header mein direct `[🌐 Online]` aur `[⚡ Offline]` switch button mojood hai.
   - ⚡ **Offline Local Engine (Zero Tokens, Instant <0.1s):**
     - Provider dropdown mein `⚡ Offline / Local Engine` aur model `Jena Local Core` direct selectable hain.
     - 🔦 **Torch / Flashlight:** `torch on karo`, `torch off karo`, `flashlight jalao`, `batti band karo`.
     - 📸 **Camera & Selfie:**
       - `front camera kholo aor selfie lo` / `selfie lo` (Front Camera • ID: 1).
       - `back camera kholo aor photo lo` / `photo lo` (Back Camera • ID: 0).
       - Photos automatically `/storage/emulated/0/DCIM/Camera/` mein save hoti hain aur `termux-media-scan` ke zariye Android Gallery / Google Photos app mein foran add ho jati hain.
     - 📦 **Cross-Storage File Copy & Move (Termux ↔ Phone):**
       - Termux aur Phone storage (`/storage/emulated/0`) ke darmiyan EXDEV-safe files aur folders copy aur move karna:
         - `phone se test.txt home main copy karo`
         - `termux se public folder phone main move kardo`
         - `public folder ko phone main copy karo`
         - `copy from phone to home <file>`
         - `cp -r <src> <dest>`
     - Battery status (percentage, charging, temperature, health via Termux Hardware API).
     - RAM & Memory jaiza (`/proc/meminfo`).
     - Disk & Storage analysis (`/data` partition).
     - Date & Time (formatted with Roman Urdu days e.g. "Budh", "Jumerat").
     - System hardware specs, CPU cores, device uptime.
     - Local folder exploration & file reading.
     - Safe local instant math calculations.
     - Jena persona greeting & introduction.
   - 📂 **Local Filesystem Navigation (0 Tokens • Full System Control):**
     - `pwd` / `kahan khari ho`: Current working directory check.
     - `cd <folder>`: Active directory tabdeel karein (e.g. `cd ~/jena`).
     - `ls [folder]` / `files dikhao`: Directory listing with file sizes.
     - `cat <file>`: File contents syntax-highlighted preview.
     - `tree [folder]`: Directory tree visualization.
     - `find <term>`: Recursive file and folder search.
     - `mkdir <folder>` & `touch <file>`: Local folder aur file creation.
   - 🧠 **Self-Learning & Self-Updating Offline Operations Engine:**
     - Jena nayi commands aur custom offline operations seekh kar permanent save karti hai (`~/.jena/memory.json`).
     - Sikhane ka tareeqa:
       - `seekho command "myip" = curl ifconfig.me`
       - `seekho: jab main kahoon "system status" to offline command run karo "uptime && free -h"`
       - `seekho: trigger -> command`
       - `seekho: Mera favourite code editor Neovim hai` (knowledge fact)
     - Ek dafa seekhne ke baad Jena us operation ko apne offline engine mein update kar leti hai aur agle kisi bhi waqt bina kisi AI token ke offline execute karti hai.
     - GUI Page 2 par "🧠 Self-Learned Local Operations & Memory Engine" panel mojood hai jahan se aap operations add, delete, aur direct `▶️ Run` button se chala kar live terminal output dekh sakte hain.
   - 🌐 **Online Cloud AI Engine:**
     - High-speed cloud models for advanced coding, debugging, reasoning, and creative work.
     - **Groq LPU:** `qwen/qwen3.8-27b` (Default • Ultra Fast), `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`.
     - **Google Gemini:** `gemini-3.6-flash` (Recommended), `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`.
     - **OpenAI Compatible:** `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`.
   - ➕ **Dynamic Custom Online Providers & Models:**
     - GUI se direct naye online providers (jaise OpenRouter, Together AI, Mistral, DeepSeek, Local Ollama) aur models add karein.
     - Tamam custom providers aur models backend `~/.jena/config.json` mein future use ke liye automatically persist hote hain.

3. **Multi-API Key Management (Per Provider & Per Model):**
   - Har provider/model ke liye user input se aik ya **multiple keys** save ki ja sakti hain.
   - **Automatic Key Rotation:** Agar aik key par rate limit (429) ya quota limit aye to Jena agle key par seamlessly shift ho jati hai.

4. **Live Token Counter & Speed Meter:**
   - 🎯 **Allowance:** Total token budget (user editable).
   - 📈 **Used:** Cumulative tokens consumed across prompts.
   - 💰 **Balance:** Remaining allowance (`Allowance - Used`).
   - ⚡ **Prompt Speed (t/s):** Har prompt ke doran tokens-per-second real-time calculate aur display hota hai.

5. **Integrated Model Connection Tester:**
   - GUI landing page par **"⚡ Test Model"** button aur CLI par `jena --test`:
     - Active provider aur model ka connection verify karta hai.
     - Real-time latency (ms) aur generation speed (t/s) measure karke report deta hai.

6. **📜 Conversation Tracking & Command Failure Logging System:**
   - **Conversation Tracking (`~/.jena/conversation.jsonl`):**
     - Har user interaction aur Jena ka reply timestamp, provider, model, tokens, mode aur status ke sath append-only format mein record hota hai.
   - **Command Failure Logging (`~/.jena/failures.log`):**
     - Kisi bhi command failure (offline command syntax/execution error, non-existent folder, API rate-limit/network error) ki soorat mein poori timestamped error detail `failures.log` mein save ho jati hai.
   - **Terminal Commands:**
     - `jena --logs` : Recent conversation history dekhein.
     - `jena --failures` : Command failure logs aur errors ka jaiza lein.
   - **Web GUI (Page 2 Card 6):**
     - GUI se direct conversation logs aur failure logs dekhein, refresh karein, ya clear karein.

7. **Offline Web Development & Scaffolding Engine (0 Tokens • Zero Dependency):**
   - Jena offline mode mein HTML5, CSS3, Modern JavaScript (ES6+), aur Node.js ke mukammal web projects generate karti hai:
     - `webpage banao portfolio [name]` : Modern portfolio with responsive navigation, hero section, project grid, aur contact cards.
     - `webpage banao landing [name]` : High-converting SaaS landing page with features grid, CTA, aur glassmorphic styling.
     - `webpage banao dashboard [name]` : Analytics dashboard with sidebar, stats cards, aur data table.
     - `webpage banao nodejs [name]` : Pure native Node.js HTTP REST API server with healthcheck endpoint aur `package.json`.
     - `webpage banao blank [name]` : Clean HTML/CSS/JS boilerplate template.
   - Yeh tamam web files Jena ke local engine se instant (<0.1s) generate hoti hain bina kisi AI token ke.

8. **🎨 Jena GUI Self-Inspection & Live Self-Editing:**
   - Jena apne poore codebase aur GUI ko inspect aur directly edit kar sakti hai:
     - `apne index.html ko explain karo`: HTML structure aur components ka complete architectural breakdown.
     - `explain style.css`: CSS variables, design tokens, color palette aur glassmorphic rules ka jaiza.
     - `explain app.js`: SPA client router, SSE stream parser, state management ka breakdown.
     - `explain server.js`: Backend hybrid architecture, filesystem engine aur endpoints ka jaiza.
     - `css main background color #050811 kardo`: Live CSS variable update (browser refresh par instant apply).
     - `css main yeh changes karo: replace "old" with "new"`: Precise string replacement in `public/style.css`.
     - `css main add karo: .my-style { ... }`: Custom CSS rules appending to stylesheet.
     - `index.html main change karo: replace "old" with "new"`: Direct edit on GUI HTML file.

9. **📚 Offline Web Knowledge Base & Syntax Cheatsheets:**
   - `explain html`: Semantic elements, viewport meta tags, forms, media tags.
   - `explain css`: Flexbox layout, CSS Grid 2D, CSS Variables, glassmorphism, media queries.
   - `explain js` / `explain javascript`: Modern ES6+, async/await, DOM events, SSE streaming.
   - `explain nodejs`: Native HTTP server, filesystem streams, event emitters.

10. **✍️ Local File Editor Engine (0 Tokens):**
    - `write file <path> <content>` : Nayi file create karke content likhna.
    - `edit file <path> replace "old" with "new"` : File ke andar target text replace karna.
    - `append file <path> <content>` : Mojooda file ke aakhir mein content shamil karna.

11. **Persona & Language Rules:**
   - Female persona ("main karungi", "samajh gayi", "main check karti hoon").
   - Default language: Roman Urdu (Pakistani Urdu written in standard Latin script).
   - English: Technical code aur programming terms ke liye.
   - Strictly NO Urdu/Arabic script characters and NO Hindi language/Devanagari.

---

## 🚀 Quick Start

### 1. Web GUI Server Chalayein
```bash
npm start
# ya
node server.js
```
Browser mein kholein: **`http://localhost:8080`**

### 2. Global CLI Mode (Terminal)
Terminal mein kisi bhi jagah se:
```bash
# Offline local checks (0 Tokens):
jena "battery check karo"
jena "kitni ram free hai"
jena "aaj kya date hai"
jena "hisab karo 1500 * 25"

# Filesystem navigation:
jena "ls"
jena "pwd"
jena "tree"

# Conversation & Failure Logs:
jena --logs
jena --failures

# Online AI coding & reasoning:
jena "Python script likho jo local IP address print kare"

# Connection test:
jena --test

# System shortcut sync:
jena --sync
```

---

*Jena v0.3 — Engineered for autonomous efficiency and endless possibilities.*
