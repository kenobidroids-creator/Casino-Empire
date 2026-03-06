// ═══════════════════════════════════════════
//  game.js — Loop, HUD, save, day-end modal
// ═══════════════════════════════════════════

function trackRev(v){G.revBucket.push({t:Date.now(),v});}
function calcRevPerMin(){
  const now=Date.now();
  G.revBucket=G.revBucket.filter(r=>now-r.t<60000);
  return G.revBucket.reduce((s,r)=>s+r.v,0);
}

// ── Notification Rail ────────────────────────────────
// notif(msg, type, action, icon)
// type: ''|'g'|'r'   action: fn to call on click (optional)
const _notifs = [];  // live notification objects

function notif(msg, type='', action=null, icon='') {
  const rail = document.getElementById('notif-rail');
  if(!rail) { toast(msg, type); return; }

  // Deduplicate — don't stack identical messages
  if(_notifs.find(n => n.msg === msg)) return;

  const el = document.createElement('div');
  el.className = 'notif' + (type ? ' '+type : '');
  el.innerHTML = (icon ? `<span class="notif-icon">${icon}</span>` : '') +
    `<span class="notif-text">${msg}</span>` +
    `<span class="notif-close">✕</span>`;

  const obj = { el, msg };
  _notifs.push(obj);
  rail.appendChild(el);

  const dismiss = () => {
    el.classList.add('fading');
    setTimeout(() => {
      el.remove();
      const i = _notifs.indexOf(obj);
      if(i >= 0) _notifs.splice(i, 1);
    }, 320);
  };

  el.querySelector('.notif-close').addEventListener('click', e => {
    e.stopPropagation(); dismiss();
  });

  if(action) {
    el.querySelector('.notif-text').style.cursor = 'pointer';
    el.querySelector('.notif-text').addEventListener('click', () => { action(); dismiss(); });
  }

  // Auto-dismiss after 8 seconds (actionable ones stay longer)
  setTimeout(dismiss, action ? 12000 : 5000);
}

function dismissNotif(msg) {
  const obj = _notifs.find(n => n.msg === msg);
  if(obj) { obj.el.classList.add('fading'); setTimeout(()=>{ obj.el.remove(); _notifs.splice(_notifs.indexOf(obj),1); }, 320); }
}

// ── Persistent notifications (update in-place, never bounce) ──
const _persistNotifs = {}; // key → { el, textEl, action }

function persistNotif(key, msg, icon, action) {
  const rail = document.getElementById('notif-rail');
  if(!rail) return;
  if(_persistNotifs[key]) {
    // Update text in-place — no flicker, no re-spawn
    _persistNotifs[key].textEl.textContent = msg;
    _persistNotifs[key].action = action;
    return;
  }
  const el = document.createElement('div');
  el.className = 'notif';
  el.innerHTML = (icon ? `<span class="notif-icon">${icon}</span>` : '') +
    `<span class="notif-text">${msg}</span>` +
    `<span class="notif-close">✕</span>`;
  const textEl = el.querySelector('.notif-text');
  if(action) {
    textEl.style.cursor = 'pointer';
    textEl.addEventListener('click', () => {
      if(_persistNotifs[key]?.action) _persistNotifs[key].action();
    });
  }
  el.querySelector('.notif-close').addEventListener('click', e => {
    e.stopPropagation();
    clearPersistNotif(key);
  });
  rail.appendChild(el);
  _persistNotifs[key] = { el, textEl, action };
}

function clearPersistNotif(key) {
  const obj = _persistNotifs[key];
  if(!obj) return;
  obj.el.classList.add('fading');
  setTimeout(() => { obj.el.remove(); delete _persistNotifs[key]; }, 320);
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

  // Day progress bar + time-of-day (6 AM open → 4 AM close, 22-hour day)
  const pct = Math.min(1, (G.dayAcc||0) / G.dayLen);
  document.getElementById('h-daybar-fill').style.width = (pct*100).toFixed(1)+'%';
  const totalMins = pct * 1320;           // 22 hours mapped across day
  const rawMins   = 6*60 + totalMins;     // starts 6:00 AM
  const hour = Math.floor(rawMins/60) % 24;
  const min  = Math.floor(rawMins % 60);
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h12  = hour % 12 || 12;
  const clockEl = document.getElementById('h-daytime');
  if(clockEl) clockEl.textContent = h12+':'+String(min).padStart(2,'0')+' '+ampm;

  // Day-of-week label + busy indicator
  const DOW_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DOW_BUSY  = [false,false,false,false,true,true,true];
  const dow = (G.dayOfWeek??0) % 7;
  const dowEl = document.getElementById('h-dow');
  if(dowEl) {
    dowEl.textContent = DOW_NAMES[dow];
    dowEl.style.color = DOW_BUSY[dow] ? '#ffcc44' : 'rgba(201,168,76,.4)';
  }

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
  G.dayOfWeek = ((G.dayOfWeek??0) + 1) % 7;
  const wages=G.employees.reduce((s,e)=>s+EMPLOYEE_DEFS[e.type].wage,0);
  G.money-=wages;
  G.dayStats.wages+=wages;
  G._prePauseSpeed = G._prePauseSpeed || G.speed || 1;
  G.speed=0;
  G.dayAcc=0;

  // Casino is 24/7 — patrons keep playing, we just tally the day

  // Loan repayments
  let loanPayment = 0;
  for(const loan of G.loans) {
    if(loan.daysLeft > 0) {
      const pay = Math.min(loan.dailyPayment, loan.remaining);
      G.money -= pay;
      loan.remaining = parseFloat((loan.remaining - pay).toFixed(2));
      loan.daysLeft--;
      loanPayment += pay;
    }
  }
  G.loans = G.loans.filter(l => l.daysLeft > 0 && l.remaining > 0.005);
  // Clear persist notifs at day boundary so they re-evaluate fresh
  Object.keys(_persistNotifs).forEach(k => clearPersistNotif(k));

  // Snapshot stats BEFORE opening modal (modal reads them), THEN reset
  const snapshot = {...G.dayStats, loanPayment};
  const net = snapshot.moneyIn - snapshot.moneyOut - wages - (snapshot.jackpotsPaid||0) - loanPayment;
  G.allTimeProfit = (G.allTimeProfit||0) + net;
  openDayEndModal(wages, snapshot);
  G.dayStats={patronsVisited:0,moneyIn:0,moneyOut:0,wages:0,tips:0,foundMoney:0,jackpotsPaid:0};
}

function openDayEndModal(wages, snapshot){
  const ds = snapshot || G.dayStats;
  const loanPay = ds.loanPayment || 0;
  const net = ds.moneyIn - ds.moneyOut - wages - (ds.jackpotsPaid||0) - loanPay;
  const DOW_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const DOW_BUSY  = [false,false,false,false,true,true,true];
  const nextDow   = G.dayOfWeek % 7;  // already incremented in endDay
  const busyLabel = DOW_BUSY[nextDow] ? '🔥 Busy night' : '🌙 Quiet night';
  const busyColor = DOW_BUSY[nextDow] ? '#ffcc44' : 'var(--text-muted)';

  document.getElementById('ded-day').textContent     ='Day '+(G.day-1)+' Summary';
  document.getElementById('ded-next-day').textContent =G.day;
  document.getElementById('ded-patrons').textContent  =ds.patronsVisited;
  document.getElementById('ded-moneyIn').textContent  ='$'+ds.moneyIn.toFixed(2);
  document.getElementById('ded-moneyOut').textContent ='$'+ds.moneyOut.toFixed(2);
  document.getElementById('ded-jackpots').textContent ='$'+(ds.jackpotsPaid||0).toFixed(2);
  document.getElementById('ded-wages').textContent    ='$'+wages.toFixed(2);
  document.getElementById('ded-tips').textContent     ='$'+ds.tips.toFixed(2);
  const loanRow = document.getElementById('ded-loan-row');
  if(loanRow) {
    loanRow.style.display = loanPay > 0 ? 'flex' : 'none';
    document.getElementById('ded-loan').textContent = '-$'+loanPay.toFixed(2);
  }
  document.getElementById('ded-net').textContent      =(net>=0?'+':'')+net.toFixed(2);
  document.getElementById('ded-net').style.color      =net>=0?'#7aba70':'#e07070';

  // Next-night forecast
  let forecastEl = document.getElementById('ded-forecast');
  if(!forecastEl) {
    forecastEl = document.createElement('div');
    forecastEl.id = 'ded-forecast';
    forecastEl.style.cssText='text-align:center;margin:8px 0 0;font-size:11px;font-family:monospace;';
    document.getElementById('ded-net').parentElement.after(forecastEl);
  }
  forecastEl.innerHTML = `Tomorrow: <span style="color:${busyColor}">${DOW_NAMES[nextDow]} — ${busyLabel}</span>`;

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
      addLFContact('Found Money (Day '+(G.day-1)+')', pool, -1);
      toast('$'+pool.toFixed(2)+' added to Lost & Found','');
    } else if(choice==='charity'){
      toast('$'+pool.toFixed(2)+' donated to charity','');
    }
    G.collectedMoneyPool=0;
    updateFoundMoneyBadge();
  }
  document.getElementById('day-end-modal').style.display='none';
  // Restore speed that was active before pause
  setSpd(G._prePauseSpeed||1);
}

// ── Surveillance panel ─────────────────────
function openSurveillancePanel(){
  document.getElementById('surv-panel').style.display='block';
  G.surveillanceOpen=true;
  renderSurveillancePanel();
}

function closeSurveillancePanel(){
  document.getElementById('surv-panel').style.display='none';
  G.surveillanceOpen=false;
  for(const m of G.machines) m._survCanvas=null;
}

