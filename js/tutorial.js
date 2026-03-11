// ═══════════════════════════════════════════
//  tutorial.js — Scripted sandbox tutorial
//  Completely separate from G state.
//  When done, T is discarded and a fresh G
//  is initialised for the real game.
// ═══════════════════════════════════════════

// ── Tutorial state ──────────────────────────
const T = {
  active: false,
  step: 0,       // current step index (0-based)
  elapsed: 0,    // ms since step started (real wall-clock)
  scriptAcc: 0,  // ms since tutorial started (real wall-clock)
  done: false,

  // Scripted patron
  patron: null,

  // Scripted machines
  slotMid: null,
  cashierMid: null,

  // Step trigger state
  _jackpotReady: false,
  _jackpotHandled: false,
  _cashierPaid: false,
  _dayEndClosed: false,
  _secondMachinePlaced: false,

  // Internal tick timing — always real wall-clock via Date.now()
  _lastTick: null,
  _postPayTimer: 0,
  _dayEndTriggered: false,
};

// ── Step definitions ────────────────────────
// Each step: { msg, icon, highlight, showNext, trigger }
// highlight: 'hotbar'|'cashier'|'jackpot'|'speed'|'dayend'|null
// showNext: show a manual "Got it!" button (step won't auto-advance)
// trigger: fn() -> true when step should auto-advance
const STEPS = [
  // 0 — Intro: manual advance only (no auto-timer)
  {
    msg: "Welcome to <strong>Casino Empire!</strong><br>This is your casino floor. Tap <strong>Got it!</strong> when you're ready to place your first machine.",
    icon: '🎰',
    highlight: null,
    showNext: true,
    trigger: () => false,
  },

  // 1 — Place first slot machine
  {
    msg: "Place a slot machine!<br>Tap <strong>🎰 Basic Slot</strong> in the hotbar, then tap any green floor tile to place it.<br><small style='color:rgba(232,216,160,.5)'>Changed your mind? Right-click or tap ✕ Cancel to deselect.</small>",
    icon: '👇',
    highlight: 'hotbar',
    showNext: false,
    trigger: () => T.slotMid !== null && !!G.machines.find(m => m.id === T.slotMid),
  },

  // 2 — Watch patron walk to machine — advance only once they're PLAYING
  {
    msg: "Nice! <strong>Lucky Lou</strong> is heading in. Watch them walk to your slot — no action needed yet.",
    icon: '👤',
    highlight: null,
    showNext: false,
    trigger: () => {
      const p = T.patron;
      // Also accept WAITING_JACKPOT in case jackpot fires before step advances
      return !!(p && (p.state === 'PLAYING' || p.state === 'WAITING_JACKPOT'));
    },
  },

  // 3 — Patron playing, jackpot incoming
  {
    msg: "The reels are spinning! Keep an eye on the machine — a big win is coming…",
    icon: '🎲',
    highlight: null,
    showNext: false,
    trigger: () => T._jackpotReady,
  },

  // 4 — Jackpot: tap flashing machine
  {
    msg: "🏆 <strong>JACKPOT!</strong> The machine is flashing gold.<br>Tap the flashing machine to hand-pay the winner!",
    icon: '🏆',
    highlight: 'jackpot',
    showNext: false,
    trigger: () => T._jackpotHandled,
  },

  // 5 — Pay at cashier
  {
    msg: "Lou is heading to your <strong>Cashier Window</strong>. Tap the notification on the left, then hit <strong>Auto Pay</strong>.",
    icon: '💰',
    highlight: 'cashier',
    showNext: false,
    trigger: () => T._cashierPaid,
  },

  // 6 — Day summary
  {
    msg: "Day's over! Check out your summary, then close it to start Day 2.",
    icon: '📊',
    highlight: 'dayend',
    showNext: false,
    trigger: () => T._dayEndClosed,
  },

  // 7 — Place second machine (any type)
  {
    msg: "You've got the hang of it! Place a <strong>second machine</strong> — any type from the hotbar counts.",
    icon: '🛒',
    highlight: 'hotbar',
    showNext: false,
    trigger: () => T._secondMachinePlaced,
  },

  // 8 — Speed controls
  {
    msg: "Last tip: the <strong>1x / 2x / 3x</strong> buttons top-left control game speed. Tap <strong>2x</strong> now!",
    icon: '⚡',
    highlight: 'speed',
    showNext: false,
    trigger: () => G.speed >= 2,
  },

  // 9 — Done
  {
    msg: "You're a natural! 🎉<br>Your real game starts now with a fresh $5,000 — good luck, boss!",
    icon: '🎉',
    highlight: null,
    showNext: true,
    trigger: () => false,
  },
];

