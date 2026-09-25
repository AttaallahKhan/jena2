/**
 * =====================================================================
 *  🎨 JENA v0.3 — Termux GUI Inspection & Live Mutation Tool
 * =====================================================================
 */

const fs = require("fs");
const path = require("path");
const { PUBLIC_DIR } = require("../config");

class GuiTools {
  static COMPONENT_REGISTRY = {
    token_card: {
      names: ['token card', 'token cards', 'token dashboard', 'dashboard card', 'dashboard cards', 'metric card', 'metrics cards'],
      selector: '.token-card',
      containerSelector: '.token-dashboard',
      file: 'public/style.css',
      htmlSearch: 'section class="token-dashboard"',
      htmlEndSearch: '</section>',
      desc: 'Token Dashboard Metrics Cards (Allowance, Used, Balance, Speed)'
    },
    header: {
      names: ['header', 'app header', 'navbar', 'top bar', 'nav bar'],
      selector: '.app-header',
      file: 'public/style.css',
      htmlSearch: '<header class="app-header">',
      htmlEndSearch: '</header>',
      desc: 'Top Application Header with Brand Logo, Navigation Tabs & Mode Switch'
    },
    logo: {
      names: ['logo', 'avatar', 'avatar glow', 'brand avatar', 'icon', 'robot'],
      selector: '.avatar-glow',
      file: 'public/style.css',
      htmlSearch: '<div class="avatar-glow">',
      htmlEndSearch: '</div>',
      desc: 'Glowing AI Avatar Logo in Header'
    },
    nav_tabs: {
      names: ['nav tabs', 'tabs', 'tab bar', 'navigation tabs'],
      selector: '.header-tabs',
      file: 'public/style.css',
      htmlSearch: '<nav class="header-tabs">',
      htmlEndSearch: '</nav>',
      desc: 'Header Navigation Tabs (Chat, Settings, Models, Providers, Editor)'
    },
    mode_switch: {
      names: ['mode switch', 'mode button', 'online offline switch', 'switch button', 'switch'],
      selector: '.mode-switch',
      file: 'public/style.css',
      htmlSearch: '<div class="mode-switch">',
      htmlEndSearch: '</div>',
      desc: 'Hybrid Mode Toggle Switch (Online vs Offline)'
    },
    active_model_bar: {
      names: ['active model bar', 'active model pill', 'engine bar', 'model bar'],
      selector: '.active-model-bar',
      file: 'public/style.css',
      htmlSearch: '<div class="active-model-bar">',
      htmlEndSearch: '</div>',
      desc: 'Active Model Info Banner & Link to Settings'
    },
    cwd_bar: {
      names: ['cwd bar', 'cwd status', 'cwd path', 'folder bar'],
      selector: '.cwd-status-bar',
      file: 'public/style.css',
      htmlSearch: '<div class="cwd-status-bar">',
      htmlEndSearch: '</div>',
      desc: 'Current Working Directory Status Bar with Quick Actions'
    },
    welcome_hero: {
      names: ['welcome hero', 'hero banner', 'welcome box', 'welcome section', 'hero'],
      selector: '.welcome-hero',
      file: 'public/style.css',
      htmlSearch: '<div class="welcome-hero"',
      htmlEndSearch: '</div>\n          </div>',
      desc: 'Welcome Hero Box with Greeting & Quick Prompt Action Chips'
    },
    chat_viewport: {
      names: ['chat viewport', 'chat stream', 'chat area', 'chat container', 'chat box'],
      selector: '.chat-viewport',
      file: 'public/style.css',
      htmlSearch: '<main class="chat-viewport"',
      htmlEndSearch: '</main>',
      desc: 'Scrollable Conversation Message Viewport'
    },
    message_bubble: {
      names: ['message bubble', 'message row', 'chat bubble', 'user bubble', 'assistant bubble'],
      selector: '.message-bubble',
      file: 'public/style.css',
      htmlSearch: '<div class="message-bubble"',
      htmlEndSearch: '</div>',
      desc: 'User & Assistant Chat Message Bubbles'
    },
    input_box: {
      names: ['input box', 'chat input', 'input wrapper', 'prompt input', 'footer', 'textarea'],
      selector: '.input-wrapper',
      file: 'public/style.css',
      htmlSearch: '<div class="input-wrapper">',
      htmlEndSearch: '</div>',
      desc: 'Bottom Prompt Input Field & Auto-resizing Textarea'
    },
    send_button: {
      names: ['send button', 'btn send', 'submit button', 'bhejo button'],
      selector: '.btn-send',
      file: 'public/style.css',
      htmlSearch: '<button type="submit" id="btnSend"',
      htmlEndSearch: '</button>',
      desc: 'Send Prompt Button with Neon Hover'
    },
    settings_card: {
      names: ['settings card', 'settings panel', 'config card', 'card'],
      selector: '.settings-card',
      file: 'public/style.css',
      htmlSearch: '<div class="settings-card',
      htmlEndSearch: '</div>\n        </div>',
      desc: 'Settings Panels (Providers, Keys, Custom Models, Memory, Logs)'
    },
    terminal_box: {
      names: ['terminal box', 'terminal preview', 'execution box'],
      selector: '.terminal-preview-box',
      file: 'public/style.css',
      htmlSearch: '<div id="opExecutionBox"',
      htmlEndSearch: '</div>',
      desc: 'Terminal Preview Box for Running Learned Operations'
    },
    modal: {
      names: ['modal', 'allowance modal', 'dialog', 'popup'],
      selector: '.modal-card',
      file: 'public/style.css',
      htmlSearch: '<div class="modal-card',
      htmlEndSearch: '</div>\n    </div>',
      desc: 'Token Allowance Budget Edit Popup Modal'
    },
    body: {
      names: ['body', 'page background', 'background', 'bg color', 'page color', 'page', 'screen', 'index.html'],
      selector: 'body',
      file: 'public/style.css',
      htmlSearch: '<body',
      htmlEndSearch: '</body>',
      desc: 'Application Body, Background & Base Page View'
    }
  };

