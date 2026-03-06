// ═══════════════════════════════════════════
//  input.js — Input handling
//  - Desktop: drag-to-place from hotbar
//  - Mobile: tap-to-select + tap-to-place
//  - Rotation handle shown on placement ghost
//  - Swipe over coins to collect
//  - Move mode for placed machines
// ═══════════════════════════════════════════

let isPan=false, panStart={x:0,y:0}, panCam={x:0,y:0};
let mousePos={x:0,y:0};
let isTouch=false;
let pointerDown=false;
// For swipe-collect: track if pointer is dragging over coins
let collectSwipe=false;

const COLLECT_RADIUS=28;

function ePos(e){
  return e.touches
    ?{x:e.touches[0].clientX,y:e.touches[0].clientY}
    :{x:e.clientX,y:e.clientY};
}

// ── Check if pos is near a coin ─────────────
function coinAtScreen(sx,sy){
  for(const d of G.droppedMoney){
    const sp=w2s(d.wx,d.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<COLLECT_RADIUS) return d;
  }
  for(const t of G.tips){
    const sp=w2s(t.wx,t.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<COLLECT_RADIUS) return {_tip:true,...t};
  }
  return null;
}

function collectCoin(coin){
  if(coin._tip){
    const t=G.tips.find(t=>t.id===coin.id);
    if(!t) return;
    G.collectedMoneyPool+=t.amount;
    G.dayStats.tips+=t.amount;
    spawnFloat(t.wx,t.wy,'+$'+t.amount.toFixed(2)+' tip','#f0d060');
    G.tips=G.tips.filter(x=>x.id!==t.id);
  } else {
    const d=G.droppedMoney.find(d=>d.id===coin.id);
    if(!d) return;
    G.collectedMoneyPool+=d.amount;
    G.dayStats.foundMoney+=d.amount;
    spawnFloat(d.wx,d.wy,'+$'+d.amount.toFixed(2),'#d4a820');
    G.droppedMoney=G.droppedMoney.filter(x=>x.id!==d.id);
  }
  updateFoundMoneyBadge();
}

function sweepCoinsAtPos(sx,sy){
  // Collect all coins within radius of this screen point
  const toCollect=[];
  for(const d of G.droppedMoney){
    const sp=w2s(d.wx,d.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<COLLECT_RADIUS+8) toCollect.push({...d});
  }
  for(const t of G.tips){
    const sp=w2s(t.wx,t.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<COLLECT_RADIUS+8) toCollect.push({_tip:true,...t});
  }
  toCollect.forEach(c=>collectCoin(c));
}

// ── Check if in rotation handle area during placement ──
function inRotateHandle(sx,sy){
  if(!hoverTile) return false;
  const type=G.dragging?.type||G.placementSelected;
  if(!type) return false;
  const def=MACHINE_DEFS[type];
  const rot=G.placementRotation;
  const pw=rot%2===0?def.w:def.h;
  const wp=tile2world(hoverTile.tx,hoverTile.ty);
  const sp=w2s(wp.x,wp.y);
  // Handle is top-right of ghost
  const hx=sp.x+pw*TILE-10, hy=sp.y+10;
  return Math.hypot(sx-hx,sy-hy)<16;
}

// ══════════════════════════════════════════
//  Mouse
// ══════════════════════════════════════════
canvas.addEventListener('mousedown',e=>{
  if(G.dragging) return;
  mousePos=ePos(e); pointerDown=true;

  // Start collect swipe if clicking a coin
  const coin=coinAtScreen(mousePos.x,mousePos.y);
  if(coin&&!G.placementSelected&&!G.moveMode){
    collectSwipe=true;
    collectCoin(coin);
    return;
  }
  isPan=true;
  panStart=mousePos; panCam={x:G.camera.x,y:G.camera.y};
  if(!G.placementSelected&&!G.moveMode) canvas.style.cursor='grabbing';
});

