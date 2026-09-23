/**
 * Jena Web GUI — Application Logic
 * Pure modern JavaScript with SSE streaming, Markdown rendering, and tool timeline visualization.
 */

(() => {
  // DOM Elements
  const chatViewport = document.getElementById('chatViewport');
  const chatStream = document.getElementById('chatStream');
  const welcomeCard = document.getElementById('welcomeCard');
  const chatForm = document.getElementById('chatForm');
  const promptInput = document.getElementById('promptInput');
  const btnSend = document.getElementById('btnSend');
  const btnVoice = document.getElementById('btnVoice');
  const agentLiveStatus = document.getElementById('agentLiveStatus');
  const liveStatusText = document.getElementById('liveStatusText');
  const btnStopTask = document.getElementById('btnStopTask');
  const activeProviderBadge = document.getElementById('activeProviderBadge');
  const activeModelBadge = document.getElementById('activeModelBadge');
  const toastContainer = document.getElementById('toastContainer');

  // Modals
  const settingsModal = document.getElementById('settingsModal');
  const memoryModal = document.getElementById('memoryModal');
  const systemModal = document.getElementById('systemModal');
  const btnSettings = document.getElementById('btnSettings');
  const btnMemory = document.getElementById('btnMemory');
  const btnSystem = document.getElementById('btnSystem');
  const btnClearChat = document.getElementById('btnClearChat');

  // Settings form elements
  const settingsForm = document.getElementById('settingsForm');
  const setProvider = document.getElementById('setProvider');
  const setModelSelect = document.getElementById('setModelSelect');
  const customModelGroup = document.getElementById('customModelGroup');
  const setCustomModel = document.getElementById('setCustomModel');
  const setTemp = document.getElementById('setTemp');
  const tempVal = document.getElementById('tempVal');
  const setTokens = document.getElementById('setTokens');
  const tokensVal = document.getElementById('tokensVal');
  const setTurns = document.getElementById('setTurns');
  const turnsVal = document.getElementById('turnsVal');
  const keyGroq = document.getElementById('keyGroq');
  const keyGemini = document.getElementById('keyGemini');
  const keyOpenai = document.getElementById('keyOpenai');
  const groqStatusBadge = document.getElementById('groqStatusBadge');
  const geminiStatusBadge = document.getElementById('geminiStatusBadge');

  // Memory elements
  const newFactInput = document.getElementById('newFactInput');
  const btnAddFact = document.getElementById('btnAddFact');
  const btnClearMemory = document.getElementById('btnClearMemory');
  const factsList = document.getElementById('factsList');

  // System modal elements
  const statBattery = document.getElementById('statBattery');
  const statRam = document.getElementById('statRam');
  const statArch = document.getElementById('statArch');
  const statUptime = document.getElementById('statUptime');
  const statOs = document.getElementById('statOs');
  const statCwd = document.getElementById('statCwd');
  const statNode = document.getElementById('statNode');

  // State
  let isGenerating = false;
  let currentAbortController = null;
  let currentAssistantNode = null;
  let activeToolCards = {}; // map tool step -> DOM element
  let activeConfig = null;

  const PROVIDER_MODELS = {
    groq: [
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Tez Tareen • Recommended)' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Ziyada Intelligent)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra Fast)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Large Context)' },
      { id: 'gemma2-9b-it', name: 'Google Gemma 2 9B (Groq)' },
      { id: '__custom__', name: '➕ Custom Model ID Likhein...' }
    ],
    gemini: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen Fast • Recommended)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (1M Context)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)' },
      { id: '__custom__', name: '➕ Custom Model ID Likhein...' }
    ],
    openai: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Economical • Recommended)' },
      { id: 'gpt-4o', name: 'GPT-4o (Flagship Model)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: '__custom__', name: '➕ Custom Model ID Likhein...' }
    ]
  };

  function updateModelDropdown(provider, selectedModel) {
    if (!setModelSelect) return;
    const prov = (provider || 'groq').toLowerCase();
    const models = PROVIDER_MODELS[prov] || PROVIDER_MODELS.groq;
    setModelSelect.innerHTML = '';

    const defaultForProv = models[0]?.id;
    const targetModel = selectedModel || defaultForProv;

    let matched = false;
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id !== '__custom__' && targetModel === m.id) {
        opt.selected = true;
        matched = true;
      }
      setModelSelect.appendChild(opt);
    });

    if (!matched && targetModel) {
      setModelSelect.value = '__custom__';
      if (setCustomModel) setCustomModel.value = targetModel;
      if (customModelGroup) customModelGroup.style.display = 'block';
    } else if (setModelSelect.value === '__custom__') {
      if (customModelGroup) customModelGroup.style.display = 'block';
    } else {
      if (setCustomModel) setCustomModel.value = '';
      if (customModelGroup) customModelGroup.style.display = 'none';
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });

  async function initApp() {
    setupEventListeners();
    setupTextareaAutoResize();
    setupVoiceDictation();
    await fetchConfig();
    await fetchHistory();
  }

  // --- API & DATA FETCHING ---

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Config load failed');
      const data = await res.json();
      activeConfig = data;

      // Update header
      if (activeProviderBadge) activeProviderBadge.textContent = (data.provider || 'groq').toUpperCase();
      if (activeModelBadge) activeModelBadge.textContent = data.model || 'qwen/qwen3.8-27b';

      // Update settings modal inputs
      const currentProv = data.provider || 'groq';
      if (setProvider) setProvider.value = currentProv;
      updateModelDropdown(currentProv, data.model);
      if (setTemp) {
        setTemp.value = data.temperature ?? 0.3;
        if (tempVal) tempVal.textContent = setTemp.value;
      }
      if (setTokens) {
        setTokens.value = data.max_tokens ?? 700;
        if (tokensVal) tokensVal.textContent = setTokens.value;
      }
      if (setTurns) {
        setTurns.value = data.history_turns ?? 3;
        if (turnsVal) turnsVal.textContent = setTurns.value;
      }

      if (groqStatusBadge) {
        groqStatusBadge.textContent = data.has_groq_key ? 'Configured' : 'Missing';
        groqStatusBadge.style.color = data.has_groq_key ? 'var(--accent-green)' : 'var(--accent-amber)';
      }
      if (geminiStatusBadge) {
        geminiStatusBadge.textContent = data.has_gemini_key ? 'Configured' : 'Missing';
        geminiStatusBadge.style.color = data.has_gemini_key ? 'var(--accent-green)' : 'var(--accent-amber)';
      }
    } catch (e) {
      console.warn('Config fetch warning:', e);
    }
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.history) && data.history.length > 0) {
        hideWelcomeCard();
        data.history.forEach(item => {
          if (item.role === 'user') {
            appendUserMessage(item.content);
          } else if (item.role === 'assistant') {
            appendHistoricalAssistantMessage(item.content);
          }
        });
        scrollToBottom();
      }
    } catch (e) {
      console.warn('History fetch warning:', e);
    }
  }

  async function fetchMemory() {
    if (!factsList) return;
    factsList.innerHTML = '<div class="empty-state">Facts load ho rahe hain...</div>';
    try {
      const res = await fetch('/api/memory');
      const data = await res.json();
      factsList.innerHTML = '';

      let totalFacts = 0;

      // Iterate categories
      for (const [category, items] of Object.entries(data)) {
        if (!items || typeof items !== 'object') continue;
        const entries = Object.entries(items);
        if (entries.length === 0) continue;

        const catHeader = document.createElement('div');
        catHeader.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--accent-cyan); margin-top: 8px; letter-spacing: 0.5px;';
        catHeader.textContent = category.replace(/_/g, ' ');
        factsList.appendChild(catHeader);

        entries.forEach(([k, v]) => {
          totalFacts++;
          const item = document.createElement('div');
          item.className = 'fact-item';
          const valDisplay = typeof v === 'object' ? JSON.stringify(v) : String(v);
          item.innerHTML = `
            <span><strong>${escapeHtml(k)}:</strong> ${escapeHtml(valDisplay)}</span>
            <button class="btn-del-fact" data-category="${escapeHtml(category)}" data-key="${escapeHtml(k)}" title="Delete Fact">&times;</button>
          `;
          factsList.appendChild(item);
        });
      }

      if (totalFacts === 0) {
        factsList.innerHTML = '<div class="empty-state">Koi long-term memory facts save nahi hain.</div>';
      }
    } catch (e) {
      factsList.innerHTML = `<div class="empty-state" style="color:var(--accent-red)">Error: ${e.message}</div>`;
    }
  }

  async function fetchSystemStats() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      if (data.battery && data.battery.percentage !== undefined) {
        statBattery.textContent = `${data.battery.percentage}% (${data.battery.status || 'Discharging'})`;
      } else {
        statBattery.textContent = 'Termux API not active';
      }

      if (data.system) {
        const free = data.system.free_mem_mb;
        const total = data.system.total_mem_mb;
        statRam.textContent = `${free} MB / ${total} MB`;
        statArch.textContent = `${data.system.arch} (${data.system.platform})`;
        statOs.textContent = `${data.system.platform} (${data.system.hostname || 'localhost'})`;
        statCwd.textContent = data.system.cwd || '-';

        const uptimeMins = Math.floor((data.system.uptime_seconds || 0) / 60);
        statUptime.textContent = `${uptimeMins} mins`;
      }
    } catch (e) {
      console.warn('Status fetch error:', e);
    }
  }

  // --- UI EVENT LISTENERS ---

  function setupEventListeners() {
    // Form submission
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendMessage();
    });

    // Enter to submit, Shift+Enter for newline
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Quick prompt cards and suggestion pills
    document.addEventListener('click', (e) => {
      const promptBtn = e.target.closest('[data-prompt]');
      if (promptBtn) {
        const text = promptBtn.getAttribute('data-prompt');
        if (text) {
          promptInput.value = text;
          promptInput.focus();
          handleSendMessage();
        }
      }

      // Modal close buttons
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const modalId = closeBtn.getAttribute('data-close');
        closeModal(modalId);
      }

      // Copy buttons
      const copyBtn = e.target.closest('.btn-copy-code');
      if (copyBtn) {
        const textToCopy = copyBtn.getAttribute('data-clipboard');
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          });
        }
      }

      // Password toggle
      const pwToggle = e.target.closest('.btn-toggle-pw');
      if (pwToggle) {
        const targetId = pwToggle.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      }

      // Delete specific fact button
      const delFactBtn = e.target.closest('.btn-del-fact');
      if (delFactBtn) {
        const category = delFactBtn.getAttribute('data-category');
        const key = delFactBtn.getAttribute('data-key');
        if (category && key && confirm(`Fact '${key}' delete karein?`)) {
          fetch('/api/memory/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, key })
          }).then(res => res.json()).then(res => {
            if (res.success) {
              showToast('Fact delete ho gaya!', 'info');
              fetchMemory();
            } else {
              showToast(res.error || 'Delete failed', 'error');
            }
          }).catch(err => showToast(err.message, 'error'));
        }
      }
    });

    // Stop execution button
    btnStopTask.addEventListener('click', () => {
      stopAgentExecution();
    });

    // Header buttons
    btnSettings.addEventListener('click', () => {
      fetchConfig();
      openModal('settingsModal');
    });

    btnMemory.addEventListener('click', () => {
      fetchMemory();
      openModal('memoryModal');
    });

    btnSystem.addEventListener('click', () => {
      fetchSystemStats();
      openModal('systemModal');
    });

    btnClearChat.addEventListener('click', async () => {
      if (confirm('Kya aap chat history saaf karna chahte hain?')) {
        await fetch('/api/history/clear', { method: 'POST' });
        chatStream.innerHTML = '';
        chatStream.appendChild(welcomeCard);
        welcomeCard.style.display = 'block';
        showToast('Chat history saaf ho gayi hai.', 'info');
      }
    });

    // Slider display updates
    setTemp.addEventListener('input', () => { tempVal.textContent = setTemp.value; });
    setTokens.addEventListener('input', () => { tokensVal.textContent = setTokens.value; });
    setTurns.addEventListener('input', () => { turnsVal.textContent = setTurns.value; });

    // Provider change updates model dropdown dynamically
    setProvider.addEventListener('change', () => {
      updateModelDropdown(setProvider.value);
    });

    // Model dropdown change
    setModelSelect.addEventListener('change', () => {
      if (setModelSelect.value === '__custom__') {
        if (customModelGroup) customModelGroup.style.display = 'block';
        if (setCustomModel) setCustomModel.focus();
      } else {
        if (customModelGroup) customModelGroup.style.display = 'none';
      }
    });

    // Settings save
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      let chosenModel = setModelSelect.value;
      if (chosenModel === '__custom__') {
        chosenModel = (setCustomModel ? setCustomModel.value.trim() : '') || 'qwen/qwen3.8-27b';
      }

      const payload = {
        provider: setProvider.value,
        model: chosenModel,
        temperature: parseFloat(setTemp.value),
        max_tokens: parseInt(setTokens.value, 10),
        history_turns: parseInt(setTurns.value, 10)
      };

      if (keyGroq.value.trim()) payload.groq_api_key = keyGroq.value.trim();
      if (keyGemini.value.trim()) payload.gemini_api_key = keyGemini.value.trim();
      if (keyOpenai.value.trim()) payload.openai_api_key = keyOpenai.value.trim();

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
          showToast('Settings kamyabi se save ho gayi hain!', 'success');
          closeModal('settingsModal');
          fetchConfig();
        } else {
          showToast(result.error || 'Error saving settings', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Add Memory Fact
    btnAddFact.addEventListener('click', async () => {
      const fact = newFactInput.value.trim();
      if (!fact) return;
      try {
        const res = await fetch('/api/memory/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fact })
        });
        const result = await res.json();
        if (result.success) {
          newFactInput.value = '';
          showToast('Memory fact add ho gaya!', 'success');
          fetchMemory();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Clear Memory
    btnClearMemory.addEventListener('click', async () => {
      if (confirm('Kya aap tamam long-term memory facts reset karna chahte hain?')) {
        try {
          await fetch('/api/memory/clear', { method: 'POST' });
          showToast('Long-term memory reset ho gayi.', 'info');
          fetchMemory();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    // Close modals on outside click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  function setupTextareaAutoResize() {
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + 'px';
    });
  }

  function setupVoiceDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btnVoice.style.display = 'none';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ur-PK, en-US';

    let isListening = false;

    btnVoice.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
        isListening = true;
        btnVoice.classList.add('listening');
        showToast('Bolna shuru karein (Listening)...', 'info');
      } catch (err) {
        console.warn('Voice recognition error:', err);
      }
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        promptInput.value = (promptInput.value ? promptInput.value + ' ' : '') + transcript;
        promptInput.style.height = 'auto';
        promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + 'px';
        promptInput.focus();
      }
    };

    recognition.onend = () => {
      isListening = false;
      btnVoice.classList.remove('listening');
    };

    recognition.onerror = (e) => {
      isListening = false;
      btnVoice.classList.remove('listening');
      console.warn('Speech error:', e.error);
    };
  }

  // --- CHAT & SSE STREAMING ---

  async function handleSendMessage() {
    if (isGenerating) return;

    const message = promptInput.value.trim();
    if (!message) return;

    // Reset input
    promptInput.value = '';
    promptInput.style.height = 'auto';

    hideWelcomeCard();

    // 1. Append User Message
    appendUserMessage(message);

    // 2. Set UI to generating state
    setGeneratingState(true);
    liveStatusText.textContent = 'Jena soch rahi hai...';

    // 3. Create Assistant Message Container
    const assistantNode = createAssistantMessageNode();
    chatStream.appendChild(assistantNode);
    currentAssistantNode = assistantNode;
    activeToolCards = {};
    scrollToBottom();

    // 4. Start Server-Sent Events request
    currentAbortController = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: currentAbortController.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop(); // keep partial

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            handleStreamEvent(event);
          } catch (e) {
            console.error('Error parsing event JSON:', e, jsonStr);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        renderAssistantError(`Error: ${err.message}`);
      }
    } finally {
      setGeneratingState(false);
      currentAbortController = null;
      scrollToBottom();
    }
  }

  function handleStreamEvent(event) {
    if (!currentAssistantNode) return;

    const timeline = currentAssistantNode.querySelector('.react-timeline');
    const thoughtBox = currentAssistantNode.querySelector('.thought-box');
    const finalAnswerBox = currentAssistantNode.querySelector('.markdown-body');
    const statusShimmer = currentAssistantNode.querySelector('.status-shimmer');

    switch (event.type) {
      case 'status':
        if (liveStatusText) liveStatusText.textContent = event.message || 'Processing...';
        if (statusShimmer) statusShimmer.textContent = event.message || 'Thinking...';
        break;

      case 'thought':
        if (statusShimmer) statusShimmer.style.display = 'none';
        const callout = document.createElement('div');
        callout.className = 'thought-callout';
        callout.textContent = event.content;
        thoughtBox.appendChild(callout);
        scrollToBottom();
        break;

      case 'tool_start':
        if (statusShimmer) statusShimmer.style.display = 'none';
        liveStatusText.textContent = `Executing tool: ${event.tool}...`;

        const toolCard = document.createElement('div');
        toolCard.className = 'react-step-card active';
        const toolKey = `${event.tool}_${event.step}`;

        let argsDisplay = '';
        try {
          argsDisplay = typeof event.arguments === 'string'
            ? event.arguments
            : JSON.stringify(event.arguments, null, 2);
        } catch (_) {
          argsDisplay = String(event.arguments);
        }

        toolCard.innerHTML = `
          <div class="react-step-header">
            <div class="react-step-title">
              <span>⚙️</span>
              <span class="tool-name-badge">${escapeHtml(event.tool)}</span>
            </div>
            <span class="react-step-badge running">Running...</span>
          </div>
          <div class="react-step-body">
            <div class="react-args-block">
              <span class="block-label">Parameters:</span>
              <pre class="terminal-box"><code>${escapeHtml(argsDisplay)}</code></pre>
            </div>
            <div class="react-output-block" style="display: none;">
              <span class="block-label">Output:</span>
              <div class="terminal-box" style="position:relative;">
                <button class="btn-copy-code" data-clipboard="">Copy</button>
                <code class="output-text"></code>
              </div>
            </div>
          </div>
        `;

        timeline.appendChild(toolCard);
        activeToolCards[toolKey] = toolCard;
        scrollToBottom();
        break;

      case 'tool_output':
        const cardKey = `${event.tool}_${event.step}`;
        const existingCard = activeToolCards[cardKey];
        if (existingCard) {
          existingCard.classList.remove('active');
          const badge = existingCard.querySelector('.react-step-badge');
          badge.className = 'react-step-badge success';
          badge.textContent = 'Completed';

          const outputBlock = existingCard.querySelector('.react-output-block');
          const outputText = existingCard.querySelector('.output-text');
          const copyBtn = existingCard.querySelector('.btn-copy-code');

          outputText.textContent = event.output || 'Done';
          copyBtn.setAttribute('data-clipboard', event.output || '');
          outputBlock.style.display = 'flex';
        }
        scrollToBottom();
        break;

      case 'done':
        if (statusShimmer) statusShimmer.style.display = 'none';
        finalAnswerBox.innerHTML = renderMarkdown(event.result || '');
        scrollToBottom();
        break;

      case 'error':
        if (statusShimmer) statusShimmer.style.display = 'none';
        renderAssistantError(event.error || 'Unknown error occurred.');
        scrollToBottom();
        break;

      case 'stream_end':
        setGeneratingState(false);
        break;
    }
  }

  async function stopAgentExecution() {
    try {
      liveStatusText.textContent = 'Roka ja raha hai (Stopping)...';
      await fetch('/api/stop', { method: 'POST' });
      if (currentAbortController) {
        currentAbortController.abort();
      }
      showToast('Agent task rok diya gaya.', 'info');
    } catch (e) {
      console.warn('Stop error:', e);
    } finally {
      setGeneratingState(false);
    }
  }

  function setGeneratingState(generating) {
    isGenerating = generating;
    btnSend.disabled = generating;
    agentLiveStatus.style.display = generating ? 'flex' : 'none';
  }

  // --- MESSAGE DOM CREATORS ---

  function appendUserMessage(text) {
    const timeStr = getCurrentTime();
    const row = document.createElement('div');
    row.className = 'chat-row user';
    row.innerHTML = `
      <div class="message-content-wrapper">
        <div class="message-bubble">${escapeHtml(text)}</div>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-avatar">👤</div>
    `;
    chatStream.appendChild(row);
    scrollToBottom();
  }

  function createAssistantMessageNode() {
    const row = document.createElement('div');
    row.className = 'chat-row assistant';
    row.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content-wrapper">
        <div class="message-bubble">
          <div class="status-shimmer" style="font-size:12px; color:var(--accent-cyan); margin-bottom:6px;">
            <span class="status-spinner"></span> Soch rahi hoon...
          </div>
          <div class="thought-box"></div>
          <div class="react-timeline"></div>
          <div class="markdown-body"></div>
        </div>
        <span class="message-time">${getCurrentTime()}</span>
      </div>
    `;
    return row;
  }

  function appendHistoricalAssistantMessage(text) {
    const row = document.createElement('div');
    row.className = 'chat-row assistant';
    row.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content-wrapper">
        <div class="message-bubble">
          <div class="markdown-body">${renderMarkdown(text || '')}</div>
        </div>
        <span class="message-time">${getCurrentTime()}</span>
      </div>
    `;
    chatStream.appendChild(row);
  }

  function renderAssistantError(errorMsg) {
    if (!currentAssistantNode) return;
    const body = currentAssistantNode.querySelector('.markdown-body');
    body.innerHTML = `
      <div style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; padding: 12px; border-radius: 8px; font-size: 13px;">
        <strong>⚠️ Masla pesh aya:</strong><br>${escapeHtml(errorMsg)}
      </div>
    `;
  }

  // --- MARKDOWN RENDERING ---

  function renderMarkdown(md) {
    if (!md) return '';

    let html = md;

    // Code blocks with syntax copy button
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanCode = code.replace(/\n$/, '');
      const escaped = escapeHtml(cleanCode);
      return `<pre><button class="btn-copy-code" data-clipboard="${escapeHtml(cleanCode)}">Copy</button><code class="language-${lang}">${escaped}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Lists
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Paragraphs & Line Breaks
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs.map(p => {
      if (p.startsWith('<pre>') || p.startsWith('<h3>') || p.startsWith('<h2>') || p.startsWith('<h1>') || p.startsWith('<ul>') || p.startsWith('<blockquote>')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  }

  // --- HELPERS ---

  function hideWelcomeCard() {
    if (welcomeCard) welcomeCard.style.display = 'none';
  }

  function scrollToBottom() {
    chatViewport.scrollTop = chatViewport.scrollHeight;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

})();
