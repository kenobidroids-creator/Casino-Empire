// ═══════════════════════════════════════════
//  game.js — Loop, HUD, save, init
// ═══════════════════════════════════════════

function trackRev(v){G.revBucket.push({t:Date.now(),v});}
function calcRevPerMin(){
  const now=Date.now();
  G.revBucket=G.revBucket.filter(r=>now-r.t<60000);
  return G.revBucket.reduce((s,r)=>s+r.v,0);
}

function toast(msg,cls=''){
  const c=document.getElementById('toasts');
  const t=document.createElement('div');
  t.className='toast'+(cls?' '+cls:'');
  t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

function updateHUD(){
  document.getElementById('h-money').textContent='$'+Math.floor(G.money).toLocaleString();
  document.getElementById('h-rev').textContent='$'+Math.floor(calcRevPerMin()).toLocaleString();
  document.getElementById('h-pat').textContent=G.patrons.length;
  document.getElementById('h-day').textContent=G.day;
  document.getElementById('h-emp').textContent=G.employees.length;
  updateHotbarAfford();
  // Placement mode label
  const pl=document.getElementById('placement-label');
  if(G.placementSelected||G.dragging) {
    const type=G.placementSelected||G.dragging?.type;
    const def=MACHINE_DEFS[type];
    const arrows=['↓S','←W','↑N','→E'];
    pl.textContent=`Placing: ${def?.icon} ${def?.name} [${arrows[G.placementRotation]}]`;
    pl.style.display='inline';
  } else {
    pl.style.display='none';
  }
}

// ── Save / Load ────────────────────────────
function saveGame(){
  try {
    localStorage.setItem('casinoEmpireV4',JSON.stringify({
      v:4, money:G.money, totalEarned:G.totalEarned, day:G.day, speed:G.speed,
      nextMid:G.nextMid,
      machines:G.machines.map(m=>({
        id:m.id,type:m.type,tx:m.tx,ty:m.ty,rotation:m.rotation||0,
        upgrades:m.upgrades,totalEarned:m.totalEarned||0
      }))
    }));
    const now=new Date();
    document.getElementById('save-lbl').textContent='Saved '+now.toLocaleTimeString();
  } catch(e){toast('Save failed!','r');}
}

function loadGame(){
  try {
    const raw=localStorage.getItem('casinoEmpireV4');
    if(!raw) return false;
    const d=JSON.parse(raw);
    if(!d||d.v<4) return false;
    G.money=d.money||5000; G.totalEarned=d.totalEarned||0;
    G.day=d.day||1; G.speed=d.speed||1; G.nextMid=d.nextMid||1;
    G.machines=(d.machines||[]).map(m=>({
      ...m, occupied:null, rotation:m.rotation||0,
      upgrades:m.upgrades||{speed:0,luck:0,bet:0}, totalEarned:m.totalEarned||0
    }));
    return true;
  } catch(e){return false;}
}

// ── Main Loop ──────────────────────────────
let lastTs=0;

function loop(ts){
  const rawDt=ts-lastTs; lastTs=ts;
  const dt=Math.min(rawDt,80)*G.speed;
  const rawDtCap=Math.min(rawDt,80);

  // Patron updates
  for(const p of [...G.patrons]) updatePatron(p,dt);

  // Employee updates
  for(const e of G.employees) updateEmployee(e,dt);

  // Food / jackpot timers (raw time for jackpot countdown)
  updateFoodOrders(rawDtCap);

  // Reel animations
  updateMachineReels(rawDtCap);
  updateMgReels(rawDtCap);
  if(G.minigameOpen) updateMgUI();

  // Clean stale cashier queue
  G.cashierQueue=G.cashierQueue.filter(id=>
    G.patrons.some(p=>p.id===id&&
      (p.state==='WAITING_CASHIER'||p.state==='WALKING_TO_CASHIER'))
  );

  // Spawn
  G.spawnAcc+=dt;
  const slotCt=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot).length;
  const spawnDelay=Math.max(2500,G.spawnCooldown/(1+slotCt*.25));
  if(G.spawnAcc>=spawnDelay){G.spawnAcc=0;spawnPatron();}

  // Day cycle (real time)
  G.dayAcc+=rawDt;
  if(G.dayAcc>=G.dayLen){
    G.dayAcc=0; G.day++;
    // Daily wage deduction
    const wages=G.employees.reduce((s,e)=>s+EMPLOYEE_DEFS[e.type].wage,0);
    if(wages>0){
      G.money-=wages;
      toast('Day '+G.day+' — Wages paid: $'+wages,'');
    } else {
      toast('Day '+G.day+' begins!');
    }
  }

  // Autosave
  G.autosaveAcc+=rawDt;
  if(G.autosaveAcc>=30000){G.autosaveAcc=0;saveGame();}

  updateHUD();
  render();
  requestAnimationFrame(loop);
}

// ── Init ──────────────────────────────────
function startGame(){
  document.getElementById('tutorial').style.display='none';
  const had=loadGame();
  setSpd(G.speed);
  if(had) toast('Welcome back — casino loaded!','g');
  else    toast('Tap a hotbar item to start placing!');
  lastTs=performance.now();
  requestAnimationFrame(loop);
}

window.addEventListener('resize',()=>{resize();clampCam();});
resize();
buildHotbar();

// Center camera
G.camera.x=Math.round((canvas.width-(FW+2*WALL)*TILE)/2);
G.camera.y=Math.round((canvas.height-(FH+2*WALL)*TILE-96)/2);
clampCam();
