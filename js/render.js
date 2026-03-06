// ═══════════════════════════════════════════
//  render.js — Canvas setup + floor drawing
// ═══════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let hoverTile = null;

// Coord helpers
const w2s        = (wx,wy) => ({ x:wx+G.camera.x, y:wy+G.camera.y });
const s2w        = (sx,sy) => ({ x:sx-G.camera.x, y:sy-G.camera.y });
const tile2world = (tx,ty) => ({ x:(tx+WALL)*TILE, y:(ty+WALL)*TILE });
const world2tile = (wx,wy) => ({ tx:Math.floor(wx/TILE)-WALL, ty:Math.floor(wy/TILE)-WALL });
const validTile  = (tx,ty) => tx>=0 && ty>=0 && tx<G.floorW && ty<G.floorH;

function tileOccupied(tx,ty,skipId=null) {
  for(const m of G.machines) {
    if(m.id===skipId) continue;
    const d=MACHINE_DEFS[m.type];
    if(tx>=m.tx && tx<m.tx+d.w && ty>=m.ty && ty<m.ty+d.h) return true;
  }
  return false;
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
  // Update CSS var for panels that sit above hotbar
  const hb = document.getElementById('hotbar');
  if(hb) {
    const h = hb.offsetHeight||96;
    document.documentElement.style.setProperty('--hotbar-h', h+'px');
  }
  clampCam();
}

function clampCam() {
  const hotH = parseInt(getComputedStyle(document.getElementById('hotbar')).height)||96;
  const WW = (G.floorW+2*WALL)*TILE, WH = (G.floorH+2*WALL)*TILE;

  // Horizontal: when world wider than screen, allow scrolling through it.
  // When world narrower, allow centering with small slack.
  const minX = Math.min(0, canvas.width - WW);   // most-left pan (negative when WW>viewport)
  const maxX = Math.max(0, canvas.width - WW);   // most-right pan (positive when WW<viewport)
  const overX = TILE * 2;  // small overshoot so edge wall isn't hard-cut
  G.camera.x = Math.max(minX - overX, Math.min(maxX + overX, G.camera.x));

  // Vertical: standard bounds + extra southward travel to reveal parking lot
  const minY = canvas.height - hotH - WH;
  const maxY = 52;  // HUD height — don't scroll building above it
  const extraDown = TILE * 6;
  G.camera.y = Math.max(minY - extraDown, Math.min(maxY, G.camera.y));
}

// ─────────────────────────────────────────
function render() {
  const cw=canvas.width, ch=canvas.height;
  const cx=G.camera.x, cy=G.camera.y;

  // ── Grass world background ──
  _drawGrassBackground(cw, ch, cx, cy);

  // ── Road and parking lot south of building ──
  const bw=(G.floorW+2*WALL)*TILE, bh=(G.floorH+2*WALL)*TILE;
  _drawRoadAndParking(cx, cy, bw, bh);

  // ── Building shell ──
  // Outer wall fill
  ctx.fillStyle='#1a0e06';
  ctx.fillRect(cx,cy,bw,bh);
  // Wall brick pattern
  drawBrickWall(cx,cy,bw,bh);
  // Gold trim
  ctx.strokeStyle='#c9a84c'; ctx.lineWidth=3;
  ctx.strokeRect(cx+1,cy+1,bw-2,bh-2);
  ctx.strokeStyle='rgba(201,168,76,.2)'; ctx.lineWidth=1;
  ctx.strokeRect(cx+6,cy+6,bw-12,bh-12);

  // ── Floor ──
  const fx=cx+WALL*TILE, fy=cy+WALL*TILE, fw=G.floorW*TILE, fh=G.floorH*TILE;
  // Carpet base
  ctx.fillStyle='#0a2e14';
  ctx.fillRect(fx,fy,fw,fh);
  // Carpet tile pattern
  drawCarpet(fx,fy,fw,fh);
  // Floor border
  ctx.strokeStyle='rgba(201,168,76,.15)'; ctx.lineWidth=2;
  ctx.strokeRect(fx+4,fy+4,fw-8,fh-8);

  // ── Entrance ──
  const ex=fx+ENT_TX()*TILE, ey=cy+(G.floorH+WALL)*TILE;
  ctx.fillStyle='#0a2e14';
  ctx.fillRect(ex+2,ey-2,TILE-4,WALL*TILE+4);
  // Entrance arrows
  ctx.fillStyle='rgba(201,168,76,.7)';
  ctx.font='bold 9px monospace';
  ctx.textAlign='center';
  ctx.fillText('▲ ENTRANCE ▲',ex+TILE/2,ey+TILE*.55);

  // ── Dirty items (on floor) ──
  for(const d of G.dirtyItems) drawDirtyItem(d);

  // ── Employees (drawn BEFORE machines so they appear behind their station) ──
  for(const e of G.employees) drawEmployee(e);

  // ── Machines ──
  for(const m of G.machines) drawMachine(m);

  // ── Jackpot flashes ──
  for(const j of G.jackpots) drawJackpotFlash(j);

  // ── Dropped money & tips drawn AFTER machines so never behind them ──
  for(const d of G.droppedMoney) drawDroppedMoney(d);
  for(const t of G.tips) drawTip(t);

  // ── Patrons (after machines so they appear in front) ──
  for(const p of G.patrons)   drawPatron(p);

  // ── Lost & Found returning visitors ──
  for(const v of G.lostAndFoundVisitors) drawLFVisitor(v);

  // ── Parked & moving cars ──
  drawParkingCars(cx, cy, bw, bh);

  // ── Placement preview ──
  drawPlacementPreview();

  // ── Delete tint ──
  if(G.deleteMode) {
    ctx.fillStyle='rgba(140,10,10,.1)';
    ctx.fillRect(0,0,cw,ch);
  }
}