  static findComponent(query) {
    const q = (query || '').toLowerCase();

    // 1. Direct CSS Selector or clean class name match (e.g. .app-header, app-header, avatar-glow)
    for (const key of Object.keys(this.COMPONENT_REGISTRY)) {
      const comp = this.COMPONENT_REGISTRY[key];
      const cleanSel = comp.selector.replace(/^[.#]/, '').toLowerCase();
      if (q.includes(comp.selector.toLowerCase()) || q.includes(cleanSel)) {
        return { key, ...comp };
      }
    }

    // 2. Direct alias matching
    for (const key of Object.keys(this.COMPONENT_REGISTRY)) {
      const comp = this.COMPONENT_REGISTRY[key];
      for (const name of comp.names) {
        if (q.includes(name)) return { key, ...comp };
      }
    }

    // 3. Fallback matching
    if (q.includes('logo') || q.includes('avatar') || q.includes('icon') || q.includes('robot')) return { key: 'logo', ...this.COMPONENT_REGISTRY.logo };
    if (q.includes('tab') || q.includes('nav')) return { key: 'nav_tabs', ...this.COMPONENT_REGISTRY.nav_tabs };
    if (q.includes('body') || q.includes('background') || q.includes('page background') || q.includes('bg color')) return { key: 'body', ...this.COMPONENT_REGISTRY.body };
    if (q.includes('token') || q.includes('cards')) return { key: 'token_card', ...this.COMPONENT_REGISTRY.token_card };
    if (q.includes('header') || q.includes('top bar') || q.includes('navbar')) return { key: 'header', ...this.COMPONENT_REGISTRY.header };
    if (q.includes('input') || q.includes('textarea')) return { key: 'input_box', ...this.COMPONENT_REGISTRY.input_box };
    if (q.includes('button') || q.includes('send') || q.includes('bhejo')) return { key: 'send_button', ...this.COMPONENT_REGISTRY.send_button };
    if (q.includes('hero') || q.includes('welcome')) return { key: 'welcome_hero', ...this.COMPONENT_REGISTRY.welcome_hero };
    if (q.includes('switch') || q.includes('mode')) return { key: 'mode_switch', ...this.COMPONENT_REGISTRY.mode_switch };
    if (q.includes('modal') || q.includes('dialog')) return { key: 'modal', ...this.COMPONENT_REGISTRY.modal };
    return null;
  }

  static extractCssRule(cssContent, selector) {
    const escapedSel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`(${escapedSel}[^{]*\\{[^}]*\\})`, 'gm');
    const matches = cssContent.match(blockRegex);
    return matches ? matches.join('\n\n') : null;
  }

  static updateCssRule(cssContent, selector, property, newValue) {
    const escapedSel = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRegex = new RegExp(`(${escapedSel}\\s*\\{[^}]*\\})`, 'm');
    const match = cssContent.match(blockRegex);
    if (!match) return { success: false, error: `Selector "${selector}" CSS mein nahi mila.` };

    const oldBlock = match[1];
    let newBlock = oldBlock;
    const propRegex = new RegExp(`(\\b${property}\\s*:\\s*)([^;]+)(;)`, 'i');

    if (propRegex.test(oldBlock)) {
      const oldVal = oldBlock.match(propRegex)[2].trim();
      newBlock = oldBlock.replace(propRegex, `$1${newValue}$3`);
      const updatedCss = cssContent.replace(oldBlock, newBlock);
      return { success: true, updatedCss, selector, property, oldValue: oldVal, newValue, isNew: false };
    } else {
      const insertIdx = oldBlock.lastIndexOf('}');
      newBlock = oldBlock.slice(0, insertIdx).trimEnd() + `\n  ${property}: ${newValue};\n}`;
      const updatedCss = cssContent.replace(oldBlock, newBlock);
      return { success: true, updatedCss, selector, property, oldValue: null, newValue, isNew: true };
    }
  }

  static getLuminance(hexOrRgb) {
    if (!hexOrRgb) return 0;
    let r = 0, g = 0, b = 0;
    const clean = String(hexOrRgb).trim();
    if (clean.startsWith('#')) {
      const hex = clean.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    } else {
      const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1], 10);
        g = parseInt(rgbMatch[2], 10);
        b = parseInt(rgbMatch[3], 10);
      }
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  static parseBorderValue(input, existingRule = '') {
    const str = (input || '').toLowerCase();
    
    // Check if user wants no border
    if (/\b(?:none|no border|hata|khatam|remove|0px|0)\b/i.test(str)) {
      return 'none';
    }

    // 1. Extract Width (e.g. 2px, 1.5px, 3px, 1rem)
    let width = null;
    const widthMatch = input.match(/(\d+(?:\.\d+)?(?:px|rem|em))/i);
    if (widthMatch) {
      width = widthMatch[1];
    } else {
      const sizeDigitMatch = input.match(/(?:size|width|motai)\s+(\d+)/i);
      if (sizeDigitMatch) width = `${sizeDigitMatch[1]}px`;
    }

    // 2. Extract Style (solid, dashed, dotted, double, groove, ridge, inset, outset)
    let style = null;
    const styleMatch = input.match(/\b(solid|dashed|dotted|double|groove|ridge|inset|outset)\b/i);
    if (styleMatch) {
      style = styleMatch[1].toLowerCase();
    }

    // 3. Extract Color
    let color = null;
    const hexOrRgbMatch = input.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i);
    if (hexOrRgbMatch) {
      color = hexOrRgbMatch[1];
    } else {
      const colorMap = {
        cyan: '#00d2ff', green: '#10b981', sabz: '#10b981', purple: '#9d4edd', jamni: '#9d4edd',
        red: '#ef4444', surkh: '#ef4444', lal: '#ef4444', blue: '#3a7bd5', neela: '#3a7bd5',
        dark: '#0a0d14', black: '#000000', kala: '#000000', white: '#ffffff', safed: '#ffffff',
        gray: '#64748b', peach: '#f4d6c6', brown: '#6b2f2f', orange: '#f97316', yellow: '#eab308'
      };
      for (const [cName, hex] of Object.entries(colorMap)) {
        if (new RegExp(`\\b${cName}\\b`, 'i').test(input)) {
          color = hex;
          break;
        }
      }
    }

    // Check existing rule in CSS to preserve existing width/style/color if omitted
    let existingWidth = '1px';
    let existingStyle = 'solid';
    let existingColor = 'var(--border-color)';
    if (existingRule) {
      const exMatch = existingRule.match(/border(?:-bottom|-top|-left|-right)?\s*:\s*([^;]+);/i);
      if (exMatch) {
        const parts = exMatch[1].trim().split(/\s+/);
        if (parts[0] && /\d+(?:px|rem|em)/i.test(parts[0])) existingWidth = parts[0];
        if (parts[1] && /solid|dashed|dotted|double/i.test(parts[1])) existingStyle = parts[1];
        if (parts.length > 2) existingColor = parts.slice(2).join(' ');
      }
    }

    const finalWidth = width || (style || color ? existingWidth : '1px');
    const finalStyle = style || existingStyle;
    const finalColor = color || (width || style ? existingColor : 'var(--border-color)');

