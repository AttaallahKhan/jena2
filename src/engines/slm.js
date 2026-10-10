/**
 * =====================================================================
 *  🧠 JENA v0.3 — Local SLM Intelligence Engine (Qwen / Llama GGUF)
 * =====================================================================
 *  Provides high-speed local inference via persistent llama serve daemon
 *  (sub-2s latency) with automatic CLI fallback.
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { HOME_DIR } = require('../config');
const { DeviceTools } = require('../tools/device');
const { SystemTools } = require('../tools/system');
const { TerminalTools } = require('../tools/terminal');
const { FsTools } = require('../tools/fs');

const SLM_SERVER_PORT = 8085;
const SLM_SERVER_URL = `http://127.0.0.1:${SLM_SERVER_PORT}`;

class SlmEngine {
  static daemonProcess = null;

  static getLlamaBin() {
    const candidate = path.join(HOME_DIR, '.llama-app', 'llama');
    if (fs.existsSync(candidate)) return candidate;
    return null;
  }

  static getModelPath() {
    const candidates = [
      path.join(HOME_DIR, 'qwen2.5-1.5b-instruct-q4_k_m.gguf'),
      path.join(HOME_DIR, 'qwen2.5-3b-instruct-q4_k_m.gguf'),
      path.join(HOME_DIR, 'Llama-3.2-1B-Instruct-Q4_K_M.gguf'),
      path.join(HOME_DIR, '.jena', 'models', 'qwen2.5-1.5b-instruct-q4_k_m.gguf')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  static isAvailable() {
    return false;
  }

  static getModelName() {
    return 'None (Ultra-Fast Regex Engine Active)';
  }

  static getSystemPrompt() {
    return `You are Jena AI Intent Classifier.
Map user intent (in Roman Urdu, Urdu, or English) to a single JSON action:
- {"action": "change_dir", "path": "<dir>"} -> navigate or enter directory (e.g. "jena main jao" -> path: "jena", "home mein jao" -> path: "home", "public folder mein jao" -> path: "public")
- {"action": "delete_item", "path": "<path>"} -> delete file or folder (e.g. "jena-ui delete karo" -> path: "jena-ui", "file mita do")
- {"action": "list_files", "path": "<dir>"} -> list directory contents (e.g. "public folder list karo" -> path: "public", "files dikhao")
- {"action": "torch_on"} -> turn ON flashlight / torch / bati jalana
- {"action": "torch_off"} -> turn OFF flashlight / torch / bati bujhana / band karna
- {"action": "camera_selfie"} -> take front camera selfie
- {"action": "camera_photo"} -> take back camera photo
- {"action": "bluetooth"} -> check bluetooth status
- {"action": "battery"} -> check battery status
- {"action": "ram"} -> check RAM / memory
- {"action": "storage"} -> check storage / disk space
- {"action": "system_info"} -> check kernel / system / uname
- {"action": "listening_ports"} -> check listening / open network ports
- {"action": "whoami"} -> check current user identity
- {"action": "top_process"} -> check running processes
- {"action": "check_mode"} -> check current mode, active model, or status (e.g. "tum konse model par chal rahi ho", status kya hai)
- {"action": "capabilities"} -> what can you do, tum kya kar sakti ho, help, madad, features
- {"action": "generate_code"} -> write code, python, javascript, bash, script, likho, create program
- {"action": "show_memory"} -> show learned operations / memory
- {"action": "query_facts"} -> user name, son name, or family facts
- {"action": "terminal_exec", "command": "<cmd>"} -> execute specific terminal command
- {"action": "chat", "reply": "<short reply>"} -> general conversation or question

Reply ONLY valid JSON.`;
  }

  static async ensureDaemonRunning() {
    return false;
  }

  static async inferViaHttp(userQuery) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${SLM_SERVER_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: userQuery.trim() }
          ],
          temperature: 0.1,
          max_tokens: 60
        })
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return { ...parsed, duration, via: 'daemon' };
        } catch (_) {}
      }
      return { action: 'unknown', raw: content.trim(), duration, via: 'daemon' };
    } catch (_) {
      return null;
    }
  }

  static async generateDirectly(userQuery) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${SLM_SERVER_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are Jena, an autonomous AI assistant running locally on Termux Linux (Android). Understand Roman Urdu and English. When asked to write code, provide clean, working code. Answer helpfully and concisely in Roman Urdu or English.'
            },
            { role: 'user', content: userQuery.trim() }
          ],
          temperature: 0.3,
          max_tokens: 350
        })
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      if (content.trim()) {
        return `🧠 *[Offline SLM Brain: ${this.getModelName()} • ${duration}s • 0 Tokens]*\n\n${content.trim()}`;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static inferViaCli(userQuery) {
    return new Promise((resolve) => {
      const llamaBin = this.getLlamaBin();
      const modelPath = this.getModelPath();
      if (!llamaBin || !modelPath) {
        return resolve({ action: 'unknown', error: 'SLM Model not found' });
      }

      const prompt = `<|im_start|>system\n${this.getSystemPrompt()}<|im_end|>\n<|im_start|>user\n${userQuery.trim()}<|im_end|>\n<|im_start|>assistant\n`;
      const args = [
        'completion',
        '-m', modelPath,
        '-p', prompt,
        '-n', '45',
        '-c', '1024',
        '-t', '4',
        '-no-cnv',
        '--no-display-prompt'
      ];

      const start = Date.now();
      execFile(llamaBin, args, { timeout: 15000 }, (err, stdout) => {
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        if (err) return resolve({ action: 'unknown', error: err.message, duration });

        const jsonMatch = (stdout || '').match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            return resolve({ ...JSON.parse(jsonMatch[0]), duration, via: 'cli' });
          } catch (_) {}
        }
        resolve({ action: 'unknown', raw: (stdout || '').trim(), duration, via: 'cli' });
      });
    });
  }

  static async classify(userQuery) {
    // 1. Try instant daemon HTTP server (sub-2s)
    const httpResult = await this.inferViaHttp(userQuery);
    if (httpResult) {
      return httpResult;
    }

    // If daemon is not running, ensure it starts for future turns
    this.ensureDaemonRunning().catch(() => {});

    // 2. Fall back to CLI completion only if daemon is completely offline
    return await this.inferViaCli(userQuery);
  }

  static async execute(intentObj, originalQuery, cwd = HOME_DIR, localEngineRef = null) {
    if (!intentObj || !intentObj.action || intentObj.action === 'unknown') {
      return await this.generateDirectly(originalQuery);
    }

    const { action, duration } = intentObj;
    const modelTag = `🧠 *[Offline SLM Brain: ${this.getModelName()} • ${duration || '1'}s]*\n\n`;

    switch (action) {
      case 'change_dir': {
        const targetPath = intentObj.path || originalQuery;
        if (localEngineRef && typeof localEngineRef.changeDirectory === 'function') {
          const res = localEngineRef.changeDirectory(targetPath);
          return `${modelTag}${res}`;
        }
        const res = FsTools.changeDirectory(targetPath, cwd);
        return `${modelTag}${res.message}`;
      }
      case 'delete_item': {
        const targetPath = intentObj.path || originalQuery;
        const res = FsTools.deleteItem(targetPath, cwd);
        return `${modelTag}${res}`;
      }
      case 'list_files': {
        const targetPath = intentObj.path || '';
        const res = FsTools.listFiles(targetPath, cwd);
        return `${modelTag}${res}`;
      }
      case 'torch_on': {
        const res = await DeviceTools.setTorch('on');
        return `${modelTag}${res}`;
      }
      case 'torch_off': {
        const res = await DeviceTools.setTorch('off');
        return `${modelTag}${res}`;
      }
      case 'camera_selfie': {
        const res = await DeviceTools.takePhoto('front');
        return `${modelTag}${res}`;
      }
      case 'camera_photo': {
        const res = await DeviceTools.takePhoto('back');
        return `${modelTag}${res}`;
      }
      case 'bluetooth': {
        const res = await DeviceTools.checkBluetooth();
        return `${modelTag}${res}`;
      }
      case 'battery': {
        const res = await SystemTools.getBattery();
        return `${modelTag}${res}`;
      }
      case 'ram': {
        const res = SystemTools.getRam();
        return `${modelTag}${res}`;
      }
      case 'storage': {
        const res = SystemTools.getStorage();
        return `${modelTag}${res}`;
      }
      case 'system_info': {
        const res = await TerminalTools.executeTerminalCommand('uname -a', false, cwd);
        return `${modelTag}${res}`;
      }
      case 'listening_ports': {
        const res = await TerminalTools.executeTerminalCommand('ss -tuln 2>/dev/null || netstat -tuln', false, cwd);
        return `${modelTag}${res}`;
      }
      case 'whoami': {
        const res = await TerminalTools.executeTerminalCommand('whoami', false, cwd);
        return `${modelTag}${res}`;
      }
      case 'top_process': {
        const res = await TerminalTools.executeTerminalCommand('ps aux | head -n 10', false, cwd);
        return `${modelTag}${res}`;
      }
      case 'show_memory': {
        if (localEngineRef && typeof localEngineRef.showMemory === 'function') {
          return `${modelTag}${localEngineRef.showMemory()}`;
        }
        return `${modelTag}⚡ Memory inspected.`;
      }
      case 'query_facts': {
        if (localEngineRef && typeof localEngineRef.queryMemoryFacts === 'function') {
          return `${modelTag}${localEngineRef.queryMemoryFacts(originalQuery)}`;
        }
        return `${modelTag}⚡ Facts inspected.`;
      }
      case 'check_mode': {
        if (localEngineRef && typeof localEngineRef.execute === 'function') {
          const res = await localEngineRef.execute('check_mode', originalQuery);
          return `${modelTag}${res}`;
        }
        return `${modelTag}⚡ Mode checked.`;
      }
      case 'terminal_exec': {
        if (intentObj.command) {
          const res = await TerminalTools.executeTerminalCommand(intentObj.command, false, cwd);
          return `${modelTag}${res}`;
        }
        return null;
      }
      case 'capabilities': {
        if (localEngineRef && typeof localEngineRef.execute === 'function') {
          const res = await localEngineRef.execute('capabilities', originalQuery);
          return `${modelTag}${res}`;
        }
        return `${modelTag}⚡ Jena Local Engine active.`;
      }
      case 'generate_code': {
        return await this.generateDirectly(originalQuery);
      }
      case 'chat': {
        if (intentObj.reply && intentObj.reply.length > 5) {
          return `${modelTag}${intentObj.reply}`;
        }
        return await this.generateDirectly(originalQuery);
      }
      default:
        return await this.generateDirectly(originalQuery);
    }
  }
}

module.exports = {
  SlmEngine
};
