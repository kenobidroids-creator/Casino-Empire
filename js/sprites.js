// ═══════════════════════════════════════════
//  sprites.js — Pixel-art style drawing
// ═══════════════════════════════════════════

// ── Draw machine with rotation ──────────────
function drawMachine(m) {
  const def=MACHINE_DEFS[m.type];
  const wp=tile2world(m.tx,m.ty), sp=w2s(wp.x,wp.y);
  const rot=m.rotation||0;
  const pw=rot%2===0?def.w:def.h, ph=rot%2===0?def.h:def.w;

  ctx.save();
  // Rotate around machine center
  const cx2=sp.x+pw*TILE/2, cy2=sp.y+ph*TILE/2;
  ctx.translate(cx2,cy2);
  ctx.rotate(rot*Math.PI/2);
  const dw=def.w*TILE, dh=def.h*TILE;
  const ox=-dw/2, oy=-dh/2;

  if(def.isSlot)             drawSlotSprite(m,def,ox,oy,dw,dh);
  else if(def.isKiosk)       drawKioskSprite(m,def,ox,oy,dw,dh);
  else if(def.isCashier)     drawCashierSprite(m,def,ox,oy,dw,dh);
  else if(def.isBar)         drawBarSprite(m,def,ox,oy,dw,dh);
  else if(def.isTable&&def.tableGame) drawNewMachineSprite(m,def,ox,oy,dw,dh);
  else if(def.isTable)       drawTableSprite(m,def,ox,oy,dw,dh);
  else if(def.isSurveillance)drawSurveillanceSprite(m,def,ox,oy,dw,dh);
  else if(def.isSecurity)    drawSecuritySprite(m,def,ox,oy,dw,dh);
  else                       drawNewMachineSprite(m,def,ox,oy,dw,dh);

  ctx.restore();

  // Overlays drawn after rotation (world-space)
  drawMachineOverlays(m,def,sp,pw,ph);
}

