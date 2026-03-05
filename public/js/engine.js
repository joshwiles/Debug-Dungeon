// ============================================================
// DEBUG DUNGEON — Execution Engine
// engine.js: parses the command queue, runs commands step-by-step,
//             handles game logic (movement, combat, items, win/lose)
// ============================================================

/* global GameState, activeScene, LEVELS, DIR_VECTORS,
   UI, onLevelComplete, onLevelFail */

const Engine = (() => {

  // ── Execution state ─────────────────────────────────────
  let flatQueue   = [];  // flattened list of {cmd, depth, loopInfo}
  let stepIndex   = 0;
  let stepMode    = false;

  // ms per step (driven by speed slider)
  function getDelay() {
    const slider = document.getElementById('speed-slider');
    const val    = slider ? parseInt(slider.value, 10) : 5;
    // val 1 (slow) → 1200ms, val 10 (fast) → 120ms
    return Math.round(1200 - (val - 1) * (1080 / 9));
  }

  // ── Public API ───────────────────────────────────────────
  function init() {
    document.getElementById('run-btn').addEventListener('click',   runAll);
    document.getElementById('step-btn').addEventListener('click',  stepOnce);
    document.getElementById('reset-btn').addEventListener('click', () => resetLevel());
  }

  async function runAll() {
    if (GameState.executing) return;

    GameState.cancelExec   = false;
    GameState.executing    = true;
    GameState.executionDone = false;
    GameState.runCount++;
    GameState.okCount      = 0;
    GameState.errCount     = 0;

    // Count blocks used
    GameState.blocksUsed = countBlocks(GameState.commandQueue);
    UI.updateBlockCounter();

    // Flatten the command queue (expand loops etc.)
    flatQueue  = flattenQueue(GameState.commandQueue);
    stepIndex  = 0;
    stepMode   = false;

    if (flatQueue.length === 0) {
      UI.log('Your queue is empty! Drag some blocks in first.', 'warn');
      GameState.executing = false;
      return;
    }

    UI.log('▶ Running program...', 'sys');
    UI.clearHighlights();

    while (stepIndex < flatQueue.length) {
      if (GameState.cancelExec) break;

      const item = flatQueue[stepIndex];
      await executeStep(item);
      stepIndex++;

      // Check win after each step
      if (!GameState.cancelExec && checkWin()) {
        GameState.executing = false;
        GameState.executionDone = true;
        onLevelComplete();
        return;
      }

      if (!GameState.cancelExec) {
        await sleep(getDelay());
      }
    }

    GameState.executing    = false;
    GameState.executionDone = true;
    UI.clearHighlights();

    if (!GameState.cancelExec) {
      // Program finished — check win one more time, then check fail
      if (checkWin()) {
        onLevelComplete();
      } else {
        const reason = buildFailReason();
        UI.log('Program ended. ' + reason, 'err');
        onLevelFail(reason);
      }
    }
  }

  async function stepOnce() {
    if (GameState.executing) return;
    if (GameState.executionDone) {
      UI.log('Program already finished. Hit RESET to try again.', 'warn');
      return;
    }

    // First call: prepare
    if (stepIndex === 0 || flatQueue.length === 0) {
      GameState.cancelExec = false;
      GameState.runCount++;
      GameState.okCount    = 0;
      GameState.errCount   = 0;
      GameState.blocksUsed = countBlocks(GameState.commandQueue);
      UI.updateBlockCounter();
      flatQueue = flattenQueue(GameState.commandQueue);
      stepIndex = 0;
      stepMode  = true;
      UI.clearHighlights();
      if (flatQueue.length === 0) {
        UI.log('Your queue is empty!', 'warn');
        return;
      }
    }

    if (stepIndex >= flatQueue.length) {
      GameState.executionDone = true;
      UI.clearHighlights();
      if (!checkWin()) {
        const reason = buildFailReason();
        UI.log('Program ended. ' + reason, 'err');
        onLevelFail(reason);
      } else {
        onLevelComplete();
      }
      return;
    }

    const item = flatQueue[stepIndex];
    await executeStep(item);
    stepIndex++;

    if (checkWin()) {
      GameState.executionDone = true;
      UI.clearHighlights();
      onLevelComplete();
    }
  }

  // ── Flatten the command queue ────────────────────────────
  // Expands repeat/while/define into individual steps with metadata
  function flattenQueue(queue, depth = 0, parentId = null) {
    const result = [];
    for (const cmd of queue) {
      if (cmd.type === 'repeat') {
        const count = Math.max(1, Math.min(99, parseInt(cmd.count, 10) || 1));
        for (let i = 0; i < count; i++) {
          // Marker for "entering iteration i"
          result.push({
            cmd: { type: '_repeat_iter', count, iteration: i + 1, blockId: cmd.id },
            depth, parentId: cmd.id
          });
          // Flatten body
          const bodyFlat = flattenQueue(cmd.body, depth + 1, cmd.id);
          result.push(...bodyFlat);
        }
        // Closing marker
        result.push({
          cmd: { type: '_repeat_end', blockId: cmd.id },
          depth, parentId: null
        });

      } else if (cmd.type === 'while') {
        // Expanded at runtime — we evaluate condition each iteration
        // Push a sentinel that the executor handles specially
        result.push({ cmd, depth, parentId });

      } else if (cmd.type === 'define') {
        // Store the function body for later; no immediate execution
        result.push({ cmd, depth, parentId });

      } else {
        result.push({ cmd, depth, parentId });
      }
    }
    return result;
  }

  // ── Execute a single flattened step ──────────────────────
  async function executeStep(item) {
    const { cmd } = item;

    // Skip meta markers except highlighting
    if (cmd.type === '_repeat_iter') {
      UI.highlightBlock(cmd.blockId, `iteration ${cmd.iteration} of ${cmd.count}`);
      return;
    }
    if (cmd.type === '_repeat_end') {
      return;
    }

    // Highlight current block
    if (cmd.blockId) UI.highlightBlock(cmd.blockId, null);

    switch (cmd.type) {
      case 'move':    await execMove(cmd);   break;
      case 'attack':  await execAttack(cmd); break;
      case 'set':     await execSet(cmd);    break;
      case 'define':  execDefine(cmd);       break;
      case 'call':    await execCall(cmd);   break;
      case 'while':   await execWhile(cmd);  break;
      default:
        UI.log(`Unknown command: ${cmd.type}`, 'err');
    }
  }

  // ── Move command ─────────────────────────────────────────
  async function execMove(cmd) {
    const dir = cmd.direction;
    const dv  = DIR_VECTORS[dir];
    if (!dv) return;

    const p   = GameState.player;
    const nx  = p.x + dv.dx;
    const ny  = p.y + dv.dy;

    p.facing = dir;

    // Check bounds
    if (ny < 0 || ny >= GameState.map.length ||
        nx < 0 || nx >= GameState.map[ny].length) {
      UI.log(`move ${dir} — hit the boundary! You can't leave the map.`, 'err');
      activeScene && activeScene.animateBonk('player', dv.dx, dv.dy);
      activeScene && activeScene.showFloater(p.x, p.y, 'BONK!', '#ff3355');
      return;
    }

    const tile = GameState.map[ny][nx];

    // Wall collision
    if (tile === '#') {
      UI.log(`move ${dir} — BONK! Walked into a wall. Walls don't move. You do. 🧱`, 'err');
      activeScene && await activeScene.animateBonk('player', dv.dx, dv.dy);
      activeScene && activeScene.showFloater(p.x, p.y, 'BONK!', '#ff3355');
      // Bug adjacency attack
      checkBugCounterAttack();
      return;
    }

    // Bug collision — agent walks into a bug
    const bugHere = GameState.bugs.find(b => b.alive && b.x === nx && b.y === ny);
    if (bugHere) {
      UI.log(`move ${dir} — you walked into a bug! The bug attacks back! 🐛`, 'err');
      activeScene && await activeScene.animateBonk('player', dv.dx, dv.dy);
      activeScene && activeScene.showFloater(p.x, p.y, 'OW!', '#ff3355');
      takeDamage(1);
      return;
    }

    // Door collision
    if (tile === 'D') {
      const door = GameState.doors.find(d => d.x === nx && d.y === ny && !d.open);
      if (door) {
        const keys = GameState.variables['keys'] || 0;
        if (keys > 0) {
          GameState.variables['keys'] = keys - 1;
          door.open = true;
          GameState.map[ny][nx] = '.';
          UI.log(`Door unlocked! keys = ${GameState.variables['keys']} 🔑`, 'ok');
          activeScene && activeScene.openDoor(door.id, door.x, door.y);
          UI.updateMemoryBank();
          // Now move through it
          movePlayer(nx, ny, dir);
          await activeScene.animateMove('player', nx, ny, 200);
          checkItemPickup(nx, ny);
        } else {
          UI.log(`move ${dir} — door is locked! Find a key first. 🚪`, 'err');
          activeScene && await activeScene.animateBonk('player', dv.dx, dv.dy);
        }
        return;
      }
    }

    // Normal move (also handles fire tiles — player moves then takes burn damage)
    movePlayer(nx, ny, dir);
    UI.log(`move ${dir} ✓`, 'ok');
    if (activeScene) await activeScene.animateMove('player', nx, ny, 200);
    checkItemPickup(nx, ny);
    checkBugCounterAttack();

    // Fire tile — burns the player on entry
    if (tile === 'F') {
      UI.log(`🔥 OUCH! Stepped on fire! -1 HP. Try going around it!`, 'err');
      activeScene && activeScene.showFloater(nx, ny, '🔥 -1', '#ff6600');
      activeScene && activeScene.playerHurt();
      takeDamage(1);
    }
  }

  function movePlayer(nx, ny, dir) {
    GameState.player.x = nx;
    GameState.player.y = ny;
    GameState.player.facing = dir;
    UI.updateHUD();
  }

  function checkItemPickup(x, y) {
    const item = GameState.items.find(i => !i.collected && i.x === x && i.y === y);
    if (!item) return;
    item.collected = true;

    if (item.type === 'key') {
      GameState.variables['keys'] = (GameState.variables['keys'] || 0) + 1;
      UI.log(`Picked up a KEY! keys = ${GameState.variables['keys']} 🔑`, 'info');
      activeScene && activeScene.collectItem(item.id, x, y);
      UI.updateMemoryBank();
    } else if (item.type === 'weapon_debugger') {
      GameState.variables['weapon'] = 'debugger';
      UI.log(`Picked up DEBUGGER (1 dmg)! weapon = "debugger" 🔧`, 'info');
      activeScene && activeScene.collectItem(item.id, x, y);
      UI.updateMemoryBank();
    } else if (item.type === 'weapon_compiler') {
      GameState.variables['weapon'] = 'compiler';
      UI.log(`Picked up COMPILER (2 dmg)! weapon = "compiler" ⚡`, 'info');
      activeScene && activeScene.collectItem(item.id, x, y);
      UI.updateMemoryBank();
    }
  }

  // ── Attack command ───────────────────────────────────────
  async function execAttack(cmd) {
    const p   = GameState.player;
    const dir = p.facing;
    const dv  = DIR_VECTORS[dir] || { dx: 1, dy: 0 };
    const tx  = p.x + dv.dx;
    const ty  = p.y + dv.dy;

    // Get weapon damage
    const weapon = GameState.variables['weapon'] || 'fist';
    let damage = 1;
    if (weapon === 'compiler') damage = 2;
    if (weapon === 'fist')     damage = 1;
    if (weapon === 'debugger') damage = 1;

    // Is there a bug at target?
    const bug = GameState.bugs.find(b => b.alive && b.x === tx && b.y === ty);

    if (activeScene) {
      await activeScene.animateAttack('player', tx, ty, !!bug, 300);
    }

    if (bug) {
      bug.hp -= damage;
      const killed = bug.hp <= 0;
      if (killed) {
        bug.alive = false;
        bug.hp    = 0;
        UI.log(`attack FORWARD — HIT! Bug defeated! 🐛💥 (-${damage} HP)`, 'ok');
        activeScene && activeScene.removeEntity(bug.id);
        activeScene && activeScene.showFloater(tx, ty, `💀 -${damage}`, '#ff3355');
      } else {
        UI.log(`attack FORWARD — HIT! Bug HP: ${bug.hp}/${bug.maxHp} (-${damage} HP)`, 'ok');
        activeScene && activeScene.updateHpBar(bug.id, bug.hp, bug.maxHp);
        activeScene && activeScene.showFloater(tx, ty, `-${damage}`, '#ff3355');
        // Bug counter-attacks since still alive
        takeDamage(1);
      }
    } else {
      // Check if it's a wall
      const inBounds = ty >= 0 && ty < GameState.map.length &&
                       tx >= 0 && tx < GameState.map[ty].length;
      if (inBounds && GameState.map[ty][tx] === '#') {
        UI.log(`attack FORWARD — you swung at a wall. The wall won. 🧱`, 'err');
        activeScene && activeScene.showFloater(p.x, p.y, 'CLANG!', '#888');
      } else {
        UI.log(`attack FORWARD — swung at nothing. The air is undefeated. 💨`, 'warn');
        activeScene && activeScene.showFloater(tx, ty, 'MISS!', '#888');
      }
    }
  }

  // ── Set command ──────────────────────────────────────────
  async function execSet(cmd) {
    const varName = cmd.variable || 'var';
    const val     = cmd.value !== undefined ? cmd.value : 0;
    GameState.variables[varName] = val;
    UI.log(`set ${varName} = "${val}" ✓`, 'info');
    UI.updateMemoryBank();
    if (activeScene) {
      activeScene.showFloater(
        GameState.player.x, GameState.player.y,
        `${varName}=${val}`, '#cc66ff'
      );
    }
  }

  // ── Define function ──────────────────────────────────────
  function execDefine(cmd) {
    const name = cmd.name || 'func';
    GameState.functions[name] = cmd.body || [];
    UI.log(`define ${name}: function saved ✓`, 'info');
    UI.updateMemoryBank();
  }

  // ── Call function ────────────────────────────────────────
  async function execCall(cmd) {
    const name = cmd.name || 'func';
    const body = GameState.functions[name];
    if (!body || body.length === 0) {
      UI.log(`call ${name} — function not defined yet! Define it first.`, 'err');
      return;
    }
    UI.log(`call ${name} ▶`, 'info');
    const flat = flattenQueue(body, 1, null);
    for (const item of flat) {
      if (GameState.cancelExec) break;
      await executeStep(item);
      if (!stepMode) await sleep(Math.floor(getDelay() * 0.6));
    }
  }

  // ── While loop ───────────────────────────────────────────
  async function execWhile(cmd) {
    const condition = cmd.condition;
    const maxIter   = 50; // safety cap
    let   iter      = 0;

    while (iter < maxIter && !GameState.cancelExec) {
      // Evaluate condition
      if (condition === 'bug_alive') {
        const anyAlive = GameState.bugs.some(b => b.alive);
        if (!anyAlive) break;
      } else {
        break; // unknown condition
      }

      UI.log(`while ${condition}: loop iteration ${iter + 1}`, 'info');
      const flat = flattenQueue(cmd.body, 1, cmd.id);
      for (const item of flat) {
        if (GameState.cancelExec) return;
        await executeStep(item);
        if (!stepMode) await sleep(Math.floor(getDelay() * 0.7));
      }
      iter++;
    }

    if (iter >= maxIter) {
      UI.log('while loop ran 50 times and stopped. Infinite loop prevented! 🛑', 'warn');
    }
  }

  // ── Win condition check ──────────────────────────────────
  function checkWin() {
    const level = LEVELS[GameState.currentLevelIndex];
    if (!level) return false;
    const p = GameState.player;

    // Find exit tile position
    const exitPos = findTile('E');
    if (!exitPos) return false;

    const onExit = (p.x === exitPos.x && p.y === exitPos.y);

    switch (level.winCondition) {
      case 'exit':
        return onExit;
      case 'exit_and_kill_all':
        return onExit && GameState.bugs.every(b => !b.alive);
      case 'kill_all':
        return GameState.bugs.every(b => !b.alive);
      default:
        return onExit;
    }
  }

  function findTile(ch) {
    for (let row = 0; row < GameState.map.length; row++) {
      for (let col = 0; col < GameState.map[row].length; col++) {
        if (GameState.map[row][col] === ch) return { x: col, y: row };
      }
    }
    return null;
  }

  function buildFailReason() {
    const level = LEVELS[GameState.currentLevelIndex];
    const p = GameState.player;
    if (p.hp <= 0) return 'Your agent ran out of HP. Write a better strategy!';

    const exitPos = findTile('E');
    if (exitPos && !(p.x === exitPos.x && p.y === exitPos.y)) {
      if (level.winCondition === 'exit_and_kill_all' && GameState.bugs.some(b => b.alive)) {
        return 'You reached the exit but bugs are still alive! Defeat them all first.';
      }
      return 'You never reached the EXIT. Add more commands to get there!';
    }
    return 'Objective not met. Re-read the mission and try again!';
  }

  // ── Damage / HP ──────────────────────────────────────────
  function takeDamage(amount) {
    GameState.player.hp = Math.max(0, GameState.player.hp - amount);
    UI.updateHUD();
    if (activeScene) activeScene.playerHurt();
    UI.log(`Agent took ${amount} damage! HP: ${GameState.player.hp}/${GameState.player.maxHp}`, 'warn');

    if (GameState.player.hp <= 0) {
      UI.log('Agent HP reached 0. Game over!', 'err');
      GameState.cancelExec = true;
      onLevelFail('Your agent ran out of HP! Try a different approach.');
    }
  }

  // Bugs counter-attack when player is adjacent and hasn't acted this step
  function checkBugCounterAttack() {
    const p = GameState.player;
    for (const bug of GameState.bugs) {
      if (!bug.alive) continue;
      const dist = Math.abs(bug.x - p.x) + Math.abs(bug.y - p.y);
      if (dist === 1) {
        // Bug attacks player with low probability (don't make it too punishing)
        // We only counter-attack if the player walked INTO the bug or into a wall near it
        // (handled in execMove already)
      }
    }
  }

  // ── Count total blocks in queue ──────────────────────────
  function countBlocks(queue, depth = 0) {
    let count = 0;
    for (const cmd of queue) {
      count++;
      if (cmd.body && cmd.body.length > 0) {
        count += countBlocks(cmd.body, depth + 1);
      }
    }
    return count;
  }

  // ── Utility ─────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function resetStepState() {
    flatQueue  = [];
    stepIndex  = 0;
    stepMode   = false;
  }

  return { init, runAll, stepOnce, resetStepState, countBlocks };
})();