function drawBrickWall(bx,by,bw,bh) {
  const brickW=20, brickH=10;
  ctx.fillStyle='rgba(0,0,0,.25)';
  for(let y=by; y<by+bh; y+=brickH) {
    const off = Math.floor((y-by)/brickH)%2===0 ? 0 : brickW/2;
    for(let x=bx+off; x<bx+bw; x+=brickW) {
      ctx.fillRect(x,y,brickW-1,brickH-1);
    }
  }
}

function drawCarpet(fx,fy,fw,fh) {
  const sz=TILE/2;
  for(let ty=0; ty<G.floorH*2; ty++) {
    for(let tx=0; tx<G.floorW*2; tx++) {
      const px=fx+tx*sz, py=fy+ty*sz;
      if((tx+ty)%2===0) {
        ctx.fillStyle='rgba(20,180,80,.04)';
        ctx.fillRect(px,py,sz,sz);
      }
      // Subtle grid lines (tile-sized)
      if(tx%2===0 && ty%2===0) {
        ctx.strokeStyle='rgba(255,255,255,.025)';
        ctx.lineWidth=.5;
        ctx.strokeRect(fx+(tx/2)*TILE, fy+(ty/2)*TILE, TILE, TILE);
      }
    }
  }
  // Diamond motif every 4 tiles
  for(let ty=2; ty<G.floorH; ty+=4) {
    for(let tx=2; tx<G.floorW; tx+=4) {
      const cx2=fx+tx*TILE+TILE/2, cy2=fy+ty*TILE+TILE/2, r=14;
      ctx.strokeStyle='rgba(201,168,76,.12)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(cx2,cy2-r); ctx.lineTo(cx2+r,cy2);
      ctx.lineTo(cx2,cy2+r); ctx.lineTo(cx2-r,cy2);
      ctx.closePath(); ctx.stroke();
    }
  }
}

function drawDroppedMoney(d) {
  const sp=w2s(d.wx,d.wy);
  // Coin shadow
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(sp.x+2,sp.y+3,6,3,0,0,Math.PI*2); ctx.fill();
  // Coin body
  ctx.fillStyle='#d4a820';
  ctx.beginPath(); ctx.arc(sp.x,sp.y,7,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#f0c840'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(sp.x,sp.y,7,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#8b6800';
  ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('$',sp.x,sp.y);
  // Amount label
  ctx.fillStyle='#f0d060';
  ctx.font='bold 7px monospace'; ctx.textBaseline='bottom';
  ctx.fillText('$'+d.amount.toFixed(2),sp.x,sp.y-8);
}

function drawTip(t) {
  const sp = w2s(t.wx, t.wy);
  const pulse = 0.8 + 0.2*Math.sin(Date.now()*0.007);
  const x = sp.x, y = sp.y;

  // Drop shadow for legibility
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;

  // Coin icon
  ctx.font = '16px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🪙', x, y);

  // Amount — large bold text
  ctx.font = `bold 13px monospace`;
  ctx.fillStyle = `rgba(255,220,60,${pulse})`;
  ctx.textBaseline = 'bottom';
  ctx.fillText('+$'+t.amount.toFixed(2)+' TIP', x, y - 10);

  ctx.shadowBlur = 0;
}

function drawDirtyItem(d) {
  const sp=w2s(d.wx,d.wy);
  ctx.font='13px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.globalAlpha=.75;
  ctx.fillText('🍽',sp.x,sp.y);
  ctx.globalAlpha=1;
}

