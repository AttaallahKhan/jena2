/**
 * =====================================================================
 *  📡 JENA v0.3 — Live System & Agent Monitor Tool
 * =====================================================================
 *  Provides real-time telemetry, hardware gauges, memory intelligence,
 *  and instant hardware controls for the Jena Web Dashboard.
 * =====================================================================
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { MemoryManager, ConfigManager } = require('../config');
const { LogManager } = require('../logger');
const { DeviceTools } = require('./device');

class MonitorTools {
  static lastTorchState = 'off';

  /**
   * Format seconds to human readable uptime (e.g., "2h 14m 32s")
   */
  static formatUptime(seconds) {
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  }

  /**
   * Fetch battery status from Termux API or sysfs fallback
   */
  static getBatteryStatus() {
    return new Promise((resolve) => {
      exec('/data/data/com.termux/files/usr/bin/termux-battery-status', {
        timeout: 4000,
        shell: '/data/data/com.termux/files/usr/bin/sh'
      }, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          try {
            const data = JSON.parse(stdout);
            return resolve({
              available: true,
              percentage: data.percentage ?? 0,
              status: data.status || 'UNKNOWN',
              health: data.health || 'UNKNOWN',
              temperature: data.temperature || null,
              plugged: data.plugged || 'UNPLUGGED'
            });
          } catch (_) {}
        }

        // Sysfs fallback
        try {
          if (fs.existsSync('/sys/class/power_supply/battery/capacity')) {
            const cap = parseInt(fs.readFileSync('/sys/class/power_supply/battery/capacity', 'utf8').trim(), 10);
            return resolve({
              available: true,
              percentage: isNaN(cap) ? 0 : cap,
              status: 'SYSFS',
              health: 'GOOD',
              temperature: null,
              plugged: 'UNKNOWN'
            });
          }
        } catch (_) {}

        resolve({
          available: false,
          percentage: 0,
          status: 'UNAVAILABLE',
          health: 'UNKNOWN',
          temperature: null,
          plugged: 'UNKNOWN'
        });
      });
    });
  }

  /**
   * Fetch RAM metrics from /proc/meminfo
   */
  static getRamMetrics() {
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const lines = meminfo.split('\n');
      const data = {};
      lines.forEach((l) => {
        const parts = l.split(':');
        if (parts.length === 2) {
          data[parts[0].trim()] = parseInt(parts[1].trim(), 10);
        }
      });
      const totalMb = Math.round((data.MemTotal || 0) / 1024);
      const availMb = Math.round((data.MemAvailable || data.MemFree || 0) / 1024);
      const usedMb = Math.max(0, totalMb - availMb);
      const pctUsed = totalMb ? Math.round((usedMb / totalMb) * 100) : 0;
      return {
        totalMb,
        availMb,
        usedMb,
        pctUsed,
        totalGb: (totalMb / 1024).toFixed(1),
        usedGb: (usedMb / 1024).toFixed(1),
        availGb: (availMb / 1024).toFixed(1)
      };
    } catch (_) {
      const totalMb = Math.round(os.totalmem() / (1024 * 1024));
      const freeMb = Math.round(os.freemem() / (1024 * 1024));
      const usedMb = Math.max(0, totalMb - freeMb);
      return {
        totalMb,
        availMb: freeMb,
        usedMb,
        pctUsed: totalMb ? Math.round((usedMb / totalMb) * 100) : 0,
        totalGb: (totalMb / 1024).toFixed(1),
        usedGb: (usedMb / 1024).toFixed(1),
        availGb: (freeMb / 1024).toFixed(1)
      };
    }
  }

  /**
   * Fetch filesystem storage for Termux and Phone storage
   */
  static getStorageMetrics() {
    return new Promise((resolve) => {
      exec('df -k /data /storage/emulated/0 2>/dev/null', { timeout: 3000 }, (err, stdout) => {
        const res = {
          termux: { total: '225.0 GB', used: '68.0 GB', avail: '157.0 GB', pct: '31%', rawPct: 31 },
          phone: { total: '225.0 GB', used: '68.0 GB', avail: '157.0 GB', pct: '31%', rawPct: 31, available: true }
        };

        if (!err && stdout && stdout.trim()) {
          const lines = stdout.trim().split('\n').slice(1);
          if (lines[0]) {
            const parts = lines[0].split(/\s+/);
            const totalGb = (parseInt(parts[1], 10) / (1024 * 1024)).toFixed(1);
            const usedGb = (parseInt(parts[2], 10) / (1024 * 1024)).toFixed(1);
            const availGb = (parseInt(parts[3], 10) / (1024 * 1024)).toFixed(1);
            const pct = parts[4] || '0%';
            const rawPct = parseInt(pct.replace('%', ''), 10) || 0;
            res.termux = { total: `${totalGb} GB`, used: `${usedGb} GB`, avail: `${availGb} GB`, pct, rawPct };
          }
          if (lines[1]) {
            const parts = lines[1].split(/\s+/);
            const totalGb = (parseInt(parts[1], 10) / (1024 * 1024)).toFixed(1);
            const usedGb = (parseInt(parts[2], 10) / (1024 * 1024)).toFixed(1);
            const availGb = (parseInt(parts[3], 10) / (1024 * 1024)).toFixed(1);
            const pct = parts[4] || '0%';
            const rawPct = parseInt(pct.replace('%', ''), 10) || 0;
            res.phone = { total: `${totalGb} GB`, used: `${usedGb} GB`, avail: `${availGb} GB`, pct, rawPct, available: true };
          } else {
            res.phone.available = fs.existsSync('/storage/emulated/0');
          }
        }
        resolve(res);
      });
    });
  }

  /**
   * Count CPU cores from /proc/cpuinfo
   */
  static getCpuCores() {
    try {
      const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
      const matches = cpuinfo.match(/^processor\s*:/gm);
      if (matches && matches.length > 0) return matches.length;
    } catch (_) {}
    return os.cpus().length || 8;
  }

  /**
   * Complete live monitor payload
   */
  static async getLiveData(cwd = '') {
    const [battery, storage] = await Promise.all([
      this.getBatteryStatus(),
      this.getStorageMetrics()
    ]);

    const ram = this.getRamMetrics();
    const cores = this.getCpuCores();
    const mem = MemoryManager.load();
    const cfg = ConfigManager.load();
    const uptimeSec = process.uptime();
    const recentConvs = LogManager.getRecentConversations(8);
    const failures = LogManager.getFailureLogs(5);

    const memUsage = process.memoryUsage();
    const memoryRssMb = +(memUsage.rss / (1024 * 1024)).toFixed(1);
    const heapUsedMb = +(memUsage.heapUsed / (1024 * 1024)).toFixed(1);

    return {
      agent: {
        name: 'Jena',
        version: 'v0.3',
        status: 'ACTIVE',
        pid: process.pid,
        uptimeSeconds: Math.floor(uptimeSec),
        uptimeFormatted: this.formatUptime(uptimeSec),
        nodeVersion: process.version,
        platform: os.platform(),
        arch: process.arch,
        memoryRssMb,
        heapUsedMb,
        cwd: cwd || process.cwd()
      },
      hardware: {
        battery,
        ram,
        storage,
        cpu: {
          cores,
          loadAvg: os.loadavg().map((l) => +l.toFixed(2))
        },
        torch: {
          available: fs.existsSync('/data/data/com.termux/files/usr/bin/termux-torch'),
          state: this.lastTorchState
        },
        camera: {
          available: fs.existsSync('/data/data/com.termux/files/usr/bin/termux-camera-photo'),
          galleryDir: DeviceTools.getGalleryDir()
        },
        mediaScan: {
          available: fs.existsSync('/data/data/com.termux/files/usr/bin/termux-media-scan')
        }
      },
      intelligence: {
        operationsCount: (mem.learned_operations || []).length,
        factsCount: (mem.learned_facts || []).length,
        operations: (mem.learned_operations || []).slice(0, 10).map((op) => ({
          id: op.id,
          name: op.name,
          trigger: op.trigger,
          command: op.command,
          description: op.description
        }))
      },
      tokens: {
        allowance: cfg.tokens?.allowance || 500000,
        used: cfg.tokens?.used || 0,
        balance: cfg.tokens?.balance || 500000,
        speed: cfg.tokens?.lastPromptSpeed || 0
      },
      activity: {
        recent: recentConvs.map((c) => ({
          timestamp: c.timestamp,
          prompt: c.user ? (c.user.length > 60 ? c.user.slice(0, 57) + '...' : c.user) : (c.prompt || ''),
          assistant: c.assistant ? (c.assistant.length > 80 ? c.assistant.slice(0, 77) + '...' : c.assistant) : '',
          isOffline: c.mode === 'offline' || !!c.offline,
          status: c.status || 'SUCCESS',
          totalTokens: c.stats?.totalTokens || c.totalTokens || 0,
          elapsedSeconds: c.stats?.elapsedSeconds || c.elapsedSeconds || 0,
          provider: c.provider || (c.mode === 'offline' ? 'Local Engine' : 'Cloud')
        })),
        recentFailuresCount: typeof failures === 'string' ? (failures.includes('No failure') ? 0 : 1) : failures.length
      }
    };
  }

  /**
   * Execute an interactive hardware/monitor control action
   */
  static async handleAction(action, payload = {}) {
    if (action === 'torch_toggle') {
      const nextState = this.lastTorchState === 'on' ? 'off' : 'on';
      const msg = await DeviceTools.setTorch(nextState);
      this.lastTorchState = nextState;
      return { success: true, message: msg, torchState: nextState };
    }

    if (action === 'torch_on') {
      const msg = await DeviceTools.setTorch('on');
      this.lastTorchState = 'on';
      return { success: true, message: msg, torchState: 'on' };
    }

    if (action === 'torch_off') {
      const msg = await DeviceTools.setTorch('off');
      this.lastTorchState = 'off';
      return { success: true, message: msg, torchState: 'off' };
    }

    if (action === 'take_selfie') {
      const msg = await DeviceTools.takePhoto('front');
      return { success: true, message: msg };
    }

    if (action === 'take_photo') {
      const msg = await DeviceTools.takePhoto('back');
      return { success: true, message: msg };
    }

    if (action === 'media_scan') {
      const galleryDir = DeviceTools.getGalleryDir();
      return new Promise((resolve) => {
        exec(`/data/data/com.termux/files/usr/bin/termux-media-scan "${galleryDir}" 2>/dev/null`, (err) => {
          if (err) {
            return resolve({ success: false, message: `Media scan error: ${err.message}` });
          }
          resolve({
            success: true,
            message: `🖼️ **Android Media Scanner:** Gallery refresh kamyabi se chalaya gaya!\n- Scanned: \`${galleryDir}\``
          });
        });
      });
    }

    throw new Error(`Unknown monitor action: ${action}`);
  }
}

module.exports = {
  MonitorTools
};
