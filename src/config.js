/**
 * =====================================================================
 *  ⚙️ JENA v0.3 — Config & Persistent Memory Manager
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');

const HOME_DIR = process.env.HOME || '/data/data/com.termux/files/home';
const PHONE_DIR = '/storage/emulated/0/termux-to-phone';
const JENA_DIR = path.join(HOME_DIR, '.jena');
const CONFIG_FILE = path.join(JENA_DIR, 'config.json');
const MEMORY_FILE = path.join(JENA_DIR, 'memory.json');
const CONVERSATION_LOG_FILE = path.join(JENA_DIR, 'conversation.jsonl');
const FAILURE_LOG_FILE = path.join(JENA_DIR, 'failures.log');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = parseInt(process.env.PORT || '8080', 10);
const BIN_TARGET = '/data/data/com.termux/files/usr/bin/jena';

// --- PROVIDERS & MODELS REGISTRY ---
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
        lastPromptSpeed: 0
      },
      keys: {
        groq: [],
        gemini: [],
        openai: []
      },
      modelKeys: {},
      customProviders: {},
      customModels: {}
    };

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
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

    if (cfg.customProviders && typeof cfg.customProviders === 'object') {
      Object.entries(cfg.customProviders).forEach(([pid, pData]) => {
        combined[pid] = { ...pData };
      });
    }

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
    let q = query.trim().toLowerCase();
    q = q.replace(/^(?:run\s+op\s+|op\s+|run\s+|chalao\s+)/i, '').trim();
    if (!q) return null;

    const stopWords = new Set([
      'karo', 'kardo', 'karein', 'hai', 'hay', 'hoon', 'ya', 'nahi', 'to', 'agar',
      'aur', 'and', 'mein', 'main', 'se', 'ko', 'ka', 'ki', 'ke', 'the', 'a', 'an',
      'is', 'in', 'or', 'zara', 'please', 'batao', 'dikhao'
    ]);

    const cleanStr = s => (s || '').toLowerCase().replace(/[,!?;:\(\)\[\]"\x27]/g, ' ').replace(/\s+/g, ' ').trim();
    const getKeywords = s => cleanStr(s).split(' ').filter(w => w.length > 1 && !stopWords.has(w));

    const qClean = cleanStr(q);
    const qWords = getKeywords(q);
    const mem = this.load();

    return (mem.learned_operations || []).find(o => {
      if (!o || !o.trigger) return false;
      const triggers = o.trigger.toLowerCase().split('|').map(t => t.trim()).filter(Boolean);

      for (const trig of triggers) {
        const tClean = cleanStr(trig);

        // 1. Exact match
        if (qClean === tClean) return true;

        // 2. Starts with / prefix match in either direction
        if (qClean.startsWith(tClean + ' ') || tClean.startsWith(qClean + ' ') || tClean.startsWith(qClean)) {
          return true;
        }

        // 3. Substring inclusion if substantial length (>= 6 chars)
        if (qClean.length >= 6 && tClean.includes(qClean)) return true;
        if (tClean.length >= 6 && qClean.includes(tClean)) return true;

        // 4. Keyword overlap (>= 75% match of significant keywords)
        if (qWords.length >= 2) {
          const tWords = getKeywords(trig);
          if (tWords.length >= 2) {
            const matchedWords = qWords.filter(w => tWords.includes(w));
            if (matchedWords.length / qWords.length >= 0.75) {
              return true;
            }
          }
        }
      }
      return false;
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

module.exports = {
  HOME_DIR,
  PHONE_DIR,
  JENA_DIR,
  CONFIG_FILE,
  MEMORY_FILE,
  CONVERSATION_LOG_FILE,
  FAILURE_LOG_FILE,
  PUBLIC_DIR,
  PORT,
  BIN_TARGET,
  DEFAULT_PROVIDERS,
  PROVIDERS: DEFAULT_PROVIDERS,
  ConfigManager,
  MemoryManager,
  TokenTracker,
  getRotatedKey
};
