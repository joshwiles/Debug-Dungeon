// ============================================================
// DEBUG DUNGEON — Phaser Renderer (GameScene)
// renderer.js: tile grid, entity sprites, movement animations
// ============================================================

/* global Phaser, TILE_SIZE, MAP_COLS, MAP_ROWS, onSceneReady, GameState */

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.tileSize = TILE_SIZE;
    this.cols = MAP_COLS;
    this.rows = MAP_ROWS;

    // Sprite / text object pools
    this.tileGfx    = null;   // Graphics for the static tile layer
    this.entityPool = {};     // id → Phaser.GameObjects.Text
    this.particles  = [];     // temporary text particles
    this.scanOverlay = null;
  }

  // ── Phaser lifecycle ──────────────────────────────────────
  preload() {
    this.load.image('boss', 'image/boss.png');
  }

  create() {
    this.tileGfx = this.add.graphics();
    this.fxGfx   = this.add.graphics();
    this.fxGfx.setDepth(10);

    // Notify game.js that the scene is ready
    onSceneReady(this);
  }

  update() {
    // Not needed for turn-based, but Phaser requires it
  }

  // ── Render a full level ───────────────────────────────────
  renderLevel(levelData, state) {
    this.clearEntities();
    this.drawTiles(state.map);
    this.drawEntities(state);
  }

  // ── Draw the static tile layer ────────────────────────────
  drawTiles(map) {
    const g  = this.tileGfx;
    const ts = this.tileSize;
    g.clear();

    for (let row = 0; row < map.length; row++) {
      for (let col = 0; col < map[row].length; col++) {
        const ch = map[row][col];
        const px = col * ts;
        const py = row * ts;

        switch (ch) {
          case '#':   this.drawWall(g, px, py, ts);    break;
          case '.':   this.drawFloor(g, px, py, ts);   break;
          case 'E':   this.drawFloor(g, px, py, ts);   this.drawExit(px, py, ts);  break;
          case 'D':   this.drawFloor(g, px, py, ts);   this.drawDoor(px, py, ts, false); break;
          case 'F':   this.drawFloor(g, px, py, ts);   this.drawFire(col, row, px, py, ts); break;
          default:    this.drawFloor(g, px, py, ts);   break;
        }
      }
    }
  }

  drawWall(g, px, py, ts) {
    // Main wall face
    g.fillStyle(0x1a1a30, 1);
    g.fillRect(px, py, ts, ts);
    // Top highlight
    g.fillStyle(0x2a2a50, 1);
    g.fillRect(px, py, ts, 3);
    // Left highlight
    g.fillRect(px, py, 3, ts);
    // Bottom shadow
    g.fillStyle(0x0a0a18, 1);
    g.fillRect(px, py + ts - 3, ts, 3);
    // Right shadow
    g.fillRect(px + ts - 3, py, 3, ts);
    // Subtle inner dot pattern for texture
    g.fillStyle(0x242440, 0.5);
    g.fillRect(px + 8, py + 8, 2, 2);
    g.fillRect(px + ts - 10, py + ts - 10, 2, 2);
  }

  drawFloor(g, px, py, ts) {
    g.fillStyle(0x111128, 1);
    g.fillRect(px, py, ts, ts);
    // Subtle grid line
    g.lineStyle(1, 0x1a1a40, 0.6);
    g.strokeRect(px, py, ts, ts);
  }

  drawExit(px, py, ts) {
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    // Glowing portal fill
    const g = this.tileGfx;
    g.fillStyle(0x002210, 1);
    g.fillRect(px + 4, py + 4, ts - 8, ts - 8);
    // Portal ring
    g.lineStyle(3, 0x00ff9f, 0.9);
    g.strokeRect(px + 6, py + 6, ts - 12, ts - 12);
    g.lineStyle(1, 0x00ff9f, 0.4);
    g.strokeRect(px + 3, py + 3, ts - 6, ts - 6);
    // EXIT label
    const txt = this.add.text(cx, cy, 'EXIT', {
      fontSize: '9px',
      fontFamily: "'Press Start 2P', monospace",
      color: '#00ff9f',
    });
    txt.setOrigin(0.5, 0.5);
    txt.setDepth(3);
    this.entityPool['_exit_lbl_' + cx + '_' + cy] = txt;
  }

  drawDoor(px, py, ts, open) {
    const g = this.tileGfx;
    const color = open ? 0x00ff9f : 0xff8800;
    g.fillStyle(open ? 0x0a2a1a : 0x2a1500, 1);
    g.fillRect(px + 6, py + 6, ts - 12, ts - 12);
    g.lineStyle(2, color, 1);
    g.strokeRect(px + 6, py + 6, ts - 12, ts - 12);
    if (!open) {
      // keyhole symbol
      g.fillStyle(0xff8800, 1);
      g.fillCircle(px + ts / 2, py + ts / 2 - 4, 4);
      g.fillRect(px + ts / 2 - 3, py + ts / 2, 6, 8);
    }
  }

  drawFire(col, row, px, py, ts) {
    const g  = this.tileGfx;
    const cx = px + ts / 2;
    const cy = py + ts / 2;

    // Hot floor glow — deep red base
    g.fillStyle(0x2a0800, 1);
    g.fillRect(px + 2, py + 2, ts - 4, ts - 4);
    // Inner orange ember glow
    g.fillStyle(0xff4400, 0.4);
    g.fillRect(px + 8, py + ts / 2, ts - 16, ts / 2 - 4);

    // Fire emoji with animated pulse
    const fireKey = `fire_${col}_${row}`;
    const existing = this.entityPool[fireKey];
    if (existing) return; // already created — don't recreate each frame

    const txt = this.add.text(cx, cy + 2, '🔥', { fontSize: '28px' });
    txt.setOrigin(0.5, 0.5);
    txt.setDepth(4);
    this.entityPool[fireKey] = txt;

    // Pulse: scale breathes between 0.85 and 1.15, slight y bob
    this.tweens.add({
      targets: txt,
      scaleX: { from: 0.85, to: 1.15 },
      scaleY: { from: 0.9,  to: 1.1  },
      y:      { from: cy + 4, to: cy - 2 },
      duration: 550,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      // Offset each fire tile slightly so they don't all pulse in sync
      delay: (col * 137 + row * 79) % 500,
    });
  }

  // ── Draw entities (player, bugs, items) ───────────────────
  drawEntities(state) {
    // Player
    this.spawnEntity('player', state.player.x, state.player.y, '🤖', {
      fontSize: '28px', alpha: 1
    });

    // Bugs
    state.bugs.forEach(bug => {
      if (bug.alive) {
        if (bug.maxHp >= 5) {
          this.spawnImageEntity(bug.id, bug.x, bug.y, 'boss', this.tileSize - 8);
        } else {
          const emoji = bug.maxHp > 1 ? '🐛' : '🦗';
          const size  = bug.maxHp > 1 ? '26px' : '24px';
          this.spawnEntity(bug.id, bug.x, bug.y, emoji, { fontSize: size });
        }
        // HP bar above bug
        this.drawHpBar(bug.id, bug.x, bug.y, bug.hp, bug.maxHp);
      }
    });

    // Items
    state.items.forEach(item => {
      if (!item.collected) {
        let emoji = '❓';
        if (item.type === 'key')             emoji = '🔑';
        if (item.type === 'weapon_debugger') emoji = '🔧';
        if (item.type === 'weapon_compiler') emoji = '⚡';
        this.spawnEntity(item.id, item.x, item.y, emoji, { fontSize: '24px' });
      }
    });

    // Doors
    state.doors.forEach(door => {
      const key = `door_sprite_${door.id}`;
      if (!door.open) {
        this.spawnEntity(key, door.x, door.y, '🚪', { fontSize: '28px' });
      }
    });
  }

  // ── Entity management ─────────────────────────────────────
  spawnEntity(id, tileX, tileY, emoji, style = {}) {
    const px = tileX * this.tileSize + this.tileSize / 2;
    const py = tileY * this.tileSize + this.tileSize / 2;

    if (this.entityPool[id]) {
      const e = this.entityPool[id];
      e.setText(emoji);
      e.setPosition(px, py);
      e.setVisible(true);
      return e;
    }

    const txtStyle = Object.assign({
      fontSize: '26px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }, style);

    const t = this.add.text(px, py, emoji, txtStyle);
    t.setOrigin(0.5, 0.5);
    t.setDepth(5);
    this.entityPool[id] = t;
    return t;
  }

  spawnImageEntity(id, tileX, tileY, textureKey, fitSize) {
    const px = tileX * this.tileSize + this.tileSize / 2;
    const py = tileY * this.tileSize + this.tileSize / 2;

    if (this.entityPool[id]) {
      const e = this.entityPool[id];
      e.setPosition(px, py);
      e.setVisible(true);
      return e;
    }

    const img = this.add.image(px, py, textureKey);
    img.setOrigin(0.5, 0.5);
    img.setDepth(5);
    // Scale to fit within the tile
    const scale = fitSize / Math.max(img.width, img.height);
    img.setScale(scale);
    this.entityPool[id] = img;
    return img;
  }

  addEntityText(id, px, py, emoji, style = {}) {
    const txtStyle = Object.assign({ fontSize: '20px', color: '#ffffff' }, style);
    const t = this.add.text(px, py, emoji, txtStyle);
    t.setOrigin(0.5, 0.5);
    t.setDepth(4);
    this.entityPool[id] = t;
    return t;
  }

  clearEntities() {
    Object.values(this.entityPool).forEach(e => e.destroy());
    this.entityPool = {};
    this.particles.forEach(p => p.destroy());
    this.particles = [];
    this.tileGfx.clear();
    this.fxGfx.clear();
  }

  // ── HP bar (above bug) ────────────────────────────────────
  drawHpBar(bugId, tileX, tileY, hp, maxHp) {
    const barKey = `hpbar_${bugId}`;
    if (this.entityPool[barKey]) this.entityPool[barKey].destroy();

    const px = tileX * this.tileSize + 6;
    const py = tileY * this.tileSize + 4;
    const w  = this.tileSize - 12;
    const h  = 4;

    const gfx = this.add.graphics();
    gfx.fillStyle(0x440000, 1);
    gfx.fillRect(px, py, w, h);
    const ratio = hp / maxHp;
    const color = ratio > 0.6 ? 0x00ff9f : ratio > 0.3 ? 0xffd700 : 0xff3355;
    gfx.fillStyle(color, 1);
    gfx.fillRect(px, py, Math.round(w * ratio), h);
    gfx.setDepth(6);

    this.entityPool[barKey] = gfx;
  }

  updateHpBar(bugId, hp, maxHp) {
    // Find bug position from state and redraw
    const bug = GameState.bugs.find(b => b.id === bugId);
    if (bug) this.drawHpBar(bugId, bug.x, bug.y, hp, maxHp);
  }

  // ── Animations ────────────────────────────────────────────

  // Smooth tile-by-tile move
  animateMove(entityId, toTileX, toTileY, durationMs = 200) {
    return new Promise(resolve => {
      const sprite = this.entityPool[entityId];
      if (!sprite) { resolve(); return; }
      const tx = toTileX * this.tileSize + this.tileSize / 2;
      const ty = toTileY * this.tileSize + this.tileSize / 2;
      this.tweens.add({
        targets: sprite,
        x: tx, y: ty,
        duration: durationMs,
        ease: 'Power2',
        onComplete: () => resolve(),
      });
    });
  }

  // Bonk into wall — quick shake
  animateBonk(entityId, dirX, dirY, durationMs = 250) {
    return new Promise(resolve => {
      const sprite = this.entityPool[entityId];
      if (!sprite) { resolve(); return; }
      const ox = sprite.x;
      const oy = sprite.y;
      const offset = 12;
      this.tweens.add({
        targets: sprite,
        x: ox + dirX * offset,
        y: oy + dirY * offset,
        duration: durationMs / 3,
        ease: 'Power1',
        yoyo: true,
        onComplete: () => {
          sprite.setPosition(ox, oy);
          resolve();
        },
      });
    });
  }

  // Attack slash effect
  animateAttack(attackerEntityId, targetTileX, targetTileY, hit, durationMs = 300) {
    return new Promise(resolve => {
      const tx = targetTileX * this.tileSize + this.tileSize / 2;
      const ty = targetTileY * this.tileSize + this.tileSize / 2;

      const slash = this.add.text(tx, ty, hit ? '💥' : '💨', {
        fontSize: '28px',
      });
      slash.setOrigin(0.5, 0.5);
      slash.setDepth(20);

      this.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 1.8,
        y: ty - 20,
        duration: durationMs,
        ease: 'Power2',
        onComplete: () => { slash.destroy(); resolve(); },
      });
    });
  }

  // Float-up "BONK!", "MISS!", damage numbers
  showFloater(tileX, tileY, text, color = '#ff3355') {
    const px = tileX * this.tileSize + this.tileSize / 2;
    const py = tileY * this.tileSize + 4;

    const t = this.add.text(px, py, text, {
      fontSize: '14px',
      fontFamily: "'Press Start 2P', monospace",
      color: color,
    });
    t.setOrigin(0.5, 1);
    t.setDepth(30);
    this.particles.push(t);

    this.tweens.add({
      targets: t,
      y: py - 36,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => { t.destroy(); },
    });
  }

  // Flash a tile (for damage, collection, etc.)
  flashTile(tileX, tileY, color = 0xffd700, durationMs = 300) {
    const px = tileX * this.tileSize;
    const py = tileY * this.tileSize;
    const ts = this.tileSize;
    const g  = this.fxGfx;

    g.fillStyle(color, 0.4);
    g.fillRect(px, py, ts, ts);

    this.time.delayedCall(durationMs, () => { g.clear(); });
  }

  // Remove (hide) an entity sprite
  removeEntity(id) {
    const e = this.entityPool[id];
    if (e) {
      this.tweens.add({
        targets: e,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 200,
        onComplete: () => { e.destroy(); delete this.entityPool[id]; },
      });
    }
    // Also remove HP bar
    const hpKey = `hpbar_${id}`;
    if (this.entityPool[hpKey]) {
      this.entityPool[hpKey].destroy();
      delete this.entityPool[hpKey];
    }
  }

  // Open a door — redraw tile and remove door sprite
  openDoor(doorId, tileX, tileY) {
    // Re-draw the tile as floor
    const g  = this.tileGfx;
    const ts = this.tileSize;
    const px = tileX * ts;
    const py = tileY * ts;
    this.drawFloor(g, px, py, ts);

    // Remove door sprite
    const key = `door_sprite_${doorId}`;
    this.removeEntity(key);
    this.showFloater(tileX, tileY, 'OPEN!', '#00ff9f');
  }

  // Collect an item — show sparkle and remove
  collectItem(itemId, tileX, tileY) {
    this.removeEntity(itemId);
    this.flashTile(tileX, tileY, 0xffd700, 400);
    this.showFloater(tileX, tileY, 'GOT IT!', '#ffd700');
  }

  // Player takes damage flash
  playerHurt() {
    const sprite = this.entityPool['player'];
    if (!sprite) return;
    this.tweens.add({
      targets: sprite,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 3,
    });
  }
}
