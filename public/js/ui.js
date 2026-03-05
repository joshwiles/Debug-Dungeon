// ============================================================
// DEBUG DUNGEON — UI Manager
// ui.js: HUD, console, memory bank, mission box, command queue rendering
// ============================================================

/* global GameState, LEVELS, Engine */

const UI = (() => {

  // ── Init ─────────────────────────────────────────────────
  function init() {
    // Nothing needed at init time; loadLevel() sets everything up
  }

  // ── Load a level — update all UI panels ──────────────────
  function loadLevel(levelData, state) {
    // Mission box
    document.getElementById('concept-tag').textContent =
      `⚡ CONCEPT: ${levelData.concept}`;
    document.getElementById('mission-text').textContent = levelData.objective;
    document.getElementById('hint-text').textContent    = levelData.hint;
    document.getElementById('level-title-display').textContent =
      `LEVEL ${levelData.id}: ${levelData.name.toUpperCase()}`;

    // HUD
    updateHUD(state);

    // Block limit display
    updateBlockCounter(state, levelData);

    // Memory bank
    updateMemoryBank(state);

    // Console — show intro message
    const consoleEl = document.getElementById('console-output');
    consoleEl.innerHTML = '';
    log('--- DEBUG DUNGEON INITIALIZED ---', 'sys');
    log(levelData.introMessage || levelData.objective, 'info');
    log('Build your program in the COMMAND QUEUE, then hit RUN CODE.', 'sys');

    // Always render the queue (clears old level's blocks on new level load)
    renderQueue(state.commandQueue, levelData);
    clearHighlights();

    // Enable run controls
    setRunControlsEnabled(true);
  }

  // ── Reset UI for a level reload ───────────────────────────
  function reset(levelData, state) {
    loadLevel(levelData, state);
    log('--- LEVEL RESET ---', 'sys');
    Engine.resetStepState();
  }

  // ── HUD ──────────────────────────────────────────────────
  function updateHUD(state) {
    const s = state || GameState;
    const p = s.player;
    if (!p) return;

    const hpEl     = document.getElementById('hp-val');
    const keysEl   = document.getElementById('keys-val');
    const energyEl = document.getElementById('energy-val');

    if (hpEl)     hpEl.textContent     = `${p.hp}/${p.maxHp}`;
    if (keysEl)   keysEl.textContent   = s.variables['keys'] || 0;
    if (energyEl) energyEl.textContent = `${p.energy}/${p.maxEnergy}`;
  }

  // ── Block counter ─────────────────────────────────────────
  function updateBlockCounter(state, levelData) {
    const s = state     || GameState;
    const l = levelData || LEVELS[s.currentLevelIndex];
    if (!l) return;

    const used  = Engine.countBlocks(s.commandQueue);
    const limit = l.blockLimit;
    const over  = used > limit;

    const counterEl = document.getElementById('block-counter');
    if (counterEl) {
      counterEl.textContent = `${used} / ${limit} BLOCKS USED`;
      counterEl.style.color = over ? '#ff3355' : '';
    }

    const limitEl = document.getElementById('block-limit-display');
    if (limitEl) {
      limitEl.textContent = `${used}/${limit} blocks`;
      limitEl.style.color = over ? '#ff3355' : '';
    }
  }

  // ── Memory Bank ──────────────────────────────────────────
  function updateMemoryBank(state) {
    const s    = state || GameState;
    const vars = s.variables || {};
    const el   = document.getElementById('variables-display');
    if (!el) return;

    const keys = Object.keys(vars);
    if (keys.length === 0) {
      el.innerHTML = '<span class="empty-vars">[ no variables yet ]</span>';
      return;
    }

    el.innerHTML = keys.map(k => `
      <span class="var-chip" title="${k} = ${vars[k]}">
        <span class="var-name">${k}</span>
        <span class="var-eq">=</span>
        <span class="var-val">${formatVarValue(vars[k])}</span>
      </span>
    `).join('');

    // Also show any defined functions
    const funcNames = Object.keys(s.functions || {});
    if (funcNames.length > 0) {
      el.innerHTML += funcNames.map(fn => `
        <span class="var-chip" style="border-color:var(--orange);color:var(--orange)">
          <span class="var-name">fn</span>
          <span class="var-eq">:</span>
          <span class="var-val">${fn}()</span>
        </span>
      `).join('');
    }
  }

  function formatVarValue(val) {
    if (typeof val === 'string') return `"${val}"`;
    return String(val);
  }

  // ── Console ───────────────────────────────────────────────
  function log(message, type = 'info') {
    // Track ok/err counts for API metrics
    if (type === 'ok')  GameState.okCount  = (GameState.okCount || 0) + 1;
    if (type === 'err') GameState.errCount = (GameState.errCount || 0) + 1;

    const el = document.getElementById('console-output');
    if (!el) return;

    const line = document.createElement('span');
    line.className = `console-line console-${type}`;

    // Type prefix
    const prefixes = {
      ok:   '✓ ',
      err:  '✗ ',
      info: '  ',
      warn: '⚠ ',
      sys:  '> ',
    };
    line.textContent = (prefixes[type] || '  ') + message;

    el.appendChild(line);
    el.appendChild(document.createElement('br'));
    el.scrollTop = el.scrollHeight;
  }

  // ── Command queue rendering ──────────────────────────────
  function renderQueue(queue, levelData) {
    const queueEl = document.getElementById('command-queue');
    if (!queueEl) return;

    queueEl.innerHTML = '';

    if (!queue || queue.length === 0) {
      queueEl.innerHTML = '<div class="queue-placeholder">← drag blocks here to build your program</div>';
    } else {
      queue.forEach((cmd, i) => {
        const el = buildBlockEl(cmd, i, queue.length, 0);
        queueEl.appendChild(el);
      });
    }

    // Re-run block counter
    if (levelData || LEVELS[GameState.currentLevelIndex]) {
      updateBlockCounter(GameState, levelData || LEVELS[GameState.currentLevelIndex]);
    }
  }

  // Build a DOM element for a command block
  function buildBlockEl(cmd, index, total, depth) {
    if (cmd.type === 'repeat') {
      return buildRepeatEl(cmd, index, depth);
    }
    if (cmd.type === 'while') {
      return buildWhileEl(cmd, index, depth);
    }
    if (cmd.type === 'define') {
      return buildDefineEl(cmd, index, depth);
    }
    return buildSimpleBlockEl(cmd, index, depth);
  }

  function buildSimpleBlockEl(cmd, index, depth) {
    const el = document.createElement('div');
    el.className = `cmd-block ${getBlockCssClass(cmd)}`;
    el.dataset.blockId  = cmd.id;
    el.dataset.blockIdx = index;
    el.draggable = true;

    el.innerHTML = `
      <span class="cmd-linenum">${index + 1}</span>
      <span class="cmd-label">${getBlockLabel(cmd)}</span>
      <button class="cmd-delete" data-id="${cmd.id}" title="Remove">✕</button>
    `;

    // Delete handler
    el.querySelector('.cmd-delete').addEventListener('click', e => {
      e.stopPropagation();
      removeFromQueue(cmd.id);
    });

    return el;
  }

  function buildRepeatEl(cmd, index, depth) {
    const wrap = document.createElement('div');
    wrap.className = 'repeat-container';
    wrap.dataset.blockId = cmd.id;

    // Header row
    const header = document.createElement('div');
    header.className = 'repeat-header';
    header.dataset.blockId  = cmd.id;
    header.dataset.blockIdx = index;
    header.draggable = true;

    header.innerHTML = `
      <span class="cmd-linenum">${index + 1}</span>
      <span>🔄 repeat</span>
      <span class="repeat-count-wrap">
        <button class="count-btn" data-id="${cmd.id}" data-delta="-1">−</button>
        <input class="repeat-count" type="number" min="1" max="99"
               value="${cmd.count || 3}" data-id="${cmd.id}">
        <button class="count-btn" data-id="${cmd.id}" data-delta="1">+</button>
      </span>
      <span>times:</span>
      <button class="cmd-delete" data-id="${cmd.id}" title="Remove">✕</button>
    `;

    // Count input events
    header.querySelector('.repeat-count').addEventListener('change', e => {
      const val = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
      e.target.value = val;
      updateRepeatCount(cmd.id, val);
    });
    header.querySelectorAll('.count-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id    = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10);
        const inp   = header.querySelector('.repeat-count');
        const newVal = Math.max(1, Math.min(99, (parseInt(inp.value, 10) || 1) + delta));
        inp.value = newVal;
        updateRepeatCount(id, newVal);
      });
    });

    // Delete handler
    header.querySelector('.cmd-delete').addEventListener('click', e => {
      e.stopPropagation();
      removeFromQueue(cmd.id);
    });

    // Body drop zone (class body-dropzone is the generic droppable target)
    const body = document.createElement('div');
    body.className = 'repeat-body body-dropzone';
    body.dataset.parentId = cmd.id;

    if (!cmd.body || cmd.body.length === 0) {
      body.innerHTML = '<span class="repeat-body-empty">↓ drop blocks here (loop body)</span>';
    } else {
      cmd.body.forEach((bodyCmd, bi) => {
        const bel = buildSimpleBlockEl(bodyCmd, bi, depth + 1);
        body.appendChild(bel);
      });
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'repeat-footer';
    footer.textContent = `end repeat`;

    wrap.appendChild(header);
    wrap.appendChild(body);
    wrap.appendChild(footer);
    return wrap;
  }

  function buildWhileEl(cmd, index, depth) {
    const wrap = document.createElement('div');
    wrap.className = 'repeat-container';
    wrap.dataset.blockId = cmd.id;

    const header = document.createElement('div');
    header.className = 'repeat-header block-while';
    header.dataset.blockId  = cmd.id;
    header.dataset.blockIdx = index;
    header.draggable = true;

    header.innerHTML = `
      <span class="cmd-linenum">${index + 1}</span>
      <span class="cmd-label">🔁 while ${cmd.condition || 'bug alive'}:</span>
      <button class="cmd-delete" data-id="${cmd.id}" title="Remove">✕</button>
    `;
    header.querySelector('.cmd-delete').addEventListener('click', e => {
      e.stopPropagation();
      removeFromQueue(cmd.id);
    });

    const body = document.createElement('div');
    body.className = 'repeat-body body-dropzone';
    body.dataset.parentId = cmd.id;
    body.style.borderLeftColor = 'rgba(255,136,0,0.4)';
    body.style.borderColor = 'rgba(255,136,0,0.4)';

    if (!cmd.body || cmd.body.length === 0) {
      body.innerHTML = '<span class="repeat-body-empty">↓ drop commands here (loop body)</span>';
    } else {
      cmd.body.forEach((bc, bi) => {
        body.appendChild(buildSimpleBlockEl(bc, bi, depth + 1));
      });
    }

    const footer = document.createElement('div');
    footer.className = 'repeat-footer';
    footer.style.borderColor = 'rgba(255,136,0,0.3)';
    footer.style.background = 'rgba(255,136,0,0.05)';
    footer.textContent = 'end while';

    wrap.appendChild(header);
    wrap.appendChild(body);
    wrap.appendChild(footer);
    return wrap;
  }

  function buildDefineEl(cmd, index, depth) {
    const wrap = document.createElement('div');
    wrap.className = 'repeat-container';
    wrap.dataset.blockId = cmd.id;

    const header = document.createElement('div');
    header.className = 'repeat-header block-define';
    header.dataset.blockId  = cmd.id;
    header.dataset.blockIdx = index;
    header.draggable = true;

    header.innerHTML = `
      <span class="cmd-linenum">${index + 1}</span>
      <span class="cmd-label">📦 define ${cmd.name || 'myFunc'}:</span>
      <button class="cmd-delete" data-id="${cmd.id}" title="Remove">✕</button>
    `;
    header.querySelector('.cmd-delete').addEventListener('click', e => {
      e.stopPropagation();
      removeFromQueue(cmd.id);
    });

    const body = document.createElement('div');
    body.className = 'repeat-body body-dropzone';
    body.dataset.parentId = cmd.id;
    body.style.borderLeftColor = 'rgba(255,136,0,0.4)';
    body.style.borderColor = 'rgba(255,136,0,0.4)';

    if (!cmd.body || cmd.body.length === 0) {
      body.innerHTML = '<span class="repeat-body-empty">↓ drop commands here (function body)</span>';
    } else {
      cmd.body.forEach((bc, bi) => {
        body.appendChild(buildSimpleBlockEl(bc, bi, depth + 1));
      });
    }

    const footer = document.createElement('div');
    footer.className = 'repeat-footer';
    footer.style.borderColor = 'rgba(255,136,0,0.3)';
    footer.style.background = 'rgba(255,136,0,0.05)';
    footer.textContent = 'end define';

    wrap.appendChild(header);
    wrap.appendChild(body);
    wrap.appendChild(footer);
    return wrap;
  }

  // ── Block label helpers ───────────────────────────────────
  function getBlockLabel(cmd) {
    switch (cmd.type) {
      case 'move':   return `🟦 move ${cmd.direction}`;
      case 'attack': return `🟥 attack FORWARD`;
      case 'set':    return `🟣 set ${cmd.variable} = "${cmd.value}"`;
      case 'call':   return `🟠 call ${cmd.name}()`;
      default:       return cmd.type;
    }
  }

  function getBlockCssClass(cmd) {
    switch (cmd.type) {
      case 'move':    return 'block-move';
      case 'attack':  return 'block-attack';
      case 'repeat':  return 'block-repeat';
      case 'set':     return 'block-set';
      case 'while':   return 'block-while';
      case 'define':  return 'block-define';
      case 'call':    return 'block-call';
      default:        return '';
    }
  }

  // ── Queue mutations (called by DragDrop) ──────────────────
  function removeFromQueue(blockId) {
    removeFromArray(GameState.commandQueue, blockId);
    renderQueue(GameState.commandQueue);
    updateBlockCounter(GameState);
  }

  function removeFromArray(arr, blockId) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].id === blockId) {
        arr.splice(i, 1);
        return true;
      }
      // Check nested body
      if (arr[i].body) {
        if (removeFromArray(arr[i].body, blockId)) return true;
      }
    }
    return false;
  }

  function updateRepeatCount(blockId, count) {
    const cmd = findInQueue(GameState.commandQueue, blockId);
    if (cmd) {
      cmd.count = count;
      updateBlockCounter(GameState);
    }
  }

  function findInQueue(arr, blockId) {
    for (const cmd of arr) {
      if (cmd.id === blockId) return cmd;
      if (cmd.body) {
        const found = findInQueue(cmd.body, blockId);
        if (found) return found;
      }
    }
    return null;
  }

  // ── Execution highlighting ────────────────────────────────
  function highlightBlock(blockId, annotation) {
    clearHighlights();

    // Find and highlight the block in the queue DOM
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (!el) return;

    el.classList.add('executing');

    // Add arrow marker
    const arrow = document.createElement('span');
    arrow.className = 'cmd-exec-arrow';
    arrow.textContent = '▶';
    arrow.id = 'exec-arrow';
    el.prepend(arrow);

    // Add annotation if any (e.g., "iteration 2 of 4")
    if (annotation) {
      const ann = document.createElement('span');
      ann.style.cssText = 'font-size:0.8rem;color:var(--green);margin-left:6px;opacity:0.8;';
      ann.textContent = annotation;
      ann.id = 'exec-annotation';
      el.appendChild(ann);
    }

    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearHighlights() {
    document.querySelectorAll('.cmd-block.executing').forEach(el => {
      el.classList.remove('executing');
      el.classList.remove('executed');
    });
    const arrow = document.getElementById('exec-arrow');
    if (arrow) arrow.remove();
    const ann = document.getElementById('exec-annotation');
    if (ann) ann.remove();
  }

  function markExecuted(blockId) {
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (el) el.classList.add('executed');
  }

  // ── Run controls ──────────────────────────────────────────
  function setRunControlsEnabled(enabled) {
    ['run-btn', 'step-btn', 'reset-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }

  return {
    init,
    loadLevel,
    reset,
    updateHUD,
    updateBlockCounter,
    updateMemoryBank,
    log,
    renderQueue,
    highlightBlock,
    clearHighlights,
    markExecuted,
    removeFromQueue,
    updateRepeatCount,
    findInQueue,
    getBlockCssClass,
    getBlockLabel,
    buildBlockEl,
    setRunControlsEnabled,
  };
})();
