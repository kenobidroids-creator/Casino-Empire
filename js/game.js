// ═══════════════════════════════════════════════
//  game.js — Main loop, HUD, save/load, init
// ═══════════════════════════════════════════════

// ── Revenue tracking (rolling 60s window) ────
function trackRev(v) {
  G.revBucket.push({ t: Date.now(), v });
}

function calcRevPerMin() {
  const now  = Date.now();
  G.revBucket = G.revBucket.filter(r => now - r.t < 60000);
  return G.revBucket.reduce((s, r) => s + r.v, 0);
}

// ── HUD refresh ───────────────────────────────
function updateHUD() {
  document.getElementById('h-money').textContent = '$' + Math.floor(G.money).toLocaleString();
  document.getElementById('h-rev').textContent   = '$' + Math.floor(calcRevPerMin()).toLocaleString();
  document.getElementById('h-pat').textContent   = G.patrons.length;
  document.getElementById('h-day').textContent   = G.day;
  updateHotbarAfford();
}

// ── Toast notifications ───────────────────────
function toast(msg, cls = '') {
  const container = document.getElementById('toasts');
  const el        = document.createElement('div');
  el.className    = 'toast' + (cls ? ' ' + cls : '');
  el.textContent  = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

// ══════════════════════════════════════════════
//  Save / Load
// ══════════════════════════════════════════════
function saveGame() {
  try {
    const payload = {
      v:            3,
      money:        G.money,
      totalEarned:  G.totalEarned,
      day:          G.day,
      speed:        G.speed,
      nextMid:      G.nextMid,
      machines:     G.machines.map(m => ({
        id:           m.id,
        type:         m.type,
        tx:           m.tx,
        ty:           m.ty,
        upgrades:     m.upgrades,
        totalEarned:  m.totalEarned || 0
      }))
    };
    localStorage.setItem('casinoEmpire', JSON.stringify(payload));

    const now = new Date();
    document.getElementById('save-lbl').textContent =
      'Saved ' + now.toLocaleTimeString();
  } catch (e) {
    toast('Save failed!', 'r');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem('casinoEmpire');
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || d.v < 1) return false;

    G.money       = d.money        || 5000;
    G.totalEarned = d.totalEarned  || 0;
    G.day         = d.day          || 1;
    G.speed       = d.speed        || 1;
    G.nextMid     = d.nextMid      || 1;

    G.machines = (d.machines || []).map(m => ({
      ...m,
      occupied:    null,
      upgrades:    m.upgrades || { speed: 0, luck: 0, bet: 0 },
      totalEarned: m.totalEarned || 0
    }));

    return true;
  } catch (e) {
    return false;
  }
}

// ══════════════════════════════════════════════
//  Main game loop
// ══════════════════════════════════════════════
let lastTs  = 0;
let dayAcc  = 0;

function loop(ts) {
  const rawDt = ts - lastTs;
  lastTs      = ts;
  const dt    = Math.min(rawDt, 80) * G.speed;

  // Update all patrons
  for (const p of [...G.patrons]) updatePatron(p, dt);

  // Clean stale cashier queue entries
  G.cashierQueue = G.cashierQueue.filter(id =>
    G.patrons.some(p =>
      p.id === id &&
      (p.state === 'WAITING_CASHIER' || p.state === 'WALKING_TO_CASHIER')
    )
  );

  // Patron spawning
  G.spawnAcc += dt;
  const slotCount  = G.machines.filter(m => MACHINE_DEFS[m.type].isSlot).length;
  const spawnDelay = Math.max(2500, G.spawnCooldown / (1 + slotCount * 0.25));
  if (G.spawnAcc >= spawnDelay) {
    G.spawnAcc = 0;
    spawnPatron();
  }

  // Day cycle (uses raw dt — not speed-scaled — for realistic days)
  dayAcc += rawDt;
  if (dayAcc >= G.dayLen) {
    dayAcc = 0;
    G.day++;
    toast('Day ' + G.day + ' begins!');
  }

  // Autosave (30s real time)
  G.autosaveAcc += rawDt;
  if (G.autosaveAcc >= 30000) {
    G.autosaveAcc = 0;
    saveGame();
  }

  updateHUD();
  render();
  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════
function startGame() {
  document.getElementById('tutorial').style.display = 'none';

  const hadSave = loadGame();
  setSpd(G.speed);

  if (hadSave) toast('Welcome back! Casino loaded.', 'g');
  else         toast('Drag machines from the hotbar to start!');

  lastTs = performance.now();
  requestAnimationFrame(loop);
}

// ── Startup ───────────────────────────────────
window.addEventListener('resize', () => { resize(); clampCam(); });

resize();
buildHotbar();

// Center camera on the floor
G.camera.x = Math.round((canvas.width  - (FW + 2 * WALL) * TILE) / 2);
G.camera.y = Math.round((canvas.height - (FH + 2 * WALL) * TILE - 96) / 2);
clampCam();
