#!/data/data/com.termux/files/usr/bin/node
/**
 * =====================================================================
 *  🤖 JENA v0.3 — Autonomous Hybrid AI Agent (Termux / Linux)
 * =====================================================================
 *  Architecture: Ground Zero Minimalist Engine
 *  - Hybrid AI: Offline (Zero Token Local Engine) + Online Cloud Engine
 *  - Multi-Key Management per Provider / Model with Automatic Rotation
 *  - Real-time Token Counter (Allowance, Used, Balance) & t/s Speed Meter
 *  - Integrated Provider & Model Connection Tester
 *  - Persona: Female ("karungi", "samajh gayi"), Roman Urdu Default
 * =====================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const HOME_DIR = process.env.HOME || '/data/data/com.termux/files/home';
const JENA_DIR = path.join(HOME_DIR, '.jena');
const CONFIG_FILE = path.join(JENA_DIR, 'config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = parseInt(process.env.PORT || '8080', 10);
const BIN_TARGET = '/data/data/com.termux/files/usr/bin/jena';

// --- SYSTEM PERSONA ---
const JENA_SYSTEM_PROMPT = `You are Jena, an autonomous, highly capable, and intelligent female AI agent running inside Termux / Linux.

### IDENTITY & PERSONALITY
- Name: Jena
- Gender: Female. In Roman Urdu, always use female grammatical inflections (e.g. "main karungi", "samajh gayi", "main kar sakti hoon", "meri koshish hogi", "main check karti hoon").
- Role: Autonomous Hybrid AI Agent & Pair Programmer.
- Language Rules: Default language is Roman Urdu (Pakistani Urdu written in Latin script). English is used for programming code, technical commands, or when requested.
- STRICTLY PROHIBITED:
  1. Hindi language vocabulary and Devanagari script are strictly forbidden.
  2. Urdu and Arabic script characters (no Arabic/Persian/Urdu alphabet) must NOT be shown unless user explicitly asks.

### HYBRID CAPABILITIES
- Offline: You can inspect hardware (battery, RAM, disk, uptime), date & time, run local terminal commands, and perform instant calculations without API tokens.
- Online: You use high-speed cloud intelligence for advanced coding, debugging, reasoning, and analysis.`;

// --- PROVIDERS & MODELS REGISTRY (CODE LEVEL) ---
const PROVIDERS = {
  groq: {
    name: 'Groq (Ultra-Fast LPU)',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    type: 'openai-compatible',
    models: [
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Default • Recommended • Ultra Fast)', default: true },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Ziyada Intelligent)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Lightweight)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Large Context 32k)' }
    ]
  },
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    type: 'gemini',
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Recommended • Next-Gen)', default: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (1M Context)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)' }
    ]
  },
  openai: {
    name: 'OpenAI Compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    type: 'openai-compatible',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Economical • Recommended)', default: true },
      { id: 'gpt-4o', name: 'GPT-4o (Flagship Model)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  }
};

// --- CONFIG & MULTI-KEY MANAGER ---
class ConfigManager {
  static ensureDir() {
    if (!fs.existsSync(JENA_DIR)) {
      fs.mkdirSync(JENA_DIR, { recursive: true });
    }
  }

  static load() {
    this.ensureDir();
    const defaults = {
      version: '0.3.0',
      activeProvider: 'groq',
      activeModel: 'qwen/qwen3.8-27b',
      temperature: 0.3,
      maxTokens: 700,
      tokens: {
        allowance: 500000,
        used: 0,
        balance: 500000,
        lastPromptTokens: 0,
        lastPromptSpeed: 0 // t/s
      },
      keys: {
        groq: [],
        gemini: [],
        openai: []
      },
      modelKeys: {} // optional keys bound to specific "provider:model"
    };

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        // Merge with existing legacy keys if present
        if (parsed.groq_api_key && !parsed.keys) {
          defaults.keys.groq = [parsed.groq_api_key];
        }
        if (parsed.gemini_api_key && !parsed.keys) {
          defaults.keys.gemini = [parsed.gemini_api_key];
        }
        if (parsed.provider) defaults.activeProvider = parsed.provider;
        if (parsed.model) defaults.activeModel = parsed.model;

        return { ...defaults, ...parsed, tokens: { ...defaults.tokens, ...(parsed.tokens || {}) }, keys: { ...defaults.keys, ...(parsed.keys || {}) } };
      } catch (_) {}
    }
    this.save(defaults);
    return defaults;
  }

  static save(data) {
    this.ensureDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  static getKeys(provider, model = null) {
    const cfg = this.load();
    const keys = [];
    if (model && cfg.modelKeys && cfg.modelKeys[`${provider}:${model}`]) {
      keys.push(...cfg.modelKeys[`${provider}:${model}`]);
    }
    if (cfg.keys && Array.isArray(cfg.keys[provider])) {
      keys.push(...cfg.keys[provider]);
    }
    return Array.from(new Set(keys.filter(k => typeof k === 'string' && k.trim().length > 0)));
  }

  static addKey(provider, key, model = null) {
    const cfg = this.load();
    const cleanKey = key.trim();
    if (!cleanKey) return false;

    if (model) {
      if (!cfg.modelKeys) cfg.modelKeys = {};
      const mk = `${provider}:${model}`;
      if (!cfg.modelKeys[mk]) cfg.modelKeys[mk] = [];
      if (!cfg.modelKeys[mk].includes(cleanKey)) cfg.modelKeys[mk].push(cleanKey);
    } else {
      if (!cfg.keys) cfg.keys = {};
      if (!cfg.keys[provider]) cfg.keys[provider] = [];
      if (!cfg.keys[provider].includes(cleanKey)) cfg.keys[provider].push(cleanKey);
    }
    this.save(cfg);
    return true;
  }

  static removeKey(provider, keyIndex, model = null) {
    const cfg = this.load();
    if (model && cfg.modelKeys && cfg.modelKeys[`${provider}:${model}`]) {
      const mk = `${provider}:${model}`;
      cfg.modelKeys[mk].splice(keyIndex, 1);
    } else if (cfg.keys && cfg.keys[provider]) {
      cfg.keys[provider].splice(keyIndex, 1);
    }
    this.save(cfg);
    return true;
  }
}

// Key rotation tracker
const keyIndices = {};
function getRotatedKey(provider, model = null) {
  const keys = ConfigManager.getKeys(provider, model);
  if (!keys || keys.length === 0) return null;
  const tag = model ? `${provider}:${model}` : provider;
  if (keyIndices[tag] === undefined) keyIndices[tag] = 0;
  const key = keys[keyIndices[tag] % keys.length];
  keyIndices[tag] = (keyIndices[tag] + 1) % keys.length;
  return key;
}

// --- TOKEN COUNTER & SPEED TRACKER ---
class TokenTracker {
  static recordUsage(promptTokens, completionTokens, elapsedMs) {
    const cfg = ConfigManager.load();
    const totalTokens = (promptTokens || 0) + (completionTokens || 0);
    const elapsedSeconds = Math.max(0.01, elapsedMs / 1000);
    const speed = completionTokens > 0 ? Math.round(completionTokens / elapsedSeconds) : 0;

    cfg.tokens.used = (cfg.tokens.used || 0) + totalTokens;
    cfg.tokens.balance = Math.max(0, (cfg.tokens.allowance || 500000) - cfg.tokens.used);
    cfg.tokens.lastPromptTokens = totalTokens;
    cfg.tokens.lastPromptSpeed = speed;

    ConfigManager.save(cfg);
    return {
      totalTokens,
      allowance: cfg.tokens.allowance,
      used: cfg.tokens.used,
      balance: cfg.tokens.balance,
      speed,
      elapsedSeconds: parseFloat(elapsedSeconds.toFixed(2))
    };
  }

  static setAllowance(newAllowance) {
    const cfg = ConfigManager.load();
    cfg.tokens.allowance = parseInt(newAllowance, 10) || 500000;
    cfg.tokens.balance = Math.max(0, cfg.tokens.allowance - cfg.tokens.used);
    ConfigManager.save(cfg);
    return cfg.tokens;
  }
}

// --- OFFLINE / LOCAL INTELLIGENCE ENGINE ---
class LocalEngine {
  static DAYS_URDU = {
    0: 'Itwar (Sunday)',
    1: 'Peer (Monday)',
    2: 'Mangal (Tuesday)',
    3: 'Budh (Wednesday)',
    4: 'Jumerat (Thursday)',
    5: 'Juma (Friday)',
    6: 'Hafta (Saturday)'
  };

  static isLocalIntent(query) {
    if (!query || typeof query !== 'string') return false;
    const q = query.trim().toLowerCase();

    // If query asks to write code, script, or explain programming, pass to Cloud AI
    const creativeWords = ['script', 'code', 'likho', 'banao', 'create', 'write', 'function', 'class', 'program', 'debug', 'explain'];
    for (const w of creativeWords) {
      if (new RegExp(`\\b${w}\\b`).test(q)) return false;
    }

    if (/\b(battery|charge|charging|battery status)\b/.test(q)) return 'battery';
    if (/\b(ram|memory|free ram|kitni ram)\b/.test(q)) return 'ram';
    if (/\b(storage|disk|space|kitni space)\b/.test(q)) return 'storage';
    if (/\b(time|waqt|date|tarikh|din|aaj kya date|clock)\b/.test(q)) return 'datetime';
    if (/\b(uptime|specs|hardware|system info|device specs)\b/.test(q)) return 'specs';
    if (/\b(files dikhao|list files|folder mein kya|directory check)\b/.test(q) || q === 'ls') return 'list_files';
    if (/\b(pwd|cwd|kahan khari ho)\b/.test(q) || q === 'pwd') return 'pwd';
    if (/^(salam|assalam|hello|hi|hey|kaise ho)\b/.test(q)) return 'greeting';
    if (/^(tum kon ho|who are you|apna intro|apna tarruf)\b/.test(q)) return 'intro';
    if (/^(hisab karo|calculate|math)\b/.test(q) || /^[\d\s\+\-\*\/\(\)\^\.\%]+$/.test(q)) return 'math';

    return false;
  }

  static async execute(intent, query) {
    switch (intent) {
      case 'battery':
        return await this.getBattery();
      case 'ram':
        return this.getRam();
      case 'storage':
        return this.getStorage();
      case 'datetime':
        return this.getDateTime();
      case 'specs':
        return this.getSpecs();
      case 'list_files':
        return this.listFiles();
      case 'pwd':
        return `📂 **Current Working Directory:**\n\`${process.cwd()}\``;
      case 'greeting':
        return 'Walaikum Assalam! Main Jena hoon — aapki autonomous hybrid AI agent. Main offline local tasks aur online cloud AI dono ke sath tayyar hoon. Farmayein, main aapki kis tarah madad kar sakti hoon?';
      case 'intro':
        return 'Main **Jena** hoon (v0.3), aik autonomous hybrid AI agent jo Termux aur Linux ke liye banai gayi hai. Mere paas local offline engine hai jo hardware aur system tasks bina internet aur 0 tokens ke hal karta hai, aur high-speed cloud intelligence jo coding aur complex analysis handle karti hai.';
      case 'math':
        return this.calculate(query);
      default:
        return null;
    }
  }

  static getBattery() {
    return new Promise(resolve => {
      exec('/data/data/com.termux/files/usr/bin/termux-battery-status', { timeout: 6000, shell: '/data/data/com.termux/files/usr/bin/sh' }, (err, stdout) => {
        if (!err && stdout.trim()) {
          try {
            const data = JSON.parse(stdout);
            return resolve(
              `⚡ **Jena Local Battery Report:**\n` +
              `- 🔋 **Percentage:** \`${data.percentage}%\`\n` +
              `- 🔌 **Status:** \`${data.status}\` (${data.plugged})\n` +
              `- 🌡️ **Temperature:** \`${data.temperature}°C\`\n` +
              `- 💚 **Health:** \`${data.health}\`\n\n` +
              `*(Termux Hardware API se bina kisi AI token ke foran calculate kiya gaya.)*`
            );
          } catch (_) {}
        }
        // Fallback sysfs
        try {
          const cap = fs.readFileSync('/sys/class/power_supply/battery/capacity', 'utf8').trim();
          return resolve(`⚡ **Jena Local Battery Report:**\n- 🔋 **Percentage:** \`${cap}%\`\n*(Sysfs hardware se read kiya gaya)*`);
        } catch (_) {}
        resolve('⚠️ Battery status daryaft nahi ho saka (Termux API active nahi hai).');
      });
    });
  }

  static getRam() {
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const lines = meminfo.split('\n');
      const data = {};
      lines.forEach(l => {
        const parts = l.split(':');
        if (parts.length === 2) {
          data[parts[0].trim()] = parseInt(parts[1].trim(), 10);
        }
      });
      const totalMb = Math.round((data.MemTotal || 0) / 1024);
      const availMb = Math.round((data.MemAvailable || data.MemFree || 0) / 1024);
      const usedMb = Math.max(0, totalMb - availMb);
      const pctUsed = totalMb ? ((usedMb / totalMb) * 100).toFixed(1) : 0;

      return (
        `🧠 **Jena Local RAM Report:**\n` +
        `- 📊 **Total RAM:** \`${totalMb} MB\` (${(totalMb / 1024).toFixed(2)} GB)\n` +
        `- 🟢 **Available / Free:** \`${availMb} MB\`\n` +
        `- 🔴 **Used RAM:** \`${usedMb} MB\` (${pctUsed}%)\n\n` +
        `*(RAM ka jaiza \`/proc/meminfo\` se direct calculate kiya gaya.)*`
      );
    } catch (e) {
      return `RAM check error: ${e.message}`;
    }
  }

  static getStorage() {
    return new Promise(resolve => {
      exec('df -h /data 2>/dev/null', { timeout: 2000 }, (err, stdout) => {
        if (!err && stdout.trim()) {
          const lines = stdout.trim().split('\n');
          if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            return resolve(
              `💾 **Jena Local Storage Report:**\n` +
              `- 📦 **Total Size:** \`${parts[1]}\`\n` +
              `- 🔴 **Used:** \`${parts[2]}\` (${parts[4]})\n` +
              `- 🟢 **Free Space:** \`${parts[3]}\`\n\n` +
              `*(Termux /data filesystem se direct read kiya gaya.)*`
            );
          }
        }
        resolve('Storage info daryaft nahi ho saka.');
      });
    });
  }

  static getDateTime() {
    const now = new Date();
    const day = this.DAYS_URDU[now.getDay()] || now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return (
      `🕒 **Waqt Aur Tarikh:**\n` +
      `- ⏰ **Current Time:** \`${timeStr}\`\n` +
      `- 📅 **Date:** \`${dateStr}\`\n` +
      `- 🗓️ **Din:** \`${day}\``
    );
  }

  static getSpecs() {
    const uptimeSec = os.uptime();
    const hrs = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    return (
      `🖥️ **Jena System Specifications:**\n` +
      `- 📱 **Platform:** \`${os.platform()} (${os.arch()})\`\n` +
      `- ⚡ **CPU Cores:** \`${os.cpus().length}\`\n` +
      `- ⏳ **Uptime:** \`${hrs} ghante ${mins} minute\`\n` +
      `- 🐍 **Node.js Version:** \`${process.version}\`\n` +
      `- 📂 **Workspace:** \`${__dirname}\``
    );
  }

  static listFiles() {
    try {
      const items = fs.readdirSync(process.cwd());
      const lines = [`📂 **Current Folder Files:** \`${process.cwd()}\` (${items.length} items)\n`];
      items.slice(0, 30).forEach(item => {
        try {
          const stat = fs.statSync(path.join(process.cwd(), item));
          if (stat.isDirectory()) {
            lines.push(`- 📁 **${item}/**`);
          } else {
            lines.push(`- 📄 \`${item}\` (${(stat.size / 1024).toFixed(1)} KB)`);
          }
        } catch (_) {
          lines.push(`- 📄 \`${item}\``);
        }
      });
      return lines.join('\n');
    } catch (e) {
      return `Files list error: ${e.message}`;
    }
  }

  static calculate(query) {
    try {
      let expr = query.replace(/^(hisab\s+karo|calculate|math|\=)\s*/i, '').trim();
      expr = expr.replace(/\^/g, '**').replace(/x/gi, '*');
      if (/[^0-9\+\-\*\/\(\)\.\s\%]/.test(expr)) return null;
      // Safe math eval using Function with no globals
      const res = Function(`"use strict"; return (${expr})`)();
      return `🧮 **Hisab Result:**\n\`${expr}\` = **\`${res}\`**\n\n*(Local Engine ne bina kisi AI token ke calculation ki.)*`;
    } catch (_) {
      return null;
    }
  }
}

