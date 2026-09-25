/**
 * =====================================================================
 *  ⌨️ JENA v0.3 — Termux Terminal & Shell Execution Tools
 * =====================================================================
 */

const { exec } = require('child_process');
const { HOME_DIR } = require('../config');
const { LogManager } = require('../logger');

class TerminalTools {
  static executeTerminalCommand(cmd, autoYes = false, currentDir = HOME_DIR) {
    return new Promise(resolve => {
      const trimmed = (cmd || '').trim();
      if (!trimmed) {
        return resolve('⚠️ Barah-e-karam koi valid terminal command batayein.');
      }

      let execCmd = trimmed;
      if (autoYes && !execCmd.startsWith('yes |')) {
        execCmd = `yes | ${execCmd} -o Dpkg::Options::="--force-confnew"`;
      }

      const cwd = currentDir || HOME_DIR;
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
          body = body.slice(0, 8000) + '\n\n...(Output truncated: Size 8KB se exceed kar gaya)';
        }

        if (err) {
          LogManager.logFailure({
            command: execCmd,
            type: 'TERMINAL_COMMAND_FAILURE',
            error: `${err.message}${errOut ? ` | stderr: ${errOut}` : ''}`,
            cwd,
            context: { autoYes }
          });
        }

        const isSuccess = !err;
        const statusIcon = isSuccess ? '⚡' : '⚠️';

        resolve(
          `${statusIcon} **Terminal Execution Report:**\n` +
          `- 📍 **CWD:** \`${cwd}\`\n` +
          `- ⌨️ **Command:** \`${execCmd}\`\n` +
          `- 📊 **Status:** ${isSuccess ? '✅ Success (Exit Code: 0)' : `❌ Error (Exit Code: ${err.code || 1})`}\n\n` +
          `\`\`\`sh\n${body || '(Command executed successfully with no output)'}\n\`\`\`\n\n` +
          `*(Termux Linux environment mein offline command run hui bina kisi token usage ke.)*`
        );
      });
    });
  }

  static executeLearnedOperation(op, currentDir = HOME_DIR) {
    return new Promise(resolve => {
      const cwd = currentDir || HOME_DIR;
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
}

module.exports = {
  TerminalTools
};
