/**
 * =====================================================================
 *  📝 JENA v0.3 — Conversation & Failure Log Manager
 * =====================================================================
 */

const fs = require('fs');
const { JENA_DIR, CONVERSATION_LOG_FILE, FAILURE_LOG_FILE } = require('./config');

class LogManager {
  static ensureDir() {
    if (!fs.existsSync(JENA_DIR)) {
      fs.mkdirSync(JENA_DIR, { recursive: true });
    }
  }

  static logInteraction({ userMessage, assistantReply, mode = 'online', provider = '', model = '', stats = null, success = true, error = null, cwd = '' }) {
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
      cwd: cwd || process.env.HOME || '/data/data/com.termux/files/home'
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
        cwd: entry.cwd,
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
      `CWD: ${cwd || process.env.HOME || '/data/data/com.termux/files/home'}\n` +
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
    if (!fs.existsSync(FAILURE_LOG_FILE)) return 'No failure logs found.';
    try {
      const content = fs.readFileSync(FAILURE_LOG_FILE, 'utf8').trim();
      if (!content) return 'Failure log is empty.';
      const blocks = content.split('----------------------------------------------------------------------\n');
      const slice = blocks.slice(-limit).filter(Boolean);
      return slice.join('----------------------------------------------------------------------\n');
    } catch (e) {
      return `Failed to read failure logs: ${e.message}`;
    }
  }
}

module.exports = {
  LogManager
};