function renderSurveillancePanel(){
  const grid=document.getElementById('surv-grid');
  grid.innerHTML='';

  // ── Slot machine feeds ──
  const slots=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot);
  for(const m of slots) buildCameraFeed(grid, m, 'slot');

  // ── Cashier feed ──
  const cashier=G.machines.find(m=>m.type==='cashier');
  if(cashier) buildCameraFeed(grid, cashier, 'cashier');

  // ── Bar feed ──
  const bar=G.machines.find(m=>m.type==='bar');
  if(bar) buildCameraFeed(grid, bar, 'bar');

  // ── Table game feeds ──
  const tableGames=G.machines.filter(m=>MACHINE_DEFS[m.type].tableGame);
  for(const m of tableGames) buildCameraFeed(grid, m, 'table');

  // ── Sportsbook feeds ──
  const sports=G.machines.filter(m=>MACHINE_DEFS[m.type].isSportsbook);
  for(const m of sports) buildCameraFeed(grid, m, 'sportsbook');

  // ── Dropped money feeds ──
  for(const d of G.droppedMoney) buildMoneyFeed(grid, d);

  if(!grid.children.length){
    grid.innerHTML='<p style="color:var(--text-muted);text-align:center;grid-column:span 2;padding:20px">No machines placed yet</p>';
  }
  G.surveillanceOpen=true;
}

function buildCameraFeed(container, m, type){
  const def=MACHINE_DEFS[m.type];
  if(!G.survTabs[m.id]) G.survTabs[m.id]='topdown';

  const hasDrop=G.droppedMoney.some(d=>{
    const wp=tile2world(m.tx,m.ty); return Math.hypot(d.wx-wp.x,d.wy-wp.y)<TILE*2;
  });
  const patron = m.occupied ? G.patrons.find(p=>p.id===m.occupied) : null;
  const queueLen = type==='cashier' ? G.cashierQueue.length : 0;

  const feed=document.createElement('div');
  feed.className='surv-feed';
  feed.dataset.mid=m.id;

  const isSlot        = type==='slot';
  const hasFirstPerson= (type==='cashier'||type==='bar');
  const isTableGame   = type==='table';
  const isSportsbook  = type==='sportsbook';

  // Build tab list
  const tabs=[ {id:'topdown', label:'Top Down'} ];
  if(isSlot)         tabs.push({id:'reels',       label:'Reels'});
  if(hasFirstPerson) tabs.push({id:'firstperson',  label:'Counter View'});
  if(isTableGame)    tabs.push({id:'tableview',    label:'Table View'});
  if(isSportsbook)   tabs.push({id:'sportview',    label:'Live Sport'});

  const tabHtml = tabs.map(t=>
    `<button class="surv-tab ${G.survTabs[m.id]===t.id?'active':''}"
       data-tab="${t.id}" data-mid="${m.id}"
       onclick="setSurvTab(${m.id},'${t.id}')">${t.label}</button>`
  ).join('');

  feed.innerHTML=`
    <div class="surv-header">
      <span class="surv-machine-name">${hasDrop?'<span class="surv-warn">⚠</span> ':''}${def.icon} ${def.name}</span>
      <div class="surv-tabs">${tabHtml}</div>
    </div>
    <canvas class="surv-canvas" id="surv-c-${m.id}" width="220" height="90"
      style="cursor:pointer" onclick="panCameraToMachine(${m.id})"></canvas>
    <div class="surv-info" id="surv-info-${m.id}">
      ${patron?`👤 ${patron.name}  Ticket: $${patron.ticketValue.toFixed(2)}`:'No patron'}
      ${queueLen>0?`<br>Queue: ${queueLen} waiting`:''}
    </div>`;
  container.appendChild(feed);

  m._survCanvas = document.getElementById('surv-c-'+m.id);
  m._survType   = type;
  drawSurvCanvas(m, type);
}

function setSurvTab(mid, tab){
  G.survTabs[mid]=tab;
  const m=G.machines.find(m=>m.id===mid);
  if(!m) return;
  // Update button active states
  const feed=document.querySelector(`.surv-feed[data-mid="${mid}"]`);
  if(feed) feed.querySelectorAll('.surv-tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===tab);
  });
  drawSurvCanvas(m, m._survType||'slot');
}
function drawSurvCanvas(m, type){
  const fc=document.getElementById('surv-c-'+m.id);
  if(!fc) return;
  const mc=fc.getContext('2d');
  mc.imageSmoothingEnabled=false;
  const W=fc.width, H=fc.height;
  const tab=G.survTabs[m.id]||'topdown';

  mc.fillStyle='#040806'; mc.fillRect(0,0,W,H);
  // CRT scanlines
  mc.fillStyle='rgba(0,200,80,.03)';
  for(let y=0;y<H;y+=2) mc.fillRect(0,y,W,1);

  if(tab==='reels') {
    drawReelsView(mc, m, W, H);
  } else if(tab==='firstperson') {
    drawFirstPersonView(mc, m, type, W, H);
  } else if(tab==='tableview') {
    drawTableSurvView(mc, m, W, H);
  } else if(tab==='sportview') {
    drawSportsbookSurvView(mc, m, W, H);
  } else {
    drawTopDownView(mc, m, W, H);
  }

  // Timestamp overlay
  const now=new Date();
  mc.fillStyle='rgba(0,200,80,.5)'; mc.font='5px monospace';
  mc.textAlign='right'; mc.textBaseline='bottom';
  mc.fillText('CAM '+m.id+' '+now.toLocaleTimeString(),W-2,H-2);
}

function drawReelsView(mc, m, W, H){
  const def = MACHINE_DEFS[m.type];
  const patron = m.occupied ? G.patrons.find(p=>p.id===m.occupied) : null;

  // Background — dark cabinet colour
  mc.fillStyle='#0a0608'; mc.fillRect(0,0,W,H);

  // Cabinet chrome border
  mc.strokeStyle='rgba(201,168,76,.4)'; mc.lineWidth=2;
  mc.strokeRect(2,2,W-4,H-4);

  // Machine name badge
  mc.fillStyle='rgba(0,0,0,.6)'; mc.fillRect(4,4,W-8,13);
  mc.fillStyle=def.color||'#c9a84c'; mc.font='bold 7px monospace';
  mc.textAlign='center'; mc.textBaseline='middle';
  mc.fillText(def.icon+' '+def.name.toUpperCase(), W/2, 10);

  // Reel window
  const reelPad=8, reelTop=20, reelH=H-reelTop-22;
  mc.fillStyle='#060a06'; mc.fillRect(reelPad, reelTop, W-reelPad*2, reelH);
  mc.strokeStyle='rgba(201,168,76,.3)'; mc.lineWidth=1;
  mc.strokeRect(reelPad, reelTop, W-reelPad*2, reelH);

  // Draw live reels using shared helper
  if(m._reels && m._reels.length) {
    drawSlotReelsOnCtx(mc, m._reels, reelPad+1, reelTop+1, W-reelPad*2-2, reelH-2);
  } else {
    // No reels yet — show idle state
    mc.fillStyle='rgba(201,168,76,.15)'; mc.font='8px monospace';
    mc.textAlign='center'; mc.textBaseline='middle';
    mc.fillText('IDLE', W/2, reelTop+reelH/2);
  }

  // Status bar at bottom
  mc.fillStyle='rgba(0,0,0,.7)'; mc.fillRect(4,H-18,W-8,14);
  if(patron) {
    mc.fillStyle='#7aba70'; mc.font='bold 6px monospace';
    mc.textAlign='center'; mc.textBaseline='middle';
    const isSpinning = m._reels && m._reels.some(r=>!r.stopped);
    mc.fillText(patron.name+' — '+(isSpinning?'SPINNING…':'$'+patron.ticketValue.toFixed(2)), W/2, H-11);
  } else {
    mc.fillStyle='rgba(201,168,76,.3)'; mc.font='6px monospace';
    mc.textAlign='center'; mc.textBaseline='middle';
    mc.fillText('NO PATRON', W/2, H-11);
  }
}

