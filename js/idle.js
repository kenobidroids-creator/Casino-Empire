// ═══════════════════════════════════════════
//  idle.js — Background / offline earnings
// ═══════════════════════════════════════════

const IDLE_MAX_MS  = 2 * 60 * 60 * 1000; // 2 hours max
const IDLE_RATE    = 0.5;                  // 50% efficiency vs active play

function saveTimestamp() {
  localStorage.setItem('ceIdleTs', Date.now().toString());
}

function checkIdleReturn() {
  const ts = parseInt(localStorage.getItem('ceIdleTs')||'0');
  if(!ts) return;
  const elapsed = Math.min(Date.now()-ts, IDLE_MAX_MS);
  if(elapsed < 30000) return; // under 30s – don't bother

  // Simulate earnings based on placed machines
  const slots    = G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot);
  const tables   = G.machines.filter(m=>MACHINE_DEFS[m.type].isTable);
  const sportsbooks=G.machines.filter(m=>MACHINE_DEFS[m.type].isSportsbook);
  const bars     = G.machines.filter(m=>m.type==='bar');

  const daysFrac = elapsed / G.dayLen; // fractional days elapsed

  const earnSummary = {};
  let totalEarned   = 0;

  // Slots
  let slotEarn = 0;
  for(const m of slots) {
    const def = MACHINE_DEFS[m.type];
    const edge = def.houseEdge||0.25;
    // avg spins per minute × bet midpoint × edge × elapsed minutes × idle rate
    const minsElapsed = elapsed/60000;
    const spinsPerMin = 60000/def.playTime;
    const betMid = (def.betMin+def.betMax)/2 * (1+(m.upgrades?.bet||0)*.25);
    const earn   = spinsPerMin * betMid * edge * minsElapsed * IDLE_RATE;
    slotEarn += earn;
  }
  if(slotEarn>0) { earnSummary['Slot Machines']= slotEarn; totalEarned+=slotEarn; }

  // Tables
  let tableEarn=0;
  for(const m of tables) {
    const def=MACHINE_DEFS[m.type];
    const edge=def.houseEdge||0.12;
    const seatsAvg=(def.seats||4)*0.6;
    const roundsPerMin=60000/8000; // ~7.5 rounds/min
    const betMid=5;
    const earn = roundsPerMin * seatsAvg * betMid * edge * (elapsed/60000) * IDLE_RATE;
    tableEarn += earn;
  }
  if(tableEarn>0) { earnSummary['Table Games']= tableEarn; totalEarned+=tableEarn; }

  // Sportsbook
  let sportEarn=0;
  for(const m of sportsbooks) {
    const earn = 3*(elapsed/60000)*0.16*6*IDLE_RATE; // ~3 bettors avg, $6 avg bet, 16% edge
    sportEarn += earn;
  }
  if(sportEarn>0) { earnSummary['Sportsbook']=sportEarn; totalEarned+=sportEarn; }

  // Bar (food sales)
  let barEarn=0;
  for(const m of bars) {
    const salesPerMin=1.2;
    const avgPrice=8;
    const earn=salesPerMin*avgPrice*(elapsed/60000)*0.8*IDLE_RATE;
    barEarn += earn;
  }
  if(barEarn>0) { earnSummary['Bar & Food']=barEarn; totalEarned+=barEarn; }

  // Wages during away time
  const wagesPerDay = G.employees.reduce((s,e)=>s+EMPLOYEE_DEFS[e.type].wage,0);
  const wagesOwed   = wagesPerDay * daysFrac;
  const net         = totalEarned - wagesOwed;

  G.money     += net;
  G.totalEarned += Math.max(0, totalEarned);

  showIdleSummary(elapsed, earnSummary, totalEarned, wagesOwed, net);
}

function showIdleSummary(elapsed, summary, gross, wages, net) {
  const mins  = Math.floor(elapsed/60000);
  const hrs   = Math.floor(mins/60);
  const mrem  = mins%60;
  const timeStr= hrs>0 ? `${hrs}h ${mrem}m` : `${mins}m`;

  const box = document.getElementById('idle-summary');
  const rows = Object.entries(summary).map(([k,v])=>
    `<div class="ded-row"><span class="ded-label">${k}</span><span class="ded-val">+$${v.toFixed(2)}</span></div>`
  ).join('');

  document.getElementById('idle-time').textContent  = timeStr;
  document.getElementById('idle-gross').textContent = '$'+gross.toFixed(2);
  document.getElementById('idle-wages').textContent = '$'+wages.toFixed(2);
  document.getElementById('idle-net').textContent   = (net>=0?'+':'')+net.toFixed(2);
  document.getElementById('idle-net').style.color   = net>=0?'#7aba70':'#e07070';
  document.getElementById('idle-rows').innerHTML    = rows;

  // Pause game while summary is shown
  if(typeof G!=='undefined') {
    G._prePauseSpeed = G._prePauseSpeed || G.speed || 1;
    G.speed = 0;
    // Reset day accumulator so we don't immediately trigger a new day-end
    G.dayAcc = 0;
  }

  box.style.display='flex';
}

function closeIdleSummary() {
  document.getElementById('idle-summary').style.display='none';
  saveTimestamp();
  // Only restore speed if day-end modal is not also open
  const dayEndOpen = document.getElementById('day-end-modal').style.display==='flex';
  if(!dayEndOpen) setSpd(G._prePauseSpeed||1);
}

// Page Visibility – pause heavy work when tab hidden, save timestamp
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden) {
    saveTimestamp();
  } else {
    // Tab became visible – check if we should show idle summary
    // (only show if game has started, i.e. tutorial is hidden)
    const tutorialHidden = document.getElementById('tutorial').style.display==='none';
    if(tutorialHidden) checkIdleReturn();
    saveTimestamp();
  }
});

// Auto-save timestamp every 60s while playing
setInterval(()=>{
  if(!document.hidden) saveTimestamp();
}, 60000);
