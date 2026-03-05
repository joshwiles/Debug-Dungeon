// ============================================================
// DEBUG DUNGEON — Level Definitions
// ============================================================
// Map characters:
//   #  = wall
//   .  = floor
//   P  = player start (becomes floor)
//   E  = exit portal
//   B  = bug (1 HP default)
//   b  = bug (2 HP)
//   K  = key (auto-picked up, stored in variables)
//   D  = locked door (opens when keys > 0)
//   1  = debugger weapon (1 damage)
//   2  = compiler weapon (2 damage)
//   C  = crystal (optional collectible)
//   X  = boss bug (5 HP)

/* global LEVELS */

const LEVELS = [

  // ──────────────────────────────────────────────────────────
  // LEVEL 1: Boot Sequence — Linear Flow
  // ──────────────────────────────────────────────────────────
  {
    id: 1,
    name: 'Boot Sequence',
    concept: 'LINEAR FLOW',
    conceptDesc: 'Commands run from TOP to BOTTOM, one at a time, in order.',
    map: [
      '##########',
      '##########',
      '#P....E..#',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 6,
    objective: 'Move your agent to the EXIT (E) to boot up the system!',
    hint: '💡 Commands run top to bottom. Drag MOVE blocks into the queue.',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down'],
    winCondition: 'exit',
    introMessage: 'Welcome, Debug Agent! Your first mission: reach the EXIT. Build a sequence of commands and hit RUN.',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 2: First Contact — Sequence + Attack
  // ──────────────────────────────────────────────────────────
  {
    id: 2,
    name: 'First Contact',
    concept: 'SEQUENCE',
    conceptDesc: 'Order matters! Attack too early and you miss. Wait too long and you get hit.',
    map: [
      '##########',
      '##########',
      '#P.B..E..#',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 7,
    objective: 'Defeat the bug (B), then reach the EXIT!',
    hint: '💡 ATTACK hits whatever is in front of you. Get close first!',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down', 'attack'],
    winCondition: 'exit',
    introMessage: 'A BUG is blocking your path! Your ATTACK command hits whatever is one step in front of you. Move into range, then attack.',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 3: Memory Leak — Variables (Keys & Doors)
  // ──────────────────────────────────────────────────────────
  // Player(1,2) → right to Key(4,2) [keys=1] → right to Door(7,2)
  // Door opens → right to (8,2) → down to Exit(8,3)
  {
    id: 3,
    name: 'Memory Leak',
    concept: 'VARIABLES',
    conceptDesc: 'Variables store information. Picking up a key saves it to memory. Use it to open a door.',
    // Fire tile 'F' sits below the door at (7,3).
    // Player path: RIGHT×3 (key) → RIGHT×3 (door opens) → RIGHT (8,2) → DOWN (exit 8,3).
    // Stepping DOWN from door (7,2) to (7,3) walks into fire — -1 HP!
    map: [
      '##########',
      '##########',
      '#P..K..D.#',
      '#......FE#',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 16,
    objective: 'Find the KEY (🔑), unlock the DOOR (🚪), reach the EXIT!',
    hint: '💡 Picking up a key automatically stores it: keys = 1. The door opens when keys > 0.',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down'],
    winCondition: 'exit',
    introMessage: 'NEW CONCEPT: VARIABLES! When you pick up the key, it\'s stored in your Memory Bank. The door reads that variable to decide if it opens.',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 4: Data Corruption — Variables (Set/Use)
  // ──────────────────────────────────────────────────────────
  // Player(1,2). Armored bug(4,2) has 2 HP. Exit at (7,2).
  // With default weapon (1 dmg): MOVE×3, ATTACK, ATTACK, MOVE×3 = 8 blocks
  //   but player gets counter-attacked after 1st hit (bug still alive)
  // With SET weapon=compiler (2 dmg): SET, MOVE×3, ATTACK (kill!), MOVE×3 = 8 blocks
  //   no counter-attack — clean kill in 1 hit. Lesson: variable value matters!
  {
    id: 4,
    name: 'Data Corruption',
    concept: 'VARIABLES: SET & USE',
    conceptDesc: 'You can SET a variable to any value. Different values lead to different outcomes!',
    map: [
      '##########',
      '##########',
      '#P..b..E.#',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 9,
    objective: 'Defeat the armored bug (2 HP) and reach the EXIT!',
    hint: '💡 SET weapon = compiler for 2 damage — one-hit kill! Default weapon only does 1 damage.',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down', 'attack', 'set_weapon'],
    winCondition: 'exit',
    introMessage: 'NEW CONCEPT: SET! Use SET WEAPON = COMPILER to choose a powerful weapon. The armored bug takes 2 hits with a weak weapon — or 1 hit with the right one!',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 5: The Loop Lair — For Loops (repeat N times)
  // ──────────────────────────────────────────────────────────
  // Player(1,1) facing RIGHT. Bugs at (3,1),(5,1),(7,1). Exit at (8,1).
  //
  // Without loop (10 blocks): ATTACK RIGHT RIGHT ATTACK RIGHT RIGHT ATTACK RIGHT RIGHT RIGHT
  // With loop (5 blocks):     repeat 3 times:[attack, RIGHT, RIGHT]  +  RIGHT
  //   → attack(3,1)[kill], RIGHT(3,1), RIGHT(4,1)
  //   → attack(5,1)[kill], RIGHT(5,1), RIGHT(6,1)
  //   → attack(7,1)[kill], RIGHT(7,1)  ← wait, one more RIGHT needed
  // Actually: repeat 3:[attack, RIGHT, RIGHT] = 10 flattened steps, ends at (7,1)
  //           + 1 RIGHT reaches (8,1) = exit. Total: 5 blocks!
  {
    id: 5,
    name: 'Loop Lair',
    concept: 'FOR LOOP',
    conceptDesc: 'repeat N times runs the same commands over and over — no copying needed!',
    // Layout: Player(1,1) adjacent to Bug1(2,1). Bug2(4,1). Bug3(6,1). Exit(8,1).
    // Solution: repeat 3:[attack, RIGHT, RIGHT] + RIGHT = 5 blocks ✓
    // Without loop: attack RIGHT RIGHT attack RIGHT RIGHT attack RIGHT RIGHT RIGHT = 10 blocks ✗
    map: [
      '##########',
      '#PB.B.B.E#',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 6,
    objective: 'Defeat ALL 3 BUGS and reach the EXIT! Block limit: 6.',
    hint: '💡 ATTACK, RIGHT, RIGHT — repeated 3 times! Put [attack, move RIGHT, move RIGHT] inside a REPEAT 3 TIMES block.',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down', 'attack', 'repeat'],
    winCondition: 'exit_and_kill_all',
    introMessage: 'NEW CONCEPT: FOR LOOP! You need 10 commands but only have 6 slots. You CAN\'T write every command — use REPEAT N TIMES and place the repeating steps inside the loop body!',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 6: Infinite Glitch — While Loops
  // ──────────────────────────────────────────────────────────
  // Player(1,2). Boss bug(b = 2HP) at (3,2). Exit at (7,2).
  // With WHILE: RIGHT RIGHT + WHILE[attack] + RIGHT×4 — loop stops auto when bug dies!
  // Without WHILE: you must write attack twice (manual count). But what if HP changes?
  {
    id: 6,
    name: 'Infinite Glitch',
    concept: 'WHILE LOOP',
    conceptDesc: 'while bug alive: keeps attacking until the bug dies — you don\'t need to count the hits!',
    map: [
      '##########',
      '##########',
      '#P.b...E.#',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 10,
    objective: 'Defeat the armored boss bug (2 HP) and reach the EXIT!',
    hint: '💡 Use WHILE BUG ALIVE: attack — it keeps attacking until the bug is dead, however many hits it takes!',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down', 'attack', 'repeat', 'while_bug_alive'],
    winCondition: 'exit',
    introMessage: 'NEW CONCEPT: WHILE LOOP! A for-loop runs N times exactly. A while loop runs UNTIL a condition is false. Great for when you don\'t know the count ahead of time!',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 7: Function Junction — Functions / Subroutines
  // ──────────────────────────────────────────────────────────
  // Player(1,1). Bugs at (2,1),(4,1),(6,1). Exit at (8,1).
  // Pattern per bug: attack, RIGHT, RIGHT (same as level 5!)
  // With DEFINE+CALL:
  //   define step: [attack, RIGHT, RIGHT]  → 3 blocks
  //   call step × 3                        → 3 blocks
  //   RIGHT to exit                        → 1 block
  //   Total: 7 blocks
  // With repeat (if remembered): 5 blocks — but DEFINE teaches reuse concept
  // Without any looping: 10 blocks (too many for limit 8)
  {
    id: 7,
    name: 'Function Junction',
    concept: 'FUNCTIONS',
    conceptDesc: 'Define a function once, call it many times. Write code once, reuse it everywhere!',
    map: [
      '##########',
      '#PB.B.B.E#',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
      '##########',
    ],
    blockLimit: 8,
    objective: 'Defeat ALL 3 BUGS and reach the EXIT! Use DEFINE + CALL to reuse your code.',
    hint: '💡 Define a function "step" as [attack, RIGHT, RIGHT]. Then call it 3 times!',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down', 'attack', 'repeat', 'define_func', 'call_func'],
    winCondition: 'exit_and_kill_all',
    introMessage: 'NEW CONCEPT: FUNCTIONS! Notice the pattern repeating? DEFINE it once as a named function, then CALL it whenever needed. Write once, run many times!',
  },

  // ──────────────────────────────────────────────────────────
  // LEVEL 8: Boss Battle — Synthesis (all concepts)
  // ──────────────────────────────────────────────────────────
  // Player(1,1). Key(3,1). Door(5,1). Compiler(6,1).
  // Bug 2HP at (6,4), Bug 2HP at (6,5). Boss 5HP at (6,6). Exit(8,6).
  //
  // Optimal (12 blocks):
  //   REPEAT 5:[RIGHT] → get key, open door, get compiler
  //   REPEAT 2:[DOWN]  → buffer rows, face DOWN
  //   REPEAT 2:[ATTACK, DOWN] → kill both 2HP minions
  //   WHILE bug_alive:[ATTACK] → 3 hits to kill 5HP boss
  //   DOWN → onto boss tile
  //   REPEAT 2:[RIGHT] → reach EXIT
  {
    id: 8,
    name: 'Boss Battle',
    concept: 'SYNTHESIS',
    conceptDesc: 'Combine everything you\'ve learned: variables, loops, functions, and strategy to defeat the final boss!',
    map: [
      '##########',
      '#P.K..2..#',
      '#........#',
      '#........#',
      '#........#',
      '#.....####',
      '#....DX.E#',
      '##########',
    ],
    blockLimit: 14,
    objective: 'Collect the KEY, grab the COMPILER, defeat ALL bugs and the BOSS, then reach the EXIT!',
    hint: '💡 Use REPEAT to move efficiently. Use WHILE BUG ALIVE to defeat the boss — you don\'t know exactly how many hits it takes!',
    availableBlocks: ['move_right', 'move_left', 'move_up', 'move_down', 'attack', 'repeat', 'set_weapon', 'while_bug_alive', 'define_func', 'call_func'],
    winCondition: 'exit_and_kill_all',
    introMessage: 'FINAL CHALLENGE! The dungeon boss awaits. You\'ll need EVERYTHING you\'ve learned — keys, weapons, loops, and strategy. Grab the compiler for extra damage, clear the minions, and take down the boss!',
  },
];

// ──────────────────────────────────────────────────────────
// Block type definitions (shared config for palette + engine)
// ──────────────────────────────────────────────────────────
const BLOCK_DEFS = {
  move_right: {
    type: 'move', direction: 'RIGHT',
    label: 'move RIGHT', cssClass: 'block-move',
    description: 'Move one step to the right',
  },
  move_left: {
    type: 'move', direction: 'LEFT',
    label: 'move LEFT', cssClass: 'block-move',
    description: 'Move one step to the left',
  },
  move_up: {
    type: 'move', direction: 'UP',
    label: 'move UP', cssClass: 'block-move',
    description: 'Move one step up',
  },
  move_down: {
    type: 'move', direction: 'DOWN',
    label: 'move DOWN', cssClass: 'block-move',
    description: 'Move one step down',
  },
  attack: {
    type: 'attack', direction: 'FORWARD',
    label: 'attack FORWARD', cssClass: 'block-attack',
    description: 'Attack whatever is in front of you',
  },
  repeat: {
    type: 'repeat', count: 3, body: [],
    label: 'repeat __ times:', cssClass: 'block-repeat',
    description: 'Repeat the commands inside N times',
  },
  set_weapon: {
    type: 'set', variable: 'weapon', value: 'compiler',
    label: 'set weapon = compiler', cssClass: 'block-set',
    description: 'Set the weapon variable',
  },
  while_bug_alive: {
    type: 'while', condition: 'bug_alive', body: [],
    label: 'while bug alive:', cssClass: 'block-while',
    description: 'Keep running while any bug is alive',
  },
  define_func: {
    type: 'define', name: 'myFunc', body: [],
    label: 'define myFunc:', cssClass: 'block-define',
    description: 'Define a reusable function',
  },
  call_func: {
    type: 'call', name: 'myFunc',
    label: 'call myFunc', cssClass: 'block-call',
    description: 'Call a previously defined function',
  },
};

// Direction vectors
const DIR_VECTORS = {
  RIGHT: { dx: 1,  dy: 0 },
  LEFT:  { dx: -1, dy: 0 },
  UP:    { dx: 0,  dy: -1 },
  DOWN:  { dx: 0,  dy: 1 },
};
