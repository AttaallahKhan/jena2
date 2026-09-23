#!/usr/bin/env node
/**
 * Jena Web GUI Server
 * Lightweight, zero-dependency Node.js server with Server-Sent Events (SSE) streaming.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

// Configuration
let PORT = parseInt(process.env.PORT || '8080', 10);
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = parseInt(args[i + 1], 10);
  }
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const BRIDGE_PATH = path.join(__dirname, 'bridge.py');
const HOME_DIR = process.env.HOME || '/data/data/com.termux/files/home';
const JENA_DIR = path.join(HOME_DIR, '.jena');
const CONFIG_FILE = path.join(JENA_DIR, 'config.json');
const HISTORY_FILE = path.join(JENA_DIR, 'history.json');
const MEMORY_FILE = path.join(JENA_DIR, 'memory.json');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// Track currently running Jena child process
let activeProcess = null;

// Helpers
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) {
        // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

function readJsonFile(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultVal;
}

function writeJsonFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e.message);
    return false;
  }
}

// Check Termux battery status if command available
function getBatteryStatus() {
  return new Promise(resolve => {
    exec('termux-battery-status 2>/dev/null', { timeout: 1500 }, (err, stdout) => {
      if (!err && stdout.trim()) {
        try {
          return resolve(JSON.parse(stdout));
        } catch (_) {}
      }
      resolve(null);
    });
  });
}

// Request Handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // --- API ROUTES ---

  // GET /api/status - System & Agent Status
  if (pathname === '/api/status' && method === 'GET') {
    const config = readJsonFile(CONFIG_FILE, {});
    const battery = await getBatteryStatus();
    return sendJson(res, 200, {
      status: 'online',
      active_process: !!activeProcess,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime_seconds: Math.floor(os.uptime()),
        free_mem_mb: Math.round(os.freemem() / (1024 * 1024)),
        total_mem_mb: Math.round(os.totalmem() / (1024 * 1024)),
        cpus: os.cpus().length,
        cwd: process.cwd()
      },
      battery: battery,
      config: {
        provider: config.provider || 'groq',
        model: config.model || 'qwen/qwen3.8-27b',
        temperature: config.temperature ?? 0.3,
        max_tokens: config.max_tokens ?? 700,
        history_turns: config.history_turns ?? 3
      }
    });
  }

  // GET /api/config - Get current configuration (keys masked)
  if (pathname === '/api/config' && method === 'GET') {
    const config = readJsonFile(CONFIG_FILE, {});
    const masked = {
      ...config,
      gemini_api_key_masked: maskKey(config.gemini_api_key),
      groq_api_key_masked: maskKey(config.groq_api_key),
      openai_api_key_masked: maskKey(config.openai_api_key),
      has_gemini_key: Boolean(config.gemini_api_key),
      has_groq_key: Boolean(config.groq_api_key),
      has_openai_key: Boolean(config.openai_api_key)
    };
    // Delete full raw keys in GET output for security
    delete masked.gemini_api_key;
    delete masked.groq_api_key;
    delete masked.openai_api_key;
    return sendJson(res, 200, masked);
  }

  // POST /api/config - Update configuration
  if (pathname === '/api/config' && method === 'POST') {
    try {
      const updates = await parseJsonBody(req);
      const current = readJsonFile(CONFIG_FILE, {});

      if (updates.provider) current.provider = updates.provider;
      if (updates.model) current.model = updates.model;
      if (updates.temperature !== undefined) current.temperature = parseFloat(updates.temperature);
      if (updates.max_tokens !== undefined) current.max_tokens = parseInt(updates.max_tokens, 10);
      if (updates.history_turns !== undefined) current.history_turns = parseInt(updates.history_turns, 10);

      // Only update API keys if non-empty string is passed
      if (updates.gemini_api_key && updates.gemini_api_key.trim()) {
        current.gemini_api_key = updates.gemini_api_key.trim();
      }
      if (updates.groq_api_key && updates.groq_api_key.trim()) {
        current.groq_api_key = updates.groq_api_key.trim();
      }
      if (updates.openai_api_key && updates.openai_api_key.trim()) {
        current.openai_api_key = updates.openai_api_key.trim();
      }

      writeJsonFile(CONFIG_FILE, current);
      return sendJson(res, 200, { success: true, message: 'Settings kamyabi se save ho gayi hain.' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // GET /api/history - Get chat history
  if (pathname === '/api/history' && method === 'GET') {
    const history = readJsonFile(HISTORY_FILE, []);
    return sendJson(res, 200, { history: Array.isArray(history) ? history : [] });
  }

  // POST /api/history/clear - Clear chat history
  if (pathname === '/api/history/clear' && method === 'POST') {
    writeJsonFile(HISTORY_FILE, []);
    return sendJson(res, 200, { success: true, message: 'Chat history saaf ho gayi hai.' });
  }

  // GET /api/memory - Get long term facts
  if (pathname === '/api/memory' && method === 'GET') {
    const memory = readJsonFile(MEMORY_FILE, { user_preferences: {}, learned_facts: {}, projects: {} });
    return sendJson(res, 200, memory);
  }

  // POST /api/memory/clear - Clear memory
  if (pathname === '/api/memory/clear' && method === 'POST') {
    const defaultMem = { user_preferences: {}, learned_facts: {}, projects: {} };
    writeJsonFile(MEMORY_FILE, defaultMem);
    return sendJson(res, 200, { success: true, message: 'Long-term memory reset ho gayi hai.' });
  }

  // POST /api/memory/add - Add memory fact
  if (pathname === '/api/memory/add' && method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const memory = readJsonFile(MEMORY_FILE, { user_preferences: {}, learned_facts: {}, projects: {} });

      const category = (data.category || 'learned_facts').trim();
      if (!memory[category]) memory[category] = {};

      if (data.key && data.value !== undefined) {
        memory[category][data.key.trim()] = data.value;
      } else if (data.fact && data.fact.trim()) {
        const factText = data.fact.trim();
        if (factText.includes(':')) {
          const parts = factText.split(':');
          const k = parts[0].trim();
          const v = parts.slice(1).join(':').trim();
          memory[category][k] = v;
        } else {
          const k = `fact_${Date.now().toString(36)}`;
          memory[category][k] = factText;
        }
      } else {
        return sendJson(res, 400, { error: 'Fact ya key/value zaroori hai.' });
      }

      writeJsonFile(MEMORY_FILE, memory);
      return sendJson(res, 200, { success: true, memory });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // POST /api/memory/delete - Delete specific memory fact
  if (pathname === '/api/memory/delete' && method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const memory = readJsonFile(MEMORY_FILE, { user_preferences: {}, learned_facts: {}, projects: {} });
      const { category, key } = data;
      if (category && key && memory[category] && memory[category][key] !== undefined) {
        delete memory[category][key];
        writeJsonFile(MEMORY_FILE, memory);
        return sendJson(res, 200, { success: true, memory });
      }
      return sendJson(res, 404, { error: 'Fact nahi mila.' });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // POST /api/stop - Abort active execution
  if (pathname === '/api/stop' && method === 'POST') {
    if (activeProcess) {
      try {
        activeProcess.kill('SIGTERM');
        setTimeout(() => {
          if (activeProcess) activeProcess.kill('SIGKILL');
          activeProcess = null;
        }, 1000);
        return sendJson(res, 200, { success: true, message: 'Task roka ja raha hai.' });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }
    return sendJson(res, 200, { success: true, message: 'Koi task running nahi hai.' });
  }

  // POST /api/chat - Streaming Jena ReAct execution via SSE
  if (pathname === '/api/chat' && method === 'POST') {
    let payload;
    try {
      payload = await parseJsonBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }

    const userMessage = (payload.message || '').trim();
    if (!userMessage) {
      return sendJson(res, 400, { error: 'Message cannot be empty.' });
    }

    // Prepare SSE Response Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const sendEvent = (eventObj) => {
      res.write(`data: ${JSON.stringify(eventObj)}\n\n`);
    };

    // If an agent process is already running, terminate it before starting a new one
    if (activeProcess) {
      try {
        activeProcess.kill('SIGKILL');
      } catch (_) {}
      activeProcess = null;
    }

    // Build python arguments
    const pythonArgs = [BRIDGE_PATH, '--query', userMessage];
    if (payload.provider) pythonArgs.push('--provider', payload.provider);
    if (payload.model) pythonArgs.push('--model', payload.model);
    if (payload.temperature !== undefined) pythonArgs.push('--temperature', String(payload.temperature));
    if (payload.max_tokens !== undefined) pythonArgs.push('--max-tokens', String(payload.max_tokens));

    const pythonBin = fs.existsSync('/data/data/com.termux/files/usr/bin/python3')
      ? '/data/data/com.termux/files/usr/bin/python3'
      : 'python3';

    const child = spawn(pythonBin, pythonArgs, {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    activeProcess = child;

    let buffer = '';

    child.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep remainder

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          sendEvent(parsed);
        } catch (e) {
          // If python output non-json debug text
          sendEvent({ type: 'log', message: trimmed });
        }
      }
    });

    child.stderr.on('data', chunk => {
      const errText = chunk.toString('utf8').trim();
      if (errText) {
        sendEvent({ type: 'warning', message: errText });
      }
    });

    child.on('close', code => {
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          sendEvent(parsed);
        } catch (_) {
          sendEvent({ type: 'log', message: buffer.trim() });
        }
      }

      sendEvent({ type: 'stream_end', exit_code: code });
      if (activeProcess === child) {
        activeProcess = null;
      }
      res.end();
    });

    child.on('error', err => {
      sendEvent({ type: 'error', error: `Process error: ${err.message}` });
      sendEvent({ type: 'stream_end', exit_code: -1 });
      if (activeProcess === child) {
        activeProcess = null;
      }
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      if (activeProcess === child) {
        try {
          child.kill('SIGTERM');
        } catch (_) {}
        activeProcess = null;
      }
    });

    return;
  }

  // --- STATIC FILE SERVING ---
  let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  filePath = path.normalize(filePath);

  // Security: prevent path traversal outside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing if requested
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFile, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  🤖 Jena Autonomous AI Agent — Web GUI Server`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  Network URL: http://0.0.0.0:${PORT}`);
  console.log(`======================================================\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  if (activeProcess) {
    try { activeProcess.kill('SIGKILL'); } catch (_) {}
  }
  console.log('\nServer band kiya ja raha hai. Allah Hafiz!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (activeProcess) {
    try { activeProcess.kill('SIGKILL'); } catch (_) {}
  }
  process.exit(0);
});