function drawJackpotFlash(j) {
  const m=G.machines.find(m=>m.id===j.machineId);
  if(!m) return;
  const wp=tile2world(m.tx,m.ty), sp=w2s(wp.x,wp.y);
  const def=MACHINE_DEFS[m.type];
  const t=Date.now()/200;
  const a=.4+.4*Math.abs(Math.sin(t));
  ctx.fillStyle=`rgba(255,220,0,${a})`;
  ctx.fillRect(sp.x-4,sp.y-4,def.w*TILE+8,def.h*TILE+8);
  ctx.fillStyle='#000'; ctx.font='bold 8px monospace';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('🏆 JACKPOT! TAP TO PAY',sp.x+def.w*TILE/2,sp.y-18);
  // Timer bar
  const ratio=j.timer/JACKPOT_TIMEOUT;
  ctx.fillStyle='rgba(0,0,0,.5)';
  ctx.fillRect(sp.x,sp.y-10,def.w*TILE,5);
  ctx.fillStyle=ratio>.5?'#40e040':ratio>.25?'#e0a040':'#e04040';
  ctx.fillRect(sp.x,sp.y-10,def.w*TILE*ratio,5);
}

function drawPlacementPreview() {
  const type = G.dragging?.type || G.placementSelected || (G.moveMode ? G.machines.find(m=>m.id===G.moveMode.machineId)?.type : null);
  if(!type || !hoverTile) return;
  const def=MACHINE_DEFS[type];
  const rot=G.placementRotation;
  const pw=rot%2===0 ? def.w : def.h;
  const ph=rot%2===0 ? def.h : def.w;
  const {tx,ty}=hoverTile;
  const wp=tile2world(tx,ty), sp=w2s(wp.x,wp.y);
  let ok=true;
  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(tx+dx,ty+dy)||tileOccupied(tx+dx,ty+dy,G.moveMode?.machineId)) ok=false;

  // Ghost fill
  ctx.fillStyle  =ok?'rgba(80,200,80,.2)':'rgba(200,60,60,.2)';
  ctx.strokeStyle=ok?'#60d060':'#d06060';
  ctx.lineWidth=2;
  ctx.fillRect(sp.x,sp.y,pw*TILE,ph*TILE);
  ctx.strokeRect(sp.x,sp.y,pw*TILE,ph*TILE);

  // Icon in center
  ctx.font=`${Math.floor(Math.min(pw,ph)*TILE*.38)}px serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.globalAlpha=.6;
  ctx.fillText(def.icon,sp.x+pw*TILE/2,sp.y+ph*TILE/2);
  ctx.globalAlpha=1;

  // Rotation direction arrow
  const arrows=['↓','←','↑','→'];
  ctx.fillStyle=ok?'rgba(80,200,80,.9)':'rgba(200,60,60,.9)';
  ctx.font='bold 12px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(arrows[rot],sp.x+pw*TILE/2,sp.y+ph*TILE/2+16);

  // ── Rotation handle (circle button top-right) ──
  const hx=sp.x+pw*TILE-12, hy=sp.y+12;
  ctx.fillStyle='rgba(30,30,40,.85)';
  ctx.beginPath(); ctx.arc(hx,hy,12,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(201,168,76,.7)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(hx,hy,12,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#f0d080'; ctx.font='13px serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🔄',hx,hy);
}

// ── LF Visitor (returning patron) ─────────
function drawLFVisitor(v) {
  const sp = w2s(v.wx, v.wy);
  const x = sp.x, y = sp.y;

  // Body (slightly different shade to distinguish from regular patrons)
  ctx.fillStyle = v.color;
  ctx.fillRect(x-5, y-14, 10, 12);
  // Head
  ctx.fillStyle = '#f0c890';
  ctx.beginPath(); ctx.arc(x, y-18, 6, 0, Math.PI*2); ctx.fill();
  // Hair
  ctx.fillStyle = v.hairColor||'#3a2808';
  ctx.beginPath(); ctx.arc(x, y-20, 6, Math.PI, 0); ctx.fill();
  // Return badge above head (green star)
  ctx.fillStyle = '#50e050';
  ctx.font = 'bold 9px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('★', x, y-26);

  // Name tag
  ctx.fillStyle = 'rgba(80,220,80,.8)';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(v.patronName, x, y+2);

  // If waiting at desk, show pulsing indicator + tap prompt
  if(v.state === 'WAITING') {
    const pulse = 0.6 + 0.4*Math.sin(Date.now() * 0.005);
    ctx.strokeStyle = `rgba(80,220,80,${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y-14, 12, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(80,220,80,${pulse*0.35})`;
    ctx.beginPath(); ctx.arc(x, y-14, 12, 0, Math.PI*2); ctx.fill();
    // Tap label
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#50e050';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('TAP TO CLAIM', x, y - 28);
  }
}

// ── Float text helper ──
function spawnFloat(wx,wy,txt,col='#7aca70') {
  const sp=w2s(wx,wy);
  const el=document.createElement('div');
  el.className='earn-float';
  el.style.cssText=`left:${sp.x}px;top:${sp.y}px;color:${col}`;
  el.textContent=txt;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1000);
}

// ── Pixel-art rounded rect ──
function prect(x,y,w,h,r=4) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);   ctx.arcTo(x+w,y,    x+w,y+r,   r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,  x+w-r,y+h, r);
  ctx.lineTo(x+r,y+h);   ctx.arcTo(x,  y+h,  x,  y+h-r, r);
  ctx.lineTo(x,  y+r);   ctx.arcTo(x,  y,    x+r,y,      r);
  ctx.closePath();
}

function shadecol(hex,amt) {
  const n=parseInt(hex.replace('#',''),16);
  const r=Math.max(0,Math.min(255,(n>>16)+amt));
  const g=Math.max(0,Math.min(255,((n>>8)&0xff)+amt));
  const b=Math.max(0,Math.min(255,(n&0xff)+amt));
  return `#${((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}`;
}

// ═══════════════════════════════════════════
//  World background — grass, road, parking
// ═══════════════════════════════════════════

function _drawGrassBackground(cw, ch, cx, cy) {
  // Base grass colour
  ctx.fillStyle = '#1a3d10';
  ctx.fillRect(0, 0, cw, ch);

  // Subtle grass blade texture — seeded by screen position so it doesn't shimmer
  const BLADE_SZ = 8;
  const offX = ((cx % BLADE_SZ) + BLADE_SZ) % BLADE_SZ;
  const offY = ((cy % BLADE_SZ) + BLADE_SZ) % BLADE_SZ;
  for (let sy = -offY; sy < ch + BLADE_SZ; sy += BLADE_SZ) {
    for (let sx = -offX; sx < cw + BLADE_SZ; sx += BLADE_SZ) {
      // Use a cheap deterministic hash for variety
      const hash = ((sx * 2654435761 ^ sy * 2246822519) >>> 0) % 256;
      if (hash < 60) {
        ctx.fillStyle = 'rgba(30,70,15,.22)';
        ctx.fillRect(sx, sy, 2, BLADE_SZ - 1);
      } else if (hash < 100) {
        ctx.fillStyle = 'rgba(50,100,20,.15)';
        ctx.fillRect(sx + 3, sy + 2, BLADE_SZ - 4, 2);
      }
    }
  }

  // Subtle vignette at edges
  const grad = ctx.createRadialGradient(cw/2, ch/2, cw*0.2, cw/2, ch/2, cw*0.8);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
}

function _drawRoadAndParking(cx, cy, bw, bh) {
  const roadW  = bw * 1.8;               // road wider than building
  const roadH  = TILE * 3.5;             // 3.5 tiles tall
  const roadX  = cx + bw/2 - roadW/2;   // centred under building
  const roadY  = cy + bh;               // immediately below building

  // Road surface
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(roadX, roadY, roadW, roadH);

  // Road centre dashes
  ctx.setLineDash([TILE * 0.6, TILE * 0.4]);
  ctx.strokeStyle = 'rgba(255,220,0,.35)';
  ctx.lineWidth = 3;
  const midY = roadY + roadH * 0.5;
  ctx.beginPath();
  ctx.moveTo(roadX, midY);
  ctx.lineTo(roadX + roadW, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Road edge lines
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(roadX, roadY + 4);   ctx.lineTo(roadX + roadW, roadY + 4);
  ctx.moveTo(roadX, roadY + roadH - 4); ctx.lineTo(roadX + roadW, roadY + roadH - 4);
  ctx.stroke();

  // Pavement strip between road and building
  ctx.fillStyle = '#2e2820';
  ctx.fillRect(cx, cy + bh - 2, bw, TILE * 0.7);
  ctx.fillStyle = 'rgba(201,168,76,.06)';
  ctx.fillRect(cx, cy + bh - 2, bw, TILE * 0.7);

  // Parking lot to left and right of building (grey tarmac)
  const lotW = TILE * 8;
  const lotH = roadH;
  // Left lot
  ctx.fillStyle = '#14141a';
  ctx.fillRect(roadX, roadY, lotW, lotH);
  _drawParkingSpaces(roadX + TILE * 0.5, roadY + TILE * 0.3, 3, lotH - TILE * 0.6);
  // Right lot
  const rightLotX = cx + bw + (roadW/2 - bw/2) - lotW;
  ctx.fillStyle = '#14141a';
  ctx.fillRect(rightLotX, roadY, lotW, lotH);
  _drawParkingSpaces(rightLotX + TILE * 0.5, roadY + TILE * 0.3, 3, lotH - TILE * 0.6);

  // Kerb between pavement and road
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(cx - 4, cy + bh + TILE * 0.65, bw + 8, 5);
}

function _drawParkingSpaces(x, y, cols, h) {
  const spW = TILE * 1.4;
  const lineColor = 'rgba(255,255,255,.1)';
  for (let c = 0; c <= cols; c++) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + c * spW, y);
    ctx.lineTo(x + c * spW, y + h);
    ctx.stroke();
  }
  // Top and bottom lines
  ctx.beginPath();
  ctx.moveTo(x, y);       ctx.lineTo(x + cols * spW, y);
  ctx.moveTo(x, y + h);   ctx.lineTo(x + cols * spW, y + h);
  ctx.stroke();
}

