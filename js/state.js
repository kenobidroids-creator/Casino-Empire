// ═══════════════════════════════════════════════
//  state.js — Single mutable game state object
// ═══════════════════════════════════════════════

const G = {
  // Economy
  money:        5000,
  totalEarned:  0,

  // Time
  day:          1,
  speed:        1,
  dayTimer:     0,
  dayLen:       240000,   // ms real-time per in-game day

  // Entities
  machines:     [],       // { id, type, tx, ty, upgrades, occupied, totalEarned }
  patrons:      [],       // patron objects
  nextMid:      1,
  nextPid:      1,

  // Cashier
  cashierQueue:   [],     // patron ids waiting at cashier window
  cashierServing: null,   // patron object currently being served
  payTray:        [],     // array of numeric denomination values in tray

  // Camera
  camera: { x: 0, y: 0 },

  // UI state
  selectedMid:  null,
  dragging:     null,     // { type } while hotbar item is being dragged
  deleteMode:   false,

  // Revenue tracking (per-minute rolling window)
  revBucket:    [],       // [{ t: timestamp, v: amount }]

  // Spawn timing
  spawnCooldown: 7000,
  spawnAcc:      0,

  // Autosave
  autosaveAcc:  0,
};