function drawTopDownView(mc, m, W, H){
  // Zoomed top-down: world coords centered on machine, 4-tile radius
  const wp=tile2world(m.tx,m.ty);
  const def=MACHINE_DEFS[m.type];
  const cx2=wp.x+def.w*TILE/2, cy2=wp.y+def.h*TILE/2;
  const viewRadius=TILE*3.5;
  const scaleX=W/(viewRadius*2), scaleY=H/(viewRadius*2);

  const toScreen=(wx,wy)=>({
    sx:(wx-cx2+viewRadius)*scaleX,
    sy:(wy-cy2+viewRadius)*scaleY
  });

  // Floor
  mc.fillStyle='#0a2010';
  mc.fillRect(0,0,W,H);

  // Grid
  mc.strokeStyle='rgba(0,200,80,.08)'; mc.lineWidth=.5;
  for(let t=-4;t<=4;t++){
    const lx=(cx2+t*TILE-cx2+viewRadius)*scaleX;
    const ly=(cy2+t*TILE-cy2+viewRadius)*scaleY;
    mc.beginPath(); mc.moveTo(lx,0); mc.lineTo(lx,H); mc.stroke();
    mc.beginPath(); mc.moveTo(0,ly); mc.lineTo(W,ly); mc.stroke();
  }

  // Draw machine footprint
  const rot=m.rotation||0;
  const pw=rot%2===0?def.w:def.h, ph=rot%2===0?def.h:def.w;
  const ms=toScreen(wp.x-(rot%2===0?0:(def.h-def.w)*TILE/2), wp.y);
  mc.fillStyle='rgba(60,120,255,.4)';
  mc.fillRect(ms.sx, ms.sy, pw*TILE*scaleX, ph*TILE*scaleY);
  mc.strokeStyle='rgba(100,160,255,.7)'; mc.lineWidth=1;
  mc.strokeRect(ms.sx, ms.sy, pw*TILE*scaleX, ph*TILE*scaleY);
  mc.fillStyle='rgba(200,220,255,.7)'; mc.font='8px serif';
  mc.textAlign='center'; mc.textBaseline='middle';
  mc.fillText(def.icon, ms.sx+pw*TILE*scaleX/2, ms.sy+ph*TILE*scaleY/2);

  // Nearby patrons
  const nearby=G.patrons.filter(p=>{
    return Math.hypot(p.wx-cx2,p.wy-cy2)<viewRadius*1.2;
  });
  for(const p of nearby){
    const ps=toScreen(p.wx,p.wy);
    mc.fillStyle=p.color; mc.beginPath();
    mc.arc(ps.sx,ps.sy,4,0,Math.PI*2); mc.fill();
    mc.fillStyle='rgba(255,255,255,.6)'; mc.font='5px monospace';
    mc.textAlign='center'; mc.textBaseline='bottom';
    mc.fillText(p.name.substring(0,5),ps.sx,ps.sy-5);
  }

  // Nearby dropped money
  for(const d of G.droppedMoney){
    if(Math.hypot(d.wx-cx2,d.wy-cy2)<viewRadius*1.2){
      const ds=toScreen(d.wx,d.wy);
      mc.fillStyle='#d4a820'; mc.beginPath();
      mc.arc(ds.sx,ds.sy,3,0,Math.PI*2); mc.fill();
      mc.strokeStyle='rgba(255,220,0,.6)'; mc.lineWidth=1;
      mc.beginPath(); mc.arc(ds.sx,ds.sy,5,0,Math.PI*2); mc.stroke();
    }
  }

  // Crosshair on machine center
  const cs=toScreen(cx2,cy2);
  mc.strokeStyle='rgba(255,220,0,.3)'; mc.lineWidth=.5; mc.setLineDash([2,2]);
  mc.beginPath(); mc.moveTo(cs.sx,0); mc.lineTo(cs.sx,H); mc.stroke();
  mc.beginPath(); mc.moveTo(0,cs.sy); mc.lineTo(W,cs.sy); mc.stroke();
  mc.setLineDash([]);
}

function drawFirstPersonView(mc, m, type, W, H){
  // Stylised front-on counter view
  mc.fillStyle='#080c08'; mc.fillRect(0,0,W,H);

  const def=MACHINE_DEFS[m.type];
  if(type==='cashier'){
    // Counter surface (bottom third)
    mc.fillStyle='#2a1808'; mc.fillRect(0,H*.62,W,H*.38);
    mc.strokeStyle='#5a3818'; mc.lineWidth=1; mc.strokeRect(0,H*.62,W,H*.38);
    // Glass partition
    mc.fillStyle='rgba(180,200,255,.07)'; mc.fillRect(8,H*.15,W-16,H*.48);
    mc.strokeStyle='rgba(180,200,255,.2)'; mc.lineWidth=1; mc.strokeRect(8,H*.15,W-16,H*.48);
    // Queue light
    const hasPatron=G.cashierQueue.length>0;
    mc.fillStyle=hasPatron?'#ff4040':'#204020';
    mc.beginPath(); mc.arc(W-12,12,5,0,Math.PI*2); mc.fill();

    // Draw queued patron face if present
    const p=G.patrons.find(p=>p.id===G.cashierQueue[0]);
    if(p){
      drawSurvPatronFace(mc, p, W/2, H*.38, 22);
      mc.fillStyle='rgba(255,255,255,.5)'; mc.font='bold 7px monospace';
      mc.textAlign='center'; mc.textBaseline='top';
      mc.fillText(p.name, W/2, H*.68);
      mc.fillStyle='#7aba70'; mc.font='bold 8px monospace'; mc.textBaseline='top';
      mc.fillText('Ticket: $'+p.ticketValue.toFixed(2), W/2, H*.78);
    } else {
      mc.fillStyle='rgba(0,200,80,.3)'; mc.font='7px monospace';
      mc.textAlign='center'; mc.textBaseline='middle';
      mc.fillText('No patron', W/2, H*.38);
    }
    mc.fillStyle='rgba(255,255,255,.2)'; mc.font='bold 5px monospace';
    mc.textBaseline='bottom'; mc.fillText('CASHIER CAM',W/2,H-2);
  }
  else if(type==='bar'){
    // Bar backdrop
    mc.fillStyle='#3a1408'; mc.fillRect(0,0,W,H*.55);
    // Shelf with bottles
    const bottleColors=['#e04040','#4060e0','#40a040','#e0a040','#c060a0'];
    for(let i=0;i<5;i++){
      const bx=12+i*(W-24)/4.5;
      mc.fillStyle=bottleColors[i]; mc.fillRect(bx,H*.06,6,H*.32);
      mc.fillStyle='rgba(255,255,255,.2)'; mc.fillRect(bx,H*.06,3,H*.14);
      mc.fillRect(bx+2,H*.04,2,6);
    }
    // Counter
    mc.fillStyle='#5c2800'; mc.fillRect(0,H*.55,W,H*.45);
    mc.strokeStyle='#8a4010'; mc.lineWidth=1; mc.strokeRect(0,H*.55,W,H*.45);
    // Active orders
    const barOrders=G.foodOrders.filter(o=>o.barId===m.id);
    barOrders.slice(0,3).forEach((o,i)=>{
      const fi=FOOD_MENU.find(f=>f.id===o.item);
      const ox2=20+i*65;
      mc.fillStyle='rgba(255,255,255,.1)'; mc.fillRect(ox2,H*.58,55,H*.3); 
      mc.fillStyle='rgba(255,255,255,.5)'; mc.font='11px serif';
      mc.textAlign='center'; mc.textBaseline='middle';
      mc.fillText(fi?.icon||'?',ox2+27,H*.7);
      const prog=o.state==='cooking'?Math.min(1,o.progress/(FOOD_MENU.find(f=>f.id===o.item)?.prepTime||1)):o.state==='ready'?1:0;
      mc.fillStyle='rgba(0,0,0,.5)'; mc.fillRect(ox2+4,H*.82,47,5);
      mc.fillStyle=o.state==='ready'?'#40e040':'#40a0e0'; mc.fillRect(ox2+4,H*.82,47*prog,5);
      mc.fillStyle='rgba(255,255,255,.4)'; mc.font='5px monospace';
      mc.textBaseline='top'; mc.fillText(o.state==='ready'?'READY':o.state.toUpperCase(),ox2+27,H*.88);
    });
    if(!barOrders.length){
      mc.fillStyle='rgba(0,200,80,.25)'; mc.font='7px monospace';
      mc.textAlign='center'; mc.textBaseline='middle'; mc.fillText('No orders',W/2,H*.72);
    }
    mc.fillStyle='rgba(255,255,255,.2)'; mc.font='bold 5px monospace';
    mc.textBaseline='bottom'; mc.textAlign='center'; mc.fillText('BAR CAM',W/2,H-2);
  }
}

function drawSurvPatronFace(mc, p, cx2, cy2, r){
  // Simple pixel-art face for surveillance
  mc.fillStyle='#f0c890'; mc.beginPath(); mc.arc(cx2,cy2,r,0,Math.PI*2); mc.fill();
  mc.fillStyle=p.hairColor||'#3a2808';
  mc.beginPath(); mc.arc(cx2,cy2-r*.3,r,Math.PI,0); mc.fill();
  mc.fillStyle='#1a1a1a';
  mc.beginPath(); mc.arc(cx2-r*.35,cy2-r*.1,r*.12,0,Math.PI*2); mc.fill();
  mc.beginPath(); mc.arc(cx2+r*.35,cy2-r*.1,r*.12,0,Math.PI*2); mc.fill();
  mc.strokeStyle='#1a1a1a'; mc.lineWidth=1;
  mc.beginPath(); mc.arc(cx2,cy2+r*.2,r*.3,0,Math.PI); mc.stroke();
}

function buildMoneyFeed(container, d){
  const t=G.machines.find(()=>false); // unused
  const feed=document.createElement('div');
  feed.className='surv-feed surv-money-feed';
  feed.dataset.did=d.id;

  // Find tile coordinates
  const tw=world2tile(d.wx,d.wy);
  const contact=G.lostAndFoundContacts.find(c=>c.name===d.patronName&&c.status==='uncalled');

  feed.innerHTML=`
    <div class="surv-header">
      <span class="surv-warn">⚠</span>
      <span class="surv-machine-name">Floor Drop — $${d.amount.toFixed(2)}</span>
    </div>
    <canvas class="surv-canvas surv-money-canvas" id="surv-m-${d.id}" width="220" height="90"
      style="cursor:pointer" onclick="panCameraToWorld(${d.wx},${d.wy})"></canvas>
    <div class="surv-info">
      Tile (${tw.tx}, ${tw.ty}) &nbsp;•&nbsp; Patron: <strong>${d.patronName}</strong>
      ${contact?`<br><button class="surv-call-btn" onclick="callPatron(${contact.id})">Call ${d.patronName}</button>`:''}
      ${!contact&&d.patronName?`<br><button class="surv-call-btn" data-pname="${d.patronName}" data-amt="${d.amount}" data-did="${d.id}" onclick="addLFContactFromBtn(this)">Add to Lost &amp; Found</button>`:''}
    </div>`;
  container.appendChild(feed);
  drawMoneyFeedCanvas(d);
}