// ── Overlay state ───────────────────────────
let _tutEl = null;

// ── Public entry points ─────────────────────

function tutorialShouldRun() {
  try { return !localStorage.getItem('tutorialSeen'); } catch(e) { return true; }
}

function tutorialMarkSeen() {
  try { localStorage.setItem('tutorialSeen','1'); } catch(e) {}
}

function startTutorial() {
  document.getElementById('tutorial').style.display = 'none';

  // Set up a safe tutorial G state
  G.money  = 2000;
  G.day    = 1;
  G.speed  = 1;
  // FIX: extremely long dayLen — day-end is ONLY triggered by our script,
  // never by accidentally running at 2x/3x speed.
  G.dayLen = 999999999;

  // Pre-place cashier at a fixed sensible position
  const cTx = Math.max(1, Math.floor(G.floorW/2) - 1);
  const cTy = Math.max(1, Math.floor(G.floorH/2) + 1);
  if(_tutPlaceFree('cashier', cTx, cTy)) {
    T.cashierMid = G.machines[G.machines.length-1].id;
  }

  T.active    = true;
  T.step      = 0;
  T.elapsed   = 0;
  T.scriptAcc = 0;
  T._lastTick = Date.now();

  _buildTutorialUI();
  _showStep(0);

  setSpd(1);
  saveTimestamp();
  lastTs = performance.now();
  requestAnimationFrame(loop);
}

// Place a machine for free (no money charge, no toast)
function _tutPlaceFree(type, tx, ty) {
  const def = MACHINE_DEFS[type];
  if(!def) return false;
  for(let dx=0;dx<def.w;dx++) for(let dy=0;dy<def.h;dy++)
    if(!validTile(tx+dx,ty+dy) || tileOccupied(tx+dx,ty+dy)) return false;
  G.machines.push({ id:G.nextMid++, type, tx, ty, rotation:0,
    upgrades:{speed:0,luck:0,bet:0}, occupied:null, totalEarned:0 });
  if(def.tableGame) initTableState(G.machines[G.machines.length-1]);
  return true;
}

// ── Per-frame tick ──────────────────────────
// CRITICAL FIX: uses Date.now() directly — never multiplied by G.speed.
// This means all tutorial timers are in real wall-clock seconds, completely
// independent of whether the player hits 1x, 2x, or 3x.
function tutorialTick() {
  if(!T.active || T.done) return;

  const now = Date.now();
  if(!T._lastTick) T._lastTick = now;
  const rawMs = Math.min(now - T._lastTick, 200); // cap at 200ms per frame
  T._lastTick = now;

  T.elapsed   += rawMs;
  T.scriptAcc += rawMs;

  const step = STEPS[T.step];
  if(!step) return;

  _runScript(T.scriptAcc, rawMs);

  // Only auto-trigger for steps that don't require manual button press
  if(!step.showNext && step.trigger && step.trigger()) {
    _advanceStep();
  }
}

// ── Scripted timeline (real wall-clock ms) ──
const _scriptFired = {};
function _runScript(acc, rawMs) {
  function once(id, ms, fn) {
    if(acc >= ms && !_scriptFired[id]) { _scriptFired[id]=true; fn(); }
  }

  // 15s real time — fire scripted jackpot
  once('jackpot', 15000, () => {
    const p = T.patron;
    const m = G.machines.find(m => m.id === T.slotMid);
    if(p && m) _fireScriptedJackpot(p, m);
  });

  // Poll every tick: once cashier is paid AND 5s have elapsed since pay,
  // force day-end. We don't use a fixed ms threshold because the cashier
  // step can take variable real time to complete.
  if(T._cashierPaid && !T._dayEndTriggered) {
    if(!T._postPayTimer) T._postPayTimer = 0;
    T._postPayTimer += rawMs; // rawMs is in scope from tutorialTick
    if(T._postPayTimer >= 4000) {
      T._dayEndTriggered = true;
      G.dayLen = G.dayAcc + 200; // fires in ~0.2s
    }
  }
}

