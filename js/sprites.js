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

  if(def.isSlot)        drawSlotSprite(m,def,ox,oy,dw,dh);
  else if(def.isKiosk)  drawKioskSprite(m,def,ox,oy,dw,dh);
  else if(def.isCashier)drawCashierSprite(m,def,ox,oy,dw,dh);
  else if(def.isBar)    drawBarSprite(m,def,ox,oy,dw,dh);
  else if(def.isTable)  drawTableSprite(m,def,ox,oy,dw,dh);

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
    {pos:0,speed:0,stopped:true,target:0},
    {pos:0,speed:0,stopped:true,target:0},
    {pos:0,speed:0,stopped:true,target:0}
  ];
}

function drawSlotReels(m,rx,ry,rw,rh) {
  const reels=m._reels||[];
  if(!reels.length) return;
  const reelW=(rw-4)/3, reelH=rh;

  for(let i=0;i<3;i++) {
    const r=reels[i]||{pos:0,stopped:true};
    const rx2=rx+i*(reelW+2);

    // Reel bg
    ctx.fillStyle='#0a100a'; ctx.fillRect(rx2,ry,reelW,reelH);

    // Clip to reel window
    ctx.save();
    ctx.beginPath(); ctx.rect(rx2,ry,reelW,reelH); ctx.clip();

    // Draw 3 symbols (previous, current, next)
    const symH=reelH*.95;
    const frac=r.pos%1;
    for(let j=-1;j<=1;j++) {
      const idx=((Math.floor(r.pos)+j+REEL_SYMBOLS.length*100)%REEL_SYMBOLS.length);
      const sym=REEL_SYMBOLS[idx];
      const col=REEL_COLORS[idx];
      const sy=ry+(j-frac+.5)*symH+symH*.5;

      // Symbol bg highlight for center
      if(r.stopped && j===0) {
        ctx.fillStyle='rgba(255,255,255,.06)';
        ctx.fillRect(rx2,ry+symH*.25,reelW,symH*.5);
      }

      // Draw symbol text
      ctx.fillStyle=col;
      ctx.font=`bold ${Math.floor(symH*.45)}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor=col; ctx.shadowBlur=r.stopped&&j===0?4:0;
      ctx.fillText(sym,rx2+reelW/2,sy);
      ctx.shadowBlur=0;
    }

    ctx.restore();

    // Reel divider lines
    ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.lineWidth=1;
    ctx.strokeRect(rx2,ry,reelW,reelH);

    // Center payline highlight
    ctx.strokeStyle='rgba(255,220,0,.35)'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(rx2,ry+reelH/2-symH*.25);
    ctx.lineTo(rx2+reelW,ry+reelH/2-symH*.25);
    ctx.moveTo(rx2,ry+reelH/2+symH*.25);
    ctx.lineTo(rx2+reelW,ry+reelH/2+symH*.25);
    ctx.stroke();
  }

  // Payline center marker
  ctx.strokeStyle='rgba(255,220,0,.5)'; ctx.lineWidth=1.5;
  ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(rx,ry+reelH/2); ctx.lineTo(rx+rw,ry+reelH/2); ctx.stroke();
  ctx.setLineDash([]);
}

function updateMachineReels(dt) {
  for(const m of G.machines) {
    if(!m._reels) continue;
    const spinning=m._reels.some(r=>!r.stopped);
    if(!spinning) continue;
    for(let i=0;i<3;i++) {
      const r=m._reels[i];
      if(r.stopped) continue;
      r.pos+=r.speed*dt/1000;
      if(r.speed>0) {
        // Decelerating stop
        const dist=r.target+Math.ceil(r.pos)-r.pos;
        if(r.speed<0.5 && dist<0.15) {
          r.pos=r.target+Math.ceil(r.pos-r.target%1);
          // Snap to exact integer
          r.pos=Math.round(r.pos);
          r.stopped=true; r.speed=0;
        } else {
          r.speed=Math.max(0.4,r.speed-r.speed*dt*.003);
        }
      }
    }
  }
}

function startMachineReels(m,result) {
  if(!m._reels) initMachineReels(m);
  const symIndices=result.map(sym=>REEL_SYMBOLS.indexOf(sym));
  const speeds=[12,11,10];
  const delays=[0,400,800];
  m._reels.forEach((r,i)=>{
    r.stopped=false;
    r.speed=speeds[i];
    const base=Math.round(r.pos)+8;
    r.target=base+(symIndices[i]>=0?symIndices[i]:Math.floor(Math.random()*REEL_SYMBOLS.length));
    // Stagger stop
    setTimeout(()=>{ r.speed=0.5; },1800+delays[i]);
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
function drawPatron(p) {
  const sp=w2s(p.wx,p.wy);
  const x=sp.x, y=sp.y, r=10;

  // Shadow
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(x,y+r+1,r*.8,2.5,0,0,Math.PI*2); ctx.fill();

  // Body — pixel-art style character
  // Legs
  ctx.fillStyle=shadecol(p.color,-30);
  ctx.fillRect(x-5,y+5,4,7);
  ctx.fillRect(x+1,y+5,4,7);
  // Torso
  ctx.fillStyle=p.color;
  ctx.fillRect(x-5,y-3,10,9);
  // Head
  ctx.fillStyle='#f0c890';
  ctx.fillRect(x-4,y-10,8,8);
  // Hair
  ctx.fillStyle=p.hairColor||'#3a2808';
  ctx.fillRect(x-4,y-10,8,3);
  // Eyes
  ctx.fillStyle='#1a1a1a';
  ctx.fillRect(x-2,y-7,2,2);
  ctx.fillRect(x+1,y-7,2,2);

  // State indicators
  const em=p.state==='PLAYING'?'🎰'
          :p.state==='WAITING_CASHIER'||p.state==='WALKING_TO_CASHIER'?'💵'
          :p.state==='WAITING_KIOSK'||p.state==='WALKING_TO_KIOSK'?'🏧'
          :p.state==='WAITING_AT_BAR'||p.state==='WALKING_TO_BAR'?'🍺'
          :p.state==='EATING'?'🍽'
          :p.state==='LEAVING'?'🚶'
          :p.state==='WAITING_JACKPOT'?'🏆':null;

  if(em) {
    ctx.font='9px serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText(em,x,y-11);
  }

  // Ticket value
  if(p.ticketValue>0&&p.state!=='PLAYING') {
    ctx.fillStyle='#8ad070'; ctx.font='bold 7px monospace';
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText('$'+p.ticketValue.toFixed(2),x,y-21);
  }

  // Name
  ctx.fillStyle='rgba(255,255,255,.45)';
  ctx.font='6px monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(p.name,x,y+r+3);
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