function drawMoneyFeedCanvas(d){
  const fc=document.getElementById('surv-m-'+d.id);
  if(!fc) return;
  const mc=fc.getContext('2d');
  mc.imageSmoothingEnabled=false;
  const W=fc.width, H=fc.height;
  mc.fillStyle='#040806'; mc.fillRect(0,0,W,H);
  mc.fillStyle='rgba(0,200,80,.03)';
  for(let y=0;y<H;y+=2) mc.fillRect(0,y,W,1);

  // Top-down tight view centred on the money
  const viewR=TILE*2.5;
  const sx2=(wx,wy)=>((wx-d.wx+viewR)/viewR/2)*W;
  const sy2=(wx,wy)=>((wy-d.wy+viewR)/viewR/2)*H;

  mc.fillStyle='#0a2010'; mc.fillRect(0,0,W,H);
  // Floor grid
  mc.strokeStyle='rgba(0,200,80,.06)'; mc.lineWidth=.5;
  for(let t=-3;t<=3;t++){
    const lx=sx2(d.wx+t*TILE,d.wy); const ly=sy2(d.wx,d.wy+t*TILE);
    mc.beginPath();mc.moveTo(lx,0);mc.lineTo(lx,H);mc.stroke();
    mc.beginPath();mc.moveTo(0,ly);mc.lineTo(W,ly);mc.stroke();
  }

  // Coin pulsing
  const pulse=.7+.3*Math.sin(Date.now()*.006);
  const cx2=W/2, cy2=H/2;
  mc.shadowColor='#d4a820'; mc.shadowBlur=8*pulse;
  mc.fillStyle='#d4a820';
  mc.beginPath(); mc.arc(cx2,cy2,7,0,Math.PI*2); mc.fill();
  mc.strokeStyle='#f0c840'; mc.lineWidth=1.5;
  mc.beginPath(); mc.arc(cx2,cy2,7,0,Math.PI*2); mc.stroke();
  mc.shadowBlur=0;
  mc.fillStyle='#8b6800'; mc.font='bold 7px monospace';
  mc.textAlign='center'; mc.textBaseline='middle'; mc.fillText('$',cx2,cy2);

  // Patron name + amount label
  mc.fillStyle='rgba(212,168,32,.8)'; mc.font='bold 6px monospace';
  mc.textBaseline='bottom'; mc.fillText(d.patronName+' $'+d.amount.toFixed(2),cx2,cy2-10);

  // Click-to-pan hint
  mc.fillStyle='rgba(0,200,80,.4)'; mc.font='5px monospace';
  mc.textBaseline='bottom'; mc.fillText('TAP TO PAN',cx2,H-2);
}

// ── Table game surveillance view ─────────────
function drawTableSurvView(mc, m, W, H) {
  const ts=TABLE_STATES[m.id];
  const def=MACHINE_DEFS[m.type];
  const game=def.tableGame;

  mc.fillStyle='#04080c'; mc.fillRect(0,0,W,H);
  // CRT lines
  mc.fillStyle='rgba(0,200,80,.025)';
  for(let y=0;y<H;y+=2) mc.fillRect(0,y,W,1);

  // Header
  mc.fillStyle='rgba(0,0,0,.6)'; mc.fillRect(2,2,W-4,13);
  mc.fillStyle='rgba(0,200,80,.7)'; mc.font='bold 7px monospace';
  mc.textAlign='center'; mc.textBaseline='middle';
  mc.fillText(def.icon+' '+def.name.toUpperCase()+' — '+(ts?.phase||'IDLE').toUpperCase(), W/2, 8);

  if(!ts){ mc.fillStyle='rgba(0,200,80,.3)'; mc.font='7px monospace'; mc.textBaseline='middle'; mc.fillText('NO TABLE STATE',W/2,H/2); return; }

  if(game==='blackjack') {
    // Dealer zone
    mc.fillStyle='rgba(10,64,32,.8)'; mc.fillRect(10,18,W-20,28);
    mc.strokeStyle='rgba(212,168,32,.35)'; mc.lineWidth=.5; mc.strokeRect(10,18,W-20,28);
    mc.fillStyle='rgba(212,168,32,.5)'; mc.font='5px monospace';
    mc.textAlign='left'; mc.textBaseline='top'; mc.fillText('DEALER',12,19);
    if(ts.dealerCards?.length) drawSurvCards(mc, ts.dealerCards, W/2, 32, ts.dealerRevealed);

    // Player hands
    const players=ts.players||[];
    const maxShow=Math.min(players.length,5);
    for(let i=0;i<maxShow;i++){
      const px=16+(i/Math.max(1,maxShow-1))*(W-32);
      mc.fillStyle='rgba(6,40,20,.8)'; mc.fillRect(px-20,52,40,24);
      mc.strokeStyle='rgba(212,168,32,.2)'; mc.lineWidth=.5; mc.strokeRect(px-20,52,40,24);
      const pl=players[i];
      if(pl?.cards?.length) drawSurvCards(mc, pl.cards, px, 64, true, 0.8);
      // Result badge
      if(pl?.result){
        const col=pl.result==='win'?'#50d050':pl.result==='bust'?'#e05050':'#d0d050';
        mc.fillStyle=col; mc.font='bold 5px monospace'; mc.textAlign='center';
        mc.textBaseline='bottom'; mc.fillText(pl.result.toUpperCase(),px,52);
      }
    }
    if(!players.length){ mc.fillStyle='rgba(0,200,80,.3)'; mc.font='6px monospace'; mc.textAlign='center'; mc.textBaseline='middle'; mc.fillText('Waiting for players…',W/2,H*.65); }

  } else if(game==='roulette') {
    // Draw mini wheel
    const wx=W*.33, wy=H*.48, wr=H*.28;
    mc.save(); mc.translate(wx,wy); mc.rotate(ts.wheelAngle||0);
    const nums=ROULETTE_NUMS;
    for(let i=0;i<nums.length;i++){
      const a=(i/nums.length)*Math.PI*2, na=((i+1)/nums.length)*Math.PI*2;
      mc.fillStyle=nums[i]===0?'#007000':RED_NUMS.has(nums[i])?'#770000':'#111';
      mc.beginPath(); mc.moveTo(0,0); mc.arc(0,0,wr,a,na); mc.closePath(); mc.fill();
      mc.strokeStyle='rgba(212,168,32,.1)'; mc.lineWidth=.3; mc.stroke();
    }
    mc.restore();
    // Ball
    if(ts.phase==='spinning'||ts.phase==='result'){
      const ba=ts.ballAngle||0, br=wr+5;
      mc.fillStyle='#fff'; mc.beginPath(); mc.arc(wx+Math.cos(ba)*br,wy+Math.sin(ba)*br,2,0,Math.PI*2); mc.fill();
    }
    // Outer ring
    mc.strokeStyle='#d4a820'; mc.lineWidth=1; mc.beginPath(); mc.arc(wx,wy,wr+3,0,Math.PI*2); mc.stroke();
    // Win number display
    mc.fillStyle='rgba(0,0,0,.7)'; mc.fillRect(W*.62,H*.28,W*.34,H*.35);
    mc.fillStyle='rgba(212,168,32,.6)'; mc.font='6px monospace'; mc.textAlign='center'; mc.textBaseline='middle';
    mc.fillText('LAST WIN',W*.79,H*.34);
    if(ts.winNum!=null){
      const isRed=RED_NUMS.has(ts.winNum);
      mc.fillStyle=ts.winNum===0?'#00cc00':isRed?'#ee2222':'#eeeeee';
      mc.font='bold 20px monospace'; mc.fillText(ts.winNum,W*.79,H*.52);
    }
    // Player count
    mc.fillStyle='rgba(0,200,80,.5)'; mc.font='5px monospace';
    mc.fillText((ts.players?.length||0)+'/'+def.seats+' seated',W*.79,H*.7);

  } else if(game==='poker') {
    // Community cards across middle
    mc.fillStyle='rgba(10,30,8,.8)'; mc.fillRect(8,20,W-16,26);
    mc.strokeStyle='rgba(212,168,32,.25)'; mc.lineWidth=.5; mc.strokeRect(8,20,W-16,26);
    mc.fillStyle='rgba(212,168,32,.4)'; mc.font='5px monospace'; mc.textAlign='left'; mc.textBaseline='top';
    mc.fillText('COMMUNITY',10,21);
    if(ts.communityCards?.length) drawSurvCards(mc, ts.communityCards, W/2, 33, true);

    // Players around table
    const players=ts.players||[];
    const maxShow=Math.min(players.length,6);
    for(let i=0;i<maxShow;i++){
      const a=(i/Math.max(1,maxShow))*Math.PI*2-Math.PI/2;
      const px=W/2+Math.cos(a)*(W*.37), py=H*.65+Math.sin(a)*(H*.2);
      mc.fillStyle='rgba(10,26,8,.7)'; mc.fillRect(px-16,py-10,32,18);
      mc.strokeStyle='rgba(212,168,32,.15)'; mc.lineWidth=.5; mc.strokeRect(px-16,py-10,32,18);
      const pl=players[i];
      if(pl?.cards?.length) drawSurvCards(mc, pl.cards, px, py-2, false, 0.75);
    }
    if(!players.length){ mc.fillStyle='rgba(0,200,80,.3)'; mc.font='6px monospace'; mc.textAlign='center'; mc.textBaseline='middle'; mc.fillText('Waiting for players…',W/2,H*.65); }
  }

  // Timestamp
  const now=new Date();
  mc.fillStyle='rgba(0,200,80,.4)'; mc.font='5px monospace';
  mc.textAlign='right'; mc.textBaseline='bottom';
  mc.fillText('CAM '+m.id+' '+now.toLocaleTimeString(),W-2,H-2);
}

