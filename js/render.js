// ═══════════════════════════════════════════════
//  render.js — All canvas drawing
// ═══════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let hoverTile = null;  // { tx, ty } tile under cursor during drag

// ── Coordinate helpers ───────────────────────
const w2s        = (wx, wy) => ({ x: wx + G.camera.x, y: wy + G.camera.y });
const s2w        = (sx, sy) => ({ x: sx - G.camera.x, y: sy - G.camera.y });
const tile2world = (tx, ty) => ({ x: (tx + WALL) * TILE, y: (ty + WALL) * TILE });
const world2tile = (wx, wy) => ({ tx: Math.floor(wx / TILE) - WALL, ty: Math.floor(wy / TILE) - WALL });
const validTile  = (tx, ty) => tx >= 0 && ty >= 0 && tx < FW && ty < FH;

function tileOccupied(tx, ty, skipId = null) {
  for (const m of G.machines) {
    if (m.id === skipId) continue;
    const d = MACHINE_DEFS[m.type];
    if (tx >= m.tx && tx < m.tx + d.w && ty >= m.ty && ty < m.ty + d.h) return true;
  }
  return false;
}

// ── Resize ───────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  clampCam();
}

function clampCam() {
  const hotH = parseInt(getComputedStyle(document.getElementById('hotbar')).height) || 96;
  const WW   = (FW + 2 * WALL) * TILE;
  const WH   = (FH + 2 * WALL) * TILE;
  const minX = Math.min(0, canvas.width  - WW);
  const minY = Math.min(0, canvas.height - WH - hotH);
  G.camera.x = Math.max(minX, Math.min(0, G.camera.x));
  G.camera.y = Math.max(minY, Math.min(0, G.camera.y));
}

// ── Main render ───────────────────────────────
function render() {
  const cw = canvas.width, ch = canvas.height;
  const cx = G.camera.x,   cy = G.camera.y;

  // Void background
  ctx.fillStyle = '#080510';
  ctx.fillRect(0, 0, cw, ch);

  // Building shell
  const bw = (FW + 2 * WALL) * TILE;
  const bh = (FH + 2 * WALL) * TILE;
  ctx.fillStyle = '#221508';
  ctx.fillRect(cx, cy, bw, bh);

  // Gold wall trim
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth   = 2;
  ctx.strokeRect(cx + 1, cy + 1, bw - 2, bh - 2);
  ctx.strokeStyle = 'rgba(201,168,76,.25)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(cx + 5, cy + 5, bw - 10, bh - 10);

  // Casino floor
  const fx = cx + WALL * TILE, fy = cy + WALL * TILE;
  const fw = FW * TILE,        fh = FH * TILE;
  ctx.fillStyle = '#0c3618';
  ctx.fillRect(fx, fy, fw, fh);

  // Carpet diamond pattern
  for (let ty = 0; ty < FH; ty++) {
    for (let tx = 0; tx < FW; tx++) {
      const px = fx + tx * TILE, py = fy + ty * TILE;
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,.018)';
        ctx.fillRect(px, py, TILE, TILE);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.03)';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(px, py, TILE, TILE);
    }
  }

  // Floor inner border
  ctx.strokeStyle = 'rgba(201,168,76,.1)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(fx + 3, fy + 3, fw - 6, fh - 6);

  // Entrance gap in south wall
  const ex = fx + ENT_TX * TILE;
  const ey = cy + (FH + WALL) * TILE;
  ctx.fillStyle = '#0c3618';
  ctx.fillRect(ex + 4, ey - 2, TILE - 8, WALL * TILE + 4);
  ctx.fillStyle   = 'rgba(201,168,76,.6)';
  ctx.font        = 'bold 8px Rajdhani, sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText('▲ ENTRANCE ▲', ex + TILE / 2, ey + TILE * 0.55);

  // Machines
  for (const m of G.machines) drawMachine(m);

  // Patrons
  for (const p of G.patrons) drawPatron(p);

  // Placement preview
  if (G.dragging && hoverTile) {
    const def = MACHINE_DEFS[G.dragging.type];
    if (def) {
      const { tx, ty } = hoverTile;
      const wp = tile2world(tx, ty);
      const sp = w2s(wp.x, wp.y);
      let ok = true;
      for (let dx = 0; dx < def.w; dx++)
        for (let dy = 0; dy < def.h; dy++)
          if (!validTile(tx + dx, ty + dy) || tileOccupied(tx + dx, ty + dy)) ok = false;
      ctx.fillStyle   = ok ? 'rgba(100,200,100,.25)' : 'rgba(200,80,80,.25)';
      ctx.strokeStyle = ok ? '#70d070' : '#d06060';
      ctx.lineWidth   = 2;
      ctx.fillRect(sp.x, sp.y, def.w * TILE, def.h * TILE);
      ctx.strokeRect(sp.x, sp.y, def.w * TILE, def.h * TILE);
    }
  }

  // Delete mode tint
  if (G.deleteMode) {
    ctx.fillStyle = 'rgba(150,20,20,.12)';
    ctx.fillRect(0, 0, cw, ch);
  }
}

