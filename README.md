# 🤖 JENA v0.3 — Autonomous Hybrid AI Agent (Termux / Linux)

Jena v0.3 ko ground zero se aik ultra-minimalist, lightweight aur powerful architecture par re-architect kiya gaya hai. Ab Jena mein files ki taadad bohot kam hai aur iska poora backend pure Node.js native engine par zero dependencies ke sath chalta hai.

---

## 🌟 Core Features (Jena v0.3)

1. **Minimalist 2-Page Architecture (Only 5 Files):**
   - **Page 1 (💬 Main / Chat):** Token calculators (Allowance, Used, Balance, Speed), Active Engine Indicator, Offline/Online switch, aur full chat conversation viewport.
   - **Page 2 (⚙️ Providers & Models):** Active AI Provider & Model dropdowns, connection tester (`⚡ Test Model`), Multi-API Key Manager, Add Custom Model, aur Add New Online Provider forms.
   - Files:
     - `server.js` : Unified backend (Hybrid AI Engine, Multi-Key Manager, Token Tracker, Test Engine, HTTP/SSE Server & CLI).
     - `public/index.html` : 2-Page responsive GUI interface.
     - `public/style.css` : Dark-mode cybernetic UI design.
     - `public/app.js` : Reactive client routing, live token metrics, and multi-key CRUD.
     - `package.json` : Project metadata.

2. **Dohra Dimaagh & Mode Switch (Hybrid AI Architecture):**
   - 🔘 **Local / Online Mode Switch:** Header mein direct `[🌐 Online]` aur `[⚡ Offline]` switch button mojood hai.
   - ⚡ **Offline Local Engine (Zero Tokens, Instant <0.1s):**
     - Provider dropdown mein `⚡ Offline / Local Engine` aur model `Jena Local Core` direct selectable hain.
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
     - `cd <folder>`: Active directory tabdeel karein (e.g. `cd ~/jena2`).
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

6. **Persona & Language Rules:**
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

# Online AI coding & reasoning:
jena "Python script likho jo local IP address print kare"

# Connection test:
jena --test

# System shortcut sync:
jena --sync
```

---

*Jena v0.3 — Engineered for autonomous efficiency and endless possibilities.*
