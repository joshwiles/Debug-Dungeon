// ============================================================
// DEBUG DUNGEON — Main Game Controller
// game.js: global state, initialization, level loading, Phaser setup
// ============================================================

/* global Phaser, LEVELS, BLOCK_DEFS, GameScene, Engine, UI, DragDrop */

// ── Tile dimensions (pixels) ──────────────────────────────
const TILE_SIZE  = 48;
const MAP_COLS   = 10;
const MAP_ROWS   = 8;
const CANVAS_W   = TILE_SIZE * MAP_COLS;  // 480
const CANVAS_H   = TILE_SIZE * MAP_ROWS;  // 384

// ── Global game state ─────────────────────────────────────
const GameState = {
  // Level meta
  currentLevelIndex: 0,
  completedLevels: [],      // loaded from localStorage on init

  // Runtime state (reset each level)
  player: null,             // { x, y, hp, maxHp, energy, maxEnergy, facing }
  bugs:   [],               // [{ id, x, y, hp, maxHp, alive }]
  items:  [],               // [{ id, type, x, y, collected }]
  doors:  [],               // [{ id, x, y, open }]
  map:    [],               // 2D array of tile chars (mutable copy)
  variables: {},            // Memory bank key-value pairs
  functions: {},            // defined functions: name → body[]

  // Execution state
  commandQueue:  [],        // array of command objects (the user's program)
  executing:     false,
  executionDone: false,
  cancelExec:    false,     // set true to abort mid-run

  // Stats for victory screen
  runCount:     0,
  blocksUsed:   0,

  // Metrics for API (ok/err command counts per run)
  okCount:      0,
  errCount:     0,
};

// ── Phaser game instance ──────────────────────────────────
let phaserGame = null;
let activeScene = null;   // reference to the running GameScene

// ── Entry point ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  setupScreenNavigation();
  renderLevelSelect();
  // Init modules that attach DOM event listeners
  // (All other JS files have already been parsed by this point since
  //  synchronous scripts block HTML parsing before DOMContentLoaded fires)
  UI.init();
  Engine.init();
  // Init API integration (auth buttons, session restore)
  if (typeof DD_API !== 'undefined') DD_API.init();
  // Init background music
  if (typeof Music !== 'undefined') Music.init();
});

