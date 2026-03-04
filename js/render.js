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
const validTile  = (tx,ty) => tx>=0 && ty>=0 && tx<FW && ty<FH;

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
  clampCam();
}

function clampCam() {
  const hotH = parseInt(getComputedStyle(document.getElementById('hotbar')).height)||96;
  const WW   = (FW+2*WALL)*TILE, WH = (FH+2*WALL)*TILE;
  G.camera.x = Math.max(Math.min(0,canvas.width-WW),  Math.min(0,G.camera.x));
  G.camera.y = Math.max(Math.min(0,canvas.height-WH-hotH), Math.min(0,G.camera.y));
}

// ─────────────────────────────────────────
function render() {
  const cw=canvas.width, ch=canvas.height;
  const cx=G.camera.x, cy=G.camera.y;

  // Void
  ctx.fillStyle='#040208';
  ctx.fillRect(0,0,cw,ch);

  // ── Building shell ──
  const bw=(FW+2*WALL)*TILE, bh=(FH+2*WALL)*TILE;
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
  const fx=cx+WALL*TILE, fy=cy+WALL*TILE, fw=FW*TILE, fh=FH*TILE;
  // Carpet base
  ctx.fillStyle='#0a2e14';
  ctx.fillRect(fx,fy,fw,fh);
  // Carpet tile pattern
  drawCarpet(fx,fy,fw,fh);
  // Floor border
  ctx.strokeStyle='rgba(201,168,76,.15)'; ctx.lineWidth=2;
  ctx.strokeRect(fx+4,fy+4,fw-8,fh-8);

  // ── Entrance ──
  const ex=fx+ENT_TX*TILE, ey=cy+(FH+WALL)*TILE;
  ctx.fillStyle='#0a2e14';
  ctx.fillRect(ex+2,ey-2,TILE-4,WALL*TILE+4);
  // Entrance arrows
  ctx.fillStyle='rgba(201,168,76,.7)';
  ctx.font='bold 9px monospace';
  ctx.textAlign='center';
  ctx.fillText('▲ ENTRANCE ▲',ex+TILE/2,ey+TILE*.55);

  // ── Dropped money ──
  for(const d of G.droppedMoney) drawDroppedMoney(d);

  // ── Tips ──
  for(const t of G.tips) drawTip(t);

  // ── Dirty items ──
  for(const d of G.dirtyItems) drawDirtyItem(d);

  // ── Machines ──
  for(const m of G.machines) drawMachine(m);

  // ── Jackpot flashes ──
  for(const j of G.jackpots) drawJackpotFlash(j);

  // ── Patrons ──
  for(const p of G.patrons)   drawPatron(p);

  // ── Employees ──
  for(const e of G.employees) drawEmployee(e);

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
  for(let ty=0; ty<FH*2; ty++) {
    for(let tx=0; tx<FW*2; tx++) {
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
  for(let ty=2; ty<FH; ty+=4) {
    for(let tx=2; tx<FW; tx+=4) {
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
  const sp=w2s(t.wx,t.wy);
  const pulse=.7+.3*Math.sin(Date.now()*.006);
  ctx.fillStyle=`rgba(122,210,80,${pulse})`;
  ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('💚 TIP $'+t.amount.toFixed(2),sp.x,sp.y);
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
  const type = G.dragging?.type || G.placementSelected;
  if(!type || !hoverTile) return;
  const def=MACHINE_DEFS[type];
  const rot=G.placementRotation;
  const pw=rot%2===0 ? def.w : def.h;
  const ph=rot%2===0 ? def.h : def.w;
  const {tx,ty}=hoverTile;
  const wp=tile2world(tx,ty), sp=w2s(wp.x,wp.y);
  let ok=true;
  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(tx+dx,ty+dy)||tileOccupied(tx+dx,ty+dy)) ok=false;
  ctx.fillStyle  =ok?'rgba(80,200,80,.22)':'rgba(200,60,60,.22)';
  ctx.strokeStyle=ok?'#60d060':'#d06060';
  ctx.lineWidth=2;
  ctx.fillRect(sp.x,sp.y,pw*TILE,ph*TILE);
  ctx.strokeRect(sp.x,sp.y,pw*TILE,ph*TILE);
  // rotation arrow
  ctx.fillStyle=ok?'rgba(80,200,80,.7)':'rgba(200,60,60,.7)';
  ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  const arrows=['↓','←','↑','→'];
  ctx.fillText(arrows[rot],sp.x+pw*TILE/2,sp.y+ph*TILE/2);
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
