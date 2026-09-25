/**
 * =====================================================================
 *  📦 JENA v0.3 — Termux Native Package Inspector & Installer Tool
 * =====================================================================
 *  Handles standalone package check, install, and conditional
 *  check-and-install pipelines for Termux Linux (0 Tokens).
 * =====================================================================
 */

const { exec } = require('child_process');
const { HOME_DIR } = require('../config');

class PackageTools {
  /**
   * Check if a binary or package is installed
   */
  static checkPackage(pkg) {
    return new Promise(resolve => {
      const cleanPkg = (pkg || '').trim().toLowerCase().replace(/[^a-z0-9_\-\.]/g, '');
      if (!cleanPkg) return resolve('⚠️ Package ka naam durust nahi hai.');

      exec(`command -v ${cleanPkg} 2>/dev/null || which ${cleanPkg} 2>/dev/null`, {
        timeout: 5000,
        shell: '/data/data/com.termux/files/usr/bin/sh'
      }, (err, stdout) => {
        const binPath = (stdout || '').trim();
        if (!err && binPath) {
          // Attempt to get version
          exec(`${cleanPkg} --version 2>/dev/null || ${cleanPkg} -v 2>/dev/null || ${cleanPkg} -V 2>/dev/null`, {
            timeout: 3000,
            shell: '/data/data/com.termux/files/usr/bin/sh'
          }, (_, verOut) => {
            const ver = (verOut || '').split('\n')[0].trim() || 'Version details available';
            resolve(
              `📦 **Package Status Report:**\n` +
              `- 🏷️ **Package:** \`${cleanPkg}\`\n` +
              `- 🟢 **Status:** **INSTALLED (Haan, pehle se installed hai)**\n` +
              `- 📍 **Binary Path:** \`${binPath}\`\n` +
              `- ℹ️ **Version:** \`${ver}\`\n\n` +
              `*(Termux environment mein \`${cleanPkg}\` pehle se majood hai • 0 Tokens)*`
            );
          });
        } else {
          resolve(
            `📦 **Package Status Report:**\n` +
            `- 🏷️ **Package:** \`${cleanPkg}\`\n` +
            `- 🔴 **Status:** **NOT INSTALLED (Installed nahi hai)**\n\n` +
            `*(Install karne ke liye \`install karo ${cleanPkg}\` ya \`check karo ${cleanPkg} installed hay ya nahi, agar nahi to install karo\` kahein.)*`
          );
        }
      });
    });
  }

  /**
   * Install package via pkg install -y
   */
  static installPackage(pkg) {
    return new Promise(resolve => {
      const cleanPkg = (pkg || '').trim().toLowerCase().replace(/[^a-z0-9_\-\.]/g, '');
      if (!cleanPkg) return resolve('⚠️ Package ka naam durust nahi hai.');

      // Check if already installed
      exec(`command -v ${cleanPkg} 2>/dev/null`, { timeout: 4000, shell: '/data/data/com.termux/files/usr/bin/sh' }, (checkErr, checkOut) => {
        if (!checkErr && checkOut.trim()) {
          return resolve(
            `📦 **Package Notice:** \`${cleanPkg}\` pehle se Termux mein installed hai (\`${checkOut.trim()}\`). Naya install karne ki zaroorat nahi hai!`
          );
        }

        // Run pkg install -y
        exec(`pkg install -y ${cleanPkg}`, {
          timeout: 120000,
          shell: '/data/data/com.termux/files/usr/bin/sh',
          env: { ...process.env, HOME: HOME_DIR, DEBIAN_FRONTEND: 'noninteractive' }
        }, (err, stdout, stderr) => {
          if (err) {
            return resolve(
              `❌ **Package Installation Error:** \`${cleanPkg}\` install nahi ho saki.\n\n` +
              `\`\`\`sh\n${stderr || err.message}\n\`\`\``
            );
          }

          resolve(
            `🎉 **Package Installation Kamyab!**\n\n` +
            `- 📦 **Package:** \`${cleanPkg}\`\n` +
            `- 🟢 **Status:** Kamyabi se install ho gaya hai!\n\n` +
            `*(Aap ab \`${cleanPkg}\` ko direct terminal ya scripts mein istemal kar sakte hain.)*`
          );
        });
      });
    });
  }

  /**
   * Conditional Check and Install pipeline
   */
  static async checkAndInstall(pkg) {
    const cleanPkg = (pkg || '').trim().toLowerCase().replace(/[^a-z0-9_\-\.]/g, '');
    if (!cleanPkg) return '⚠️ Package ka naam durust nahi hai.';

    // Step 1: Check
    const checkRes = await new Promise(res => {
      exec(`command -v ${cleanPkg} 2>/dev/null`, { timeout: 4000, shell: '/data/data/com.termux/files/usr/bin/sh' }, (err, stdout) => {
        res(!err && stdout.trim() ? stdout.trim() : null);
      });
    });

    if (checkRes) {
      // Already installed
      let verStr = '';
      try {
        verStr = await new Promise(r => {
          exec(`${cleanPkg} --version 2>/dev/null || ${cleanPkg} -v 2>/dev/null`, { timeout: 3000, shell: '/data/data/com.termux/files/usr/bin/sh' }, (_, out) => {
            r((out || '').split('\n')[0].trim());
          });
        });
      } catch (_) {}

      return (
        `📦 **Package Check & Install Result:**\n\n` +
        `✅ **Haan, \`${cleanPkg}\` pehle se installed hai!**\n` +
        `- 📍 **Path:** \`${checkRes}\`\n` +
        (verStr ? `- ℹ️ **Version:** \`${verStr}\`\n` : '') +
        `- 💡 **Action:** Naya install karne ki zaroorat nahi thi, installation pehle se verified hai.\n\n` +
        `*(0 Tokens • Instant Check)*`
      );
    }

    // Step 2: Not installed -> install it!
    const installMsg = await this.installPackage(cleanPkg);
    return `⚙️ **\`${cleanPkg}\` installed nahi tha, ab install kiya ja raha hai...**\n\n${installMsg}`;
  }
}

module.exports = {
  PackageTools
};
