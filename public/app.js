/**
 * Jena v0.3 — Frontend Application Logic (2-Page Architecture)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs & Pages
  const tabNavMain = document.getElementById('tabNavMain');
  const tabNavSettings = document.getElementById('tabNavSettings');
  const pageMain = document.getElementById('pageMain');
  const pageSettings = document.getElementById('pageSettings');
  const btnJumpToSettings = document.getElementById('btnJumpToSettings');
  const btnBackToChat = document.getElementById('btnBackToChat');

  // Main Page Elements
  const mainActiveModelText = document.getElementById('mainActiveModelText');
  const valAllowance = document.getElementById('valAllowance');
  const valUsed = document.getElementById('valUsed');
  const valBalance = document.getElementById('valBalance');
  const valSpeed = document.getElementById('valSpeed');
  const cardAllowance = document.getElementById('cardAllowance');

  const btnModeOnline = document.getElementById('btnModeOnline');
  const btnModeOffline = document.getElementById('btnModeOffline');
  const inputModeTag = document.getElementById('inputModeTag');

  const chatViewport = document.getElementById('chatViewport');
  const chatStream = document.getElementById('chatStream');
  const welcomeHero = document.getElementById('welcomeHero');
  const chatForm = document.getElementById('chatForm');
  const promptInput = document.getElementById('promptInput');
  const btnSend = document.getElementById('btnSend');

  // Settings Page Elements
  const providerSelect = document.getElementById('providerSelect');
  const modelSelect = document.getElementById('modelSelect');
  const activeProviderBadge = document.getElementById('activeProviderBadge');
  const btnTestModel = document.getElementById('btnTestModel');
  const testBtnSpinner = document.getElementById('testBtnSpinner');
  const testBtnIcon = document.getElementById('testBtnIcon');
  const testFeedback = document.getElementById('testFeedback');

  // API Keys Elements
  const totalKeysBadge = document.getElementById('totalKeysBadge');
  const newKeyProvider = document.getElementById('newKeyProvider');
  const newKeyValue = document.getElementById('newKeyValue');
  const btnAddKey = document.getElementById('btnAddKey');
  const keysListContainer = document.getElementById('keysListContainer');

  // Add Custom Model Elements
  const customModelProvider = document.getElementById('customModelProvider');
  const customModelId = document.getElementById('customModelId');
  const customModelName = document.getElementById('customModelName');
  const btnSaveCustomModel = document.getElementById('btnSaveCustomModel');
  const customModelFeedback = document.getElementById('customModelFeedback');
  const customModelsListContainer = document.getElementById('customModelsListContainer');

  // Add Custom Provider Elements
  const newProviderId = document.getElementById('newProviderId');
  const newProviderName = document.getElementById('newProviderName');
  const newProviderEndpoint = document.getElementById('newProviderEndpoint');
  const newProviderDefaultModelId = document.getElementById('newProviderDefaultModelId');
  const newProviderDefaultModelName = document.getElementById('newProviderDefaultModelName');
  const newProviderApiKey = document.getElementById('newProviderApiKey');
  const btnSaveCustomProvider = document.getElementById('btnSaveCustomProvider');
  const customProviderFeedback = document.getElementById('customProviderFeedback');
  const customProvidersListContainer = document.getElementById('customProvidersListContainer');

  // Allowance Modal Elements
  const allowanceModal = document.getElementById('allowanceModal');
  const inputAllowance = document.getElementById('inputAllowance');
  const btnCloseAllowanceModal = document.getElementById('btnCloseAllowanceModal');
  const btnCancelAllowance = document.getElementById('btnCancelAllowance');
  const btnSaveAllowance = document.getElementById('btnSaveAllowance');

  // State
  let activeConfig = null;
  let currentMode = 'online'; // 'online' | 'offline'
  let lastOnlineProvider = 'groq';
  let lastOnlineModel = 'qwen/qwen3.8-27b';
  let isSending = false;

  // --- INIT ---
  init();

  async function init() {
    setupNavigation();
    setupEventListeners();
    await fetchConfig();
  }

  // --- 2-PAGE NAVIGATION SYSTEM ---
  function setupNavigation() {
    tabNavMain.addEventListener('click', () => showPage('main'));
    tabNavSettings.addEventListener('click', () => showPage('settings'));
    if (btnJumpToSettings) btnJumpToSettings.addEventListener('click', () => showPage('settings'));
    if (btnBackToChat) btnBackToChat.addEventListener('click', () => showPage('main'));

    // Handle initial route
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash === '#settings' || path === '/settings' || path === '/models' || path === '/providers') {
      showPage('settings', false);
    } else {
      showPage('main', false);
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.toLowerCase();
      if (h === '#settings') showPage('settings', false);
      else showPage('main', false);
    });
  }

  function showPage(pageName, updateHash = true) {
    if (pageName === 'settings') {
      pageMain.style.display = 'none';
      pageSettings.style.display = 'flex';
      tabNavSettings.classList.add('active');
      tabNavMain.classList.remove('active');
      if (updateHash) window.location.hash = '#settings';
    } else {
      pageSettings.style.display = 'none';
      pageMain.style.display = 'flex';
      tabNavMain.classList.add('active');
      tabNavSettings.classList.remove('active');
      if (updateHash) window.location.hash = '#chat';
    }
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

      // Populate Provider Dropdown on Page 2
      populateProviders(data.providers, data.activeProvider);

      // Populate Model Dropdown on Page 2
      populateModels(data.providers, data.activeProvider, data.activeModel);

      // Populate Providers in Key / Custom selects
      populateModalProviders(data.providers);

      // Update Active Model Pill on Main Page
      updateMainActiveModelPill();

      // Render Keys List on Page 2
      renderKeysList(data.maskedKeys);

      // Render Custom Models & Providers Lists on Page 2
      renderCustomModelsList(data.customModels);
      renderCustomProvidersList(data.customProviders);

      // Update Mode state & UI
      if (data.mode === 'offline' || data.activeProvider === 'offline') {
        setModeUI('offline');
      } else {
        setModeUI('online');
        lastOnlineProvider = data.activeProvider;
        lastOnlineModel = data.activeModel;
      }

      // Update Keys Count Badge
      updateKeysBadge(data.keysCount);
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

  function updateMainActiveModelPill() {
    if (!activeConfig || !activeConfig.providers) return;
    const p = activeConfig.activeProvider;
    const m = activeConfig.activeModel;

    if (p === 'offline') {
      mainActiveModelText.textContent = '⚡ Jena Local Core (Offline • 0 Tokens)';
      activeProviderBadge.textContent = 'OFFLINE';
      activeProviderBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      activeProviderBadge.style.color = '#34d399';
    } else {
      const pName = activeConfig.providers[p]?.name?.split('(')[0]?.trim() || p;
      const modelObj = (activeConfig.providers[p]?.models || []).find(x => x.id === m);
      const mName = modelObj ? modelObj.name.split('(')[0]?.trim() : m;
      mainActiveModelText.textContent = `${pName} • ${mName}`;
      activeProviderBadge.textContent = 'ONLINE';
      activeProviderBadge.style.background = 'rgba(0, 210, 255, 0.2)';
      activeProviderBadge.style.color = '#38bdf8';
    }
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

  function populateModalProviders(providersObj) {
    if (!providersObj) return;

    // 1. Populate Target Provider for Add Model Form (exclude offline)
    if (customModelProvider) {
      customModelProvider.innerHTML = '';
      Object.keys(providersObj).forEach(key => {
        if (key === 'offline') return;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = providersObj[key].name;
        customModelProvider.appendChild(opt);
      });
    }

    // 2. Populate newKeyProvider in API Keys Form (exclude offline)
    if (newKeyProvider) {
      const currentSelected = newKeyProvider.value;
      newKeyProvider.innerHTML = '';
      Object.keys(providersObj).forEach(key => {
        if (key === 'offline') return;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = providersObj[key].name;
        if (key === currentSelected) opt.selected = true;
        newKeyProvider.appendChild(opt);
      });
    }
  }

  function updateKeysBadge(keysCountObj) {
    if (!keysCountObj) return;
    const total = Object.values(keysCountObj).reduce((a, b) => a + b, 0);
    totalKeysBadge.textContent = `${total} Keys`;
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

  function renderCustomModelsList(customModelsObj) {
    if (!customModelsListContainer) return;
    customModelsListContainer.innerHTML = '';
    if (!customModelsObj || Object.keys(customModelsObj).length === 0) return;

    let rows = [];
    Object.entries(customModelsObj).forEach(([pid, models]) => {
      if (Array.isArray(models)) {
        models.forEach(m => {
          rows.push(`
            <div class="custom-item-row">
              <div>
                <span class="key-provider-tag">${pid}</span>
                <span class="custom-item-name">${escapeHtml(m.id)}</span>
                <span class="custom-item-sub">(${escapeHtml(m.name)})</span>
              </div>
              <button class="btn-del-item" data-action="del-custom-model" data-provider="${pid}" data-model="${m.id}">&times; Delete</button>
            </div>
          `);
        });
      }
    });

    if (rows.length > 0) {
      customModelsListContainer.innerHTML = `
        <h4 style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Saved Custom Models:</h4>
        ${rows.join('')}
      `;
    }
  }

  function renderCustomProvidersList(customProvidersObj) {
    if (!customProvidersListContainer) return;
    customProvidersListContainer.innerHTML = '';
    if (!customProvidersObj || Object.keys(customProvidersObj).length === 0) return;

    let rows = [];
    Object.entries(customProvidersObj).forEach(([pid, pData]) => {
      rows.push(`
        <div class="custom-item-row">
          <div>
            <span class="key-provider-tag">${pid}</span>
            <span class="custom-item-name">${escapeHtml(pData.name)}</span>
            <span class="custom-item-sub">${escapeHtml(pData.endpoint)}</span>
          </div>
          <button class="btn-del-item" data-action="del-custom-provider" data-provider="${pid}">&times; Delete</button>
        </div>
      `);
    });

    if (rows.length > 0) {
      customProvidersListContainer.innerHTML = `
        <h4 style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Saved Online Providers:</h4>
        ${rows.join('')}
      `;
    }
  }

  // --- MODE SWITCH LOGIC ---
  function setModeUI(mode) {
    currentMode = mode;
    if (mode === 'offline') {
      btnModeOffline.classList.add('active');
      btnModeOnline.classList.remove('active');
      if (inputModeTag) {
        inputModeTag.textContent = '⚡ Offline Mode: 100% Termux Hardware & Math • 0 Tokens Consumed';
      }
    } else {
      btnModeOnline.classList.add('active');
      btnModeOffline.classList.remove('active');
      if (inputModeTag) {
        inputModeTag.textContent = '🌐 Online Mode: Routine tasks run locally • Complex queries use Cloud AI';
      }
    }
  }

  async function handleSwitchMode(mode) {
    if (mode === 'offline') {
      if (providerSelect.value !== 'offline') {
        lastOnlineProvider = providerSelect.value;
        lastOnlineModel = modelSelect.value;
      }
      setModeUI('offline');
      providerSelect.value = 'offline';
      populateModels(activeConfig.providers, 'offline', 'jena-local-core');
      await saveSettings({ mode: 'offline', provider: 'offline', model: 'jena-local-core' });
    } else {
      setModeUI('online');
      const targetProvider = (lastOnlineProvider && lastOnlineProvider !== 'offline') ? lastOnlineProvider : 'groq';
      providerSelect.value = targetProvider;
      populateModels(activeConfig.providers, targetProvider, lastOnlineModel);
      await saveSettings({ mode: 'online', provider: targetProvider, model: modelSelect.value });
    }
    updateMainActiveModelPill();
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Mode Switch Buttons
    btnModeOnline.addEventListener('click', () => handleSwitchMode('online'));
    btnModeOffline.addEventListener('click', () => handleSwitchMode('offline'));

    // Provider Change Dropdown (Page 2)
    providerSelect.addEventListener('change', async () => {
      const newProvider = providerSelect.value;
      if (newProvider === 'offline') {
        setModeUI('offline');
      } else {
        setModeUI('online');
        lastOnlineProvider = newProvider;
      }

      if (activeConfig && activeConfig.providers) {
        populateModels(activeConfig.providers, newProvider);
        const newModel = modelSelect.value;
        lastOnlineModel = newModel;
        await saveSettings({ mode: currentMode, provider: newProvider, model: newModel });
        updateMainActiveModelPill();
      }
    });

    // Model Change Dropdown (Page 2)
    modelSelect.addEventListener('change', async () => {
      const newModel = modelSelect.value;
      if (currentMode === 'online') {
        lastOnlineModel = newModel;
      }
      await saveSettings({ model: newModel });
      updateMainActiveModelPill();
    });

    // Test Model Button (Page 2)
    btnTestModel.addEventListener('click', handleTestModel);

    // Chat Submission (Page 1)
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

    // Add Key (Page 2)
    btnAddKey.addEventListener('click', handleAddKey);

    // Delete Key (delegated on Page 2)
    keysListContainer.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.btn-del-key');
      if (delBtn) {
        const provider = delBtn.getAttribute('data-provider');
        const index = delBtn.getAttribute('data-index');
        await handleDeleteKey(provider, index);
      }
    });

    // Save Custom Model (Page 2)
    btnSaveCustomModel.addEventListener('click', handleSaveCustomModel);

    // Save Custom Provider (Page 2)
    btnSaveCustomProvider.addEventListener('click', handleSaveCustomProvider);

    // Delete Custom Model / Provider (delegated on Page 2)
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (action === 'del-custom-model') {
        const p = btn.getAttribute('data-provider');
        const m = btn.getAttribute('data-model');
        await handleDeleteCustomModel(p, m);
      } else if (action === 'del-custom-provider') {
        const p = btn.getAttribute('data-provider');
        await handleDeleteCustomProvider(p);
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
      await fetch('/api/config', {
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

  // Add Custom Model (Page 2)
  async function handleSaveCustomModel() {
    const provider = customModelProvider.value;
    const modelId = customModelId.value.trim();
    const modelName = customModelName.value.trim() || modelId;

    if (!modelId) {
      showFeedback(customModelFeedback, false, 'Model ID enter karna lazmi hai.');
      return;
    }

    try {
      btnSaveCustomModel.disabled = true;
      const res = await fetch('/api/custom-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelId, modelName })
      });
      const data = await res.json();

      if (data.success) {
        showFeedback(customModelFeedback, true, `✅ Model '${modelName}' kamyabi se save ho gaya!`);
        customModelId.value = '';
        customModelName.value = '';
        await fetchConfig();
        // Select newly added model
        providerSelect.value = provider;
        populateModels(activeConfig.providers, provider, modelId);
        await saveSettings({ mode: 'online', provider, model: modelId });
        updateMainActiveModelPill();
      } else {
        showFeedback(customModelFeedback, false, data.error || 'Model add karne mein error aya.');
      }
    } catch (e) {
      showFeedback(customModelFeedback, false, 'Network Error: ' + e.message);
    } finally {
      btnSaveCustomModel.disabled = false;
    }
  }

  async function handleDeleteCustomModel(provider, modelId) {
    if (!confirm(`Model '${modelId}' delete karein?`)) return;
    try {
      await fetch('/api/custom-model', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelId })
      });
      await fetchConfig();
    } catch (e) {
      alert('Delete error: ' + e.message);
    }
  }

  // Add Custom Online Provider (Page 2)
  async function handleSaveCustomProvider() {
    const id = newProviderId.value.trim();
    const name = newProviderName.value.trim() || id;
    const endpoint = newProviderEndpoint.value.trim();
    const defaultModelId = newProviderDefaultModelId.value.trim() || 'default-model';
    const defaultModelName = newProviderDefaultModelName.value.trim() || defaultModelId;
    const apiKey = newProviderApiKey.value.trim();

    if (!id || !endpoint) {
      showFeedback(customProviderFeedback, false, 'Provider ID aur Endpoint URL enter karna lazmi hai.');
      return;
    }

    try {
      btnSaveCustomProvider.disabled = true;
      const res = await fetch('/api/custom-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          endpoint,
          type: 'openai-compatible',
          defaultModelId,
          defaultModelName,
          apiKey
        })
      });
      const data = await res.json();

      if (data.success) {
        showFeedback(customProviderFeedback, true, `✅ Online Provider '${name}' kamyabi se save ho gaya!`);
        newProviderId.value = '';
        newProviderName.value = '';
        newProviderEndpoint.value = '';
        newProviderDefaultModelId.value = '';
        newProviderDefaultModelName.value = '';
        newProviderApiKey.value = '';
        await fetchConfig();
        // Select new provider
        providerSelect.value = id;
        populateModels(activeConfig.providers, id, defaultModelId);
        await saveSettings({ mode: 'online', provider: id, model: defaultModelId });
        updateMainActiveModelPill();
      } else {
        showFeedback(customProviderFeedback, false, data.error || 'Provider add karne mein error aya.');
      }
    } catch (e) {
      showFeedback(customProviderFeedback, false, 'Network Error: ' + e.message);
    } finally {
      btnSaveCustomProvider.disabled = false;
    }
  }

  async function handleDeleteCustomProvider(provider) {
    if (!confirm(`Provider '${provider}' delete karein?`)) return;
    try {
      await fetch('/api/custom-provider', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      await fetchConfig();
    } catch (e) {
      alert('Delete error: ' + e.message);
    }
  }

  function showFeedback(el, isSuccess, message) {
    if (!el) return;
    el.style.display = 'flex';
    el.className = isSuccess ? 'test-feedback-banner success' : 'test-feedback-banner error';
    el.innerHTML = `<span>${message}</span>`;
  }

  // --- CHAT STREAMING (Page 1) ---
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
          mode: currentMode,
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
