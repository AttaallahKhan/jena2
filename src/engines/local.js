/**
 * =====================================================================
 *  ⚡ JENA v0.3 — Offline / Local Intelligence Engine Dispatcher
 * =====================================================================
 */

const path = require('path');
const fs = require('fs');
const { HOME_DIR, ConfigManager, MemoryManager } = require('../config');
const { FsTools } = require('../tools/fs');
const { TerminalTools } = require('../tools/terminal');
const { SystemTools } = require('../tools/system');
const { GitTools } = require('../tools/git');
const { GuiTools } = require('../tools/gui');
const { ScaffoldTools } = require('../tools/scaffold');
const { DeviceTools } = require('../tools/device');
const { EvolutionEngine } = require('./evolution');

class LocalEngine {
  static currentDir = HOME_DIR;

  static getCwd() {
    if (!this.currentDir || !fs.existsSync(this.currentDir)) {
      this.currentDir = HOME_DIR;
    }
    return this.currentDir;
  }

  static isLocalIntent(query) {
    if (!query || typeof query !== 'string') return false;
    let q = query.trim().toLowerCase();
    q = q.replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();

    // 0. Mode status query & switching
    if (/\b(online\s+ho\s+ya\s+offline|offline\s+ho\s+ya\s+online|current\s+mode|mode\s+kya\s+hai|status\s+kya\s+hai)\b/i.test(q)) {
      return 'check_mode';
    }

    // 1. Self-Learning trigger
    if (/^(seekho|yaad rakho|note karo|learn|memorize)[:\s]/i.test(q)) {
      return 'teach';
    }

    // 2. Memory & Evolution status query
    if (
      /(?:tum\s+ne\s+)?(?:naya\s+)?kya\s+seekha\s*(?:hai|hay)?/i.test(q) ||
      /(?:evolution\s+report|evolution\s+status|engineer\s+status|learning\s+status|evolution)/i.test(q) ||
      /(?:apne\s+|apni\s+)?(?:operations|memory|skills|commands)\s*(?:dikhao|check|batao|list|show)\b/i.test(q) ||
      /^(?:kya\s+seekha\s+hai|kya\s+yaad\s+hai|yaad\s+kya\s+hai|memory\s+check|show\s+memory|show\s+operations|learned\s+operations|learned\s+commands|operations|memory)\b/i.test(q) ||
      q === 'memory' || q === 'operations'
    ) {
      return 'show_memory';
    }

    // 2b. Memory Facts / User Profile Query
    if (
      /\b(?:main\s+k(?:on|aun|o?un)\s+h[ou]+n|who\s+am\s+i|mera\s+naam|mere\s+naam|mere\s+(?:bete|bachay|bachon|family|khandan|ghar|bare|mutalliq)|mujhe\s+jaanti\s+ho|mera\s+intro|user_name|username|user_namr)\b/i.test(q) ||
      /(?:kya\s+yaad\s+hai|kya\s+yaad\s+hay)\s+(?:mere|apne)?/i.test(q) ||
      /(?:naam\s+kya\s+hai|naam\s+kya\s+hay|user_name|username|user\s+ka\s+naam)/i.test(q)
    ) {
      return 'query_facts';
    }

    // 2c. Capabilities / What can you do
    if (
      /(?:tum\s+)?kya\s+kya\s+kar\s+sakti\s+ho/i.test(q) ||
      /(?:apne\s+)?(?:features|capabilities|skills|kaam|salahiyat|powers)\s*(?:batao|dikhao|list|kya\s+hain)/i.test(q) ||
      /^(?:what\s+can\s+you\s+do|capabilities|features|skills|help|madad)\b/i.test(q) ||
      /(?:madad\s+chahiye|guide\s+karo|kya\s+karsakti\s+ho)/i.test(q)
    ) {
      return 'capabilities';
    }

    // 3. Registered Self-Learned Local Operations check
    const learnedOp = MemoryManager.findOperation(q);
    if (learnedOp) {
      return { type: 'learned_op', op: learnedOp };
    }

    // Terminal / Shell Execution Intent
    const tPattern = /^(?:terminal\s*(?:main|mein)?|bash|sh|cmd|command)\s*[:\s]+(.+)$/i;
    const tPatternRun = /^(?:run|chalao|execute)\s+(?:terminal\s+(?:command\s+)?|command\s+|bash\s+)(.+)$/i;
    const tPatternCmd = /^command\s+(?:run\s+karo|chalao|execute)\s+(.+)$/i;
    const origQuery = query.trim().replace(/^(?:hey|suno|o|ai)?\s*jena\b[:,\s]*/i, '').trim();
    const tm = origQuery.match(tPattern) || origQuery.match(tPatternRun) || origQuery.match(tPatternCmd);
    if (tm) {
      let raw = tm[1].trim();
      let tAutoYes = false;
      if (/(?:aor\s+)?(?:har\s+option\s+par\s+y\s+karo|har\s+jagah\s+y|har\s+baar\s+y|auto\s+yes|har\s+sawal\s+par\s+y)/i.test(raw)) {
        tAutoYes = true;
        raw = raw.replace(/(?:aor\s+)?(?:har\s+option\s+par\s+y\s+karo|har\s+jagah\s+y|har\s+baar\s+y|auto\s+yes|har\s+sawal\s+par\s+y)/i, '').trim();
      }
      raw = raw.replace(/\s+(?:chalao|run\s+karo|execute\s+karo|kardo|karein|run|execute)\s*$/i, '').trim();
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1).trim();
      }
      if (raw) {
        return { type: 'terminal_exec', command: raw, autoYes: tAutoYes };
      }
    }

    // Page Reload / Refresh trigger
    if (
      /^(?:page\s+|browser\s+|screen\s+)?(?:reload\s+refresh|refresh\s+reload|reload|refresh)(?:\s+karo|\s+karein|\s+kardo|\s+kardain)?$/i.test(q) ||
      /^(?:reload|refresh|reload\s+refresh|refresh\s+reload)$/i.test(q) ||
      /(?:page|browser|screen)\s+(?:ko\s+)?(?:refresh|reload|reload\s+refresh)\s*(?:karo|karein|kardo)?/i.test(q) ||
      /\b(?:page\s+reload|page\s+refresh)\b/i.test(q)
    ) {
      return 'reload_page';
    }

    // Troubleshooting / Changes Visibility Query
    if (
      /(?:changes?|tabdeeli|styling|styles?|border|color)\s+(?:dikh|nazar|show|apply|dekha|de\s+rahi|nahi\s+ho\s+rahi|nahi\s+aa\s+rahi|nahi\s+dikh|nahi\s+de\s+rahi)/i.test(q) ||
      /(?:dikhaye\s+nahi\s+de\s+rahi|nazar\s+nahi\s+aa\s+rahi|show\s+nahi\s+ho\s+rahi|dikha\s+nahi\s+raha)/i.test(q)
    ) {
      return 'troubleshoot_changes';
    }

    // Code Editor Intent
    if (
      /(?:code\s*editor|manual\s*edit|editor\s*kholo|open\s*editor|html\s*edit|css\s*edit|manual\s*user\s*editing|editor\s*dikhao|editor\s*install)/i.test(q) ||
      /^(?:editor|code editor)$/i.test(q)
    ) {
      return 'open_editor';
    }

    // GUI & Components Code / Styling Inspection
    if (
      /(?:code|css|html|styling|styles?|color|background|bg|border|radius|padding|size|width|height)\s+(?:dikhao|batao|kya hai|kya hay|check karo)/i.test(q) ||
      /(?:components?|elements?)\s*(?:ki\s+list|dikhao|batao|tamam|all|read|parho)/i.test(q) ||
      /(?:token\s*cards?|header|logo|avatar|brand|navbar|switch|hero|button|input|modal|cards?|body|background|bg|nav\s*tabs)\s*(?:ka|ki|ke)?\s*(?:code|css|html|styling|styles?|color|background|border|radius|padding|size|width|components?)?\s*(?:kya hai|kya hay|dikhao|batao|check|read|parho)/i.test(q) ||
      /(?:kya\s+color\s+hai|color\s+kya\s+hay|color\s+kya\s+hai|border\s+kya\s+hay|border\s+color\s+kya\s+hay)/i.test(q)
    ) {
      return 'inspect_component';
    }

    // GUI & Components Live Styling Mutation
    if (
      /(?:token\s*cards?|header|logo|avatar|brand|navbar|switch|hero|button|input|modal|cards?|cwd\s*bar|body|page|background|screen|app-header|avatar-glow)\s*(?:ka|ki|ke|ko)?\s*(?:size|padding|border|color|background|bg|radius|font|height|width|margin|gap).*?(?:badlo|change|kardo|rakho|set|badha|chhota|barha|bara|kam|zyada|ghata)/i.test(q) ||
      /<[a-z0-9_-]+\s+class=["'][^"']+["']>\s*iska\s+(?:border|color|background|size|padding)/i.test(q) ||
      /(?:badlo|change|set|update)\s+(?:token\s*cards?|header|logo|avatar|brand|hero|button|input|modal|cards?|body|page|background)\s*(?:ka|ki)?\s*(?:size|padding|border|color|background|radius|width|height)/i.test(q) ||
      /(?:body|background|page|screen)\s*(?:ka|ki|ke)?\s*(?:color|background|bg)?\s*(?:black|white|dark|cyan|green|purple|red|blue|gray|peach|brown|#|[a-z]+)\s*(?:kardo|rakho|set|badlo)/i.test(q) ||
      /(?:border|padding|border-radius|radius|width|height|background|color)\s+[0-9a-z%pxrem\s#]+\s*(?:kardo|rakho|set)/i.test(q) ||
      /(?:border\s+color|border\s+solid|border\s+size|border\s+width).*?(?:kardo|rakho|set)/i.test(q)
    ) {
      return 'modify_component';
    }

    // GUI Architecture & Sizing Explanation
    if (
      /(?:token\s*(?:dashboard|cards?)|cards?\s*ka\s*size|dashboard\s*cards?|token\s*card\s*size)/i.test(q) ||
      /(?:apne|apni|meri|current)?\s*(?:index\.html|style\.css|app\.js|server\.js|package\.json|gui|frontend|backend|components?|tokens?|cards?)\s*(?:ko)?\s*(?:explain|samjhao|batao|bataiye|kya hai|size)/i.test(q) ||
      /(?:explain|samjhao|size)\s+(?:apne|apni)?\s*(?:index\.html|style\.css|app\.js|server\.js|package\.json|gui|frontend|backend|components?|tokens?|cards?)/i.test(q) ||
      /(?:apne|apni)\s+(?:files|code|gui|architecture|cards?|components?)\s*(?:ko)?\s*(?:explain|samjhao|batao|size)/i.test(q)
    ) {
      return 'explain_gui';
    }

    // General GUI & File Self-Editing
    if (
      /(?:css|style\.css|styles?|gui|index\.html|app\.js)\s+(?:main|mein)\s+/i.test(q) ||
      /^(?:edit|change|update|modify)\s+(?:gui|style\.css|index\.html|app\.js|css)\b/i.test(q) ||
      /(?:apni\s+gui|apne\s+css|apni\s+css|apna\s+index\.html)\s+(?:ko\s+)?(?:edit|badlo|update|change)/i.test(q) ||
      /(?:css|style\.css|gui)\s+ko\s+(?:edit|update|badlo)/i.test(q) ||
      /(?:background(?:-color)?|bg)\s*(?:ko)?\s*(?:#|rgba?|[a-z]+).*kardo/i.test(q)
    ) {
      return 'edit_gui';
    }

    // Webpage & Project Scaffolding
    if (
      /^(?:webpage|web\s+page|website|landing\s+page|portfolio|dashboard|html\s+page|html\s+file|nodejs\s+server|nodejs\s+project|node\s+server)\s+(?:banao|create|likho|generate)/i.test(q) ||
      /^(?:banao|create|generate|make)\s+(?:aik\s+|ek\s+)?(?:webpage|web\s+page|website|landing\s+page|portfolio|dashboard|html\s+page|html\s+file|nodejs\s+server|nodejs\s+project|node\s+server)/i.test(q)
    ) {
      return 'scaffold_web';
    }

    // General Local File Write / Edit / Append
    if (
      /^(?:write\s+file|file\s+likho|file\s+create\s+karo|write\s+to\s+file)\s+/i.test(q) ||
      /^(?:edit\s+file|file\s+edit\s+karo|replace\s+in\s+file)\s+/i.test(q) ||
      /^(?:append\s+file|file\s+append\s+karo|append\s+to\s+file)\s+/i.test(q)
    ) {
      return 'file_write_edit';
    }

    // Offline Web Development Knowledge Base
    if (
      /^(?:html|css|js|javascript|nodejs|node\.js)\s+(?:explain\s+karo|kya\s+hai|seekho|sikhayo|samjhao|parhao)/i.test(q) ||
      /^(?:explain|samjhao|sikhayo)\s+(?:html|css|js|javascript|nodejs|node\.js)/i.test(q)
    ) {
      return 'web_knowledge';
    }

    // Filesystem Navigation
    if (
      /^cd(\s+.*)?$/i.test(q) ||
      /^folder\s+badlo(\s+.*)?$/i.test(q) ||
      /^andar\s+jao(\s+.*)?$/i.test(q) ||
      /^(?:go\s+to|enter|switch\s+to|open)\s+(?:folder\s+|directory\s+)?/i.test(q) ||
      /.+?\s+(?:folder\s+)?(?:main|mein|par)\s+(?:jao|chalo|ghuso)$/i.test(q) ||
      /^(?:peeche|back|bahir|bahr)\s+(?:jao|aao|niklo)$/i.test(q) ||
      /^(?:home|root)\s+(?:folder\s+)?(?:main\s+jao|par\s+jao)$/i.test(q)
    ) {
      return 'cd';
    }
    if (
      /^(?:pwd|kahan\s+khari\s+ho|kahan\s+ho|current\s+directory|current\s+path)$/i.test(q) ||
      /(?:konsa|konsi|kounsa|kounsi|kis)\s+(?:folder|directory|path|jagah)\s*(?:hai|hay|mein|main)?/i.test(q) ||
      /(?:current|mojooda)\s+(?:folder|directory|path|dir)\s*(?:kya\s+hai|kya\s+hay|batao|dikhao)?/i.test(q) ||
      /(?:hum|main)\s+(?:kis|kahan|konsay|konse)\s+(?:folder|directory|jagah)\s*(?:mein|main)?\s*(?:hain|hoon|khari\s+ho|ho)/i.test(q) ||
      /^(?:folder|directory|path)\s*(?:kya\s+hai|kya\s+hay|check\s+karo)?$/i.test(q)
    ) {
      return 'pwd';
    }
    if (
      /^(ls|dir)(\s+.*)?$/i.test(q) ||
      /\b(?:files\s+dikhao|list\s+files|folder\s+mein\s+kya|directory\s+check)\b/i.test(q) ||
      /(?:folder|directory)?\s*(?:list\s+karo|list\s+kardo|list\s+karein)\b/i.test(q) ||
      /^(?:list\s+)/i.test(q)
    ) {
      return 'ls';
    }
    if (/^(cat|view|read|file parho|file dikhao)\s+/i.test(q)) {
      return 'cat';
    }
    if (/^(tree|folder tree)(\s+.*)?$/i.test(q)) {
      return 'tree';
    }
    if (
      /^(?:find|dhoondo|search\s+file|search|locate|where\s+is)\s+/i.test(q) ||
      /(?:kahan\s+(?:hai|hay|he|h[ou]+n)|kidhar\s+(?:hai|hay))\b/i.test(q)
    ) {
      return 'find';
    }
    if (/^(mkdir|folder banao)\s+/i.test(q)) {
      return 'mkdir';
    }
    if (/^(touch|file banao)\s+/i.test(q)) {
      return 'touch';
    }
    if (
      /^(?:mv|move|cut)\s+/i.test(q) ||
      /(?:move\s+karo|move\s+kardo|cut\s+paste|main\s+move\s+karo|main\s+move\s+kardo)/i.test(q) ||
      /(?:from\s+phone\s+to\s+home|from\s+home\s+to\s+phone)\s+.*?(?:move|mv)/i.test(q) ||
      /(?:move|mv)\s+.*?(?:phone|home)/i.test(q)
    ) {
      return 'move_item';
    }
    if (
      /^(?:cp|copy)\s+/i.test(q) ||
      /(?:copy\s+karo|copy\s+kardo|paste\s+karo|main\s+copy\s+karo|main\s+copy\s+kardo|main\s+paste\s+karo)/i.test(q) ||
      /(?:copy\s+(?:public|folder|file|phone|home))/i.test(q) ||
      /(?:from\s+phone\s+to\s+home|from\s+home\s+to\s+phone)/i.test(q)
    ) {
      return 'copy_item';
    }
    if (
      /^(?:rm(?:\s+-[a-zA-Z]+)?|remove|delete|mitao)\s+/i.test(q) ||
      /(?:ko\s+delete\s+karo|ko\s+delete\s+kardo|ko\s+mita\s+do|ko\s+remove\s+karo)/i.test(q)
    ) {
      return 'delete_item';
    }

    // Git & GitHub Operations Intent
    if (
      /^(?:git|github)\s*(?:status|diff|log|branch)\b/i.test(q) ||
      /^(?:git|github)\s*(?:commit\s*(?:aor|aur|and|&)?\s*push|push|commit)\b/i.test(q) ||
      /(?:github|git)\s*(?:par|pe)?\s*(?:commit\s*(?:aor|aur|and|&)?\s*push|push|commit|bhej\s+do|upload\s+kardo)/i.test(q) ||
      /^(?:commit\s*(?:aor|aur|and|&)?\s*push|push\s+to\s+github|git\s+push|git\s+status|git\s+log|git\s+diff)\b/i.test(q)
    ) {
      return 'git_op';
    }

    // Device Torch & Flashlight Controls
    if (
      /(?:torch|flashlight|batti)\s*.*?(?:on\s+karo|jalao|on\s+kardo|on\s+karein|chalao|kholo|on\b)/i.test(q) ||
      /^(?:torch\s+on|flashlight\s+on|batti\s+on|turn\s+on\s+torch|turn\s+on\s+flashlight)$/i.test(q)
    ) {
      return 'torch_on';
    }
    if (
      /(?:torch|flashlight|batti)\s*.*?(?:off\s+karo|band\s+karo|off\s+kardo|band\s+kardo|bujhao|off\b)/i.test(q) ||
      /^(?:torch\s+off|flashlight\s+off|batti\s+off|turn\s+off\s+torch|turn\s+off\s+flashlight)$/i.test(q)
    ) {
      return 'torch_off';
    }

    // Device Camera & Selfie Controls
    if (
      /(?:front\s+camera|selfie)\s*.*?(?:kholo|lo|kheencho|capture|banao|nikalo|le\s*lo)/i.test(q) ||
      /(?:kholo|lo|kheencho|capture|nikalo|le\s*lo)\s*.*?(?:front\s+camera|selfie)/i.test(q) ||
      /^(?:selfie|front\s+camera|selfie\s+lo|take\s+selfie|front\s+camera\s+photo|selfie\s+kheencho)$/i.test(q)
    ) {
      return 'camera_selfie';
    }
    if (
      /(?:back\s+camera|rear\s+camera|camera)\s*.*?(?:kholo|lo|kheencho|capture|nikalo|photo|tasveer|le\s*lo)/i.test(q) ||
      /(?:photo|tasveer)\s*(?:lo|kheencho|banao|capture|nikalo|le\s*lo)/i.test(q) ||
      /^(?:photo\s+lo|tasveer\s+lo|camera\s+photo|take\s+photo|back\s+camera\s+photo|photo\s+kheencho)$/i.test(q)
    ) {
      return 'camera_photo';
    }

    // Creative keywords passed to Cloud AI
    const creativeWords = ['script', 'code', 'likho', 'banao', 'create', 'write', 'function', 'class', 'program', 'debug', 'explain'];
    for (const w of creativeWords) {
      if (new RegExp(`\\b${w}\\b`).test(q)) return false;
    }

    // Hardware & System Specs
    if (/\b(battery|charge|charging|battery status)\b/.test(q)) return 'battery';
    if (/\b(ram|memory|free ram|kitni ram)\b/.test(q)) return 'ram';
    if (
      /(?:kitni|kitna|free|available|total|check|status)\s+(?:storage|disk|space)\b/i.test(q) ||
      /(?:storage|disk|space)\s+(?:kitni|kitna|check|status|batao|info|specs)\b/i.test(q) ||
      /^(?:storage|disk|disk space|storage check|check storage)$/i.test(q)
    ) {
      return 'storage';
    }
    if (/\b(time|waqt|date|tarikh|din|aaj kya date|clock)\b/.test(q)) return 'datetime';
    if (/\b(uptime|specs|hardware|system info|device specs)\b/.test(q)) return 'specs';
    if (/^(salam|assalam|hello|hi|hey|kaise ho)\b/.test(q)) return 'greeting';
    if (/^(tum kon ho|who are you|apna intro|apna tarruf)\b/.test(q)) return 'intro';
    if (/^(hisab karo|calculate|math)\b/.test(q) || /^[\d\s\+\-\*\/\(\)\^\.\%]+$/.test(q)) return 'math';

    return false;
  }

  static async execute(intent, query) {
    if (typeof intent === 'object' && intent.type === 'learned_op') {
      return await TerminalTools.executeLearnedOperation(intent.op, this.getCwd());
    }
    if (typeof intent === 'object' && intent.type === 'terminal_exec') {
      return await TerminalTools.executeTerminalCommand(intent.command, intent.autoYes, this.getCwd());
    }

    switch (intent) {
      case 'capabilities':
        return this.getCapabilities();
      case 'git_op':
        return await GitTools.executeGitOperation(query, path.join(HOME_DIR, 'jena'));
      case 'torch_on':
        return await DeviceTools.setTorch('on');
      case 'torch_off':
        return await DeviceTools.setTorch('off');
      case 'camera_selfie':
        return await DeviceTools.takePhoto('front');
      case 'camera_photo':
        return await DeviceTools.takePhoto('back');
      case 'move_item':
        return FsTools.transferItem(query, true, this.getCwd());
      case 'copy_item':
        return FsTools.transferItem(query, false, this.getCwd());
      case 'delete_item':
        return FsTools.deleteItem(query, this.getCwd());
      case 'teach':
        return this.learnFromInput(query);
      case 'check_mode': {
        const cfg = ConfigManager.load();
        const curMode = cfg.mode || 'online';
        const curProvider = cfg.activeProvider || 'groq';
        const curModel = cfg.activeModel || 'qwen/qwen3.8-27b';
        return `🤖 **Jena Operating Status & Mode Report:**\n\n` +
               `- 🌐 **Active Mode:** **${curMode.toUpperCase()}**\n` +
               `- ⚙️ **Active Provider:** \`${curProvider}\`\n` +
               `- 🧠 **Active Model:** \`${curModel}\`\n` +
               `- ⚡ **Local Core:** Active (Termux Linux • Zero Token Usage)\n\n` +
               `*Aap upar header switch se ya \`online mode\` / \`offline mode\` bol kar switch kar sakte hain.*`;
      }
      case 'reload_page':
        return '🔄 **Page Refresh:** Browser page refresh initiate ho raha hai...';
      case 'troubleshoot_changes':
        return GuiTools.troubleshootChanges(query);
      case 'open_editor':
        return `🛠️ **Jena Manual Code Editor (HTML & CSS):**\n\n` +
               `Main ne aapke GUI mein live **Code Editor** install kar diya hai!\n\n` +
               `### 🌟 Features & Manual Editing Guide:\n` +
               `- 🗂️ **File Selector Tabs:** Upar \`📄 index.html\`, \`🎨 style.css\`, aur \`⚡ app.js\` ke buttons se kisi bhi file ka live code load karein.\n` +
               `- ✍️ **Direct In-App Editing:** Code editor mein line numbers aur tab spacing ke sath khud changes karein.\n` +
               `- 💾 **Save & Instant Hot-Reload:** \`💾 Save & Apply\` button dabayein ya keyboard par \`Ctrl + S\` press karein, file direct disk par save ho kar live screen par refresh ho jayegi.\n` +
               `- 🔄 **Revert / Reload:** Agar koi ghalti ho jaye to \`🔄 Reload\` se disk se original file wapas la sakte hain.\n\n` +
               `*Aap upar navigation bar mein **🛠️ Code Editor** tab par click karke abhi manual editing shuru kar sakte hain!*`;
      case 'show_memory':
        return this.showMemory();
      case 'explain_gui':
        return GuiTools.explainGui(query);
      case 'inspect_component':
        return GuiTools.inspectComponent(query);
      case 'modify_component':
        return GuiTools.modifyComponent(query);
      case 'edit_gui':
        return GuiTools.editGui(query);
      case 'scaffold_web':
        return ScaffoldTools.scaffoldWebPage(query);
      case 'file_write_edit':
        return ScaffoldTools.handleFileWriteOrEdit(query);
      case 'web_knowledge':
        return ScaffoldTools.explainWebConcept(query);
      case 'query_facts':
        return this.queryMemoryFacts(query);
      case 'cd': {
        const res = FsTools.changeDirectory(query, this.getCwd());
        this.currentDir = res.newCwd;
        return res.message;
      }
      case 'pwd': {
        const cwd = this.getCwd();
        const folderName = path.basename(cwd) || 'root';
        return `📍 **Current Working Directory:**\n- 📁 **Folder:** \`${folderName}\`\n- 📍 **Full Path:** \`${cwd}\`\n\n*(Files dekhne ke liye \`ls\` likhein.)*`;
      }
      case 'ls':
        return FsTools.listFiles(query, this.getCwd());
      case 'cat':
        return FsTools.readFile(query, this.getCwd());
      case 'tree':
        return FsTools.viewTree(query, this.getCwd());
      case 'find':
        return FsTools.searchFiles(query, this.getCwd());
      case 'mkdir':
        return FsTools.makeDirectory(query, this.getCwd());
      case 'touch':
        return FsTools.createFile(query, this.getCwd());
      case 'battery':
        return await SystemTools.getBattery();
      case 'ram':
        return SystemTools.getRam();
      case 'storage':
        return SystemTools.getStorage();
      case 'datetime':
        return SystemTools.getDateTime();
      case 'specs':
        return SystemTools.getSpecs(this.getCwd());
      case 'greeting':
        return 'Walaikum Assalam! Main Jena hoon — aapki autonomous hybrid AI agent. Main offline local tasks, filesystem navigation, aur self-learned operations 0 tokens par foran hal karti hoon. Farmayein, main aapki kis tarah madad kar sakti hoon?';
      case 'intro':
        return 'Main **Jena** hoon (v0.3), aik autonomous hybrid AI agent jo Termux aur Linux ke liye banai gayi hai. Mere paas self-learning engine hai jo nayi local operations seekh kar offline save kar sakta hai, filesystem navigation capability hai, aur high-speed cloud intelligence jo coding aur complex analysis handle karti hai.';
      case 'math':
        return SystemTools.calculate(query);
      default:
        return null;
    }
  }

  static learnFromInput(query) {
    let clean = query.replace(/^(seekho|yaad rakho|note karo|learn|memorize)[:\s]+/i, '').trim();

    const cmdMatch1 = clean.match(/^(?:command|op)\s+["']?([a-z0-9_-]+)["']?\s*(?:=|:|\->)\s*(.+)$/i);
    if (cmdMatch1) {
      const name = cmdMatch1[1].trim();
      const cmd = cmdMatch1[2].trim();
      const op = MemoryManager.addOperation(name, name, cmd, `Learned custom operation: ${cmd}`);
      return (
        `🧠 **Jena Ne Naya Local Operation Seekh Liya Hai!**\n\n` +
        `- 🏷️ **Name / Trigger:** \`${op.name}\`\n` +
        `- ⚡ **Command:** \`${op.command}\`\n` +
        `- 📁 **Saved In:** \`~/.jena/memory.json\`\n\n` +
        `Main ne is operation ko apne offline engine mein update kar liya hai. Ab aap jab bhi **\`${op.name}\`** kahenge to main yeh operation bina kisi AI token ke offline chalaungi!`
      );
    }

    const cmdMatch2 = clean.match(/^jab\s+main\s+kah[ou]+n\s+["']?([^"']+)["']?\s+to\s+(?:offline\s+)?(?:command\s+run\s+karo\s+|command\s+|chalao\s+)?["']?([^"']+)["']?$/i);
    if (cmdMatch2) {
      const trigger = cmdMatch2[1].trim();
      const cmd = cmdMatch2[2].trim();
      const op = MemoryManager.addOperation(trigger, trigger, cmd, `Trigger: ${trigger}`);
      return (
        `🧠 **Jena Ne Naya Local Operation Seekh Liya Hai!**\n\n` +
        `- 🏷️ **Trigger Phrase:** \`${op.trigger}\`\n` +
        `- ⚡ **Offline Command:** \`${op.command}\`\n\n` +
        `Yeh operation mere offline engine mein register ho gaya hai. Aap abhi **\`${op.trigger}\`** bol kar test kar sakte hain!`
      );
    }

    if (clean.includes('->')) {
      const parts = clean.split('->');
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        const trigger = parts[0].trim();
        const cmd = parts[1].trim();
        const op = MemoryManager.addOperation(trigger, trigger, cmd, `Shortcut: ${cmd}`);
        return (
          `🧠 **Jena Ne Naya Local Operation Seekh Liya Hai!**\n\n` +
          `- 🏷️ **Trigger:** \`${op.trigger}\`\n` +
          `- ⚡ **Command:** \`${op.command}\`\n\n` +
          `Aapka custom command mere offline system mein update ho chuka hai.`
        );
      }
    }

    const fact = MemoryManager.addFact(clean);
    return (
      `🧠 **Jena Ne Yeh Maloomat Yaad Rakh Li Hai:**\n\n` +
      `📌 *"${fact.fact}"*\n\n` +
      `- 🗂️ **Memory File:** \`~/.jena/memory.json\`\n` +
      `- ⚡ **Status:** Offline memory mein permanent save ho chuki hai.`
    );
  }

  static showMemory() {
    return EvolutionEngine.getEvolutionReport();
  }

  static queryMemoryFacts(query) {
    const mem = MemoryManager.load();
    const facts = mem.learned_facts || [];
    if (facts.length === 0) {
      return '🧠 **Memory Report:** Mere paas abhi aapke mutalliq koi saved facts nahi hain. Aap mujhe `seekho: mera naam ... hai` bol kar sikha saktay hain!';
    }

    const q = (query || '').toLowerCase();
    const matches = [];

    const asksAboutUser = /\b(?:main\s+k(?:on|aun|o?un)|who\s+am\s+i|mera\s+naam|mere\s+naam|mera\s+intro|user_name|username|user_namr|user\s+ka\s+naam)\b/i.test(q);
    const asksAboutSon = /\b(?:beta|bete|bacha|bachay|son|child|saifullah)\b/i.test(q);

    facts.forEach(f => {
      const txt = (f.fact || '').toLowerCase();
      let isRelevant = false;
      if (asksAboutUser && (txt.includes('mera naam') || txt.includes('abusaif') || (f.topic === 'user_name' && !facts.some(other => other.fact.includes('mera naam'))))) {
        isRelevant = true;
      }
      if (asksAboutSon && (txt.includes('bete') || txt.includes('beta') || txt.includes('saifullah') || txt.includes('son'))) {
        isRelevant = true;
      }
      if (isRelevant && !matches.includes(f.fact)) {
        matches.push(f.fact);
      }
    });

    const displayFacts = matches.length > 0 ? matches : facts.map(f => f.fact);

    let res = `🧠 **Jena Memory Se Maloomat:**\n\n`;
    displayFacts.forEach(factText => {
      res += `- 💡 **${factText}**\n`;
    });
    res += `\n*(Yeh maloomat offline memory \`~/.jena/memory.json\` se direct 0 tokens par retrieve hui hain.)*`;
    return res;
  }

  static getCapabilities() {
    return (
      `🧚‍♀️ **Main Jena hoon (v0.3) — Aapki Autonomous Hybrid AI Agent!**\n\n` +
      `Main Termux / Linux environment ke liye specifically designed hoon aur bina kisi external package ke standard Node.js par chalti hoon. Mere do operational modes hain: **⚡ 100% Offline (0 Tokens)** aur **🌐 High-Speed Cloud AI**.\n\n` +
      `Meri mukammal capabilities aur tasks darj zail hain:\n\n` +
      `---\n\n` +
      `### 1. 📱 Mobile Hardware & Camera Controls (Offline • 0 Tokens)\n` +
      `- 🔦 **Torch / Flashlight:**\n` +
      `  * \`torch on karo\` ya \`flashlight jalao\` (Mobile ki torch ON karna)\n` +
      `  * \`torch off karo\` ya \`torch band karo\` (Torch OFF karna)\n` +
      `- 📸 **Camera & Selfie (Android Gallery Auto-Save):**\n` +
      `  * \`front camera kholo aor selfie lo\` ya \`selfie lo\` (Front camera ID: 1 se selfie capture)\n` +
      `  * \`back camera kholo aor photo lo\` ya \`photo lo\` (Rear camera ID: 0 se photo capture)\n` +
      `  * *Auto-Sync:* Photos direct \`/storage/emulated/0/DCIM/Camera/\` mein save hoti hain aur \`termux-media-scan\` ke zariye Android Gallery / Google Photos mein foran add ho jati hain.\n\n` +
      `---\n\n` +
      `### 2. 🧠 Self-Learning & Online-to-Offline Auto-Distillation\n` +
      `- 🔄 **Online-to-Offline Distillation:** Jab aap Cloud AI se koi command ya process seekhte hain, main us executable step ko automatically apni offline memory (\`~/.jena/memory.json\`) mein save kar leti hoon taake baad mein bina internet 0 tokens par chal sake.\n` +
      `- ✍️ **Custom Operation Sikhana:**\n` +
      `  * \`seekho: jab main kahoon "system status" to command run karo "uptime && free -h"\`\n` +
      `  * \`seekho command "myip" = curl ifconfig.me\`\n` +
      `  * \`seekho: mera naam AbuSaif hay\` (Personal facts & preferences)\n` +
      `- 📋 **Saved Memory Check:** \`apne operations dikhao\` ya \`apni memory dikhao\`\n\n` +
      `---\n\n` +
      `### 3. 📦 Filesystem & Cross-Storage Transfer (Phone ↔ Termux)\n` +
      `- 📂 **Navigation:** \`pwd\` (current path), \`cd <folder>\`, \`ls\`, \`tree\`, \`find <file>\`, \`cat <file>\`.\n` +
      `- 🚚 **Cross-Storage Copy & Move (EXDEV Safe):**\n` +
      `  * \`phone se test.txt home main copy karo\`\n` +
      `  * \`termux se public folder phone main move kardo\`\n` +
      `  * \`public folder ko phone main copy karo\`\n` +
      `  * \`cp -r <src> <dest>\` / \`mv <src> <dest>\`\n` +
      `  * Shortcuts: \`downloads\`, \`dcim\`, \`pictures\`, \`phone\` (\`termux-to-phone\`), \`shared\`.\n\n` +
      `---\n\n` +
      `### 4. 💻 Safe Terminal Execution & System Health\n` +
      `- ⚡ **Terminal Execution:** \`terminal: pkg install -y <pkg>\` ya \`command: git pull\` (Auto-yes safe execution).\n` +
      `- 🔋 **Device Health:** \`battery status\`, \`ram check karo\`, \`storage check karo\`, \`specs\`.\n` +
      `- 🧮 **Instant Math:** \`hisab karo 1500 * 25\`.\n\n` +
      `---\n\n` +
      `### 5. 🎨 GUI Self-Inspection & Live Mutation\n` +
      `- 🔍 \`header components read karo\`, \`explain style.css\`, \`apne index.html ko explain karo\`.\n` +
      `- 🎨 \`css main background color #0b0f19 kardo\` (Live hot-reload).\n` +
      `- 🛠️ **Browser Code Editor:** \`http://localhost:8080\` par Monaco-style full code editor aur file explorer.\n\n` +
      `---\n\n` +
      `### 6. 🏗️ Offline Full-Stack Web Scaffolding\n` +
      `- \`webpage banao portfolio <name>\`, \`landing page banao\`, \`dashboard webpage banao\`, \`nodejs server banao\`.\n\n` +
      `---\n\n` +
      `### 7. 🐙 Git & GitHub Automation\n` +
      `- \`git status\`, \`git diff\`, \`git log\`, \`git commit push: "mera message"\`.\n\n` +
      `---\n\n` +
      `### 8. 🌐 High-Speed Online Cloud AI\n` +
      `- Groq (Qwen 27B / Llama 3.3 70B), Gemini Flash, OpenAI ke sath complex coding, debugging aur deep reasoning.\n` +
      `- Multi-key automatic rotation aur real-time tokens speed meter.\n\n` +
      `*(Aap kisi bhi waqt mujh se yeh tasks karwane ke liye bas command likhein!)*`
    );
  }

  static changeDirectory(query) {
    const res = FsTools.changeDirectory(query, this.getCwd());
    this.currentDir = res.newCwd;
    return res.message;
  }

  static listFiles(query) {
    return FsTools.listFiles(query, this.getCwd());
  }

  static async executeLearnedOperation(op) {
    return await TerminalTools.executeLearnedOperation(op, this.getCwd());
  }

  static async gitCommitAndPush(message, push = true) {
    return await GitTools.gitCommitAndPush(message, push, path.join(HOME_DIR, 'jena'));
  }
}

module.exports = {
  LocalEngine
};