canvas.addEventListener('mousemove',e=>{
  mousePos=ePos(e);

  if(G.dragging||G.placementSelected||G.moveMode){
    const ghost=document.getElementById('drag-ghost');
    if(G.dragging||G.moveMode){
      ghost.style.left=mousePos.x+'px'; ghost.style.top=mousePos.y+'px';
    }
    const wp=s2w(mousePos.x,mousePos.y);
    hoverTile=world2tile(wp.x,wp.y);
    if(G.dragging||G.moveMode) return;
  }

  if(collectSwipe&&pointerDown){
    sweepCoinsAtPos(mousePos.x,mousePos.y); return;
  }

  if(isPan){
    G.camera.x=panCam.x+mousePos.x-panStart.x;
    G.camera.y=panCam.y+mousePos.y-panStart.y;
    clampCam();
  }
});

canvas.addEventListener('mouseup',e=>{
  pointerDown=false;
  if(collectSwipe){collectSwipe=false;return;}
  const p=ePos(e);
  if(G.dragging){dropItem(p.x,p.y);return;}
  if(G.moveMode){
    isPan=false;   // prevent camera drag after placement
    confirmMove(p.x,p.y);
    return;
  }
  if(isPan){
    isPan=false;
    canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
    const moved=Math.abs(p.x-panStart.x)+Math.abs(p.y-panStart.y)<6;
    if(moved) handleCanvasClick(p.x,p.y);
  }
});

canvas.addEventListener('mouseleave',()=>{
  isPan=false; collectSwipe=false; pointerDown=false;
  if(!G.dragging) canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
});

document.addEventListener('mouseup',e=>{
  if(G.dragging&&e.target!==canvas) endDrag();
  pointerDown=false; collectSwipe=false;
});

// ══════════════════════════════════════════
//  Touch
// ══════════════════════════════════════════
canvas.addEventListener('touchstart',e=>{
  isTouch=true;
  const p=ePos(e); mousePos=p; pointerDown=true;

  if(G.placementSelected||G.moveMode){
    const wp=s2w(p.x,p.y);
    hoverTile=world2tile(wp.x,wp.y);
    e.preventDefault(); return;
  }

  // Collect swipe start
  const coin=coinAtScreen(p.x,p.y);
  if(coin){
    collectSwipe=true;
    collectCoin(coin);
    e.preventDefault(); return;
  }

  isPan=true; panStart=p; panCam={x:G.camera.x,y:G.camera.y};
  e.preventDefault();
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  const p=ePos(e); mousePos=p;
  if(G.placementSelected||G.moveMode){
    const wp=s2w(p.x,p.y);
    hoverTile=world2tile(wp.x,wp.y);
    e.preventDefault(); return;
  }
  if(collectSwipe){sweepCoinsAtPos(p.x,p.y);e.preventDefault();return;}
  if(isPan){
    G.camera.x=panCam.x+p.x-panStart.x;
    G.camera.y=panCam.y+p.y-panStart.y;
    clampCam();
  }
  e.preventDefault();
},{passive:false});

canvas.addEventListener('touchend',e=>{
  pointerDown=false;
  if(collectSwipe){collectSwipe=false;e.preventDefault();return;}
  const p=mousePos;
  if(G.moveMode){confirmMove(p.x,p.y);e.preventDefault();return;}
  if(G.placementSelected){
    // Check rotate handle first
    if(inRotateHandle(p.x,p.y)){rotatePlacement();e.preventDefault();return;}
    const wp=s2w(p.x,p.y);
    const t=world2tile(wp.x,wp.y);
    if(validTile(t.tx,t.ty)) placeMachine(G.placementSelected,t.tx,t.ty,G.placementRotation);
    e.preventDefault(); return;
  }
  const moved=Math.abs(p.x-panStart.x)+Math.abs(p.y-panStart.y)<12;
  isPan=false;
  if(moved) handleCanvasClick(p.x,p.y);
  e.preventDefault();
},{passive:false});

document.addEventListener('touchend',e=>{
  if(G.dragging){
    const t=e.changedTouches[0];
    if(document.elementFromPoint(t.clientX,t.clientY)!==canvas) endDrag();
  }
  pointerDown=false; collectSwipe=false;
});

// ══════════════════════════════════════════
//  Drop / Move helpers
// ══════════════════════════════════════════
function dropItem(sx,sy){
  if(inRotateHandle(sx,sy)){rotatePlacement();return;}
  const wp=s2w(sx,sy);
  const t=world2tile(wp.x,wp.y);
  placeMachine(G.dragging.type,t.tx,t.ty,G.placementRotation);
  endDrag();
}

