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
const CONVERSATION_LOG_FILE = path.join(JENA_DIR, 'conversation.jsonl');
const FAILURE_LOG_FILE = path.join(JENA_DIR, 'failures.log');
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

    // 4. GUI Explanation & Self-Inspection
    if (
      /(?:apne|apni|meri|current)?\s*(?:index\.html|style\.css|app\.js|server\.js|package\.json|gui|frontend|backend)\s*(?:ko)?\s*(?:explain|samjhao|batao|bataiye|kya hai)/i.test(q) ||
      /(?:explain|samjhao)\s+(?:apne|apni)?\s*(?:index\.html|style\.css|app\.js|server\.js|package\.json|gui|frontend|backend)/i.test(q) ||
      /(?:apne|apni)\s+(?:files|code|gui|architecture)\s*(?:ko)?\s*(?:explain|samjhao)/i.test(q)
    ) {
      return 'explain_gui';
    }

    // 5. GUI Self-Editing
    if (
      /(?:css|style\.css|styles?|gui|index\.html|app\.js)\s+(?:main|mein)\s+/i.test(q) ||
      /^(?:edit|change|update|modify)\s+(?:gui|style\.css|index\.html|app\.js|css)\b/i.test(q) ||
      /(?:apni\s+gui|apne\s+css|apni\s+css|apna\s+index\.html)\s+(?:ko\s+)?(?:edit|badlo|update|change)/i.test(q) ||
      /(?:css|style\.css|gui)\s+ko\s+(?:edit|update|badlo)/i.test(q) ||
      /(?:background(?:-color)?|bg)\s*(?:ko)?\s*(?:#|rgba?|[a-z]+).*kardo/i.test(q)
    ) {
      return 'edit_gui';
    }

    // 6. Webpage & Project Scaffolding (HTML / CSS / JS / Node.js)
    if (
      /^(?:webpage|web\s+page|website|landing\s+page|portfolio|dashboard|html\s+page|html\s+file|nodejs\s+server|nodejs\s+project|node\s+server)\s+(?:banao|create|likho|generate)/i.test(q) ||
      /^(?:banao|create|generate|make)\s+(?:aik\s+|ek\s+)?(?:webpage|web\s+page|website|landing\s+page|portfolio|dashboard|html\s+page|html\s+file|nodejs\s+server|nodejs\s+project|node\s+server)/i.test(q)
    ) {
      return 'scaffold_web';
    }

    // 7. General Local File Write / Edit / Append
    if (
      /^(?:write\s+file|file\s+likho|file\s+create\s+karo|write\s+to\s+file)\s+/i.test(q) ||
      /^(?:edit\s+file|file\s+edit\s+karo|replace\s+in\s+file)\s+/i.test(q) ||
      /^(?:append\s+file|file\s+append\s+karo|append\s+to\s+file)\s+/i.test(q)
    ) {
      return 'file_write_edit';
    }

    // 8. Offline Web Development Knowledge Base
    if (
      /^(?:html|css|js|javascript|nodejs|node\.js)\s+(?:explain\s+karo|kya\s+hai|seekho|sikhayo|samjhao|parhao)/i.test(q) ||
      /^(?:explain|samjhao|sikhayo)\s+(?:html|css|js|javascript|nodejs|node\.js)/i.test(q)
    ) {
      return 'web_knowledge';
    }

    // 9. Filesystem Navigation
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

    // 10. Hardware & System Specs
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
      case 'explain_gui':
        return this.explainGui(query);
      case 'edit_gui':
        return this.editGui(query);
      case 'scaffold_web':
        return this.scaffoldWebPage(query);
      case 'file_write_edit':
        return this.handleFileWriteOrEdit(query);
      case 'web_knowledge':
        return this.explainWebConcept(query);
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

        if (err) {
          LogManager.logFailure({
            command: op.command,
            type: 'LEARNED_OP_EXECUTION_FAILURE',
            error: `${err.message}${errOut ? ` | stderr: ${errOut}` : ''}`,
            cwd,
            context: { opId: op.id, opName: op.name, trigger: op.trigger }
          });
        }

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

  // --- OFFLINE WEB DEVELOPMENT & GUI EXPLANATION / EDITING ENGINE ---
  static explainGui(query) {
    const q = (query || '').toLowerCase();

    // Target 1: index.html
    if (q.includes('index.html') || (q.includes('html') && !q.includes('server') && !q.includes('app.js'))) {
      const filePath = path.join(PUBLIC_DIR, 'index.html');
      let stats = '';
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        stats = `(Path: \`public/index.html\` • Lines: ${lines} • Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`;
      }

      return (
        `📄 **Jena GUI Architecture: \`public/index.html\` Breakdown** ${stats}\n\n` +
        `Main ne apne HTML structure ko aik **2-Page Minimalist SPA (Single Page Application)** ke tor par design kiya hai:\n\n` +
        `### 1. 🏗️ Header & Global Controls\n` +
        `- **Brand Avatar & Title:** Robot icon (\`🤖\`) with neon glow aur version tag (\`v0.3\`).\n` +
        `- **Navigation Tabs:** \`#tabNavMain\` (💬 Chat) aur \`#tabNavSettings\` (⚙️ Providers & Models) ke darmiyan instant SPA tab switching.\n` +
        `- **Hybrid Mode Switch:** \`[🌐 Online]\` aur \`[⚡ Offline]\` buttons jo backend ke local engine aur cloud LLMs ko toggle karte hain.\n\n` +
        `### 2. 💬 Page 1: Main Chat & Interaction Viewport\n` +
        `- **Token Dashboard (4 Cards):**\n` +
        `  * \`ALLOWANCE\`: Total token budget (click karke modal se adjust kiya ja sakta hai).\n` +
        `  * \`USED TOKENS\`: Cumulative prompt/completion tokens consumed.\n` +
        `  * \`BALANCE\`: Remaining allowance balance.\n` +
        `  * \`PROMPT SPEED\`: Real-time tokens per second (\`t/s\`) speed meter.\n` +
        `- **Active Engine Bar:** Active provider/model pill with link to settings.\n` +
        `- **📍 CWD Status Bar:** Current working directory indicator with quick buttons (\`📂 ls\`, \`🌲 tree\`, \`🧠 memory\`).\n` +
        `- **Chat Viewport (\`#chatViewport\`):** Welcome hero chips, markdown formatted message stream, SSE live thoughts.\n` +
        `- **Input Footer:** Textarea with auto-resize, shortcut hints, aur send button.\n\n` +
        `### 3. ⚙️ Page 2: Providers, Models, Memory & Logs\n` +
        `- **Card 1:** Active AI Provider & Model dropdowns + \`⚡ Test Model\` latency benchmark button.\n` +
        `- **Card 2:** Multi-API Keys Manager (provider select, password input, masked keys list with delete).\n` +
        `- **Card 3:** Add Custom Model (provider select, exact model ID, display label).\n` +
        `- **Card 4:** Add Custom Online Provider (slug, endpoint URL, default model, initial API key).\n` +
        `- **Card 5 (Self-Learned Operations & Memory Engine):** CWD folder changer (\`cd\`), add new offline operation form, learned facts form, registered ops with \`▶️ Run\` and \`🗑️ Delete\`, live terminal output preview.\n` +
        `- **Card 6 (Conversation Tracking & Failure Logs):** Sub-tabs for \`conversation.jsonl\` and \`failures.log\`, live log viewer, refresh aur clear buttons.\n\n` +
        `### 4. 🪟 Modals\n` +
        `- \`#allowanceModal\`: Token budget modify karne ka dialog box.`
      );
    }

    // Target 2: style.css
    if (q.includes('style.css') || q.includes('css')) {
      const filePath = path.join(PUBLIC_DIR, 'style.css');
      let stats = '';
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        stats = `(Path: \`public/style.css\` • Lines: ${lines} • Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`;
      }

      return (
        `🎨 **Jena GUI Design System: \`public/style.css\` Breakdown** ${stats}\n\n` +
        `Main ne apna visual design **Cybernetic Dark Mode & Glassmorphism** aesthetic par build kiya hai:\n\n` +
        `### 1. 🌈 Design Tokens (\`:root\` Variables)\n` +
        `- **Color Palette:**\n` +
        `  * Primary Background: \`--bg-primary: #0a0d14\` (Deep OLED dark)\n` +
        `  * Glass Surfaces: \`--bg-card: rgba(18, 24, 38, 0.7)\` with \`backdrop-filter: blur(12px)\`\n` +
        `  * Neon Accents: Cyan (\`#00d2ff\`), Purple (\`#9d4edd\`), Green (\`#10b981\`), Amber (\`#f59e0b\`), Red (\`#ef4444\`)\n` +
        `  * Typography: \`Plus Jakarta Sans\` (UI) aur \`JetBrains Mono\` (Tokens, CWD, Terminal Code)\n\n` +
        `### 2. 📐 Layout & Components\n` +
        `- **SPA Page View:** \`.page-view\` jo \`display: flex\` aur \`display: none\` se toggle hota hai.\n` +
        `- **Token Dashboard Grid:** \`.token-dashboard\` 4 equal-width grid cards with dynamic highlight borders.\n` +
        `- **Message Stream:** Flexbox rows for user (\`.message-row.user\`) aur assistant (\`.message-row.assistant\`) with bubble styling.\n` +
        `- **Settings Cards Grid:** Card panels with frosted glass header, badges, and responsive form rows.\n` +
        `- **Terminal Box:** \`.terminal-preview-box\` with dark terminal header and scrollable preformatted output.\n` +
        `- **Log Viewer:** \`.log-tabs-bar\` and \`.logs-scroll-container\` for conversation and failure logs.\n` +
        `- **Mobile Responsive:** \`@media (max-width: 768px)\` mein dashboard 2 columns aur input forms vertical stack ho jate hain.`
      );
    }

    // Target 3: app.js
    if (q.includes('app.js') || q.includes('javascript') || q.includes('frontend js')) {
      const filePath = path.join(PUBLIC_DIR, 'app.js');
      let stats = '';
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        stats = `(Path: \`public/app.js\` • Lines: ${lines} • Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`;
      }

      return (
        `⚡ **Jena Frontend Client Engine: \`public/app.js\` Breakdown** ${stats}\n\n` +
        `Mera frontend client pure Vanilla JavaScript par likha gaya hai (Zero External Frameworks/Libraries):\n\n` +
        `### 1. 🔀 Navigation & SPA Router (\`showPage\`)\n` +
        `- Hash-based routing (\`#chat\` vs \`#settings\`) aur tab buttons se bina page reload kiye pages switch hote hain.\n\n` +
        `### 2. 📡 Server-Sent Events (SSE) Stream Reader (\`handleSendMessage\`)\n` +
        `- \`fetch('/api/chat')\` se SSE stream open karti hai.\n` +
        `- Event types handle karti hai: \`mode\`, \`thought\`, \`done\`, \`error\`.\n` +
        `- Real-time token count, balance, aur generation speed update karti hai.\n\n` +
        `### 3. ⚙️ Multi-Key, Providers & Models State\n` +
        `- \`fetchConfig()\`: Backend se settings, active models, aur masked keys fetch karke dropdowns populate karti hai.\n` +
        `- Naye providers aur custom models dynamically save/delete karti hai.\n\n` +
        `### 4. 🧠 Memory, CWD & Terminal Box Manager\n` +
        `- \`fetchMemory()\`: Jena ki current working directory aur learned operations fetch karti hai.\n` +
        `- \`handleRunOp()\`: Offline operation ko direct run karke terminal preview box mein output display karti hai.\n\n` +
        `### 5. 📜 Log Viewer Controller\n` +
        `- \`fetchLogs()\`: Conversation history aur command failure logs render karti hai.`
      );
    }

    // Target 4: server.js
    if (q.includes('server.js') || q.includes('backend') || q.includes('nodejs')) {
      return (
        `🐍 **Jena Backend Engine: \`server.js\` Architecture**\n\n` +
        `Jena ka backend aik zero-dependency native Node.js application hai jo Termux aur Linux ke liye optimize ki gayi hai:\n\n` +
        `- **\`LocalEngine\` (Offline):** Battery, RAM, Disk, Time, Filesystem Navigation (\`cd\`, \`ls\`, \`cat\`, \`tree\`, \`find\`, \`mkdir\`, \`touch\`), Safe Math, Web Scaffolder aur Self-Editing handle karta hai (0 Tokens).\n` +
        `- **\`CloudEngine\` (Online):** Groq (LPU), Gemini, aur OpenAI compatible models ke sath unified streaming aur key rotation provide karta hai.\n` +
        `- **\`MemoryManager\`:** Learned custom operations aur user preferences ko \`~/.jena/memory.json\` mein persist karta hai.\n` +
        `- **\`LogManager\`:** Conversations ko \`~/.jena/conversation.jsonl\` aur failures ko \`~/.jena/failures.log\` mein automatically log karta hai.\n` +
        `- **\`ConfigManager\` & \`TokenTracker\`:** Multi-key automatic rotation aur live token allowance/speed calculate karte hain.\n` +
        `- **HTTP & SSE Server:** Port 8080 par static assets aur REST APIs serve karta hai.`
      );
    }

    // Default overview
    return (
      `🤖 **Jena Full GUI & System Files Overview:**\n\n` +
      `Mera complete codebase sirf **5 files** par mushtamil hai:\n` +
      `1. 📄 **\`public/index.html\`**: 2-Page responsive GUI (Chat, Token Dashboard, Settings, Memory Engine, Log Tracker).\n` +
      `2. 🎨 **\`public/style.css\`**: Cybernetic dark aesthetic, CSS variables, glassmorphism, responsive grid.\n` +
      `3. ⚡ **\`public/app.js\`**: Reactive Vanilla JS client, SSE streaming reader, key/memory management.\n` +
      `4. 🐍 **\`server.js\`**: Hybrid local/cloud backend, filesystem control, memory & log persistence.\n` +
      `5. 📦 **\`package.json\`**: Project metadata & scripts.\n\n` +
      `*Kisi makhsoos file ki tafseel ke liye bolein: \`apne index.html ko explain karo\` ya \`explain style.css\`.*`
    );
  }

  static editGui(query) {
    const q = query.trim();

    // Check if targeting CSS
    if (/css|style/i.test(q)) {
      const cssPath = path.join(PUBLIC_DIR, 'style.css');
      if (!fs.existsSync(cssPath)) return `❌ Error: \`${cssPath}\` mojood nahi hai.`;

      let content = fs.readFileSync(cssPath, 'utf8');

      // 1. Direct Rule Replacement pattern: replace "old" with "new" OR "target" -> "replacement"
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i) ||
                           q.match(/badlo\s+["']([^"']+)["']\s+ko\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!content.includes(oldStr)) {
          return `⚠️ Target content CSS mein nahi mila:\n\`${oldStr}\``;
        }
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(cssPath, content, 'utf8');
        return `✅ **CSS Updated Successfully!**\nReplaced in \`public/style.css\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n*(Browser refresh karein changes dekhne ke liye.)*`;
      }

      // 2. Color / Variable update pattern: e.g. "background color #050811 kardo" or "--bg-primary to #050811"
      const colorValMatch = q.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
      if (colorValMatch) {
        const val = colorValMatch[1].trim();
        let targetVar = '--bg-primary';
        if (q.includes('accent') || q.includes('cyan')) targetVar = '--accent-cyan';
        else if (q.includes('purple')) targetVar = '--accent-purple';
        else if (q.includes('green')) targetVar = '--accent-green';
        else if (q.includes('surface')) targetVar = '--bg-surface';
        else if (q.includes('card')) targetVar = '--bg-card';
        else if (q.includes('text') || q.includes('font')) targetVar = '--text-primary';

        const regex = new RegExp(`(${targetVar}:\\s*)([^;]+)(;)`, 'i');
        if (regex.test(content)) {
          const oldLine = content.match(regex)[0];
          const newLine = `${targetVar}: ${val};`;
          content = content.replace(regex, `$1${val}$3`);
          fs.writeFileSync(cssPath, content, 'utf8');
          return `✅ **Jena GUI CSS Variable Updated!**\n- 🎯 **Updated:** \`${newLine}\`\n- 🔄 **Previous:** \`${oldLine}\`\n\n*(Browser refresh karein changes dekhne ke liye.)*`;
        }
      }

      // 3. Append custom CSS rule: e.g. "css main yeh add karo: .my-class { ... }"
      const addMatch = q.match(/(?:add|shamil|likho|dalo)[:\s]+(.+)$/is);
      if (addMatch) {
        const newCss = addMatch[1].trim().replace(/^```css\s*|^```\s*|```$/g, '');
        content = content.trimEnd() + `\n\n/* Custom User Added Style */\n${newCss}\n`;
        fs.writeFileSync(cssPath, content, 'utf8');
        return `✅ **Custom CSS Rule Added to \`public/style.css\`!**\n\`\`\`css\n${newCss}\n\`\`\`\n\n*(Browser refresh karein changes dekhne ke liye.)*`;
      }

      return (
        `💡 **CSS Edit Syntax Examples:**\n` +
        `- Replace: \`css main changes karo: replace "--bg-primary: #0a0d14;" with "--bg-primary: #050811;"\`\n` +
        `- Variable: \`css main background color #050811 kardo\`\n` +
        `- Add Rule: \`css main add karo: .my-badge { color: cyan; font-weight: bold; }\``
      );
    }

    // Check if targeting HTML
    if (/html|index/i.test(q)) {
      const htmlPath = path.join(PUBLIC_DIR, 'index.html');
      let content = fs.readFileSync(htmlPath, 'utf8');
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!content.includes(oldStr)) {
          return `⚠️ Target content HTML mein nahi mila:\n\`${oldStr}\``;
        }
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(htmlPath, content, 'utf8');
        return `✅ **HTML Updated Successfully!**\nReplaced in \`public/index.html\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\``;
      }
      return `💡 HTML edit karne ke liye: \`index.html main change karo: replace "old text" with "new text"\``;
    }

    return `⚠️ Barah-e-karam target batayein: CSS ya HTML (e.g. \`css main background color #030712 kardo\`).`;
  }

  static scaffoldWebPage(query) {
    const q = (query || '').toLowerCase();
    const cwd = this.getCwd();

    // Determine type: portfolio | landing | dashboard | nodejs | blank
    let type = 'landing';
    if (q.includes('portfolio') || q.includes('cv') || q.includes('resume')) type = 'portfolio';
    else if (q.includes('dashboard') || q.includes('admin')) type = 'dashboard';
    else if (q.includes('nodejs') || q.includes('node.js') || q.includes('node server') || q.includes('backend server')) type = 'nodejs';
    else if (q.includes('blank') || q.includes('basic') || q.includes('simple')) type = 'blank';

    // Extract project folder name if specified
    const nameMatch = query.match(/(?:banao|create|likho|generate)\s+(?:aik\s+|ek\s+)?(?:webpage|web\s+page|website|landing\s+page|portfolio|dashboard|html\s+page|html\s+file|nodejs\s+server|nodejs\s+project|node\s+server)?\s*["']?([a-z0-9_-]+)?["']?/i);
    let projectName = (nameMatch && nameMatch[1] && !['aik', 'ek', 'webpage', 'portfolio', 'landing', 'dashboard', 'project', 'server'].includes(nameMatch[1].toLowerCase()))
      ? nameMatch[1].trim().toLowerCase()
      : `${type}_project`;

    const projectDir = path.join(cwd, projectName);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    let filesCreated = [];

    if (type === 'portfolio') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Developer Portfolio</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
  <nav class="navbar">
    <div class="logo">&lt;Dev/&gt;</div>
    <ul class="nav-links">
      <li><a href="#about">About</a></li>
      <li><a href="#skills">Skills</a></li>
      <li><a href="#projects">Projects</a></li>
      <li><a href="#contact" class="btn-cta">Contact</a></li>
    </ul>
  </nav>

  <header class="hero">
    <div class="badge">🚀 Available for Projects</div>
    <h1>Hi, I'm <span class="gradient-text">Full-Stack Developer</span></h1>
    <p>Crafting high-performance web applications, autonomous tools, and modern software.</p>
    <div class="hero-actions">
      <a href="#projects" class="btn btn-primary">View Projects</a>
      <a href="#contact" class="btn btn-secondary">Get In Touch</a>
    </div>
  </header>

  <section id="skills" class="section">
    <h2>Core Tech Stack</h2>
    <div class="skills-grid">
      <span class="skill-tag">JavaScript / ES6+</span>
      <span class="skill-tag">Node.js</span>
      <span class="skill-tag">HTML5 & Semantic Web</span>
      <span class="skill-tag">CSS3 / Grid / Flexbox</span>
      <span class="skill-tag">REST APIs & SSE</span>
      <span class="skill-tag">Linux / Termux Bash</span>
    </div>
  </section>

  <section id="projects" class="section">
    <h2>Featured Projects</h2>
    <div class="projects-grid">
      <div class="project-card">
        <h3>🤖 Autonomous AI Agent</h3>
        <p>A hybrid local & cloud AI assistant with zero-token local execution, multi-key rotation, and self-learning.</p>
        <div class="tags"><small>Node.js</small> • <small>SSE</small> • <small>Shell</small></div>
      </div>
      <div class="project-card">
        <h3>⚡ Real-time Token Tracker</h3>
        <p>High-precision throughput monitor calculating tokens per second and cumulative allowance balance.</p>
        <div class="tags"><small>HTML5</small> • <small>CSS3</small> • <small>JavaScript</small></div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <p>Built with ❤️ by Jena Offline Web Engine &bull; Zero Tokens Consumed.</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>`;

      const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #080b11;
  color: #f8fafc;
  line-height: 1.6;
}
.navbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.2rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(8,11,17,0.8); backdrop-filter: blur(10px);
  position: sticky; top: 0; z-index: 100;
}
.logo { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 1.3rem; color: #00d2ff; }
.nav-links { display: flex; list-style: none; gap: 1.5rem; align-items: center; }
.nav-links a { color: #94a3b8; text-decoration: none; font-size: 0.95rem; transition: 0.2s; }
.nav-links a:hover { color: #00d2ff; }
.btn-cta { background: #00d2ff; color: #000 !important; font-weight: 700; padding: 0.4rem 1rem; border-radius: 20px; }

.hero { text-align: center; padding: 5rem 1.5rem 4rem; max-width: 800px; margin: 0 auto; }
.badge { display: inline-block; background: rgba(0,210,255,0.1); color: #00d2ff; border: 1px solid rgba(0,210,255,0.3); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; margin-bottom: 1.5rem; }
.hero h1 { font-size: 2.8rem; font-weight: 800; margin-bottom: 1rem; letter-spacing: -0.5px; }
.gradient-text { background: linear-gradient(90deg, #00d2ff, #9d4edd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero p { font-size: 1.15rem; color: #94a3b8; margin-bottom: 2rem; }
.hero-actions { display: flex; justify-content: center; gap: 1rem; }
.btn { padding: 0.7rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: 0.2s; }
.btn-primary { background: #00d2ff; color: #000; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,210,255,0.4); }
.btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.15); }
.btn-secondary:hover { background: rgba(255,255,255,0.1); }

.section { max-width: 900px; margin: 0 auto; padding: 3.5rem 1.5rem; }
.section h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 1.5rem; color: #fff; }
.skills-grid { display: flex; flex-wrap: wrap; gap: 0.8rem; }
.skill-tag { background: rgba(157,78,221,0.15); color: #c084fc; border: 1px solid rgba(157,78,221,0.3); padding: 0.4rem 0.9rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }

.projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; }
.project-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; transition: 0.3s; }
.project-card:hover { border-color: #00d2ff; transform: translateY(-3px); }
.project-card h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.project-card p { font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem; }
.tags small { color: #00d2ff; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; }

.footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem; color: #64748b; margin-top: 4rem; }
@media (max-width: 600px) {
  .hero h1 { font-size: 2rem; }
  .navbar { flex-direction: column; gap: 0.8rem; }
}`;

      const js = `// Interactive Portfolio Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('Portfolio initialized successfully.');
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(c => {
    c.addEventListener('click', () => {
      console.log('Project clicked:', c.querySelector('h3').textContent);
    });
  });
});`;

      fs.writeFileSync(path.join(projectDir, 'index.html'), html, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'style.css'), css, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'app.js'), js, 'utf8');
      filesCreated = ['index.html', 'style.css', 'app.js'];
    } else if (type === 'nodejs') {
      const serverCode = `const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>🚀 Node.js Server is Running!</h1><p>Created by Jena Offline Engine.</p>');
  }
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), time: new Date() }));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});`;

      const pkgJson = JSON.stringify({
        name: projectName,
        version: "1.0.0",
        main: "server.js",
        scripts: { start: "node server.js" }
      }, null, 2);

      fs.writeFileSync(path.join(projectDir, 'server.js'), serverCode, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'package.json'), pkgJson, 'utf8');
      filesCreated = ['server.js', 'package.json'];
    } else {
      // Landing / Standard Webpage
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName.replace(/_/g, ' ').toUpperCase()}</title>
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body>
  <div class="container">
    <nav class="nav">
      <div class="logo">⚡ ${projectName.toUpperCase()}</div>
      <button id="btnTheme" class="btn-theme">🌓 Toggle</button>
    </nav>
    <main class="hero">
      <h1>Modern Webpage Built Offline</h1>
      <p>Jena ne yeh responsive webpage Termux environment mein bina kisi internet ya AI token ke generate kiya hai.</p>
      <button class="btn-main" id="btnClickMe">Explore Features 🚀</button>
    </main>
    <div id="outputBox" class="output-box" style="display: none;"></div>
  </div>
  <script src="app.js"></script>