function _spawnTutorialPatron() {
  const wp = tile2world(ENT_TX(), ENT_TY());
  const p = {
    id: G.nextPid++,
    name: 'Lucky Lou',
    color: '#e8c040',
    hairColor: '#3a2808',
    wx: wp.x+TILE/2, wy: wp.y+TILE/2+TILE*1.3,
    state: 'ENTERING',
    targetX: wp.x+TILE/2, targetY: wp.y+TILE/2,
    speed: 100,
    machineId: null, ticketValue: 0, ticketPaid: false,
    budget: 9999,
    isHighRoller: false,
    playTimer: 0, spinInterval: 0, spinsLeft: 9999, _won: false,
    wantsFood: false, foodState: null, eatTimer: 0,
    _kioskTimer: 0, _barId: null,
    visited: true,
    _spentTotal: 0, _wonTotal: 0,
    _machineVisits: {},
    _favMachine: null,
    _mood: 100,
    _waitTimer: 600000, _waitMax: 600000,
    _thought: null,
    _wanderTimer: 0,
    _isTutorialPatron: true,
  };
  G.dayStats.patronsVisited++;
  G.patrons.push(p);
  T.patron = p;
}

function _assignPatronToMachine(p, m) {
  if(m.occupied && m.occupied !== p.id) return;
  m.occupied = p.id;
  p.machineId = m.id;
  // Use getMachineFrontPos so the patron walks to the correct face of the machine,
  // matching how the normal assignMachine() positions them
  const fp = (typeof getMachineFrontPos === 'function')
    ? getMachineFrontPos(m)
    : { wx: tile2world(m.tx, m.ty).x + TILE/2, wy: tile2world(m.tx, m.ty).y + TILE/2 };
  p.targetX = fp.wx;
  p.targetY = fp.wy;
  p.state = 'WALKING_TO_MACHINE';
}

function _fireScriptedJackpot(p, m) {
  if(m.occupied && m.occupied !== p.id) return;
  // Ensure patron is linked to machine
  m.occupied = p.id;
  p.machineId = m.id;

  const amount = 250;
  p.ticketValue = amount;
  p.state = 'WAITING_JACKPOT';
  p.spinsLeft = 0;

  G.jackpots = G.jackpots.filter(j => j.patronId !== p.id);
  G.jackpots.push({ id: G.nextDropId++, machineId: m.id, patronId: p.id,
    amount, timer: 120000 });

  toast('🏆 JACKPOT! $'+amount.toFixed(2)+' — Tap the flashing machine!', 'g');
  T._jackpotReady = true;
  _setHighlight('jackpot');
}

// ── Game action hooks ───────────────────────

function tutorialOnMachinePlaced(m) {
  if(!T.active) return;
  const def = MACHINE_DEFS[m.type];

  // First slot placed by player: record it, exit placement mode, spawn patron
  if(def && def.isSlot && T.slotMid === null) {
    T.slotMid = m.id;

    // FIX: immediately deselect so the machine doesn't stay attached to cursor,
    // preventing the player from accidentally dropping more copies
    exitPlacementMode();

    // Short delay so placement animation settles before patron appears
    setTimeout(() => {
      _spawnTutorialPatron();
      // Then assign patron to machine after they've started walking in
      setTimeout(() => {
        const mm = G.machines.find(x => x.id === T.slotMid);
        if(T.patron && mm) _assignPatronToMachine(T.patron, mm);
      }, 1500);
    }, 500);
    return;
  }

  // Steps 2-6: if the player somehow places another slot while Lou is in transit,
  // don't let the game redirect her — she's locked to T.slotMid.
  // We also silently ignore extra machine placements during active tutorial steps.
  if(T.step >= 2 && T.step <= 6) {
    // Extra machine placed during the scripted sequence — remove it silently
    // so it can't steal Lou or break her walk path
    G.machines = G.machines.filter(x => x.id !== m.id);
    toast('Machines are locked during the walkthrough!', '');
    exitPlacementMode();
    return;
  }

  // Step 7: any new machine (not the pre-placed cashier or tutorial slot) counts
  if(T.step >= 7 && m.id !== T.cashierMid && m.id !== T.slotMid) {
    T._secondMachinePlaced = true;
    exitPlacementMode();
  }
}