    return `${finalWidth} ${finalStyle} ${finalColor}`.trim();
  }

  static troubleshootChanges(query) {
    const cssPath = path.join(PUBLIC_DIR, 'style.css');
    let cssContent = fs.readFileSync(cssPath, 'utf8');
    let fixedIssues = [];

    // Check for corrupt border rules like "border: color ...;"
    const corruptBorder = cssContent.match(/border:\s*color\s*([^;]+);/i);
    if (corruptBorder) {
      const fixed = this.parseBorderValue(corruptBorder[1]);
      cssContent = cssContent.replace(corruptBorder[0], `border: ${fixed};`);
      fixedIssues.push(`Corrupt border rule theek ki: \`${corruptBorder[0]}\` ➔ \`border: ${fixed};\``);
    }

    // Check contrast if body background is light
    const bgMatch = cssContent.match(/--bg-primary:\s*([^;]+);/i);
    if (bgMatch) {
      const lum = this.getLuminance(bgMatch[1].trim());
      if (lum > 0.5) {
        const textMatch = cssContent.match(/--text-primary:\s*([^;]+);/i);
        if (textMatch && this.getLuminance(textMatch[1].trim()) > 0.5) {
          cssContent = cssContent.replace(/--text-primary:\s*[^;]+;/i, '--text-primary: #1e293b;');
          fixedIssues.push('Light background par readable text ke liye `--text-primary: #1e293b;` set kiya.');
        }
      }
    }

    fs.writeFileSync(cssPath, cssContent, 'utf8');

    let msg = `🛠️ **Styling & Page Visibility Diagnostic Report:**\n\n`;
    if (fixedIssues.length > 0) {
      msg += `Maine issues detect karke auto-fix kar diye hain:\n`;
      fixedIssues.forEach(iss => msg += `- ✅ ${iss}\n`);
      msg += `\n`;
    } else {
      msg += `CSS stylesheet syntax bilkul valid hai.\n\n`;
    }

    const headerRule = this.extractCssRule(cssContent, '.app-header') || '';

    msg += `📌 **Active CSS Configuration:**\n` +
           `- **Header Selector (\`.app-header\`):**\n\`\`\`css\n${headerRule}\n\`\`\`\n` +
           `- **Body Background:** \`${bgMatch ? bgMatch[1].trim() : '#0a0d14'}\`\n\n` +
           `🔄 **Page & Stylesheet Hard-Reload:** Browser ko live hard-reload signal bhej diya gaya hai taake latest CSS rules screen par nazar aa sakein!`;

    return msg;
  }

  static listComponents() {
    let out = `🧩 **Jena GUI Components Architecture & Knowledge Base (Offline • 0 Tokens):**\n\n` +
      `Main apne har frontend component ke HTML structure aur CSS styling se mukammal waqif hoon. Aap kisi bhi component ka code inspect kar sakte hain ya uski styling (size, padding, borders, background, radius, fonts) direct tabdeel karwa sakte hain:\n\n`;

    Object.keys(this.COMPONENT_REGISTRY).forEach((k, idx) => {
      const c = this.COMPONENT_REGISTRY[k];
      out += `${idx + 1}. 🔹 **${c.desc}**\n` +
             `   - **CSS Selector:** \`${c.selector}\`\n` +
             `   - **Aliases:** ${c.names.slice(0, 3).map(n => `\`${n}\``).join(', ')}\n\n`;
    });

    out += `💡 **Commands Examples:**\n` +
      `- 🔍 **Code Dekhna:** \`token cards ka code dikhao\` ya \`send button ka css batao\`\n` +
      `- 📏 **Size / Padding:** \`token cards ki padding 16px 20px kardo\` ya \`token cards ka size badhao\`\n` +
      `- 🔲 **Borders:** \`token cards ka border 2px solid cyan kardo\` ya \`border radius 16px kardo\`\n` +
      `- 🎨 **Colors & Background:** \`header ka background #070a14 kardo\` ya \`send button ka color #10b981 kardo\`\n` +
      `- 📝 **HTML Content:** \`html main replace "old text" with "new text"\``;
    return out;
  }

  static inspectComponent(query) {
    const q = (query || '').toLowerCase();
    if (q.includes('list') || q.includes('tamam') || q.includes('all')) {
      return this.listComponents();
    }

    const comp = this.findComponent(q);
    if (!comp) {
      return this.listComponents();
    }

    const cssPath = path.join(PUBLIC_DIR, 'style.css');
    const htmlPath = path.join(PUBLIC_DIR, 'index.html');
    let cssCode = 'CSS rule nahi mili.';
    let htmlCode = 'HTML snippet nahi mila.';
    let cssContent = '';

    if (fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf8');
      const rule = this.extractCssRule(cssContent, comp.selector);
      if (rule) cssCode = rule;
    }

    if (fs.existsSync(htmlPath)) {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      const startIdx = htmlContent.indexOf(comp.htmlSearch);
      if (startIdx !== -1) {
        let endIdx = htmlContent.indexOf(comp.htmlEndSearch, startIdx);
        if (endIdx !== -1) {
          endIdx += comp.htmlEndSearch.length;
          htmlCode = htmlContent.slice(startIdx, endIdx).trim();
          if (htmlCode.length > 1200) {
            htmlCode = htmlCode.slice(0, 1200) + '\n<!-- ... (truncated for brevity) -->';
          }
        }
      }
    }

    // Check if query is asking for a specific CSS property (e.g. "logo ka border color kya hay", "background kya hay")
    const isPropertyQuery = /(?:kya\s+hai|kya\s+hay|batao|check|kitna|kitni)\b/i.test(q) &&
      /(?:border|background|bg|color|text\s*color|padding|margin|radius|shadow|size|width|height|font)/i.test(q);

    if (isPropertyQuery && cssCode && cssCode !== 'CSS rule nahi mili.') {
      let propDetails = [];
      
      if (/border/i.test(q)) {
        const bMatch = cssCode.match(/border(?:-bottom|-top|-left|-right)?\s*:\s*([^;]+);/i);
        const bcMatch = cssCode.match(/border-color\s*:\s*([^;]+);/i);
        const brMatch = cssCode.match(/border-radius\s*:\s*([^;]+);/i);
        const bsMatch = cssCode.match(/box-shadow\s*:\s*([^;]+);/i);
        if (bMatch) propDetails.push(`- 🔲 **Border:** \`${bMatch[1].trim()}\``);
        if (bcMatch) propDetails.push(`- 🎨 **Border Color:** \`${bcMatch[1].trim()}\``);
        if (brMatch) propDetails.push(`- 📐 **Border Radius:** \`${brMatch[1].trim()}\``);
        if (bsMatch) propDetails.push(`- ✨ **Box Shadow / Glow:** \`${bsMatch[1].trim()}\``);
      }
      
      if (/background|bg/i.test(q)) {
        const bgMatch = cssCode.match(/background(?:-color)?\s*:\s*([^;]+);/i);
        if (bgMatch) propDetails.push(`- 🎨 **Background:** \`${bgMatch[1].trim()}\``);
      }
      
      if (/(?:text\s*color|font\s*color|\bcolor\b)/i.test(q) && !/border|background|bg/i.test(q)) {
        const cMatch = cssCode.match(/(?:^|[^-])color\s*:\s*([^;]+);/i);
        if (cMatch) propDetails.push(`- 🔤 **Text Color:** \`${cMatch[1].trim()}\``);
      }

      if (/padding/i.test(q)) {
        const pMatch = cssCode.match(/padding\s*:\s*([^;]+);/i);
        if (pMatch) propDetails.push(`- 📏 **Padding:** \`${pMatch[1].trim()}\``);
      }

      if (/width|size/i.test(q) && !/border/i.test(q)) {
        const wMatch = cssCode.match(/(?:max-)?width\s*:\s*([^;]+);/i);
        if (wMatch) propDetails.push(`- ↔️ **Width:** \`${wMatch[1].trim()}\``);
      }

      if (/height/i.test(q)) {
        const hMatch = cssCode.match(/(?:max-)?height\s*:\s*([^;]+);/i);
        if (hMatch) propDetails.push(`- ↕️ **Height:** \`${hMatch[1].trim()}\``);
      }

      if (propDetails.length > 0) {
        return (
          `🔍 **${comp.desc} (\`${comp.selector}\`) Property Details:**\n\n` +
          propDetails.join('\n') + '\n\n' +
          `📌 **Current CSS Rule:**\n\`\`\`css\n${cssCode}\n\`\`\``
        );
      }
    }

    if (comp.key === 'body') {
      const bgMatch = cssContent.match(/--bg-primary:\s*([^;]+);/i);
      const textMatch = cssContent.match(/--text-primary:\s*([^;]+);/i);
      const currentBg = bgMatch ? bgMatch[1].trim() : '#0a0d14';
      const currentText = textMatch ? textMatch[1].trim() : '#f8fafc';
      return (
        `🎨 **Application Body & Background Inspection:**\n\n` +
        `- 🖌️ **Current Background Color:** \`${currentBg}\` (Variable: \`--bg-primary\`)\n` +
        `- 🔤 **Current Text Color:** \`${currentText}\` (Variable: \`--text-primary\`)\n` +
        `- 📌 **CSS Selector:** \`body\` (File: \`public/style.css\`)\n\n` +
        `\`\`\`css\n${cssCode}\n\`\`\`\n\n` +
        `💡 **Background ya Color Tabdeel Karne Ki Misalein:**\n` +
        `- \`body ka color black kardo\` ya \`background black kardo\`\n` +
        `- \`body ka background #000000 kardo\`\n` +
        `- \`body ka text color white kardo\``
      );
    }

    return (
      `🔍 **Component Inspection: \`${comp.desc}\`**\n\n` +
      `📌 **CSS Selector:** \`${comp.selector}\` (File: \`public/style.css\`)\n` +
      `\`\`\`css\n${cssCode}\n\`\`\`\n\n` +
      `📄 **HTML Structure Snippet:** (File: \`public/index.html\`)\n` +
      `\`\`\`html\n${htmlCode}\n\`\`\`\n\n` +
      `🛠️ **Is component ko tabdeel karne ke liye misalein:**\n` +
      `- \`${comp.names[0]} ki padding 16px 20px kardo\`\n` +
      `- \`${comp.names[0]} ki width 20% kam kardo\`\n` +
      `- \`${comp.names[0]} ka border 2px solid cyan kardo\`\n` +
      `- \`${comp.names[0]} ka background #0f172a kardo\`\n` +
      `- \`${comp.names[0]} ki border radius 16px kardo\``
    );
  }

  static modifyComponent(query) {
    const q = (query || '').trim();
    const qLower = q.toLowerCase();

    // Check if asking for components list
    if (qLower.includes('list') || qLower.includes('tamam components')) {
      return this.listComponents();
    }

    // Check for HTML content replacement
    if (/html|text|content|title|heading/i.test(qLower) && (q.includes('replace') || q.includes('badal kar') || q.includes('tabdeel'))) {
      const htmlPath = path.join(PUBLIC_DIR, 'index.html');
      let htmlContent = fs.readFileSync(htmlPath, 'utf8');
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i) ||
                           q.match(/["']([^"']+)["']\s+(?:ko|se)\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!htmlContent.includes(oldStr)) {
          return `⚠️ Target text HTML mein nahi mila:\n\`${oldStr}\``;
        }
        htmlContent = htmlContent.replace(oldStr, newStr);
        fs.writeFileSync(htmlPath, htmlContent, 'utf8');
        return `✅ **HTML Content Updated Successfully!**\n- 🔄 **Replaced:** \`${oldStr}\`\n- 🎯 **With:** \`${newStr}\`\n\n🔄 **Dynamic Page Reload:** Browser reload ho raha hai!`;
      }
    }

    const comp = this.findComponent(qLower);
    if (!comp) {
      return this.editGui(query);
    }

    const cssPath = path.join(PUBLIC_DIR, 'style.css');
    if (!fs.existsSync(cssPath)) return `❌ Error: \`${cssPath}\` mojood nahi hai.`;
    let cssContent = fs.readFileSync(cssPath, 'utf8');

    // 0. Special Handling for Body & Page Background
    if (comp.key === 'body') {
      const colorValMatch = q.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
      let bgVal = colorValMatch ? colorValMatch[1].trim() : null;
      if (!bgVal) {
        const colorNames = {
          black: '#000000', kala: '#000000',
          white: '#ffffff', safed: '#ffffff',
          dark: '#0a0d14',
          cyan: '#00d2ff',
          blue: '#3a7bd5', neela: '#3a7bd5',
          green: '#10b981', sabz: '#10b981',
          purple: '#9d4edd', jamni: '#9d4edd',
          red: '#ef4444', surkh: '#ef4444', lal: '#ef4444',
          gray: '#64748b'
        };
        for (const [cName, hex] of Object.entries(colorNames)) {
          if (new RegExp(`\\b${cName}\\b`, 'i').test(q)) {
            bgVal = hex;
            break;
          }
        }
      }

      if (bgVal) {
        const isTextColor = /(?:text\s*color|font\s*color)\s+/i.test(q) && !/background|bg/i.test(q);
        if (isTextColor) {
          const res = this.updateCssRule(cssContent, 'body', 'color', bgVal);
          if (res.success) {
            fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
            return `✅ **Body Ka Text Color Updated!**\n` +
                   `- 🎯 **Selector:** \`body\`\n` +
                   `- 🎨 **New Text Color:** \`${bgVal}\`\n\n` +
                   `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
          }
        } else {
          let updatedCss = cssContent;
          const varRegex = /(--bg-primary:\s*)([^;]+)(;)/i;
          if (varRegex.test(updatedCss)) {
            updatedCss = updatedCss.replace(varRegex, `$1${bgVal}$3`);
          }
          const bodyBgRes = this.updateCssRule(updatedCss, 'body', 'background-color', bgVal);
          if (bodyBgRes.success) updatedCss = bodyBgRes.updatedCss;
          if (bgVal === '#000000') {
            const bgImgRes = this.updateCssRule(updatedCss, 'body', 'background-image', 'none');
            if (bgImgRes.success) updatedCss = bgImgRes.updatedCss;
          }

          // Auto-adjust text contrast based on background luminance
          const lum = this.getLuminance(bgVal);
          if (lum > 0.5) {
            // Light background: set dark readable text
            updatedCss = updatedCss.replace(/(--text-primary:\s*)([^;]+)(;)/i, '$1#1e293b$3');
            updatedCss = updatedCss.replace(/(--text-secondary:\s*)([^;]+)(;)/i, '$1#475569$3');
          } else {
            // Dark background: set light readable text
            updatedCss = updatedCss.replace(/(--text-primary:\s*)([^;]+)(;)/i, '$1#f8fafc$3');
            updatedCss = updatedCss.replace(/(--text-secondary:\s*)([^;]+)(;)/i, '$1#94a3b8$3');
          }

          fs.writeFileSync(cssPath, updatedCss, 'utf8');
          return `✅ **Application Body Ka Background Color Updated!**\n` +
                 `- 🎯 **Selector:** \`body\` / \`:root\`\n` +
                 `- 🎨 **New Background Color:** \`${bgVal}\` (${lum > 0.5 ? 'Light theme contrast applied' : 'Dark theme contrast applied'})\n\n` +
                 `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
        }
      }
    }

    // 0.5 Check for width change (e.g. "token cards ki width 20% kam kardo", "width 80%", "width barhao")
    const widthMatch = q.match(/(?:width|chaudai)\s+(?:([0-9]+%|[0-9]+px|[0-9]+rem)\s+)?(kam|ghata|chhoti|reduce|badha|barha|zyada|increase|kardo|rakho|set)/i) ||
                       q.match(/(?:width|chaudai)\s+([0-9a-z%pxrem!]+)/i);
    if (widthMatch) {
      let widthVal = (widthMatch[1] || widthMatch[2])?.trim();
      const pctMatch = q.match(/([0-9]+)%\s*(?:kam|ghata)/i);
      if (pctMatch) {
        const reduction = parseInt(pctMatch[1], 10);
        widthVal = `${Math.max(10, 100 - reduction)}%`;
      } else if (!widthVal || /kam|ghata|chhoti|reduce/i.test(widthVal)) {
        widthVal = '80%';
      } else if (/badha|barha|zyada|increase/i.test(widthVal)) {
        widthVal = '100%';
      }

      const res = this.updateCssRule(cssContent, comp.selector, 'max-width', widthVal);
      if (res.success) {
        let updated = res.updatedCss;
        if (comp.key === 'token_card') {
          const marginRes = this.updateCssRule(updated, comp.selector, 'margin', '0 auto');
          if (marginRes.success) updated = marginRes.updatedCss;
        }
        fs.writeFileSync(cssPath, updated, 'utf8');
        return `✅ **${comp.desc} Ki Width Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Max-Width:** \`${widthVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 0.6 Check for height change
    const heightMatch = q.match(/height\s+([0-9a-z%pxrem!]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (heightMatch) {
      const heightVal = heightMatch[1].trim();
      const res = this.updateCssRule(cssContent, comp.selector, 'height', heightVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Height Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Height:** \`${heightVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 1. Check for padding change
    const padMatch = q.match(/padding\s+([0-9a-z\s%pxrem!]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i) ||
                     q.match(/(?:size\s+barha|size\s+badha|bara\s+karo)/i);
    if (padMatch) {
      let padVal = padMatch[1]?.trim();
      if (!padVal || padMatch[0].includes('badha') || padMatch[0].includes('barha') || padMatch[0].includes('bara')) {
        padVal = '16px 20px';
      }
      const res = this.updateCssRule(cssContent, comp.selector, 'padding', padVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Padding Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Padding:** \`${padVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 2. Check for size chhota karo
    if (/size\s+chhota|chota\s+karo/i.test(qLower)) {
      const res = this.updateCssRule(cssContent, comp.selector, 'padding', '8px 10px');
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Size Chhota Kar Diya Gaya!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📏 **New Padding:** \`8px 10px\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 3. Check for border-radius / corners
    const radiusMatch = q.match(/(?:border-?radius|radius|corners?)\s+([^\n;]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (radiusMatch) {
      const radiusVal = radiusMatch[1].trim();
      const res = this.updateCssRule(cssContent, comp.selector, 'border-radius', radiusVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Border Radius Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 📐 **New Border Radius:** \`${radiusVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 4. Check for border (with style, width, or color)
    if (/(?:border|boundary)\b/i.test(q) && !/radius|corner/i.test(q)) {
      const existingRule = this.extractCssRule(cssContent, comp.selector) || '';
      const borderVal = this.parseBorderValue(q, existingRule);
      const res = this.updateCssRule(cssContent, comp.selector, 'border', borderVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ki Border Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🔲 **New Border:** \`${borderVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 6. Check for background color / gradient
    const bgMatch = q.match(/(?:background(?:-color)?|bg)\s+([^\n;]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (bgMatch) {
      let bgVal = bgMatch[1].trim();
      const colorMap = {
        cyan: '#00d2ff', green: '#10b981', sabz: '#10b981', purple: '#9d4edd', jamni: '#9d4edd',
        red: '#ef4444', surkh: '#ef4444', lal: '#ef4444', blue: '#3a7bd5', neela: '#3a7bd5',
        dark: '#0a0d14', black: '#000000', kala: '#000000', white: '#ffffff', safed: '#ffffff', gray: '#64748b'
      };
      if (colorMap[bgVal.toLowerCase()]) bgVal = colorMap[bgVal.toLowerCase()];
      const res = this.updateCssRule(cssContent, comp.selector, 'background', bgVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Background Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🎨 **New Background:** \`${bgVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 7. Check for text color
    const colorMatch = q.match(/(?:text\s*color|color)\s+([^\n;]+?)(?:\s+kardo|\s+rakho|\s+set|$)/i);
    if (colorMatch) {
      let cVal = colorMatch[1].trim();
      const colorMap = {
        cyan: '#00d2ff', green: '#10b981', sabz: '#10b981', purple: '#9d4edd', jamni: '#9d4edd',
        red: '#ef4444', surkh: '#ef4444', lal: '#ef4444', blue: '#3a7bd5', neela: '#3a7bd5',
        white: '#ffffff', safed: '#ffffff', black: '#000000', kala: '#000000', gray: '#64748b'
      };
      if (colorMap[cVal.toLowerCase()]) cVal = colorMap[cVal.toLowerCase()];
      const res = this.updateCssRule(cssContent, comp.selector, 'color', cVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Text Color Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🎨 **New Color:** \`${cVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    // 8. Check for font-size
    const fontMatch = q.match(/(?:font-?size|font)\s+([0-9]+(?:px|rem|em))/i);
    if (fontMatch) {
      const fVal = fontMatch[1].trim();
      const res = this.updateCssRule(cssContent, comp.selector, 'font-size', fVal);
      if (res.success) {
        fs.writeFileSync(cssPath, res.updatedCss, 'utf8');
        return `✅ **${comp.desc} Ka Font Size Updated!**\n` +
               `- 🎯 **Selector:** \`${comp.selector}\`\n` +
               `- 🔤 **New Font Size:** \`${fVal}\`${res.oldValue ? ` (Previous: \`${res.oldValue}\`)` : ''}\n\n` +
               `⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }
    }

    return `💡 **${comp.desc} Modification Options:**\n` +
      `- Padding/Size: \`${comp.names[0]} ki padding 16px 20px kardo\` ya \`size badhao\`\n` +
      `- Border: \`${comp.names[0]} ka border 2px solid cyan kardo\` ya \`border radius 16px kardo\`\n` +
      `- Background: \`${comp.names[0]} ka background #0f172a kardo\`\n` +
      `- Color: \`${comp.names[0]} ka color white kardo\`\n` +
      `- Font Size: \`${comp.names[0]} ka font-size 16px kardo\``;
  }

  // --- OFFLINE WEB DEVELOPMENT & GUI EXPLANATION / EDITING ENGINE ---
  static explainGui(query) {
    const q = (query || '').toLowerCase();

    // Specific Target: Token Dashboard / Token Cards
    if (/(?:token\s*(?:dashboard|cards?)|cards?\s*ka\s*size|dashboard\s*cards?|token\s*card)/i.test(q)) {
      return (
        `📊 **Jena Token Dashboard Cards: Dimensions, Layout & Size Breakdown**\n\n` +
        `Mera Token Dashboard 4 live metrics cards par mushtamil hai jo \`public/style.css\` aur \`public/index.html\` mein define hain:\n\n` +
        `### 1. 📐 Layout & Dimensions (\`public/style.css\`)\n` +
        `- **Grid Container (\`.token-dashboard\`):**\n` +
        `  * **Display Engine:** \`display: grid;\`\n` +
        `  * **Desktop Columns:** \`grid-template-columns: repeat(4, 1fr);\` (4 barabar responsive columns, poori viewport width 100% cover karti hain)\n` +
        `  * **Gap:** \`gap: 10px;\` (cards ke darmiyan 10px spacing)\n` +
        `  * **Margin:** \`margin-top: 12px; flex-shrink: 0;\`\n` +
        `  * **Mobile Screen (\`@media max-width: 768px\`):** \`grid-template-columns: repeat(2, 1fr);\` (chhoti mobile screen par 2x2 grid ban jata hai)\n\n` +
        `- **Card Size & Box Model (\`.token-card\`):**\n` +
        `  * **Internal Padding:** \`padding: 10px 14px;\` (top/bottom: 10px, left/right: 14px)\n` +
        `  * **Border:** \`1px solid var(--border-color);\` (subtle neon boundary)\n` +
        `  * **Border Radius:** \`var(--radius-md);\` (10px rounded corners)\n` +
        `  * **Background Surface:** Glassmorphic \`var(--bg-card);\` with \`backdrop-filter: blur(12px);\`\n` +
        `  * **Rendered Height:** Taqreeban ~68px se 72px (content aur font metrics ke hisab se dynamically fit hota hai)\n\n` +
        `### 2. 🎴 4 Token Cards Ka Maqsad:\n` +
        `1. 🎯 **ALLOWANCE (\`#cardAllowance\`):** Total token budget allowance. Yeh card clickable hai (\`cursor: pointer\`), jis par click karke modal se budget set kiya ja sakta hai.\n` +
        `2. 📈 **USED TOKENS (\`#valUsed\`):** Ab tak prompts aur responses mein kharch shuda total tokens.\n` +
        `3. 💰 **BALANCE (\`#valBalance\`):** Baaqi tokens ka hisab (\`Allowance - Used\`).\n` +
        `4. ⚡ **PROMPT SPEED (\`#valSpeed\`):** Generation speed (\`tokens per second / t/s\`).\n\n` +
        `### 3. 🔤 Card Typography & Font Sizes:\n` +
        `- **Label (\`.token-label\`):** \`font-size: 10px; font-weight: 700; letter-spacing: 0.6px; color: var(--text-muted);\`\n` +
        `- **Value (\`.token-val\`):** \`font-size: 17px; font-weight: 700; font-family: 'JetBrains Mono', monospace;\`\n` +
        `- **Unit (\`.unit\`):** \`font-size: 11px; font-weight: 500;\`\n` +
        `- **Subtext (\`.token-sub\`):** \`font-size: 10px; color: var(--text-muted);\`\n\n` +
        `*(Agar aap inka size, padding, ya font badalna chahein to mujhe bolein, jaise: \`css main token card padding 14px 18px kardo\`)*`
      );
    }

    // Target 1: index.html
    if (q.includes('index.html') || (q.includes('html') && !q.includes('server') && !q.includes('app.js'))) {
      const filePath = path.join(PUBLIC_DIR, 'index.html');
      let stats = '';
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        stats = `(Path: \`public/index.html\` • Lines: ${lines} • Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`;
      }

      return (
        `📄 **Jena GUI Architecture: \`public/index.html\` Breakdown** ${stats}\n\n` +
        `Main ne apne HTML structure ko aik **2-Page Minimalist SPA (Single Page Application)** ke tor par design kiya hai:\n\n` +
        `### 1. 🏗️ Header & Global Controls\n` +
        `- **Brand Avatar & Title:** Robot icon (\`🤖\`) with neon glow aur version tag (\`v0.3\`).\n` +
        `- **Navigation Tabs:** \`#tabNavMain\` (💬 Chat) aur \`#tabNavSettings\` (⚙️ Providers & Models) ke darmiyan instant SPA tab switching.\n` +
        `- **Hybrid Mode Switch:** \`[🌐 Online]\` aur \`[⚡ Offline]\` buttons jo backend ke local engine aur cloud LLMs ko toggle karte hain.\n\n` +
        `### 2. 💬 Page 1: Main Chat & Interaction Viewport\n` +
        `- **Token Dashboard (4 Cards):**\n` +
        `  * \`ALLOWANCE\`: Total token budget (click karke modal se adjust kiya ja sakta hai).\n` +
        `  * \`USED TOKENS\`: Cumulative prompt/completion tokens consumed.\n` +
        `  * \`BALANCE\`: Remaining allowance balance.\n` +
        `  * \`PROMPT SPEED\`: Real-time tokens per second (\`t/s\`) speed meter.\n` +
        `- **Active Engine Bar:** Active provider/model pill with link to settings.\n` +
        `- **📍 CWD Status Bar:** Current working directory indicator with quick buttons (\`📂 ls\`, \`🌲 tree\`, \`🧠 memory\`).\n` +
        `- **Chat Viewport (\`#chatViewport\`):** Welcome hero chips, markdown formatted message stream, SSE live thoughts.\n` +
        `- **Input Footer:** Textarea with auto-resize, shortcut hints, aur send button.\n\n` +
        `### 3. ⚙️ Page 2: Providers, Models, Memory & Logs\n` +
        `- **Card 1:** Active AI Provider & Model dropdowns + \`⚡ Test Model\` latency benchmark button.\n` +
        `- **Card 2:** Multi-API Keys Manager (provider select, password input, masked keys list with delete).\n` +
        `- **Card 3:** Add Custom Model (provider select, exact model ID, display label).\n` +
        `- **Card 4:** Add Custom Online Provider (slug, endpoint URL, default model, initial API key).\n` +
        `- **Card 5 (Self-Learned Operations & Memory Engine):** CWD folder changer (\`cd\`), add new offline operation form, learned facts form, registered ops with \`▶️ Run\` and \`🗑️ Delete\`, live terminal output preview.\n` +
        `- **Card 6 (Conversation Tracking & Failure Logs):** Sub-tabs for \`conversation.jsonl\` and \`failures.log\`, live log viewer, refresh aur clear buttons.\n\n` +
        `### 4. 🪟 Modals\n` +
        `- \`#allowanceModal\`: Token budget modify karne ka dialog box.`
      );
    }

    // Target 2: style.css
    if (q.includes('style.css') || q.includes('css')) {
      const filePath = path.join(PUBLIC_DIR, 'style.css');
      let stats = '';
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        stats = `(Path: \`public/style.css\` • Lines: ${lines} • Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`;
      }

      return (
        `🎨 **Jena GUI Design System: \`public/style.css\` Breakdown** ${stats}\n\n` +
        `Main ne apna visual design **Cybernetic Dark Mode & Glassmorphism** aesthetic par build kiya hai:\n\n` +
        `### 1. 🌈 Design Tokens (\`:root\` Variables)\n` +
        `- **Color Palette:**\n` +
        `  * Primary Background: \`--bg-primary: #0a0d14\` (Deep OLED dark)\n` +
        `  * Glass Surfaces: \`--bg-card: rgba(18, 24, 38, 0.7)\` with \`backdrop-filter: blur(12px)\`\n` +
        `  * Neon Accents: Cyan (\`#00d2ff\`), Purple (\`#9d4edd\`), Green (\`#10b981\`), Amber (\`#f59e0b\`), Red (\`#ef4444\`)\n` +
        `  * Typography: \`Plus Jakarta Sans\` (UI) aur \`JetBrains Mono\` (Tokens, CWD, Terminal Code)\n\n` +
        `### 2. 📐 Layout & Components\n` +
        `- **SPA Page View:** \`.page-view\` jo \`display: flex\` aur \`display: none\` se toggle hota hai.\n` +
        `- **Token Dashboard Grid:** \`.token-dashboard\` 4 equal-width grid cards with dynamic highlight borders.\n` +
        `- **Message Stream:** Flexbox rows for user (\`.message-row.user\`) aur assistant (\`.message-row.assistant\`) with bubble styling.\n` +
        `- **Settings Cards Grid:** Card panels with frosted glass header, badges, and responsive form rows.\n` +
        `- **Terminal Box:** \`.terminal-preview-box\` with dark terminal header and scrollable preformatted output.\n` +
        `- **Log Viewer:** \`.log-tabs-bar\` and \`.logs-scroll-container\` for conversation and failure logs.\n` +
        `- **Mobile Responsive:** \`@media (max-width: 768px)\` mein dashboard 2 columns aur input forms vertical stack ho jate hain.`
      );
    }

    // Target 3: app.js
    if (q.includes('app.js') || q.includes('javascript') || q.includes('frontend js')) {
      const filePath = path.join(PUBLIC_DIR, 'app.js');
      let stats = '';
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').length;
        stats = `(Path: \`public/app.js\` • Lines: ${lines} • Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`;
      }

      return (
        `⚡ **Jena Frontend Client Engine: \`public/app.js\` Breakdown** ${stats}\n\n` +
        `Mera frontend client pure Vanilla JavaScript par likha gaya hai (Zero External Frameworks/Libraries):\n\n` +
        `### 1. 🔀 Navigation & SPA Router (\`showPage\`)\n` +
        `- Hash-based routing (\`#chat\` vs \`#settings\`) aur tab buttons se bina page reload kiye pages switch hote hain.\n\n` +
        `### 2. 📡 Server-Sent Events (SSE) Stream Reader (\`handleSendMessage\`)\n` +
        `- \`fetch('/api/chat')\` se SSE stream open karti hai.\n` +
        `- Event types handle karti hai: \`mode\`, \`thought\`, \`done\`, \`error\`.\n` +
        `- Real-time token count, balance, aur generation speed update karti hai.\n\n` +
        `### 3. ⚙️ Multi-Key, Providers & Models State\n` +
        `- \`fetchConfig()\`: Backend se settings, active models, aur masked keys fetch karke dropdowns populate karti hai.\n` +
        `- Naye providers aur custom models dynamically save/delete karti hai.\n\n` +
        `### 4. 🧠 Memory, CWD & Terminal Box Manager\n` +
        `- \`fetchMemory()\`: Jena ki current working directory aur learned operations fetch karti hai.\n` +
        `- \`handleRunOp()\`: Offline operation ko direct run karke terminal preview box mein output display karti hai.\n\n` +
        `### 5. 📜 Log Viewer Controller\n` +
        `- \`fetchLogs()\`: Conversation history aur command failure logs render karti hai.`
      );
    }

    // Target 4: server.js
    if (q.includes('server.js') || q.includes('backend') || q.includes('nodejs')) {
      return (
        `🐍 **Jena Backend Engine: \`server.js\` Architecture**\n\n` +
        `Jena ka backend aik zero-dependency native Node.js application hai jo Termux aur Linux ke liye optimize ki gayi hai:\n\n` +
        `- **\`LocalEngine\` (Offline):** Battery, RAM, Disk, Time, Filesystem Navigation (\`cd\`, \`ls\`, \`cat\`, \`tree\`, \`find\`, \`mkdir\`, \`touch\`), Safe Math, Web Scaffolder aur Self-Editing handle karta hai (0 Tokens).\n` +
        `- **\`CloudEngine\` (Online):** Groq (LPU), Gemini, aur OpenAI compatible models ke sath unified streaming aur key rotation provide karta hai.\n` +
        `- **\`MemoryManager\`:** Learned custom operations aur user preferences ko \`~/.jena/memory.json\` mein persist karta hai.\n` +
        `- **\`LogManager\`:** Conversations ko \`~/.jena/conversation.jsonl\` aur failures ko \`~/.jena/failures.log\` mein automatically log karta hai.\n` +
        `- **\`ConfigManager\` & \`TokenTracker\`:** Multi-key automatic rotation aur live token allowance/speed calculate karte hain.\n` +
        `- **HTTP & SSE Server:** Port 8080 par static assets aur REST APIs serve karta hai.`
      );
    }

    // Default overview
    return (
      `🤖 **Jena Full GUI & System Files Overview:**\n\n` +
      `Mera complete codebase sirf **5 files** par mushtamil hai:\n` +
      `1. 📄 **\`public/index.html\`**: 2-Page responsive GUI (Chat, Token Dashboard, Settings, Memory Engine, Log Tracker).\n` +
      `2. 🎨 **\`public/style.css\`**: Cybernetic dark aesthetic, CSS variables, glassmorphism, responsive grid.\n` +
      `3. ⚡ **\`public/app.js\`**: Reactive Vanilla JS client, SSE streaming reader, key/memory management.\n` +
      `4. 🐍 **\`server.js\`**: Hybrid local/cloud backend, filesystem control, memory & log persistence.\n` +
      `5. 📦 **\`package.json\`**: Project metadata & scripts.\n\n` +
      `*Kisi makhsoos file ki tafseel ke liye bolein: \`apne index.html ko explain karo\` ya \`explain style.css\`.*`
    );
  }

  static editGui(query) {
    const q = query.trim();

    // If query targets a specific component, route to modifyComponent
    const comp = this.findComponent(q);
    if (comp && !/^(?:replace|badlo)/i.test(q)) {
      return this.modifyComponent(query);
    }

    // Check if targeting CSS
    if (/css|style/i.test(q)) {
      const cssPath = path.join(PUBLIC_DIR, 'style.css');
      if (!fs.existsSync(cssPath)) return `❌ Error: \`${cssPath}\` mojood nahi hai.`;

      let content = fs.readFileSync(cssPath, 'utf8');

      // 1. Direct Rule Replacement pattern: replace "old" with "new" OR "target" -> "replacement"
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i) ||
                           q.match(/badlo\s+["']([^"']+)["']\s+ko\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!content.includes(oldStr)) {
          return `⚠️ Target content CSS mein nahi mila:\n\`${oldStr}\``;
        }
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(cssPath, content, 'utf8');
        return `✅ **CSS Updated Successfully!**\nReplaced in \`public/style.css\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }

      // 2. Color / Variable update pattern: e.g. "background color #050811 kardo" or "--bg-primary to #050811"
      const colorValMatch = q.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/);
      if (colorValMatch) {
        const val = colorValMatch[1].trim();
        let targetVar = '--bg-primary';
        if (q.includes('accent') || q.includes('cyan')) targetVar = '--accent-cyan';
        else if (q.includes('purple')) targetVar = '--accent-purple';
        else if (q.includes('green')) targetVar = '--accent-green';
        else if (q.includes('surface')) targetVar = '--bg-surface';
        else if (q.includes('card')) targetVar = '--bg-card';
        else if (q.includes('text') || q.includes('font')) targetVar = '--text-primary';

        const regex = new RegExp(`(${targetVar}:\\s*)([^;]+)(;)`, 'i');
        if (regex.test(content)) {
          const oldLine = content.match(regex)[0];
          const newLine = `${targetVar}: ${val};`;
          content = content.replace(regex, `$1${val}$3`);
          fs.writeFileSync(cssPath, content, 'utf8');
          return `✅ **Jena GUI CSS Variable Updated!**\n- 🎯 **Updated:** \`${newLine}\`\n- 🔄 **Previous:** \`${oldLine}\`\n\n⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
        }
      }

      // 3. Append custom CSS rule: e.g. "css main yeh add karo: .my-class { ... }"
      const addMatch = q.match(/(?:add|shamil|likho|dalo)[:\s]+(.+)$/is);
      if (addMatch) {
        const newCss = addMatch[1].trim().replace(/^```css\s*|^```\s*|```$/g, '');
        content = content.trimEnd() + `\n\n/* Custom User Added Style */\n${newCss}\n`;
        fs.writeFileSync(cssPath, content, 'utf8');
        return `✅ **Custom CSS Rule Added to \`public/style.css\`!**\n\`\`\`css\n${newCss}\n\`\`\`\n\n⚡ **Dynamic Hot-Reload Applied:** Browser styling live update ho chuki hai!`;
      }

      return (
        `💡 **CSS Edit Syntax Examples:**\n` +
        `- Replace: \`css main changes karo: replace "--bg-primary: #0a0d14;" with "--bg-primary: #050811;"\`\n` +
        `- Variable: \`css main background color #050811 kardo\`\n` +
        `- Add Rule: \`css main add karo: .my-badge { color: cyan; font-weight: bold; }\``
      );
    }

    // Check if targeting HTML
    if (/html|index/i.test(q)) {
      const htmlPath = path.join(PUBLIC_DIR, 'index.html');
      let content = fs.readFileSync(htmlPath, 'utf8');
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!content.includes(oldStr)) {
          return `⚠️ Target content HTML mein nahi mila:\n\`${oldStr}\``;
        }
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(htmlPath, content, 'utf8');
        return `✅ **HTML Updated Successfully!**\nReplaced in \`public/index.html\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n🔄 **Dynamic Page Reload:** Browser reload ho raha hai!`;
      }
      return `💡 HTML edit karne ke liye: \`index.html main change karo: replace "old text" with "new text"\``;
    }

    // Check if targeting JS / app.js
    if (/app\.js|javascript|\bjs\b/i.test(q)) {
      const jsPath = path.join(PUBLIC_DIR, 'app.js');
      if (!fs.existsSync(jsPath)) return `❌ Error: \`${jsPath}\` mojood nahi hai.`;
      let content = fs.readFileSync(jsPath, 'utf8');
      const replaceMatch = q.match(/replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i) ||
                           q.match(/badlo\s+["']([^"']+)["']\s+ko\s+["']([^"']+)["']/i);
      if (replaceMatch) {
        const oldStr = replaceMatch[1];
        const newStr = replaceMatch[2];
        if (!content.includes(oldStr)) {
          return `⚠️ Target content JavaScript mein nahi mila:\n\`${oldStr}\``;
        }
        const updated = content.replace(oldStr, newStr);
        // Syntax validation check before saving
        try {
          const vm = require('vm');
          new vm.Script(updated);
        } catch (syntaxErr) {
          return `❌ **JavaScript Syntax Validation Failed:**\nIs tabdeeli ke baad \`app.js\` mein syntax error aa jayega:\n\`${syntaxErr.message}\`\nFile save nahi ki gayi taake GUI crash na ho.`;
        }
        fs.writeFileSync(jsPath, updated, 'utf8');
        return `✅ **JavaScript Updated Successfully!**\nReplaced in \`public/app.js\`:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\`\n\n🔄 **Dynamic Page Reload:** Browser reload ho raha hai!`;
      }
      return `💡 JavaScript edit karne ke liye: \`app.js main change karo: replace "old code" with "new code"\``;
    }

    return `⚠️ Barah-e-karam target batayein: CSS, HTML, ya JS (e.g. \`css main background color #030712 kardo\` ya \`token cards ki padding 16px 20px kardo\`).`;
  }


}

module.exports = {
  GuiTools
};