</body>
</html>`;

      const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b0f19; color: #fff; min-height: 100vh; display: flex; flex-direction: column; }
.container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; width: 100%; }
.nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4rem; }
.logo { font-size: 1.2rem; font-weight: 800; color: #00d2ff; }
.btn-theme { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.hero { text-align: center; padding: 2rem 0; }
.hero h1 { font-size: 2.6rem; font-weight: 800; margin-bottom: 1rem; color: #00d2ff; }
.hero p { font-size: 1.1rem; color: #94a3b8; max-width: 600px; margin: 0 auto 2rem; }
.btn-main { background: #00d2ff; color: #000; font-weight: 700; padding: 0.8rem 1.8rem; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: 0.2s; }
.btn-main:hover { transform: scale(1.04); }
.output-box { background: rgba(0,210,255,0.08); border: 1px solid rgba(0,210,255,0.3); border-radius: 8px; padding: 1.2rem; margin-top: 2rem; text-align: center; }`;

      const js = `document.getElementById('btnClickMe').addEventListener('click', () => {
  const box = document.getElementById('outputBox');
  box.style.display = 'block';
  box.innerHTML = '🎉 <strong>Success:</strong> Webpage interactive hai aur JavaScript kaam kar rahi hai!';
});`;

      fs.writeFileSync(path.join(projectDir, 'index.html'), html, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'style.css'), css, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'app.js'), js, 'utf8');
      filesCreated = ['index.html', 'style.css', 'app.js'];
    }

    return (
      `🌐 **Jena Offline Web Engine: Webpage Scaffolded Successfully!**\n\n` +
      `- 📁 **Project Folder:** \`${projectDir}\`\n` +
      `- 📦 **Type / Template:** \`${type.toUpperCase()}\`\n` +
      `- 📄 **Files Created:**\n` +
      filesCreated.map(f => `  * \`${f}\` (${(fs.statSync(path.join(projectDir, f)).size / 1024).toFixed(1)} KB)`).join('\n') +
      `\n\n` +
      `⚡ **Test / Run Karne Ka Tareeqa:**\n` +
      (type === 'nodejs'
        ? `1. Folder mein jayein: \`cd ${projectName}\`\n2. Server run karein: \`node server.js\`\n3. Browser mein kholein: \`http://localhost:3000\``
        : `1. Folder mein jayein: \`cd ${projectName}\`\n2. Files dekhein: \`ls\` ya \`cat index.html\`\n3. Direct browser mein kholein: \`file://${path.join(projectDir, 'index.html')}\``
      ) +
      `\n\n*(Yeh poora webpage Jena ke offline local engine ne bina kisi AI token ke generate kiya!)*`
    );
  }

  static handleFileWriteOrEdit(query) {
    const q = query.trim();

    // 1. Append to file: "append file <filename> <content>" OR "file append karo <filename> <content>"
    const appendMatch = q.match(/^(?:append(?:\s+to)?\s+file|file\s+append\s+karo)\s+([^\s]+)\s+([\s\S]+)$/i);
    if (appendMatch) {
      const targetPath = this.resolvePath(appendMatch[1]);
      const content = appendMatch[2].replace(/^```[a-z]*\s*|^```\s*|```$/g, '');
      try {
        fs.appendFileSync(targetPath, '\n' + content, 'utf8');
        return `✅ **Content Appended Successfully:** \`${targetPath}\``;
      } catch (e) {
        return `❌ **Append Error:** ${e.message}`;
      }
    }

    // 2. Edit file (search & replace): "edit file <filename> replace "<old>" with "<new>""
    const editMatch = q.match(/^(?:edit\s+file|file\s+edit\s+karo|replace\s+in\s+file)\s+([^\s]+)\s+(?:replace|badlo)\s+["']([^"']+)["']\s+(?:with|ko)\s+["']([^"']+)["']/i);
    if (editMatch) {
      const targetPath = this.resolvePath(editMatch[1]);
      const oldStr = editMatch[2];
      const newStr = editMatch[3];
      if (!fs.existsSync(targetPath)) return `❌ **Error:** File mojood nahi hai: \`${targetPath}\``;
      try {
        let content = fs.readFileSync(targetPath, 'utf8');
        if (!content.includes(oldStr)) {
          return `⚠️ **Error:** Target string file mein nahi mila:\n\`${oldStr}\``;
        }
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(targetPath, content, 'utf8');
        return `✅ **File Edited Successfully:** \`${targetPath}\`\nReplaced:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\``;
      } catch (e) {
        return `❌ **Edit Error:** ${e.message}`;
      }
    }

    // 3. Write file: "write file <filename> <content>" OR "file likho <filename> <content>"
    const writeMatch = q.match(/^(?:write\s+file|file\s+likho|file\s+create\s+karo)\s+([^\s]+)\s+([\s\S]+)$/i);
    if (writeMatch) {
      const targetPath = this.resolvePath(writeMatch[1]);
      let content = writeMatch[2].trim();
      content = content.replace(/^```[a-z]*\s*|^```\s*|```$/g, '');
      try {
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf8');
        return `✅ **File Written Successfully:** \`${targetPath}\` (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`;
      } catch (e) {
        return `❌ **Write Error:** ${e.message}`;
      }
    }

    return `⚠️ Format samajh nahi aya. Tareeqa:\n- \`write file test.html <h1>Hello</h1>\`\n- \`edit file test.html replace "<h1>Hello</h1>" with "<h1>Assalam-o-Alaikum</h1>"\`\n- \`append file test.html <p>New line</p>\``;
  }

  static explainWebConcept(query) {
    const q = (query || '').toLowerCase();

    // Node.js concepts
    if (q.includes('nodejs') || q.includes('node.js') || q.includes('node')) {
      return (
        `🐍 **Node.js Core Concepts (Offline Reference):**\n\n` +
        `Node.js aik Chrome V8 JavaScript runtime engine hai jo server-side code run karta hai:\n\n` +
        `1. **Native HTTP Server (Zero Dependencies):**\n` +
        `\`\`\`javascript\nconst http = require('http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ status: 'ok', time: new Date() }));\n});\nserver.listen(3000);\n\`\`\`\n\n` +
        `2. **Filesystem Module (\`fs\`):** Synchronous (\`fs.readFileSync\`) vs Asynchronous (\`fs.readFile\`, \`fs.promises\`).\n` +
        `3. **Path Module (\`path\`):** Cross-platform path handling (\`path.join(__dirname, 'public')\`).\n` +
        `4. **Child Process (\`child_process\`):** Shell commands execute karna (\`exec\`, \`spawn\`).\n\n` +
        `*(Naya Node.js project scaffold karne ke liye bolein: \`nodejs server banao\`)*`
      );
    }

    // HTML concepts
    if (q.includes('html')) {
      return (
        `📄 **HTML5 Core Concepts (Offline Reference):**\n\n` +
        `1. **Semantic Elements:** \`<header>\`, \`<nav>\`, \`<main>\`, \`<section>\`, \`<article>\`, \`<footer>\` — accessibility aur SEO ke liye zaroori hain.\n` +
        `2. **Responsive Meta Tag:** \`<meta name="viewport" content="width=device-width, initial-scale=1.0">\` jo mobile layout scale karta hai.\n` +
        `3. **Forms & Inputs:** \`<form>\`, \`<input type="text|password|number">\`, \`<textarea>\`, \`<select>\`.\n` +
        `4. **Media Elements:** \`<img>\`, \`<svg>\`, \`<video>\`, \`<audio>\`.\n\n` +
        `*(Naya webpage scaffold karne ke liye bolein: \`webpage banao portfolio\` ya \`landing page banao\`)*`
      );
    }

    // CSS concepts
    if (q.includes('css')) {
      return (
        `🎨 **CSS3 Core Concepts (Offline Reference):**\n\n` +
        `1. **Flexbox (1D Layout):**\n` +
        `\`\`\`css\n.container { display: flex; justify-content: space-between; align-items: center; gap: 12px; }\n\`\`\`\n\n` +
        `2. **CSS Grid (2D Layout):**\n` +
        `\`\`\`css\n.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }\n\`\`\`\n\n` +
        `3. **CSS Variables & Glassmorphism:**\n` +
        `\`\`\`css\n:root { --accent: #00d2ff; --bg: #0a0d14; }\n.glass-card { background: rgba(18, 24, 38, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }\n\`\`\`\n\n` +
        `4. **Media Queries (Responsive Design):**\n` +
        `\`\`\`css\n@media (max-width: 768px) { .nav { flex-direction: column; } }\n\`\`\`\n\n` +
        `*(Jena ki CSS edit karne ke liye bolein: \`css main background color #050811 kardo\`)*`
      );
    }

    // JS concepts
    if (q.includes('js') || q.includes('javascript')) {
      return (
        `⚡ **Modern JavaScript (ES6+) Core Concepts (Offline Reference):**\n\n` +
        `1. **Async / Await & Fetch API:**\n` +
        `\`\`\`javascript\nasync function getData() {\n  try {\n    const res = await fetch('/api/data');\n    const data = await res.json();\n    console.log(data);\n  } catch (err) { console.error(err); }\n}\n\`\`\`\n\n` +
        `2. **DOM Manipulation & Event Listeners:**\n` +
        `\`\`\`javascript\ndocument.getElementById('myBtn').addEventListener('click', (e) => {\n  document.querySelector('.output').textContent = 'Clicked!';\n});\n\`\`\`\n\n` +
        `3. **Array Methods:** \`.map()\`, \`.filter()\`, \`.reduce()\`, \`.find()\`, \`.forEach()\`.\n` +
        `4. **Server-Sent Events (SSE):** Real-time text streaming without WebSockets.`
      );
    }

    return `💡 Main HTML, CSS, JavaScript, aur Node.js offline sikh sakti hoon. Poochhein: \`html explain karo\`, \`css explain karo\`, \`js explain karo\`, ya \`nodejs explain karo\`.`;
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

// --- CONVERSATION & FAILURE LOG MANAGER ---
class LogManager {
  static ensureDir() {
    if (!fs.existsSync(JENA_DIR)) {
      fs.mkdirSync(JENA_DIR, { recursive: true });
    }
  }

  static logInteraction({ userMessage, assistantReply, mode = 'online', provider = '', model = '', stats = null, success = true, error = null }) {
    this.ensureDir();
    const entry = {
      timestamp: new Date().toISOString(),
      user: userMessage,
      assistant: assistantReply,
      mode,
      provider: provider || (mode === 'offline' ? 'offline' : 'unknown'),
      model: model || (mode === 'offline' ? 'jena-local-core' : 'unknown'),
      stats: stats || {},
      status: success ? 'SUCCESS' : 'FAILED',
      error: error || null,
      cwd: LocalEngine.getCwd()
    };

    try {
      fs.appendFileSync(CONVERSATION_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
    } catch (e) {
      console.error('Failed to write conversation log:', e.message);
    }

    if (!success || error) {
      this.logFailure({
        command: userMessage,
        type: mode === 'offline' ? 'LOCAL_COMMAND_FAILURE' : 'CLOUD_AI_FAILURE',
        error: error || assistantReply,
        cwd: LocalEngine.getCwd(),
        context: { provider, model, mode }
      });
    }

    return entry;
  }

  static logFailure({ command, type = 'COMMAND_FAILURE', error, cwd = '', context = null }) {
    this.ensureDir();
    const ts = new Date().toISOString();
    const cleanError = typeof error === 'object' ? (error?.stack || error?.message || JSON.stringify(error)) : String(error);
    const ctxStr = context ? `\nContext: ${JSON.stringify(context)}` : '';
    const logBlock = `[${ts}] ❌ FAILURE [${type}]\n` +
      `Command / Query: ${command || '(none)'}\n` +
      `CWD: ${cwd || LocalEngine.getCwd()}\n` +
      `Error Details: ${cleanError}${ctxStr}\n` +
      `----------------------------------------------------------------------\n`;

    try {
      fs.appendFileSync(FAILURE_LOG_FILE, logBlock, 'utf8');
    } catch (e) {
      console.error('Failed to write failure log:', e.message);
    }
  }

  static getRecentConversations(limit = 60) {
    if (!fs.existsSync(CONVERSATION_LOG_FILE)) return [];
    try {
      const content = fs.readFileSync(CONVERSATION_LOG_FILE, 'utf8').trim();
      if (!content) return [];
      const lines = content.split('\n');
      const slice = lines.slice(-limit);
      return slice.map(l => {
        try { return JSON.parse(l); } catch (_) { return null; }
      }).filter(Boolean).reverse();
    } catch (e) {
      return [];
    }
  }

  static getFailureLogs(limit = 40) {
    if (!fs.existsSync(FAILURE_LOG_FILE)) return 'Koi failure log mojood nahi hai (All clean).';
    try {
      const content = fs.readFileSync(FAILURE_LOG_FILE, 'utf8').trim();
      if (!content) return 'Koi failure log mojood nahi hai (All clean).';
      const blocks = content.split('----------------------------------------------------------------------\n');
      const recent = blocks.filter(b => b.trim()).slice(-limit).reverse();
      return recent.join('\n----------------------------------------------------------------------\n') + '\n----------------------------------------------------------------------\n';
    } catch (e) {
      return `Failure log read error: ${e.message}`;
    }
  }

  static clear(type = 'all') {
    if (type === 'all' || type === 'conversation') {
      try { if (fs.existsSync(CONVERSATION_LOG_FILE)) fs.writeFileSync(CONVERSATION_LOG_FILE, '', 'utf8'); } catch (_) {}
    }
    if (type === 'all' || type === 'failures') {
      try { if (fs.existsSync(FAILURE_LOG_FILE)) fs.writeFileSync(FAILURE_LOG_FILE, '', 'utf8'); } catch (_) {}
    }
    return true;
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

    // GET /api/logs
    if (pathname === '/api/logs' && method === 'GET') {
      const conversations = LogManager.getRecentConversations(60);
      const failures = LogManager.getFailureLogs(40);
      return sendJson(200, {
        conversations,
        failures,
        conversationLogPath: CONVERSATION_LOG_FILE,
        failureLogPath: FAILURE_LOG_FILE
      });
    }

    // POST /api/logs/clear
    if (pathname === '/api/logs/clear' && method === 'POST') {
      try {
        const body = await parseBody();
        LogManager.clear(body.type || 'all');
        return sendJson(200, { success: true, message: 'Logs clear ho gaye hain.' });
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
        let isErr = false;
        if (localIntent) {
          try {
            localResponse = await LocalEngine.execute(localIntent, userMessage);
            isErr = typeof localResponse === 'string' && (localResponse.startsWith('❌') || localResponse.startsWith('⚠️ Error'));
          } catch (e) {
            localResponse = `❌ Error: ${e.message}`;
            isErr = true;
          }
        } else {
          localResponse = `⚡ **Jena Local Engine (Offline Mode)**\n\n` +
            `Main offline mode mein hoon aur Termux environment par 0 tokens ke sath active hoon. Aap mujh se yeh offline tasks karwa sakte hain:\n` +
            `- 🌐 **Web Page Scaffolder:** \`webpage banao portfolio <name>\`, \`landing page banao\`, \`dashboard webpage banao\`, \`nodejs server banao\`\n` +
            `- 🎨 **Jena GUI Inspection & Edit:** \`apne index.html ko explain karo\`, \`explain style.css\`, \`css main background color #0b0f19 kardo\`\n` +
            `- 📚 **Web Concepts & Cheatsheet:** \`explain html\`, \`explain css\`, \`explain javascript\`, \`explain nodejs\`\n` +
            `- 📂 **Filesystem & File Editor:** \`cd <dir>\`, \`ls\`, \`read file <name>\`, \`write file <path> <text>\`, \`edit file <path> replace "old" with "new"\`\n` +
            `- 🔋 **Device & Health:** \`battery status check karo\`, \`ram check karo\`, \`storage check karo\`\n` +
            `- 🧮 **Riyazi / Math Hisab:** \`hisab karo 250 * 12\`\n` +
            `- 🧠 **Self-Learning / Operations:** \`apne operations dikhao\`, \`run op git_status\`\n\n` +
            `*Online Cloud AI (creative writing, general coding, deep reasoning) use karne ke liye upar switch se **🌐 Online Mode** select karein.*`;
        }

        LogManager.logInteraction({
          userMessage,
          assistantReply: localResponse,
          mode: 'offline',
          provider: 'offline',
          model: 'jena-local-core',
          stats: { totalTokens: 0, speed: 9999 },
          success: !isErr,
          error: isErr ? localResponse : null
        });

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

        LogManager.logInteraction({
          userMessage,
          assistantReply: result.text,
          mode: 'online',
          provider: result.provider,
          model: result.model,
          stats: result.stats,
          success: true
        });

        sendEvent({
          type: 'done',
          text: result.text,
          stats: result.stats,
          provider: result.provider,
          model: result.model
        });
      } catch (err) {
        LogManager.logInteraction({
          userMessage,
          assistantReply: `❌ Error: ${err.message}`,
          mode: 'online',
          provider: body.provider || 'unknown',
          model: body.model || 'unknown',
          success: false,
          error: err.message
        });

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

  if (args.includes('--logs')) {
    const logs = LogManager.getRecentConversations(20);
    console.log(`\n📜 Recent Jena Conversations (${logs.length}):\n`);
    if (logs.length === 0) {
      console.log('Koi conversation record nahi hai.\n');
    } else {
      logs.forEach((item) => {
        const time = new Date(item.timestamp).toLocaleTimeString();
        const tag = item.status === 'SUCCESS' ? '✅' : '❌';
        console.log(`[${time}] ${tag} [${item.mode.toUpperCase()}] User: ${item.user}`);
        console.log(`      Jena: ${item.assistant.slice(0, 100).replace(/\n/g, ' ')}${item.assistant.length > 100 ? '...' : ''}\n`);
      });
    }
    return;
  }

  if (args.includes('--failures')) {
    const failures = LogManager.getFailureLogs(20);
    console.log(`\n❌ Jena Recent Command Failures:\n`);
    console.log(failures + '\n');
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
    try {
      const ans = await LocalEngine.execute(localIntent, query);
      const isErr = typeof ans === 'string' && (ans.startsWith('❌') || ans.startsWith('⚠️ Error'));
      LogManager.logInteraction({
        userMessage: query,
        assistantReply: ans,
        mode: 'offline',
        provider: 'offline',
        model: 'jena-local-core',
        success: !isErr,
        error: isErr ? ans : null
      });
      console.log(ans + '\n');
    } catch (e) {
      LogManager.logInteraction({
        userMessage: query,
        assistantReply: `❌ Error: ${e.message}`,
        mode: 'offline',
        provider: 'offline',
        model: 'jena-local-core',
        success: false,
        error: e.message
      });
      console.log(`❌ Error: ${e.message}\n`);
    }
    return;
  }

  // 2. Cloud AI
  console.log('\n[Jena] Soch rahi hoon...');
  try {
    const res = await CloudEngine.generate(query);
    LogManager.logInteraction({
      userMessage: query,
      assistantReply: res.text,
      mode: 'online',
      provider: res.provider,
      model: res.model,
      stats: res.stats,
      success: true
    });
    console.log(`\n[Jena]:\n${res.text}\n`);
    console.log(`⚡ Tokens: ${res.stats.totalTokens} | Speed: ${res.stats.speed} t/s | Balance: ${res.stats.balance}\n`);
  } catch (err) {
    LogManager.logInteraction({
      userMessage: query,
      assistantReply: `❌ Error: ${err.message}`,
      mode: 'online',
      success: false,
      error: err.message
    });
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

module.exports = { LocalEngine, CloudEngine, ConfigManager, TokenTracker, TestEngine, LogManager };