// Mini card renderer for surveillance canvas
function drawSurvCards(mc, cards, cx2, cy2, revealed, scale=1) {
  const cw=11*scale, ch=15*scale;
  const total=Math.min(cards.length,5);
  const startX=cx2-(total*cw*.6);
  for(let i=0;i<total;i++){
    const x=startX+i*cw*.85, y=cy2-ch/2;
    mc.fillStyle=revealed?'#f8f0e0':'#1a3a6a';
    mc.fillRect(x,y,cw,ch);
    mc.strokeStyle='rgba(0,0,0,.5)'; mc.lineWidth=.5; mc.strokeRect(x,y,cw,ch);
    if(revealed&&cards[i]&&cards[i].r!=='?'){
      const red=cards[i].s==='♥'||cards[i].s==='♦';
      mc.fillStyle=red?'#cc0000':'#111';
      mc.font=`bold ${Math.floor(4.5*scale)}px monospace`;
      mc.textAlign='center'; mc.textBaseline='middle';
      mc.fillText(cards[i].r+(cards[i].s||''),x+cw/2,y+ch/2);
    }
  }
}

function panCameraToMachine(mid){
  const m=G.machines.find(m=>m.id===mid);
  if(!m) return;
  const wp=tile2world(m.tx,m.ty);
  panCameraToWorld(wp.x+TILE/2, wp.y+TILE/2);
}

function panCameraToWorld(wx,wy){
  G.camera.x = Math.round(canvas.width/2 - wx);
  G.camera.y = Math.round(canvas.height/2 - wy - 60);
  clampCam();
  closeSurveillancePanel();
}

function centerOnMachine(m){
  if(!m) return;
  const wp = tile2world(m.tx,m.ty);
  panCameraToWorld(wp.x+TILE/2, wp.y+TILE/2);
}

// ── Lost & Found contact management ────────
function addLFContactFromBtn(btn){
  const name=btn.dataset.pname;
  const amount=parseFloat(btn.dataset.amt);
  const dropId=parseInt(btn.dataset.did);
  addLFContact(name, amount, dropId);
}

function addLFContact(name, amount, dropId){
  const phones=['555-0100','555-0101','555-0102','555-0103','555-0104',
                '555-0110','555-0120','555-0130','555-0140','555-0150'];
  G.lostAndFoundContacts.push({
    id:G.nextContactId++,
    name, amount, day:G.day,
    phone:phones[Math.floor(Math.random()*phones.length)],
    status:'uncalled',
    dropId
  });
  toast('Added '+name+' to Lost & Found contacts','g');
  renderSurveillancePanel();  // refresh
}

function callPatron(contactId){
  const c=G.lostAndFoundContacts.find(c=>c.id===contactId);
  if(!c||c.status!=='uncalled') return;
  c.status='called';
  toast('Calling '+c.name+'… they will come to Security Desk','g');

  // Spawn a returning visitor headed for the security desk
  const security=G.machines.find(m=>m.type==='security');
  if(!security){toast('Place a Security Desk first!','r');c.status='uncalled';return;}

  const wp=tile2world(ENT_TX(),ENT_TY());
  const fp=getMachineFrontPos(security);
  G.lostAndFoundVisitors.push({
    id:G.nextContactId++,
    contactId:c.id,
    patronName:c.name,
    amount:c.amount,
    wx:wp.x+TILE/2, wy:wp.y+TILE/2+TILE*1.3,
    targetX:fp.wx, targetY:fp.wy,
    state:'WALKING',
    machineId:security.id,
    speed:55,
    color:PATRON_COLORS[Math.floor(Math.random()*PATRON_COLORS.length)],
    hairColor:'#3a2808'
  });
}

function updateLFVisitors(dt){
  for(const v of [...G.lostAndFoundVisitors]){
    if(v.state==='WALKING'){
      const dx=v.targetX-v.wx, dy=v.targetY-v.wy;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const step=v.speed*dt/1000;
      if(dist<=step+.5){
        v.wx=v.targetX; v.wy=v.targetY;
        v.state='WAITING';
        toast(v.patronName+' is at Security Desk to claim $'+v.amount.toFixed(2),'g');
      } else {
        v.wx+=dx/dist*step; v.wy+=dy/dist*step;
      }
    }
  }
}

function claimFoundMoney(visitorId){
  const v=G.lostAndFoundVisitors.find(v=>v.id===visitorId);
  if(!v) return;
  G.money-=v.amount;
  const c=G.lostAndFoundContacts.find(c=>c.id===v.contactId);
  if(c) c.status='claimed';
  G.lostAndFoundVisitors=G.lostAndFoundVisitors.filter(x=>x.id!==visitorId);
  spawnFloat(v.wx,v.wy-20,'Returned $'+v.amount.toFixed(2),'#7aba70');
  toast('Returned $'+v.amount.toFixed(2)+' to '+v.patronName,'g');
  closeManagementWindow();
}

// ── Management Window ──────────────────────
function openManagementWindow(){
  const panel=document.getElementById('mgmt-panel');
  panel.style.display='block';
  renderManagementWindow();
  // Auto-refresh stats while open
  if(G._mgmtRefreshTimer) clearInterval(G._mgmtRefreshTimer);
  G._mgmtRefreshTimer = setInterval(()=>{
    if(document.getElementById('mgmt-panel').style.display==='block' && _mgmtTab==='stats')
      _renderStatsTab(document.getElementById('mgmt-tab-body'));
  }, 2000);
}

function closeManagementWindow(){
  document.getElementById('mgmt-panel').style.display='none';
  if(G._mgmtRefreshTimer){ clearInterval(G._mgmtRefreshTimer); G._mgmtRefreshTimer=null; }
}

// ── Management tabs state ─────────────────
let _mgmtTab = 'stats';

function renderManagementWindow() {
  const body = document.getElementById('mgmt-contacts');
  body.innerHTML = `
    <div class="mgmt-tabs">
      <button class="mgmt-tab ${_mgmtTab==='stats'?'active':''}" onclick="_mgmtTab='stats';renderManagementWindow()">📊 Stats</button>
      <button class="mgmt-tab ${_mgmtTab==='loans'?'active':''}" onclick="_mgmtTab='loans';renderManagementWindow()">🏦 Loans</button>
      <button class="mgmt-tab ${_mgmtTab==='lf'?'active':''}" onclick="_mgmtTab='lf';renderManagementWindow()">🔍 L&F</button>
    </div>
    <div id="mgmt-tab-body"></div>`;
  const tab = document.getElementById('mgmt-tab-body');
  if(_mgmtTab==='stats') _renderStatsTab(tab);
  else if(_mgmtTab==='loans') _renderLoansTab(tab);
  else _renderLFTab(tab);
}

function _renderStatsTab(el) {
  const ds=G.dayStats, rpm=Math.floor(calcRevPerMin());

  // Weekly calendar strip
  const DOW_SHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DOW_BUSY=[false,false,false,false,true,true,true];
  const curDow=(G.dayOfWeek??0)%7;
  const calCells = DOW_SHORT.map((d,i)=>{
    const isCur = i===curDow;
    const isBusy = DOW_BUSY[i];
    const col = isCur ? '#c9a84c' : isBusy ? 'rgba(201,168,76,.45)' : 'rgba(255,255,255,.12)';
    const bg  = isCur ? 'rgba(201,168,76,.22)' : 'rgba(255,255,255,.03)';
    const bd  = isCur ? '1px solid rgba(201,168,76,.6)' : '1px solid rgba(255,255,255,.07)';
    return `<div style="flex:1;text-align:center;padding:5px 2px;border-radius:5px;background:${bg};border:${bd}">
      <div style="font-size:9px;color:${col};font-weight:700">${d}</div>
      <div style="font-size:8px;margin-top:2px">${isBusy?'<span style=\'color:#f0c840\'>🔥</span>':'<span style=\'color:rgba(255,255,255,.2)\'>🌙</span>'}</div>
      ${isCur?`<div style="width:4px;height:4px;border-radius:50%;background:#c9a84c;margin:2px auto 0"></div>`:''}
    </div>`;
  }).join('');
  const calHtml = `<div style="margin-bottom:10px">
    <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">This Week — Day ${G.day}</div>
    <div style="display:flex;gap:3px">${calCells}</div>
  </div>`;
  const wages=G.employees.reduce((s,e)=>s+EMPLOYEE_DEFS[e.type].wage,0);
  const activeMachines=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot).length;
  const occupiedMachines=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot&&m.occupied!=null).length;
  const loanDebt=G.loans.reduce((s,l)=>s+l.remaining,0);
  const nextFloor=G.floorLevel+1<FLOOR_LEVELS.length?FLOOR_LEVELS[G.floorLevel+1]:null;
  const todayNet=ds.moneyIn-ds.moneyOut;
  el.innerHTML=calHtml+`
    <div class="mgmt-section-header" style="margin-top:4px">Today So Far</div>
    <div class="mgmt-stat-grid">
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Patrons</div><div class="mgmt-stat-val">${ds.patronsVisited}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Bets taken</div><div class="mgmt-stat-val green">$${ds.moneyIn.toFixed(0)}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Payouts</div><div class="mgmt-stat-val red">$${ds.moneyOut.toFixed(0)}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Net today</div><div class="mgmt-stat-val ${todayNet>=0?'green':'red'}">${todayNet>=0?'+':''}$${todayNet.toFixed(0)}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Rev / min</div><div class="mgmt-stat-val gold">$${rpm}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Tips</div><div class="mgmt-stat-val gold">$${ds.tips.toFixed(0)}</div></div>
    </div>
    <div class="mgmt-section-header">Floor</div>
    <div class="mgmt-stat-grid">
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">On floor</div><div class="mgmt-stat-val">${G.patrons.length}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Slots used</div><div class="mgmt-stat-val">${occupiedMachines}/${activeMachines}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Staff</div><div class="mgmt-stat-val">${G.employees.length}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Daily wages</div><div class="mgmt-stat-val red">$${wages}</div></div>
    </div>
    <div class="mgmt-section-header">All Time</div>
    <div class="mgmt-stat-grid">
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Total earned</div><div class="mgmt-stat-val green">$${Math.floor(G.totalEarned).toLocaleString()}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Net profit</div><div class="mgmt-stat-val ${(G.allTimeProfit||0)>=0?'green':'red'}">$${Math.floor(G.allTimeProfit||0).toLocaleString()}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Day</div><div class="mgmt-stat-val">${G.day}</div></div>
      <div class="mgmt-stat-box"><div class="mgmt-stat-lbl">Loan debt</div><div class="mgmt-stat-val ${loanDebt>0?'red':'green'}">${loanDebt>0?'$'+loanDebt.toFixed(0):'None'}</div></div>
    </div>
    ${nextFloor?`
    <div class="mgmt-section-header">Expansion</div>
    <div class="mgmt-row" style="padding:6px 0">
      <div><strong style="color:var(--gold-light)">${nextFloor.label}</strong>
        <div class="mgmt-sub">${nextFloor.w}x${nextFloor.h} tiles — $${nextFloor.cost.toLocaleString()}</div></div>
      <button class="mgmt-btn-call" onclick="expandFloor();renderManagementWindow()" ${G.money<nextFloor.cost?'disabled style="opacity:.4"':''}>Expand</button>
    </div>`:`
    <div class="mgmt-section-header">Expansion</div>
    <div class="mgmt-row mgmt-dim"><span class="mgmt-sub">Maximum floor size reached.</span></div>`}
    <div class="mgmt-section-header" style="margin-top:8px">Game Speed</div>
    <div style="display:flex;gap:5px;padding:6px 0">
      <button class="ctrl-btn ${G.speed===1?'active':''}" onclick="setSpd(1);renderManagementWindow()">1x</button>
      <button class="ctrl-btn ${G.speed===2?'active':''}" onclick="setSpd(2);renderManagementWindow()">2x</button>
      <button class="ctrl-btn ${G.speed===3?'active':''}" onclick="setSpd(3);renderManagementWindow()">3x</button>
    </div>`;
}