function endDrag(){
  G.dragging=null; hoverTile=null;
  document.getElementById('drag-ghost').style.display='none';
  canvas.classList.remove('placing');
  canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
}

function startMoveMode(mid){
  const m=G.machines.find(m=>m.id===mid);
  if(!m) return;
  G.moveMode={machineId:mid,origTx:m.tx,origTy:m.ty};
  G.placementRotation=m.rotation||0;  // preserve current facing
  G.selectedMid=null;
  document.getElementById('upgrade-panel').style.display='none';
  canvas.classList.add('placing');
  // Show ghost
  const def=MACHINE_DEFS[m.type];
  const ghost=document.getElementById('drag-ghost');
  ghost.textContent=def.icon;
  ghost.style.display='block';
  ghost.style.left=mousePos.x+'px'; ghost.style.top=mousePos.y+'px';
  toast('Tap / click floor to move '+def.name+'. R to rotate. Esc to cancel.','');
}

function confirmMove(sx,sy){
  if(!G.moveMode) return;
  if(inRotateHandle(sx,sy)){rotatePlacement();return;}
  const wp=s2w(sx,sy);
  const t=world2tile(wp.x,wp.y);
  const m=G.machines.find(m=>m.id===G.moveMode.machineId);
  if(!m){cancelMove();return;}
  const def=MACHINE_DEFS[m.type];
  const rot=G.placementRotation;
  const pw=rot%2===0?def.w:def.h, ph=rot%2===0?def.h:def.w;
  // Validate
  if(!validTile(t.tx,t.ty)){toast('Outside floor!','r');return;}
  let ok=true;
  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(t.tx+dx,t.ty+dy)||tileOccupied(t.tx+dx,t.ty+dy,m.id)) ok=false;
  if(!ok){toast('Cannot place here!','r');return;}
  m.tx=t.tx; m.ty=t.ty; m.rotation=rot;
  cancelMove();
  toast('Machine moved!','g');
}

function cancelMove(){
  G.moveMode=null; hoverTile=null;
  document.getElementById('drag-ghost').style.display='none';
  canvas.classList.remove('placing');
  canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
  // Prevent camera drag after placement — clear pan state
  isPan=false; pointerDown=false;
}

function exitPlacementMode(){
  G.placementSelected=null; G.placementRotation=0;
  hoverTile=null;
  canvas.classList.remove('placing');
  canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
  isPan=false; pointerDown=false;
  updateHotbarSelection();
  document.getElementById('place-cancel-btn').style.display='none';
}

// ── Keyboard shortcuts ─────────────────────
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(G.moveMode) cancelMove();
    else if(G.placementSelected) exitPlacementMode();
    else closeEditPopup();
  }
  if(e.key==='r'||e.key==='R'){
    if(G._editPopupMid) editPopRotate();
    else rotatePlacement();
  }
});

// Right-click cancels placement / closes edit popup
canvas.addEventListener('contextmenu', e=>{
  e.preventDefault();
  if(G.placementSelected) exitPlacementMode();
  else if(G.moveMode) cancelMove();
  else closeEditPopup();
});

