// ═══════════════════════════════════════════
//  game.js — Loop, HUD, save, day-end modal
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
  t.textContent=msg; c.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

function updateHUD(){
  const bal=Math.floor(G.money);
  document.getElementById('h-money').textContent='$'+bal.toLocaleString();
  document.getElementById('h-rev').textContent  ='$'+Math.floor(calcRevPerMin()).toLocaleString();
  document.getElementById('h-pat').textContent  =G.patrons.length;
  document.getElementById('h-day').textContent  =G.day;
  document.getElementById('h-emp').textContent  =G.employees.length;
  updateHotbarAfford();
  updateFoundMoneyBadge();

  // Expand button visibility
  const nextLv=G.floorLevel+1;
  const expandBtn=document.getElementById('expand-btn');
  if(expandBtn){
    if(nextLv<FLOOR_LEVELS.length){
      const lv=FLOOR_LEVELS[nextLv];
      expandBtn.style.display='inline';
      expandBtn.textContent='📐 Expand ($'+lv.cost.toLocaleString()+')';
      expandBtn.disabled=G.money<lv.cost;
    } else {
      expandBtn.style.display='none';
    }
  }

  // Placement mode label
  const pl=document.getElementById('placement-label');
  const type=G.placementSelected||G.dragging?.type||G.moveMode?.machineId?'Move':null;
  if(G.placementSelected||G.dragging){
    const t2=G.placementSelected||G.dragging?.type;
    const def=MACHINE_DEFS[t2];
    const dirs=['↓S','←W','↑N','→E'];
    pl.textContent=def?.icon+' '+def?.name+' ['+dirs[G.placementRotation]+']';
    pl.style.display='inline';
  } else if(G.moveMode) {
    pl.textContent='Moving… tap new position  •  Esc to cancel';
    pl.style.display='inline';
  } else {
    pl.style.display='none';
  }

  // Upgrade panel live reel
  drawUpgPanelReels();
}

// ── Day End ────────────────────────────────
function endDay(){
  G.day++;
  const wages=G.employees.reduce((s,e)=>s+EMPLOYEE_DEFS[e.type].wage,0);
  G.money-=wages;
  G.dayStats.wages+=wages;
  openDayEndModal(wages);
  // Reset daily stats for next day
  const prev={...G.dayStats};
  G.dayStats={patronsVisited:0,moneyIn:0,moneyOut:0,wages:0,tips:0,foundMoney:0,jackpotsPaid:0};
  return prev;
}

function openDayEndModal(wages){
  const ds=G.dayStats;
  const net=ds.moneyIn-ds.moneyOut-wages-ds.jackpotsPaid;
  document.getElementById('ded-day').textContent     ='Day '+(G.day-1)+' Summary';
  document.getElementById('ded-next-day').textContent =G.day;
  document.getElementById('ded-patrons').textContent  =ds.patronsVisited;
  document.getElementById('ded-moneyIn').textContent  ='$'+ds.moneyIn.toFixed(2);
  document.getElementById('ded-moneyOut').textContent ='$'+ds.moneyOut.toFixed(2);
  document.getElementById('ded-jackpots').textContent ='$'+(ds.jackpotsPaid||0).toFixed(2);
  document.getElementById('ded-wages').textContent    ='$'+wages.toFixed(2);
  document.getElementById('ded-tips').textContent     ='$'+ds.tips.toFixed(2);
  document.getElementById('ded-net').textContent      =(net>=0?'+':'')+net.toFixed(2);
  document.getElementById('ded-net').style.color      =net>=0?'#7aba70':'#e07070';

  const fmSect=document.getElementById('ded-found-sect');
  fmSect.style.display=G.collectedMoneyPool>0.009?'block':'none';
  document.getElementById('ded-found-amt').textContent='$'+G.collectedMoneyPool.toFixed(2);

  document.getElementById('day-end-modal').style.display='flex';
}

function closeDayEndModal(choice){
  const pool=G.collectedMoneyPool;
  if(pool>0.009 && choice!=='none'){
    if(choice==='keep'){
      G.money+=pool; trackRev(pool*.5);
      toast('Pocketed $'+pool.toFixed(2)+' found money','g');
    } else if(choice==='lostandfound'){
      G.lostAndFoundLog.push({amount:pool,day:G.day-1});
      toast('$'+pool.toFixed(2)+' added to Lost & Found','');
    } else if(choice==='charity'){
      toast('$'+pool.toFixed(2)+' donated to charity','');
    }
    G.collectedMoneyPool=0;
    updateFoundMoneyBadge();
  }
  document.getElementById('day-end-modal').style.display='none';
}