function _renderLoansTab(el) {
  const OFFERS=[
    {label:'Quick Cash',amount:1000,days:5,rate:0.12,icon:'💵'},
    {label:'Mid Loan',amount:3000,days:10,rate:0.10,icon:'💰'},
    {label:'Big Backer',amount:8000,days:18,rate:0.08,icon:'🏦'},
    {label:'Whale Capital',amount:20000,days:30,rate:0.06,icon:'🐳'},
  ];
  const totalDebt=G.loans.reduce((s,l)=>s+l.remaining,0);
  const LIMIT=25000;
  let html='';
  if(G.loans.length>0){
    html+=`<div class="mgmt-section-header" style="margin-top:4px">Active Loans</div>`;
    for(const loan of G.loans){
      const pct=Math.round((1-loan.remaining/loan.principal)*100);
      html+=`<div class="mgmt-row">
        <div><strong style="color:var(--gold-light)">$${loan.principal.toLocaleString()}</strong>
          <div class="mgmt-sub">$${loan.remaining.toFixed(0)} left — ${loan.daysLeft}d</div>
          <div class="loan-bar-wrap"><div class="loan-bar-fill" style="width:${pct}%"></div></div></div>
        <span style="font-size:10px;color:var(--text-muted)">$${loan.dailyPayment}/day</span>
      </div>`;
    }
  }
  html+=`<div class="mgmt-section-header">Borrow Money</div>`;
  if(totalDebt>=LIMIT){
    html+=`<p class="mgmt-sub" style="padding:8px 0;color:#e07070">Debt limit ($${LIMIT.toLocaleString()}) reached. Repay first.</p>`;
  } else {
    for(const o of OFFERS){
      const total=Math.round(o.amount*(1+o.rate)), daily=Math.ceil(total/o.days);
      const ok=totalDebt+o.amount<=LIMIT;
      html+=`<div class="mgmt-row">
        <div><strong style="color:var(--gold-light)">${o.icon} ${o.label}</strong>
          <div class="mgmt-sub">$${o.amount.toLocaleString()} → repay $${total.toLocaleString()} over ${o.days} days</div>
          <div class="mgmt-sub" style="color:#e09050">$${daily}/day · ${(o.rate*100).toFixed(0)}% interest</div></div>
        <button class="mgmt-btn-pay" onclick="takeLoan(${o.amount},${o.days},${o.rate})" ${ok?'':'disabled style="opacity:.4"'}>Borrow</button>
      </div>`;
    }
  }
  if(!G.loans.length) html=`<p style="color:var(--text-muted);font-size:var(--fs-xs);padding:4px 0 8px">No active loans.</p>`+html;
  el.innerHTML=html;
}

function takeLoan(amount,days,rate){
  const total=Math.round(amount*(1+rate)), daily=Math.ceil(total/days);
  if(!confirm(`Borrow $${amount.toLocaleString()}? Repay $${total.toLocaleString()} ($${daily}/day for ${days} days).`)) return;
  G.money+=amount;
  G.loans.push({id:G.nextLoanId++,principal:amount,remaining:total,dailyPayment:daily,daysLeft:days,interestRate:rate});
  toast(`Received $${amount.toLocaleString()} — $${daily}/day for ${days} days`,'g');
  renderManagementWindow();
}

function _renderLFTab(el){
  let html='';
  const waiting=G.lostAndFoundVisitors.filter(v=>v.state==='WAITING');
  if(waiting.length){
    html+=`<div class="mgmt-section-header" style="margin-top:4px">At Security Desk</div>`;
    for(const v of waiting){
      const c=G.lostAndFoundContacts.find(c=>c.name===v.patronName);
      html+=`<div class="mgmt-row mgmt-urgent"><div>
        <strong>${v.patronName}</strong>${c&&c.status==='self_arrived'?' <span style="color:#60d0ff;font-size:9px">[Walked in]</span>':''}
        <br><span class="mgmt-sub">Here now — $${v.amount.toFixed(2)}</span>
        ${c?`<br><span class="mgmt-sub">Phone: ${c.phone} · Day ${c.day}</span>`:''}
      </div><button class="mgmt-btn-pay" onclick="claimFoundMoney(${v.id})">Pay $${v.amount.toFixed(2)}</button></div>`;
    }
  }
  const walking=G.lostAndFoundVisitors.filter(v=>v.state==='WALKING');
  if(walking.length){
    html+=`<div class="mgmt-section-header">En Route</div>`;
    for(const v of walking) html+=`<div class="mgmt-row"><div><strong>${v.patronName}</strong><br><span class="mgmt-sub">Walking… $${v.amount.toFixed(2)}</span></div></div>`;
  }
  const uncalled=G.lostAndFoundContacts.filter(c=>c.status==='uncalled');
  if(uncalled.length){
    html+=`<div class="mgmt-section-header">Awaiting Contact</div>`;
    for(const c of uncalled) html+=`<div class="mgmt-row"><div><strong>${c.name}</strong> — $${c.amount.toFixed(2)}<br><span class="mgmt-sub">Day ${c.day} · ${c.phone}</span></div><button class="mgmt-btn-call" onclick="callPatron(${c.id});renderManagementWindow()">📞 Call</button></div>`;
  }
  const called=G.lostAndFoundContacts.filter(c=>c.status==='called'||c.status==='self_arrived');
  if(called.length){
    html+=`<div class="mgmt-section-header">On Their Way</div>`;
    for(const c of called) html+=`<div class="mgmt-row mgmt-dim"><div><strong>${c.name}</strong> — $${c.amount.toFixed(2)}<br><span class="mgmt-sub">Day ${c.day} · ${c.phone}</span></div><span class="mgmt-status">${c.status==='self_arrived'?'Walked in 🚶':'Called ✓'}</span></div>`;
  }
  const claimed=G.lostAndFoundContacts.filter(c=>c.status==='claimed');
  if(claimed.length){
    html+=`<div class="mgmt-section-header">Resolved</div>`;
    for(const c of claimed.slice(-5)) html+=`<div class="mgmt-row mgmt-dim"><div><strong>${c.name}</strong> — $${c.amount.toFixed(2)}<br><span class="mgmt-sub">Day ${c.day}</span></div><span class="mgmt-status" style="color:#7aba70">Paid ✓</span></div>`;
  }
  if(!html) html=`<p style="color:var(--text-muted);text-align:center;padding:20px">No lost & found contacts yet.<br><small>Scan dropped money in Surveillance to add contacts.</small></p>`;
  el.innerHTML=html;
}


// ── Draggable panels ─────────────────────────
function makePanelsDraggable() {
  document.querySelectorAll('.panel').forEach(attachDrag);
}

