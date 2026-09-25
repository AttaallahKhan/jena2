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
const PHONE_DIR = '/storage/emulated/0/termux-to-phone';
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
  3. NEVER print raw internal thinking, planning steps, or reasoning drafts in English (e.g. "The user said yes...", "Plan:", "Draft:"). ALWAYS provide the final, helpful, direct answer directly in Roman Urdu.

### PROJECT CONTEXT & FILES
- Jena's project root directory is /data/data/com.termux/files/home/jena2
- Jena's 5 core files: server.js, public/index.html, public/style.css, public/app.js, package.json
- Token Dashboard: 4 cards (ALLOWANCE, USED TOKENS, BALANCE, PROMPT SPEED) styled in public/style.css (.token-dashboard: display: grid, repeat(4, 1fr), gap: 10px; .token-card: padding: 10px 14px, border-radius: 10px).

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

  static ensurePhoneDir() {
    if (!fs.existsSync(PHONE_DIR)) {
      try {
        fs.mkdirSync(PHONE_DIR, { recursive: true });
      } catch (_) {}
    }
    return PHONE_DIR;
  }

  static resolvePath(inputPath) {
    if (!inputPath || inputPath.trim() === '' || inputPath === '~') {
      return HOME_DIR;
    }
    let trimmed = inputPath.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    const lower = trimmed.toLowerCase();

    // 1. Direct aliases for HOME
    if (['home', 'home folder', 'home dir', 'home directory', '/home'].includes(lower)) {
      return HOME_DIR;
    }

    // 2. Direct aliases for PHONE (termux-to-phone)
    if (
      [
        'phone',
        'phone folder',
        'phone storage',
        'phone dir',
        'termux-to-phone',
        'termex-to-phone',
        'termux to phone',
        'termex to phone',
        'storage/termux-to-phone',
        '~/storage/termux-to-phone'
      ].includes(lower)
    ) {
      this.ensurePhoneDir();
      return PHONE_DIR;
    }

    // 3. Prefix handling for home
    if (trimmed.startsWith('~/home/')) {
      trimmed = '~/' + trimmed.slice(7);
    } else if (/^home\/(.+)$/i.test(trimmed)) {
      return path.normalize(path.join(HOME_DIR, trimmed.replace(/^home\//i, '')));
    }

    // 4. Prefix handling for phone (termux-to-phone)
    if (/^(?:phone|termux-to-phone|termex-to-phone)\/(.+)$/i.test(trimmed)) {
      this.ensurePhoneDir();
      const sub = trimmed.replace(/^(?:phone|termux-to-phone|termex-to-phone)\//i, '');
      return path.normalize(path.join(PHONE_DIR, sub));
    }
    if (/^(?:~\/)?storage\/(?:termux-to-phone|termex-to-phone)\/(.+)$/i.test(trimmed)) {
      this.ensurePhoneDir();
      const sub = trimmed.replace(/^(?:~\/)?storage\/(?:termux-to-phone|termex-to-phone)\//i, '');
      return path.normalize(path.join(PHONE_DIR, sub));
    }

    // 5. Storage shortcuts (e.g. ~/storage/<name> or storage/<name>)
    const storageMatch = trimmed.match(/^(?:~\/)?storage\/(.+)$/i);
    if (storageMatch) {
      const sub = storageMatch[1].trim();
      const subLower = sub.toLowerCase();
      if (subLower === 'termux-to-phone' || subLower === 'termex-to-phone') {
        this.ensurePhoneDir();
        return PHONE_DIR;
      }
      const phonePath = path.join('/storage/emulated/0', sub);
      if (fs.existsSync(phonePath) || !['dcim', 'downloads', 'movies', 'music', 'pictures', 'shared'].includes(subLower)) {
        return path.normalize(phonePath);
      }
    }

    if (trimmed.startsWith('~/')) {
      return path.normalize(path.join(HOME_DIR, trimmed.slice(2)));
    }
    if (path.isAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }
    return path.normalize(path.join(this.getCwd(), trimmed));
  }

  static isLocalIntent(query) {
    if (!query || typeof query !== 'string') return false;
    let q = query.trim().toLowerCase();
    // Strip leading 'jena', 'hey jena', 'suno jena', 'o jena', etc.
    q = q.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();

    // 0. Mode status query & switching
    if (/\b(online\s+ho\s+ya\s+offline|offline\s+ho\s+ya\s+online|current\s+mode|mode\s+kya\s+hai|status\s+kya\s+hai)\b/i.test(q)) {
      return 'check_mode';
    }

    // 1. Self-Learning trigger (user is teaching Jena)
    if (/^(seekho|yaad rakho|note karo|learn|memorize)[:\s]/i.test(q)) {
      return 'teach';
    }

    // 2. Memory query (user asks what Jena knows/learned)
    if (/^(kya seekha hai|kya yaad hai|yaad kya hai|memory check|show memory|learned operations|learned commands)\b/i.test(q) || q === 'memory') {
      return 'show_memory';
    }

    // 2b. Memory Facts / User Profile Query (e.g. "main kon hun", "mera naam kya hai", "mere bete ka kya naam hay", "mere bare mein kya yaad hai")
    if (
      /\b(?:main\s+k(?:on|aun|o?un)\s+h[ou]+n|who\s+am\s+i|mera\s+naam|mere\s+naam|mere\s+(?:bete|bachay|bachon|family|khandan|ghar|bare|mutalliq)|mujhe\s+jaanti\s+ho|mera\s+intro)\b/i.test(q) ||
      /(?:kya\s+yaad\s+hai|kya\s+yaad\s+hay)\s+(?:mere|apne)?/i.test(q) ||
      /(?:naam\s+kya\s+hai|naam\s+kya\s+hay)/i.test(q)
    ) {
      return 'query_facts';
    }

    // 3. Registered Self-Learned Local Operations check
    const learnedOp = MemoryManager.findOperation(q);
    if (learnedOp) {
      return { type: 'learned_op', op: learnedOp };
    }

    // Terminal / Shell Execution Intent (Offline Direct Shell Execution)
    const tPattern = /^(?:terminal\s*(?:main|mein)?|bash|sh|cmd|command)\s*[:\s]+(.+)$/i;
    const tPatternRun = /^(?:run|chalao|execute)\s+(?:terminal\s+(?:command\s+)?|command\s+|bash\s+)(.+)$/i;
    const tPatternCmd = /^command\s+(?:run\s+karo|chalao|execute)\s+(.+)$/i;
    const origQuery = query.trim().replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    const tm = origQuery.match(tPattern) || origQuery.match(tPatternRun) || origQuery.match(tPatternCmd);
    if (tm) {
      let raw = tm[1].trim();
      let tAutoYes = false;
      if (/(?:aor\s+)?(?:har\s+option\s+par\s+y\s+karo|har\s+jagah\s+y|har\s+baar\s+y|auto\s+yes|har\s+sawal\s+par\s+y)/i.test(raw)) {
        tAutoYes = true;
        raw = raw.replace(/(?:aor\s+)?(?:har\s+option\s+par\s+y\s+karo|har\s+jagah\s+y|har\s+baar\s+y|auto\s+yes|har\s+sawal\s+par\s+y)/i, '').trim();
      }
      raw = raw.replace(/\s+(?:chalao|run\s+karo|execute\s+karo|kardo|karein|run|execute)\s*$/i, '').trim();
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1).trim();
      }
      if (raw) {
        return { type: 'terminal_exec', command: raw, autoYes: tAutoYes };
      }
    }

    // Page Reload / Refresh trigger
    if (
      /^(?:page\s+|browser\s+|screen\s+)?(?:reload\s+refresh|refresh\s+reload|reload|refresh)(?:\s+karo|\s+karein|\s+kardo|\s+kardain)?$/i.test(q) ||
      /^(?:reload|refresh|reload\s+refresh|refresh\s+reload)$/i.test(q) ||
      /(?:page|browser|screen)\s+(?:ko\s+)?(?:refresh|reload|reload\s+refresh)\s*(?:karo|karein|kardo)?/i.test(q) ||
      /\b(?:page\s+reload|page\s+refresh)\b/i.test(q)
    ) {
      return 'reload_page';
    }

    // Troubleshooting / Changes Visibility Query (e.g. "changes dikhaye nahi de rahi", "styling apply nahi hui")
    if (
      /(?:changes?|tabdeeli|styling|styles?|border|color)\s+(?:dikh|nazar|show|apply|dekha|de\s+rahi|nahi\s+ho\s+rahi|nahi\s+aa\s+rahi|nahi\s+dikh|nahi\s+de\s+rahi)/i.test(q) ||
      /(?:dikhaye\s+nahi\s+de\s+rahi|nazar\s+nahi\s+aa\s+rahi|show\s+nahi\s+ho\s+rahi|dikha\s+nahi\s+raha)/i.test(q)
    ) {
      return 'troubleshoot_changes';
    }

    // Code Editor / Manual User Editing Intent
    if (
      /(?:code\s*editor|manual\s*edit|editor\s*kholo|open\s*editor|html\s*edit|css\s*edit|manual\s*user\s*editing|editor\s*dikhao|editor\s*install)/i.test(q) ||
      /^(?:editor|code editor)$/i.test(q)
    ) {
      return 'open_editor';
    }

    // 4. GUI & Components Code / Styling Inspection
    if (
      /(?:code|css|html|styling|styles?|color|background|bg|border|radius|padding|size|width|height)\s+(?:dikhao|batao|kya hai|kya hay|check karo)/i.test(q) ||
      /(?:components?|elements?)\s*(?:ki\s+list|dikhao|batao|tamam|all)/i.test(q) ||
      /(?:token\s*cards?|header|logo|avatar|brand|navbar|switch|hero|button|input|modal|cards?|body|background|bg|nav\s*tabs)\s*(?:ka|ki|ke)?\s*(?:code|css|html|styling|styles?|color|background|border|radius|padding|size|width)?\s*(?:kya hai|kya hay|dikhao|batao|check)/i.test(q) ||
      /(?:kya\s+color\s+hai|color\s+kya\s+hay|color\s+kya\s+hai|border\s+kya\s+hay|border\s+color\s+kya\s+hay)/i.test(q)
    ) {
      return 'inspect_component';
    }

    // 5. GUI & Components Live Styling Mutation (Size, Padding, Borders, Background, Colors, Radius, Width, Height, Margin, Gap)
    if (
      /(?:token\s*cards?|header|logo|avatar|brand|navbar|switch|hero|button|input|modal|cards?|cwd\s*bar|body|page|background|screen|app-header|avatar-glow)\s*(?:ka|ki|ke|ko)?\s*(?:size|padding|border|color|background|bg|radius|font|height|width|margin|gap).*?(?:badlo|change|kardo|rakho|set|badha|chhota|barha|bara|kam|zyada|ghata)/i.test(q) ||
      /<[a-z0-9_-]+\s+class=["'][^"']+["']>\s*iska\s+(?:border|color|background|size|padding)/i.test(q) ||
      /(?:badlo|change|set|update)\s+(?:token\s*cards?|header|logo|avatar|brand|hero|button|input|modal|cards?|body|page|background)\s*(?:ka|ki)?\s*(?:size|padding|border|color|background|radius|width|height)/i.test(q) ||
      /(?:body|background|page|screen)\s*(?:ka|ki|ke)?\s*(?:color|background|bg)?\s*(?:black|white|dark|cyan|green|purple|red|blue|gray|peach|brown|#|[a-z]+)\s*(?:kardo|rakho|set|badlo)/i.test(q) ||
      /(?:border|padding|border-radius|radius|width|height|background|color)\s+[0-9a-z%pxrem\s#]+\s*(?:kardo|rakho|set)/i.test(q) ||
      /(?:border\s+color|border\s+solid|border\s+size|border\s+width).*?(?:kardo|rakho|set)/i.test(q)
    ) {
      return 'modify_component';
    }

    // 6. GUI Architecture & Sizing Explanation
    if (
      /(?:token\s*(?:dashboard|cards?)|cards?\s*ka\s*size|dashboard\s*cards?|token\s*card\s*size)/i.test(q) ||
      /(?:apne|apni|meri|current)?\s*(?:index\.html|style\.css|app\.js|server\.js|package\.json|gui|frontend|backend|components?|tokens?|cards?)\s*(?:ko)?\s*(?:explain|samjhao|batao|bataiye|kya hai|size)/i.test(q) ||
      /(?:explain|samjhao|size)\s+(?:apne|apni)?\s*(?:index\.html|style\.css|app\.js|server\.js|package\.json|gui|frontend|backend|components?|tokens?|cards?)/i.test(q) ||
      /(?:apne|apni)\s+(?:files|code|gui|architecture|cards?|components?)\s*(?:ko)?\s*(?:explain|samjhao|batao|size)/i.test(q)
    ) {
      return 'explain_gui';
    }

    // 7. General GUI & File Self-Editing
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
    if (
      /^cd(\s+.*)?$/i.test(q) ||
      /^folder\s+badlo(\s+.*)?$/i.test(q) ||
      /^andar\s+jao(\s+.*)?$/i.test(q) ||
      /^(?:go\s+to|enter|switch\s+to|open)\s+(?:folder\s+|directory\s+)?/i.test(q) ||
      /.+?\s+(?:folder\s+)?(?:main|mein|par)\s+(?:jao|chalo|ghuso)$/i.test(q) ||
      /^(?:peeche|back|bahir|bahr)\s+(?:jao|aao|niklo)$/i.test(q) ||
      /^(?:home|root)\s+(?:folder\s+)?(?:main\s+jao|par\s+jao)$/i.test(q)
    ) {
      return 'cd';
    }
    if (
      /^(?:pwd|kahan\s+khari\s+ho|kahan\s+ho|current\s+directory|current\s+path)$/i.test(q) ||
      /(?:konsa|konsi|kounsa|kounsi|kis)\s+(?:folder|directory|path|jagah)\s*(?:hai|hay|mein|main)?/i.test(q) ||
      /(?:current|mojooda)\s+(?:folder|directory|path|dir)\s*(?:kya\s+hai|kya\s+hay|batao|dikhao)?/i.test(q) ||
      /(?:hum|main)\s+(?:kis|kahan|konsay|konse)\s+(?:folder|directory|jagah)\s*(?:mein|main)?\s*(?:hain|hoon|khari\s+ho|ho)/i.test(q) ||
      /^(?:folder|directory|path)\s*(?:kya\s+hai|kya\s+hay|check\s+karo)?$/i.test(q)
    ) {
      return 'pwd';
    }
    if (
      /^(ls|dir)(\s+.*)?$/i.test(q) ||
      /\b(?:files\s+dikhao|list\s+files|folder\s+mein\s+kya|directory\s+check)\b/i.test(q) ||
      /(?:folder|directory)?\s*(?:list\s+karo|list\s+kardo|list\s+karein)\b/i.test(q) ||
      /^(?:list\s+)/i.test(q)
    ) {
      return 'ls';
    }
    if (/^(cat|view|read|file parho|file dikhao)\s+/i.test(q)) {
      return 'cat';
    }
    if (/^(tree|folder tree)(\s+.*)?$/i.test(q)) {
      return 'tree';
    }
    if (
      /^(?:find|dhoondo|search\s+file|search|locate|where\s+is)\s+/i.test(q) ||
      /(?:kahan\s+(?:hai|hay|he|h[ou]+n)|kidhar\s+(?:hai|hay))\b/i.test(q)
    ) {
      return 'find';
    }
    if (/^(mkdir|folder banao)\s+/i.test(q)) {
      return 'mkdir';
    }
    if (/^(touch|file banao)\s+/i.test(q)) {
      return 'touch';
    }
    if (
      /^(?:mv|move|cut)\s+/i.test(q) ||
      /(?:move\s+karo|move\s+kardo|cut\s+paste|main\s+move\s+karo|main\s+move\s+kardo)/i.test(q) ||
      /(?:from\s+phone\s+to\s+home|from\s+home\s+to\s+phone)\s+.*?(?:move|mv)/i.test(q) ||
      /(?:move|mv)\s+.*?(?:phone|home)/i.test(q)
    ) {
      return 'move_item';
    }
    if (
      /^(?:cp|copy)\s+/i.test(q) ||
      /(?:copy\s+karo|copy\s+kardo|paste\s+karo|main\s+copy\s+karo|main\s+copy\s+kardo|main\s+paste\s+karo)/i.test(q) ||
      /(?:copy\s+(?:public|folder|file|phone|home))/i.test(q) ||
      /(?:from\s+phone\s+to\s+home|from\s+home\s+to\s+phone)/i.test(q)
    ) {
      return 'copy_item';
    }

    // Git & GitHub Operations Intent
    if (
      /^(?:git|github)\s*(?:status|diff|log|branch)\b/i.test(q) ||
      /^(?:git|github)\s*(?:commit\s*(?:aor|aur|and|&)?\s*push|push|commit)\b/i.test(q) ||
      /(?:github|git)\s*(?:par|pe)?\s*(?:commit\s*(?:aor|aur|and|&)?\s*push|push|commit|bhej\s+do|upload\s+kardo)/i.test(q) ||
      /^(?:commit\s*(?:aor|aur|and|&)?\s*push|push\s+to\s+github|git\s+push|git\s+status|git\s+log|git\s+diff)\b/i.test(q)
    ) {
      return 'git_op';
    }

    // If query asks to write code, script, or explain programming, pass to Cloud AI
    const creativeWords = ['script', 'code', 'likho', 'banao', 'create', 'write', 'function', 'class', 'program', 'debug', 'explain'];
    for (const w of creativeWords) {
      if (new RegExp(`\\b${w}\\b`).test(q)) return false;
    }

    // 10. Hardware & System Specs
    if (/\b(battery|charge|charging|battery status)\b/.test(q)) return 'battery';
    if (/\b(ram|memory|free ram|kitni ram)\b/.test(q)) return 'ram';
    if (
      /(?:kitni|kitna|free|available|total|check|status)\s+(?:storage|disk|space)\b/i.test(q) ||
      /(?:storage|disk|space)\s+(?:kitni|kitna|check|status|batao|info|specs)\b/i.test(q) ||
      /^(?:storage|disk|disk space|storage check|check storage)$/i.test(q)
    ) {
      return 'storage';
    }
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
    if (typeof intent === 'object' && intent.type === 'terminal_exec') {
      return await this.executeTerminalCommand(intent.command, intent.autoYes);
    }

    switch (intent) {
      case 'git_op':
        return await this.executeGitOperation(query);
      case 'move_item':
        return this.moveItem(query);
      case 'copy_item':
        return this.copyItem(query);
      case 'teach':
        return this.learnFromInput(query);
      case 'check_mode': {
        const cfg = ConfigManager.load();
        const curMode = cfg.mode || 'online';
        const curProvider = cfg.activeProvider || 'groq';
        const curModel = cfg.activeModel || 'qwen/qwen3.8-27b';
        return `🤖 **Jena Operating Status & Mode Report:**\n\n` +
               `- 🌐 **Active Mode:** **${curMode.toUpperCase()}**\n` +
               `- ⚙️ **Active Provider:** \`${curProvider}\`\n` +
               `- 🧠 **Active Model:** \`${curModel}\`\n` +
               `- ⚡ **Local Core:** Active (Termux Linux • Zero Token Usage)\n\n` +
               `*Aap upar header switch se ya \`online mode\` / \`offline mode\` bol kar switch kar sakte hain.*`;
      }
      case 'reload_page':
        return '🔄 **Page Refresh:** Browser page refresh initiate ho raha hai...';
      case 'troubleshoot_changes':
        return this.troubleshootChanges(query);
      case 'open_editor':
        return `🛠️ **Jena Manual Code Editor (HTML & CSS):**\n\n` +
               `Main ne aapke GUI mein live **Code Editor** install kar diya hai!\n\n` +
               `### 🌟 Features & Manual Editing Guide:\n` +
               `- 🗂️ **File Selector Tabs:** Upar \`📄 index.html\`, \`🎨 style.css\`, aur \`⚡ app.js\` ke buttons se kisi bhi file ka live code load karein.\n` +
               `- ✍️ **Direct In-App Editing:** Code editor mein line numbers aur tab spacing ke sath khud changes karein.\n` +
               `- 💾 **Save & Instant Hot-Reload:** \`💾 Save & Apply\` button dabayein ya keyboard par \`Ctrl + S\` press karein, file direct disk par save ho kar live screen par refresh ho jayegi.\n` +
               `- 🔄 **Revert / Reload:** Agar koi ghalti ho jaye to \`🔄 Reload\` se disk se original file wapas la sakte hain.\n\n` +
               `*Aap upar navigation bar mein **🛠️ Code Editor** tab par click karke abhi manual editing shuru kar sakte hain!*`;
      case 'show_memory':
        return this.showMemory();
      case 'explain_gui':
        return this.explainGui(query);
      case 'inspect_component':
        return this.inspectComponent(query);
      case 'modify_component':
        return this.modifyComponent(query);
      case 'edit_gui':
        return this.editGui(query);
      case 'scaffold_web':
        return this.scaffoldWebPage(query);
      case 'file_write_edit':
        return this.handleFileWriteOrEdit(query);
      case 'web_knowledge':
        return this.explainWebConcept(query);
      case 'query_facts':
        return this.queryMemoryFacts(query);
      case 'cd':
        return this.changeDirectory(query);
      case 'pwd': {
        const cwd = this.getCwd();
        const folderName = path.basename(cwd) || 'root';
        return `📍 **Current Working Directory:**\n- 📁 **Folder:** \`${folderName}\`\n- 📍 **Full Path:** \`${cwd}\`\n\n*(Files dekhne ke liye \`ls\` likhein.)*`;
      }
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

  // --- TERMINAL / SHELL EXECUTION ---
  static executeTerminalCommand(cmd, autoYes = false) {
    return new Promise(resolve => {
      const trimmed = (cmd || '').trim();
      if (!trimmed) {
        return resolve('⚠️ Barah-e-karam koi valid terminal command batayein.');
      }

      // If user passed a cd command inside terminal execution
      if (/^cd(\s+.*)?$/i.test(trimmed)) {
        return resolve(this.changeDirectory(trimmed));
      }

      let execCmd = trimmed;
      if (autoYes && !execCmd.startsWith('yes |')) {
        execCmd = `yes | ${execCmd} -o Dpkg::Options::="--force-confnew"`;
      }

      const cwd = this.getCwd();
      exec(execCmd, {
        cwd,
        timeout: 45000,
        shell: '/data/data/com.termux/files/usr/bin/sh',
        env: {
          ...process.env,
          HOME: HOME_DIR,
          DEBIAN_FRONTEND: 'noninteractive'
        }
      }, (err, stdout, stderr) => {
        const out = (stdout || '').trim();
        const errOut = (stderr || '').trim();
        let body = '';
        if (out) body += out;
        if (errOut) body += (body ? '\n' : '') + errOut;
        if (err && !body) body = `Error: ${err.message}`;

        if (body.length > 8000) {
          const lines = body.split('\n');
          if (lines.length > 80) {
            body = `[...Truncated first ${lines.length - 80} lines...]\n` + lines.slice(-80).join('\n');
          }
        }

        if (err) {
          LogManager.logFailure({
            command: execCmd,
            type: 'TERMINAL_EXEC_FAILURE',
            error: `${err.message}${errOut ? ` | stderr: ${errOut}` : ''}`,
            cwd,
            context: { originalCommand: cmd, autoYes }
          });
        }

        resolve(
          `⚡ **Jena Terminal Execution Output:**\n` +
          `- 📍 **CWD:** \`${cwd}\`\n` +
          `- ⌨️ **Command:** \`${execCmd}\`\n\n` +
          `\`\`\`sh\n${body || '(Command successfully executed with no output)'}\n\`\`\`\n\n` +
          `*(Command offline Termux environment par run hua.)*`
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

  static queryMemoryFacts(query) {
    const mem = MemoryManager.load();
    const facts = mem.learned_facts || [];
    if (facts.length === 0) {
      return '🧠 **Memory Report:** Mere paas abhi aapke mutalliq koi saved facts nahi hain. Aap mujhe `seekho: mera naam ... hai` bol kar sikha saktay hain!';
    }

    const q = (query || '').toLowerCase();
    const matches = [];

    // Check specific topics / entities asked in query
    const asksAboutUser = /\b(?:main\s+k(?:on|aun|o?un)|who\s+am\s+i|mera\s+naam|mere\s+naam|mera\s+intro)\b/i.test(q);
    const asksAboutSon = /\b(?:beta|bete|bacha|bachay|son|child|saifullah)\b/i.test(q);

    // If both user and son are asked, or general inquiry
    facts.forEach(f => {
      const txt = (f.fact || '').toLowerCase();
      let isRelevant = false;
      if (asksAboutUser && (txt.includes('mera naam') || txt.includes('abusaif') || (f.topic === 'user_name' && !facts.some(other => other.fact.includes('mera naam'))))) {
        isRelevant = true;
      }
      if (asksAboutSon && (txt.includes('bete') || txt.includes('beta') || txt.includes('saifullah') || txt.includes('son'))) {
        isRelevant = true;
      }
      if (isRelevant && !matches.includes(f.fact)) {
        matches.push(f.fact);
      }
    });

    const displayFacts = matches.length > 0 ? matches : facts.map(f => f.fact);

    let res = `🧠 **Jena Memory Se Maloomat:**\n\n`;
    displayFacts.forEach(factText => {
      res += `- 💡 **${factText}**\n`;
    });
    res += `\n*(Yeh maloomat offline memory \`~/.jena/memory.json\` se direct 0 tokens par retrieve hui hain.)*`;
    return res;
  }

  // --- LOCAL FILESYSTEM NAVIGATION ---
  static extractCdTarget(query) {
    if (!query) return '';
    let q = query.trim();
    q = q.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();

    // 1. "peeche jao", "back jao", "bahir aao", "bahr niklo" -> ".."
    if (/^(?:peeche|back|bahir|bahr)\s+(?:jao|aao|niklo)$/i.test(q) || q.toLowerCase() === 'cd ..') {
      return '..';
    }

    // 2. "home main jao", "home par jao", "home folder main jao" -> "~"
    if (/^home\s+(?:folder\s+)?(?:main|par|mein)\s+(?:jao|chalo)$/i.test(q)) {
      return '~';
    }

    // 3. "<folder> main jao", "<folder> folder main jao", "<folder> par jao"
    let m = q.match(/^(.+?)\s+(?:folder\s+)?(?:main|mein|par)\s+(?:jao|chalo|ghuso)$/i);
    if (m) {
      let target = m[1].replace(/^(?:folder|directory)\s+/i, '').trim();
      return target;
    }

    // 4. "go to folder <target>", "enter folder <target>", "switch to <target>"
    m = q.match(/^(?:go\s+to|enter|switch\s+to|open)\s+(?:folder\s+|directory\s+)?(.+)$/i);
    if (m) {
      return m[1].trim();
    }

    // 5. Classic "cd <target>", "folder badlo <target>", "andar jao <target>"
    let target = q.replace(/^(?:cd|folder\s+badlo|andar\s+jao)\s*/i, '').trim();
    target = target.replace(/^(?:folder|directory)\s+/i, '').trim();
    return target;
  }

  static changeDirectory(query) {
    let target = this.extractCdTarget(query);
    if (!target || target === '~' || target.toLowerCase() === 'home') target = HOME_DIR;
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
    let target = (query || '').trim();
    target = target.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    target = target.replace(/^(?:ls|dir|files\s+dikhao|list\s+files|folder\s+mein\s+kya|directory\s+check|list)\s*/i, '').trim();
    target = target.replace(/\s*(?:folder|directory)?\s*(?:list\s+karo|list\s+kardo|list\s+karein|dikhao|check).*$/i, '').trim();
    target = target.replace(/\s+(?:folder|directory)\s*$/i, '').trim();

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
    let term = (query || '').trim();
    term = term.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    term = term.replace(/^(?:find|dhoondo|search\s+file|search|locate|where\s+is)\s+/i, '').trim();
    term = term.replace(/\s*(?:folder|file)?\s*(?:kahan\s+(?:hai|hay|he|h[ou]+n)|kidhar\s+(?:hai|hay)).*$/i, '').trim();
    term = term.replace(/^(?:folder|file)\s+/i, '').trim();
    term = term.replace(/\s+(?:folder|file)\s*$/i, '').trim();

    if (!term) return '⚠️ Barah-e-karam search term likhein (e.g. `find config` ya `public folder kahan hay`).';

    this.ensurePhoneDir();
    const searchRoots = [
      { name: 'Current Directory', path: this.getCwd() },
      { name: 'Home Folder', path: HOME_DIR },
      { name: 'Jena Project', path: path.join(HOME_DIR, 'jena2') },
      { name: 'Phone Storage', path: PHONE_DIR }
    ];

    const seenPaths = new Set();
    const matches = [];

    const searchDir = (dir, depth = 0) => {
      if (depth >= 3 || matches.length >= 25) return;
      let items = [];
      try { items = fs.readdirSync(dir); } catch (_) { return; }
      for (const item of items) {
        if (['node_modules', '.git', '.cache', '.gemini'].includes(item)) continue;
        const fullPath = path.join(dir, item);
        if (seenPaths.has(fullPath)) continue;
        seenPaths.add(fullPath);

        if (item.toLowerCase().includes(term.toLowerCase())) {
          let isDir = false;
          try { isDir = fs.statSync(fullPath).isDirectory(); } catch (_) {}
          matches.push({ path: fullPath, isDir });
        }
        try {
          if (fs.statSync(fullPath).isDirectory()) searchDir(fullPath, depth + 1);
        } catch (_) {}
      }
    };

    for (const root of searchRoots) {
      if (fs.existsSync(root.path)) {
        searchDir(root.path, 0);
      }
    }

    if (matches.length === 0) {
      return `🔍 \`${term}\` ke sath koi file ya folder nahi mila (CWD, Home, aur Phone storage check kiye).`;
    }

    const lines = [
      `🔍 **Search Results for "${term}":**\n`
    ];
    matches.forEach(m => {
      lines.push(`- ${m.isDir ? '📁' : '📄'} \`${m.path}\``);
    });
    return lines.join('\n');
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

  static copyItem(query) {
    return this.transferItem(query, false);
  }

  static moveItem(query) {
    return this.transferItem(query, true);
  }

  static transferItem(query, defaultIsMove = false) {
    let q = (query || '').trim();
    q = q.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();

    let isMove = defaultIsMove;
    if (/\b(?:move|mv|cut|hata\s*k|le\s*jao)\b/i.test(q)) {
      isMove = true;
    } else if (/\b(?:copy|cp|paste)\b/i.test(q)) {
      isMove = false;
    }

    let src = '';
    let dest = '';
    let item = '';
    let srcDir = '';
    let destDir = '';

    // Pattern 1: (copy|move)? from <srcDir> to <destDir> (copy|move)? <item>
    let m = q.match(/^(?:cp|copy|mv|move)?\s*from\s+([a-zA-Z0-9_\-\/~]+)\s+to\s+([a-zA-Z0-9_\-\/~]+)\s+(?:copy|move|karo|kardo)?\s*(.+)$/i);
    if (m) {
      srcDir = m[1].trim();
      destDir = m[2].trim();
      item = m[3].replace(/\s*(?:copy|move|karo|kardo|karein)\s*$/i, '').trim();
    }

    // Pattern 2: <item> from <srcDir> to <destDir>
    if (!srcDir) {
      m = q.match(/^(?:cp|copy|mv|move)?\s*(.+?)\s+from\s+([a-zA-Z0-9_\-\/~]+)\s+to\s+([a-zA-Z0-9_\-\/~]+)(?:\s+(?:copy|move|karo|kardo))?$/i);
      if (m) {
        item = m[1].trim();
        srcDir = m[2].trim();
        destDir = m[3].trim();
      }
    }

    // Pattern 3: Roman Urdu: <srcDir> se <item> <destDir> (main|mein|par) (copy|move|paste)?
    if (!srcDir) {
      m = q.match(/^([a-zA-Z0-9_\-\/~]+)\s+se\s+(.+?)\s+([a-zA-Z0-9_\-\/~]+)\s+(?:main|mein|par)\s*(?:copy|move|paste)?\s*(?:karo|kardo|karein)?$/i);
      if (m) {
        srcDir = m[1].trim();
        item = m[2].trim();
        destDir = m[3].trim();
      }
    }

    // Pattern 4: <item> ko <destDir> (main|mein|par) (copy|move|paste)?
    if (!srcDir && !src) {
      m = q.match(/^(.+?)\s+(?:folder\s+|file\s+)?ko\s+([a-zA-Z0-9_\-\/~]+)\s+(?:main|mein|par)\s*(?:copy|move|paste)\s*(?:karo|kardo|karein)?$/i);
      if (m) {
        item = m[1].trim();
        dest = m[2].trim();
      }
    }

    // Pattern 5: (copy|move|cp|mv) <src> (paste in|to|into) <dest>
    if (!srcDir && !src) {
      m = q.match(/^(?:cp|copy|mv|move)\s+(?:folder\s+|file\s+)?(.+?)\s+(?:paste\s+in|to|into)\s+(.+)$/i);
      if (m) {
        src = m[1].trim();
        dest = m[2].trim();
      }
    }

    // Pattern 6: (cp|mv) <src> <dest>
    if (!srcDir && !src) {
      m = q.match(/^(?:cp|mv)\s+(.+?)\s+(.+)$/i);
      if (m) {
        src = m[1].trim();
        dest = m[2].trim();
      }
    }

    // Pattern 7: (copy|move) <src> <dest> where dest is phone, home, or storage
    if (!srcDir && !src) {
      m = q.match(/^(?:copy|move)\s+(.+?)\s+(phone|home|storage\/[a-zA-Z0-9_\-]+|termux-to-phone)$/i);
      if (m) {
        src = m[1].trim();
        dest = m[2].trim();
      }
    }

    // Resolve directories and items
    if (srcDir && destDir && item) {
      item = item.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      const baseSrc = this.resolvePath(srcDir);
      src = path.join(baseSrc, item);
      dest = this.resolvePath(destDir);
    } else if (src && dest) {
      src = src.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      dest = dest.replace(/\s*(?:main|mein|k\s+andar|ke\s+andar)\s*$/i, '').trim();
      dest = dest.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      src = this.resolvePath(src);
      dest = this.resolvePath(dest);
    } else if (item && dest) {
      item = item.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      dest = dest.replace(/\s*(?:main|mein|k\s+andar|ke\s+andar)\s*$/i, '').trim();
      dest = dest.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      src = this.resolvePath(item);
      dest = this.resolvePath(dest);
    }

    if (!src || !dest) {
      return (
        `⚠️ Barah-e-karam source aur destination batayein.\n` +
        `- **Misal:** \`copy public folder to phone\`\n` +
        `- **Misal:** \`copy from phone to home app.js\`\n` +
        `- **Misal:** \`move app.js to home\`\n` +
        `- **Misal:** \`phone se public home main copy karo\``
      );
    }

    // Locate source if not existing at direct path
    let resolvedSrc = src;
    if (!fs.existsSync(resolvedSrc)) {
      const candidates = [
        path.join(this.getCwd(), path.basename(src)),
        path.join(HOME_DIR, path.basename(src)),
        path.join(__dirname, path.basename(src)),
        path.join(PHONE_DIR, path.basename(src)),
        path.join(HOME_DIR, 'storage/downloads', path.basename(src))
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          resolvedSrc = cand;
          break;
        }
      }
    }

    if (!fs.existsSync(resolvedSrc)) {
      return `❌ **${isMove ? 'Move' : 'Copy'} Error:** Source file ya folder mojood nahi mila:\n\`${src}\``;
    }

    let resolvedDest = dest;
    this.ensurePhoneDir();

    let targetDest = resolvedDest;
    try {
      const srcStat = fs.statSync(resolvedSrc);
      const isDir = srcStat.isDirectory();

      // If destination is an existing directory, place the item inside it
      if (fs.existsSync(resolvedDest)) {
        const destStat = fs.statSync(resolvedDest);
        if (destStat.isDirectory()) {
          targetDest = path.join(resolvedDest, path.basename(resolvedSrc));
        }
      } else {
        const parentDir = path.dirname(resolvedDest);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
      }

      if (path.resolve(resolvedSrc) === path.resolve(targetDest)) {
        return `⚠️ **Ooper:** Source aur Destination dono aik hi path hain:\n\`${resolvedSrc}\``;
      }

      if (isMove) {
        try {
          fs.renameSync(resolvedSrc, targetDest);
        } catch (renameErr) {
          // EXDEV fallback: cross-device link not permitted (between internal Termux and Android /storage/emulated/0)
          if (renameErr.code === 'EXDEV' || renameErr.code === 'EPERM' || renameErr.code === 'EACCES') {
            fs.cpSync(resolvedSrc, targetDest, { recursive: true });
            fs.rmSync(resolvedSrc, { recursive: true, force: true });
          } else {
            throw renameErr;
          }
        }
      } else {
        fs.cpSync(resolvedSrc, targetDest, { recursive: true });
      }

      return (
        `${isMove ? '🚚' : '📋'} **${isMove ? 'Move' : 'Copy'} Kamyabi Se Mukammal!**\n` +
        `- 📦 **Type:** ${isDir ? '📁 Folder' : '📄 File'}\n` +
        `- 🟢 **Source:** \`${resolvedSrc}\`\n` +
        `- 🎯 **Destination:** \`${targetDest}\`\n\n` +
        `*(Files foran transfer ho chuki hain. Phone storage \`termux-to-phone\` files aapke mobile file manager ya apps mein foran dastiyab hain.)*`
      );
    } catch (err) {
      return `❌ **${isMove ? 'Move' : 'Copy'} Error:** ${err.message}`;
    }
  }

  // --- GIT & GITHUB OPERATIONS ---
  static async executeGitOperation(query) {
    const q = query.trim().toLowerCase();
    const projectDir = __dirname;
    const gitDir = path.join(projectDir, '.git');

    if (!fs.existsSync(gitDir)) {
      return `⚠️ **Git Repository Not Found:** \`${projectDir}\` mein koi git repository initialize nahi hai.`;
    }

    // 1. Status query
    if (/^(?:git|github)\s+status\b/i.test(q) || q === 'git status') {
      return await new Promise(resolve => {
        exec('git status -s -b', { cwd: projectDir }, (err, stdout) => {
          if (err) return resolve(`❌ **Git Status Error:** ${err.message}`);
          const out = (stdout || '').trim();
          resolve(
            `🐙 **Jena Git Repository Status:**\n` +
            `- 📍 **Repo:** \`${projectDir}\`\n\n` +
            `\`\`\`sh\n${out || 'Working tree clean (No uncommitted changes)'}\n\`\`\`\n\n` +
            `*(Changes commit aur push karne ke liye \`git commit push\` likhein ya editor mein **🐙 GitHub Push** button dabayein.)*`
          );
        });
      });
    }

    // 2. Diff query
    if (/^(?:git|github)\s+diff\b/i.test(q) || q === 'git diff') {
      return await new Promise(resolve => {
        exec('git diff --stat', { cwd: projectDir }, (err, stdout) => {
          const out = (stdout || '').trim();
          resolve(`🐙 **Git Diff (Changed Files):**\n\`\`\`sh\n${out || 'No uncommitted changes'}\n\`\`\``);
        });
      });
    }

    // 3. Log query
    if (/^(?:git|github)\s+log\b/i.test(q) || q === 'git log') {
      return await new Promise(resolve => {
        exec('git log -n 5 --oneline --decorate', { cwd: projectDir }, (err, stdout) => {
          const out = (stdout || '').trim();
          resolve(`🐙 **Git Recent Commits:**\n\`\`\`sh\n${out || 'No commits yet'}\n\`\`\``);
        });
      });
    }

    // 4. Commit and Push operation
    let commitMsg = '';
    const m = query.match(/(?:commit\s*(?:aor|aur|and|&)?\s*push|push|commit)[:\s]+["']?([^"'\n]+)["']?$/i);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (!/^(?:karo|kardo|karein|now|please)$/i.test(candidate)) {
        commitMsg = candidate;
      }
    }
    if (!commitMsg) {
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      commitMsg = `Update via Jena: ${nowStr}`;
    }

    return await this.gitCommitAndPush(commitMsg, true);
  }

  static gitCommitAndPush(message, pushToRemote = true) {
    return new Promise(resolve => {
      const projectDir = __dirname;
      const cleanMsg = (message || `Update via Jena: ${new Date().toISOString()}`).replace(/"/g, '\\"');

      // 1. Stage all changes
      exec('git add -A', { cwd: projectDir }, (addErr) => {
        if (addErr) {
          return resolve(`❌ **Git Add Error:** ${addErr.message}`);
        }

        // 2. Check if there are staged changes
        exec('git status --porcelain', { cwd: projectDir }, (statusErr, statusOut) => {
          const hasChanges = (statusOut || '').trim().length > 0;

          const doPush = (commitNotice = '') => {
            if (!pushToRemote) {
              return resolve(commitNotice || '✅ **Changes committed locally (Push skipped).**');
            }

            exec('git rev-parse --abbrev-ref HEAD', { cwd: projectDir }, (branchErr, branchOut) => {
              const branch = (branchOut || 'master').trim();
              exec(`git push origin ${branch}`, {
                cwd: projectDir,
                timeout: 45000,
                env: { ...process.env, HOME: HOME_DIR }
              }, (pushErr, pushStdout, pushStderr) => {
                const pOut = (pushStdout || '').trim();
                const pErr = (pushStderr || '').trim();
                let combined = (pOut ? pOut + '\n' : '') + pErr;
                combined = combined.trim();

                if (pushErr) {
                  return resolve(
                    `${commitNotice ? commitNotice + '\n\n' : ''}` +
                    `⚠️ **Git Push Warning / Error:**\n\`\`\`sh\n${pushErr.message}\n${combined}\n\`\`\`\n` +
                    `*(SSH authentication ya network connection check karein.)*`
                  );
                }

                resolve(
                  `🚀 **GitHub Commit & Push Successful!**\n\n` +
                  `- 🌿 **Branch:** \`${branch}\`\n` +
                  `- 💬 **Commit Message:** \`${cleanMsg}\`\n` +
                  `- 🌐 **Remote:** \`origin/${branch}\`\n\n` +
                  `\`\`\`sh\n${combined || 'Everything up-to-date'}\n\`\`\`\n\n` +
                  `✅ *Aapki tamam tabdeeliyan GitHub repository par live update ho chuki hain!*`
                );
              });
            });
          };

          if (hasChanges) {
            exec(`git commit -m "${cleanMsg}"`, {
              cwd: projectDir,
              env: { ...process.env, HOME: HOME_DIR }
            }, (commitErr, commitStdout) => {
              if (commitErr) {
                return resolve(`❌ **Git Commit Error:** ${commitErr.message}`);
              }
              const cOut = (commitStdout || '').trim();
              const commitNotice = `✅ **Changes Committed:**\n\`\`\`sh\n${cOut}\n\`\`\``;
              doPush(commitNotice);
            });
          } else {
            exec('git status -s -b', { cwd: projectDir }, (bErr, bOut) => {
              const bInfo = (bOut || '').split('\n')[0] || '';
              if (bInfo.includes('ahead')) {
                doPush('ℹ️ Working tree clean thi magar unpushed local commits mojood thay. Pushing to GitHub...');
              } else {
                resolve(
                  `ℹ️ **Working Tree Clean:** Koi nayi tabdeeli (changes) nahi mili commit karne ke liye.\n\n` +
                  `- 🌿 **Branch:** Already up-to-date with \`origin\`.\n` +
                  `- 💡 File editor mein tabdeeli karein ya file save karein, phir dobara push karein.`
                );
              }
            });
          }
        });
      });
    });
  }

  // --- OFFLINE COMPONENT KNOWLEDGE & LIVE MUTATION ENGINE ---
  static COMPONENT_REGISTRY = {
    token_card: {
      names: ['token card', 'token cards', 'token dashboard', 'dashboard card', 'dashboard cards', 'metric card', 'metrics cards'],
      selector: '.token-card',
      containerSelector: '.token-dashboard',
      file: 'public/style.css',
      htmlSearch: 'section class="token-dashboard"',
      htmlEndSearch: '</section>',
      desc: 'Token Dashboard Metrics Cards (Allowance, Used, Balance, Speed)'
    },
    header: {
      names: ['header', 'app header', 'navbar', 'top bar', 'nav bar'],
      selector: '.app-header',
      file: 'public/style.css',
      htmlSearch: '<header class="app-header">',
      htmlEndSearch: '</header>',
      desc: 'Top Application Header with Brand Logo, Navigation Tabs & Mode Switch'
    },
    logo: {
      names: ['logo', 'avatar', 'avatar glow', 'avatar-glow', 'brand logo', 'bot icon', 'bot logo', 'bot avatar', 'robot icon'],
      selector: '.avatar-glow',
      file: 'public/style.css',
      htmlSearch: '<div class="avatar-glow">',
      htmlEndSearch: '</div>',
      desc: 'Brand Robot Logo & Avatar Glow in Header'
    },
    brand: {
      names: ['brand', 'brand text', 'brand title', 'app title', 'jena title'],
      selector: '.brand',
      file: 'public/style.css',
      htmlSearch: '<div class="brand">',
      htmlEndSearch: '</div>\n      </div>',
      desc: 'Brand Info, Jena Title & Version Tag'
    },
    nav_tabs: {
      names: ['nav tabs', 'navigation tabs', 'tabs', 'tab bar', 'nav bar tabs', 'page tabs'],
      selector: '.nav-tabs',
      file: 'public/style.css',
      htmlSearch: '<nav class="nav-tabs">',
      htmlEndSearch: '</nav>',
      desc: 'Top Navigation Tabs (Chat vs Providers & Models)'
    },
    header_actions: {
      names: ['header actions', 'top actions', 'header buttons', 'top buttons'],
      selector: '.header-actions',
      file: 'public/style.css',
      htmlSearch: '<div class="header-actions">',
      htmlEndSearch: '</div>',
      desc: 'Header Actions & Controls Bar'
    },
    mode_switch: {
      names: ['mode switch', 'mode button', 'online offline switch', 'switch button', 'switch'],
      selector: '.mode-switch',
      file: 'public/style.css',
      htmlSearch: '<div class="mode-switch">',
      htmlEndSearch: '</div>',
      desc: 'Hybrid Mode Toggle Switch (Online vs Offline)'
    },
    active_model_bar: {
      names: ['active model bar', 'active model pill', 'engine bar', 'model bar'],
      selector: '.active-model-bar',
      file: 'public/style.css',
      htmlSearch: '<div class="active-model-bar">',
      htmlEndSearch: '</div>',
      desc: 'Active Model Info Banner & Link to Settings'
    },
    cwd_bar: {
      names: ['cwd bar', 'cwd status', 'cwd path', 'folder bar'],
      selector: '.cwd-status-bar',
      file: 'public/style.css',
      htmlSearch: '<div class="cwd-status-bar">',
      htmlEndSearch: '</div>',
      desc: 'Current Working Directory Status Bar with Quick Actions'
    },
    welcome_hero: {
      names: ['welcome hero', 'hero banner', 'welcome box', 'welcome section', 'hero'],
      selector: '.welcome-hero',
      file: 'public/style.css',
      htmlSearch: '<div class="welcome-hero"',
      htmlEndSearch: '</div>\n          </div>',
      desc: 'Welcome Hero Box with Greeting & Quick Prompt Action Chips'
    },
    chat_viewport: {
      names: ['chat viewport', 'chat stream', 'chat area', 'chat container', 'chat box'],
      selector: '.chat-viewport',
      file: 'public/style.css',
      htmlSearch: '<main class="chat-viewport"',
      htmlEndSearch: '</main>',
      desc: 'Scrollable Conversation Message Viewport'
    },
    message_bubble: {
      names: ['message bubble', 'message row', 'chat bubble', 'user bubble', 'assistant bubble'],
      selector: '.message-bubble',
      file: 'public/style.css',
      htmlSearch: '<div class="message-bubble"',
      htmlEndSearch: '</div>',
      desc: 'User & Assistant Chat Message Bubbles'
    },
    input_box: {
      names: ['input box', 'chat input', 'input wrapper', 'prompt input', 'footer', 'textarea'],
      selector: '.input-wrapper',
      file: 'public/style.css',
      htmlSearch: '<div class="input-wrapper">',
      htmlEndSearch: '</div>',
      desc: 'Bottom Prompt Input Field & Auto-resizing Textarea'
    },
    send_button: {
      names: ['send button', 'btn send', 'submit button', 'bhejo button'],
      selector: '.btn-send',
      file: 'public/style.css',
      htmlSearch: '<button type="submit" id="btnSend"',
      htmlEndSearch: '</button>',
      desc: 'Send Prompt Button with Neon Hover'
    },
    settings_card: {
      names: ['settings card', 'settings panel', 'config card', 'card'],
      selector: '.settings-card',
      file: 'public/style.css',
      htmlSearch: '<div class="settings-card',
      htmlEndSearch: '</div>\n        </div>',
      desc: 'Settings Panels (Providers, Keys, Custom Models, Memory, Logs)'
    },
    terminal_box: {
      names: ['terminal box', 'terminal preview', 'execution box'],
      selector: '.terminal-preview-box',
      file: 'public/style.css',
      htmlSearch: '<div id="opExecutionBox"',
      htmlEndSearch: '</div>',
      desc: 'Terminal Preview Box for Running Learned Operations'
    },
    modal: {
      names: ['modal', 'allowance modal', 'dialog', 'popup'],
      selector: '.modal-card',
      file: 'public/style.css',
      htmlSearch: '<div class="modal-card',
      htmlEndSearch: '</div>\n    </div>',
      desc: 'Token Allowance Budget Edit Popup Modal'
    },
    body: {
      names: ['body', 'page background', 'background', 'bg color', 'page color', 'page', 'screen', 'index.html'],
      selector: 'body',
      file: 'public/style.css',
      htmlSearch: '<body',
      htmlEndSearch: '</body>',
      desc: 'Application Body, Background & Base Page View'
    }
  };

  static findComponent(query) {
    const q = (query || '').toLowerCase();

    // 1. Direct CSS Selector or clean class name match (e.g. .app-header, app-header, avatar-glow)
    for (const key of Object.keys(this.COMPONENT_REGISTRY)) {
      const comp = this.COMPONENT_REGISTRY[key];
      const cleanSel = comp.selector.replace(/^[.#]/, '').toLowerCase();
      if (q.includes(comp.selector.toLowerCase()) || q.includes(cleanSel)) {
        return { key, ...comp };
      }
    }

    // 2. Direct alias matching
    for (const key of Object.keys(this.COMPONENT_REGISTRY)) {
      const comp = this.COMPONENT_REGISTRY[key];
      for (const name of comp.names) {
        if (q.includes(name)) return { key, ...comp };
      }
    }

    // 3. Fallback matching
    if (q.includes('logo') || q.includes('avatar') || q.includes('icon') || q.includes('robot')) return { key: 'logo', ...this.COMPONENT_REGISTRY.logo };
    if (q.includes('tab') || q.includes('nav')) return { key: 'nav_tabs', ...this.COMPONENT_REGISTRY.nav_tabs };
    if (q.includes('body') || q.includes('background') || q.includes('page background') || q.includes('bg color')) return { key: 'body', ...this.COMPONENT_REGISTRY.body };
    if (q.includes('token') || q.includes('cards')) return { key: 'token_card', ...this.COMPONENT_REGISTRY.token_card };
    if (q.includes('header') || q.includes('top bar') || q.includes('navbar')) return { key: 'header', ...this.COMPONENT_REGISTRY.header };
    if (q.includes('input') || q.includes('textarea')) return { key: 'input_box', ...this.COMPONENT_REGISTRY.input_box };
    if (q.includes('button') || q.includes('send') || q.includes('bhejo')) return { key: 'send_button', ...this.COMPONENT_REGISTRY.send_button };
    if (q.includes('hero') || q.includes('welcome')) return { key: 'welcome_hero', ...this.COMPONENT_REGISTRY.welcome_hero };
    if (q.includes('switch') || q.includes('mode')) return { key: 'mode_switch', ...this.COMPONENT_REGISTRY.mode_switch };
    if (q.includes('modal') || q.includes('dialog')) return { key: 'modal', ...this.COMPONENT_REGISTRY.modal };
    return null;
  }

  static extractCssRule(cssContent, selector) {
    const escapedSel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`(${escapedSel}[^{]*\\{[^}]*\\})`, 'gm');
    const matches = cssContent.match(blockRegex);
    return matches ? matches.join('\n\n') : null;
  }

  static updateCssRule(cssContent, selector, property, newValue) {
    const escapedSel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`(${escapedSel}\\s*\\{[^}]*\\})`, 'm');
    const match = cssContent.match(blockRegex);
    if (!match) return { success: false, error: `Selector "${selector}" CSS mein nahi mila.` };

    const oldBlock = match[1];
    let newBlock = oldBlock;
    const propRegex = new RegExp(`(\\b${property}\\s*:\\s*)([^;]+)(;)`, 'i');

    if (propRegex.test(oldBlock)) {
      const oldVal = oldBlock.match(propRegex)[2].trim();
      newBlock = oldBlock.replace(propRegex, `$1${newValue}$3`);
      const updatedCss = cssContent.replace(oldBlock, newBlock);
      return { success: true, updatedCss, selector, property, oldValue: oldVal, newValue, isNew: false };
    } else {
      const insertIdx = oldBlock.lastIndexOf('}');
      newBlock = oldBlock.slice(0, insertIdx).trimEnd() + `\n  ${property}: ${newValue};\n}`;
      const updatedCss = cssContent.replace(oldBlock, newBlock);
      return { success: true, updatedCss, selector, property, oldValue: null, newValue, isNew: true };
    }
  }

  static getLuminance(hexOrRgb) {
    if (!hexOrRgb) return 0;
    let r = 0, g = 0, b = 0;
    const clean = String(hexOrRgb).trim();
    if (clean.startsWith('#')) {
      const hex = clean.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    } else {
      const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1], 10);
        g = parseInt(rgbMatch[2], 10);
        b = parseInt(rgbMatch[3], 10);
      }
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  static parseBorderValue(input, existingRule = '') {
    const str = (input || '').toLowerCase();
    
    // Check if user wants no border
    if (/\b(?:none|no border|hata|khatam|remove|0px|0)\b/i.test(str)) {
      return 'none';
    }

    // 1. Extract Width (e.g. 2px, 1.5px, 3px, 1rem)
    let width = null;
    const widthMatch = input.match(/(\d+(?:\.\d+)?(?:px|rem|em))/i);
    if (widthMatch) {
      width = widthMatch[1];
    } else {
      const sizeDigitMatch = input.match(/(?:size|width|motai)\s+(\d+)/i);
      if (sizeDigitMatch) width = `${sizeDigitMatch[1]}px`;
    }

    // 2. Extract Style (solid, dashed, dotted, double, groove, ridge, inset, outset)
    let style = null;
    const styleMatch = input.match(/\b(solid|dashed|dotted|double|groove|ridge|inset|outset)\b/i);
    if (styleMatch) {
      style = styleMatch[1].toLowerCase();
    }

    // 3. Extract Color
    let color = null;
    const hexOrRgbMatch = input.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
    if (hexOrRgbMatch) {
      color = hexOrRgbMatch[1];
    } else {
      const colorMap = {
        cyan: '#00d2ff', green: '#10b981', sabz: '#10b981', purple: '#9d4edd', jamni: '#9d4edd',
        red: '#ef4444', surkh: '#ef4444', lal: '#ef4444', blue: '#3a7bd5', neela: '#3a7bd5',
        dark: '#0a0d14', black: '#000000', kala: '#000000', white: '#ffffff', safed: '#ffffff',
        gray: '#64748b', peach: '#f4d6c6', brown: '#6b2f2f', orange: '#f97316', yellow: '#eab308'
      };
      for (const [cName, hex] of Object.entries(colorMap)) {
        if (new RegExp(`\\b${cName}\\b`, 'i').test(input)) {
          color = hex;
          break;
        }
      }
    }

    // Check existing rule in CSS to preserve existing width/style/color if omitted
    let existingWidth = '1px';
    let existingStyle = 'solid';
    let existingColor = 'var(--border-color)';
    if (existingRule) {
      const exMatch = existingRule.match(/border(?:-bottom|-top|-left|-right)?\s*:\s*([^;]+);/i);
      if (exMatch) {
        const parts = exMatch[1].trim().split(/\s+/);
        if (parts[0] && /\d+(?:px|rem|em)/i.test(parts[0])) existingWidth = parts[0];
        if (parts[1] && /solid|dashed|dotted|double/i.test(parts[1])) existingStyle = parts[1];
        if (parts.length > 2) existingColor = parts.slice(2).join(' ');
      }
    }

    const finalWidth = width || (style || color ? existingWidth : '1px');
    const finalStyle = style || existingStyle;
    const finalColor = color || (width || style ? existingColor : 'var(--border-color)');

    return `${finalWidth} ${finalStyle} ${finalColor}`.trim();
  }

  static troubleshootChanges(query) {
    const cssPath = path.join(PUBLIC_DIR, 'style.css');
    let cssContent = fs.readFileSync(cssPath, 'utf8');
    let fixedIssues = [];

    // Check for corrupt border rules like "border: color ...;"
    const corruptBorder = cssContent.match(/border:\s*color\s*([^;]+);/i);
    if (corruptBorder) {
      const fixed = this.parseBorderValue(corruptBorder[1]);
      cssContent = cssContent.replace(corruptBorder[0], `border: ${fixed};`);
      fixedIssues.push(`Corrupt border rule theek ki: \`${corruptBorder[0]}\` ➔ \`border: ${fixed};\``);
    }

    // Check contrast if body background is light
    const bgMatch = cssContent.match(/--bg-primary:\s*([^;]+);/i);
    if (bgMatch) {
      const lum = this.getLuminance(bgMatch[1].trim());
      if (lum > 0.5) {
        const textMatch = cssContent.match(/--text-primary:\s*([^;]+);/i);
        if (textMatch && this.getLuminance(textMatch[1].trim()) > 0.5) {
          cssContent = cssContent.replace(/--text-primary:\s*[^;]+;/i, '--text-primary: #1e293b;');
          fixedIssues.push('Light background par readable text ke liye `--text-primary: #1e293b;` set kiya.');
        }
      }
    }

    fs.writeFileSync(cssPath, cssContent, 'utf8');

    let msg = `🛠️ **Styling & Page Visibility Diagnostic Report:**\n\n`;
    if (fixedIssues.length > 0) {
      msg += `Maine issues detect karke auto-fix kar diye hain:\n`;
      fixedIssues.forEach(iss => msg += `- ✅ ${iss}\n`);
      msg += `\n`;
    } else {
      msg += `CSS stylesheet syntax bilkul valid hai.\n\n`;
    }

    const headerRule = this.extractCssRule(cssContent, '.app-header') || '';

    msg += `📌 **Active CSS Configuration:**\n` +
           `- **Header Selector (\`.app-header\`):**\n\`\`\`css\n${headerRule}\n\`\`\`\n` +
           `- **Body Background:** \`${bgMatch ? bgMatch[1].trim() : '#0a0d14'}\`\n\n` +
           `🔄 **Page & Stylesheet Hard-Reload:** Browser ko live hard-reload signal bhej diya gaya hai taake latest CSS rules screen par nazar aa sakein!`;

    return msg;
  }

  static listComponents() {
    let out = `🧩 **Jena GUI Components Architecture & Knowledge Base (Offline • 0 Tokens):**\n\n` +
      `Main apne har frontend component ke HTML structure aur CSS styling se mukammal waqif hoon. Aap kisi bhi component ka code inspect kar sakte hain ya uski styling (size, padding, borders, background, radius, fonts) direct tabdeel karwa sakte hain:\n\n`;

    Object.keys(this.COMPONENT_REGISTRY).forEach((k, idx) => {
      const c = this.COMPONENT_REGISTRY[k];
      out += `${idx + 1}. 🔹 **${c.desc}**\n` +
             `   - **CSS Selector:** \`${c.selector}\`\n` +
             `   - **Aliases:** ${c.names.slice(0, 3).map(n => `\`${n}\``).join(', ')}\n\n`;
    });

    out += `💡 **Commands Examples:**\n` +
      `- 🔍 **Code Dekhna:** \`token cards ka code dikhao\` ya \`send button ka css batao\`\n` +
      `- 📏 **Size / Padding:** \`token cards ki padding 16px 20px kardo\` ya \`token cards ka size badhao\`\n` +
      `- 🔲 **Borders:** \`token cards ka border 2px solid cyan kardo\` ya \`border radius 16px kardo\`\n` +
      `- 🎨 **Colors & Background:** \`header ka background #070a14 kardo\` ya \`send button ka color #10b981 kardo\`\n` +
      `- 📝 **HTML Content:** \`html main replace "old text" with "new text"\``;
    return out;
  }

  static inspectComponent(query) {
    const q = (query || '').toLowerCase();
    if (q.includes('list') || q.includes('tamam') || q.includes('all')) {
      return this.listComponents();
    }

    const comp = this.findComponent(q);
    if (!comp) {
      return this.listComponents();
    }

    const cssPath = path.join(PUBLIC_DIR, 'style.css');
    const htmlPath = path.join(PUBLIC_DIR, 'index.html');
    let cssCode = 'CSS rule nahi mili.';
    let htmlCode = 'HTML snippet nahi mila.';
    let cssContent = '';

    if (fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf8');
      const rule = this.extractCssRule(cssContent, comp.selector);
      if (rule) cssCode = rule;
    }

    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      const startIdx = htmlContent.indexOf(comp.htmlSearch);
      if (startIdx !== -1) {
        let endIdx = htmlContent.indexOf(comp.htmlEndSearch, startIdx);
        if (endIdx !== -1) {
          endIdx += comp.htmlEndSearch.length;
          htmlCode = htmlContent.slice(startIdx, endIdx).trim();
          if (htmlCode.length > 1200) {
            htmlCode = htmlCode.slice(0, 1200) + '\n<!-- ... (truncated for brevity) -->';
          }
        }
      }
    }

    // Check if query is asking for a specific CSS property (e.g. "logo ka border color kya hay", "background kya hay")
    const isPropertyQuery = /(?:kya\s+hai|kya\s+hay|batao|check|kitna|kitni)\b/i.test(q) &&
      /(?:border|background|bg|color|text\s*color|padding|margin|radius|shadow|size|width|height|font)/i.test(q);

    if (isPropertyQuery && cssCode && cssCode !== 'CSS rule nahi mili.') {
      let propDetails = [];
      
      if (/border/i.test(q)) {
        const bMatch = cssCode.match(/border(?:-bottom|-top|-left|-right)?\s*:\s*([^;]+);/i);
        const bcMatch = cssCode.match(/border-color\s*:\s*([^;]+);/i);
        const brMatch = cssCode.match(/border-radius\s*:\s*([^;]+);/i);
        const bsMatch = cssCode.match(/box-shadow\s*:\s*([^;]+);/i);
        if (bMatch) propDetails.push(`- 🔲 **Border:** \`${bMatch[1].trim()}\``);
        if (bcMatch) propDetails.push(`- 🎨 **Border Color:** \`${bcMatch[1].trim()}\``);
        if (brMatch) propDetails.push(`- 📐 **Border Radius:** \`${brMatch[1].trim()}\``);
        if (bsMatch) propDetails.push(`- ✨ **Box Shadow / Glow:** \`${bsMatch[1].trim()}\``);
      }
      
      if (/background|bg/i.test(q)) {
        const bgMatch = cssCode.match(/background(?:-color)?\s*:\s*([^;]+);/i);
        if (bgMatch) propDetails.push(`- 🎨 **Background:** \`${bgMatch[1].trim()}\``);
      }
      
      if (/(?:text\s*color|font\s*color|\bcolor\b)/i.test(q) && !/border|background|bg/i.test(q)) {
        const cMatch = cssCode.match(/(?:^|[^-])color\s*:\s*([^;]+);/i);
        if (cMatch) propDetails.push(`- 🔤 **Text Color:** \`${cMatch[1].trim()}\``);
      }

      if (/padding/i.test(q)) {
        const pMatch = cssCode.match(/padding\s*:\s*([^;]+);/i);
        if (pMatch) propDetails.push(`- 📏 **Padding:** \`${pMatch[1].trim()}\``);
      }

      if (/width|size/i.test(q) && !/border/i.test(q)) {
        const wMatch = cssCode.match(/(?:max-)?width\s*:\s*([^;]+);/i);
        if (wMatch) propDetails.push(`- ↔️ **Width:** \`${wMatch[1].trim()}\``);
      }

      if (/height/i.test(q)) {
        const hMatch = cssCode.match(/(?:max-)?height\s*:\s*([^;]+);/i);
        if (hMatch) propDetails.push(`- ↕️ **Height:** \`${hMatch[1].trim()}\``);
      }

      if (propDetails.length > 0) {
        return (
          `🔍 **${comp.desc} (\`${comp.selector}\`) Property Details:**\n\n` +
          propDetails.join('\n') + '\n\n' +
          `📌 **Current CSS Rule:**\n\`\`\`css\n${cssCode}\n\`\`\``
        );
      }
    }

    if (comp.key === 'body') {
      const bgMatch = cssContent.match(/--bg-primary:\s*([^;]+);/i);
      const textMatch = cssContent.match(/--text-primary:\s*([^;]+);/i);
      const currentBg = bgMatch ? bgMatch[1].trim() : '#0a0d14';
      const currentText = textMatch ? textMatch[1].trim() : '#f8fafc';
      return (
        `🎨 **Application Body & Background Inspection:**\n\n` +
        `- 🖌️ **Current Background Color:** \`${currentBg}\` (Variable: \`--bg-primary\`)\n` +
        `- 🔤 **Current Text Color:** \`${currentText}\` (Variable: \`--text-primary\`)\n` +
        `- 📌 **CSS Selector:** \`body\` (File: \`public/style.css\`)\n\n` +
        `\`\`\`css\n${cssCode}\n\`\`\`\n\n` +
        `💡 **Background ya Color Tabdeel Karne Ki Misalein:**\n` +
        `- \`body ka color black kardo\` ya \`background black kardo\`\n` +
        `- \`body ka background #000000 kardo\`\n` +
        `- \`body ka text color white kardo\``
      );
    }

    return (
      `🔍 **Component Inspection: \`${comp.desc}\`**\n\n` +
      `📌 **CSS Selector:** \`${comp.selector}\` (File: \`public/style.css\`)\n` +
      `\`\`\`css\n${cssCode}\n\`\`\`\n\n` +
      `📄 **HTML Structure Snippet:** (File: \`public/index.html\`)\n` +
      `\`\`\`html\n${htmlCode}\n\`\`\`\n\n` +
      `🛠️ **Is component ko tabdeel karne ke liye misalein:**\n` +
      `- \`${comp.names[0]} ki padding 16px 20px kardo\`\n` +
      `- \`${comp.names[0]} ki width 20% kam kardo\`\n` +
      `- \`${comp.names[0]} ka border 2px solid cyan kardo\`\n` +
      `- \`${comp.names[0]} ka background #0f172a kardo\`\n` +
      `- \`${comp.names[0]} ki border radius 16px kardo\``
    );
  }

  static modifyComponent(query) {
    const q = (query || '').trim();
    const qLower = q.toLowerCase();

    // Check if asking for components list
    if (qLower.includes('list') || qLower.includes('tamam components')) {
      return this.listComponents();
    }

    // Check for HTML content replacement
    if (/html|text|content|title|heading/i.test(qLower) && (q.includes('replace') || q.includes('badal kar') || q.includes('tabdeel'))) {
      const htmlPath = path.join(PUBLIC_DIR, 'index.html');
      let htmlContent = fs.readFileSync(htmlPath, 'utf8');
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i) ||
                           q.match(/["']([^"']+)["']\s+(?:ko|se)\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!htmlContent.includes(oldStr)) {
          return `⚠️ Target text HTML mein nahi mila:\n\`${oldStr}\``;
        }
        htmlContent = htmlContent.replace(oldStr, newStr);
        fs.writeFileSync(htmlPath, htmlContent, 'utf8');
        return `✅ **HTML Content Updated Successfully!**\n- 🔄 **Replaced:** \`${oldStr}\`\n- 🎯 **With:** \`${newStr}\`\n\n🔄 **Dynamic Page Reload:** Browser reload ho raha hai!`;
      }
    }

    const comp = this.findComponent(qLower);
    if (!comp) {
      return this.editGui(query);
    }

    const cssPath = path.join(PUBLIC_DIR, 'style.css');
    if (!fs.existsSync(cssPath)) return `❌ Error: \`${cssPath}\` mojood nahi hai.`;
    let cssContent = fs.readFileSync(cssPath, 'utf8');

    // 0. Special Handling for Body & Page Background
    if (comp.key === 'body') {
      const colorValMatch = q.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
      let bgVal = colorValMatch ? colorValMatch[1].trim() : null;
      if (!bgVal) {
        const colorNames = {
          black: '#000000', kala: '#000000',
          white: '#ffffff', safed: '#ffffff',
          dark: '#0a0d14',
          cyan: '#00d2ff',
          blue: '#3a7bd5', neela: '#3a7bd5',
          green: '#10b981', sabz: '#10b981',
          purple: '#9d4edd', jamni: '#9d4edd',
          red: '#ef4444', surkh: '#ef4444', lal: '#ef4444',
          gray: '#64748b'
        };
        for (const [cName, hex] of Object.entries(colorNames)) {
          if (new RegExp(`\\b${cName}\\b`, 'i').test(q)) {
            bgVal = hex;
            break;
          }
        }
      }

      if (bgVal) {
        const isTextColor = /(?:text\s*color|font\s*color)\s+/i.test(q) && !/background|bg/i.test(q);
        if (isTextColor) {
          const res = this.updateCssRule(cssContent, 'body', 'color', bgVal);
          if (res.success) {
            fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
            return `✅ **Body Ka Text Color Updated!**\n` +
                   `- 🎯 **Selector:** \`body\`\n` +
                   `- 🎨 **New Text Color:** \`${bgVal}\`\n\n` +
                   `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
          }
        } else {
          let updatedCss = cssContent;
          const varRegex = /(--bg-primary:\s*)([^;]+)(;)/i;
          if (varRegex.test(updatedCss)) {
            updatedCss = updatedCss.replace(varRegex, `$1${bgVal}$3`);
          }
          const bodyBgRes = this.updateCssRule(updatedCss, 'body', 'background-color', bgVal);
          if (bodyBgRes.success) updatedCss = bodyBgRes.updatedCss;
          if (bgVal === '#000000') {
            const bgImgRes = this.updateCssRule(updatedCss, 'body', 'background-image', 'none');
            if (bgImgRes.success) updatedCss = bgImgRes.updatedCss;
          }

          // Auto-adjust text contrast based on background luminance
          const lum = this.getLuminance(bgVal);
          if (lum > 0.5) {
            // Light background: set dark readable text
            updatedCss = updatedCss.replace(/(--text-primary:\s*)([^;]+)(;)/i, '$1#1e293b$3');
            updatedCss = updatedCss.replace(/(--text-secondary:\s*)([^;]+)(;)/i, '$1#475569$3');
          } else {
            // Dark background: set light readable text
            updatedCss = updatedCss.replace(/(--text-primary:\s*)([^;]+)(;)/i, '$1#f8fafc$3');
            updatedCss = updatedCss.replace(/(--text-secondary:\s*)([^;]+)(;)/i, '$1#94a3b8$3');
          }

          fs.writeFileSync(cssPath, updatedCss, 'utf8');
          return `✅ **Application Body Ka Background Color Updated!**\n` +
                 `- 🎯 **Selector:** \`body\` / \`:root\`\n` +
                 `- 🎨 **New Background Color:** \`${bgVal}\` (${lum > 0.5 ? 'Light theme contrast applied' : 'Dark theme contrast applied'})\n\n` +
                 `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
        }
      }
    }

    // 0.5 Check for width change (e.g. "token cards ki width 20% kam kardo", "width 80%", "width barhao")
    const widthMatch = q.match(/(?:width|chaudai)\s+(?:([0-9]+%|[0-9]+px|[0-9]+rem)\s+)?(kam|ghata|chhoti|reduce|badha|barha|zyada|increase|kardo|rakho|set)/i) ||
                       q.match(/(?:width|chaudai)\s+([0-9a-z%pxrem!]+)/i);
    if (widthMatch) {
      let widthVal = (widthMatch[1] || widthMatch[2])?.trim();
      const pctMatch = q.match(/([0-9]+)%\s*(?:kam|ghata)/i);
      if (pctMatch) {
        const reduction = parseInt(pctMatch[1], 10);
        widthVal = `${Math.max(10, 100 - reduction)}%`;
      } else if (!widthVal || /kam|ghata|chhoti|reduce/i.test(widthVal)) {
        widthVal = '80%';
      } else if (/badha|barha|zyada|increase/i.test(widthVal)) {
        widthVal = '100%';
      }

      const res = this.updateCssRule(cssContent, comp.selector, 'max-width', widthVal);
      if (res.success) {
        let updated = res.updatedCss;
        if (comp.key === 'token_card') {
          const marginRes = this.updateCssRule(updated, comp.selector, 'margin', '0 auto');
          if (marginRes.success) updated = marginRes.updatedCss;
        }
        fs.writeFileSync(cssPath, updated, 'utf8');
        return `✅ **${comp.desc} Ki Width Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Max-Width:** \`${widthVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 0.6 Check for height change
    const heightMatch = q.match(/height\s+([0-9a-z%pxrem!]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (heightMatch) {
      const heightVal = heightMatch[1].trim();
      const res = this.updateCssRule(cssContent, comp.selector, 'height', heightVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Height Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Height:** \`${heightVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 1. Check for padding change
    const padMatch = q.match(/padding\s+([0-9a-z\s%pxrem!]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i) ||
                     q.match(/(?:size\s+barha|size\s+badha|bara\s+karo)/i);
    if (padMatch) {
      let padVal = padMatch[1]?.trim();
      if (!padVal || padMatch[0].includes('badha') || padMatch[0].includes('barha') || padMatch[0].includes('bara')) {
        padVal = '16px 20px';
      }
      const res = this.updateCssRule(cssContent, comp.selector, 'padding', padVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Padding Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Padding:** \`${padVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 2. Check for size chhota karo
    if (/size\s+chhota|chota\s+karo/i.test(qLower)) {
      const res = this.updateCssRule(cssContent, comp.selector, 'padding', '8px 10px');
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Size Chhota Kar Diya Gaya!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Padding:** \`8px 10px\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 3. Check for border-radius / corners
    const radiusMatch = q.match(/(?:border-?radius|radius|corners?)\s+([^\n;]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (radiusMatch) {
      const radiusVal = radiusMatch[1].trim();
      const res = this.updateCssRule(cssContent, comp.selector, 'border-radius', radiusVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Border Radius Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📐 **New Border Radius:** \`${radiusVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 4. Check for border (with style, width, or color)
    if (/(?:border|boundary)\b/i.test(q) && !/radius|corner/i.test(q)) {
      const existingRule = this.extractCssRule(cssContent, comp.selector) || '';
      const borderVal = this.parseBorderValue(q, existingRule);
      const res = this.updateCssRule(cssContent, comp.selector, 'border', borderVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Border Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🔲 **New Border:** \`${borderVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 6. Check for background color / gradient
    const bgMatch = q.match(/(?:background(?:-color)?|bg)\s+([^\n;]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (bgMatch) {
      let bgVal = bgMatch[1].trim();
      const colorMap = {
        cyan: '#00d2ff', green: '#10b981', sabz: '#10b981', purple: '#9d4edd', jamni: '#9d4edd',
        red: '#ef4444', surkh: '#ef4444', lal: '#ef4444', blue: '#3a7bd5', neela: '#3a7bd5',
        dark: '#0a0d14', black: '#000000', kala: '#000000', white: '#ffffff', safed: '#ffffff', gray: '#64748b'
      };
      if (colorMap[bgVal.toLowerCase()]) bgVal = colorMap[bgVal.toLowerCase()];
      const res = this.updateCssRule(cssContent, comp.selector, 'background', bgVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Background Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🎨 **New Background:** \`${bgVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 7. Check for text color
    const colorMatch = q.match(/(?:text\s*color|color)\s+([^\n;]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (colorMatch) {
      let cVal = colorMatch[1].trim();
      const colorMap = {
        cyan: '#00d2ff', green: '#10b981', sabz: '#10b981', purple: '#9d4edd', jamni: '#9d4edd',
        red: '#ef4444', surkh: '#ef4444', lal: '#ef4444', blue: '#3a7bd5', neela: '#3a7bd5',
        white: '#ffffff', safed: '#ffffff', black: '#000000', kala: '#000000', gray: '#64748b'
      };
      if (colorMap[cVal.toLowerCase()]) cVal = colorMap[cVal.toLowerCase()];
      const res = this.updateCssRule(cssContent, comp.selector, 'color', cVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Text Color Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🎨 **New Color:** \`${cVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 8. Check for font-size
    const fontMatch = q.match(/(?:font-?size|font)\s+([0-9]+(?:px|rem|em))/i);
    if (fontMatch) {
      const fVal = fontMatch[1].trim();
      const res = this.updateCssRule(cssContent, comp.selector, 'font-size', fVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Font Size Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🔤 **New Font Size:** \`${fVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    return `💡 **${comp.desc} Modification Options:**\n` +
      `- Padding/Size: \`${comp.names[0]} ki padding 16px 20px kardo\` ya \`size badhao\`\n` +
      `- Border: \`${comp.names[0]} ka border 2px solid cyan kardo\` ya \`border radius 16px kardo\`\n` +
      `- Background: \`${comp.names[0]} ka background #0f172a kardo\`\n` +
      `- Color: \`${comp.names[0]} ka color white kardo\`\n` +
      `- Font Size: \`${comp.names[0]} ka font-size 16px kardo\``;
  }

  // --- OFFLINE WEB DEVELOPMENT & GUI EXPLANATION / EDITING ENGINE ---
  static explainGui(query) {
    const q = (query || '').toLowerCase();

    // Specific Target: Token Dashboard / Token Cards
    if (/(?:token\s*(?:dashboard|cards?)|cards?\s*ka\s*size|dashboard\s*cards?|token\s*card)/i.test(q)) {
      return (
        `📊 **Jena Token Dashboard Cards: Dimensions, Layout & Size Breakdown**\n\n` +
        `Mera Token Dashboard 4 live metrics cards par mushtamil hai jo \`public/style.css\` aur \`public/index.html\` mein define hain:\n\n` +
        `### 1. 📐 Layout & Dimensions (\`public/style.css\`)\n` +
        `- **Grid Container (\`.token-dashboard\`):**\n` +
        `  * **Display Engine:** \`display: grid;\`\n` +
        `  * **Desktop Columns:** \`grid-template-columns: repeat(4, 1fr);\` (4 barabar responsive columns, poori viewport width 100% cover karti hain)\n` +
        `  * **Gap:** \`gap: 10px;\` (cards ke darmiyan 10px spacing)\n` +
        `  * **Margin:** \`margin-top: 12px; flex-shrink: 0;\`\n` +
        `  * **Mobile Screen (\`@media max-width: 768px\`):** \`grid-template-columns: repeat(2, 1fr);\` (chhoti mobile screen par 2x2 grid ban jata hai)\n\n` +
        `- **Card Size & Box Model (\`.token-card\`):**\n` +
        `  * **Internal Padding:** \`padding: 10px 14px;\` (top/bottom: 10px, left/right: 14px)\n` +
        `  * **Border:** \`1px solid var(--border-color);\` (subtle neon boundary)\n` +
        `  * **Border Radius:** \`var(--radius-md);\` (10px rounded corners)\n` +
        `  * **Background Surface:** Glassmorphic \`var(--bg-card);\` with \`backdrop-filter: blur(12px);\`\n` +
        `  * **Rendered Height:** Taqreeban ~68px se 72px (content aur font metrics ke hisab se dynamically fit hota hai)\n\n` +
        `### 2. 🎴 4 Token Cards Ka Maqsad:\n` +
        `1. 🎯 **ALLOWANCE (\`#cardAllowance\`):** Total token budget allowance. Yeh card clickable hai (\`cursor: pointer\`), jis par click karke modal se budget set kiya ja sakta hai.\n` +
        `2. 📈 **USED TOKENS (\`#valUsed\`):** Ab tak prompts aur responses mein kharch shuda total tokens.\n` +
        `3. 💰 **BALANCE (\`#valBalance\`):** Baaqi tokens ka hisab (\`Allowance - Used\`).\n` +
        `4. ⚡ **PROMPT SPEED (\`#valSpeed\`):** Generation speed (\`tokens per second / t/s\`).\n\n` +
        `### 3. 🔤 Card Typography & Font Sizes:\n` +
        `- **Label (\`.token-label\`):** \`font-size: 10px; font-weight: 700; letter-spacing: 0.6px; color: var(--text-muted);\`\n` +
        `- **Value (\`.token-val\`):** \`font-size: 17px; font-weight: 700; font-family: 'JetBrains Mono', monospace;\`\n` +
        `- **Unit (\`.unit\`):** \`font-size: 11px; font-weight: 500;\`\n` +
        `- **Subtext (\`.token-sub\`):** \`font-size: 10px; color: var(--text-muted);\`\n\n` +
        `*(Agar aap inka size, padding, ya font badalna chahein to mujhe bolein, jaise: \`css main token card padding 14px 18px kardo\`)*`
      );
    }

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

    // If query targets a specific component, route to modifyComponent
    const comp = this.findComponent(q);
    if (comp && !/^(?:replace|badlo)/i.test(q)) {
      return this.modifyComponent(query);
    }

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
        return `✅ **CSS Updated Successfully!**\nReplaced in \`public/style.css\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
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
          return `✅ **Jena GUI CSS Variable Updated!**\n- 🎯 **Updated:** \`${newLine}\`\n- 🔄 **Previous:** \`${oldLine}\`\n\n⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
        }
      }

      // 3. Append custom CSS rule: e.g. "css main yeh add karo: .my-class { ... }"
      const addMatch = q.match(/(?:add|shamil|likho|dalo)[:\s]+(.+)$/is);
      if (addMatch) {
        const newCss = addMatch[1].trim().replace(/^```css\s*|^```\s*|```$/g, '');
        content = content.trimEnd() + `\n\n/* Custom User Added Style */\n${newCss}\n`;
        fs.writeFileSync(cssPath, content, 'utf8');
        return `✅ **Custom CSS Rule Added to \`public/style.css\`!**\n\`\`\`css\n${newCss}\n\`\`\`\n\n⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
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
        return `✅ **HTML Updated Successfully!**\nReplaced in \`public/index.html\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n🔄 **Dynamic Page Reload:** Browser reload ho raha hai!`;
      }
      return `💡 HTML edit karne ke liye: \`index.html main change karo: replace "old text" with "new text"\``;
    }

    // Check if targeting JS / app.js
    if (/app\.js|javascript|\bjs\b/i.test(q)) {
      const jsPath = path.join(PUBLIC_DIR, 'app.js');
      if (!fs.existsSync(jsPath)) return `❌ Error: \`${jsPath}\` mojood nahi hai.`;
      let content = fs.readFileSync(jsPath, 'utf8');
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i) ||
                           q.match(/badlo\s+["']([^"']+)["']\s+ko\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!content.includes(oldStr)) {
          return `⚠️ Target content JavaScript mein nahi mila:\n\`${oldStr}\``;
        }
        const updated = content.replace(oldStr, newStr);
        // Syntax validation check before saving
        try {
          const vm = require('vm');
          new vm.Script(updated);
        } catch (syntaxErr) {
          return `❌ **JavaScript Syntax Validation Failed:**\nIs tabdeeli ke baad \`app.js\` mein syntax error aa jayega:\n\`${syntaxErr.message}\`\nFile save nahi ki gayi taake GUI crash na ho.`;
        }
        fs.writeFileSync(jsPath, updated, 'utf8');
        return `✅ **JavaScript Updated Successfully!**\nReplaced in \`public/app.js\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n🔄 **Dynamic Page Reload:** Browser reload ho raha hai!`;
      }
      return `💡 JavaScript edit karne ke liye: \`app.js main change karo: replace "old code" with "new code"\``;
    }

    return `⚠️ Barah-e-karam target batayein: CSS, HTML, ya JS (e.g. \`css main background color #030712 kardo\` ya \`token cards ki padding 16px 20px kardo\`).`;
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
    const recentConvs = LogManager.getRecentConversations(6).reverse();
    const messages = [
      { role: 'system', content: this.getEffectiveSystemPrompt() }
    ];
    for (const c of recentConvs) {
      if (c && c.user && c.assistant) {
        messages.push({ role: 'user', content: c.user });
        const shortReply = c.assistant.length > 500 ? c.assistant.slice(0, 500) + '...' : c.assistant;
        messages.push({ role: 'assistant', content: shortReply });
      }
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || 'Koi response nahi mila.';
    // Strip any leaked reasoning/thought tags or drafts if present
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const promptTokens = data.usage?.prompt_tokens || Math.round(prompt.length / 4);
    const completionTokens = data.usage?.completion_tokens || Math.round(text.length / 4);

    return { text, promptTokens, completionTokens };
  }

  static async callGemini(model, apiKey, prompt, temperature, maxTokens) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const recentConvs = LogManager.getRecentConversations(6).reverse();
    const contents = [];
    for (const c of recentConvs) {
      if (c && c.user && c.assistant) {
        contents.push({ role: 'user', parts: [{ text: c.user }] });
        const shortReply = c.assistant.length > 500 ? c.assistant.slice(0, 500) + '...' : c.assistant;
        contents.push({ role: 'model', parts: [{ text: shortReply }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: this.getEffectiveSystemPrompt() }] },
        contents,
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
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Koi response nahi mila.';
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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

    // Helper to resolve safe editor path (defaults to project dir: __dirname)
    const resolveEditorPath = (reqPath) => {
      if (!reqPath) return __dirname;
      let clean = reqPath.trim();
      let resolved;
      if (path.isAbsolute(clean)) {
        resolved = path.normalize(clean);
      } else {
        resolved = path.normalize(path.join(__dirname, clean));
      }
      const homeBoundary = '/data/data/com.termux/files/home';
      if (!resolved.startsWith(homeBoundary) && !resolved.startsWith(__dirname)) {
        throw new Error('Access Denied: Path outside allowed workspace');
      }
      return resolved;
    };

    // GET /api/editor/tree (Recursive/deep tree for File Explorer)
    if (pathname === '/api/editor/tree' && method === 'GET') {
      try {
        const reqDir = parsedUrl.searchParams.get('dir') || '';
        const targetDir = resolveEditorPath(reqDir);
        if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
          return sendJson(404, { error: `Directory '${reqDir}' not found.` });
        }

        const buildTree = (dir, depth = 0) => {
          if (depth > 3) return [];
          let items = [];
          try {
            items = fs.readdirSync(dir, { withFileTypes: true });
          } catch (_) {
            return [];
          }

          const ignored = ['.git', 'node_modules', '.cache', '.gemini', '.hermes'];
          const result = [];

          items.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });

          for (const item of items) {
            if (ignored.includes(item.name)) continue;
            const fullPath = path.join(dir, item.name);
            const relPath = path.relative(__dirname, fullPath);
            const isDir = item.isDirectory();

            let size = 0;
            if (!isDir) {
              try { size = fs.statSync(fullPath).size; } catch (_) {}
            }

            result.push({
              name: item.name,
              path: relPath,
              fullPath,
              isDir,
              size,
              children: isDir ? buildTree(fullPath, depth + 1) : null
            });
          }
          return result;
        };

        const tree = buildTree(targetDir, 0);
        return sendJson(200, {
          success: true,
          root: targetDir,
          name: path.basename(targetDir),
          relativeRoot: path.relative(__dirname, targetDir) || '.',
          items: tree
        });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // GET /api/editor/file (Load any text file for editing)
    if (pathname === '/api/editor/file' && method === 'GET') {
      try {
        const requested = (parsedUrl.searchParams.get('file') || 'public/style.css').trim();
        const targetPath = resolveEditorPath(requested);

        if (!fs.existsSync(targetPath)) {
          return sendJson(404, { error: `File '${requested}' not found.` });
        }
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
          return sendJson(400, { error: `'${requested}' is a folder, not a file.` });
        }
        if (stats.size > 2 * 1024 * 1024) {
          return sendJson(400, { error: 'File size too large for browser editor (> 2MB).' });
        }

        const content = fs.readFileSync(targetPath, 'utf8');
        return sendJson(200, {
          success: true,
          file: path.relative(__dirname, targetPath),
          fullPath: targetPath,
          basename: path.basename(targetPath),
          content,
          size: stats.size,
          modified: stats.mtime
        });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/editor/save (Save any file with hot-reload trigger)
    if (pathname === '/api/editor/save' && method === 'POST') {
      try {
        const body = await parseBody();
        const requested = (body.file || '').trim();
        if (!requested) return sendJson(400, { error: 'File path is required.' });
        const content = body.content;
        if (typeof content !== 'string') return sendJson(400, { error: 'Content string is required.' });

        const targetPath = resolveEditorPath(requested);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf8');
        const stats = fs.statSync(targetPath);
        const bName = path.basename(targetPath);
        const rel = path.relative(__dirname, targetPath);

        let reloadTarget = 'none';
        if (rel.startsWith('public') || targetPath.includes('/public/')) {
          if (bName.endsWith('.css')) reloadTarget = 'css';
          else if (bName.endsWith('.html') || bName.endsWith('.js')) reloadTarget = 'page';
        }

        return sendJson(200, {
          success: true,
          message: `'${bName}' save ho gaya!`,
          file: rel,
          fullPath: targetPath,
          size: stats.size,
          reloadTarget
        });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/editor/create-file
    if (pathname === '/api/editor/create-file' && method === 'POST') {
      try {
        const body = await parseBody();
        const requested = (body.path || '').trim();
        if (!requested) return sendJson(400, { error: 'File path is required.' });

        const targetPath = resolveEditorPath(requested);
        if (fs.existsSync(targetPath)) {
          return sendJson(400, { error: `File '${path.basename(targetPath)}' pehle se mojood hai.` });
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, body.content || '', 'utf8');

        return sendJson(200, {
          success: true,
          message: `Nayi file '${path.basename(targetPath)}' ban gayi!`,
          file: path.relative(__dirname, targetPath),
          fullPath: targetPath
        });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/editor/create-folder
    if (pathname === '/api/editor/create-folder' && method === 'POST') {
      try {
        const body = await parseBody();
        const requested = (body.path || '').trim();
        if (!requested) return sendJson(400, { error: 'Folder path is required.' });

        const targetPath = resolveEditorPath(requested);
        if (fs.existsSync(targetPath)) {
          return sendJson(400, { error: `Folder '${path.basename(targetPath)}' pehle se mojood hai.` });
        }

        fs.mkdirSync(targetPath, { recursive: true });
        return sendJson(200, {
          success: true,
          message: `Naya folder '${path.basename(targetPath)}' ban gaya!`,
          folder: path.relative(__dirname, targetPath),
          fullPath: targetPath
        });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // POST /api/editor/delete
    if (pathname === '/api/editor/delete' && method === 'POST') {
      try {
        const body = await parseBody();
        const requested = (body.path || '').trim();
        if (!requested) return sendJson(400, { error: 'Path is required.' });

        const targetPath = resolveEditorPath(requested);
        if (targetPath === __dirname || targetPath === '/data/data/com.termux/files/home') {
          return sendJson(400, { error: 'Root directory delete nahi ki ja sakti.' });
        }
        if (!fs.existsSync(targetPath)) {
          return sendJson(404, { error: 'File ya folder mojood nahi hai.' });
        }

        fs.rmSync(targetPath, { recursive: true, force: true });
        return sendJson(200, {
          success: true,
          message: `'${path.basename(targetPath)}' delete kardiya gaya.`
        });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // GET /api/git/status
    if (pathname === '/api/git/status' && method === 'GET') {
      try {
        const projectDir = __dirname;
        const data = await new Promise((resolve, reject) => {
          exec('git status -s -b && echo "---GIT_DELIM---" && git log -n 1 --oneline', { cwd: projectDir }, (err, stdout) => {
            if (err) return reject(err);
            const parts = (stdout || '').split('---GIT_DELIM---');
            const statusOutput = (parts[0] || '').trim();
            const lastCommitLine = (parts[1] || '').trim();

            const lines = statusOutput.split('\n');
            const branchLine = lines[0] || '';
            const modifiedFiles = [];

            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line) {
                const status = line.slice(0, 2).trim();
                const file = line.slice(2).trim();
                modifiedFiles.push({ status, file });
              }
            }

            let branch = 'master';
            let ahead = 0;
            let behind = 0;
            const bMatch = branchLine.match(/^##\s+([^\s\.]+)(?:\.\.\.([^\s]+))?(?:\s+\[(?:ahead\s+(\d+))?(?:,\s*)?(?:behind\s+(\d+))?\])?/);
            if (bMatch) {
              branch = bMatch[1] || 'master';
              if (bMatch[3]) ahead = parseInt(bMatch[3], 10);
              if (bMatch[4]) behind = parseInt(bMatch[4], 10);
            }

            resolve({
              branch,
              ahead,
              behind,
              clean: modifiedFiles.length === 0,
              modifiedCount: modifiedFiles.length,
              modifiedFiles,
              lastCommit: lastCommitLine,
              rawStatus: statusOutput
            });
          });
        });
        return sendJson(200, data);
      } catch (err) {
        return sendJson(500, { error: err.message });
      }
    }

    // POST /api/git/commit-push
    if (pathname === '/api/git/commit-push' && method === 'POST') {
      try {
        const body = await parseBody();
        const message = (body.message || '').trim() || `Update via Jena UI: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`;
        const push = body.push !== false;
        const result = await LocalEngine.gitCommitAndPush(message, push);
        return sendJson(200, { success: true, message: result });
      } catch (err) {
        return sendJson(500, { error: err.message });
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

        if (!isErr && localResponse) {
          const intentType = typeof localIntent === 'object' ? localIntent.type : localIntent;
          if (intentType === 'open_editor') {
            sendEvent({ type: 'switch_tab', tab: 'editor' });
          } else if (intentType === 'cd' || (intentType === 'terminal_exec' && /^cd(\s+.*)?$/i.test(localIntent.command))) {
            sendEvent({ type: 'cwd_changed', cwd: LocalEngine.getCwd() });
          } else if (intentType === 'reload_page' || intentType === 'troubleshoot_changes') {
            sendEvent({ type: 'hot_reload', target: 'page' });
          } else if (intentType === 'modify_component') {
            const isHtml = /HTML Content Updated/i.test(localResponse);
            sendEvent({ type: 'hot_reload', target: isHtml ? 'page' : 'css' });
          } else if (intentType === 'edit_gui') {
            const isPage = /HTML Updated|app\.js/i.test(localResponse);
            const isCss = /CSS Updated|CSS Variable|CSS Rule/i.test(localResponse);
            if (isPage) {
              sendEvent({ type: 'hot_reload', target: 'page' });
            } else if (isCss) {
              sendEvent({ type: 'hot_reload', target: 'css' });
            }
          }
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
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
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
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          return fs.createReadStream(indexFile).pipe(res);
        }
        res.writeHead(404);
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  🤖 JENA v0.3 — Autonomous Hybrid AI Agent`);
    console.log(`  Local URL:   http://localhost:${PORT}`);
    console.log(`  Network URL: http://0.0.0.0:${PORT}`);
    console.log(`======================================================\n`);
    exec(`termux-open-url http://localhost:${PORT} 2>/dev/null || xdg-open http://localhost:${PORT} 2>/dev/null || true`, () => {});
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
  if (!query || args.includes('--gui') || query === 'gui' || query === 'server' || query === 'start') {
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