// ── Slot Machine Sprite ────────────────────
function drawSlotSprite(m,def,x,y,w,h) {
  const sel=G.selectedMid===m.id;
  // Cabinet body (dark gradient)
  const bodyG=ctx.createLinearGradient(x,y,x+w,y+h);
  bodyG.addColorStop(0,shadecol(def.color,20));
  bodyG.addColorStop(1,shadecol(def.color,-30));
  ctx.fillStyle=bodyG;
  prect(x+2,y+2,w-4,h-4,5); ctx.fill();

  // Selection/busy glow
  if(sel||m.occupied!=null) {
    ctx.shadowColor=sel?'#f0d080':'rgba(255,200,50,.6)';
    ctx.shadowBlur=sel?10:6;
  }
  ctx.strokeStyle=sel?'#f0d080':'rgba(255,255,255,.2)';
  ctx.lineWidth=sel?2:1;
  prect(x+2,y+2,w-4,h-4,5); ctx.stroke();
  ctx.shadowBlur=0;

  // Screen area
  const sx=x+6,sy=y+6,sw=w-12,sh=h*.52-4;
  ctx.fillStyle='#060a06'; prect(sx,sy,sw,sh,3); ctx.fill();
  ctx.strokeStyle='#1a3018'; ctx.lineWidth=1; prect(sx,sy,sw,sh,3); ctx.stroke();

  // Reel windows
  if(!m._reels) initMachineReels(m);
  drawSlotReels(m,sx+2,sy+2,sw-4,sh-4);

  // Side chrome strips
  ctx.fillStyle='rgba(255,255,255,.08)';
  ctx.fillRect(x+2,y+2,3,h-4);
  ctx.fillRect(x+w-5,y+2,3,h-4);

  // Coin tray (bottom indented area)
  const ty2=y+h*.72, th=h*.16;
  ctx.fillStyle='rgba(0,0,0,.5)'; prect(x+8,ty2,w-16,th,2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.lineWidth=1; prect(x+8,ty2,w-16,th,2); ctx.stroke();

  // Spin button
  const btnX=x+w/2-10, btnY=y+h*.54, btnW=20, btnH=10;
  const btnG=ctx.createLinearGradient(btnX,btnY,btnX,btnY+btnH);
  btnG.addColorStop(0,'#e04040'); btnG.addColorStop(1,'#802020');
  ctx.fillStyle=btnG; prect(btnX,btnY,btnW,btnH,3); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.lineWidth=1; prect(btnX,btnY,btnW,btnH,3); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('SPIN',btnX+btnW/2,btnY+btnH/2);

  // Credit display
  const betLv=(m.upgrades?.bet||0);
  const maxBet=(def.betMax*(1+betLv*.25)).toFixed(0);
  ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(x+4,y+h*.66,w-8,h*.1);
  ctx.fillStyle='#40e040'; ctx.font='bold 6px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('MAX $'+maxBet,x+w/2,y+h*.71);

  // Name badge
  ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(x+4,y+h*.88,w-8,h*.1);
  ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(def.name.toUpperCase(),x+w/2,y+h*.93);
}

// ── Reel animation ─────────────────────────
function initMachineReels(m) {
  m._reels=[
    {pos:0,speed:0,stopped:true,target:0,stopAt:0},
    {pos:0,speed:0,stopped:true,target:0,stopAt:0},
    {pos:0,speed:0,stopped:true,target:0,stopAt:0}
  ];
}

function drawSlotReels(m,rx,ry,rw,rh) {
  const reels=m._reels||[];
  if(!reels.length) return;
  const reelW=(rw-4)/3, reelH=rh;
  const SC=REEL_SYMBOLS.length;

  for(let i=0;i<3;i++) {
    const r=reels[i]||{pos:0,stopped:true};
    const rx2=rx+i*(reelW+2);

    ctx.fillStyle='#0a100a'; ctx.fillRect(rx2,ry,reelW,reelH);
    ctx.save();
    ctx.beginPath(); ctx.rect(rx2,ry,reelW,reelH); ctx.clip();

    const symH=reelH*.92;
    const frac=r.pos%1;
    for(let j=-1;j<=1;j++) {
      const idx=((Math.floor(r.pos)+j)%SC+SC*100)%SC;
      const sym=REEL_SYMBOLS[idx];
      const col=REEL_COLORS[idx];
      const sy=ry+(j-frac+.5)*symH+symH*.5;
      const isCenter=r.stopped&&j===0;
      ctx.fillStyle=col;
      ctx.font=`bold ${Math.floor(symH*.44)}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      if(isCenter){ctx.shadowColor=col;ctx.shadowBlur=5;}
      ctx.fillText(sym,rx2+reelW/2,sy);
      ctx.shadowBlur=0;
    }
    ctx.restore();

    ctx.strokeStyle='rgba(255,220,0,.3)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.moveTo(rx2,ry+reelH*.35); ctx.lineTo(rx2+reelW,ry+reelH*.35);
    ctx.moveTo(rx2,ry+reelH*.65); ctx.lineTo(rx2+reelW,ry+reelH*.65);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.lineWidth=1;
    ctx.strokeRect(rx2,ry,reelW,reelH);
  }

  // Payline
  ctx.strokeStyle='rgba(255,200,0,.45)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(rx,ry+reelH/2); ctx.lineTo(rx+rw,ry+reelH/2); ctx.stroke();
}

function updateMachineReels(dt) {
  const now=Date.now();
  for(const m of G.machines) {
    if(!m._reels) continue;
    for(const r of m._reels) {
      if(r.stopped) continue;
      if(now>=r.stopAt) {
        const remaining=r.target-r.pos;
        if(remaining<=0.04) {
          r.pos=r.target;
          r.stopped=true;
          r.speed=0;
        } else {
          r.speed=Math.max(1.0,remaining*2.5);
          r.pos+=r.speed*dt/1000;
        }
      } else {
        r.pos+=r.speed*dt/1000;
      }
    }
  }
}

function startMachineReels(m,result) {
  if(!m._reels) initMachineReels(m);
  const SC=REEL_SYMBOLS.length;
  const now=Date.now();
  const stopDelays=[1800,2300,2800];
  m._reels.forEach((r,i)=>{
    const targetSym=REEL_SYMBOLS.indexOf(result[i]);
    const curSym=Math.round(r.pos)%SC;
    const advance=(targetSym-curSym+SC)%SC;
    r.target=Math.round(r.pos)+6*SC+advance;
    r.speed=14;
    r.stopped=false;
    r.stopAt=now+stopDelays[i];
  });
}

// ── Kiosk Sprite ───────────────────────────
function drawKioskSprite(m,def,x,y,w,h) {
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#2a8850'); g.addColorStop(1,'#164428');
  ctx.fillStyle=g; prect(x+2,y+2,w-4,h-4,5); ctx.fill();
  ctx.strokeStyle=G.selectedMid===m.id?'#f0d080':'rgba(255,255,255,.2)';
  ctx.lineWidth=G.selectedMid===m.id?2:1;
  prect(x+2,y+2,w-4,h-4,5); ctx.stroke();

  // Screen
  ctx.fillStyle='#060c08'; prect(x+8,y+8,w-16,h*.55,3); ctx.fill();
  ctx.fillStyle='#20c060'; ctx.font='bold 6px monospace';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText('TICKET',x+w/2,y+12);
  ctx.fillText('KIOSK',x+w/2,y+20);
  ctx.fillStyle='#80ff80'; ctx.font='18px serif';
  ctx.textBaseline='middle';
  ctx.fillText('🏧',x+w/2,y+h*.5);
  ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font='5px monospace';
  ctx.textBaseline='bottom';
  ctx.fillText('INSERT TICKET',x+w/2,y+h-4);
}

// ── Cashier Window Sprite ──────────────────
function drawCashierSprite(m,def,x,y,w,h) {
  // Counter top
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#7040b0'); g.addColorStop(1,'#3a1860');
  ctx.fillStyle=g; prect(x+2,y+2,w-4,h-4,4); ctx.fill();
  ctx.strokeStyle=G.selectedMid===m.id?'#f0d080':'rgba(255,255,255,.2)';
  ctx.lineWidth=G.selectedMid===m.id?2:1;
  prect(x+2,y+2,w-4,h-4,4); ctx.stroke();

  // Window glass
  ctx.fillStyle='rgba(180,200,255,.12)';
  ctx.fillRect(x+8,y+4,w-16,h*.6);
  ctx.strokeStyle='rgba(180,200,255,.25)'; ctx.lineWidth=1;
  ctx.strokeRect(x+8,y+4,w-16,h*.6);

  // Cash counter surface
  ctx.fillStyle='#2a1808';
  ctx.fillRect(x+4,y+h*.62,w-8,h*.3);
  ctx.strokeStyle='#5a3a18'; ctx.lineWidth=1;
  ctx.strokeRect(x+4,y+h*.62,w-8,h*.3);

  // Queue light indicator
  const hasQueue=G.cashierQueue.length>0;
  ctx.fillStyle=hasQueue?'#ff4040':'#204020';
  ctx.beginPath(); ctx.arc(x+w-10,y+8,5,0,Math.PI*2); ctx.fill();
  if(hasQueue) {
    ctx.shadowColor='#ff4040'; ctx.shadowBlur=6;
    ctx.strokeStyle='#ff8080'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(x+w-10,y+8,5,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0;
  }

  // Icon
  ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('💰',x+w/2,y+h*.35);
  ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='bold 5px monospace';
  ctx.textBaseline='bottom'; ctx.fillText('CASHIER',x+w/2,y+h-3);
}

// ── Bar Sprite ─────────────────────────────
function drawBarSprite(m,def,x,y,w,h) {
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#7a3010'); g.addColorStop(1,'#3a1408');
  ctx.fillStyle=g; prect(x+2,y+2,w-4,h-4,4); ctx.fill();

  // Bar top surface
  ctx.fillStyle='#5c2800';
  ctx.fillRect(x+4,y+4,w-8,h*.55);
  ctx.strokeStyle='#8a4010'; ctx.lineWidth=1;
  ctx.strokeRect(x+4,y+4,w-8,h*.55);

  // Bottles row
  const bottleColors=['#e04040','#4060e0','#40a040','#e0a040'];
  for(let i=0;i<4;i++) {
    const bx2=x+8+i*(w-16)/3.5, by2=y+6;
    ctx.fillStyle=bottleColors[i];
    ctx.fillRect(bx2,by2,4,h*.4);
    ctx.fillStyle='rgba(255,255,255,.2)';
    ctx.fillRect(bx2,by2,2,h*.2);
    // Bottle top
    ctx.fillStyle=bottleColors[i];
    ctx.fillRect(bx2+1,by2-3,2,4);
  }

  // Counter front
  ctx.fillStyle='#3a1808';
  ctx.fillRect(x+2,y+h*.58,w-4,h*.38);
  ctx.strokeStyle='#6a3010'; ctx.lineWidth=1;
  ctx.strokeRect(x+2,y+h*.58,w-4,h*.38);

  // Active order progress
  const order=G.foodOrders.find(o=>o.barId===m.id&&o.state==='cooking');
  if(order) {
    const prog=Math.min(1,order.progress/FOOD_MENU.find(f=>f.id===order.item)?.prepTime||1);
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(x+4,y+h*.7,w-8,6);
    ctx.fillStyle='#40e040'; ctx.fillRect(x+4,y+h*.7,(w-8)*prog,6);
    ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.strokeRect(x+4,y+h*.7,w-8,6);
  }
  // Ready indicator
  const ready=G.foodOrders.find(o=>o.barId===m.id&&o.state==='ready');
  if(ready) {
    ctx.fillStyle='rgba(80,255,80,.8)';
    ctx.font='bold 7px monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
    const fi=FOOD_MENU.find(f=>f.id===ready.item);
    ctx.fillText(fi?.icon+' READY',x+w/2,y+h*.65);
  }

  ctx.strokeStyle=G.selectedMid===m.id?'#f0d080':'rgba(255,255,255,.15)';
  ctx.lineWidth=G.selectedMid===m.id?2:1;
  prect(x+2,y+2,w-4,h-4,4); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('BAR & GRILL',x+w/2,y+h-3);
}

// ── Surveillance Room Sprite ───────────────
function drawSurveillanceSprite(m,def,x,y,w,h) {
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#1a2840'); g.addColorStop(1,'#0c1620');
  ctx.fillStyle=g; prect(x+2,y+2,w-4,h-4,5); ctx.fill();
  ctx.strokeStyle=G.selectedMid===m.id?'#f0d080':'rgba(80,160,255,.3)';
  ctx.lineWidth=G.selectedMid===m.id?2:1;
  prect(x+2,y+2,w-4,h-4,5); ctx.stroke();

  // Mini monitor screens
  const cols=2,rows=2,pad=6,sw=(w-pad*3)/cols,sh=(h-pad*3)/rows;
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    const sx2=x+pad+col*(sw+pad), sy2=y+pad+row*(sh+pad);
    ctx.fillStyle='#030a06'; ctx.fillRect(sx2,sy2,sw,sh);
    ctx.strokeStyle='rgba(0,200,80,.25)'; ctx.lineWidth=.5; ctx.strokeRect(sx2,sy2,sw,sh);
    // Scanline
    ctx.fillStyle='rgba(0,200,80,.06)';
    for(let sl=0;sl<sh;sl+=2) ctx.fillRect(sx2,sy2+sl,sw,1);
    // Camera icon
    ctx.fillStyle='rgba(0,200,80,.5)'; ctx.font='7px serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('📷',sx2+sw/2,sy2+sh/2);
  }
  ctx.fillStyle='rgba(0,200,80,.5)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('SURVEILLANCE',x+w/2,y+h-3);
}

// ── Security Desk Sprite ───────────────────
function drawSecuritySprite(m,def,x,y,w,h) {
  const sel=G.selectedMid===m.id;
  const hasVisitor=G.lostAndFoundVisitors&&G.lostAndFoundVisitors.some(v=>v.machineId===m.id);

  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#1e3040'); g.addColorStop(1,'#0c1820');
  ctx.fillStyle=g; prect(x+2,y+2,w-4,h-4,5); ctx.fill();
  ctx.strokeStyle=sel?'#f0d080':hasVisitor?'#60e060':'rgba(80,160,255,.3)';
  ctx.lineWidth=sel||hasVisitor?2:1;
  prect(x+2,y+2,w-4,h-4,5); ctx.stroke();

  // Shield emblem
  ctx.fillStyle='rgba(80,160,255,.25)';
  ctx.beginPath();
  ctx.moveTo(x+w/2,y+8); ctx.lineTo(x+w-10,y+14);
  ctx.lineTo(x+w-10,y+h*.55); ctx.quadraticCurveTo(x+w/2,y+h*.75,x+10,y+h*.55);
  ctx.lineTo(x+10,y+14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(80,160,255,.5)'; ctx.lineWidth=1;
  ctx.stroke();

  // Active visitor indicator
  if(hasVisitor) {
    ctx.fillStyle='rgba(80,255,80,.85)'; ctx.font='bold 7px monospace';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('PATRON WAITING',x+w/2,y+h*.6);
  }

  ctx.fillStyle='rgba(100,180,255,.6)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('SECURITY',x+w/2,y+h-3);
}

// ── Table Sprite ───────────────────────────
function drawTableSprite(m,def,x,y,w,h) {
  // Table surface
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#5a3018'); g.addColorStop(1,'#2a1408');
  ctx.fillStyle=g; prect(x+4,y+4,w-8,h-8,4); ctx.fill();
  // Table cloth
  ctx.fillStyle='rgba(180,20,20,.35)';
  prect(x+6,y+6,w-12,h-12,3); ctx.fill();
  // Table border
  ctx.strokeStyle=G.selectedMid===m.id?'#f0d080':'rgba(200,150,80,.4)';
  ctx.lineWidth=G.selectedMid===m.id?2:1.5;
  prect(x+4,y+4,w-8,h-8,4); ctx.stroke();
  // Legs
  const legSize=5;
  ctx.fillStyle='#2a1408';
  [[x+6,y+6],[x+w-6-legSize,y+6],[x+6,y+h-6-legSize],[x+w-6-legSize,y+h-6-legSize]].forEach(([lx,ly])=>{
    ctx.fillRect(lx,ly,legSize,legSize);
  });
  // Center cloth button
  ctx.fillStyle='rgba(220,180,60,.4)';
  ctx.beginPath(); ctx.arc(x+w/2,y+h/2,3,0,Math.PI*2); ctx.fill();
}

// ── Machine overlays (not rotated) ─────────
function drawMachineOverlays(m,def,sp,pw,ph) {
  // ── Broken overlay ──
  if(m.broken) {
    const t = Date.now()/400;
    const a = 0.35 + 0.3*Math.abs(Math.sin(t));
    ctx.fillStyle = `rgba(220,60,30,${a})`;
    ctx.fillRect(sp.x, sp.y, pw*TILE, ph*TILE);
    // Wrench icon
    ctx.font = `${Math.floor(Math.min(pw,ph)*TILE*0.45)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.9;
    ctx.fillText('🔧', sp.x+pw*TILE/2, sp.y+ph*TILE/2);
    ctx.globalAlpha = 1;
    // "TAP TO FIX" label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('TAP TO FIX', sp.x+pw*TILE/2, sp.y+ph*TILE+2);
    return; // skip other overlays when broken
  }

  // ── Health bar (only when below 70%) ──
  if(def.isSlot && def.degradePerSpin) {
    const health = m.health ?? 100;
    if(health < 70) {
      const bw = pw*TILE - 8;
      const bx = sp.x + 4, by = sp.y + ph*TILE - 7;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(bx, by, bw, 4);
      const col = health > 40 ? '#e0c040' : '#e04040';
      ctx.fillStyle = col;
      ctx.fillRect(bx, by, bw*(health/100), 4);
    }
  }

  // Upgrade stars
  const stars=(m.upgrades?.speed||0)+(m.upgrades?.luck||0)+(m.upgrades?.bet||0);
  if(stars>0) {
    ctx.fillStyle='#f0d080'; ctx.font='bold 7px monospace';
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText('★'.repeat(Math.min(stars,6)),sp.x+4,sp.y+4);
  }

  // Earn flash
  if(m._flash&&Date.now()-m._flash<800) {
    const a=1-(Date.now()-m._flash)/800;
    const dy=-18*(1-a);
    ctx.globalAlpha=a;
    ctx.fillStyle='#90e060'; ctx.font='bold 11px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(m._flashTxt||'',sp.x+pw*TILE/2,sp.y+ph*TILE/2+dy);
    ctx.globalAlpha=1;
  }
}

// ── Draw Patron ────────────────────────────
// ── Patron Sprite Sheet ──────────────────────
const PSHEET = {
  CELL_W:100, CELL_H:105, FRAMES:4,
  VARIANTS:{ GREEN:0, PURPLE:400, ORANGE:800, RED:1200 },
  DIRS:{ S:0, SW:1, W:2, NW:3, N:4, NE:5, E:6, SE:7 },
  IDLE_ROW:8, FRAME_MS:150
};
let _pImg=null, _pReady=false;
(function loadPatronSheet(){
  _pImg=new Image();
  _pImg.onload=()=>{ _pReady=true; };
  _pImg.onerror=()=>{ _pReady=false; };
  _pImg.src='patron_sprites_ALL.png';
})();

function _pDir(dx,dy){
  if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5) return null;
  const a=Math.atan2(dy,dx)*180/Math.PI;
  if(a>-22.5&&a<=22.5)   return 'E';
  if(a>22.5&&a<=67.5)    return 'SE';
  if(a>67.5&&a<=112.5)   return 'S';
  if(a>112.5&&a<=157.5)  return 'SW';
  if(a>157.5||a<=-157.5) return 'W';
  if(a>-157.5&&a<=-112.5)return 'NW';
  if(a>-112.5&&a<=-67.5) return 'N';
  return 'NE';
}
function _pVariant(p){
  if(p.isHighRoller) return 'RED';
  return ['GREEN','PURPLE','ORANGE'][p.id%3];
}

function drawPatron(p) {
  const sp=w2s(p.wx,p.wy);
  const x=sp.x, y=sp.y;

  // Delivery highlight ring
  if(typeof _highlightPid!=='undefined'&&_highlightPid===p.id){
    const pulse=0.5+0.5*Math.sin(Date.now()*0.008);
    ctx.strokeStyle=`rgba(80,220,120,${0.6+pulse*0.4})`;
    ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(x,y-4,16+pulse*3,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=`rgba(80,220,120,${0.1+pulse*0.08})`;
    ctx.beginPath();ctx.arc(x,y-4,16+pulse*3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#50e078';ctx.font='bold 7px monospace';
    ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText('DELIVER',x,y-24);
  }

  // Shadow
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath();ctx.ellipse(x,y+4,7,2.5,0,0,Math.PI*2);ctx.fill();

  if(_pReady) {
    // ── Sprite sheet rendering ──
    const now=Date.now();
    const dx=p.targetX-p.wx, dy=p.targetY-p.wy;
    const moving=Math.hypot(dx,dy)>1;
    if(moving){
      const d=_pDir(dx,dy);
      if(d) p._spriteDir=d;
      if(!p._spriteFrameT) p._spriteFrameT=now;
      p._spriteFrame=Math.floor((now-p._spriteFrameT)/PSHEET.FRAME_MS)%PSHEET.FRAMES;
    } else {
      p._spriteFrame=Math.floor(now/600)%PSHEET.FRAMES;
      p._spriteFrameT=null;
    }
    const dir=p._spriteDir||'S';
    const varX=PSHEET.VARIANTS[_pVariant(p)];
    const row=moving?PSHEET.DIRS[dir]:PSHEET.IDLE_ROW;
    const srcX=varX+(p._spriteFrame*PSHEET.CELL_W);
    const srcY=row*PSHEET.CELL_H;
    // Scale: display characters at ~20px tall (sprite is 105px)
    const scale=20/105;
    const dw=PSHEET.CELL_W*scale, dh=PSHEET.CELL_H*scale;
    ctx.drawImage(_pImg, srcX,srcY,PSHEET.CELL_W,PSHEET.CELL_H,
                  x-dw/2, y-dh*0.85, dw, dh);
  } else {
    // ── Procedural fallback ──
    ctx.fillStyle=shadecol(p.color,-30);
    ctx.fillRect(x-5,y+5,4,7);ctx.fillRect(x+1,y+5,4,7);
    ctx.fillStyle=p.color;ctx.fillRect(x-5,y-3,10,9);
    ctx.fillStyle='#f0c890';ctx.fillRect(x-4,y-10,8,8);
    ctx.fillStyle=p.hairColor||'#3a2808';ctx.fillRect(x-4,y-10,8,3);
    ctx.fillStyle='#1a1a1a';ctx.fillRect(x-2,y-7,2,2);ctx.fillRect(x+1,y-7,2,2);
  }

  // High roller crown
  if(p.isHighRoller){ctx.font='9px serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText('👑',x,y-(_pReady?18:10));}

  // State label pill
  const stateLabel=
      p.state==='PLAYING'           ?'PLAYING'
    :p.state==='WAITING_CASHIER'    ?'CASHIER'
    :p.state==='WALKING_TO_CASHIER' ?'CASHIER'
    :p.state==='WAITING_KIOSK'      ?'KIOSK'
    :p.state==='WALKING_TO_KIOSK'   ?'KIOSK'
    :p.state==='WAITING_AT_BAR'     ?'BAR'
    :p.state==='WALKING_TO_BAR'     ?'BAR'
    :p.state==='EATING'             ?'EATING'
    :p.state==='LEAVING'            ?'LEAVE'
    :p.state==='WAITING_JACKPOT'    ?'JACKPOT'
    :p.state==='WANDERING'          ?'WAIT...'
    :p.state==='IDLE_AT_TABLE'      ?'TABLE'
    :null;

  if(stateLabel){
    const labelY=y-(p.isHighRoller?(_pReady?32:23):(_pReady?24:14));
    ctx.font='bold 6px monospace';
    const tw=ctx.measureText(stateLabel).width;
    const px2=3, rx=x-tw/2-px2, ry=labelY-7, rw=tw+px2*2, rh=8, rr=2;
    ctx.fillStyle='rgba(0,0,0,.65)';
    ctx.beginPath();
    ctx.moveTo(rx+rr,ry);ctx.lineTo(rx+rw-rr,ry);ctx.arcTo(rx+rw,ry,rx+rw,ry+rr,rr);
    ctx.lineTo(rx+rw,ry+rh-rr);ctx.arcTo(rx+rw,ry+rh,rx+rw-rr,ry+rh,rr);
    ctx.lineTo(rx+rr,ry+rh);ctx.arcTo(rx,ry+rh,rx,ry+rh-rr,rr);
    ctx.lineTo(rx,ry+rr);ctx.arcTo(rx,ry,rx+rr,ry,rr);
    ctx.closePath();ctx.fill();
    const labelCol=stateLabel==='JACKPOT'?'#f0c840':stateLabel==='LEAVE'?'#e07070':stateLabel==='EATING'?'#f0a040':stateLabel==='WAIT...'?'#a0a0b0':stateLabel==='CASHIER'||stateLabel==='KIOSK'?'#60d0a0':'#c0d8ff';
    ctx.fillStyle=labelCol;ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.fillText(stateLabel,x,labelY-1);
  }

  // Mood dot
  const mood=p._mood!=null?p._mood:100;
  ctx.fillStyle=mood>66?'#50e050':mood>33?'#e0c040':'#e04040';
  ctx.fillRect(x+(_pReady?8:5),y-(_pReady?22:12),3,3);

  // Eating progress bar
  if(p.state==='EATING'&&p.eatTimer!=null){
    const EAT_TOTAL=4000;
    const pct=Math.max(0,Math.min(1,p.eatTimer/EAT_TOTAL));
    const bw=22,bh=4,bx=x-bw/2,by=y+14;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(bx-1,by-1,bw+2,bh+2);
    ctx.fillStyle='#e07030';ctx.fillRect(bx,by,bw*pct,bh);
    ctx.font='6px monospace';ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillText('🍽',x,by+bh+1);
  }

  // Ticket value
  if(p.ticketValue>0&&p.state!=='PLAYING'){
    ctx.fillStyle=p.isHighRoller?'#f0d060':'#8ad070';
    ctx.font=`bold ${p.isHighRoller?8:7}px monospace`;
    ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillText('$'+p.ticketValue.toFixed(2),x,y-(_pReady?26:21));
  }

  // Name
  ctx.fillStyle=p.isHighRoller?'rgba(240,210,80,.7)':'rgba(255,255,255,.45)';
  ctx.font='6px monospace';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(p.name,x,y+(_pReady?4:11));
}

// ── Draw Employee ──────────────────────────
function drawEmployee(e) {
  const sp=w2s(e.wx,e.wy);
  const x=sp.x, y=sp.y;
  const def=EMPLOYEE_DEFS[e.type];

  // Shadow
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(x,y+11,8,2.5,0,0,Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle='#1a1a2a';
  ctx.fillRect(x-5,y+5,4,7); ctx.fillRect(x+1,y+5,4,7);

  // Uniform torso (uses employee color)
  ctx.fillStyle=def.color;
  ctx.fillRect(x-5,y-3,10,9);
  // White shirt under jacket
  ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.fillRect(x-2,y-3,4,7);

  // Head
  ctx.fillStyle='#e8b878';
  ctx.fillRect(x-4,y-10,8,8);
  // Hair
  ctx.fillStyle='#2a2018';
  ctx.fillRect(x-4,y-10,8,3);
  // Eyes
  ctx.fillStyle='#1a1a1a';
  ctx.fillRect(x-2,y-7,2,2); ctx.fillRect(x+1,y-7,2,2);

  // Name tag
  ctx.fillStyle='rgba(0,0,0,.7)';
  ctx.fillRect(x-12,y+16,24,8);
  ctx.fillStyle=def.color; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(e.name.substring(0,7),x,y+20);

  // Type icon above head
  ctx.font='9px serif'; ctx.textBaseline='bottom';
  ctx.fillText(def.icon,x,y-12);

  // Task indicator
  if(e.task) {
    ctx.fillStyle='rgba(201,168,76,.8)'; ctx.font='6px monospace';
    ctx.textBaseline='bottom'; ctx.textAlign='center';
    const taskLabel=e.task==='cashier'?'💵':e.task==='jackpot'?'🏆':e.task==='food'?'🍽':'💼';
    ctx.fillText(taskLabel,x+12,y-3);
  }

  // Carrying tray
  if(e.carryingOrder) {
    const fi=FOOD_MENU.find(f=>f.id===e.carryingOrder.item);
    ctx.font='11px serif'; ctx.textBaseline='middle'; ctx.textAlign='center';
    ctx.fillText(fi?.icon||'📦',x+10,y-2);
  }
}

// ════════════════════════════════════════════
//  NEW MACHINE SPRITES
// ════════════════════════════════════════════

// ── Band Stage ─────────────────────────────
// ── Band / Entertainment stage ──────────────
// Cycles through: full band, solo guitarist, singer, comedian
const BAND_ACTS = ['band','guitarist','singer','comedian'];

function drawBandSprite(m, def, x, y, w, h) {
  const t = Date.now();
  const beat = (t % 800) / 800;    // 0..1 per beat
  const beatBop = Math.sin(beat * Math.PI * 2) * 2;

  // Pick act — rotate every 45 seconds
  if(!m._actIndex) m._actIndex = Math.floor(Math.random()*BAND_ACTS.length);
  if(!m._actTimer) m._actTimer = 0;
  m._actTimer += 16;
  if(m._actTimer > 45000) { m._actTimer = 0; m._actIndex = (m._actIndex+1) % BAND_ACTS.length; }
  const act = BAND_ACTS[m._actIndex];

  // Stage floor
  const sg = ctx.createLinearGradient(x, y+h*.6, x, y+h);
  sg.addColorStop(0,'#2a1a08'); sg.addColorStop(1,'#1a0e04');
  ctx.fillStyle = sg; ctx.fillRect(x, y+h*.6, w, h*.4);

  // Backdrop curtain
  ctx.fillStyle = '#380010'; ctx.fillRect(x+2, y+2, w-4, h*.62);
  for(let i=0;i<5;i++){
    ctx.fillStyle = i%2===0 ? '#4a0018' : '#300010';
    ctx.fillRect(x+2+i*(w-4)/5, y+2, (w-4)/5, h*.62);
  }

  // Stage lights
  const lightCols = ['#ff6060','#6060ff','#60ff60','#ffff60'];
  for(let i=0;i<3;i++){
    const lx=x+w*.2+i*w*.3, ly=y+4;
    const on = ((t+i*200)%600)<300;
    ctx.fillStyle = on ? lightCols[i] : lightCols[i].replace(/[0-9a-f]{2}/gi,'22');
    ctx.beginPath(); ctx.arc(lx,ly,4,0,Math.PI*2); ctx.fill();
    if(on){ ctx.shadowColor=lightCols[i]; ctx.shadowBlur=6; }
    ctx.fillStyle = on ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,0)';
    ctx.beginPath();
    ctx.moveTo(lx,ly+4); ctx.lineTo(lx-10,y+h*.58); ctx.lineTo(lx+10,y+h*.58);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0;
  }

  // Stage edge line
  ctx.strokeStyle='rgba(255,180,50,.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x,y+h*.62); ctx.lineTo(x+w,y+h*.62); ctx.stroke();

  // ── Draw performers based on act ──
  if(act==='band') {
    // Full 3-piece band: guitarist, keyboardist, trumpeter
    drawStagePerformer(m, x+w*.22, y+h*.4, beatBop, '#e04040', 'guitar');
    drawStagePerformer(m, x+w*.5,  y+h*.38, beatBop*0.5, '#4080e0', 'keys');
    drawStagePerformer(m, x+w*.78, y+h*.4, -beatBop, '#e0a040', 'trumpet');
    ctx.fillStyle='rgba(255,180,0,.7)'; ctx.font=`bold ${Math.floor(w*.065)}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('LIVE BAND', x+w/2, y+h-2);
  } else if(act==='guitarist') {
    drawStagePerformer(m, x+w*.5, y+h*.38, beatBop, '#e06030', 'guitar');
    // Mic stand
    ctx.strokeStyle='#888'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x+w*.4,y+h*.4); ctx.lineTo(x+w*.4,y+h*.6); ctx.stroke();
    ctx.fillStyle='#aaa'; ctx.beginPath(); ctx.arc(x+w*.4,y+h*.4,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,180,0,.7)'; ctx.font=`bold ${Math.floor(w*.065)}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('SOLO ACT', x+w/2, y+h-2);
  } else if(act==='singer') {
    drawStagePerformer(m, x+w*.5, y+h*.37, beatBop, '#d040d0', 'singer');
    // Mic in hand
    ctx.fillStyle='#ccc'; ctx.fillRect(x+w*.5+4, y+h*.44, 2, 7);
    ctx.beginPath(); ctx.arc(x+w*.5+5, y+h*.44, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,180,0,.7)'; ctx.font=`bold ${Math.floor(w*.065)}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('LIVE SINGER', x+w/2, y+h-2);
  } else if(act==='comedian') {
    // Comedian at mic stand — less bop, more sway
    const sway = Math.sin(t/1200)*3;
    drawStagePerformer(m, x+w*.5+sway, y+h*.38, 0, '#40a0e0', 'comedian');
    // Mic stand
    ctx.strokeStyle='#888'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x+w*.48,y+h*.42); ctx.lineTo(x+w*.48,y+h*.62); ctx.stroke();
    ctx.fillStyle='#aaa'; ctx.beginPath(); ctx.arc(x+w*.48,y+h*.42,2,0,Math.PI*2); ctx.fill();
    // Spotlight
    ctx.fillStyle='rgba(255,255,100,.06)';
    ctx.beginPath(); ctx.ellipse(x+w*.5,y+h*.5,w*.18,h*.22,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,180,0,.7)'; ctx.font=`bold ${Math.floor(w*.065)}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('COMEDY', x+w/2, y+h-2);
  }
}

// ── Draw a pixel-art stage performer ────────
function drawStagePerformer(m, cx, cy, bop, color, role) {
  const by = bop || 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(cx, cy+14, 5, 2, 0, 0, Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(cx-4, cy+6+by, 3, 7);
  ctx.fillRect(cx+1,  cy+6+by, 3, 7);

  // Torso / shirt
  ctx.fillStyle = color;
  ctx.fillRect(cx-4, cy-2+by, 8, 9);

  // Head
  ctx.fillStyle = '#f0c890';
  ctx.fillRect(cx-3, cy-9+by, 6, 7);

  // Hair (randomised per performer role)
  const hairCol = role==='singer'?'#d060a0':role==='comedian'?'#2040c0':'#2a1a08';
  ctx.fillStyle = hairCol;
  ctx.fillRect(cx-3, cy-9+by, 6, 2);

  // Eyes
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(cx-2, cy-6+by, 1, 1);
  ctx.fillRect(cx+1,  cy-6+by, 1, 1);

  // Instrument / prop
  if(role==='guitar') {
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(cx+3, cy-1+by, 2, 8);
    ctx.fillStyle = '#c8761c';
    ctx.beginPath(); ctx.ellipse(cx+4, cy+4+by, 3, 4, 0.3, 0, Math.PI*2); ctx.fill();
    // String
    ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=.5;
    ctx.beginPath(); ctx.moveTo(cx+3,cy-1+by); ctx.lineTo(cx+5,cy+7+by); ctx.stroke();
  } else if(role==='keys') {
    // Keyboard
    ctx.fillStyle = '#222';
    ctx.fillRect(cx-7, cy+1+by, 14, 5);
    ctx.fillStyle = '#fff';
    for(let k=0;k<4;k++) ctx.fillRect(cx-6+k*3, cy+1+by, 2, 4);
    ctx.fillStyle = '#111';
    for(let k=0;k<3;k++) ctx.fillRect(cx-5+k*3, cy+1+by, 1, 3);
  } else if(role==='trumpet') {
    ctx.fillStyle = '#d4a820';
    ctx.fillRect(cx+2, cy+1+by, 8, 2);
    ctx.beginPath(); ctx.arc(cx+10, cy+2+by, 3, 0, Math.PI*2); ctx.fill();
  } else if(role==='singer'||role==='comedian') {
    // Arm raised slightly
    ctx.fillStyle = color;
    ctx.fillRect(cx+3, cy-1+by, 2, 5);
  }
}

// ── Sportsbook ─────────────────────────────
// drawSportsbookSprite defined in sports.js


// ── TV Screen ──────────────────────────────
function drawTvScreenSprite(m,def,x,y,w,h) {
  const t=Date.now();
  // Outer TV casing
  ctx.fillStyle='#08080c'; prect(x+2,y+2,w-4,h-4,4); ctx.fill();
  ctx.strokeStyle='rgba(80,120,200,.3)'; ctx.lineWidth=1;
  prect(x+2,y+2,w-4,h-4,4); ctx.stroke();

  // Screen area — show a cycling sport
  const sx2=x+4, sy2=y+4, sw=w-8, sh=h-10;
  ctx.save();
  ctx.beginPath(); ctx.rect(sx2,sy2,sw,sh); ctx.clip();
  ctx.translate(sx2,sy2);
  // Each TV picks its own sport from sports.js
  const sport=getSportForMachine(m);
  SPORT_ANIM[sport](ctx,sw,sh,t);
  ctx.translate(-sx2,-sy2);
  ctx.restore();
  ctx.strokeStyle='rgba(80,120,200,.25)'; ctx.lineWidth=.5; ctx.strokeRect(sx2,sy2,sw,sh);

  // Stand
  ctx.fillStyle='#141418';
  ctx.fillRect(x+w*.35,y+h-5,w*.3,3);
  ctx.fillRect(x+w*.2,y+h-3,w*.6,3);
}

// ── Blackjack Table ─────────────────────────
function drawBlackjackSprite(m,def,x,y,w,h) {
  // Green felt
  const g=ctx.createRadialGradient(x+w/2,y+h/2,4,x+w/2,y+h/2,w*.7);
  g.addColorStop(0,'#0a4020'); g.addColorStop(1,'#062810');
  ctx.fillStyle=g; prect(x+3,y+3,w-6,h-6,8); ctx.fill();
  ctx.strokeStyle='#d4a820'; ctx.lineWidth=1.5;
  prect(x+3,y+3,w-6,h-6,8); ctx.stroke();

  const ts=TABLE_STATES[m.id];
  const phase=ts?.phase||'betting';

  // Dealer area (top third)
  ctx.strokeStyle='rgba(212,168,32,.3)'; ctx.lineWidth=.5;
  ctx.beginPath(); ctx.ellipse(x+w/2,y+h*.25,w*.35,h*.12,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(212,168,32,.15)'; ctx.fill();

  // Draw dealer cards if available
  if(ts?.dealerCards?.length) {
    drawMiniCards(ts.dealerCards, x+w/2, y+h*.22, ts.dealerRevealed);
  }

  // Player arc seats
  const seats=def.seats||5;
  for(let i=0;i<seats;i++){
    const a=(i/(seats-1))*(Math.PI*.8)+Math.PI*.1;
    const sx2=x+w/2+Math.cos(a)*w*.4;
    const sy2=y+h*.65+Math.sin(a)*h*.22;
    const pl=ts?.players?.find(p=>ts.players.indexOf(p)===i);
    ctx.fillStyle=pl?'rgba(212,168,32,.3)':'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.ellipse(sx2,sy2,10,6,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(212,168,32,.2)'; ctx.lineWidth=.5; ctx.stroke();
    if(pl?.cards?.length) drawMiniCards(pl.cards,sx2,sy2+4,true,0.7);
  }

  ctx.fillStyle='rgba(212,168,32,.5)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('BLACKJACK  '+(ts?.players?.length||0)+'/'+seats,x+w/2,y+h-3);
}

// ── Roulette Table ──────────────────────────
function drawRouletteSprite(m,def,x,y,w,h) {
  const g=ctx.createRadialGradient(x+w/2,y+h*.4,4,x+w/2,y+h*.4,w*.6);
  g.addColorStop(0,'#1a0006'); g.addColorStop(1,'#0a0004');
  ctx.fillStyle=g; prect(x+3,y+3,w-6,h-6,8); ctx.fill();
  ctx.strokeStyle='#d4a820'; ctx.lineWidth=1.5;
  prect(x+3,y+3,w-6,h-6,8); ctx.stroke();

  const ts=TABLE_STATES[m.id];
  const wheelAngle=ts?.wheelAngle||0;
  const ballAngle=ts?.ballAngle||0;

  // Wheel
  const wx=x+w/2, wy=y+h*.38, wr=Math.min(w,h)*.26;
  ctx.save();
  ctx.translate(wx,wy); ctx.rotate(wheelAngle);
  const nums=ROULETTE_NUMS;
  for(let i=0;i<nums.length;i++){
    const a=(i/nums.length)*Math.PI*2;
    const na=((i+1)/nums.length)*Math.PI*2;
    ctx.fillStyle=nums[i]===0?'#007000':RED_NUMS.has(nums[i])?'#880000':'#111';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,wr,a,na); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(212,168,32,.15)'; ctx.lineWidth=.3; ctx.stroke();
    // Number
    if(wr>14) {
      const mid=(a+na)/2, nr=wr*.72;
      ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font='bold 4px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(nums[i],Math.cos(mid)*nr,Math.sin(mid)*nr);
    }
  }
  ctx.restore();
  // Outer ring
  ctx.strokeStyle='#d4a820'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(wx,wy,wr+2,0,Math.PI*2); ctx.stroke();
  // Center hub
  ctx.fillStyle='#d4a820'; ctx.beginPath(); ctx.arc(wx,wy,4,0,Math.PI*2); ctx.fill();
  // Ball
  if(ts?.phase==='spinning'||ts?.phase==='result') {
    const br=wr+5;
    ctx.fillStyle='#fff'; ctx.beginPath();
    ctx.arc(wx+Math.cos(ballAngle)*br,wy+Math.sin(ballAngle)*br,2.5,0,Math.PI*2);
    ctx.fill();
  }

  // Betting layout (bottom)
  const bx=x+4, by=y+h*.7, bw=w-8, bht=h*.22;
  ctx.fillStyle='rgba(0,100,0,.3)'; ctx.fillRect(bx,by,bw,bht);
  ctx.strokeStyle='rgba(212,168,32,.2)'; ctx.lineWidth=.5; ctx.strokeRect(bx,by,bw,bht);
  ctx.fillStyle='rgba(212,168,32,.4)'; ctx.font='5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('RED  /  BLACK',bx+bw/2,by+bht/2);

  ctx.fillStyle='rgba(212,168,32,.5)'; ctx.font='bold 5px monospace';
  ctx.textBaseline='bottom'; ctx.fillText('ROULETTE',x+w/2,y+h-2);
}

// ── Poker Table ─────────────────────────────
function drawPokerSprite(m,def,x,y,w,h) {
  const g=ctx.createRadialGradient(x+w/2,y+h/2,4,x+w/2,y+h/2,w*.65);
  g.addColorStop(0,'#0a1f08'); g.addColorStop(1,'#060c04');
  ctx.fillStyle=g; prect(x+3,y+3,w-6,h-6,10); ctx.fill();
  ctx.strokeStyle='#d4a820'; ctx.lineWidth=1.5;
  prect(x+3,y+3,w-6,h-6,10); ctx.stroke();

  const ts=TABLE_STATES[m.id];
  // Community cards in centre
  if(ts?.communityCards?.length) {
    drawMiniCards(ts.communityCards, x+w/2, y+h*.42, true, 0.75);
  }
  // Player positions around oval
  const seats=def.seats||6;
  for(let i=0;i<seats;i++){
    const a=(i/seats)*Math.PI*2-Math.PI/2;
    const sx2=x+w/2+Math.cos(a)*w*.38;
    const sy2=y+h/2+Math.sin(a)*h*.35;
    const pl=ts?.players?.find((_,idx)=>idx===i);
    ctx.fillStyle=pl?'rgba(212,168,32,.3)':'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.ellipse(sx2,sy2,9,5,0,0,Math.PI*2); ctx.fill();
    if(pl?.cards?.length) drawMiniCards(pl.cards,sx2,sy2,true,0.65);
  }

  ctx.fillStyle='rgba(212,168,32,.5)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('POKER  '+(ts?.players?.length||0)+'/'+seats,x+w/2,y+h-3);
}

// ── Helper: draw mini card faces ────────────
function drawMiniCards(cards, cx2, cy2, revealed, scale=1) {
  const cw=10*scale, ch=14*scale;
  const startX=cx2-(cards.length*cw*.55);
  for(let i=0;i<cards.length&&i<5;i++){
    const cx3=startX+i*cw*.85;
    ctx.fillStyle=revealed?'#f8f0e0':'#1a3a6a';
    prect(cx3-cw/2,cy2-ch/2,cw,ch,1); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=.5;
    prect(cx3-cw/2,cy2-ch/2,cw,ch,1); ctx.stroke();
    if(revealed&&cards[i]){
      const isRed=cards[i].s==='♥'||cards[i].s==='♦';
      ctx.fillStyle=isRed?'#cc0000':'#111';
      ctx.font=`bold ${Math.floor(4.5*scale)}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(cards[i].r+cards[i].s,cx3,cy2);
    }
  }
}

// ── Wire new sprites into drawMachine ───────
// (Called from the existing drawMachine dispatch already handles isBand etc
//  only if we add them — patch the dispatch here)
const _origDrawMachineInner = null; // patched below via monkey-patch

function drawNewMachineSprite(m, def, ox, oy, dw, dh) {
  if(def.isBand)          drawBandSprite(m,def,ox,oy,dw,dh);
  else if(def.isSportsbook)drawSportsbookSprite(m,def,ox,oy,dw,dh);
  else if(def.isTvScreen)  drawTvScreenSprite(m,def,ox,oy,dw,dh);
  else if(def.tableGame==='blackjack') drawBlackjackSprite(m,def,ox,oy,dw,dh);
  else if(def.tableGame==='roulette')  drawRouletteSprite(m,def,ox,oy,dw,dh);
  else if(def.tableGame==='poker')     drawPokerSprite(m,def,ox,oy,dw,dh);
  else return false;
  return true;
}