function attachDrag(panel) {
  if(panel._dragAttached) return;
  panel._dragAttached=true;
  let ox=0,oy=0,sx=0,sy=0,dragging=false;

  const onDown=(e)=>{
    // Only drag from title/header area or panel itself (not buttons/inputs)
    if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||
       e.target.tagName==='CANVAS'||e.target.closest('.till-bills')||
       e.target.closest('.pay-area')||e.target.closest('.upg-options')||
       e.target.closest('#mgmt-contacts')||e.target.closest('#surv-grid')||
       e.target.closest('#bar-orders-list')||
       e.target.closest('.mg-controls')) return;
    dragging=true;
    const r=panel.getBoundingClientRect();
    const p=e.touches?e.touches[0]:e;
    sx=p.clientX; sy=p.clientY;
    ox=r.left;    oy=r.top;
    panel.style.transform='none';
    panel.style.position='fixed';
    panel.style.left=ox+'px';
    panel.style.top=oy+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
    panel.style.zIndex=500;
    e.preventDefault();
  };
  const onMove=(e)=>{
    if(!dragging) return;
    const p=e.touches?e.touches[0]:e;
    const dx=p.clientX-sx, dy=p.clientY-sy;
    const newL=Math.max(0,Math.min(window.innerWidth-80,ox+dx));
    const newT=Math.max(0,Math.min(window.innerHeight-40,oy+dy));
    panel.style.left=newL+'px';
    panel.style.top=newT+'px';
    e.preventDefault();
  };
  const onUp=()=>{ dragging=false; };

  panel.addEventListener('mousedown',onDown);
  panel.addEventListener('touchstart',onDown,{passive:false});
  window.addEventListener('mousemove',onMove);
  window.addEventListener('touchmove',onMove,{passive:false});
  window.addEventListener('mouseup',onUp);
  window.addEventListener('touchend',onUp);

  // Add drag cursor hint to panel header
  const h2=panel.querySelector('h2');
  if(h2) h2.style.cursor='move';
}

// ── Cashier panel first-person view ──────────
let _cashierFPCanvas=null;
function initCashierFP() {
  const panel=document.getElementById('cashier-panel');
  if(panel.querySelector('#cashier-fp-canvas')) return;
  const wrap=document.createElement('div');
  wrap.style.cssText='margin-bottom:8px;';
  const c=document.createElement('canvas');
  c.id='cashier-fp-canvas'; c.width=320; c.height=80;
  c.style.cssText='width:100%;border-radius:6px;border:1px solid rgba(80,120,200,.3);display:block;image-rendering:pixelated;';
  wrap.appendChild(c);
  // Insert before ticket amount
  const tick=document.getElementById('ctick');
  panel.insertBefore(wrap, tick);
  _cashierFPCanvas=c;
}

function updateCashierFPView() {
  if(!_cashierFPCanvas) initCashierFP();
  const c=_cashierFPCanvas;
  const mc=c.getContext('2d');
  mc.imageSmoothingEnabled=false;
  const W=c.width, H=c.height;
  mc.fillStyle='#040608'; mc.fillRect(0,0,W,H);
  // Scanlines
  mc.fillStyle='rgba(80,120,200,.03)';
  for(let y=0;y<H;y+=2) mc.fillRect(0,y,W,1);
  // Background scene
  mc.fillStyle='#0c1828'; mc.fillRect(0,0,W,H*.6);
  // Glass partition
  mc.fillStyle='rgba(180,200,255,.06)'; mc.fillRect(10,H*.08,W-20,H*.52);
  mc.strokeStyle='rgba(180,200,255,.18)'; mc.lineWidth=1; mc.strokeRect(10,H*.08,W-20,H*.52);
  // Counter surface
  mc.fillStyle='#2a1808'; mc.fillRect(0,H*.62,W,H*.38);
  mc.strokeStyle='#5a3818'; mc.lineWidth=1;
  mc.beginPath(); mc.moveTo(0,H*.62); mc.lineTo(W,H*.62); mc.stroke();
  // Ticket slot
  mc.fillStyle='#1a1218'; mc.fillRect(W*.35,H*.62,W*.3,4);

  const p=G.cashierServing;
  if(p){
    // Draw patron face
    const cx2=W/2, cy2=H*.3, r=20;
    mc.fillStyle='#f0c890'; mc.beginPath(); mc.arc(cx2,cy2,r,0,Math.PI*2); mc.fill();
    mc.fillStyle=p.hairColor||'#3a2808';
    mc.beginPath(); mc.arc(cx2,cy2-r*.3,r,Math.PI,0); mc.fill();
    mc.fillStyle='#1a1a1a'; mc.beginPath();
    mc.arc(cx2-r*.35,cy2-r*.1,r*.13,0,Math.PI*2); mc.fill();
    mc.arc(cx2+r*.35,cy2-r*.1,r*.13,0,Math.PI*2); mc.fill();
    mc.strokeStyle='#1a1a1a'; mc.lineWidth=1.5;
    mc.beginPath(); mc.arc(cx2,cy2+r*.2,r*.28,0,Math.PI); mc.stroke();
    // Body
    mc.fillStyle=p.color; mc.fillRect(cx2-14,cy2+r+2,28,18);
    // Ticket they're holding
    mc.fillStyle='#e8f0e0'; mc.fillRect(cx2-18,H*.55,36,12);
    mc.strokeStyle='#7aba70'; mc.lineWidth=1; mc.strokeRect(cx2-18,H*.55,36,12);
    mc.fillStyle='#1a3010'; mc.font='bold 6px monospace';
    mc.textAlign='center'; mc.textBaseline='middle';
    mc.fillText('$'+p.ticketValue.toFixed(2),cx2,H*.555+6);
    // Name
    mc.fillStyle='rgba(255,255,255,.55)'; mc.font='6px monospace';
    mc.textBaseline='top'; mc.fillText(p.name,cx2,H*.67);
  } else {
    mc.fillStyle='rgba(180,200,255,.2)'; mc.font='7px monospace';
    mc.textAlign='center'; mc.textBaseline='middle';
    mc.fillText('Awaiting patron…',W/2,H*.35);
  }
  // CAM label
  mc.fillStyle='rgba(80,120,255,.5)'; mc.font='5px monospace';
  mc.textAlign='right'; mc.textBaseline='bottom';
  mc.fillText('CASHIER CAM',W-3,H-2);
}

// Call this every frame when cashier panel is open
function tickCashierFP() {
  const panel=document.getElementById('cashier-panel');
  if(panel.style.display==='block') updateCashierFPView();
}

// ── Patron Thoughts Panel ──────────────────
let _patronPanelPid=null;
function openPatronThoughts(pid){
  const p=G.patrons.find(p=>p.id===pid);
  if(!p) return;
  _patronPanelPid=pid;
  tickPatronPanel._c=0;
  tickPatronPanel._lastState='';  // force fresh thought on open
  document.getElementById('patron-panel-body').innerHTML=''; // clear stale DOM
  renderPatronPanel(p, true);
  const panel=document.getElementById('patron-panel');
  panel.style.display='block';
  attachDrag(panel);
}
function closePatronPanel(){
  document.getElementById('patron-panel').style.display='none';
  _patronPanelPid=null;
}
function renderPatronPanel(p, forceThought=false){
  const t=computePatronThought(p, forceThought);
  document.getElementById('patron-panel-name').textContent=t.moodEmoji+' '+t.name;

  // Thought bubble — only update the text node, leave rest of div intact
  const thoughtEl=document.getElementById('patron-thought-text');
  if(thoughtEl) thoughtEl.textContent='"'+t.thought+'"';

  // Mood bar — update in place
  const moodBar=document.getElementById('patron-mood-bar');
  const moodLbl=document.getElementById('patron-mood-lbl');
  const moodCol=t.mood>66?'#50e050':t.mood>33?'#e0c040':'#e04040';
  if(moodBar){ moodBar.style.width=Math.round(t.mood*0.7)+'px'; moodBar.style.background=moodCol; }
  if(moodLbl){ moodLbl.textContent=t.moodLabel; moodLbl.style.color=moodCol; }

  // Stats grid — update values directly if elements exist
  const el=id=>document.getElementById(id);
  if(el('pp-spent'))  { el('pp-spent').textContent='$'+t.spent; }
  if(el('pp-won'))    { el('pp-won').textContent='$'+t.won; }
  if(el('pp-net'))    { el('pp-net').textContent=t.net; el('pp-net').style.color=t.netColor; }
  if(el('pp-budget')) { el('pp-budget').textContent='$'+t.budget; }
  if(el('pp-state'))  { el('pp-state').textContent=t.state.replace(/_/g,' '); }
  if(el('pp-fav'))    { el('pp-fav').textContent=t.favMach; }
  if(el('pp-visits')) { el('pp-visits').textContent=t.visits; }

  // If panel body isn't built yet, build it fresh
  if(!el('patron-thought-text')) {
    document.getElementById('patron-panel-body').innerHTML=`
      <div style="background:rgba(0,0,0,.35);border-radius:8px;padding:10px;margin-bottom:8px;font-family:monospace;font-size:11px;color:#d0e8d0;line-height:1.6">
        <div id="patron-thought-text" style="font-size:13px;color:#fff;margin-bottom:6px;font-style:italic">"${t.thought}"</div>
        <div style="margin-top:4px">Mood: <span id="patron-mood-lbl" style="color:${moodCol}">${t.moodLabel}</span>
          <span id="patron-mood-bar" style="display:inline-block;width:${Math.round(t.mood*0.7)}px;height:5px;background:${moodCol};border-radius:3px;margin-left:6px;vertical-align:middle"></span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">
        <div class="mstat-box"><div class="mstat-lbl">Spent</div><div class="mstat-val" id="pp-spent">$${t.spent}</div></div>
        <div class="mstat-box"><div class="mstat-lbl">Won</div><div class="mstat-val" id="pp-won">$${t.won}</div></div>
        <div class="mstat-box"><div class="mstat-lbl">Net</div><div class="mstat-val" id="pp-net" style="color:${t.netColor}">${t.net}</div></div>
        <div class="mstat-box"><div class="mstat-lbl">Budget Left</div><div class="mstat-val" id="pp-budget">$${t.budget}</div></div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);line-height:1.8">
        <div>State: <span id="pp-state" style="color:#c9a84c">${t.state.replace(/_/g,' ')}</span></div>
        <div>Favourite: <span id="pp-fav" style="color:#c9a84c">${t.favMach}</span></div>
        <div>Visits: <span id="pp-visits" style="color:#c9a84c">${t.visits}</span></div>
      </div>`;
  }
}