// ── Persist / load level progress ─────────────────────────
function loadProgress() {
  // Local first (instant)
  try {
    const saved = localStorage.getItem('dd_completed');
    if (saved) GameState.completedLevels = JSON.parse(saved);
  } catch (e) { /* ignore */ }

  // Server sync (async, non-blocking) — merges server data with local
  if (typeof DD_API !== 'undefined' && DD_API.isStudent()) {
    DD_API.syncProgress().then(data => {
      if (data && data.completed_levels) {
        let changed = false;
        data.completed_levels.forEach(idx => {
          if (!GameState.completedLevels.includes(idx)) {
            GameState.completedLevels.push(idx);
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('dd_completed', JSON.stringify(GameState.completedLevels));
          renderLevelSelect();
        }
      }
    });
  }
}

function saveProgress(levelIndex) {
  if (!GameState.completedLevels.includes(levelIndex)) {
    GameState.completedLevels.push(levelIndex);
    try {
      localStorage.setItem('dd_completed', JSON.stringify(GameState.completedLevels));
    } catch (e) { /* ignore */ }
  }
}

// ── Screen navigation ─────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

function setupScreenNavigation() {
  document.getElementById('start-btn').addEventListener('click', () => {
    showScreen('level-select-screen');
    renderLevelSelect();
  });
  document.getElementById('back-btn').addEventListener('click', () => {
    showScreen('start-screen');
  });
  document.getElementById('menu-btn').addEventListener('click', () => {
    showScreen('level-select-screen');
    renderLevelSelect();
  });

  // Victory overlay buttons
  document.getElementById('next-level-btn').addEventListener('click', () => {
    hideOverlays();
    const next = GameState.currentLevelIndex + 1;
    if (next < LEVELS.length) {
      loadLevel(next);
    } else {
      showScreen('level-select-screen');
      renderLevelSelect();
    }
  });
  document.getElementById('victory-levels-btn').addEventListener('click', () => {
    hideOverlays();
    showScreen('level-select-screen');
    renderLevelSelect();
  });

  // Defeat overlay buttons
  document.getElementById('retry-btn').addEventListener('click', () => {
    hideOverlays();
    resetLevel(false);
  });
  document.getElementById('defeat-levels-btn').addEventListener('click', () => {
    hideOverlays();
    showScreen('level-select-screen');
    renderLevelSelect();
  });
}

function hideOverlays() {
  document.getElementById('victory-overlay').classList.add('hidden');
  document.getElementById('defeat-overlay').classList.add('hidden');
}

// ── Level Select ──────────────────────────────────────────
function renderLevelSelect() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  LEVELS.forEach((level, idx) => {
    const completed = GameState.completedLevels.includes(idx);
    const locked    = false; // TODO: restore locking — idx > 0 && !GameState.completedLevels.includes(idx - 1) && !completed;

    const card = document.createElement('div');
    card.className = 'level-card' +
      (completed ? ' completed' : '') +
      (locked    ? ' locked'    : '');

    card.innerHTML = `
      <span class="level-card-check">${completed ? '✅' : locked ? '🔒' : '○'}</span>
      <span class="level-card-num">${idx + 1}</span>
      <span class="level-card-name">${level.name}</span>
      <span class="level-card-concept">${level.concept}</span>
    `;

    if (!locked) {
      card.addEventListener('click', () => {
        showScreen('game-screen');
        loadLevel(idx);
      });
    }

    grid.appendChild(card);
  });
}

// ── Phaser setup ──────────────────────────────────────────
function initPhaser() {
  if (phaserGame) {
    phaserGame.destroy(true);
    phaserGame = null;
    activeScene = null;
  }

  const config = {
    type: Phaser.AUTO,
    width:  CANVAS_W,
    height: CANVAS_H,
    parent: 'game-container',
    backgroundColor: '#0a0a12',
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    fps: { target: 30 },
  };

  phaserGame = new Phaser.Game(config);
}

// ── Parse map into entities ───────────────────────────────
function parseLevel(levelData) {
  const map    = levelData.map.map(row => row.split(''));
  const bugs   = [];
  const items  = [];
  const doors  = [];
  let   player = null;
  let   bugId  = 0;

  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const ch = map[row][col];
      switch (ch) {
        case 'P':
          player = { x: col, y: row, hp: 10, maxHp: 10, energy: 10, maxEnergy: 10, facing: 'RIGHT' };
          map[row][col] = '.';
          break;
        case 'B':
          bugs.push({ id: `bug${bugId++}`, x: col, y: row, hp: 1, maxHp: 1, alive: true });
          map[row][col] = '.';
          break;
        case 'b':
          bugs.push({ id: `bug${bugId++}`, x: col, y: row, hp: 2, maxHp: 2, alive: true });
          map[row][col] = '.';
          break;
        case 'X':
          bugs.push({ id: `bug${bugId++}`, x: col, y: row, hp: 5, maxHp: 5, alive: true });
          map[row][col] = '.';
          break;
        case 'K':
          items.push({ id: `key${items.length}`, type: 'key', x: col, y: row, collected: false });
          map[row][col] = '.';
          break;
        case '1':
          items.push({ id: `wpn0`, type: 'weapon_debugger', x: col, y: row, collected: false });
          map[row][col] = '.';
          break;
        case '2':
          items.push({ id: `wpn1`, type: 'weapon_compiler', x: col, y: row, collected: false });
          map[row][col] = '.';
          break;
        case 'D':
          doors.push({ id: `door${doors.length}`, x: col, y: row, open: false });
          map[row][col] = 'D';
          break;
      }
    }
  }

  return { map, player, bugs, items, doors };
}

