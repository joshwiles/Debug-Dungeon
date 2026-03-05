// ============================================================
// DEBUG DUNGEON — Drag & Drop System
// dragdrop.js: palette rendering, drag from palette to queue,
//              reorder within queue, drop into repeat/while bodies
// ============================================================

/* global GameState, LEVELS, BLOCK_DEFS, UI, Engine */

const DragDrop = (() => {

  // ── Drag state ────────────────────────────────────────────
  let drag = {
    active:       false,
    ghostEl:      null,
    sourceType:   null,    // 'palette' | 'queue'
    sourceId:     null,    // blockId if from queue
    template:     null,    // BLOCK_DEFS key if from palette
    originX:      0,
    originY:      0,
    mouseX:       0,
    mouseY:       0,
    insertIndex:  null,
    insertParent: null,    // null = top-level queue, or blockId of repeat/while
  };

  let idCounter = 0;
  const DRAG_THRESHOLD = 6; // pixels of movement before it becomes a real drag
  let pendingPaletteClick = null; // { key, def, block, startX, startY }

  function newId() {
    return `cmd_${Date.now()}_${idCounter++}`;
  }

  // ── Init ─────────────────────────────────────────────────
  function init(levelData) {
    renderPalette(levelData);
    setupGlobalListeners();
  }

  // ── Palette rendering ─────────────────────────────────────
  function renderPalette(levelData) {
    const el = document.getElementById('palette-blocks');
    if (!el) return;
    el.innerHTML = '';

    // All possible block keys, in a friendly order
    const allBlockKeys = [
      'move_up', 'move_down', 'move_left', 'move_right',
      'attack', 'repeat', 'while_bug_alive', 'set_weapon',
      'define_func', 'call_func',
    ];

    const available = levelData ? levelData.availableBlocks : [];

    allBlockKeys.forEach(key => {
      const def = BLOCK_DEFS[key];
      if (!def) return;

      const locked = !available.includes(key);
      const block  = document.createElement('div');
      block.className = `palette-block ${def.cssClass}${locked ? ' locked' : ''}`;
      block.dataset.palKey = key;
      block.title = def.description || def.label;

      block.innerHTML = `${getPaletteLabel(def)}${locked ? '<span class="lock-icon">🔒</span>' : ''}`;

      if (!locked) {
        // Mousedown starts tracking. If mouse barely moves → treat as click (append to queue).
        // If mouse moves > DRAG_THRESHOLD px → start a real drag for precise placement.
        block.addEventListener('mousedown', e => {
          if (e.button !== 0) return;
          e.preventDefault();
          pendingPaletteClick = { key, def, block, startX: e.clientX, startY: e.clientY };
        });
      }

      el.appendChild(block);
    });
  }

  function getPaletteLabel(def) {
    switch (def.type) {
      case 'move':   return `🟦 move ${def.direction}`;
      case 'attack': return '🟥 attack';
      case 'repeat': return '🔄 repeat N times';
      case 'set':    return `🟣 set ${def.variable}`;
      case 'while':  return '🔁 while loop';
      case 'define': return '📦 define func';
      case 'call':   return '📣 call func';
      default:       return def.label;
    }
  }

  // ── Global pointer listeners ──────────────────────────────
  let listenersAdded = false;
  function setupGlobalListeners() {
    if (listenersAdded) return;
    listenersAdded = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    // Queue drag-start via event delegation
    // command-queue always exists in the static HTML, but guard for safety
    const queueEl = document.getElementById('command-queue');
    if (queueEl) {
      queueEl.addEventListener('mousedown', onQueueMouseDown);
    }
  }

  // ── Start drag from palette ───────────────────────────────
  function startPaletteDrag(key, def, e) {
    drag.active      = true;
    drag.sourceType  = 'palette';
    drag.template    = key;
    drag.originX     = e.clientX;
    drag.originY     = e.clientY;

    drag.ghostEl = buildGhostEl(def);
    positionGhost(e.clientX, e.clientY);
    document.body.appendChild(drag.ghostEl);
  }

  // ── Start drag from queue ─────────────────────────────────
  function onQueueMouseDown(e) {
    if (GameState.executing) return;
    const block = e.target.closest('.cmd-block, .repeat-header');
    if (!block) return;
    if (e.target.closest('.cmd-delete, .count-btn, .repeat-count')) return;
    if (e.button !== 0) return;

    e.preventDefault();

    const blockId = block.dataset.blockId;
    if (!blockId) return;

    const cmd = UI.findInQueue(GameState.commandQueue, blockId);
    if (!cmd) return;

    drag.active     = true;
    drag.sourceType = 'queue';
    drag.sourceId   = blockId;
    drag.originX    = e.clientX;
    drag.originY    = e.clientY;

    // Build ghost from the actual block definition
    const def = makeFakeDef(cmd);
    drag.ghostEl = buildGhostEl(def);
    positionGhost(e.clientX, e.clientY);
    document.body.appendChild(drag.ghostEl);

    // Mark source as dragging
    block.classList.add('dragging');
  }

  // ── Pointer move ──────────────────────────────────────────
  function onMouseMove(e) {
    // If there's a pending palette click and mouse moved enough → escalate to drag
    if (pendingPaletteClick && !drag.active) {
      const dx = e.clientX - pendingPaletteClick.startX;
      const dy = e.clientY - pendingPaletteClick.startY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        const { key, def } = pendingPaletteClick;
        pendingPaletteClick = null;
        startPaletteDrag(key, def, e);
      }
    }

    if (!drag.active) return;
    drag.mouseX = e.clientX;
    drag.mouseY = e.clientY;
    positionGhost(e.clientX, e.clientY);
    updateDropIndicator(e.clientX, e.clientY);
  }

  // ── Pointer up (drop) ────────────────────────────────────
  function onMouseUp(e) {
    // Pending palette click that never became a drag → add to queue end
    if (pendingPaletteClick) {
      const { key, block } = pendingPaletteClick;
      pendingPaletteClick = null;
      if (!GameState.executing) {
        if (isAtBlockLimit()) {
          showLimitWarning();
        } else {
          const newCmd = createCommandFromTemplate(key);
          if (newCmd) {
            GameState.commandQueue.push(newCmd);
            const levelData = LEVELS[GameState.currentLevelIndex];
            UI.renderQueue(GameState.commandQueue, levelData);
            UI.updateBlockCounter(GameState, levelData);
            // Brief flash to confirm the add
            block.style.boxShadow = '0 0 14px rgba(255,255,255,0.5)';
            setTimeout(() => { block.style.boxShadow = ''; }, 200);
          }
        }
      }
      return;
    }

    if (!drag.active) return;

    removeDropIndicator();

    const queueEl = document.getElementById('command-queue');
    const qRect   = queueEl.getBoundingClientRect();
    const overQueue = e.clientX >= qRect.left && e.clientX <= qRect.right &&
                      e.clientY >= qRect.top  && e.clientY <= qRect.bottom;

    if (overQueue) {
      const info = getInsertInfo(e.clientX, e.clientY);
      handleDrop(info);
    }

    // Clean up drag state
    document.querySelectorAll('.cmd-block.dragging, .repeat-header.dragging').forEach(el => {
      el.classList.remove('dragging');
    });

    if (drag.ghostEl) {
      drag.ghostEl.remove();
      drag.ghostEl = null;
    }

    drag.active     = false;
    drag.sourceType = null;
    drag.sourceId   = null;
    drag.template   = null;
  }

  // ── Block limit check ────────────────────────────────────
  // Returns true if adding one more block would exceed the level's limit.
  // Reordering within the queue never adds blocks, so only call this for new additions.
  function isAtBlockLimit() {
    const levelData = LEVELS[GameState.currentLevelIndex];
    if (!levelData) return false;
    const used = Engine.countBlocks(GameState.commandQueue);
    return used >= levelData.blockLimit;
  }

  function showLimitWarning() {
    UI.log(`Block limit reached (${LEVELS[GameState.currentLevelIndex].blockLimit} blocks)! Use loops or functions to do more with fewer blocks.`, 'warn');
    // Flash the block counter red briefly
    const el = document.getElementById('block-counter');
    if (el) {
      el.style.color = '#ff3355';
      el.style.transform = 'scale(1.15)';
      setTimeout(() => { el.style.color = ''; el.style.transform = ''; }, 500);
    }
  }

  // ── Handle the actual drop ────────────────────────────────
  function handleDrop(info) {
    if (!info) return;

    const { insertIndex, parentId } = info;

    let newCmd;

    if (drag.sourceType === 'palette') {
      // Only check limit when adding a new block from palette (not reordering)
      if (isAtBlockLimit()) {
        showLimitWarning();
        return;
      }
      newCmd = createCommandFromTemplate(drag.template);
    } else if (drag.sourceType === 'queue') {
      // Reordering — remove from old position, no limit check needed
      newCmd = extractFromQueue(GameState.commandQueue, drag.sourceId);
      if (!newCmd) return;
    }

    if (!newCmd) return;

    // Insert at new position
    if (parentId) {
      // Insert into a repeat/while body
      const parent = UI.findInQueue(GameState.commandQueue, parentId);
      if (parent && parent.body) {
        const safeIdx = Math.min(insertIndex, parent.body.length);
        parent.body.splice(safeIdx, 0, newCmd);
      } else {
        GameState.commandQueue.push(newCmd);
      }
    } else {
      const safeIdx = Math.min(insertIndex, GameState.commandQueue.length);
      GameState.commandQueue.splice(safeIdx, 0, newCmd);
    }

    const levelData = LEVELS[GameState.currentLevelIndex];
    UI.renderQueue(GameState.commandQueue, levelData);
    UI.updateBlockCounter(GameState, levelData);
  }

  // ── Create a command object from a palette template ───────
  function createCommandFromTemplate(key) {
    const def = BLOCK_DEFS[key];
    if (!def) return null;

    const base = Object.assign({}, def, { id: newId() });

    // Deep-copy body if present
    if (def.body !== undefined) {
      base.body = [];
    }
    if (def.count !== undefined) {
      base.count = def.count;
    }

    return base;
  }

  // ── Extract (remove) a command from the queue by id ───────
  function extractFromQueue(arr, blockId) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === blockId) {
        return arr.splice(i, 1)[0];
      }
      if (arr[i].body) {
        const found = extractFromQueue(arr[i].body, blockId);
        if (found) return found;
      }
    }
    return null;
  }

  // ── Determine where to insert based on cursor position ────
  function getInsertInfo(mouseX, mouseY) {
    const queueEl = document.getElementById('command-queue');
    if (!queueEl) return { insertIndex: GameState.commandQueue.length, parentId: null };

    // Check if cursor is over any body drop zone (repeat, while, define)
    const bodies = queueEl.querySelectorAll('.body-dropzone');
    for (const body of bodies) {
      const r = body.getBoundingClientRect();
      if (mouseX >= r.left && mouseX <= r.right &&
          mouseY >= r.top  && mouseY <= r.bottom) {
        const parentId = body.dataset.parentId;
        const idx = getIndexWithinContainer(body, mouseY);
        return { insertIndex: idx, parentId };
      }
    }

    // Top-level queue insert
    const idx = getIndexWithinContainer(queueEl, mouseY);
    return { insertIndex: idx, parentId: null };
  }

  function getIndexWithinContainer(containerEl, mouseY) {
    const children = Array.from(containerEl.children).filter(
      el => !el.classList.contains('queue-placeholder') &&
            !el.classList.contains('drop-indicator')
    );

    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (mouseY < mid) return i;
    }
    return children.length;
  }

  // ── Visual drop indicator line ─────────────────────────────
  function updateDropIndicator(mouseX, mouseY) {
    removeDropIndicator();

    const info = getInsertInfo(mouseX, mouseY);
    if (!info) return;

    let container;
    if (info.parentId) {
      container = document.querySelector(`.body-dropzone[data-parent-id="${info.parentId}"]`);
    } else {
      container = document.getElementById('command-queue');
    }
    if (!container) return;

    // Find the reference child
    const children = Array.from(container.children).filter(
      el => !el.classList.contains('queue-placeholder') &&
            !el.classList.contains('drop-indicator')
    );

    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.id = 'drop-indicator';

    if (info.insertIndex >= children.length) {
      container.appendChild(indicator);
    } else {
      container.insertBefore(indicator, children[info.insertIndex]);
    }
  }

  function removeDropIndicator() {
    const el = document.getElementById('drop-indicator');
    if (el) el.remove();
  }

  // ── Ghost element ─────────────────────────────────────────
  function buildGhostEl(def) {
    const ghost = document.createElement('div');
    ghost.id = 'drag-ghost';
    ghost.className = `cmd-block ${def.cssClass || ''}`;
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.85;
      transform: rotate(2deg) scale(1.05);
      box-shadow: 0 6px 24px rgba(0,0,0,0.7);
      min-width: 130px;
      padding: 6px 12px;
    `;
    ghost.textContent = def.paletteLabel || def.label || def.type;
    return ghost;
  }

  function positionGhost(x, y) {
    if (!drag.ghostEl) return;
    drag.ghostEl.style.left = (x + 12) + 'px';
    drag.ghostEl.style.top  = (y - 20) + 'px';
  }

  // ── Helpers ───────────────────────────────────────────────
  function makeFakeDef(cmd) {
    return {
      type:         cmd.type,
      cssClass:     UI.getBlockCssClass(cmd),
      label:        UI.getBlockLabel(cmd),
      paletteLabel: UI.getBlockLabel(cmd),
    };
  }

  return { init, renderPalette };
})();
