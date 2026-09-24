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
const MEMORY_FILE = path.join(JENA_DIR, 'memory.json');
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
const DEFAULT_PROVIDERS = {
  offline: {
    name: '⚡ Offline / Local Engine',
    type: 'local',
    models: [
      { id: 'jena-local-core', name: 'Jena Local Core (Hardware, Stats, Terminal, Math)', default: true }
    ]
  },
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

// Backwards compatibility alias
const PROVIDERS = DEFAULT_PROVIDERS;

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
      mode: 'online', // 'online' | 'offline'
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
      modelKeys: {}, // optional keys bound to specific "provider:model"
      customProviders: {},
      customModels: {}
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

        return {
          ...defaults,
          ...parsed,
          tokens: { ...defaults.tokens, ...(parsed.tokens || {}) },
          keys: { ...defaults.keys, ...(parsed.keys || {}) },
          customProviders: { ...(parsed.customProviders || {}) },
          customModels: { ...(parsed.customModels || {}) }
        };
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

  static getAllProviders() {
    const cfg = this.load();
    const combined = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));

    // Merge custom providers
    if (cfg.customProviders && typeof cfg.customProviders === 'object') {
      Object.entries(cfg.customProviders).forEach(([pid, pData]) => {
        combined[pid] = { ...pData };
      });
    }

    // Merge custom models
    if (cfg.customModels && typeof cfg.customModels === 'object') {
      Object.entries(cfg.customModels).forEach(([pid, modelsArr]) => {
        if (combined[pid]) {
          if (!combined[pid].models) combined[pid].models = [];
          modelsArr.forEach(m => {
            if (!combined[pid].models.some(existing => existing.id === m.id)) {
              combined[pid].models.push(m);
            }
          });
        }
      });
    }

    return combined;
  }

  static addCustomProvider({ id, name, endpoint, type = 'openai-compatible', defaultModelId, defaultModelName }) {
    const cfg = this.load();
    if (!cfg.customProviders) cfg.customProviders = {};
    const cleanId = (id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanId) throw new Error('Provider ID lazmi hai.');
    const cleanName = (name || cleanId).trim();
    const cleanEndpoint = (endpoint || '').trim();
    if (!cleanEndpoint) throw new Error('API Endpoint URL lazmi hai.');

    const modelId = (defaultModelId || 'default').trim();
    const modelName = (defaultModelName || modelId).trim();

    cfg.customProviders[cleanId] = {
      name: cleanName,
      endpoint: cleanEndpoint,
      type: type || 'openai-compatible',
      custom: true,
      models: [
        { id: modelId, name: modelName, default: true, custom: true }
      ]
    };

    if (!cfg.keys) cfg.keys = {};
    if (!cfg.keys[cleanId]) cfg.keys[cleanId] = [];

    this.save(cfg);
    return { id: cleanId, provider: cfg.customProviders[cleanId] };
  }

  static addCustomModel(providerId, modelId, modelName) {
    const cfg = this.load();
    if (!cfg.customModels) cfg.customModels = {};
    const cleanPid = (providerId || '').trim();
    const cleanMid = (modelId || '').trim();
    const cleanMname = (modelName || cleanMid).trim();

    if (!cleanPid || !cleanMid) throw new Error('Provider aur Model ID lazmi hain.');

    if (!cfg.customModels[cleanPid]) cfg.customModels[cleanPid] = [];
    if (!cfg.customModels[cleanPid].some(m => m.id === cleanMid)) {
      cfg.customModels[cleanPid].push({ id: cleanMid, name: cleanMname, custom: true });
    }

    this.save(cfg);
    return { provider: cleanPid, model: { id: cleanMid, name: cleanMname } };
  }

  static deleteCustomModel(providerId, modelId) {
    const cfg = this.load();
    if (cfg.customModels && cfg.customModels[providerId]) {
      cfg.customModels[providerId] = cfg.customModels[providerId].filter(m => m.id !== modelId);
    }
    if (cfg.customProviders && cfg.customProviders[providerId] && cfg.customProviders[providerId].models) {
      cfg.customProviders[providerId].models = cfg.customProviders[providerId].models.filter(m => m.id !== modelId);
    }
    this.save(cfg);
    return true;
  }

  static deleteCustomProvider(providerId) {
    const cfg = this.load();
    if (cfg.customProviders && cfg.customProviders[providerId]) {
      delete cfg.customProviders[providerId];
    }
    if (cfg.customModels && cfg.customModels[providerId]) {
      delete cfg.customModels[providerId];
    }
    if (cfg.keys && cfg.keys[providerId]) {
      delete cfg.keys[providerId];
    }
    this.save(cfg);
    return true;
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

// --- SELF-LEARNING & PERSISTENT MEMORY MANAGER ---
class MemoryManager {
  static ensureDir() {
    ConfigManager.ensureDir();
  }

  static load() {
    this.ensureDir();
    const defaults = {
      user_preferences: { language: 'Roman Urdu' },
      learned_facts: [
        { id: 'fact-user', topic: 'user_name', fact: 'User ka naam AbuSaif / Saifullah hai.', createdAt: new Date().toISOString() }
      ],
      learned_operations: [
        {
          id: 'op-uname',
          name: 'kernel_info',
          trigger: 'uname',
          command: 'uname -a',
          description: 'Linux kernel and system architecture report',
          createdAt: new Date().toISOString()
        },
        {
          id: 'op-whoami',
          name: 'user_identity',
          trigger: 'whoami',
          command: 'whoami',
          description: 'Current Termux system user',
          createdAt: new Date().toISOString()
        },
        {
          id: 'op-top',
          name: 'process_check',
          trigger: 'top process',
          command: 'ps aux | head -n 10',
          description: 'Top running processes check',
          createdAt: new Date().toISOString()
        }
      ]
    };

    if (fs.existsSync(MEMORY_FILE)) {
      try {
        const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        let facts = defaults.learned_facts;
        if (Array.isArray(parsed.learned_facts)) {
          facts = parsed.learned_facts;
        } else if (parsed.learned_facts && typeof parsed.learned_facts === 'object') {
          facts = Object.entries(parsed.learned_facts).map(([k, v]) => ({
            id: 'fact-' + k,
            topic: k,
            fact: typeof v === 'string' ? v : JSON.stringify(v),
            createdAt: new Date().toISOString()
          }));
        }

        let operations = Array.isArray(parsed.learned_operations) ? parsed.learned_operations : defaults.learned_operations;

        return {
          ...defaults,
          ...parsed,
          learned_facts: facts,
          learned_operations: operations
        };
      } catch (_) {}
    }
    this.save(defaults);
    return defaults;
  }

  static save(data) {
    this.ensureDir();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
  }

  static addFact(factText, topic = 'general') {
    const mem = this.load();
    const newFact = {
      id: 'fact-' + Date.now(),
      topic: (topic || 'general').trim(),
      fact: factText.trim(),
      createdAt: new Date().toISOString()
    };
    mem.learned_facts.push(newFact);
    this.save(mem);
    return newFact;
  }

  static addOperation(name, trigger, command, description = '') {
    const mem = this.load();
    const cleanTrigger = (trigger || '').trim().toLowerCase();
    const cleanCmd = (command || '').trim();
    if (!cleanTrigger || !cleanCmd) throw new Error('Trigger aur command lazmi hain.');

    const cleanName = (name || cleanTrigger).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    const idx = mem.learned_operations.findIndex(o => o.trigger === cleanTrigger || o.name === cleanName);
    const newOp = {
      id: 'op-' + Date.now(),
      name: cleanName,
      trigger: cleanTrigger,
      command: cleanCmd,
      description: description.trim() || `Command: ${cleanCmd}`,
      createdAt: new Date().toISOString()
    };

    if (idx >= 0) {
      mem.learned_operations[idx] = newOp;
    } else {
      mem.learned_operations.push(newOp);
    }

    this.save(mem);
    return newOp;
  }

  static deleteOperation(idOrName) {
    const mem = this.load();
    mem.learned_operations = mem.learned_operations.filter(o => o.id !== idOrName && o.name !== idOrName);
    this.save(mem);
    return true;
  }

  static deleteFact(id) {
    const mem = this.load();
    mem.learned_facts = mem.learned_facts.filter(f => f.id !== id);
    this.save(mem);
    return true;
  }

  static findOperation(query) {
    if (!query || typeof query !== 'string') return null;
    const q = query.trim().toLowerCase();
    const mem = this.load();

    return mem.learned_operations.find(o => {
      const trig = o.trigger.toLowerCase();
      if (q === trig) return true;
      if (q.startsWith(trig + ' ')) return true;
      // Word boundary match
      const escaped = trig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|\\s)${escaped}($|\\s)`).test(q);
    });
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
  static currentDir = HOME_DIR;

  static DAYS_URDU = {
    0: 'Itwar (Sunday)',
    1: 'Peer (Monday)',
    2: 'Mangal (Tuesday)',
    3: 'Budh (Wednesday)',
    4: 'Jumerat (Thursday)',
    5: 'Juma (Friday)',
    6: 'Hafta (Saturday)'
  };

  static getCwd() {
    if (!this.currentDir || !fs.existsSync(this.currentDir)) {
      this.currentDir = HOME_DIR;
    }
    return this.currentDir;
  }

  static resolvePath(inputPath) {
    if (!inputPath || inputPath.trim() === '' || inputPath === '~') {
      return HOME_DIR;
    }
    const trimmed = inputPath.trim();
    if (trimmed.startsWith('~/')) {
      return path.join(HOME_DIR, trimmed.slice(2));
    }
    if (path.isAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }
    return path.normalize(path.join(this.getCwd(), trimmed));
  }

  static isLocalIntent(query) {
    if (!query || typeof query !== 'string') return false;
    const q = query.trim().toLowerCase();

    // 1. Self-Learning trigger (user is teaching Jena)
    if (/^(seekho|yaad rakho|note karo|learn|memorize)[:\s]/i.test(q)) {
      return 'teach';
    }

    // 2. Memory query (user asks what Jena knows/learned)
    if (/^(kya seekha hai|kya yaad hai|yaad kya hai|memory check|show memory|learned operations|learned commands)\b/i.test(q) || q === 'memory') {
      return 'show_memory';
    }

    // 3. Registered Self-Learned Local Operations check
    const learnedOp = MemoryManager.findOperation(q);
    if (learnedOp) {
      return { type: 'learned_op', op: learnedOp };
    }

    // 4. Filesystem Navigation
    if (/^cd(\s+.*)?$/i.test(q) || /^folder badlo(\s+.*)?$/i.test(q) || /^andar jao(\s+.*)?$/i.test(q)) {
      return 'cd';
    }
    if (/^(pwd|kahan khari ho|kahan ho|current directory|current path)$/i.test(q)) {
      return 'pwd';
    }
    if (/^(ls|dir)(\s+.*)?$/i.test(q) || /\b(files dikhao|list files|folder mein kya|directory check)\b/i.test(q)) {
      return 'ls';
    }
    if (/^(cat|view|read|file parho|file dikhao)\s+/i.test(q)) {
      return 'cat';
    }
    if (/^(tree|folder tree)(\s+.*)?$/i.test(q)) {
      return 'tree';
    }
    if (/^(find|dhoondo|search file)\s+/i.test(q)) {
      return 'find';
    }
    if (/^(mkdir|folder banao)\s+/i.test(q)) {
      return 'mkdir';
    }
    if (/^(touch|file banao)\s+/i.test(q)) {
      return 'touch';
    }

    // If query asks to write code, script, or explain programming, pass to Cloud AI
    const creativeWords = ['script', 'code', 'likho', 'banao', 'create', 'write', 'function', 'class', 'program', 'debug', 'explain'];
    for (const w of creativeWords) {
      if (new RegExp(`\\b${w}\\b`).test(q)) return false;
    }

    // 5. Hardware & System Specs
    if (/\b(battery|charge|charging|battery status)\b/.test(q)) return 'battery';
    if (/\b(ram|memory|free ram|kitni ram)\b/.test(q)) return 'ram';
    if (/\b(storage|disk|space|kitni space)\b/.test(q)) return 'storage';
    if (/\b(time|waqt|date|tarikh|din|aaj kya date|clock)\b/.test(q)) return 'datetime';
    if (/\b(uptime|specs|hardware|system info|device specs)\b/.test(q)) return 'specs';
    if (/^(salam|assalam|hello|hi|hey|kaise ho)\b/.test(q)) return 'greeting';
    if (/^(tum kon ho|who are you|apna intro|apna tarruf)\b/.test(q)) return 'intro';
    if (/^(hisab karo|calculate|math)\b/.test(q) || /^[\d\s\+\-\*\/\(\)\^\.\%]+$/.test(q)) return 'math';

    return false;
  }

  static async execute(intent, query) {
    if (typeof intent === 'object' && intent.type === 'learned_op') {
      return await this.executeLearnedOperation(intent.op);
    }

    switch (intent) {
      case 'teach':
        return this.learnFromInput(query);
      case 'show_memory':
        return this.showMemory();
      case 'cd':
        return this.changeDirectory(query);
      case 'pwd':
        return `📍 **Current Working Directory:**\n\`${this.getCwd()}\``;
      case 'ls':
        return this.listFiles(query);
      case 'cat':
        return this.readFile(query);
      case 'tree':
        return this.viewTree(query);
      case 'find':
        return this.searchFiles(query);
      case 'mkdir':
        return this.makeDirectory(query);
      case 'touch':
        return this.createFile(query);
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
      case 'greeting':
        return 'Walaikum Assalam! Main Jena hoon — aapki autonomous hybrid AI agent. Main offline local tasks, filesystem navigation, aur self-learned operations 0 tokens par foran hal karti hoon. Farmayein, main aapki kis tarah madad kar sakti hoon?';
      case 'intro':
        return 'Main **Jena** hoon (v0.3), aik autonomous hybrid AI agent jo Termux aur Linux ke liye banai gayi hai. Mere paas self-learning engine hai jo nayi local operations seekh kar offline save kar sakta hai, filesystem navigation capability hai, aur high-speed cloud intelligence jo coding aur complex analysis handle karti hai.';
      case 'math':
        return this.calculate(query);
      default:
        return null;
    }
  }

  // --- SELF-LEARNING & OPERATIONS EXECUTION ---
  static executeLearnedOperation(op) {
    return new Promise(resolve => {
      const cwd = this.getCwd();
      exec(op.command, {
        cwd,
        timeout: 10000,
        shell: '/data/data/com.termux/files/usr/bin/sh',
        env: { ...process.env, HOME: HOME_DIR }
      }, (err, stdout, stderr) => {
        const out = (stdout || '').trim();
        const errOut = (stderr || '').trim();
        let body = '';
        if (out) body += out;
        if (errOut) body += (body ? '\n' : '') + errOut;
        if (err && !body) body = `Error: ${err.message}`;

        resolve(
          `⚡ **Jena Self-Learned Local Operation: \`${op.name}\`**\n` +
          `- 📍 **CWD:** \`${cwd}\`\n` +
          `- ⌨️ **Command:** \`${op.command}\`\n\n` +
          `\`\`\`sh\n${body || '(Command executed successfully with no output)'}\n\`\`\`\n\n` +
          `*(Self-Learned offline operation bina kisi token ke run hua.)*`
        );
      });
    });
  }

  static learnFromInput(query) {
    let clean = query.replace(/^(seekho|yaad rakho|note karo|learn|memorize)[:\s]+/i, '').trim();

    // 1. Pattern: command "name" = bash_command OR op "name" = bash_command
    const cmdMatch1 = clean.match(/^(?:command|op)\s+["']?([a-z0-9_-]+)["']?\s*(?:=|:|\->)\s*(.+)$/i);
    if (cmdMatch1) {
      const name = cmdMatch1[1].trim();
      const cmd = cmdMatch1[2].trim();
      const op = MemoryManager.addOperation(name, name, cmd, `Learned custom operation: ${cmd}`);
      return (
        `🧠 **Jena Ne Naya Local Operation Seekh Liya Hai!**\n\n` +
        `- 🏷️ **Name / Trigger:** \`${op.name}\`\n` +
        `- ⚡ **Command:** \`${op.command}\`\n` +
        `- 📁 **Saved In:** \`~/.jena/memory.json\`\n\n` +
        `Main ne is operation ko apne offline engine mein update kar liya hai. Ab aap jab bhi **\`${op.name}\`** kahenge to main yeh operation bina kisi AI token ke offline chalaungi!`
      );
    }

    // 2. Pattern: jab main kahoon "trigger" to offline command run karo "command"
    const cmdMatch2 = clean.match(/^jab\s+main\s+kah[ou]+n\s+["']?([^"']+)["']?\s+to\s+(?:offline\s+)?(?:command\s+run\s+karo\s+|command\s+|chalao\s+)?["']?([^"']+)["']?$/i);
    if (cmdMatch2) {
      const trigger = cmdMatch2[1].trim();
      const cmd = cmdMatch2[2].trim();
      const op = MemoryManager.addOperation(trigger, trigger, cmd, `Trigger: ${trigger}`);
      return (
        `🧠 **Jena Ne Naya Local Operation Seekh Liya Hai!**\n\n` +
        `- 🏷️ **Trigger Phrase:** \`${op.trigger}\`\n` +
        `- ⚡ **Offline Command:** \`${op.command}\`\n\n` +
        `Yeh operation mere offline engine mein register ho gaya hai. Aap abhi **\`${op.trigger}\`** bol kar test kar sakte hain!`
      );
    }

    // 3. Pattern: trigger -> command
    if (clean.includes('->')) {
      const parts = clean.split('->');
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        const trigger = parts[0].trim();
        const cmd = parts[1].trim();
        const op = MemoryManager.addOperation(trigger, trigger, cmd, `Shortcut: ${cmd}`);
        return (
          `🧠 **Jena Ne Naya Local Operation Seekh Liya Hai!**\n\n` +
          `- 🏷️ **Trigger:** \`${op.trigger}\`\n` +
          `- ⚡ **Command:** \`${op.command}\`\n\n` +
          `Aapka custom command mere offline system mein update ho chuka hai.`
        );
      }
    }

    // 4. Fallback: Knowledge Fact
    const fact = MemoryManager.addFact(clean);
    return (
      `🧠 **Jena Ne Yeh Maloomat Yaad Rakh Li Hai:**\n\n` +
      `📌 *"${fact.fact}"*\n\n` +
      `- 🗂️ **Memory File:** \`~/.jena/memory.json\`\n` +
      `- ⚡ **Status:** Offline memory mein permanent save ho chuki hai.`
    );
  }

  static showMemory() {
    const mem = MemoryManager.load();
    const opsCount = mem.learned_operations.length;
    const factsCount = mem.learned_facts.length;

    let res = `🧠 **Jena Ki Self-Learned Memory & Operations:**\n\n`;

    res += `⚡ **Self-Learned Offline Operations (${opsCount}):**\n`;
    if (opsCount === 0) {
      res += `- *Koi custom operation registered nahi hai.*\n`;
    } else {
      mem.learned_operations.forEach(o => {
        res += `- 🏷️ **\`${o.trigger}\`** ➔ \`${o.command}\` *(${o.description || 'Custom Op'})*\n`;
      });
    }

    res += `\n📌 **Learned Facts & Knowledge (${factsCount}):**\n`;
    if (factsCount === 0) {
      res += `- *Koi fact saved nahi hai.*\n`;
    } else {
      mem.learned_facts.forEach(f => {
        res += `- 💡 ${f.fact}\n`;
      });
    }

    res += `\n*(Naya operation sikhane ke liye: \`seekho command "myip" = curl ifconfig.me\` ya \`seekho: mera favourite editor vim hai\`)*`;
    return res;
  }

  // --- LOCAL FILESYSTEM NAVIGATION ---
  static changeDirectory(query) {
    let target = query.replace(/^(cd|folder badlo|andar jao)\s*/i, '').trim();
    if (!target || target === '~') target = HOME_DIR;
    const dest = this.resolvePath(target);

    if (!fs.existsSync(dest)) {
      return `❌ **Error:** Folder mojood nahi hai:\n\`${dest}\``;
    }

    try {
      const stat = fs.statSync(dest);
      if (!stat.isDirectory()) {
        return `❌ **Error:** Yeh directory nahi balkay file hai:\n\`${dest}\``;
      }

      this.currentDir = dest;
      const items = fs.readdirSync(dest);
      const dirCount = items.filter(i => {
        try { return fs.statSync(path.join(dest, i)).isDirectory(); } catch (_) { return false; }
      }).length;
      const fileCount = items.length - dirCount;

      return (
        `📂 **Directory Changed (CWD Updated):**\n` +
        `- 📍 **Current Path:** \`${this.currentDir}\`\n` +
        `- 📊 **Items Inside:** \`${items.length}\` (${dirCount} folders, ${fileCount} files)\n\n` +
        `*(Files dekhne ke liye \`ls\` likhein.)*`
      );
    } catch (err) {
      return `❌ **cd Error:** ${err.message}`;
    }
  }

  static listFiles(query = '') {
    let target = (query || '').replace(/^(ls|dir|files dikhao|list files|folder mein kya|directory check)\s*/i, '').trim();
    const dir = target ? this.resolvePath(target) : this.getCwd();

    if (!fs.existsSync(dir)) {
      return `❌ **Error:** Path mojood nahi hai:\n\`${dir}\``;
    }

    try {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) {
        return `❌ **Error:** Yeh directory nahi hai:\n\`${dir}\``;
      }

      const items = fs.readdirSync(dir);
      items.sort((a, b) => {
        let aDir = false, bDir = false;
        try { aDir = fs.statSync(path.join(dir, a)).isDirectory(); } catch (_) {}
        try { bDir = fs.statSync(path.join(dir, b)).isDirectory(); } catch (_) {}
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
        return a.localeCompare(b);
      });

      const lines = [
        `📂 **Folder Listing:** \`${dir}\` (${items.length} items)\n`
      ];

      const displayItems = items.slice(0, 45);
      displayItems.forEach(item => {
        try {
          const s = fs.statSync(path.join(dir, item));
          if (s.isDirectory()) {
            lines.push(`- 📁 **${item}/**`);
          } else {
            const kb = (s.size / 1024).toFixed(1);
            lines.push(`- 📄 \`${item}\` (${kb} KB)`);
          }
        } catch (_) {
          lines.push(`- 📄 \`${item}\``);
        }
      });

      if (items.length > 45) {
        lines.push(`\n*...aur ${items.length - 45} mazeed items mojood hain.*`);
      }

      return lines.join('\n');
    } catch (err) {
      return `❌ **ls Error:** ${err.message}`;
    }
  }

  static readFile(query) {
    let target = query.replace(/^(cat|view|read|file parho|file dikhao)\s+/i, '').trim();
    if (!target) {
      return '⚠️ Barah-e-karam file ka naam batayein (e.g. `cat package.json`).';
    }
    const filePath = this.resolvePath(target);
    if (!fs.existsSync(filePath)) {
      return `❌ **Error:** File mojood nahi hai:\n\`${filePath}\``;
    }
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return `❌ **Error:** Yeh folder hai, file nahi:\n\`${filePath}\``;
      }
      if (stat.size > 200 * 1024) {
        return `⚠️ **File Too Large:** File ka size ${(stat.size / 1024).toFixed(1)} KB hai. Output overflow se bachne ke liye choti files parhein.`;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).replace('.', '') || 'text';
      const lines = content.split('\n');
      const preview = lines.slice(0, 120).join('\n');
      const truncatedNotice = lines.length > 120 ? `\n\n*(Truncated: Total ${lines.length} lines mein se pehli 120 lines dikhai gayi hain.)*` : '';

      return (
        `📄 **File Content:** \`${path.basename(filePath)}\` (${(stat.size / 1024).toFixed(1)} KB, ${lines.length} lines)\n\n` +
        `\`\`\`${ext}\n${preview}\n\`\`\`` +
        truncatedNotice
      );
    } catch (err) {
      return `❌ **cat Error:** ${err.message}`;
    }
  }

  static viewTree(query = '') {
    let target = (query || '').replace(/^(tree|folder tree)\s*/i, '').trim();
    const rootDir = target ? this.resolvePath(target) : this.getCwd();
    if (!fs.existsSync(rootDir)) {
      return `❌ **Error:** Folder mojood nahi hai: \`${rootDir}\``;
    }

    try {
      const lines = [`🌲 **Folder Structure Tree:** \`${rootDir}\`\n`];

      const traverse = (dir, depth = 0, prefix = '') => {
        if (depth >= 2) return;
        let items = [];
        try { items = fs.readdirSync(dir); } catch (_) { return; }
        items = items.filter(i => !['node_modules', '.git', '.cache', '.gemini'].includes(i)).slice(0, 20);

        items.forEach((item, index) => {
          const isLast = index === items.length - 1;
          const fullPath = path.join(dir, item);
          let isDir = false;
          try { isDir = fs.statSync(fullPath).isDirectory(); } catch (_) {}

          lines.push(`${prefix}${isLast ? '└── ' : '├── '}${isDir ? '📁 ' + item + '/' : '📄 ' + item}`);
          if (isDir) {
            traverse(fullPath, depth + 1, prefix + (isLast ? '    ' : '│   '));
          }
        });
      };

      traverse(rootDir);
      return '```\n' + lines.join('\n') + '\n```';
    } catch (err) {
      return `❌ **tree Error:** ${err.message}`;
    }
  }

  static searchFiles(query) {
    let term = query.replace(/^(find|dhoondo|search file)\s+/i, '').trim();
    if (!term) return '⚠️ Barah-e-karam search term likhein (e.g. `find config`).';
    const rootDir = this.getCwd();
    const matches = [];

    const searchDir = (dir, depth = 0) => {
      if (depth >= 3 || matches.length >= 25) return;
      let items = [];
      try { items = fs.readdirSync(dir); } catch (_) { return; }
      for (const item of items) {
        if (['node_modules', '.git', '.cache'].includes(item)) continue;
        const fullPath = path.join(dir, item);
        if (item.toLowerCase().includes(term.toLowerCase())) {
          matches.push(fullPath.replace(rootDir + '/', ''));
        }
        try {
          if (fs.statSync(fullPath).isDirectory()) searchDir(fullPath, depth + 1);
        } catch (_) {}
      }
    };

    searchDir(rootDir);
    if (matches.length === 0) {
      return `🔍 \`${term}\` ke sath koi file ya folder nahi mila.`;
    }
    return `🔍 **Search Results for "${term}" in \`${rootDir}\`:**\n` + matches.map(m => `- \`${m}\``).join('\n');
  }

  static makeDirectory(query) {
    let target = query.replace(/^(mkdir|folder banao)\s+/i, '').trim();
    if (!target) return '⚠️ Barah-e-karam folder ka naam batayein (e.g. `mkdir my_folder`).';
    const fullPath = this.resolvePath(target);
    try {
      if (fs.existsSync(fullPath)) return `⚠️ Yeh folder pehle se mojood hai:\n\`${fullPath}\``;
      fs.mkdirSync(fullPath, { recursive: true });
      return `✅ **Folder Created:** \`${fullPath}\``;
    } catch (e) {
      return `❌ **mkdir Error:** ${e.message}`;
    }
  }

  static createFile(query) {
    let target = query.replace(/^(touch|file banao)\s+/i, '').trim();
    if (!target) return '⚠️ Barah-e-karam file ka naam batayein (e.g. `touch notes.txt`).';
    const fullPath = this.resolvePath(target);
    try {
      if (fs.existsSync(fullPath)) return `⚠️ Yeh file pehle se mojood hai:\n\`${fullPath}\``;
      fs.writeFileSync(fullPath, '', 'utf8');
      return `✅ **File Created:** \`${fullPath}\``;
    } catch (e) {
      return `❌ **touch Error:** ${e.message}`;
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
      `- 📂 **CWD:** \`${this.getCwd()}\``
    );
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
    const allProviders = ConfigManager.getAllProviders();
    const provider = options.provider || cfg.activeProvider || 'groq';
    const model = options.model || cfg.activeModel || 'qwen/qwen3.8-27b';
    const temp = options.temperature ?? cfg.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? cfg.maxTokens ?? 700;

    const providerConfig = allProviders[provider] || DEFAULT_PROVIDERS[provider] || DEFAULT_PROVIDERS.groq;

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
        if (provider === 'gemini' || providerConfig.type === 'gemini') {
          const result = await this.callGemini(model, apiKey, prompt, temp, maxTokens);
          const elapsedMs = Date.now() - startTime;
          const tokenStats = TokenTracker.recordUsage(result.promptTokens, result.completionTokens, elapsedMs);
          return { text: result.text, stats: tokenStats, provider, model };
        } else {
          // Groq, OpenAI, or custom OpenAI-compatible endpoint
          const endpoint = providerConfig.endpoint || DEFAULT_PROVIDERS.groq.endpoint;
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

  static getEffectiveSystemPrompt() {
    const mem = MemoryManager.load();
    let prompt = JENA_SYSTEM_PROMPT;
    prompt += `\n\n### CURRENT ENVIRONMENT & MEMORY\n- Current Working Directory (CWD): ${LocalEngine.getCwd()}`;
    if (mem.learned_facts && mem.learned_facts.length > 0) {
      prompt += `\n- Learned Facts & User Preferences:\n` + mem.learned_facts.map(f => `  * ${f.fact}`).join('\n');
    }
    if (mem.learned_operations && mem.learned_operations.length > 0) {
      prompt += `\n- Learned Local Operations:\n` + mem.learned_operations.map(o => `  * "${o.trigger}" -> \`${o.command}\` (${o.description || 'Custom Op'})`).join('\n');
    }
    return prompt;
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
          { role: 'system', content: this.getEffectiveSystemPrompt() },
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
        systemInstruction: { parts: [{ text: this.getEffectiveSystemPrompt() }] },
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

    // Offline / Local Engine Test
    if (provider === 'offline' || model === 'jena-local-core') {
      try {
        const uptime = os.uptime();
        const elapsedMs = Date.now() - startTime;
        return {
          success: true,
          provider: 'offline',
          model: 'jena-local-core',
          latencyMs: Math.max(1, elapsedMs),
          tokensPerSecond: 9999,
          message: '⚡ Jena Offline / Local Engine is Active & Ready!',
          reply: 'Local Engine healthy (0 tokens, instant response).'
        };
      } catch (e) {
        return {
          success: false,
          provider: 'offline',
          model: 'jena-local-core',
          latencyMs: Date.now() - startTime,
          error: e.message
        };
      }
    }

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

    // Request logging for visibility
    if (pathname.startsWith('/api/')) {
      console.log(`[${new Date().toLocaleTimeString()}] ${method} ${pathname}`);
    }

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
      const allProviders = ConfigManager.getAllProviders();
      // Mask keys for security
      const maskedKeys = {};
      Object.keys(cfg.keys || {}).forEach(p => {
        maskedKeys[p] = (cfg.keys[p] || []).map(k => k.length <= 8 ? '****' : k.slice(0, 4) + '...' + k.slice(-4));
      });

      return sendJson(200, {
        mode: cfg.mode || 'online',
        activeProvider: cfg.activeProvider || 'groq',
        activeModel: cfg.activeModel || 'qwen/qwen3.8-27b',
        tokens: cfg.tokens || { allowance: 500000, used: 0, balance: 500000, lastPromptSpeed: 0 },
        providers: allProviders,
        customProviders: cfg.customProviders || {},
        customModels: cfg.customModels || {},
        maskedKeys,
        keysCount: Object.fromEntries(Object.entries(cfg.keys || {}).map(([p, arr]) => [p, arr.length]))
      });
    }

    // POST /api/config
    if (pathname === '/api/config' && method === 'POST') {
      try {
        const body = await parseBody();
        const cfg = ConfigManager.load();
        if (body.mode) cfg.mode = body.mode;
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

    // POST /api/custom-model
    if (pathname === '/api/custom-model' && method === 'POST') {
      try {
        const body = await parseBody();
        const { provider, modelId, modelName } = body;
        if (!provider || !modelId) return sendJson(400, { error: 'Provider aur modelId zaroori hain.' });
        const resData = ConfigManager.addCustomModel(provider, modelId, modelName);
        return sendJson(200, { success: true, message: `Model '${modelId}' add ho gaya.`, data: resData });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // DELETE /api/custom-model
    if (pathname === '/api/custom-model' && method === 'DELETE') {
      try {
        const body = await parseBody();
        const { provider, modelId } = body;
        if (!provider || !modelId) return sendJson(400, { error: 'Provider aur modelId zaroori hain.' });
        ConfigManager.deleteCustomModel(provider, modelId);
        return sendJson(200, { success: true, message: `Model '${modelId}' delete ho gaya.` });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/custom-provider
    if (pathname === '/api/custom-provider' && method === 'POST') {
      try {
        const body = await parseBody();
        const { id, name, endpoint, type, defaultModelId, defaultModelName, apiKey } = body;
        if (!id || !endpoint) return sendJson(400, { error: 'Provider ID aur Endpoint URL zaroori hain.' });
        const resData = ConfigManager.addCustomProvider({ id, name, endpoint, type, defaultModelId, defaultModelName });
        if (apiKey && apiKey.trim()) {
          ConfigManager.addKey(resData.id, apiKey.trim());
        }
        return sendJson(200, { success: true, message: `Provider '${resData.provider.name}' add ho gaya.`, data: resData });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // DELETE /api/custom-provider
    if (pathname === '/api/custom-provider' && method === 'DELETE') {
      try {
        const body = await parseBody();
        const { provider } = body;
        if (!provider) return sendJson(400, { error: 'Provider ID zaroori hai.' });
        ConfigManager.deleteCustomProvider(provider);
        return sendJson(200, { success: true, message: `Provider '${provider}' delete ho gaya.` });
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

    // GET /api/memory
    if (pathname === '/api/memory' && method === 'GET') {
      const mem = MemoryManager.load();
      return sendJson(200, {
        cwd: LocalEngine.getCwd(),
        facts: mem.learned_facts || [],
        operations: mem.learned_operations || []
      });
    }

    // POST /api/memory/operation
    if (pathname === '/api/memory/operation' && method === 'POST') {
      try {
        const body = await parseBody();
        const { name, trigger, command, description } = body;
        if (!trigger || !command) return sendJson(400, { error: 'Trigger aur command zaroori hain.' });
        const op = MemoryManager.addOperation(name, trigger, command, description);
        return sendJson(200, { success: true, message: `Operation '${op.name}' seekh liya gaya hai.`, operation: op });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // DELETE /api/memory/operation
    if (pathname === '/api/memory/operation' && method === 'DELETE') {
      try {
        const body = await parseBody();
        const { id } = body;
        if (!id) return sendJson(400, { error: 'Operation ID zaroori hai.' });
        MemoryManager.deleteOperation(id);
        return sendJson(200, { success: true, message: 'Operation delete ho gaya.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/memory/fact
    if (pathname === '/api/memory/fact' && method === 'POST') {
      try {
        const body = await parseBody();
        const { fact, topic } = body;
        if (!fact) return sendJson(400, { error: 'Fact zaroori hai.' });
        const item = MemoryManager.addFact(fact, topic);
        return sendJson(200, { success: true, message: 'Maloomat yaad rakh li gayi hai.', fact: item });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // DELETE /api/memory/fact
    if (pathname === '/api/memory/fact' && method === 'DELETE') {
      try {
        const body = await parseBody();
        const { id } = body;
        if (!id) return sendJson(400, { error: 'Fact ID zaroori hai.' });
        MemoryManager.deleteFact(id);
        return sendJson(200, { success: true, message: 'Fact delete ho gaya.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/memory/run-op
    if (pathname === '/api/memory/run-op' && method === 'POST') {
      try {
        const body = await parseBody();
        const { id } = body;
        const mem = MemoryManager.load();
        const op = mem.learned_operations.find(o => o.id === id || o.name === id || o.trigger === id);
        if (!op) return sendJson(404, { error: 'Operation nahi mila.' });
        const output = await LocalEngine.executeLearnedOperation(op);
        return sendJson(200, { success: true, output, operation: op });
      } catch (err) {
        return sendJson(500, { error: err.message });
      }
    }

    // POST /api/fs/cd
    if (pathname === '/api/fs/cd' && method === 'POST') {
      try {
        const body = await parseBody();
        const target = body.path || '';
        const msg = LocalEngine.changeDirectory(target ? `cd ${target}` : 'cd');
        return sendJson(200, { cwd: LocalEngine.getCwd(), message: msg });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // GET /api/fs/ls
    if (pathname === '/api/fs/ls' && method === 'GET') {
      try {
        const targetPath = parsedUrl.searchParams.get('path') || '';
        const msg = LocalEngine.listFiles(targetPath ? `ls ${targetPath}` : 'ls');
        return sendJson(200, { cwd: LocalEngine.getCwd(), message: msg });
      } catch (err) {
        return sendJson(400, { error: err.message });
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

      // 1. Check Offline / Local Engine (Explicit offline mode/provider OR Local query intent)
      const isExplicitOffline = body.provider === 'offline' || body.mode === 'offline';
      const localIntent = LocalEngine.isLocalIntent(userMessage);

      if (isExplicitOffline || localIntent) {
        sendEvent({ type: 'mode', mode: 'offline' });
        sendEvent({ type: 'thought', content: '⚡ Local Engine active (Zero Token Usage • Offline).' });
        let localResponse;
        if (localIntent) {
          localResponse = await LocalEngine.execute(localIntent, userMessage);
        } else {
          localResponse = `⚡ **Jena Local Engine (Offline Mode)**\n\n` +
            `Main offline mode mein hoon aur Termux environment par 0 tokens ke sath active hoon. Aap mujh se yeh offline tasks karwa sakte hain:\n` +
            `- 🔋 **Battery Report:** \`battery status check karo\`\n` +
            `- 🧠 **RAM Jaiza:** \`kitni ram free hai\`\n` +
            `- 💾 **Disk Storage:** \`storage check karo\`\n` +
            `- 🕒 **Waqt Aur Tarikh:** \`aaj kya date hai\`\n` +
            `- 🧮 **Riyazi / Math Hisab:** \`hisab karo 250 * 12\`\n` +
            `- 📂 **Files Check:** \`files dikhao\` ya \`ls\`\n\n` +
            `*Online Cloud AI (coding, deep reasoning, LLM models) use karne ke liye upar switch se **🌐 Online Mode** select karein.*`;
        }
        sendEvent({
          type: 'done',
          text: localResponse,
          stats: { totalTokens: 0, speed: 9999, mode: 'offline', balance: ConfigManager.load().tokens.balance }
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

    // --- STATIC FILES & PAGE ROUTES SERVING ---
    if (pathname === '/' || pathname === '/settings' || pathname === '/models' || pathname === '/providers') {
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(indexFile).pipe(res);
      }
    }

    let filePath = path.join(PUBLIC_DIR, pathname);
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
