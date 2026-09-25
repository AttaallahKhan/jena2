/**
 * =====================================================================
 *  🌐 JENA v0.3 — Cloud AI Engine & Test Engine
 * =====================================================================
 */

const os = require('os');
const { ConfigManager, MemoryManager, TokenTracker, DEFAULT_PROVIDERS } = require('../config');
const { LogManager } = require('../logger');
const { JENA_SYSTEM_PROMPT } = require('../persona');
const { LocalEngine } = require('./local');
const { EvolutionEngine } = require('./evolution');

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
        let result;
        if (provider === 'gemini' || providerConfig.type === 'gemini') {
          result = await this.callGemini(model, apiKey, prompt, temp, maxTokens);
        } else {
          // Groq, OpenAI, or custom OpenAI-compatible endpoint
          const endpoint = providerConfig.endpoint || DEFAULT_PROVIDERS.groq.endpoint;
          result = await this.callOpenAiCompatible(endpoint, model, apiKey, prompt, temp, maxTokens);
        }

        const distilled = this.distillOnlineKnowledge(result.text, prompt);
        const elapsedMs = Date.now() - startTime;
        const tokenStats = TokenTracker.recordUsage(result.promptTokens, result.completionTokens, elapsedMs);

        return {
          text: distilled.text,
          stats: tokenStats,
          provider,
          model,
          distilledOp: distilled.distilledOp,
          distilledFact: distilled.distilledFact
        };
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

  static distillOnlineKnowledge(text, userPrompt) {
    let cleanText = text || '';
    const event = EvolutionEngine.distillOnlineKnowledge(userPrompt, cleanText, LocalEngine.getCwd());
    let distilledOp = null;
    let distilledFact = null;

    if (event) {
      if (event.type === 'OPERATION_DISTILLED') {
        distilledOp = event;
        // Clean tag if present
        cleanText = cleanText.replace(/\[LEARNED_OP:\s*[^\]]+?\]/i, '').trim();
        cleanText += `\n\n*(💡 **Offline Skill Learned (via Internal Engineer):** Jena ne is process ko apni offline memory \`~/.jena/memory.json\` mein save kar liya hai! Ab aap offline 0 tokens par \`${event.trigger.split('|')[0]}\` likh kar isay chala sakte hain.)*`;
      } else if (event.type === 'FACT_DISTILLED') {
        distilledFact = event;
        cleanText = cleanText.replace(/\[LEARNED_FACT:\s*[^\]]+?\]/i, '').trim();
        cleanText += `\n\n*(💡 **Fact Remembered (via Internal Engineer):** Jena ne yeh maloomat apni offline memory \`~/.jena/memory.json\` mein save kar li hai.)*`;
      }
    }

    return { text: cleanText, distilledOp, distilledFact };
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

module.exports = { CloudEngine, TestEngine };