// --- ONLINE CLOUD AI ENGINE ---
class CloudEngine {
  static async generate(prompt, options = {}) {
    const cfg = ConfigManager.load();
    const provider = options.provider || cfg.activeProvider || 'groq';
    const model = options.model || cfg.activeModel || 'qwen/qwen3.8-27b';
    const temp = options.temperature ?? cfg.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? cfg.maxTokens ?? 700;

    const keys = ConfigManager.getKeys(provider, model);
    if (!keys || keys.length === 0) {
      throw new Error(`Khabardar: ${provider.toUpperCase()} ke liye koi API key set nahi hai. Barah-e-karam GUI ya config mein API key add karein.`);
    }

    let lastError = null;
    const startTime = Date.now();

    // Iterate through available keys (automatic key rotation on rate limit/error)
    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      try {
        if (provider === 'gemini') {
          const result = await this.callGemini(model, apiKey, prompt, temp, maxTokens);
          const elapsedMs = Date.now() - startTime;
          const tokenStats = TokenTracker.recordUsage(result.promptTokens, result.completionTokens, elapsedMs);
          return { text: result.text, stats: tokenStats, provider, model };
        } else {
          // Groq or OpenAI
          const endpoint = PROVIDERS[provider]?.endpoint || PROVIDERS.groq.endpoint;
          const result = await this.callOpenAiCompatible(endpoint, model, apiKey, prompt, temp, maxTokens);
          const elapsedMs = Date.now() - startTime;
          const tokenStats = TokenTracker.recordUsage(result.promptTokens, result.completionTokens, elapsedMs);
          return { text: result.text, stats: tokenStats, provider, model };
        }
      } catch (err) {
        lastError = err;
        // If there are more keys, rotate to next key
        if (i < keys.length - 1) {
          continue;
        }
      }
    }
    throw lastError || new Error('Request failed across all configured API keys.');
  }

  static async callOpenAiCompatible(endpoint, model, apiKey, prompt, temperature, maxTokens) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: JENA_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || 'Koi response nahi mila.';
    const promptTokens = data.usage?.prompt_tokens || Math.round(prompt.length / 4);
    const completionTokens = data.usage?.completion_tokens || Math.round(text.length / 4);

    return { text, promptTokens, completionTokens };
  }

  static async callGemini(model, apiKey, prompt, temperature, maxTokens) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: JENA_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Koi response nahi mila.';
    const promptTokens = data.usageMetadata?.promptTokenCount || Math.round(prompt.length / 4);
    const completionTokens = data.usageMetadata?.candidatesTokenCount || Math.round(text.length / 4);

    return { text, promptTokens, completionTokens };
  }
}

