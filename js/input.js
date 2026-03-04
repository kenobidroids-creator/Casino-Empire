// ═══════════════════════════════════════════
//  input.js — Improved input for both platforms
//
//  Desktop: Drag hotbar item → drop on floor
//  Mobile : Tap hotbar item → enter place mode
//           Tap floor to place, tap elsewhere to cancel
//           Pinch/drag to pan on canvas
// ═══════════════════════════════════════════

let isPan=false, panStart={x:0,y:0}, panCam={x:0,y:0};
let mousePos={x:0,y:0};
let isTouch=false;

function ePos(e) {
  return e.touches
    ? {x:e.touches[0].clientX,y:e.touches[0].clientY}
    : {x:e.clientX,y:e.clientY};
}

// ══════════════════════════════════════════
//  Mouse
// ══════════════════════════════════════════
canvas.addEventListener('mousedown', e=>{
  if(G.dragging) return;
  isPan=true;
  panStart=ePos(e); panCam={x:G.camera.x,y:G.camera.y};
  canvas.style.cursor='grabbing';
});

canvas.addEventListener('mousemove', e=>{
  mousePos=ePos(e);
  if(G.dragging||G.placementSelected) {
    const ghost=document.getElementById('drag-ghost');
    ghost.style.left=mousePos.x+'px'; ghost.style.top=mousePos.y+'px';
    const wp=s2w(mousePos.x,mousePos.y);
    hoverTile=world2tile(wp.x,wp.y);
    if(G.dragging) return; // don't pan while dragging
  }
  if(isPan) {
    const p=ePos(e);
    G.camera.x=panCam.x+p.x-panStart.x;
    G.camera.y=panCam.y+p.y-panStart.y;
    clampCam();
  }
});

canvas.addEventListener('mouseup', e=>{
  const p=ePos(e);
  if(G.dragging){dropItem(p.x,p.y);return;}
  if(isPan) {
    isPan=false;
    canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
    const moved=Math.abs(p.x-panStart.x)+Math.abs(p.y-panStart.y)<6;
    if(moved) handleCanvasClick(p.x,p.y);
  }
});

canvas.addEventListener('mouseleave',()=>{
  isPan=false;
  if(!G.dragging) canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
});

document.addEventListener('mouseup',e=>{
  if(G.dragging&&e.target!==canvas) endDrag();
});

// ══════════════════════════════════════════
//  Touch  (pan + tap-to-place)
// ══════════════════════════════════════════
canvas.addEventListener('touchstart',e=>{
  isTouch=true;
  const p=ePos(e); mousePos=p;
  if(G.placementSelected) {
    // Update hover tile continuously
    const wp=s2w(p.x,p.y);
    hoverTile=world2tile(wp.x,wp.y);
    e.preventDefault(); return;
  }
  isPan=true; panStart=p; panCam={x:G.camera.x,y:G.camera.y};
  e.preventDefault();
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  const p=ePos(e); mousePos=p;
  if(G.placementSelected) {
    const wp=s2w(p.x,p.y);
    hoverTile=world2tile(wp.x,wp.y);
    e.preventDefault(); return;
  }
  if(isPan) {
    G.camera.x=panCam.x+p.x-panStart.x;
    G.camera.y=panCam.y+p.y-panStart.y;
    clampCam();
  }
  e.preventDefault();
},{passive:false});

canvas.addEventListener('touchend',e=>{
  const p=mousePos;
  if(G.placementSelected) {
    // Tap to place
    const wp=s2w(p.x,p.y);
    const t=world2tile(wp.x,wp.y);
    if(validTile(t.tx,t.ty)) {
      placeMachine(G.placementSelected,t.tx,t.ty,G.placementRotation);
      // Keep placement mode on for rapid placement, tap hotbar item or ✕ to exit
    }
    e.preventDefault(); return;
  }
  const moved=Math.abs(p.x-panStart.x)+Math.abs(p.y-panStart.y)<12;
  isPan=false;
  if(moved) handleCanvasClick(p.x,p.y);
  e.preventDefault();
},{passive:false});

// ══════════════════════════════════════════
//  Drop / Drag helpers (desktop)
// ══════════════════════════════════════════
function dropItem(sx,sy) {
  const wp=s2w(sx,sy);
  const t=world2tile(wp.x,wp.y);
  placeMachine(G.dragging.type,t.tx,t.ty,G.placementRotation);
  endDrag();
}

function endDrag() {
  G.dragging=null; hoverTile=null;
  document.getElementById('drag-ghost').style.display='none';
  canvas.classList.remove('placing');
  canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
}

function exitPlacementMode() {
  G.placementSelected=null;
  G.placementRotation=0;
  hoverTile=null;
  canvas.classList.remove('placing');
  canvas.style.cursor=G.deleteMode?'not-allowed':'grab';
  updateHotbarSelection();
  document.getElementById('place-cancel-btn').style.display='none';
}

