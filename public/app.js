/**
 * Jena v0.3 — Frontend Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const providerSelect = document.getElementById('providerSelect');
  const modelSelect = document.getElementById('modelSelect');
  const btnTestModel = document.getElementById('btnTestModel');
  const testBtnSpinner = document.getElementById('testBtnSpinner');
  const testBtnIcon = document.getElementById('testBtnIcon');
  const testFeedback = document.getElementById('testFeedback');

  const valAllowance = document.getElementById('valAllowance');
  const valUsed = document.getElementById('valUsed');
  const valBalance = document.getElementById('valBalance');
  const valSpeed = document.getElementById('valSpeed');
  const cardAllowance = document.getElementById('cardAllowance');

  const chatViewport = document.getElementById('chatViewport');
  const chatStream = document.getElementById('chatStream');
  const welcomeHero = document.getElementById('welcomeHero');
  const chatForm = document.getElementById('chatForm');
  const promptInput = document.getElementById('promptInput');
  const btnSend = document.getElementById('btnSend');

  // Modals
  const keysModal = document.getElementById('keysModal');
  const btnOpenKeysModal = document.getElementById('btnOpenKeysModal');
  const btnCloseKeysModal = document.getElementById('btnCloseKeysModal');
  const btnDoneKeys = document.getElementById('btnDoneKeys');
  const totalKeysBadge = document.getElementById('totalKeysBadge');
  const keysListContainer = document.getElementById('keysListContainer');
  const newKeyProvider = document.getElementById('newKeyProvider');
  const newKeyValue = document.getElementById('newKeyValue');
  const btnAddKey = document.getElementById('btnAddKey');

  const allowanceModal = document.getElementById('allowanceModal');
  const inputAllowance = document.getElementById('inputAllowance');
  const btnCloseAllowanceModal = document.getElementById('btnCloseAllowanceModal');
  const btnCancelAllowance = document.getElementById('btnCancelAllowance');
  const btnSaveAllowance = document.getElementById('btnSaveAllowance');

  let activeConfig = null;
  let isSending = false;

  // --- INIT ---
  init();

  async function init() {
    setupEventListeners();
    await fetchConfig();
  }

  // --- API DATA FETCHING ---
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();
      activeConfig = data;

      // Update Token Dashboard
      updateTokenDashboard(data.tokens);

      // Populate Provider Dropdown
      populateProviders(data.providers, data.activeProvider);

      // Populate Model Dropdown
      populateModels(data.providers, data.activeProvider, data.activeModel);

      // Update Keys Count Badge
      updateKeysBadge(data.keysCount);

      // Render Keys in Modal
      renderKeysList(data.maskedKeys);
    } catch (err) {
      console.error('Config load error:', err);
    }
  }

  function updateTokenDashboard(tokens) {
    if (!tokens) return;
    valAllowance.textContent = Number(tokens.allowance || 0).toLocaleString();
    valUsed.textContent = Number(tokens.used || 0).toLocaleString();
    valBalance.textContent = Number(tokens.balance || 0).toLocaleString();
    valSpeed.innerHTML = `${tokens.lastPromptSpeed || 0} <span class="unit">t/s</span>`;
  }

  function populateProviders(providersObj, selectedProvider) {
    if (!providersObj) return;
    providerSelect.innerHTML = '';
    Object.keys(providersObj).forEach(key => {
      const p = providersObj[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = p.name;
      if (key === selectedProvider) opt.selected = true;
      providerSelect.appendChild(opt);
    });
  }

  function populateModels(providersObj, providerKey, selectedModel) {
    if (!providersObj || !providersObj[providerKey]) return;
    const models = providersObj[providerKey].models || [];
    modelSelect.innerHTML = '';

    let matched = false;
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === selectedModel) {
        opt.selected = true;
        matched = true;
      }
      modelSelect.appendChild(opt);
    });

    if (!matched && selectedModel) {
      const opt = document.createElement('option');
      opt.value = selectedModel;
      opt.textContent = `${selectedModel} (Custom)`;
      opt.selected = true;
      modelSelect.appendChild(opt);
    }
  }

  function updateKeysBadge(keysCountObj) {
    if (!keysCountObj) return;
    const total = Object.values(keysCountObj).reduce((a, b) => a + b, 0);
    totalKeysBadge.textContent = total;
  }

  function renderKeysList(maskedKeysObj) {
    keysListContainer.innerHTML = '';
    if (!maskedKeysObj) return;

    let hasAnyKey = false;
    Object.entries(maskedKeysObj).forEach(([provider, keysArr]) => {
      if (Array.isArray(keysArr) && keysArr.length > 0) {
        hasAnyKey = true;
        keysArr.forEach((maskedKey, index) => {
          const item = document.createElement('div');
          item.className = 'key-item';
          item.innerHTML = `
            <div>
              <span class="key-provider-tag">${provider}</span>
              <span>${maskedKey}</span>
            </div>
            <button class="btn-del-key" data-provider="${provider}" data-index="${index}">&times; Delete</button>
          `;
          keysListContainer.appendChild(item);
        });
      }
    });

    if (!hasAnyKey) {
      keysListContainer.innerHTML = `<div style="text-align:center; padding: 12px; color: var(--text-muted); font-size: 12px;">Koi API key configured nahi hai. Upar se add karein.</div>`;
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Provider Change
    providerSelect.addEventListener('change', async () => {
      const newProvider = providerSelect.value;
      if (activeConfig && activeConfig.providers) {
        populateModels(activeConfig.providers, newProvider);
        const newModel = modelSelect.value;
        await saveSettings({ provider: newProvider, model: newModel });
      }
    });

    // Model Change
    modelSelect.addEventListener('change', async () => {
      const newModel = modelSelect.value;
      await saveSettings({ model: newModel });
    });

    // Test Model Button
    btnTestModel.addEventListener('click', handleTestModel);

    // Chat Submission
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendMessage();
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Auto-resize textarea
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(120, promptInput.scrollHeight) + 'px';
    });

    // Quick Prompts Chips
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-prompt]');
      if (chip) {
        const text = chip.getAttribute('data-prompt');
        if (text) {
          promptInput.value = text;
          promptInput.focus();
          handleSendMessage();
        }
      }
    });

    // Keys Modal
    btnOpenKeysModal.addEventListener('click', () => { keysModal.style.display = 'flex'; });
    btnCloseKeysModal.addEventListener('click', () => { keysModal.style.display = 'none'; });
    btnDoneKeys.addEventListener('click', () => { keysModal.style.display = 'none'; });

    // Add Key
    btnAddKey.addEventListener('click', handleAddKey);

    // Delete Key (delegated)
    keysListContainer.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.btn-del-key');
      if (delBtn) {
        const provider = delBtn.getAttribute('data-provider');
        const index = delBtn.getAttribute('data-index');
        await handleDeleteKey(provider, index);
      }
    });

    // Allowance Modal
    cardAllowance.addEventListener('click', () => {
      if (activeConfig && activeConfig.tokens) {
        inputAllowance.value = activeConfig.tokens.allowance || 500000;
      }
      allowanceModal.style.display = 'flex';
    });
    btnCloseAllowanceModal.addEventListener('click', () => { allowanceModal.style.display = 'none'; });
    btnCancelAllowance.addEventListener('click', () => { allowanceModal.style.display = 'none'; });
    btnSaveAllowance.addEventListener('click', handleSaveAllowance);
  }

  // --- ACTIONS ---

  async function saveSettings(payload) {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await fetchConfig();
    } catch (e) {
      console.error('Settings save error:', e);
    }
  }

  async function handleTestModel() {
    const provider = providerSelect.value;
    const model = modelSelect.value;

    btnTestModel.disabled = true;
    testBtnSpinner.style.display = 'inline-block';
    testBtnIcon.style.display = 'none';
    testFeedback.style.display = 'none';

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model })
      });
      const data = await res.json();

      testFeedback.style.display = 'flex';
      if (data.success) {
        testFeedback.className = 'test-feedback-banner success';
        testFeedback.innerHTML = `
          <span>${data.message} &bull; Response: "<em>${data.reply}</em>"</span>
          <span>⚡ <strong>${data.latencyMs}ms</strong> &bull; <strong>${data.tokensPerSecond} t/s</strong></span>
        `;
      } else {
        testFeedback.className = 'test-feedback-banner error';
        testFeedback.innerHTML = `
          <span>❌ Test Failed: ${data.error || 'Connection refused'}</span>
          <span>Latency: ${data.latencyMs}ms</span>
        `;
      }
    } catch (err) {
      testFeedback.style.display = 'flex';
      testFeedback.className = 'test-feedback-banner error';
      testFeedback.innerHTML = `<span>❌ Network Error: ${err.message}</span>`;
    } finally {
      btnTestModel.disabled = false;
      testBtnSpinner.style.display = 'none';
      testBtnIcon.style.display = 'inline-block';
    }
  }

  async function handleAddKey() {
    const provider = newKeyProvider.value;
    const key = newKeyValue.value.trim();
    if (!key) {
      alert('Barah-e-karam API key enter karein.');
      return;
    }

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key })
      });
      const data = await res.json();
      if (data.success) {
        newKeyValue.value = '';
        await fetchConfig();
      } else {
        alert(data.error || 'Key add nahi ho saki');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function handleDeleteKey(provider, index) {
    if (!confirm(`Kya aap yeh ${provider.toUpperCase()} key delete karna chahte hain?`)) return;
    try {
      await fetch('/api/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, index })
      });
      await fetchConfig();
    } catch (e) {
      alert('Delete error: ' + e.message);
    }
  }

  async function handleSaveAllowance() {
    const val = parseInt(inputAllowance.value, 10);
    if (!val || val <= 0) return;
    await saveSettings({ allowance: val });
    allowanceModal.style.display = 'none';
  }

  // --- CHAT STREAMING ---
  async function handleSendMessage() {
    const message = promptInput.value.trim();
    if (!message || isSending) return;

    if (welcomeHero) welcomeHero.style.display = 'none';

    // Append User Message
    appendMessage('user', message);
    promptInput.value = '';
    promptInput.style.height = 'auto';

    // Create Assistant Placeholder
    const assistantRow = appendMessage('assistant', '', 'thinking');
    const bubble = assistantRow.querySelector('.message-bubble');
    const meta = assistantRow.querySelector('.message-meta');

    isSending = true;
    btnSend.disabled = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          provider: providerSelect.value,
          model: modelSelect.value
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep last chunk

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));
            handleServerEvent(event, bubble, meta);
          } catch (_) {}
        }
      }

      await fetchConfig();
    } catch (err) {
      bubble.textContent = `❌ Error: ${err.message}`;
    } finally {
      isSending = false;
      btnSend.disabled = false;
      promptInput.focus();
    }
  }

  function handleServerEvent(event, bubble, meta) {
    if (event.type === 'mode') {
      meta.innerHTML = `<span class="mode-badge ${event.mode}">${event.mode === 'offline' ? '⚡ Offline Local' : '🌐 Online Cloud'}</span>`;
    } else if (event.type === 'thought') {
      bubble.innerHTML = `<div style="color:var(--text-muted); font-size:12px; margin-bottom:6px;"><em>${escapeHtml(event.content)}</em></div>`;
    } else if (event.type === 'done') {
      bubble.innerHTML = formatMarkdown(event.text);
      if (event.stats) {
        const tps = event.stats.speed ? `${event.stats.speed} t/s` : '';
        const tok = event.stats.totalTokens ? `${event.stats.totalTokens} tokens` : '0 tokens';
        meta.innerHTML += ` &bull; <span>${tok}</span> ${tps ? `&bull; <span class="speed-tag">${tps}</span>` : ''}`;
        if (event.stats.balance !== undefined) {
          valBalance.textContent = Number(event.stats.balance).toLocaleString();
        }
        if (event.stats.speed !== undefined) {
          valSpeed.innerHTML = `${event.stats.speed} <span class="unit">t/s</span>`;
        }
      }
      chatViewport.scrollTop = chatViewport.scrollHeight;
    } else if (event.type === 'error') {
      bubble.innerHTML = `<span style="color: var(--accent-red);">❌ ${escapeHtml(event.error)}</span>`;
    }
  }

  function appendMessage(role, text, state = '') {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    const initialText = state === 'thinking' ? '<span class="spinner"></span> <em>Soch rahi hoon...</em>' : escapeHtml(text);
    row.innerHTML = `
      <div class="message-bubble">${initialText}</div>
      <div class="message-meta"></div>
    `;
    chatStream.appendChild(row);
    chatViewport.scrollTop = chatViewport.scrollHeight;
    return row;
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