function tutorialOnJackpotHandled() {
  if(!T.active) return;
  T._jackpotHandled = true;

  // Route tutorial patron to cashier
  const p = T.patron;
  if(p) {
    const cashier = G.machines.find(m => m.type === 'cashier');
    if(cashier) {
      p.ticketValue = 250;
      p.ticketPaid  = false;
      const wp = tile2world(cashier.tx, cashier.ty);
      p.targetX = wp.x + TILE;
      p.targetY = wp.y + TILE/2;
      p.state = 'WALKING_TO_CASHIER';
      if(!G.cashierQueue.includes(p.id)) G.cashierQueue.push(p.id);
      updateCashierAlert();
    }
  }
}

function tutorialOnCashierPaid() {
  if(!T.active) return;
  T._cashierPaid = true;
}

function tutorialOnDayEndClosed() {
  if(!T.active) return;
  T._dayEndClosed = true;
  // Reset dayLen so day doesn't immediately re-fire
  G.dayLen = 999999999;
  G.dayAcc = 0;
}

// ── Step management ─────────────────────────

function _advanceStep() {
  T.step++;
  T.elapsed = 0;
  if(T.step >= STEPS.length) { _finishTutorial(); return; }
  _showStep(T.step);
}

function _showStep(idx) {
  const step = STEPS[idx];
  if(!step) return;
  _updateTooltip(step);
  _setHighlight(step.highlight);
  _repositionBox(idx);
}

function _repositionBox(idx) {
  if(!_tutEl) return;
  // Steps 5 (cashier pay) and 6 (day-end) — move box to top so panels aren't obscured
  if(idx === 5 || idx === 6) {
    _tutEl.style.bottom = 'auto';
    _tutEl.style.top = '64px'; // just below HUD
  } else {
    _tutEl.style.top = 'auto';
    _tutEl.style.bottom = '160px';
  }
}

function _updateTooltip(step) {
  if(!_tutEl) return;
  const isLast = (T.step === STEPS.length - 1);
  const hasNext = step.showNext || isLast;

  _tutEl.querySelector('.tut-icon').textContent = step.icon || '💡';
  _tutEl.querySelector('.tut-msg').innerHTML = step.msg;
  _tutEl.querySelector('.tut-progress').textContent =
    'Step ' + (T.step + 1) + ' of ' + STEPS.length;

  const nextBtn = _tutEl.querySelector('.tut-next');
  nextBtn.style.display = hasNext ? 'inline-block' : 'none';
  nextBtn.textContent = isLast ? '🎰 Start My Casino!' : 'Got it!';

  _tutEl.classList.remove('tut-pulse');
  void _tutEl.offsetWidth;
  _tutEl.classList.add('tut-pulse');
}