// ── Surveillance panel ─────────────────────
function openSurveillancePanel(){
  const panel=document.getElementById('surv-panel');
  const grid=document.getElementById('surv-grid');
  panel.style.display='block';
  grid.innerHTML='';

  const slots=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot);
  const allCams=[...slots,...G.machines.filter(m=>!MACHINE_DEFS[m.type].isSlot&&!MACHINE_DEFS[m.type].isSurveillance)];

  if(!allCams.length){
    grid.innerHTML='<p style="color:var(--text-muted);text-align:center;grid-column:span 2">No machines placed yet</p>';
    return;
  }

  allCams.forEach(m=>{
    const def=MACHINE_DEFS[m.type];
    const feed=document.createElement('div');
    feed.className='surv-feed';

    // Find any dropped money near this machine
    const wp=tile2world(m.tx,m.ty);
    const hasDrop=G.droppedMoney.some(d=>Math.hypot(d.wx-wp.x,d.wy-wp.y)<TILE*2);
    const patron=m.occupied?G.patrons.find(p=>p.id===m.occupied):null;

    feed.innerHTML=`
      <div class="surv-header">
        ${hasDrop?'<span style="color:#e06060">⚠ MONEY DROPPED</span>':''}
        <span>${def.icon} ${def.name} (${m.tx},${m.ty})</span>
      </div>
      <canvas class="surv-canvas" width="140" height="70"></canvas>
      <div class="surv-info">
        ${patron?`👤 ${patron.name}  💵$${patron.ticketValue.toFixed(2)}`:'No patron'}
        ${hasDrop?`<br><span class="surv-drop-info">💰 Dropped money detected</span>`:''}
      </div>`;
    grid.appendChild(feed);

    // Draw mini reel if slot
    if(def.isSlot&&m._reels){
      const fc=feed.querySelector('.surv-canvas');
      const mc=fc.getContext('2d');
      mc.imageSmoothingEnabled=false;
      mc.fillStyle='#060a06'; mc.fillRect(0,0,140,70);
      drawSlotReelsOnCtx(mc,m._reels,2,2,136,66);
      // Animate this feed
      m._survCanvas=fc;
    } else {
      const fc=feed.querySelector('.surv-canvas');
      const mc=fc.getContext('2d');
      mc.fillStyle='#060808';
      mc.fillRect(0,0,140,70);
      // Scanline effect
      mc.fillStyle='rgba(0,200,80,.05)';
      for(let y=0;y<70;y+=2) mc.fillRect(0,y,140,1);
      mc.fillStyle='rgba(0,200,80,.4)';
      mc.font='11px serif'; mc.textAlign='center'; mc.textBaseline='middle';
      mc.fillText(def.icon+' '+def.name,70,30);
      mc.font='7px monospace';
      mc.fillText(patron?'👤 '+patron.name:'EMPTY',70,50);
    }
  });
  G.surveillanceOpen=true;
}

function closeSurveillancePanel(){
  document.getElementById('surv-panel').style.display='none';
  G.surveillanceOpen=false;
  for(const m of G.machines) m._survCanvas=null;
}

// ── Save / Load ────────────────────────────
function saveGame(){
  try {
    localStorage.setItem('casinoEmpireV5',JSON.stringify({
      v:5, money:G.money, totalEarned:G.totalEarned, day:G.day,
      speed:G.speed, floorLevel:G.floorLevel,
      nextMid:G.nextMid,
      machines:G.machines.map(m=>({
        id:m.id,type:m.type,tx:m.tx,ty:m.ty,rotation:m.rotation||0,
        upgrades:m.upgrades,totalEarned:m.totalEarned||0
      })),
      lostAndFoundLog:G.lostAndFoundLog
    }));
    document.getElementById('save-lbl').textContent='Saved '+new Date().toLocaleTimeString();
  } catch(e){toast('Save failed!','r');}
}

function loadGame(){
  try {
    const raw=localStorage.getItem('casinoEmpireV5');
    if(!raw) return false;
    const d=JSON.parse(raw); if(!d||d.v<5) return false;
    G.money=d.money||5000; G.totalEarned=d.totalEarned||0;
    G.day=d.day||1; G.speed=d.speed||1;
    G.floorLevel=d.floorLevel||0;
    G.floorW=FLOOR_LEVELS[G.floorLevel].w;
    G.floorH=FLOOR_LEVELS[G.floorLevel].h;
    G.nextMid=d.nextMid||1;
    G.lostAndFoundLog=d.lostAndFoundLog||[];
    G.machines=(d.machines||[]).map(m=>({
      ...m,occupied:null,rotation:m.rotation||0,
      upgrades:m.upgrades||{speed:0,luck:0,bet:0},totalEarned:m.totalEarned||0
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

  for(const p of [...G.patrons]) updatePatron(p,dt);
  for(const e of G.employees)    updateEmployee(e,dt);
  updateFoodOrders(rawDtCap);
  updateMachineReels(rawDtCap);
  updateMgReels(rawDtCap);

  // Update surveillance canvases
  if(G.surveillanceOpen){
    for(const m of G.machines){
      if(m._survCanvas&&m._reels){
        const mc=m._survCanvas.getContext('2d');
        mc.fillStyle='#060a06'; mc.fillRect(0,0,140,70);
        drawSlotReelsOnCtx(mc,m._reels,2,2,136,66);
      }
    }
  }

  G.cashierQueue=G.cashierQueue.filter(id=>
    G.patrons.some(p=>p.id===id&&
      (p.state==='WAITING_CASHIER'||p.state==='WALKING_TO_CASHIER'))
  );

  G.spawnAcc+=dt;
  const slotCt=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot).length;
  const spawnDelay=Math.max(2500,G.spawnCooldown/(1+slotCt*.25));
  if(G.spawnAcc>=spawnDelay){G.spawnAcc=0;spawnPatron();}

  G.dayAcc+=rawDt;
  if(G.dayAcc>=G.dayLen){G.dayAcc=0;endDay();}

  G.autosaveAcc+=rawDt;
  if(G.autosaveAcc>=30000){G.autosaveAcc=0;saveGame();}

  updateHUD();
  render();
  requestAnimationFrame(loop);
}

function startGame(){
  document.getElementById('tutorial').style.display='none';
  const had=loadGame();
  setSpd(G.speed);
  if(had) toast('Welcome back!','g');
  else    toast('Tap a hotbar item to start placing!');
  lastTs=performance.now();
  requestAnimationFrame(loop);
}

window.addEventListener('resize',()=>{resize();clampCam();});
// Delay first resize slightly so hotbar has rendered and height is measurable
setTimeout(()=>{resize();clampCam();},50);
resize();
buildHotbar();
G.camera.x=Math.round((canvas.width-(G.floorW+2*WALL)*TILE)/2);
G.camera.y=Math.round((canvas.height-(G.floorH+2*WALL)*TILE-96)/2);
clampCam();
