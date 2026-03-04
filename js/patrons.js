// ═══════════════════════════════════════════════
//  patrons.js — Patron AI: spawn, move, play, pay
// ═══════════════════════════════════════════════

function spawnPatron() {
  if (G.patrons.length >= 25) return;

  const slots = G.machines.filter(m => MACHINE_DEFS[m.type].isSlot && m.occupied == null);
  if (slots.length === 0) return;

  const wp   = tile2world(ENT_TX, ENT_TY);
  const name = PATRON_NAMES[Math.floor(Math.random() * PATRON_NAMES.length)];

  const p = {
    id:           G.nextPid++,
    name,
    color:        PATRON_COLORS[Math.floor(Math.random() * PATRON_COLORS.length)],
    wx:           wp.x + TILE / 2,
    wy:           wp.y + TILE / 2 + TILE * 1.2,   // start just outside entrance
    state:        'ENTERING',
    targetX:      wp.x + TILE / 2,
    targetY:      wp.y + TILE / 2,
    speed:        55 + Math.random() * 45,
    machineId:    null,
    ticketValue:  0,
    ticketPaid:   false,
    budget:       15 + Math.random() * 85,
    playTimer:    0,
    spinInterval: 0,
    spinsLeft:    0,
    _won:         false,
    _kioskTimer:  0,
    _kioskId:     null,
    _cashierId:   null
  };

  G.patrons.push(p);
}

// ── Assign nearest free slot ─────────────────
function assignMachine(p) {
  const slots = G.machines.filter(m => MACHINE_DEFS[m.type].isSlot && m.occupied == null);
  if (slots.length === 0) { kickOut(p); return; }

  let best = null, bestDist = Infinity;
  for (const m of slots) {
    const wp = tile2world(m.tx, m.ty);
    const dx = wp.x + TILE / 2 - p.wx;
    const dy = wp.y + TILE / 2 - p.wy;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { best = m; bestDist = d; }
  }

  best.occupied = p.id;
  p.machineId   = best.id;
  p.state       = 'WALKING_TO_MACHINE';
  const wp      = tile2world(best.tx, best.ty);
  p.targetX     = wp.x + TILE / 2;
  p.targetY     = wp.y + TILE / 2;
}

// ── Begin playing at machine ─────────────────
function startPlaying(p) {
  p.state = 'PLAYING';
  const m = G.machines.find(m => m.id === p.machineId);
  if (!m) { kickOut(p); return; }

  const def      = MACHINE_DEFS[m.type];
  const speedLv  = m.upgrades.speed || 0;
  p.spinInterval = def.playTime * (1 - speedLv * 0.18);
  p.spinsLeft    = 3 + Math.floor(Math.random() * 7);
  p.playTimer    = 0;
  p._won         = false;
}

// ── Execute one spin ─────────────────────────
function doSpin(p) {
  const m = G.machines.find(m => m.id === p.machineId);
  if (!m) return;

  const def     = MACHINE_DEFS[m.type];
  const betMult = 1 + (m.upgrades.bet || 0) * 0.25;
  const bet     = (def.betMin + Math.random() * (def.betMax - def.betMin)) * betMult;

  if (p.budget < bet) { p.spinsLeft = 0; return; }
  p.budget -= bet;

  // Player collects the bet immediately
  G.money        += bet;
  G.totalEarned  += bet;
  m.totalEarned   = (m.totalEarned || 0) + bet;
  trackRev(bet);

  m._flash    = Date.now();
  m._flashTxt = '+$' + bet.toFixed(2);

  // RNG win check
  const luckBonus = (m.upgrades.luck || 0) * 0.02;
  const winRate   = def.winRate + luckBonus;
  if (Math.random() < winRate) {
    const mult    = def.winMultMin + Math.random() * (def.winMultMax - def.winMultMin);
    const payout  = parseFloat((bet * mult).toFixed(2));
    p.ticketValue = parseFloat((p.ticketValue + payout).toFixed(2));
    p._won        = true;
    spawnEarnFloat(p.wx, p.wy - 16, 'WIN $' + payout.toFixed(2), '#f0d060');
  }
}

