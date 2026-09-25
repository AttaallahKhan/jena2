/**
 * =====================================================================
 *  📱 JENA v0.3 — Termux Hardware, Camera & Device Control Tool
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DeviceTools {
  static getGalleryDir() {
    const candidates = [
      '/storage/emulated/0/DCIM/Camera',
      '/storage/emulated/0/DCIM',
      '/storage/emulated/0/Pictures',
      '/storage/emulated/0/termux-to-phone'
    ];
    for (const dir of candidates) {
      if (fs.existsSync(dir)) return dir;
    }
    const defaultDir = '/storage/emulated/0/DCIM/Camera';
    try { fs.mkdirSync(defaultDir, { recursive: true }); } catch (_) {}
    return defaultDir;
  }

  static setTorch(state = 'on') {
    return new Promise(resolve => {
      const mode = (state || '').toLowerCase() === 'off' ? 'off' : 'on';
      exec(`/data/data/com.termux/files/usr/bin/termux-torch ${mode}`, {
        timeout: 6000,
        shell: '/data/data/com.termux/files/usr/bin/sh'
      }, (err) => {
        if (err) {
          return resolve(`❌ **Torch Error:** Torch switch nahi ho saki: ${err.message}\n*(Termux:API app aur permissions check karein.)*`);
        }
        if (mode === 'on') {
          resolve(
            `🔦 **Torch / Flashlight:** Mobile ki torch **ON** kar di gayi hai!\n\n` +
            `*(Band karne ke liye \`torch off karo\` ya \`torch band karo\` likhein.)*`
          );
        } else {
          resolve(`🔦 **Torch / Flashlight:** Mobile ki torch **OFF (Band)** kar di gayi hai.`);
        }
      });
    });
  }

  static takePhoto(facing = 'front') {
    return new Promise(resolve => {
      const isFront = /front|selfie|age|samne|aage/i.test(facing);
      const camId = isFront ? '1' : '0';
      const modeLabel = isFront ? 'Front Camera (Selfie)' : 'Back Camera (Rear)';
      const prefix = isFront ? 'Jena_Selfie' : 'Jena_Photo';

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const fileName = `${prefix}_${timestamp}.jpg`;

      const targetDir = this.getGalleryDir();
      const targetPath = path.join(targetDir, fileName);

      // Execute termux-camera-photo
      exec(`/data/data/com.termux/files/usr/bin/termux-camera-photo -c ${camId} "${targetPath}"`, {
        timeout: 25000,
        shell: '/data/data/com.termux/files/usr/bin/sh'
      }, (err) => {
        if (err || !fs.existsSync(targetPath)) {
          return resolve(`❌ **Camera Error:** Photo capture nahi ho saki: ${err ? err.message : 'File create nahi hui'}\n*(Termux:API app ke camera permissions check karein.)*`);
        }

        let sizeMb = '0';
        try {
          const stats = fs.statSync(targetPath);
          sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
        } catch (_) {}

        // Media scan so photo instantly shows in Android Gallery / Google Photos
        exec(`/data/data/com.termux/files/usr/bin/termux-media-scan "${targetPath}" 2>/dev/null`, () => {});
        exec(`/data/data/com.termux/files/usr/bin/termux-toast "Jena: Photo saved to Android Gallery!" 2>/dev/null`, () => {});

        resolve(
          `📸 **${modeLabel} Se Photo Kamyabi Se Capture Ho Gayi!**\n\n` +
          `- 🤳 **Mode:** ${modeLabel} (Camera ID: \`${camId}\`)\n` +
          `- 📁 **Gallery Location:** \`${targetPath}\`\n` +
          `- 📊 **File Size:** \`${sizeMb} MB\`\n` +
          `- 🖼️ **Android Gallery:** Photo automatically media scanner ke zariye phone ki Gallery / Google Photos app mein add ho chuki hai!\n\n` +
          `*(Aap apne phone ki Gallery ya Google Photos app mein ja kar yeh photo dekh sakte hain.)*`
        );
      });
    });
  }
}

module.exports = {
  DeviceTools
};