// ── Load a level ──────────────────────────────────────────
function loadLevel(levelIndex) {
  const levelData = LEVELS[levelIndex];
  if (!levelData) return;

  GameState.currentLevelIndex = levelIndex;
  GameState.runCount     = 0;
  GameState.blocksUsed   = 0;
  GameState.commandQueue = [];
  GameState.variables    = {};
  GameState.functions    = {};
  GameState.executing    = false;
  GameState.executionDone = false;
  GameState.cancelExec   = false;
  GameState.okCount      = 0;
  GameState.errCount     = 0;

  const parsed = parseLevel(levelData);
  GameState.map    = parsed.map;
  GameState.player = parsed.player;
  GameState.bugs   = parsed.bugs;
  GameState.items  = parsed.items;
  GameState.doors  = parsed.doors;

  // Init Phaser if not yet running
  if (!phaserGame) {
    initPhaser();
    // GameScene.create() will call onSceneReady when ready
  } else {
    // Scene already exists, just re-render
    if (activeScene) {
      activeScene.renderLevel(levelData, GameState);
    }
  }

  // Update UI panels
  UI.loadLevel(levelData, GameState);
  DragDrop.init(levelData);
  hideOverlays();
}

// Called by GameScene once it's created and ready
function onSceneReady(scene) {
  activeScene = scene;
  const levelData = LEVELS[GameState.currentLevelIndex];
  if (levelData) {
    scene.renderLevel(levelData, GameState);
  }
}

// ── Reset current level ───────────────────────────────────
function resetLevel(clearQueue = true) {
  GameState.cancelExec = true;

  setTimeout(() => {
    const levelIndex = GameState.currentLevelIndex;
    const levelData  = LEVELS[levelIndex];
    const parsed = parseLevel(levelData);

    GameState.map          = parsed.map;
    GameState.player       = parsed.player;
    GameState.bugs         = parsed.bugs;
    GameState.items        = parsed.items;
    GameState.doors        = parsed.doors;
    if (clearQueue) GameState.commandQueue = [];
    GameState.variables    = {};
    GameState.functions    = {};
    GameState.executing = false;
    GameState.executionDone = false;
    GameState.cancelExec    = false;

    if (activeScene) activeScene.renderLevel(levelData, GameState);

    UI.reset(levelData, GameState);
    hideOverlays();
  }, 50);
}

// ── Called when level is won ──────────────────────────────
function onLevelComplete() {
  saveProgress(GameState.currentLevelIndex);

  // Submit attempt to API if logged in as student
  if (typeof DD_API !== 'undefined' && DD_API.isStudent()) {
    DD_API.submitAttempt({
      level_index:  GameState.currentLevelIndex,
      completed:    true,
      blocks_used:  GameState.blocksUsed,
      block_limit:  LEVELS[GameState.currentLevelIndex].blockLimit,
      ok_count:     GameState.okCount,
      err_count:    GameState.errCount,
      fail_reason:  null,
    });
  }

  const levelData = LEVELS[GameState.currentLevelIndex];
  const conceptEl = document.getElementById('victory-concept');
  const statsEl   = document.getElementById('victory-stats');
  const nextBtn   = document.getElementById('next-level-btn');

  conceptEl.textContent = `You learned: ${levelData.concept}`;
  statsEl.innerHTML = `
    Blocks used: ${GameState.blocksUsed}<br>
    Block limit: ${levelData.blockLimit}<br>
    Times run: ${GameState.runCount}
  `;

  const hasNext = GameState.currentLevelIndex + 1 < LEVELS.length;
  nextBtn.style.display = hasNext ? '' : 'none';

  document.getElementById('victory-overlay').classList.remove('hidden');
}

// ── Called when level is lost ─────────────────────────────
function onLevelFail(reason) {
  // Submit failed attempt to API if logged in as student
  if (typeof DD_API !== 'undefined' && DD_API.isStudent()) {
    DD_API.submitAttempt({
      level_index:  GameState.currentLevelIndex,
      completed:    false,
      blocks_used:  GameState.blocksUsed,
      block_limit:  LEVELS[GameState.currentLevelIndex].blockLimit,
      ok_count:     GameState.okCount,
      err_count:    GameState.errCount,
      fail_reason:  reason || 'Objective not met.',
    });
  }

  const el = document.getElementById('defeat-msg');
  el.textContent = reason || 'Objective not met. Debug your code and try again!';
  document.getElementById('defeat-overlay').classList.remove('hidden');
}
