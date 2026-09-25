/**
 * =====================================================================
 *  🔋 JENA v0.3 — Termux Hardware, Device & Math Tools
 * =====================================================================
 */

const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

class SystemTools {
  static DAYS_URDU = {
    0: 'Itwar (Sunday)',
    1: 'Peer (Monday)',
    2: 'Mangal (Tuesday)',
    3: 'Budh (Wednesday)',
    4: 'Jumerat (Thursday)',
    5: 'Juma (Friday)',
    6: 'Hafta (Saturday)'
  };

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
        // Fallback to Android sysfs
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

  static getSpecs(cwd = '') {
    const uptimeSec = os.uptime();
    const hrs = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    return (
      `🖥️ **Jena System Specifications:**\n` +
      `- 📱 **Platform:** \`${os.platform()} (${os.arch()})\`\n` +
      `- ⚡ **CPU Cores:** \`${os.cpus().length}\`\n` +
      `- ⏳ **Uptime:** \`${hrs} ghante ${mins} minute\`\n` +
      `- 🐍 **Node.js Version:** \`${process.version}\`\n` +
      `- 📂 **CWD:** \`${cwd || process.cwd()}\``
    );
  }

  static calculate(query) {
    try {
      let expr = query.replace(/^(hisab\s+karo|calculate|math|\=)\s*/i, '').trim();
      expr = expr.replace(/\^/g, '**').replace(/x/gi, '*');
      if (/[^0-9\+\-\*\/\(\)\.\s\%]/.test(expr)) return null;
      const res = Function(`"use strict"; return (${expr})`)();
      return `🧮 **Hisab Result:**\n\`${expr}\` = **\`${res}\`**\n\n*(Local Engine ne bina kisi AI token ke calculation ki.)*`;
    } catch (_) {
      return null;
    }
  }
}

module.exports = {
  SystemTools
};
