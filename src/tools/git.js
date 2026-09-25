/**
 * =====================================================================
 *  🐙 JENA v0.3 — Git & GitHub Operations Tool
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { HOME_DIR } = require('../config');

class GitTools {
  static getProjectDir() {
    return path.join(HOME_DIR, 'jena');
  }

  static async executeGitOperation(query, projectDir = null) {
    const dir = projectDir || this.getProjectDir();
    const q = (query || '').trim().toLowerCase();
    const gitDir = path.join(dir, '.git');

    if (!fs.existsSync(gitDir)) {
      return `⚠️ **Git Repository Not Found:** \`${dir}\` mein koi git repository initialize nahi hai.`;
    }

    // 1. Status query
    if (/^(?:git|github)\s+status\b/i.test(q) || q === 'git status') {
      return await new Promise(resolve => {
        exec('git status -s -b', { cwd: dir }, (err, stdout) => {
          if (err) return resolve(`❌ **Git Status Error:** ${err.message}`);
          const out = (stdout || '').trim();
          resolve(
            `🐙 **Jena Git Repository Status:**\n` +
            `- 📍 **Repo:** \`${dir}\`\n\n` +
            `\`\`\`sh\n${out || 'Working tree clean (No uncommitted changes)'}\n\`\`\`\n\n` +
            `*(Changes commit aur push karne ke liye \`git commit push\` likhein ya editor mein **🐙 GitHub Push** button dabayein.)*`
          );
        });
      });
    }

    // 2. Diff query
    if (/^(?:git|github)\s+diff\b/i.test(q) || q === 'git diff') {
      return await new Promise(resolve => {
        exec('git diff --stat', { cwd: dir }, (err, stdout) => {
          const out = (stdout || '').trim();
          resolve(`🐙 **Git Diff (Changed Files):**\n\`\`\`sh\n${out || 'No uncommitted changes'}\n\`\`\``);
        });
      });
    }

    // 3. Log query
    if (/^(?:git|github)\s+log\b/i.test(q) || q === 'git log') {
      return await new Promise(resolve => {
        exec('git log -n 5 --oneline --decorate', { cwd: dir }, (err, stdout) => {
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

    return await this.gitCommitAndPush(commitMsg, true, dir);
  }

  static gitCommitAndPush(message, pushToRemote = true, projectDir = null) {
    return new Promise(resolve => {
      const dir = projectDir || this.getProjectDir();
      const cleanMsg = (message || `Update via Jena: ${new Date().toISOString()}`).replace(/"/g, '\\"');

      // 1. Stage all changes
      exec('git add -A', { cwd: dir }, (addErr) => {
        if (addErr) {
          return resolve(`❌ **Git Add Error:** ${addErr.message}`);
        }

        // 2. Check if there are staged changes
        exec('git status --porcelain', { cwd: dir }, (statusErr, statusOut) => {
          const hasChanges = (statusOut || '').trim().length > 0;

          const doPush = (commitNotice = '') => {
            if (!pushToRemote) {
              return resolve(commitNotice || '✅ **Changes committed locally (Push skipped).**');
            }

            exec('git rev-parse --abbrev-ref HEAD', { cwd: dir }, (branchErr, branchOut) => {
              const branch = (branchOut || 'master').trim();
              exec(`git push origin ${branch}`, {
                cwd: dir,
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
                  (commitNotice ? `${commitNotice}\n\n` : '') +
                  `- 📍 **Branch:** \`${branch}\`\n` +
                  `- 💬 **Commit Message:** "${cleanMsg}"\n` +
                  `- 🐙 **Remote:** \`origin/${branch}\`\n\n` +
                  `\`\`\`sh\n${combined || 'Everything up-to-date'}\n\`\`\`\n\n` +
                  `*(Changes GitHub par kamyabi se upload ho gayi hain.)*`
                );
              });
            });
          };

          if (hasChanges) {
            exec(`git commit -m "${cleanMsg}"`, {
              cwd: dir,
              env: { ...process.env, HOME: HOME_DIR }
            }, (commitErr, commitStdout) => {
              if (commitErr) {
                return resolve(`❌ **Git Commit Error:** ${commitErr.message}`);
              }
              const commitSummary = (commitStdout || '').trim().split('\n')[0];
              doPush(`✅ **Commit:** ${commitSummary}`);
            });
          } else {
            doPush('ℹ️ **Koi naye uncommitted changes nahi the.** Remote ke sath sync check kiya gaya.');
          }
        });
      });
    });
  }
}

module.exports = {
  GitTools
};