// --- MODEL & PROVIDER TEST ENGINE ---
class TestEngine {
  static async testConnection(provider, model) {
    const startTime = Date.now();
    const testPrompt = 'Hello Jena! Respond with "OK: Ready" only.';
    try {
      const res = await CloudEngine.generate(testPrompt, { provider, model, maxTokens: 25 });
      const elapsedMs = Date.now() - startTime;
      const tps = res.stats.speed || Math.round(res.stats.totalTokens / Math.max(0.1, elapsedMs / 1000));

      return {
        success: true,
        provider,
        model,
        latencyMs: elapsedMs,
        tokensPerSecond: tps,
        message: `✅ ${provider.toUpperCase()} (${model}) is Online & Healthy!`,
        reply: res.text.trim()
      };
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      return {
        success: false,
        provider,
        model,
        latencyMs: elapsedMs,
        error: err.message
      };
    }
  }
}

// --- SYSTEM SYNC (GLOBAL COMMAND & SHELL ALIASES) ---
function syncSystemIntegrations() {
  const serverPath = path.resolve(__filename);
  const logs = [];

  // Make server.js executable
  try {
    fs.chmodSync(serverPath, 0o755);
    logs.push(`Executable permission ensured for '${serverPath}'.`);
  } catch (e) {
    logs.push(`chmod error: ${e.message}`);
  }

  // Update /data/data/com.termux/files/usr/bin/jena
  try {
    if (fs.existsSync(BIN_TARGET) || fs.lstatSync(BIN_TARGET).isSymbolicLink()) {
      try { fs.unlinkSync(BIN_TARGET); } catch (_) {}
    }
    fs.symlinkSync(serverPath, BIN_TARGET);
    logs.push(`Symlink created: ${BIN_TARGET} -> ${serverPath}`);
  } catch (e) {
    logs.push(`Symlink error: ${e.message}`);
  }

  // Update .bashrc and .zshrc
  const aliasCmd = `alias jena='node ${serverPath}'`;
  ['.bashrc', '.zshrc'].forEach(rcName => {
    const rcPath = path.join(HOME_DIR, rcName);
    if (fs.existsSync(rcPath)) {
      try {
        let content = fs.readFileSync(rcPath, 'utf8');
        const pattern = /^alias jena=.*$/m;
        if (pattern.test(content)) {
          content = content.replace(pattern, aliasCmd);
          logs.push(`Updated alias in ${rcName}: ${aliasCmd}`);
        } else {
          content = content.trimEnd() + `\n\n# Jena Autonomous AI Agent\n${aliasCmd}\n`;
          logs.push(`Added alias to ${rcName}: ${aliasCmd}`);
        }
        fs.writeFileSync(rcPath, content, 'utf8');
      } catch (e) {
        logs.push(`Alias error in ${rcName}: ${e.message}`);
      }
    }
  });

  return logs.join('\n');
}