// ══════════════════════════════════════════
//  Canvas click / tap handler
// ══════════════════════════════════════════
function handleCanvasClick(sx,sy) {
  const wp=s2w(sx,sy);
  const t=world2tile(wp.x,wp.y);

  // Tap near dropped money?
  for(const d of G.droppedMoney) {
    const sp=w2s(d.wx,d.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<18){openDroppedMoneyMenu(d.id);return;}
  }
  // Tap near tip?
  for(const tip of G.tips) {
    const sp=w2s(tip.wx,tip.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<22){collectTip(tip.id);return;}
  }
  // Tap near dirty item?
  for(const d of G.dirtyItems) {
    const sp=w2s(d.wx,d.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<20){handleDirtyClick(d.id);return;}
  }

  if(!validTile(t.tx,t.ty)){closeUpgradePanel();return;}

  const m=G.machines.find(m=>{
    const def=MACHINE_DEFS[m.type];
    const r=m.rotation||0;
    const pw=r%2===0?def.w:def.h, ph=r%2===0?def.h:def.w;
    return t.tx>=m.tx&&t.tx<m.tx+pw&&t.ty>=m.ty&&t.ty<m.ty+ph;
  });

  if(m) {
    if(G.deleteMode) {
      const def=MACHINE_DEFS[m.type], val=Math.floor(def.cost*.5);
      if(confirm('Remove '+def.name+'? Get $'+val+' back.')) {
        if(m.occupied!=null){const p=G.patrons.find(p=>p.id===m.occupied);if(p){p.machineId=null;kickOut(p);}}
        G.machines=G.machines.filter(x=>x.id!==m.id);
        G.money+=val; toast('Sold for $'+val,'g');
      }
    } else {
      if(G.jackpots.find(j=>j.machineId===m.id)) {handleJackpotClick(m.id);return;}
      if(m.type==='cashier')    openCashierPanel();
      else if(m.type==='bar')   handleBarClick(m.id);
      else                      openUpgradePanel(m.id);
    }
    return;
  }

  // Click patron (food delivery)
  for(const p of G.patrons) {
    const sp=w2s(p.wx,p.wy);
    if(Math.hypot(sp.x-sx,sp.y-sy)<16) {
      if(playerCarrying) { handlePatronDelivery(p.id); return; }
    }
  }

  closeUpgradePanel();
}

// ══════════════════════════════════════════
//  Hotbar
// ══════════════════════════════════════════
function buildHotbar() {
  const scroll=document.getElementById('hotbar-scroll');
  scroll.innerHTML='';
  const items=['slot_basic','slot_silver','slot_gold','slot_diamond','kiosk','cashier','bar','table'];

  for(const type of items) {
    const def=MACHINE_DEFS[type];
    const div=document.createElement('div');
    div.className='hotbar-item'; div.dataset.type=type;
    div.innerHTML=`<div class="hi-icon">${def.icon}</div>
      <div class="hi-name">${def.name}</div>
      <div class="hi-cost">$${def.cost.toLocaleString()}</div>`;

    // Desktop: drag to place
    div.addEventListener('mousedown', e=>{
      if(isTouch) return;
      G.dragging={type};
      const ghost=document.getElementById('drag-ghost');
      ghost.textContent=def.icon; ghost.style.display='block';
      ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px';
      canvas.classList.add('placing');
      e.preventDefault();
    });

    // Mobile + Desktop click: tap-to-select
    div.addEventListener('click', e=>{
      if(G.placementSelected===type) {
        exitPlacementMode();
      } else {
        G.placementSelected=type;
        G.placementRotation=0;
        canvas.classList.add('placing');
        document.getElementById('place-cancel-btn').style.display='block';
        updateHotbarSelection();
        toast('Tap floor to place. Use Rotate button to turn. Tap item again to cancel.','');
      }
    });

    scroll.appendChild(div);
  }

  // Employee hire section
  const sep=document.createElement('div'); sep.className='hotbar-sep';
  scroll.appendChild(sep);

  for(const [type,def] of Object.entries(EMPLOYEE_DEFS)) {
    const div=document.createElement('div');
    div.className='hotbar-item hire-item'; div.dataset.etype=type;
    div.innerHTML=`<div class="hi-icon">${def.icon}</div>
      <div class="hi-name">${def.name}</div>
      <div class="hi-cost hire">Hire $${def.cost}</div>`;
    div.addEventListener('click',()=>hireEmployee(type));
    scroll.appendChild(div);
  }
}

function updateHotbarSelection() {
  document.querySelectorAll('.hotbar-item').forEach(el=>{
    el.classList.toggle('selected', el.dataset.type===G.placementSelected);
  });
}

function updateHotbarAfford() {
  document.querySelectorAll('.hotbar-item[data-type]').forEach(el=>{
    const def=MACHINE_DEFS[el.dataset.type];
    if(def) el.classList.toggle('cant-afford', G.money<def.cost);
  });
  document.querySelectorAll('.hotbar-item[data-etype]').forEach(el=>{
    const def=EMPLOYEE_DEFS[el.dataset.etype];
    if(def) el.classList.toggle('cant-afford', G.money<def.cost);
  });
}

// ══════════════════════════════════════════
//  Control buttons
// ══════════════════════════════════════════
function toggleDelete() {
  G.deleteMode=!G.deleteMode;
  document.getElementById('del-btn').classList.toggle('active',G.deleteMode);
  canvas.className=G.deleteMode?'deleting':(G.placementSelected||G.dragging)?'placing':'';
}

function setSpd(s) {
  G.speed=s;
  [1,2,3].forEach(n=>document.getElementById('spd'+n).classList.toggle('active',n===s));
}
