// ═══════════════════════════════════════════════
//  input.js — Mouse, touch, hotbar drag, pan
// ═══════════════════════════════════════════════

let isPan     = false;
let panStart  = { x: 0, y: 0 };
let panCam    = { x: 0, y: 0 };
let mousePos  = { x: 0, y: 0 };

// ── Normalise pointer position ────────────────
function ePos(e) {
  return e.touches
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : { x: e.clientX,            y: e.clientY            };
}

// ══════════════════════════════════════════════
//  Mouse events on canvas
// ══════════════════════════════════════════════
canvas.addEventListener('mousedown', e => {
  if (G.dragging) return;
  isPan    = true;
  panStart = ePos(e);
  panCam   = { x: G.camera.x, y: G.camera.y };
  canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', e => {
  mousePos = ePos(e);

  if (G.dragging) {
    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = mousePos.x + 'px';
    ghost.style.top  = mousePos.y + 'px';
    const wp  = s2w(mousePos.x, mousePos.y);
    hoverTile = world2tile(wp.x, wp.y);
    return;
  }

  if (isPan) {
    const p    = ePos(e);
    G.camera.x = panCam.x + p.x - panStart.x;
    G.camera.y = panCam.y + p.y - panStart.y;
    clampCam();
  }
});

canvas.addEventListener('mouseup', e => {
  const p = ePos(e);
  if (G.dragging) { dropItem(p.x, p.y); return; }

  if (isPan) {
    isPan = false;
    canvas.style.cursor = G.deleteMode ? 'not-allowed' : 'grab';
    const moved = Math.abs(p.x - panStart.x) + Math.abs(p.y - panStart.y) < 6;
    if (moved) handleCanvasClick(p.x, p.y);
  }
});

canvas.addEventListener('mouseleave', () => {
  isPan = false;
  if (!G.dragging) canvas.style.cursor = G.deleteMode ? 'not-allowed' : 'grab';
});

// ── Drop on document (released outside canvas) ──
document.addEventListener('mouseup', e => {
  if (G.dragging && e.target !== canvas) endDrag();
});

// ══════════════════════════════════════════════
//  Touch events on canvas
// ══════════════════════════════════════════════
canvas.addEventListener('touchstart', e => {
  if (G.dragging) return;
  const p  = ePos(e);
  mousePos = p;
  isPan    = true;
  panStart = p;
  panCam   = { x: G.camera.x, y: G.camera.y };
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  const p  = ePos(e);
  mousePos = p;

  if (G.dragging) {
    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = p.x + 'px';
    ghost.style.top  = p.y + 'px';
    const wp  = s2w(p.x, p.y);
    hoverTile = world2tile(wp.x, wp.y);
    e.preventDefault();
    return;
  }

  if (isPan) {
    G.camera.x = panCam.x + p.x - panStart.x;
    G.camera.y = panCam.y + p.y - panStart.y;
    clampCam();
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  const p = mousePos;
  if (G.dragging) { dropItem(p.x, p.y); e.preventDefault(); return; }

  const moved = Math.abs(p.x - panStart.x) + Math.abs(p.y - panStart.y) < 10;
  isPan = false;
  if (moved) handleCanvasClick(p.x, p.y);
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', e => {
  if (G.dragging) {
    const t = e.changedTouches[0];
    if (document.elementFromPoint(t.clientX, t.clientY) !== canvas) endDrag();
  }
});

// ══════════════════════════════════════════════
//  Drag & Drop helpers
// ══════════════════════════════════════════════
function dropItem(sx, sy) {
  const wp = s2w(sx, sy);
  const t  = world2tile(wp.x, wp.y);
  placeMachine(G.dragging.type, t.tx, t.ty);
  endDrag();
}

function endDrag() {
  G.dragging = null;
  hoverTile  = null;
  document.getElementById('drag-ghost').style.display = 'none';
  canvas.classList.remove('placing');
  canvas.style.cursor = G.deleteMode ? 'not-allowed' : 'grab';
}

// ── Canvas click: select or delete machine ────
function handleCanvasClick(sx, sy) {
  const wp = s2w(sx, sy);
  const t  = world2tile(wp.x, wp.y);

  if (!validTile(t.tx, t.ty)) {
    closeUpgradePanel();
    return;
  }

  const m = G.machines.find(m => {
    const d = MACHINE_DEFS[m.type];
    return t.tx >= m.tx && t.tx < m.tx + d.w &&
           t.ty >= m.ty && t.ty < m.ty + d.h;
  });

  if (m) {
    if (G.deleteMode) {
      const def = MACHINE_DEFS[m.type];
      const val = Math.floor(def.cost * 0.5);
      if (confirm('Remove ' + def.name + '? Get $' + val + ' back.')) {
        if (m.occupied != null) {
          const p = G.patrons.find(p => p.id === m.occupied);
          if (p) { p.machineId = null; kickOut(p); }
        }
        G.machines = G.machines.filter(x => x.id !== m.id);
        G.money   += val;
        toast('Sold for $' + val, 'g');
      }
    } else {
      if (m.type === 'cashier') openCashierPanel();
      else                      openUpgradePanel(m.id);
    }
  } else {
    closeUpgradePanel();
  }
}

// ══════════════════════════════════════════════
//  Hotbar
// ══════════════════════════════════════════════
function buildHotbar() {
  const scroll = document.getElementById('hotbar-scroll');
  scroll.innerHTML = '';

  const items = ['slot_basic', 'slot_silver', 'slot_gold', 'slot_diamond', 'kiosk', 'cashier'];

  for (const type of items) {
    const def = MACHINE_DEFS[type];
    const div = document.createElement('div');
    div.className    = 'hotbar-item';
    div.dataset.type = type;
    div.innerHTML    = `
      <div class="hi-icon">${def.icon}</div>
      <div class="hi-name">${def.name}</div>
      <div class="hi-cost">$${def.cost.toLocaleString()}</div>`;

    const startDrag = (clientX, clientY) => {
      G.dragging = { type };
      const ghost = document.getElementById('drag-ghost');
      ghost.textContent    = def.icon;
      ghost.style.display  = 'block';
      ghost.style.left     = clientX + 'px';
      ghost.style.top      = clientY + 'px';
      canvas.classList.add('placing');
    };

    div.addEventListener('mousedown',  e => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
    div.addEventListener('touchstart', e => {
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    scroll.appendChild(div);
  }
}

function updateHotbarAfford() {
  document.querySelectorAll('.hotbar-item').forEach(el => {
    const def = MACHINE_DEFS[el.dataset.type];
    el.classList.toggle('cant-afford', G.money < def.cost);
  });
}

// ══════════════════════════════════════════════
//  Top-bar control buttons
// ══════════════════════════════════════════════
function toggleDelete() {
  G.deleteMode = !G.deleteMode;
  document.getElementById('del-btn').classList.toggle('active', G.deleteMode);
  canvas.className = G.deleteMode ? 'deleting' : '';
}

function setSpd(s) {
  G.speed = s;
  [1, 2, 3].forEach(n =>
    document.getElementById('spd' + n).classList.toggle('active', n === s)
  );
}
