/**
 * =====================================================================
 *  🌐 JENA v0.3 — Web Scaffolding & Offline Knowledge Tools
 * =====================================================================
 */

const fs = require("fs");
const path = require("path");
const { FsTools } = require("./fs");
const { HOME_DIR } = require("../config");

class ScaffoldTools {
  static scaffoldWebPage(query) {
    const q = (query || '').toLowerCase();
    const cwd = this.getCwd();

    // Determine type: portfolio | landing | dashboard | nodejs | blank
    let type = 'landing';
    if (q.includes('portfolio') || q.includes('cv') || q.includes('resume')) type = 'portfolio';
    else if (q.includes('dashboard') || q.includes('admin')) type = 'dashboard';
    else if (q.includes('nodejs') || q.includes('node.js') || q.includes('node server') || q.includes('backend server')) type = 'nodejs';
    else if (q.includes('blank') || q.includes('basic') || q.includes('simple')) type = 'blank';

    // Extract project folder name if specified
    const nameMatch = query.match(/(?:banao|create|likho|generate)\s+(?:aik\s+|ek\s+)?(?:webpage|web\s+page|website|landing\s+page|portfolio|dashboard|html\s+page|html\s+file|nodejs\s+server|nodejs\s+project|node\s+server)?\s*["']?([a-z0-9_-]+)?["']?/i);
    let projectName = (nameMatch && nameMatch[1] && !['aik', 'ek', 'webpage', 'portfolio', 'landing', 'dashboard', 'project', 'server'].includes(nameMatch[1].toLowerCase()))
      ? nameMatch[1].trim().toLowerCase()
      : `${type}_project`;

    const projectDir = path.join(cwd, projectName);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    let filesCreated = [];

    if (type === 'portfolio') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Developer Portfolio</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
  <nav class="navbar">
    <div class="logo">&lt;Dev/&gt;</div>
    <ul class="nav-links">
      <li><a href="#about">About</a></li>
      <li><a href="#skills">Skills</a></li>
      <li><a href="#projects">Projects</a></li>
      <li><a href="#contact" class="btn-cta">Contact</a></li>
    </ul>
  </nav>

  <header class="hero">
    <div class="badge">🚀 Available for Projects</div>
    <h1>Hi, I'm <span class="gradient-text">Full-Stack Developer</span></h1>
    <p>Crafting high-performance web applications, autonomous tools, and modern software.</p>
    <div class="hero-actions">
      <a href="#projects" class="btn btn-primary">View Projects</a>
      <a href="#contact" class="btn btn-secondary">Get In Touch</a>
    </div>
  </header>

  <section id="skills" class="section">
    <h2>Core Tech Stack</h2>
    <div class="skills-grid">
      <span class="skill-tag">JavaScript / ES6+</span>
      <span class="skill-tag">Node.js</span>
      <span class="skill-tag">HTML5 & Semantic Web</span>
      <span class="skill-tag">CSS3 / Grid / Flexbox</span>
      <span class="skill-tag">REST APIs & SSE</span>
      <span class="skill-tag">Linux / Termux Bash</span>
    </div>
  </section>

  <section id="projects" class="section">
    <h2>Featured Projects</h2>
    <div class="projects-grid">
      <div class="project-card">
        <h3>🤖 Autonomous AI Agent</h3>
        <p>A hybrid local & cloud AI assistant with zero-token local execution, multi-key rotation, and self-learning.</p>
        <div class="tags"><small>Node.js</small> • <small>SSE</small> • <small>Shell</small></div>
      </div>
      <div class="project-card">
        <h3>⚡ Real-time Token Tracker</h3>
        <p>High-precision throughput monitor calculating tokens per second and cumulative allowance balance.</p>
        <div class="tags"><small>HTML5</small> • <small>CSS3</small> • <small>JavaScript</small></div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <p>Built with ❤️ by Jena Offline Web Engine &bull; Zero Tokens Consumed.</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>`;

      const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #080b11;
  color: #f8fafc;
  line-height: 1.6;
}
.navbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.2rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.08);
  background: rgba(8,11,17,0.8); backdrop-filter: blur(10px);
  position: sticky; top: 0; z-index: 100;
}
.logo { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 1.3rem; color: #00d2ff; }
.nav-links { display: flex; list-style: none; gap: 1.5rem; align-items: center; }
.nav-links a { color: #94a3b8; text-decoration: none; font-size: 0.95rem; transition: 0.2s; }
.nav-links a:hover { color: #00d2ff; }
.btn-cta { background: #00d2ff; color: #000 !important; font-weight: 700; padding: 0.4rem 1rem; border-radius: 20px; }

.hero { text-align: center; padding: 5rem 1.5rem 4rem; max-width: 800px; margin: 0 auto; }
.badge { display: inline-block; background: rgba(0,210,255,0.1); color: #00d2ff; border: 1px solid rgba(0,210,255,0.3); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; margin-bottom: 1.5rem; }
.hero h1 { font-size: 2.8rem; font-weight: 800; margin-bottom: 1rem; letter-spacing: -0.5px; }
.gradient-text { background: linear-gradient(90deg, #00d2ff, #9d4edd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero p { font-size: 1.15rem; color: #94a3b8; margin-bottom: 2rem; }
.hero-actions { display: flex; justify-content: center; gap: 1rem; }
.btn { padding: 0.7rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: 0.2s; }
.btn-primary { background: #00d2ff; color: #000; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,210,255,0.4); }
.btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.15); }
.btn-secondary:hover { background: rgba(255,255,255,0.1); }

.section { max-width: 900px; margin: 0 auto; padding: 3.5rem 1.5rem; }
.section h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 1.5rem; color: #fff; }
.skills-grid { display: flex; flex-wrap: wrap; gap: 0.8rem; }
.skill-tag { background: rgba(157,78,221,0.15); color: #c084fc; border: 1px solid rgba(157,78,221,0.3); padding: 0.4rem 0.9rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }

.projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; }
.project-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; transition: 0.3s; }
.project-card:hover { border-color: #00d2ff; transform: translateY(-3px); }
.project-card h3 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.project-card p { font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem; }
.tags small { color: #00d2ff; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; }

.footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem; color: #64748b; margin-top: 4rem; }
@media (max-width: 600px) {
  .hero h1 { font-size: 2rem; }
  .navbar { flex-direction: column; gap: 0.8rem; }
}`;

      const js = `// Interactive Portfolio Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('Portfolio initialized successfully.');
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(c => {
    c.addEventListener('click', () => {
      console.log('Project clicked:', c.querySelector('h3').textContent);
    });
  });
});`;

      fs.writeFileSync(path.join(projectDir, 'index.html'), html, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'style.css'), css, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'app.js'), js, 'utf8');
      filesCreated = ['index.html', 'style.css', 'app.js'];
    } else if (type === 'nodejs') {
      const serverCode = `const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>🚀 Node.js Server is Running!</h1><p>Created by Jena Offline Engine.</p>');
  }
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), time: new Date() }));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});`;

      const pkgJson = JSON.stringify({
        name: projectName,
        version: "1.0.0",
        main: "server.js",
        scripts: { start: "node server.js" }
      }, null, 2);

      fs.writeFileSync(path.join(projectDir, 'server.js'), serverCode, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'package.json'), pkgJson, 'utf8');
      filesCreated = ['server.js', 'package.json'];
    } else {
      // Landing / Standard Webpage
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName.replace(/_/g, ' ').toUpperCase()}</title>
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body>
  <div class="container">
    <nav class="nav">
      <div class="logo">⚡ ${projectName.toUpperCase()}</div>
      <button id="btnTheme" class="btn-theme">🌓 Toggle</button>
    </nav>
    <main class="hero">
      <h1>Modern Webpage Built Offline</h1>
      <p>Jena ne yeh responsive webpage Termux environment mein bina kisi internet ya AI token ke generate kiya hai.</p>
      <button class="btn-main" id="btnClickMe">Explore Features 🚀</button>
    </main>
    <div id="outputBox" class="output-box" style="display: none;"></div>
  </div>
  <script src="app.js"></script>
