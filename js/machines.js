// ═══════════════════════════════════════════
//  machines.js — Place / rotate / upgrade / sell
// ═══════════════════════════════════════════

function placeMachine(type,tx,ty,rot) {
  const def=MACHINE_DEFS[type];
  if(!def) return false;
  if(G.money<def.cost){toast('Need $'+def.cost.toLocaleString(),'r');return false;}

  const r=rot||G.placementRotation||0;
  const pw=r%2===0?def.w:def.h;
  const ph=r%2===0?def.h:def.w;

  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(tx+dx,ty+dy)||tileOccupied(tx+dx,ty+dy)){toast('Cannot place here!','r');return false;}

  G.money-=def.cost;
  G.machines.push({
    id:G.nextMid++, type, tx, ty, rotation:r,
    upgrades:{speed:0,luck:0,bet:0},
    occupied:null, totalEarned:0
  });
  toast('Placed '+def.name,'g');
  return true;
}

function rotatePlacement() {
  G.placementRotation=(G.placementRotation+1)%4;
}

function rotateSelected(){
  if(!G.selectedMid) return;
  const m=G.machines.find(m=>m.id===G.selectedMid);
  if(!m) return;
  const def=MACHINE_DEFS[m.type];
  const newRot=(m.rotation+1)%4;
  const pw=newRot%2===0?def.w:def.h, ph=newRot%2===0?def.h:def.w;
  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(m.tx+dx,m.ty+dy)||tileOccupied(m.tx+dx,m.ty+dy,m.id)){toast('Cannot rotate here!','r');return;}
  m.rotation=newRot;
  openUpgradePanel(m.id);
}

// Draw live reels in the upgrade panel preview canvas
function drawUpgPanelReels(){
  const c=document.getElementById('upg-reel-canvas');
  if(!c||!G._upgPanelMid) return;
  const m=G.machines.find(m=>m.id===G._upgPanelMid);
  if(!m||!m._reels) return;
  const mc=c.getContext('2d');
  mc.imageSmoothingEnabled=false;
  mc.fillStyle='#060a06'; mc.fillRect(0,0,c.width,c.height);
  drawSlotReelsOnCtx(mc,m._reels,2,2,c.width-4,c.height-4);
}

function drawSlotReelsOnCtx(mc,reels,rx,ry,rw,rh){
  const SC=REEL_SYMBOLS.length;
  const reelW=(rw-4)/3, reelH=rh;
  for(let i=0;i<3;i++){
    const r=reels[i]||{pos:0,stopped:true};
    const rx2=rx+i*(reelW+2);
    mc.fillStyle='#0a100a'; mc.fillRect(rx2,ry,reelW,reelH);
    mc.save(); mc.beginPath(); mc.rect(rx2,ry,reelW,reelH); mc.clip();
    const symH=reelH*.9;
    const frac=r.pos%1;
    for(let j=-1;j<=1;j++){
      const idx=((Math.floor(r.pos)+j)%SC+SC*100)%SC;
      const sym=REEL_SYMBOLS[idx];
      const col=REEL_COLORS[idx];
      const sy=ry+(j-frac+.5)*symH+symH*.5;
      mc.fillStyle=col;
      mc.font=`bold ${Math.floor(symH*.44)}px monospace`;
      mc.textAlign='center'; mc.textBaseline='middle';
      mc.fillText(sym,rx2+reelW/2,sy);
    }
    mc.restore();
    mc.strokeStyle='rgba(255,255,255,.1)'; mc.lineWidth=.5; mc.strokeRect(rx2,ry,reelW,reelH);
  }
  mc.strokeStyle='rgba(255,200,0,.4)'; mc.lineWidth=1;
  mc.beginPath(); mc.moveTo(rx,ry+reelH/2); mc.lineTo(rx+rw,ry+reelH/2); mc.stroke();
}

// ── Floor expansion ─────────────────────────
function expandFloor(){
  const nextLevel=G.floorLevel+1;
  if(nextLevel>=FLOOR_LEVELS.length){toast('Already at maximum size!');return;}
  const lv=FLOOR_LEVELS[nextLevel];
  if(G.money<lv.cost){toast('Need $'+lv.cost.toLocaleString()+' to expand!','r');return;}
  if(!confirm('Expand to '+lv.label+' floor ($'+lv.cost.toLocaleString()+')?')) return;
  G.money-=lv.cost;
  G.floorLevel=nextLevel;
  G.floorW=lv.w; G.floorH=lv.h;
  clampCam();
  toast('Floor expanded to '+lv.label+'!','g');
}