function _setHighlight(type) {
  document.querySelectorAll('.tut-highlight-ring').forEach(el => el.remove());
  if(!type) return;

  const makeRing = (target) => {
    if(!target) return;
    const r = target.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'tut-highlight-ring';
    ring.style.cssText =
      'position:fixed;' +
      'left:'+(r.left-6)+'px;top:'+(r.top-6)+'px;' +
      'width:'+(r.width+12)+'px;height:'+(r.height+12)+'px;' +
      'border:3px solid #f0c840;border-radius:10px;' +
      'box-shadow:0 0 18px 4px rgba(240,200,64,.7),inset 0 0 8px rgba(240,200,64,.2);' +
      'pointer-events:none;z-index:9998;' +
      'animation:tutRingPulse 1s ease-in-out infinite;';
    document.body.appendChild(ring);
  };

  if(type === 'hotbar')  makeRing(document.getElementById('hotbar'));
  else if(type === 'cashier') {
    const notif = document.querySelector('#notif-rail .notif');
    makeRing(notif || document.getElementById('cashier-panel'));
  }
  else if(type === 'jackpot') {
    const jp = document.getElementById('jp-panel');
    if(jp && jp.style.display !== 'none') makeRing(jp);
  }
  else if(type === 'speed')  makeRing(document.getElementById('speed-group'));
  else if(type === 'dayend') makeRing(document.getElementById('day-end-modal'));
}