// ═══════════════════════════════════════════
//  Parking car system
// ═══════════════════════════════════════════

const CAR_COLORS = ['#c02020','#2040c0','#208040','#c07010','#601080','#106080','#888','#c0c0c0'];

function drawParkingCars(cx, cy, bw, bh) {
  if (!G.parkingCars) return;
  const roadY = cy + bh;
  const lotW  = TILE * 8;
  const roadW = bw * 1.8;
  const roadX = cx + bw/2 - roadW/2;

  for (const car of G.parkingCars) {
    const sx = cx + car.wx;   // car wx is in building-relative coords
    const sy = cy + car.wy;
    _drawPixelCar(sx, sy, car.color, car.facing, car.alpha || 1);
  }
}

function _drawPixelCar(sx, sy, color, facing, alpha) {
  ctx.globalAlpha = alpha;
  // facing 0=right, 1=left, 2=down, 3=up — top-down view, car rotated to face direction
  ctx.save();
  ctx.translate(sx, sy);
  const rot = [0, Math.PI, Math.PI/2, -Math.PI/2][facing] || 0;
  ctx.rotate(rot);

  const cl = 26;  // car length (front→back in local x)
  const cw = 14;  // car width  (side-to-side in local y)
  const x = -cl/2, y = -cw/2;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(1, 2, cl*0.48, cw*0.46, 0, 0, Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x+3, y); ctx.lineTo(x+cl-3, y); ctx.arcTo(x+cl, y, x+cl, y+3, 3);
  ctx.lineTo(x+cl, y+cw-3); ctx.arcTo(x+cl, y+cw, x+cl-3, y+cw, 3);
  ctx.lineTo(x+3, y+cw); ctx.arcTo(x, y+cw, x, y+cw-3, 3);
  ctx.lineTo(x, y+3); ctx.arcTo(x, y, x+3, y, 3);
  ctx.closePath(); ctx.fill();

  // Roof (darker tinted centre panel)
  ctx.fillStyle = shadecol(color, -18);
  ctx.fillRect(x+7, y+2, cl-14, cw-4);

  // Windshield (front — right side in local coords)
  ctx.fillStyle = 'rgba(170,225,255,.72)';
  ctx.fillRect(x+cl-8, y+2, 5, cw-4);

  // Rear window (back — left side in local coords)
  ctx.fillStyle = 'rgba(120,180,220,.45)';
  ctx.fillRect(x+3, y+2, 4, cw-4);

  // Headlights — front corners
  ctx.fillStyle = '#ffe87a';
  ctx.fillRect(x+cl-3, y+1,       3, 3);
  ctx.fillRect(x+cl-3, y+cw-4,    3, 3);

  // Taillights — rear corners
  ctx.fillStyle = '#ff3030';
  ctx.fillRect(x, y+1,       3, 3);
  ctx.fillRect(x, y+cw-4,    3, 3);

  // Wheels — four corners, dark rects sticking outside body
  ctx.fillStyle = '#181818';
  // front pair
  ctx.fillRect(x+cl-8, y-2,   6, 3);
  ctx.fillRect(x+cl-8, y+cw-1, 6, 3);
  // rear pair
  ctx.fillRect(x+2,    y-2,   6, 3);
  ctx.fillRect(x+2,    y+cw-1, 6, 3);

  ctx.restore();
  ctx.globalAlpha = 1;
}
