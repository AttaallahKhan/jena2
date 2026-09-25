/**
 * =====================================================================
 *  📂 JENA v0.3 — Termux Filesystem Tools
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { HOME_DIR, PHONE_DIR } = require('../config');

class FsTools {
  static ensurePhoneDir() {
    if (!fs.existsSync(PHONE_DIR)) {
      try {
        fs.mkdirSync(PHONE_DIR, { recursive: true });
      } catch (_) {}
    }
    return PHONE_DIR;
  }

  static resolvePath(inputPath, cwd = HOME_DIR) {
    if (!inputPath || inputPath.trim() === '' || inputPath === '~') {
      return HOME_DIR;
    }
    let trimmed = inputPath.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    const lower = trimmed.toLowerCase();

    // 1. Direct aliases for HOME / TERMUX
    if (['home', 'home folder', 'home dir', 'home directory', '/home', 'termux', 'termux home'].includes(lower)) {
      return HOME_DIR;
    }

    // 2. Direct aliases for PHONE (termux-to-phone)
    if (
      [
        'phone',
        'phone folder',
        'phone storage',
        'phone dir',
        'termux-to-phone',
        'termex-to-phone',
        'termux to phone',
        'termex to phone',
        'storage/termux-to-phone',
        '~/storage/termux-to-phone'
      ].includes(lower)
    ) {
      this.ensurePhoneDir();
      return PHONE_DIR;
    }

    // 3. Direct aliases for Android Shared / SDCard storage
    if (['storage', 'sdcard', '/sdcard', 'shared', 'internal', 'internal storage', 'phone main storage'].includes(lower)) {
      return '/storage/emulated/0';
    }

    // 4. Common Android system / media folders
    if (['dcim', 'camera'].includes(lower)) return '/storage/emulated/0/DCIM';
    if (['downloads', 'download'].includes(lower)) return '/storage/emulated/0/Download';
    if (['pictures', 'photos', 'images'].includes(lower)) return '/storage/emulated/0/Pictures';
    if (['music'].includes(lower)) return '/storage/emulated/0/Music';
    if (['movies', 'videos'].includes(lower)) return '/storage/emulated/0/Movies';

    // 5. Prefix handling for home (e.g. ~/home/ or home/)
    if (trimmed.startsWith('~/home/')) {
      trimmed = '~/' + trimmed.slice(7);
    } else if (/^home\/(.+)$/i.test(trimmed)) {
      return path.normalize(path.join(HOME_DIR, trimmed.replace(/^home\//i, '')));
    }

    // 6. Prefix handling for phone (termux-to-phone)
    if (/^(?:phone|termux-to-phone|termex-to-phone)\/(.+)$/i.test(trimmed)) {
      this.ensurePhoneDir();
      const sub = trimmed.replace(/^(?:phone|termux-to-phone|termex-to-phone)\//i, '');
      return path.normalize(path.join(PHONE_DIR, sub));
    }
    if (/^(?:~\/)?storage\/(?:termux-to-phone|termex-to-phone)\/(.+)$/i.test(trimmed)) {
      this.ensurePhoneDir();
      const sub = trimmed.replace(/^(?:~\/)?storage\/(?:termux-to-phone|termex-to-phone)\//i, '');
      return path.normalize(path.join(PHONE_DIR, sub));
    }

    // 7. Storage shortcuts (e.g. ~/storage/<name> or storage/<name>)
    const storageMatch = trimmed.match(/^(?:~\/)?storage\/(.+)$/i);
    if (storageMatch) {
      const sub = storageMatch[1].trim();
      const subLower = sub.toLowerCase();
      if (subLower === 'termux-to-phone' || subLower === 'termex-to-phone') {
        this.ensurePhoneDir();
        return PHONE_DIR;
      }
      if (subLower === 'downloads' || subLower === 'download') return '/storage/emulated/0/Download';
      if (subLower === 'dcim' || subLower === 'camera') return '/storage/emulated/0/DCIM';
      if (subLower === 'pictures' || subLower === 'photos') return '/storage/emulated/0/Pictures';
      if (subLower === 'movies' || subLower === 'videos') return '/storage/emulated/0/Movies';
      if (subLower === 'music') return '/storage/emulated/0/Music';
      if (subLower === 'shared') return '/storage/emulated/0';

      const phonePath = path.join('/storage/emulated/0', sub);
      if (fs.existsSync(phonePath)) {
        return path.normalize(phonePath);
      }
    }

    if (trimmed.startsWith('~/')) {
      return path.normalize(path.join(HOME_DIR, trimmed.slice(2)));
    }
    if (path.isAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }
    return path.normalize(path.join(cwd, trimmed));
  }

  static extractCdTarget(query) {
    if (!query) return '';
    let q = query.trim().replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();

    if (/^(?:peeche|back|bahir|bahr)\s+(?:jao|aao|niklo)$/i.test(q) || q.toLowerCase() === 'cd ..') {
      return '..';
    }
    if (/^home\s+(?:folder\s+)?(?:main|par|mein)\s+(?:jao|chalo)$/i.test(q)) {
      return '~';
    }
    let m = q.match(/^(.+?)\s+(?:folder\s+)?(?:main|mein|par)\s+(?:jao|chalo|ghuso)$/i);
    if (m) {
      return m[1].replace(/^(?:folder|directory)\s+/i, '').trim();
    }
    m = q.match(/^(?:go\s+to|enter|switch\s+to|open)\s+(?:folder\s+|directory\s+)?(.+)$/i);
    if (m) {
      return m[1].trim();
    }
    let target = q.replace(/^(?:cd|folder\s+badlo|andar\s+jao)\s*/i, '').trim();
    target = target.replace(/^(?:folder|directory)\s+/i, '').trim();
    return target;
  }

  static changeDirectory(query, currentDir) {
    let target = this.extractCdTarget(query);
    if (!target || target === '~' || target.toLowerCase() === 'home') target = HOME_DIR;
    const dest = this.resolvePath(target, currentDir);

    if (!fs.existsSync(dest)) {
      return { newCwd: currentDir, message: `❌ **Error:** Folder mojood nahi hai:\n\`${dest}\`` };
    }

    try {
      const stat = fs.statSync(dest);
      if (!stat.isDirectory()) {
        return { newCwd: currentDir, message: `❌ **Error:** Yeh directory nahi balkay file hai:\n\`${dest}\`` };
      }

      const items = fs.readdirSync(dest);
      const dirCount = items.filter(i => {
        try { return fs.statSync(path.join(dest, i)).isDirectory(); } catch (_) { return false; }
      }).length;
      const fileCount = items.length - dirCount;

      return {
        newCwd: dest,
        message:
          `📂 **Directory Changed (CWD Updated):**\n` +
          `- 📍 **Current Path:** \`${dest}\`\n` +
          `- 📊 **Items Inside:** \`${items.length}\` (${dirCount} folders, ${fileCount} files)\n\n` +
          `*(Files dekhne ke liye \`ls\` likhein.)*`
      };
    } catch (err) {
      return { newCwd: currentDir, message: `❌ **cd Error:** ${err.message}` };
    }
  }

  static listFiles(query = '', currentDir = HOME_DIR) {
    let target = (query || '').trim();
    target = target.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    target = target.replace(/^(?:ls|dir|files\s+dikhao|list\s+files|folder\s+mein\s+kya|directory\s+check|list)\s*/i, '').trim();
    target = target.replace(/\s*(?:folder|directory)?\s*(?:list\s+karo|list\s+kardo|list\s+karein|dikhao|check).*$/i, '').trim();
    target = target.replace(/\s*(?:k[aei]?|ke|k)\s+(?:folders?|files?|directories|directory)\s*$/i, '').trim();
    target = target.replace(/\s+(?:folder|folders|directory|directories|files?)\s*$/i, '').trim();

    const dir = target ? this.resolvePath(target, currentDir) : currentDir;

    if (!fs.existsSync(dir)) {
      return `❌ **Error:** Path mojood nahi hai:\n\`${dir}\``;
    }

    try {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) {
        return `❌ **Error:** Yeh directory nahi hai:\n\`${dir}\``;
      }

      const items = fs.readdirSync(dir);
      items.sort((a, b) => {
        let aDir = false, bDir = false;
        try { aDir = fs.statSync(path.join(dir, a)).isDirectory(); } catch (_) {}
        try { bDir = fs.statSync(path.join(dir, b)).isDirectory(); } catch (_) {}
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
        return a.localeCompare(b);
      });

      const lines = [
        `📂 **Folder Listing:** \`${dir}\` (${items.length} items)\n`
      ];

      const displayItems = items.slice(0, 45);
      displayItems.forEach(item => {
        try {
          const s = fs.statSync(path.join(dir, item));
          if (s.isDirectory()) {
            lines.push(`- 📁 **${item}/**`);
          } else {
            const kb = (s.size / 1024).toFixed(1);
            lines.push(`- 📄 \`${item}\` (${kb} KB)`);
          }
        } catch (_) {
          lines.push(`- 📄 \`${item}\``);
        }
      });

      if (items.length > 45) {
        lines.push(`\n*...aur ${items.length - 45} mazeed items mojood hain.*`);
      }

      return lines.join('\n');
    } catch (err) {
      return `❌ **ls Error:** ${err.message}`;
    }
  }

  static readFile(query, currentDir = HOME_DIR) {
    let target = (query || '').replace(/^(cat|view|read|file parho|file dikhao)\s+/i, '').trim();
    if (!target) {
      return '⚠️ Barah-e-karam file ka naam batayein (e.g. `cat package.json`).';
    }
    const filePath = this.resolvePath(target, currentDir);
    if (!fs.existsSync(filePath)) {
      return `❌ **Error:** File mojood nahi hai:\n\`${filePath}\``;
    }
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return `❌ **Error:** Yeh folder hai, file nahi:\n\`${filePath}\``;
      }
      if (stat.size > 200 * 1024) {
        return `⚠️ **File Too Large:** File ka size ${(stat.size / 1024).toFixed(1)} KB hai. Output overflow se bachne ke liye choti files parhein.`;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).replace('.', '') || 'text';
      const lines = content.split('\n');
      const preview = lines.slice(0, 120).join('\n');
      const truncatedNotice = lines.length > 120 ? `\n\n*(Truncated: Total ${lines.length} lines mein se pehli 120 lines dikhai gayi hain.)*` : '';

      return (
        `📄 **File Content:** \`${path.basename(filePath)}\` (${(stat.size / 1024).toFixed(1)} KB, ${lines.length} lines)\n\n` +
        `\`\`\`${ext}\n${preview}\n\`\`\`` +
        truncatedNotice
      );
    } catch (err) {
      return `❌ **cat Error:** ${err.message}`;
    }
  }

  static viewTree(query = '', currentDir = HOME_DIR) {
    let target = (query || '').replace(/^(tree|folder tree)\s*/i, '').trim();
    const rootDir = target ? this.resolvePath(target, currentDir) : currentDir;
    if (!fs.existsSync(rootDir)) {
      return `❌ **Error:** Folder mojood nahi hai: \`${rootDir}\``;
    }

    try {
      const lines = [`🌲 **Folder Structure Tree:** \`${rootDir}\`\n`];

      const traverse = (dir, depth = 0, prefix = '') => {
        if (depth >= 2) return;
        let items = [];
        try { items = fs.readdirSync(dir); } catch (_) { return; }
        items = items.filter(i => !['node_modules', '.git', '.cache', '.gemini'].includes(i)).slice(0, 20);

        items.forEach((item, index) => {
          const isLast = index === items.length - 1;
          const fullPath = path.join(dir, item);
          let isDir = false;
          try { isDir = fs.statSync(fullPath).isDirectory(); } catch (_) {}

          lines.push(`${prefix}${isLast ? '└── ' : '├── '}${isDir ? '📁 ' + item + '/' : '📄 ' + item}`);
          if (isDir) {
            traverse(fullPath, depth + 1, prefix + (isLast ? '    ' : '│   '));
          }
        });
      };

      traverse(rootDir);
      return '```\n' + lines.join('\n') + '\n```';
    } catch (err) {
      return `❌ **tree Error:** ${err.message}`;
    }
  }

  static searchFiles(query, currentDir = HOME_DIR) {
    let term = (query || '').trim();
    term = term.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    term = term.replace(/^(?:find|dhoondo|search\s+file|search|locate|where\s+is)\s+/i, '').trim();
    term = term.replace(/\s*(?:folder|file)?\s*(?:kahan\s+(?:hai|hay|he|h[ou]+n)|kidhar\s+(?:hai|hay)).*$/i, '').trim();
    term = term.replace(/^(?:folder|file)\s+/i, '').trim();
    term = term.replace(/\s+(?:folder|file)\s*$/i, '').trim();

    if (!term) return '⚠️ Barah-e-karam search term likhein (e.g. `find config` ya `public folder kahan hay`).';

    this.ensurePhoneDir();
    const searchRoots = [
      { name: 'Current Directory', path: currentDir },
      { name: 'Home Folder', path: HOME_DIR },
      { name: 'Jena Project', path: path.join(HOME_DIR, 'jena') },
      { name: 'Phone Storage', path: PHONE_DIR }
    ];

    const seenPaths = new Set();
    const matches = [];

    const searchDir = (dir, depth = 0) => {
      if (depth >= 3 || matches.length >= 25) return;
      let items = [];
      try { items = fs.readdirSync(dir); } catch (_) { return; }
      for (const item of items) {
        if (['node_modules', '.git', '.cache', '.gemini'].includes(item)) continue;
        const fullPath = path.join(dir, item);
        if (seenPaths.has(fullPath)) continue;
        seenPaths.add(fullPath);

        if (item.toLowerCase().includes(term.toLowerCase())) {
          let isDir = false;
          try { isDir = fs.statSync(fullPath).isDirectory(); } catch (_) {}
          matches.push({ path: fullPath, isDir });
        }
        try {
          if (fs.statSync(fullPath).isDirectory()) searchDir(fullPath, depth + 1);
        } catch (_) {}
      }
    };

    for (const root of searchRoots) {
      if (fs.existsSync(root.path)) {
        searchDir(root.path, 0);
      }
    }

    if (matches.length === 0) {
      return `🔍 \`${term}\` ke sath koi file ya folder nahi mila (CWD, Home, aur Phone storage check kiye).`;
    }

    const lines = [
      `🔍 **Search Results for "${term}":**\n`
    ];
    matches.forEach(m => {
      lines.push(`- ${m.isDir ? '📁' : '📄'} \`${m.path}\``);
    });
    return lines.join('\n');
  }

  static makeDirectory(query, currentDir = HOME_DIR) {
    let target = (query || '').replace(/^(mkdir|folder banao)\s+/i, '').trim();
    if (!target) return '⚠️ Barah-e-karam folder ka naam batayein (e.g. `mkdir my_folder`).';
    const fullPath = this.resolvePath(target, currentDir);
    try {
      if (fs.existsSync(fullPath)) return `⚠️ Yeh folder pehle se mojood hai:\n\`${fullPath}\``;
      fs.mkdirSync(fullPath, { recursive: true });
      return `✅ **Folder Created:** \`${fullPath}\``;
    } catch (e) {
      return `❌ **mkdir Error:** ${e.message}`;
    }
  }

  static createFile(query, currentDir = HOME_DIR) {
    let target = (query || '').replace(/^(touch|file banao)\s+/i, '').trim();
    if (!target) return '⚠️ Barah-e-karam file ka naam batayein (e.g. `touch notes.txt`).';
    const fullPath = this.resolvePath(target, currentDir);
    try {
      if (fs.existsSync(fullPath)) return `⚠️ Yeh file pehle se mojood hai:\n\`${fullPath}\``;
      fs.writeFileSync(fullPath, '', 'utf8');
      return `✅ **File Created:** \`${fullPath}\``;
    } catch (e) {
      return `❌ **touch Error:** ${e.message}`;
    }
  }

  static transferItem(query, defaultIsMove = false, currentDir = HOME_DIR) {
    let q = (query || '').trim().replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();

    let isMove = defaultIsMove;
    if (/\b(?:move|mv|cut|hata\s*k|le\s*jao)\b/i.test(q)) {
      isMove = true;
    } else if (/\b(?:copy|cp|paste)\b/i.test(q)) {
      isMove = false;
    }

    // Strip flags like -r, -rf, -f, -a, -v
    q = q.replace(/^(?:cp|mv|copy|move)\s+-[a-zA-Z]+\s+/i, (match) => {
      return match.includes('mv') ? 'mv ' : 'cp ';
    });

    let src = '';
    let dest = '';
    let item = '';
    let srcDir = '';
    let destDir = '';

    let m = q.match(/^(?:cp|copy|mv|move)?\s*from\s+([a-zA-Z0-9_\-\/~.]+)\s+to\s+([a-zA-Z0-9_\-\/~.]+)\s+(?:copy|move|karo|kardo)?\s*(.+)$/i);
    if (m) {
      srcDir = m[1].trim();
      destDir = m[2].trim();
      item = m[3].replace(/\s*(?:copy|move|karo|kardo|karein)\s*$/i, '').trim();
    }

    if (!srcDir) {
      m = q.match(/^(?:cp|copy|mv|move)?\s*(.+?)\s+from\s+([a-zA-Z0-9_\-\/~.]+)\s+to\s+([a-zA-Z0-9_\-\/~.]+)(?:\s+(?:copy|move|karo|kardo))?$/i);
      if (m) {
        item = m[1].trim();
        srcDir = m[2].trim();
        destDir = m[3].trim();
      }
    }

    if (!srcDir) {
      m = q.match(/^([a-zA-Z0-9_\-\/~.]+)\s+se\s+(.+?)\s+([a-zA-Z0-9_\-\/~.]+)\s+(?:main|mein|par)\s*(?:copy|move|paste)?\s*(?:karo|kardo|karein)?$/i);
      if (m) {
        srcDir = m[1].trim();
        item = m[2].trim();
        destDir = m[3].trim();
      }
    }

    if (!srcDir && !src) {
      m = q.match(/^(.+?)\s+(?:folder\s+|file\s+)?ko\s+([a-zA-Z0-9_\-\/~.]+)\s+(?:main|mein|par)\s*(?:copy|move|paste)\s*(?:karo|kardo|karein)?$/i);
      if (m) {
        item = m[1].trim();
        dest = m[2].trim();
      }
    }

    if (!srcDir && !src) {
      m = q.match(/^(?:cp|copy|mv|move)\s+(?:folder\s+|file\s+)?(.+?)\s+(?:paste\s+in|to|into)\s+(.+)$/i);
      if (m) {
        src = m[1].trim();
        dest = m[2].trim();
      }
    }

    if (!srcDir && !src) {
      m = q.match(/^(?:cp|mv)\s+(.+?)\s+(.+)$/i);
      if (m) {
        src = m[1].trim();
        dest = m[2].trim();
      }
    }

    if (!srcDir && !src) {
      m = q.match(/^(?:copy|move)\s+(.+?)\s+(phone|home|termux|storage\/[a-zA-Z0-9_\-]+|termux-to-phone)$/i);
      if (m) {
        src = m[1].trim();
        dest = m[2].trim();
      }
    }

    if (!srcDir && !src) {
      m = q.match(/^([a-zA-Z0-9_\-\/~.]+)\s+se\s+(.+?)\s*(?:copy|move|paste)\s*(?:karo|kardo|karein)?$/i);
      if (m) {
        srcDir = m[1].trim();
        item = m[2].trim();
        destDir = currentDir;
      }
    }

    if (!srcDir && !src && !item) {
      m = q.match(/^(.+?)\s+([a-zA-Z0-9_\-\/~.]+)\s+(?:main|mein|par)\s*(?:copy|move|paste)\s*(?:karo|kardo|karein)?$/i);
      if (m) {
        item = m[1].trim();
        dest = m[2].trim();
      }
    }

    if (srcDir && destDir && item) {
      item = item.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      const baseSrc = this.resolvePath(srcDir, currentDir);
      src = path.join(baseSrc, item);
      dest = this.resolvePath(destDir, currentDir);
    } else if (src && dest) {
      src = src.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      dest = dest.replace(/\s*(?:main|mein|k\s+andar|ke\s+andar)\s*$/i, '').trim();
      dest = dest.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      src = this.resolvePath(src, currentDir);
      dest = this.resolvePath(dest, currentDir);
    } else if (item && dest) {
      item = item.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      dest = dest.replace(/\s*(?:main|mein|k\s+andar|ke\s+andar)\s*$/i, '').trim();
      dest = dest.replace(/^(?:folder|file)\s+/i, '').replace(/\s+(?:folder|file)\s*$/i, '').trim();
      src = this.resolvePath(item, currentDir);
      dest = this.resolvePath(dest, currentDir);
    }

    if (!src || !dest) {
      return (
        `⚠️ Barah-e-karam source aur destination batayein.\n` +
        `- **Misal:** \`copy public folder to phone\`\n` +
        `- **Misal:** \`copy from phone to home app.js\`\n` +
        `- **Misal:** \`move app.js to home\`\n` +
        `- **Misal:** \`phone se public home main copy karo\``
      );
    }

    let resolvedSrc = src;
    if (!fs.existsSync(resolvedSrc)) {
      const candidates = [
        path.join(currentDir, path.basename(src)),
        path.join(HOME_DIR, path.basename(src)),
        path.join(HOME_DIR, 'jena', path.basename(src)),
        path.join(PHONE_DIR, path.basename(src)),
        path.join(HOME_DIR, 'storage/downloads', path.basename(src))
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          resolvedSrc = cand;
          break;
        }
      }
    }

    if (!fs.existsSync(resolvedSrc)) {
      return `❌ **${isMove ? 'Move' : 'Copy'} Error:** Source file ya folder mojood nahi mila:\n\`${src}\``;
    }

    let resolvedDest = dest;
    this.ensurePhoneDir();

    let targetDest = resolvedDest;
    try {
      const srcStat = fs.statSync(resolvedSrc);
      const isDir = srcStat.isDirectory();

      if (fs.existsSync(resolvedDest)) {
        const destStat = fs.statSync(resolvedDest);
        if (destStat.isDirectory()) {
          targetDest = path.join(resolvedDest, path.basename(resolvedSrc));
        }
      } else {
        const parentDir = path.dirname(resolvedDest);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
      }

      if (path.resolve(resolvedSrc) === path.resolve(targetDest)) {
        return `⚠️ **Ooper:** Source aur Destination dono aik hi path hain:\n\`${resolvedSrc}\``;
      }

      if (isMove) {
        try {
          fs.renameSync(resolvedSrc, targetDest);
        } catch (renameErr) {
          if (renameErr.code === 'EXDEV' || renameErr.code === 'EPERM' || renameErr.code === 'EACCES') {
            fs.cpSync(resolvedSrc, targetDest, { recursive: true });
            fs.rmSync(resolvedSrc, { recursive: true, force: true });
          } else {
            throw renameErr;
          }
        }
      } else {
        fs.cpSync(resolvedSrc, targetDest, { recursive: true });
      }

      // Sync Android media scanner if copied or moved to/from phone storage
      if (targetDest.startsWith('/storage/emulated/0') || targetDest.includes('termux-to-phone')) {
        exec(`/data/data/com.termux/files/usr/bin/termux-media-scan "${targetDest}" 2>/dev/null`, () => {});
      }
      if (isMove && (resolvedSrc.startsWith('/storage/emulated/0') || resolvedSrc.includes('termux-to-phone'))) {
        exec(`/data/data/com.termux/files/usr/bin/termux-media-scan "${resolvedSrc}" 2>/dev/null`, () => {});
      }

      return (
        `${isMove ? '🚚' : '📋'} **${isMove ? 'Move' : 'Copy'} Kamyabi Se Mukammal!**\n` +
        `- 📦 **Type:** ${isDir ? '📁 Folder' : '📄 File'}\n` +
        `- 🟢 **Source:** \`${resolvedSrc}\`\n` +
        `- 🎯 **Destination:** \`${targetDest}\`\n\n` +
        `*(Files foran transfer ho chuki hain. Phone storage \`termux-to-phone\` files aapke mobile file manager ya apps mein foran dastiyab hain.)*`
      );
    } catch (err) {
      return `❌ **${isMove ? 'Move' : 'Copy'} Error:** ${err.message}`;
    }
  }

  static deleteItem(query, currentDir = HOME_DIR) {
    let q = (query || '').trim().replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    let target = q.replace(/^(?:rm(?:\s+-[a-zA-Z]+)?|remove|delete|mitao)\s+/i, '').trim();
    target = target.replace(/\s*(?:ko\s+)?(?:delete|remove|mita)\s*(?:karo|kardo|karein)?$/i, '').trim();
    target = target.replace(/^(?:file|folder)\s+/i, '').trim();
    if (!target) return '⚠️ Barah-e-karam delete karne ke liye file ya folder ka naam batayein (e.g. `rm filename.txt`).';
    const resolved = this.resolvePath(target, currentDir);
    if (!fs.existsSync(resolved)) {
      return `⚠️ File ya folder pehle se mojood nahi hai:\n\`${resolved}\``;
    }
    try {
      const isDir = fs.statSync(resolved).isDirectory();
      fs.rmSync(resolved, { recursive: true, force: true });
      return `🗑️ **Delete Successful:** \`${resolved}\` (${isDir ? 'Folder' : 'File'} delete ho gaya).`;
    } catch (e) {
      return `❌ **Delete Error:** ${e.message}`;
    }
  }
}

module.exports = {
  FsTools
};