function tickPatronPanel(){
  if(!_patronPanelPid) return;
  const p=G.patrons.find(p=>p.id===_patronPanelPid);
  if(!p){ closePatronPanel(); return; }
  if(!tickPatronPanel._c)    tickPatronPanel._c=0;
  if(!tickPatronPanel._lastState) tickPatronPanel._lastState='';
  tickPatronPanel._c++;

  // Stats (spent, won, budget, mood) refresh every 10 frames
  if(tickPatronPanel._c%10===0) renderPatronPanel(p, false);

  // Thought text only refreshes on state change OR every ~300 frames (~5s)
  const stateKey = p.state+'|'+(p._won?'w':'l')+'|'+Math.floor((p._mood||100)/20);
  if(stateKey !== tickPatronPanel._lastState || tickPatronPanel._c%300===0) {
    tickPatronPanel._lastState = stateKey;
    renderPatronPanel(p, true);
  }
}

function saveGame(){
  try {
    // Serialise patrons — strip ephemeral render state, keep AI/economic data
    const savedPatrons = G.patrons.map(p=>({
      id:p.id, name:p.name, color:p.color, hairColor:p.hairColor,
      wx:p.wx, wy:p.wy,
      state: (p.state==='PLAYING'||p.state==='IDLE_AT_TABLE'||p.state==='WANDERING') ? 'ENTERING' : p.state,
      targetX:p.targetX, targetY:p.targetY, speed:p.speed,
      budget:p.budget, ticketValue:p.ticketValue, ticketPaid:p.ticketPaid,
      wantsFood:p.wantsFood, foodState:p.foodState,
      machineId:null,
      tableId:p.tableId||null, tableSeat:p.tableSeat||0,
      isHighRoller:p.isHighRoller||false,
      _spentTotal:p._spentTotal||0, _wonTotal:p._wonTotal||0,
      _machineVisits:p._machineVisits||{}, _favMachine:p._favMachine||null,
      _mood:p._mood!=null?p._mood:100,
    }));
    localStorage.setItem('casinoEmpireV5',JSON.stringify({
      v:5, money:G.money, totalEarned:G.totalEarned, allTimeProfit:G.allTimeProfit||0, day:G.day,
      dayOfWeek:G.dayOfWeek??0,
      speed:G.speed, floorLevel:G.floorLevel,
      nextMid:G.nextMid, nextContactId:G.nextContactId,
      nextPid:G.nextPid||1,
      dayAcc:G.dayAcc||0,
      machines:G.machines.map(m=>({
        id:m.id,type:m.type,tx:m.tx,ty:m.ty,rotation:m.rotation||0,
        upgrades:m.upgrades,totalEarned:m.totalEarned||0,
        health:m.health??100,broken:m.broken||false
      })),
      employees:G.employees.map(e=>({
        id:e.id,type:e.type,name:e.name,wx:e.wx,wy:e.wy,speed:e.speed
      })),
      nextEid:G.nextEid||1,
      loans:G.loans||[], nextLoanId:G.nextLoanId||1,
      lostAndFoundContacts:G.lostAndFoundContacts,
      patrons:savedPatrons,
    }));
    const lbl=document.getElementById('save-lbl2')||document.getElementById('save-lbl');
    if(lbl) lbl.textContent='Saved '+new Date().toLocaleTimeString();
  } catch(e){toast('Save failed!','r');}
}

function loadGame(){
  try {
    const raw=localStorage.getItem('casinoEmpireV5');
    if(!raw) return false;
    const d=JSON.parse(raw); if(!d||d.v<5) return false;
    G.money=d.money||5000; G.totalEarned=d.totalEarned||0;
    G.day=d.day||1; G.speed=d.speed||1;
    G.dayOfWeek=d.dayOfWeek!=null?d.dayOfWeek:0;
    G.floorLevel=d.floorLevel||0;
    G.floorW=FLOOR_LEVELS[G.floorLevel].w;
    G.floorH=FLOOR_LEVELS[G.floorLevel].h;
    G.nextMid=d.nextMid||1;
    G.nextContactId=d.nextContactId||1;
    G.lostAndFoundContacts=d.lostAndFoundContacts||[];
    G.nextEid=d.nextEid||1;
    G.employees=(d.employees||[]).map(e=>({
      ...e,
      state:'IDLE', task:null, taskId:null,
      carryingOrder:null,
      targetX:e.wx, targetY:e.wy,
    }));
    // Send loaded employees to their posts
    setTimeout(()=>{ for(const e of G.employees) walkToPost(e); }, 100);
    G.loans=d.loans||[];
    G.nextLoanId=d.nextLoanId||1;
    G.allTimeProfit=d.allTimeProfit||0;
    G.machines=(d.machines||[]).map(m=>({
      ...m,occupied:null,rotation:m.rotation||0,
      upgrades:m.upgrades||{speed:0,luck:0,bet:0},totalEarned:m.totalEarned||0,
      health:m.health??100,broken:m.broken||false
    }));
    // TABLE_STATES is in-memory only — re-initialise for every table game machine
    for(const m of G.machines) {
      if(MACHINE_DEFS[m.type]?.tableGame) initTableState(m);
    }
    // Restore patron world state
    G.nextPid = d.nextPid||1;
    G.dayAcc  = d.dayAcc||0;
    G.patrons = (d.patrons||[]).map(p=>({
      ...p,
      state: (p.state==='LEAVING'||p.state==='WAITING_CASHIER'||
              p.state==='WAITING_KIOSK'||p.state==='WAITING_AT_BAR'||
              p.state==='EATING'||p.state==='WAITING_JACKPOT'||
              p.state==='IDLE_AT_TABLE'||p.state==='PLAYING'||
              p.state==='WANDERING')
              ? 'ENTERING' : p.state,
      playTimer:0, spinInterval:0, spinsLeft:0, _won:false,
      _kioskTimer:0, _barId:null, _retryAcc:0, _waitTimer:0,
      _machineVisits:p._machineVisits||{}, _favMachine:p._favMachine||null,
      _mood:p._mood!=null?p._mood:100, _thought:null,
      _watchTimer:0, machineId:null, tableId:null,
      isHighRoller:p.isHighRoller||false,
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
  updateLFVisitors(dt);
  updateSpecialMachines(dt);
  maybeSpawnLFWalkin();

  // Update all open surveillance canvases every frame
  if(G.surveillanceOpen){
    for(const m of G.machines){
      if(m._survCanvas) drawSurvCanvas(m, m._survType||'slot');
    }
    // Redraw money feed canvases (pulsing)
    for(const d of G.droppedMoney) drawMoneyFeedCanvas(d);
  }

  G.cashierQueue=G.cashierQueue.filter(id=>
    G.patrons.some(p=>p.id===id&&
      (p.state==='WAITING_CASHIER'||p.state==='WALKING_TO_CASHIER'))
  );

  G.spawnAcc+=dt;
  const slotCt=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot).length;
  const spawnMult = getSpawnMultiplier();

  // Cap scales with time+day: busier periods allow more patrons on floor
  const baseCap = 18;
  const cap = Math.max(6, Math.floor(baseCap * spawnMult));

  // Delay: only speed up during peak (mult>1), never slow below 80% of base rate
  // Clamp divisor to 0.8–∞ so quiet hours aren't glacially slow
  const baseDelay = Math.max(2000, G.spawnCooldown/(1+slotCt*.25));
  const spawnDelay = baseDelay / Math.max(0.8, spawnMult);

  if(G.spawnAcc>=spawnDelay && G.patrons.length<cap){G.spawnAcc=0;spawnPatron();}

  G.dayAcc+=rawDt;
  if(G.dayAcc>=G.dayLen){G.dayAcc=0;endDay();}

  G.autosaveAcc+=rawDt;
  if(G.autosaveAcc>=30000){G.autosaveAcc=0;saveGame();}

  updateHUD();
  tickCashierFP();
  tickPatronPanel();
  tickParking(dt);
  render();
  requestAnimationFrame(loop);
}

function startGame(){
  document.getElementById('tutorial').style.display='none';
  const had=loadGame();
  setSpd(G.speed);
  if(had) { toast('Welcome back!','g'); checkIdleReturn(); }
  else    toast('Tap a hotbar item to start placing!');
  saveTimestamp();
  lastTs=performance.now();
  requestAnimationFrame(loop);
}

window.addEventListener('resize',()=>{resize();centerCamera();clampCam();});
setTimeout(()=>{resize();centerCamera();clampCam();},50);
resize();
buildHotbar();
centerCamera();
clampCam();
makePanelsDraggable();

function centerCamera() {
  const hotH  = document.getElementById('hotbar')?.offsetHeight || 96;
  const hudH  = 52;
  const WW = (G.floorW+2*WALL)*TILE;
  const WH = (G.floorH+2*WALL)*TILE;
  const usableH = canvas.height - hudH - hotH;
  G.camera.x = Math.round((canvas.width - WW) / 2);
  G.camera.y = Math.round(hudH + (usableH - WH) / 2);
  clampCam();
}