</body>
</html>`;

      const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b0f19; color: #fff; min-height: 100vh; display: flex; flex-direction: column; }
.container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; width: 100%; }
.nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4rem; }
.logo { font-size: 1.2rem; font-weight: 800; color: #00d2ff; }
.btn-theme { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; }
.hero { text-align: center; padding: 2rem 0; }
.hero h1 { font-size: 2.6rem; font-weight: 800; margin-bottom: 1rem; color: #00d2ff; }
.hero p { font-size: 1.1rem; color: #94a3b8; max-width: 600px; margin: 0 auto 2rem; }
.btn-main { background: #00d2ff; color: #000; font-weight: 700; padding: 0.8rem 1.8rem; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: 0.2s; }
.btn-main:hover { transform: scale(1.04); }
.output-box { background: rgba(0,210,255,0.08); border: 1px solid rgba(0,210,255,0.3); border-radius: 8px; padding: 1.2rem; margin-top: 2rem; text-align: center; }`;

      const js = `document.getElementById('btnClickMe').addEventListener('click', () => {
  const box = document.getElementById('outputBox');
  box.style.display = 'block';
  box.innerHTML = '🎉 <strong>Success:</strong> Webpage interactive hai aur JavaScript kaam kar rahi hai!';
});`;

      fs.writeFileSync(path.join(projectDir, 'index.html'), html, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'style.css'), css, 'utf8');
      fs.writeFileSync(path.join(projectDir, 'app.js'), js, 'utf8');
      filesCreated = ['index.html', 'style.css', 'app.js'];
    }

    return (
      `🌐 **Jena Offline Web Engine: Webpage Scaffolded Successfully!**\n\n` +
      `- 📁 **Project Folder:** \`${projectDir}\`\n` +
      `- 📦 **Type / Template:** \`${type.toUpperCase()}\`\n` +
      `- 📄 **Files Created:**\n` +
      filesCreated.map(f => `  * \`${f}\` (${(fs.statSync(path.join(projectDir, f)).size / 1024).toFixed(1)} KB)`).join('\n') +
      `\n\n` +
      `⚡ **Test / Run Karne Ka Tareeqa:**\n` +
      (type === 'nodejs'
        ? `1. Folder mein jayein: \`cd ${projectName}\`\n2. Server run karein: \`node server.js\`\n3. Browser mein kholein: \`http://localhost:3000\``
        : `1. Folder mein jayein: \`cd ${projectName}\`\n2. Files dekhein: \`ls\` ya \`cat index.html\`\n3. Direct browser mein kholein: \`file://${path.join(projectDir, 'index.html')}\``
      ) +
      `\n\n*(Yeh poora webpage Jena ke offline local engine ne bina kisi AI token ke generate kiya!)*`
    );
  }

  static handleFileWriteOrEdit(query) {
    const q = query.trim();

    // 1. Append to file: "append file <filename> <content>" OR "file append karo <filename> <content>"
    const appendMatch = q.match(/^(?:append(?:\s+to)?\s+file|file\s+append\s+karo)\s+([^\s]+)\s+([\s\S]+)$/i);
    if (appendMatch) {
      const targetPath = FsTools.resolvePath(appendMatch[1]);
      const content = appendMatch[2].replace(/^```[a-z]*\s*|^```\s*|```$/g, '');
      try {
        fs.appendFileSync(targetPath, '\n' + content, 'utf8');
        return `✅ **Content Appended Successfully:** \`${targetPath}\``;
      } catch (e) {
        return `❌ **Append Error:** ${e.message}`;
      }
    }

    // 2. Edit file (search & replace): "edit file <filename> replace "<old>" with "<new>""
    const editMatch = q.match(/^(?:edit\s+file|file\s+edit\s+karo|replace\s+in\s+file)\s+([^\s]+)\s+(?:replace|badlo)\s+["']([^"']+)["']\s+(?:with|ko)\s+["']([^"']+)["']/i);
    if (editMatch) {
      const targetPath = FsTools.resolvePath(editMatch[1]);
      const oldStr = editMatch[2];
      const newStr = editMatch[3];
      if (!fs.existsSync(targetPath)) return `❌ **Error:** File mojood nahi hai: \`${targetPath}\``;
      try {
        let content = fs.readFileSync(targetPath, 'utf8');
        if (!content.includes(oldStr)) {
          return `⚠️ **Error:** Target string file mein nahi mila:\n\`${oldStr}\``;
        }
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(targetPath, content, 'utf8');
        return `✅ **File Edited Successfully:** \`${targetPath}\`\nReplaced:\n\`${oldStr}\`\n➔ With:\n\`${newStr}\``;
      } catch (e) {
        return `❌ **Edit Error:** ${e.message}`;
      }
    }

    // 3. Write file: "write file <filename> <content>" OR "file likho <filename> <content>"
    const writeMatch = q.match(/^(?:write\s+file|file\s+likho|file\s+create\s+karo)\s+([^\s]+)\s+([\s\S]+)$/i);
    if (writeMatch) {
      const targetPath = FsTools.resolvePath(writeMatch[1]);
      let content = writeMatch[2].trim();
      content = content.replace(/^```[a-z]*\s*|^```\s*|```$/g, '');
      try {
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf8');
        return `✅ **File Written Successfully:** \`${targetPath}\` (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`;
      } catch (e) {
        return `❌ **Write Error:** ${e.message}`;
      }
    }

    return `⚠️ Format samajh nahi aya. Tareeqa:\n- \`write file test.html <h1>Hello</h1>\`\n- \`edit file test.html replace "<h1>Hello</h1>" with "<h1>Assalam-o-Alaikum</h1>"\`\n- \`append file test.html <p>New line</p>\``;
  }

  static explainWebConcept(query) {
    const q = (query || '').toLowerCase();

    // Node.js concepts
    if (q.includes('nodejs') || q.includes('node.js') || q.includes('node')) {
      return (
        `🐍 **Node.js Core Concepts (Offline Reference):**\n\n` +
        `Node.js aik Chrome V8 JavaScript runtime engine hai jo server-side code run karta hai:\n\n` +
        `1. **Native HTTP Server (Zero Dependencies):**\n` +
        `\`\`\`javascript\nconst http = require('http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ status: 'ok', time: new Date() }));\n});\nserver.listen(3000);\n\`\`\`\n\n` +
        `2. **Filesystem Module (\`fs\`):** Synchronous (\`fs.readFileSync\`) vs Asynchronous (\`fs.readFile\`, \`fs.promises\`).\n` +
        `3. **Path Module (\`path\`):** Cross-platform path handling (\`path.join(__dirname, 'public')\`).\n` +
        `4. **Child Process (\`child_process\`):** Shell commands execute karna (\`exec\`, \`spawn\`).\n\n` +
        `*(Naya Node.js project scaffold karne ke liye bolein: \`nodejs server banao\`)*`
      );
    }

    // HTML concepts
    if (q.includes('html')) {
      return (
        `📄 **HTML5 Core Concepts (Offline Reference):**\n\n` +
        `1. **Semantic Elements:** \`<header>\`, \`<nav>\`, \`<main>\`, \`<section>\`, \`<article>\`, \`<footer>\` — accessibility aur SEO ke liye zaroori hain.\n` +
        `2. **Responsive Meta Tag:** \`<meta name="viewport" content="width=device-width, initial-scale=1.0">\` jo mobile layout scale karta hai.\n` +
        `3. **Forms & Inputs:** \`<form>\`, \`<input type="text|password|number">\`, \`<textarea>\`, \`<select>\`.\n` +
        `4. **Media Elements:** \`<img>\`, \`<svg>\`, \`<video>\`, \`<audio>\`.\n\n` +
        `*(Naya webpage scaffold karne ke liye bolein: \`webpage banao portfolio\` ya \`landing page banao\`)*`
      );
    }

    // CSS concepts
    if (q.includes('css')) {
      return (
        `🎨 **CSS3 Core Concepts (Offline Reference):**\n\n` +
        `1. **Flexbox (1D Layout):**\n` +
        `\`\`\`css\n.container { display: flex; justify-content: space-between; align-items: center; gap: 12px; }\n\`\`\`\n\n` +
        `2. **CSS Grid (2D Layout):**\n` +
        `\`\`\`css\n.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }\n\`\`\`\n\n` +
        `3. **CSS Variables & Glassmorphism:**\n` +
        `\`\`\`css\n:root { --accent: #00d2ff; --bg: #0a0d14; }\n.glass-card { background: rgba(18, 24, 38, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }\n\`\`\`\n\n` +
        `4. **Media Queries (Responsive Design):**\n` +
        `\`\`\`css\n@media (max-width: 768px) { .nav { flex-direction: column; } }\n\`\`\`\n\n` +
        `*(Jena ki CSS edit karne ke liye bolein: \`css main background color #050811 kardo\`)*`
      );
    }

    // JS concepts
    if (q.includes('js') || q.includes('javascript')) {
      return (
        `⚡ **Modern JavaScript (ES6+) Core Concepts (Offline Reference):**\n\n` +
        `1. **Async / Await & Fetch API:**\n` +
        `\`\`\`javascript\nasync function getData() {\n  try {\n    const res = await fetch('/api/data');\n    const data = await res.json();\n    console.log(data);\n  } catch (err) { console.error(err); }\n}\n\`\`\`\n\n` +
        `2. **DOM Manipulation & Event Listeners:**\n` +
        `\`\`\`javascript\ndocument.getElementById('myBtn').addEventListener('click', (e) => {\n  document.querySelector('.output').textContent = 'Clicked!';\n});\n\`\`\`\n\n` +
        `3. **Array Methods:** \`.map()\`, \`.filter()\`, \`.reduce()\`, \`.find()\`, \`.forEach()\`.\n` +
        `4. **Server-Sent Events (SSE):** Real-time text streaming without WebSockets.`
      );
    }

    return `💡 Main HTML, CSS, JavaScript, aur Node.js offline sikh sakti hoon. Poochhein: \`html explain karo\`, \`css explain karo\`, \`js explain karo\`, ya \`nodejs explain karo\`.`;
  }


}

module.exports = {
  ScaffoldTools
};