// ── Open upgrade panel ─────────────────────
function openUpgradePanel(mid) {
  const m=G.machines.find(m=>m.id===mid);
  if(!m) return;
  G.selectedMid=mid;
  const def=MACHINE_DEFS[m.type];
  document.getElementById('upg-title').textContent=def.icon+' '+def.name;

  const sg=document.getElementById('mstats');
  if(def.isSlot) {
    const bl=m.upgrades.bet||0, ll=m.upgrades.luck||0;
    sg.innerHTML=`
      <div class="mstat-box"><div class="mstat-lbl">Bet Range</div>
        <div class="mstat-val">$${(def.betMin*(1+bl*.25)).toFixed(2)}–$${(def.betMax*(1+bl*.25)).toFixed(2)}</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Win Rate</div>
        <div class="mstat-val">${((def.winRate+ll*.02)*100).toFixed(0)}%</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Total Earned</div>
        <div class="mstat-val">$${(m.totalEarned||0).toFixed(2)}</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Status</div>
        <div class="mstat-val">${m.occupied!=null?'🟢 Active':'⚪ Idle'}</div></div>
      <div class="mstat-box" style="grid-column:span 2">
        <div class="mstat-lbl">Live Reels</div>
        <canvas id="upg-reel-canvas" width="220" height="50" style="width:100%;border-radius:4px;margin-top:3px;image-rendering:pixelated"></canvas>
      </div>`;
    // Store reference for live updates
    G._upgPanelMid=mid;
  } else {
    sg.innerHTML=`
      <div class="mstat-box"><div class="mstat-lbl">Rotation</div>
        <div class="mstat-val">${['↓S','←W','↑N','→E'][m.rotation||0]}</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Cost Paid</div>
        <div class="mstat-val">$${def.cost}</div></div>`;
    G._upgPanelMid=null;
  }

  const og=document.getElementById('upg-options');
  og.innerHTML='';
  if(def.isSlot) {
    for(const [key,upg] of Object.entries(UPGRADES)) {
      const lv=m.upgrades[key]||0, maxd=lv>=upg.maxLv;
      const cost=Math.round(upg.baseCost*Math.pow(upg.mult,lv));
      const row=document.createElement('div'); row.className='upg-row';
      row.innerHTML=`<div class="upg-info"><h4>${upg.icon} ${upg.name} ${'★'.repeat(lv)}${'☆'.repeat(upg.maxLv-lv)}</h4>
        <p>${upg.desc}${maxd?' (MAX)':' — $'+cost}</p></div>
        <button class="btn-upg" ${maxd||G.money<cost?'disabled':''} data-key="${key}" data-cost="${cost}">
          ${maxd?'MAX':'$'+cost}</button>`;
      row.querySelector('.btn-upg').onclick=()=>buyUpgrade(mid,key,cost);
      og.appendChild(row);
    }
  }
  // Rotate row
  const rRow=document.createElement('div'); rRow.className='upg-row';
  rRow.innerHTML=`<div class="upg-info"><h4>🔄 Rotate [${['↓S','←W','↑N','→E'][m.rotation||0]}]</h4><p>Change facing direction</p></div>
    <button class="btn-upg" onclick="rotateSelected()">Rotate</button>`;
  og.appendChild(rRow);
  // Move row
  const mvRow=document.createElement('div'); mvRow.className='upg-row';
  mvRow.innerHTML=`<div class="upg-info"><h4>✋ Move Machine</h4><p>Drag to a new position</p></div>
    <button class="btn-upg" onclick="startMoveMode(${mid})">Move</button>`;
  og.appendChild(mvRow);

  document.getElementById('upgrade-panel').style.display='block';
}

function buyUpgrade(mid,key,cost) {
  const m=G.machines.find(m=>m.id===mid);
  if(!m||G.money<cost) return;
  const upg=UPGRADES[key];
  if((m.upgrades[key]||0)>=upg.maxLv) return;
  G.money-=cost; m.upgrades[key]=(m.upgrades[key]||0)+1;
  toast(upg.name+' upgraded ★','g');
  openUpgradePanel(mid);
}

function sellSelected() {
  if(!G.selectedMid) return;
  const m=G.machines.find(m=>m.id===G.selectedMid);
  if(!m) return;
  const def=MACHINE_DEFS[m.type], val=Math.floor(def.cost*.5);
  if(!confirm('Sell '+def.name+' for $'+val+'?')) return;
  if(m.occupied!=null){const p=G.patrons.find(p=>p.id===m.occupied);if(p){p.machineId=null;kickOut(p);}}
  G.machines=G.machines.filter(x=>x.id!==G.selectedMid);
  G.money+=val;
  toast('Sold for $'+val,'g');
  closeUpgradePanel();
}

function closeUpgradePanel() {
  document.getElementById('upgrade-panel').style.display='none';
  G.selectedMid=null;
}