// ── Patron leaves machine ────────────────────
function finishPlaying(p) {
  const m = G.machines.find(m => m.id === p.machineId);
  if (m) m.occupied = null;
  p.machineId = null;

  if (p.ticketValue > 0) routeToPayment(p);
  else                   kickOut(p);
}

// ── Route patron to kiosk or cashier ─────────
function routeToPayment(p) {
  const kiosk   = G.machines.find(m => m.type === 'kiosk');
  const cashier = G.machines.find(m => m.type === 'cashier');

  if (kiosk && (!cashier || Math.random() < 0.55)) {
    p.state    = 'WALKING_TO_KIOSK';
    const wp   = tile2world(kiosk.tx, kiosk.ty);
    p.targetX  = wp.x + TILE / 2;
    p.targetY  = wp.y + TILE + 8;
    p._kioskId = kiosk.id;
  } else if (cashier) {
    p.state      = 'WALKING_TO_CASHIER';
    const wp     = tile2world(cashier.tx, cashier.ty);
    p.targetX    = wp.x + TILE;
    p.targetY    = wp.y + TILE + 8;
    p._cashierId = cashier.id;
  } else {
    spawnEarnFloat(p.wx, p.wy - 16, 'Need cashier!', '#e07070');
    kickOut(p);
  }
}

function kickOut(p) {
  p.state   = 'LEAVING';
  const wp  = tile2world(ENT_TX, ENT_TY);
  p.targetX = wp.x + TILE / 2;
  p.targetY = wp.y + TILE * 2.5;
}

// ── Per-frame patron update ──────────────────
function updatePatron(p, dt) {
  switch (p.state) {
    case 'ENTERING':
    case 'WALKING_TO_MACHINE':
    case 'WALKING_TO_CASHIER':
    case 'WALKING_TO_KIOSK':
    case 'LEAVING':
      movePatron(p, dt);
      break;

    case 'PLAYING':
      p.playTimer += dt;
      if (p.spinsLeft > 0 && p.playTimer >= p.spinInterval) {
        p.playTimer -= p.spinInterval;
        p.spinsLeft--;
        doSpin(p);
      }
      if (p.spinsLeft <= 0) finishPlaying(p);
      break;

    case 'WAITING_CASHIER':
      // idle — cashier panel handles dismissal
      break;

    case 'WAITING_KIOSK':
      p._kioskTimer -= dt;
      if (p._kioskTimer <= 0) {
        // Kiosk auto-pays — deduct from player balance
        G.money -= p.ticketValue;
        spawnEarnFloat(p.wx, p.wy - 16, '-$' + p.ticketValue.toFixed(2) + ' kiosk', '#e08060');
        p.ticketPaid  = true;
        p.ticketValue = 0;
        kickOut(p);
      }
      break;

    case 'PAID':
      p.ticketPaid  = true;
      p.ticketValue = 0;
      kickOut(p);
      break;
  }
}

// ── Linear movement toward target ────────────
function movePatron(p, dt) {
  const dx   = p.targetX - p.wx;
  const dy   = p.targetY - p.wy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = p.speed * dt / 1000;

  if (dist <= step + 0.5) {
    p.wx = p.targetX;
    p.wy = p.targetY;
    onPatronArrival(p);
  } else {
    p.wx += (dx / dist) * step;
    p.wy += (dy / dist) * step;
  }
}

// ── State transitions on arrival ─────────────
function onPatronArrival(p) {
  switch (p.state) {
    case 'ENTERING':
      assignMachine(p);
      break;

    case 'WALKING_TO_MACHINE':
      startPlaying(p);
      break;

    case 'WALKING_TO_CASHIER':
      p.state = 'WAITING_CASHIER';
      if (!G.cashierQueue.includes(p.id)) G.cashierQueue.push(p.id);
      updateCashierAlert();
      break;

    case 'WALKING_TO_KIOSK':
      p.state       = 'WAITING_KIOSK';
      p._kioskTimer = 2200;
      break;

    case 'LEAVING':
      G.patrons = G.patrons.filter(x => x.id !== p.id);
      break;
  }
}