// ── Draw a placed machine ─────────────────────
function drawMachine(m) {
  const def = MACHINE_DEFS[m.type];
  const wp  = tile2world(m.tx, m.ty);
  const sp  = w2s(wp.x, wp.y);
  const pw  = def.w * TILE, ph = def.h * TILE;
  const x = sp.x + 3, y = sp.y + 3, w = pw - 6, h = ph - 6;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  rrect(x + 3, y + 3, w, h, 6); ctx.fill();

  // Body gradient
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, def.color);
  grad.addColorStop(1, shadecol(def.color, -40));
  ctx.fillStyle = grad;
  rrect(x, y, w, h, 6); ctx.fill();

  // Border
  const sel = G.selectedMid === m.id;
  ctx.strokeStyle = sel ? '#f0d080' : (m.occupied != null ? 'rgba(255,220,100,.5)' : 'rgba(255,255,255,.15)');
  ctx.lineWidth   = sel ? 2.5 : 1;
  rrect(x, y, w, h, 6); ctx.stroke();

  // Shine
  const shine = ctx.createLinearGradient(x, y, x, y + h * 0.4);
  shine.addColorStop(0, 'rgba(255,255,255,.15)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  rrect(x, y, w, h * 0.4, 6); ctx.fill();

  // Icon
  const iconSize = Math.min(w, h) * 0.42;
  ctx.font          = `${iconSize}px serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(def.icon, x + w / 2, y + h / 2 - 5);

  // Name label
  ctx.font          = 'bold 7px Rajdhani, sans-serif';
  ctx.fillStyle     = 'rgba(255,255,255,.65)';
  ctx.textBaseline  = 'bottom';
  ctx.fillText(def.name, x + w / 2, y + h - 2);

  // Busy spinner
  if (m.occupied != null) {
    const t = Date.now() / 350;
    ctx.save();
    ctx.translate(x + w - 9, y + 9);
    ctx.rotate(t);
    ctx.font = '9px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚙', 0, 0);
    ctx.restore();
  }

  // Upgrade stars
  const stars = (m.upgrades.speed || 0) + (m.upgrades.luck || 0) + (m.upgrades.bet || 0);
  if (stars > 0) {
    ctx.fillStyle    = '#f0d080';
    ctx.font         = 'bold 7px Rajdhani, sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('★'.repeat(Math.min(stars, 6)), x + 3, y + 3);
  }

  // Earn flash
  if (m._flash && Date.now() - m._flash < 700) {
    const a  = 1 - (Date.now() - m._flash) / 700;
    const dy = -14 * (1 - a);
    ctx.fillStyle    = `rgba(122,210,100,${a})`;
    ctx.font         = 'bold 11px Rajdhani, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m._flashTxt || '', x + w / 2, y + h / 2 + dy);
  }
}

// ── Draw a patron ─────────────────────────────
function drawPatron(p) {
  const sp = w2s(p.wx, p.wy);
  const x = sp.x, y = sp.y, r = 11;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + r, r * 0.8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

  // State face emoji
  const em = p.state === 'PLAYING'
    ? (p._won ? '😄' : '🎰')
    : (p.state === 'WAITING_CASHIER' || p.state === 'WALKING_TO_CASHIER') ? '💵'
    : (p.state === 'WAITING_KIOSK'   || p.state === 'WALKING_TO_KIOSK')   ? '🏧'
    : p.state === 'LEAVING' ? (p.ticketPaid ? '😄' : '😐')
    : '😐';
  ctx.font          = '10px serif';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(em, x, y);

  // Ticket value
  if (p.ticketValue > 0 && p.state !== 'PLAYING') {
    ctx.fillStyle    = '#8ad070';
    ctx.font         = 'bold 8px Rajdhani, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('$' + p.ticketValue.toFixed(2), x, y - r - 1);
  }

  // Name
  ctx.fillStyle    = 'rgba(255,255,255,.4)';
  ctx.font         = '7px Rajdhani, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(p.name, x, y + r + 2);
}

// ── Helpers ───────────────────────────────────
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);    ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);    ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);        ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function shadecol(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function spawnEarnFloat(wx, wy, txt, col = '#7aca70') {
  const sp = w2s(wx, wy);
  const el = document.createElement('div');
  el.className    = 'earn-float';
  el.style.color  = col;
  el.style.left   = sp.x + 'px';
  el.style.top    = sp.y + 'px';
  el.textContent  = txt;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}