// --- HTTP SERVER & API ROUTES ---
function startServer() {
  // Always verify system integration on startup
  try { syncSystemIntegrations(); } catch (_) {}

  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    const sendJson = (code, data) => {
      res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(data));
    };

    const parseBody = () => new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try { resolve(body.trim() ? JSON.parse(body) : {}); }
        catch (err) { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });

    // --- API ROUTES ---

    // GET /api/config
    if (pathname === '/api/config' && method === 'GET') {
      const cfg = ConfigManager.load();
      // Mask keys for security
      const maskedKeys = {};
      Object.keys(cfg.keys || {}).forEach(p => {
        maskedKeys[p] = (cfg.keys[p] || []).map(k => k.length <= 8 ? '****' : k.slice(0, 4) + '...' + k.slice(-4));
      });

      return sendJson(200, {
        activeProvider: cfg.activeProvider || 'groq',
        activeModel: cfg.activeModel || 'qwen/qwen3.8-27b',
        tokens: cfg.tokens || { allowance: 500000, used: 0, balance: 500000, lastPromptSpeed: 0 },
        providers: PROVIDERS,
        maskedKeys,
        keysCount: Object.fromEntries(Object.entries(cfg.keys || {}).map(([p, arr]) => [p, arr.length]))
      });
    }

    // POST /api/config
    if (pathname === '/api/config' && method === 'POST') {
      try {
        const body = await parseBody();
        const cfg = ConfigManager.load();
        if (body.provider) cfg.activeProvider = body.provider;
        if (body.model) cfg.activeModel = body.model;
        if (body.allowance) {
          TokenTracker.setAllowance(body.allowance);
        }
        ConfigManager.save(cfg);
        return sendJson(200, { success: true, message: 'Settings save ho gayi hain.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/keys (Add Key)
    if (pathname === '/api/keys' && method === 'POST') {
      try {
        const body = await parseBody();
        const { provider, key, model } = body;
        if (!provider || !key) return sendJson(400, { error: 'Provider aur key zaroori hain.' });
        const ok = ConfigManager.addKey(provider, key, model);
        return sendJson(200, { success: ok, message: `${provider.toUpperCase()} ke liye API key add ho gayi.` });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // DELETE /api/keys (Delete Key)
    if (pathname === '/api/keys' && method === 'DELETE') {
      try {
        const body = await parseBody();
        const { provider, index, model } = body;
        if (!provider || index === undefined) return sendJson(400, { error: 'Provider aur index zaroori hain.' });
        ConfigManager.removeKey(provider, parseInt(index, 10), model);
        return sendJson(200, { success: true, message: 'Key delete ho gayi.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/test (Test Provider & Model)
    if (pathname === '/api/test' && method === 'POST') {
      try {
        const body = await parseBody();
        const cfg = ConfigManager.load();
        const provider = body.provider || cfg.activeProvider || 'groq';
        const model = body.model || cfg.activeModel || 'qwen/qwen3.8-27b';

        const result = await TestEngine.testConnection(provider, model);
        return sendJson(200, result);
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    }

    // POST /api/chat (Hybrid Chat with SSE Streaming)
    if (pathname === '/api/chat' && method === 'POST') {
      let body;
      try { body = await parseBody(); } catch (err) { return sendJson(400, { error: err.message }); }
      const userMessage = (body.message || '').trim();
      if (!userMessage) return sendJson(400, { error: 'Message cannot be empty.' });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const sendEvent = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

      // 1. Check Offline Local Engine First
      const localIntent = LocalEngine.isLocalIntent(userMessage);
      if (localIntent) {
        sendEvent({ type: 'mode', mode: 'offline' });
        sendEvent({ type: 'thought', content: '⚡ Local Engine active (Zero Token Usage • Offline).' });
        const localResponse = await LocalEngine.execute(localIntent, userMessage);
        sendEvent({
          type: 'done',
          text: localResponse,
          stats: { tokens: 0, tps: 9999, mode: 'offline', allowance: ConfigManager.load().tokens.allowance }
        });
        return res.end();
      }

      // 2. Online Cloud Engine
      sendEvent({ type: 'mode', mode: 'online' });
      sendEvent({ type: 'thought', content: '🌐 Cloud AI Engine se communicate kar rahi hoon...' });

      try {
        const result = await CloudEngine.generate(userMessage, {
          provider: body.provider,
          model: body.model
        });

        sendEvent({
          type: 'done',
          text: result.text,
          stats: result.stats,
          provider: result.provider,
          model: result.model
        });
      } catch (err) {
        sendEvent({
          type: 'error',
          error: err.message
        });
      }
      return res.end();
    }

    // --- STATIC FILES SERVING ---
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    filePath = path.normalize(filePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Access Denied');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        const indexFile = path.join(PUBLIC_DIR, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return fs.createReadStream(indexFile).pipe(res);
        }
        res.writeHead(404);
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  🤖 JENA v0.3 — Autonomous Hybrid AI Agent`);
    console.log(`  Local URL:   http://localhost:${PORT}`);
    console.log(`  Network URL: http://0.0.0.0:${PORT}`);
    console.log(`======================================================\n`);
  });
}

// --- CLI EXECUTION MODE ---
async function runCli(args) {
  if (args.includes('--sync')) {
    console.log('\n🔧 Jena System Integration Sync:');
    console.log(syncSystemIntegrations());
    console.log('\n✅ System integration mukammal ho gayi hai.\n');
    return;
  }

  if (args.includes('--test')) {
    const cfg = ConfigManager.load();
    console.log(`\n⚡ Testing Model: ${cfg.activeProvider.toUpperCase()} (${cfg.activeModel})...`);
    const res = await TestEngine.testConnection(cfg.activeProvider, cfg.activeModel);
    if (res.success) {
      console.log(`\n${res.message}`);
      console.log(`Latency: ${res.latencyMs}ms | Speed: ${res.tokensPerSecond} t/s`);
      console.log(`Reply: ${res.reply}\n`);
    } else {
      console.log(`\n❌ Error: ${res.error}\n`);
    }
    return;
  }

  const query = args.filter(a => !a.startsWith('--')).join(' ').trim();
  if (!query) {
    startServer();
    return;
  }

  // 1. Check Local Engine
  const localIntent = LocalEngine.isLocalIntent(query);
  if (localIntent) {
    console.log('\n⚡ [Jena Local Engine]: Offline Execution (0 Tokens)\n');
    const ans = await LocalEngine.execute(localIntent, query);
    console.log(ans + '\n');
    return;
  }

  // 2. Cloud AI
  console.log('\n[Jena] Soch rahi hoon...');
  try {
    const res = await CloudEngine.generate(query);
    console.log(`\n[Jena]:\n${res.text}\n`);
    console.log(`⚡ Tokens: ${res.stats.totalTokens} | Speed: ${res.stats.speed} t/s | Balance: ${res.stats.balance}\n`);
  } catch (err) {
    console.log(`\n❌ Error: ${err.message}\n`);
  }
}

// --- ENTRY POINT ---
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0 && !args.some(a => a.startsWith('--port'))) {
    runCli(args);
  } else {
    startServer();
  }
}

module.exports = { LocalEngine, CloudEngine, ConfigManager, TokenTracker, TestEngine };