// ── Tutorial finish ─────────────────────────
function _finishTutorial() {
  T.active = false;
  T.done   = true;
  tutorialMarkSeen();

  _tutEl && _tutEl.remove();
  _tutEl = null;
  document.querySelectorAll('.tut-highlight-ring').forEach(el => el.remove());

  toast('🎉 Tutorial complete — starting your real casino!', 'g');

  setTimeout(() => {
    G.machines       = [];
    G.patrons        = [];
    G.jackpots       = [];
    G.cashierQueue   = [];
    G.cashierServing = null;
    G.droppedMoney   = [];
    G.money          = 5000;
    G.day            = 1;
    G.dayAcc         = 0;
    G.dayLen         = 240000;
    G.speed          = 1;
    G.dayStats       = { patronsVisited:0, moneyIn:0, moneyOut:0,
      wages:0, tips:0, foundMoney:0, jackpotsPaid:0 };
    ['cashier-panel','jp-panel','upgrade-panel','day-end-modal'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
    toast('Welcome to Casino Empire! Place your first machine to begin.', '');
    setSpd(1);
  }, 1200);
}

function tutorialSkip() { _finishTutorial(); }

// ── Build tutorial DOM ──────────────────────
function _buildTutorialUI() {
  const style = document.createElement('style');
  style.textContent = `
    #tut-box {
      position: fixed;
      /* FIX: raised above hotbar (~96px) AND place-cancel row (~44px)
         so the rotate/cancel buttons are never hidden behind the tooltip */
      bottom: 160px;
      left: 50%;
      transform: translateX(-50%);
      width: min(420px, 94vw);
      background: linear-gradient(135deg, #1a0e06ee, #2a1a08ee);
      border: 2px solid rgba(201,168,76,.6);
      border-radius: 16px;
      padding: 16px 18px 14px;
      z-index: 9999;
      box-shadow: 0 8px 40px rgba(0,0,0,.8), 0 0 24px rgba(201,168,76,.15);
      font-family: 'Rajdhani', sans-serif;
      color: #e8d8a0;
    }
    .tut-row { display:flex; align-items:flex-start; gap:12px; }
    .tut-icon { font-size:28px; line-height:1; flex-shrink:0; }
    .tut-msg  { font-size:14px; line-height:1.55; flex:1; }
    .tut-msg strong { color:#f0c840; }
    .tut-footer {
      display:flex; justify-content:space-between;
      align-items:center; margin-top:10px;
    }
    .tut-progress { font-size:11px; color:rgba(201,168,76,.5); }
    .tut-buttons  { display:flex; gap:8px; }
    .tut-next {
      background:linear-gradient(135deg,#5a3e06,#b89030);
      color:#000; border:none; border-radius:8px;
      padding:6px 14px; font-family:'Playfair Display',serif;
      font-size:13px; font-weight:700; cursor:pointer; display:none;
    }
    .tut-skip {
      background:transparent; color:rgba(201,168,76,.4);
      border:1px solid rgba(201,168,76,.2); border-radius:8px;
      padding:6px 12px; font-size:11px; cursor:pointer;
      font-family:'Rajdhani',sans-serif;
    }
    .tut-skip:hover { color:rgba(201,168,76,.8); }
    @keyframes tutRingPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%     { opacity:.65; transform:scale(1.03); }
    }
    @keyframes tutBoxPop {
      0%   { opacity:0; transform:translateX(-50%) translateY(12px); }
      100% { opacity:1; transform:translateX(-50%) translateY(0); }
    }
    .tut-pulse { animation:tutBoxPop .35s ease-out both; }
  `;
  document.head.appendChild(style);

  const box = document.createElement('div');
  box.id = 'tut-box';
  box.innerHTML =
    '<div class="tut-row">' +
      '<div class="tut-icon">🎰</div>' +
      '<div class="tut-msg">Loading…</div>' +
    '</div>' +
    '<div class="tut-footer">' +
      '<span class="tut-progress">Step 1 of ' + STEPS.length + '</span>' +
      '<div class="tut-buttons">' +
        '<button class="tut-next" onclick="tutorialNextBtn()">Got it!</button>' +
        '<button class="tut-skip" onclick="tutorialSkip()">Skip tutorial</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(box);
  _tutEl = box;
}

function tutorialNextBtn() {
  if(T.step === STEPS.length - 1) _finishTutorial();
  else _advanceStep();
}

// ── Monkey-patches ──────────────────────────

(function patchPlaceMachine() {
  const orig = window.placeMachine;
  window.placeMachine = function(type, tx, ty, rot) {
    const before = G.machines.length;
    const result = orig.apply(this, arguments);
    if(result && G.machines.length > before)
      tutorialOnMachinePlaced(G.machines[G.machines.length-1]);
    return result;
  };
})();

(function patchConfirmJackpay() {
  const orig = window.confirmJackpay;
  window.confirmJackpay = function() {
    orig.apply(this, arguments);
    tutorialOnJackpotHandled();
  };
})();

(function patchCashierPay() {
  ['confirmPay','autoPay'].forEach(name => {
    const orig = window[name];
    if(!orig) return;
    window[name] = function() {
      orig.apply(this, arguments);
      tutorialOnCashierPaid();
    };
  });
})();

(function patchDayEnd() {
  const orig = window.closeDayEndModal;
  if(!orig) return;
  window.closeDayEndModal = function() {
    orig.apply(this, arguments);
    tutorialOnDayEndClosed();
  };
})();

// Inject tutorialTick into the game loop by patching updateHUD (called every frame)
// and overlay re-checks into render (called every frame).
(function patchGameLoop() {
  const _inject = () => {
    if(typeof updateHUD !== 'undefined' && typeof render !== 'undefined') {

      const origRender = window.render;
      window.render = function() {
        origRender.apply(this, arguments);
        if(T.active) _tutorialOverlayCheck();
      };

      const origHUD = window.updateHUD;
      window.updateHUD = function() {
        origHUD.apply(this, arguments);
        // tutorialTick uses Date.now() internally — never speed-scaled
        tutorialTick();
      };

    } else {
      setTimeout(_inject, 100);
    }
  };
  setTimeout(_inject, 200);
})();

// Re-attach highlight rings every frame for dynamically appearing elements
function _tutorialOverlayCheck() {
  const step = STEPS[T.step];
  if(!step || !step.highlight) return;
  const existing = document.querySelector('.tut-highlight-ring');
  if(existing) return; // already shown

  if(step.highlight === 'jackpot') {
    const jp = document.getElementById('jp-panel');
    if(jp && jp.style.display !== 'none') _setHighlight('jackpot');
  } else if(step.highlight === 'cashier') {
    const notif = document.querySelector('#notif-rail .notif');
    if(notif) _setHighlight('cashier');
  } else if(step.highlight === 'dayend') {
    const dem = document.getElementById('day-end-modal');
    if(dem && dem.style.display !== 'none') _setHighlight('dayend');
  }
}

// Override startGame so first-time players get the tutorial
(function patchStartGame() {
  const _inject = () => {
    if(typeof startGame !== 'undefined') {
      const orig = window.startGame;
      window.startGame = function() {
        if(tutorialShouldRun()) startTutorial();
        else orig.apply(this, arguments);
      };
    } else {
      setTimeout(_inject, 100);
    }
  };
  setTimeout(_inject, 50);
})();
