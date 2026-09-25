#!/data/data/com.termux/files/usr/bin/node
/**
 * =====================================================================
 *  🤖 JENA v0.3 — Micro-Kernel HTTP Server & CLI Entry Point
 * =====================================================================
 *  Termux-Native Pluggable Micro-Kernel Architecture
 *  - Offline Local Intelligence (0 Tokens) + Online Cloud Engine
 *  - Built-in SSE Streaming Chat, Code Editor API, Git Integration
 *  - Auto-Port Recovery & Zero External Dependencies
 * =====================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const {
  HOME_DIR,
  PHONE_DIR,
  JENA_DIR,
  CONVERSATION_LOG_FILE,
  FAILURE_LOG_FILE,
  PUBLIC_DIR,
  PORT,
  BIN_TARGET,
  ConfigManager,
  MemoryManager,
  TokenTracker,
  DEFAULT_PROVIDERS
} = require('./src/config');

const { LogManager } = require('./src/logger');
const { LocalEngine } = require('./src/engines/local');
const { CloudEngine, TestEngine } = require('./src/engines/cloud');
const { GitTools } = require('./src/tools/git');
const { MonitorTools } = require('./src/tools/monitor');

// --- SYSTEM SYNC (GLOBAL COMMAND & SHELL ALIASES) ---
function syncSystemIntegrations() {
  const serverPath = path.resolve(__filename);
  const logs = [];

  // 1. Ensure server.js is executable
  try {
    fs.chmodSync(serverPath, 0o755);
    logs.push(`Executable permission ensured for '${serverPath}'.`);
  } catch (e) {
    logs.push(`chmod error: ${e.message}`);
  }

  // 2. Link /data/data/com.termux/files/usr/bin/jena
  try {
    if (fs.existsSync(BIN_TARGET) || fs.lstatSync(BIN_TARGET).isSymbolicLink()) {
      try { fs.unlinkSync(BIN_TARGET); } catch (_) {}
    }
    fs.symlinkSync(serverPath, BIN_TARGET);
    logs.push(`Symlink created: ${BIN_TARGET} -> ${serverPath}`);
  } catch (e) {
    logs.push(`Symlink error: ${e.message}`);
  }

  // 3. Ensure aliases in .bashrc and .zshrc
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

  const resolveEditorPath = (reqPath) => {
    if (!reqPath) return __dirname;
    let clean = reqPath.trim();
    let resolved = path.isAbsolute(clean)
      ? path.normalize(clean)
      : path.normalize(path.join(__dirname, clean));

    const homeBoundary = '/data/data/com.termux/files/home';
    if (!resolved.startsWith(homeBoundary) && !resolved.startsWith(__dirname)) {
      throw new Error('Access Denied: Path outside allowed workspace');
    }
    return resolved;
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

    // --- CONFIG API ---
    if (pathname === '/api/config' && method === 'GET') {
      const cfg = ConfigManager.load();
      const allProviders = ConfigManager.getAllProviders();
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

    if (pathname === '/api/config' && method === 'POST') {
      try {
        const body = await parseBody();
        const cfg = ConfigManager.load();
        if (body.mode) cfg.mode = body.mode;
        if (body.provider) cfg.activeProvider = body.provider;
        if (body.model) cfg.activeModel = body.model;
        if (body.allowance) TokenTracker.setAllowance(body.allowance);
        ConfigManager.save(cfg);
        return sendJson(200, { success: true, message: 'Settings save ho gayi hain.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // --- CUSTOM MODELS & PROVIDERS ---
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

    if (pathname === '/api/custom-provider' && method === 'POST') {
      try {
        const body = await parseBody();
        const { id, name, endpoint, type, defaultModelId, defaultModelName, apiKey } = body;
        if (!id || !endpoint) return sendJson(400, { error: 'Provider ID aur Endpoint URL zaroori hain.' });
        const resData = ConfigManager.addCustomProvider({ id, name, endpoint, type, defaultModelId, defaultModelName });
        if (apiKey && apiKey.trim()) ConfigManager.addKey(resData.id, apiKey.trim());
        return sendJson(200, { success: true, message: `Provider '${resData.provider.name}' add ho gaya.`, data: resData });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

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

    // --- KEYS MANAGEMENT ---
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

    if (pathname === '/api/keys' && method === 'DELETE') {
      try {
        const body = await parseBody();
        const { provider, index, model } = body;
        if (!provider || index === undefined) return sendJson(400, { error: 'Provider aur index zaroori hain.' });
        ConfigManager.removeKey(provider, parseInt(index, 10), model);
        return sendJson(200, { success: true, message: 'Key delete ho gaya.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // --- CONNECTION TEST ---
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

    // --- MEMORY API ---
    if (pathname === '/api/memory' && method === 'GET') {
      const mem = MemoryManager.load();
      return sendJson(200, {
        cwd: LocalEngine.getCwd(),
        facts: mem.learned_facts || [],
        operations: mem.learned_operations || []
      });
    }

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

    // --- FILESYSTEM API ---
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

    if (pathname === '/api/fs/ls' && method === 'GET') {
      try {
        const targetPath = parsedUrl.searchParams.get('path') || '';
        const msg = LocalEngine.listFiles(targetPath ? `ls ${targetPath}` : 'ls');
        return sendJson(200, { cwd: LocalEngine.getCwd(), message: msg });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // --- LOGS API ---
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

    if (pathname === '/api/logs/clear' && method === 'POST') {
      try {
        const body = await parseBody();
        LogManager.clear(body.type || 'all');
        return sendJson(200, { success: true, message: 'Logs clear ho gaye hain.' });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    }

    // --- LIVE MONITOR API ---
    if (pathname === '/api/monitor' && method === 'GET') {
      try {
        const liveData = await MonitorTools.getLiveData(LocalEngine.getCwd());
        return sendJson(200, { success: true, ...liveData });
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    }

    if (pathname === '/api/monitor/action' && method === 'POST') {
      try {
        const body = await parseBody();
        const action = body.action;
        if (!action) return sendJson(400, { success: false, error: 'Action zaroori hai.' });
        const result = await MonitorTools.handleAction(action, body);
        return sendJson(200, result);
      } catch (err) {
        return sendJson(500, { success: false, error: err.message });
      }
    }

    // --- CODE EDITOR API ---
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
          try { items = fs.readdirSync(dir, { withFileTypes: true }); }
          catch (_) { return []; }

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

    // --- GIT API ---
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

    if (pathname === '/api/git/commit-push' && method === 'POST') {
      try {
        const body = await parseBody();
        const message = (body.message || '').trim() || `Update via Jena UI: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`;
        const push = body.push !== false;
        const result = await GitTools.gitCommitAndPush(message, push, __dirname);
        return sendJson(200, { success: true, message: result });
      } catch (err) {
        return sendJson(500, { error: err.message });
      }
    }

    // --- CHAT API (SSE STREAMING) ---
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

      // 1. Offline / Local Engine
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
            `*Online Cloud AI use karne ke liye upar switch se **🌐 Online Mode** select karein.*`;
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
            if (isPage) sendEvent({ type: 'hot_reload', target: 'page' });
            else if (isCss) sendEvent({ type: 'hot_reload', target: 'css' });
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

    // --- STATIC FILES & PAGE ROUTE SERVING ---
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

  // Auto-port recovery handler
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port ${PORT} in use] Attempting auto-port recovery...`);
      try {
        exec(`pgrep -f "node.*server.js" | grep -v "^${process.pid}$" | xargs -r kill -9 2>/dev/null`, () => {
          setTimeout(() => {
            try { server.close(); } catch (_) {}
            server.listen(PORT, '0.0.0.0');
          }, 600);
        });
      } catch (_) {
        console.error(`Port ${PORT} occupied and could not be recovered.`);
      }
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  🤖 JENA v0.3 — Autonomous Hybrid AI Agent`);
    console.log(`  Local URL:   http://localhost:${PORT}`);
    console.log(`  Network URL: http://0.0.0.0:${PORT}`);
    console.log(`======================================================\n`);
    exec(`termux-open-url http://localhost:${PORT} 2>/dev/null || xdg-open http://localhost:${PORT} 2>/dev/null || true`, () => {});
  });

  process.on('SIGTERM', () => { server.close(); process.exit(0); });
  process.on('SIGINT', () => { server.close(); process.exit(0); });

  return server;
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

module.exports = {
  LocalEngine,
  CloudEngine,
  ConfigManager,
  TokenTracker,
  TestEngine,
  LogManager,
  startServer,
  runCli
};