// ══════════════════════════════════════════
//  Canvas click dispatcher
// ══════════════════════════════════════════
function handleCanvasClick(sx,sy){
  const wp=s2w(sx,sy);
  const t=world2tile(wp.x,wp.y);

  // ── Placement mode: click places; click on just-placed machine rotates it ──
  if(G.placementSelected) {
    if(inRotateHandle(sx,sy)) { rotatePlacement(); return; }
    const existing = findMachineAtTile(t.tx,t.ty);
    if(existing && existing.type === G.placementSelected) {
      // Tap on an already-placed machine of the same type → rotate it in place
      existing.rotation = ((existing.rotation||0)+1)%4;
      toast('Rotated '+MACHINE_DEFS[existing.type].name+' ['+['↓S','←W','↑N','→E'][existing.rotation]+']','');
      return;
    }
    // Place on empty valid tile
    if(validTile(t.tx,t.ty) && !existing) {
      placeMachine(G.placementSelected, t.tx, t.ty, G.placementRotation);
      // Keep selection active so player can place more
      return;
    }
    return;
  }

  // Dirty item?
  for(const d of G.dirtyItems){
    const sp=w2s(d.wx,d.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<20){handleDirtyClick(d.id);return;}
  }

  // L&F visitor waiting at security desk — clickable like a patron
  for(const v of G.lostAndFoundVisitors){
    if(v.state !== 'WAITING') continue;
    const sp=w2s(v.wx,v.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<18){ openLFClaimPanel(v.id); return; }
  }

  // Click patron BEFORE tile validation — patrons can stand in wall/queue areas
  for(const p of G.patrons){
    const sp=w2s(p.wx,p.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<16){
      if(typeof _highlightPid!=='undefined'&&_highlightPid!==null) handlePatronDelivery(p.id);
      else openPatronThoughts(p.id);
      return;
    }
  }

  if(!validTile(t.tx,t.ty)){closeUpgradePanel();return;}

  const m=findMachineAtTile(t.tx,t.ty);

  if(m){
    if(G.jackpots.find(j=>j.machineId===m.id)){handleJackpotClick(m.id);return;}
    // Broken machines go straight to repair
    if(m.broken) { openRepairPanel(m.id); return; }
    // Primary click opens action/manage panel
    if(m.type==='cashier')           openCashierPanel();
    else if(m.type==='bar')          openBarPanel(m.id);
    else if(m.type==='surveillance') openSurveillancePanel();
    else if(m.type==='security') {
      // If a L&F visitor is waiting at this desk, open the claim panel
      const waiting = G.lostAndFoundVisitors.find(v=>v.machineId===m.id&&v.state==='WAITING');
      if(waiting) openLFClaimPanel(waiting.id);
      else openMachineManagePanel(m.id);
    }
    else                             openMachineManagePanel(m.id);
    return;
  }

  closeUpgradePanel();
}

function findMachineAtTile(tx,ty){
  return G.machines.find(m=>{
    const def=MACHINE_DEFS[m.type];
    const r=m.rotation||0;
    const pw=r%2===0?def.w:def.h, ph=r%2===0?def.h:def.w;
    return tx>=m.tx&&tx<m.tx+pw&&ty>=m.ty&&ty<m.ty+ph;
  });
}

// ══════════════════════════════════════════
//  Hotbar — multi-row on mobile
// ══════════════════════════════════════════
function buildHotbar(){
  const scroll=document.getElementById('hotbar-scroll');
  scroll.innerHTML='';
  const items=['slot_basic','slot_silver','slot_gold','slot_diamond',
               'kiosk','cashier','bar','table',
               'blackjack_table','roulette_table','poker_table',
               'band','sportsbook','tv_screen',
               'surveillance','security'];
  for(const type of items) addHotbarMachine(scroll,type);

  const sep=document.createElement('div'); sep.className='hotbar-sep';
  scroll.appendChild(sep);
  for(const [type] of Object.entries(EMPLOYEE_DEFS)) addHotbarEmployee(scroll,type);
}

function addHotbarMachine(container,type){
  const def=MACHINE_DEFS[type];
  const div=document.createElement('div');
  div.className='hotbar-item'; div.dataset.type=type;
  div.innerHTML=`<div class="hi-icon">${def.icon}</div>
    <div class="hi-name">${def.name}</div>
    <div class="hi-cost">$${def.cost.toLocaleString()}</div>`;

  // Desktop drag
  div.addEventListener('mousedown',e=>{
    if(isTouch) return;
    G.dragging={type};
    const ghost=document.getElementById('drag-ghost');
    ghost.textContent=def.icon; ghost.style.display='block';
    ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px';
    canvas.classList.add('placing');
    e.preventDefault();
  });

  // Tap-to-select
  div.addEventListener('click',e=>{
    if(G.placementSelected===type){exitPlacementMode();return;}
    G.placementSelected=type; G.placementRotation=0;
    canvas.classList.add('placing');
    document.getElementById('place-cancel-btn').style.display='flex';
    updateHotbarSelection();
    toast(def.name+': tap floor to place • R to rotate','');
  });
  container.appendChild(div);
}

function addHotbarEmployee(container,type){
  const def=EMPLOYEE_DEFS[type];
  const div=document.createElement('div');
  div.className='hotbar-item hire-item'; div.dataset.etype=type;
  div.innerHTML=`<div class="hi-icon">${def.icon}</div>
    <div class="hi-name">${def.name}</div>
    <div class="hi-cost hire">Hire $${def.cost}</div>`;
  div.addEventListener('click',()=>hireEmployee(type));
  container.appendChild(div);
}

function updateHotbarSelection(){
  document.querySelectorAll('.hotbar-item[data-type]').forEach(el=>{
    el.classList.toggle('selected',el.dataset.type===G.placementSelected);
  });
}

function updateHotbarAfford(){
  document.querySelectorAll('.hotbar-item[data-type]').forEach(el=>{
    const def=MACHINE_DEFS[el.dataset.type];
    if(def) el.classList.toggle('cant-afford',G.money<def.cost);
  });
  document.querySelectorAll('.hotbar-item[data-etype]').forEach(el=>{
    const def=EMPLOYEE_DEFS[el.dataset.etype];
    if(def) el.classList.toggle('cant-afford',G.money<def.cost);
  });
}

function updateFoundMoneyBadge(){
  const b=document.getElementById('found-money-badge');
  if(b) b.style.display='none';
  clearPersistNotif('found-money'); // silent — shown in day-end summary only
}

// ══════════════════════════════════════════
//  Controls
// ══════════════════════════════════════════
function toggleDelete(){
  G.deleteMode=!G.deleteMode;
  const btn=document.getElementById('del-btn');
  if(btn) btn.classList.toggle('active',G.deleteMode);
  canvas.className=G.deleteMode?'deleting':(G.placementSelected||G.dragging||G.moveMode)?'placing':'';
}

function setSpd(s){
  G.speed=s;
  [1,2,3].forEach(n=>document.getElementById('spd'+n).classList.toggle('active',n===s));
}

function rotatePlacement(){
  G.placementRotation=(G.placementRotation+1)%4;
}

// ══════════════════════════════════════════
//  Edit Popup (Move / Rotate / Remove)
// ══════════════════════════════════════════
function openEditPopup(mid, screenX, screenY) {
  G._editPopupMid = mid;
  const popup = document.getElementById('edit-popup');
  popup.style.display = 'flex';
  // Position near click, clamp to viewport
  const pw = 230, ph = 46;
  let lx = Math.min(screenX - pw/2, window.innerWidth  - pw - 8);
  let ly = Math.min(screenY + 12,   window.innerHeight - ph - 8);
  lx = Math.max(8, lx);
  ly = Math.max(8, ly);
  popup.style.left = lx + 'px';
  popup.style.top  = ly + 'px';
}

function closeEditPopup() {
  G._editPopupMid = null;
  const popup = document.getElementById('edit-popup');
  if(popup) popup.style.display = 'none';
}

function editPopRotate() {
  const m = G.machines.find(m=>m.id===G._editPopupMid);
  if(!m) { closeEditPopup(); return; }
  m.rotation = ((m.rotation||0)+1)%4;
  toast('Rotated '+MACHINE_DEFS[m.type].name,'');
  // keep popup open for further edits
}

function editPopMove() {
  const mid = G._editPopupMid;
  closeEditPopup();
  startMoveMode(mid);
}

function editPopRemove() {
  const m = G.machines.find(m=>m.id===G._editPopupMid);
  if(!m) { closeEditPopup(); return; }
  const def = MACHINE_DEFS[m.type], val = Math.floor(def.cost*.5);
  if(confirm('Remove '+def.name+'? Get $'+val+' back.')) {
    if(m.occupied!=null){const p=G.patrons.find(p=>p.id===m.occupied);if(p){p.machineId=null;kickOut(p);}}
    G.machines = G.machines.filter(x=>x.id!==m.id);
    G.money += val;
    toast('Sold for $'+val,'g');
  }
  closeEditPopup();
}

// Close edit popup when clicking outside it
document.addEventListener('pointerdown', e=>{
  const popup = document.getElementById('edit-popup');
  if(popup && popup.style.display==='flex' && !popup.contains(e.target)) {
    closeEditPopup();
  }
});
