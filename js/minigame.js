// ═══════════════════════════════════════════
//  minigame.js — Player slot mini-game
//  REEL FIX: target-based absolute position
// ═══════════════════════════════════════════

const MG_PAYOUTS = {
  '7':8.0,'💎':5.0,'⭐':3.0,'BAR':2.5,'🔔':2.0,'🍊':1.5,'🍋':1.4,'🍒':1.2
};
const MG_WIN_RATE = 0.36;
const SYM_COUNT   = REEL_SYMBOLS.length;

function openMinigame() {
  G.minigameOpen=true;
  G.minigameResult=null;
  G.minigameSpinning=false;
  G.minigameReels=[
    {pos:0,speed:0,stopped:true,target:0,stopAt:0},
    {pos:0,speed:0,stopped:true,target:0,stopAt:0},
    {pos:0,speed:0,stopped:true,target:0,stopAt:0}
  ];
  document.getElementById('mg-panel').style.display='block';
  document.getElementById('mg-result').textContent='';
  document.getElementById('mg-spin-btn').disabled=false;
  renderMgReels();
}

function closeMinigame() {
  G.minigameOpen=false;
  document.getElementById('mg-panel').style.display='none';
}

function mgSetBet(v) {
  G.minigameBet=Math.max(1,Math.min(100,G.minigameBet+v));
  document.getElementById('mg-bet').textContent='$'+G.minigameBet.toFixed(0);
}

function mgSpin() {
  if(G.minigameSpinning) return;
  if(G.money<G.minigameBet){toast('Not enough money!','r');return;}
  G.money-=G.minigameBet;
  G.minigameSpinning=true;
  G.minigameResult=null;
  document.getElementById('mg-result').textContent='Spinning…';
  document.getElementById('mg-result').style.color='rgba(201,168,76,.6)';
  document.getElementById('mg-spin-btn').disabled=true;

  const win=Math.random()<MG_WIN_RATE;
  let reelResult;
  if(win) {
    const sym=REEL_SYMBOLS[Math.floor(Math.random()*SYM_COUNT)];
    reelResult=[sym,sym,sym];
    const mult=MG_PAYOUTS[sym]||1.2;
    G.minigameResult={win:true,mult,winnings:parseFloat((G.minigameBet*mult).toFixed(2)),symbols:reelResult};
  } else {
    do {
      reelResult=[
        REEL_SYMBOLS[Math.floor(Math.random()*SYM_COUNT)],
        REEL_SYMBOLS[Math.floor(Math.random()*SYM_COUNT)],
        REEL_SYMBOLS[Math.floor(Math.random()*SYM_COUNT)]
      ];
    } while(reelResult[0]===reelResult[1]&&reelResult[1]===reelResult[2]);
    G.minigameResult={win:false,winnings:0,symbols:reelResult};
  }

  // Set absolute targets for each reel
  const now=Date.now();
  const stopDelays=[1800,2300,2800]; // ms until each reel starts stopping
  G.minigameReels.forEach((r,i)=>{
    const targetSym=REEL_SYMBOLS.indexOf(reelResult[i]);
    const curSym=Math.round(r.pos)%SYM_COUNT;
    const advance=(targetSym-curSym+SYM_COUNT)%SYM_COUNT;
    // At least 6 full spins + offset to land on target
    r.target=Math.round(r.pos)+6*SYM_COUNT+advance;
    r.speed=14;
    r.stopped=false;
    r.stopAt=now+stopDelays[i];
  });

  // Show result after last reel stops
  setTimeout(()=>{
    G.minigameSpinning=false;
    document.getElementById('mg-spin-btn').disabled=false;
    if(G.minigameResult.win) {
      G.money+=G.minigameResult.winnings;
      document.getElementById('mg-result').textContent=
        '🎉 WIN $'+G.minigameResult.winnings.toFixed(2)+' ('+G.minigameResult.mult+'×)';
      document.getElementById('mg-result').style.color='#90e060';
    } else {
      document.getElementById('mg-result').textContent='No match — try again!';
      document.getElementById('mg-result').style.color='#e06060';
    }
  },3200);
}

// ── Called every frame ──────────────────────
function updateMgReels(dt) {
  if(!G.minigameOpen) return;
  const now=Date.now();
  let anyMoving=false;
  for(const r of G.minigameReels) {
    if(r.stopped) continue;
    anyMoving=true;
    if(now>=r.stopAt) {
      // Decelerate toward target
      const remaining=r.target-r.pos;
      if(remaining<=0.04) {
        r.pos=r.target;
        r.stopped=true;
        r.speed=0;
      } else {
        r.speed=Math.max(1.2,remaining*2.8);
        r.pos+=r.speed*dt/1000;
      }
    } else {
      // Full speed
      r.pos+=r.speed*dt/1000;
    }
  }
  if(G.minigameOpen) renderMgReels();
}

function renderMgReels() {
  const mgCanvas=document.getElementById('mg-canvas');
  if(!mgCanvas) return;
  const mc=mgCanvas.getContext('2d');
  mc.imageSmoothingEnabled=false;
  const W=mgCanvas.width, H=mgCanvas.height;
  mc.fillStyle='#060a06'; mc.fillRect(0,0,W,H);

  const PAD=4;
  const reelW=(W-PAD*4)/3, reelH=H-PAD*2;

  for(let i=0;i<3;i++) {
    const r=G.minigameReels[i]||{pos:0,stopped:true};
    const rx=PAD+i*(reelW+PAD);
    const ry=PAD;

    mc.fillStyle='#080e08'; mc.fillRect(rx,ry,reelW,reelH);
    mc.save(); mc.beginPath(); mc.rect(rx,ry,reelW,reelH); mc.clip();

    const symH=reelH*.9;
    const frac=r.pos%1;
    for(let j=-1;j<=1;j++) {
      const symIdx=((Math.floor(r.pos)+j)%SYM_COUNT+SYM_COUNT*10)%SYM_COUNT;
      const sym=REEL_SYMBOLS[symIdx];
      const col=REEL_COLORS[symIdx];
      const sy=ry+(j-frac+.5)*symH+symH*.5;
      const isCenter=r.stopped&&j===0;
      mc.fillStyle=col;
      mc.font=`bold ${Math.floor(symH*.46)}px monospace`;
      mc.textAlign='center'; mc.textBaseline='middle';
      if(isCenter){mc.shadowColor=col;mc.shadowBlur=10;}
      mc.fillText(sym,rx+reelW/2,sy);
      mc.shadowBlur=0;
    }
    mc.restore();

    // Payline guides
    mc.strokeStyle='rgba(255,220,0,.35)'; mc.lineWidth=1; mc.setLineDash([3,3]);
    mc.beginPath();
    mc.moveTo(rx,ry+reelH*.35); mc.lineTo(rx+reelW,ry+reelH*.35);
    mc.moveTo(rx,ry+reelH*.65); mc.lineTo(rx+reelW,ry+reelH*.65);
    mc.stroke(); mc.setLineDash([]);
    mc.strokeStyle='rgba(255,255,255,.12)'; mc.lineWidth=1;
    mc.strokeRect(rx,ry,reelW,reelH);
  }
  // Center payline
  mc.strokeStyle='rgba(255,200,0,.55)'; mc.lineWidth=2;
  mc.beginPath(); mc.moveTo(0,H/2); mc.lineTo(W,H/2); mc.stroke();
}

// ═══════════════════════════════════════════
//  Machine Repair Minigame
// ═══════════════════════════════════════════

let _repairMid = null;
let _repairHits = 0;
let _repairTotal = 0;
let _repairSparkTimers = [];

function openRepairPanel(mid) {
  const m = G.machines.find(m => m.id === mid);
  if(!m || !m.broken) return;
  const def = MACHINE_DEFS[m.type];

  _repairMid = mid;
  _repairHits = 0;
  // Difficulty scales with tier: tier1=8 hits, tier4=16 hits
  _repairTotal = 6 + (def.tier || 1) * 2;

  document.getElementById('repair-machine-name').textContent = def.icon + ' ' + def.name;
  document.getElementById('repair-cost-row').textContent =
    `Auto-fix cost: $${def.repairCost || 100}`;
  document.getElementById('repair-pay-btn').textContent =
    `💳 Pay $${def.repairCost || 100} to Auto-Fix`;
  document.getElementById('repair-progress-bar').style.width = '0%';
  document.getElementById('repair-progress-bar').style.background =
    'linear-gradient(to right,#e07050,#f0c840)';
  document.getElementById('repair-panel').style.display = 'block';

  _buildRepairGrid();
}

function _buildRepairGrid() {
  const grid = document.getElementById('repair-grid');
  grid.innerHTML = '';
  _repairSparkTimers.forEach(t => clearTimeout(t));
  _repairSparkTimers = [];

  const cells = 20;
  const sparkCount = 5;
  const sparkIndices = new Set();
  while(sparkIndices.size < sparkCount) {
    sparkIndices.add(Math.floor(Math.random() * cells));
  }

  for(let i = 0; i < cells; i++) {
    const btn = document.createElement('button');
    btn.style.cssText = `height:44px;border-radius:6px;font-size:18px;cursor:pointer;
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);transition:all .12s;`;
    if(sparkIndices.has(i)) {
      _makeSpark(btn);
    } else {
      btn.textContent = '🔩';
      btn.addEventListener('click', () => _missClick(btn));
    }
    grid.appendChild(btn);
  }
}

function _makeSpark(btn) {
  btn.textContent = '⚡';
  btn.dataset.spark = '1';
  btn.style.background = 'rgba(240,200,40,.15)';
  btn.style.borderColor = 'rgba(240,200,40,.5)';
  btn.style.transform = 'scale(1.15)';
  setTimeout(() => { btn.style.transform = ''; }, 180);
  // Remove old listener, add fresh one
  const newBtn = btn.cloneNode(true);
  btn.parentNode && btn.parentNode.replaceChild(newBtn, btn);
  btn = newBtn;
  // Spark expires after 3s if not clicked — relocates to another cell
  const expireMs = 2500 + Math.random() * 1500;
  const t = setTimeout(() => _sparkExpire(newBtn), expireMs);
  _repairSparkTimers.push(t);
  newBtn.addEventListener('click', () => _hitSpark(newBtn));
}

function _sparkExpire(btn) {
  if(!btn.isConnected || btn.dataset.spark !== '1') return;
  // Spark fizzles — turn back to bolt briefly, then relocate
  btn.textContent = '💨';
  btn.dataset.spark = '';
  btn.style.background = 'rgba(180,100,40,.1)';
  btn.style.borderColor = 'rgba(180,100,40,.3)';
  setTimeout(() => {
    btn.textContent = '🔩';
    btn.style.background = 'rgba(255,255,255,.05)';
    btn.style.borderColor = 'rgba(255,255,255,.1)';
    // Light up a new random empty cell
    if(_repairMid) _addNewSparks(1);
  }, 400);
}

function _hitSpark(btn) {
  if(!_repairMid || btn.dataset.spark !== '1') return;
  btn.dataset.spark = '';
  btn.textContent = '✅';
  btn.style.background = 'rgba(80,220,80,.18)';
  btn.style.borderColor = 'rgba(80,220,80,.5)';
  btn.style.transform = 'scale(1.2)';
  setTimeout(() => { btn.style.transform = ''; }, 180);
  btn.disabled = true;

  _repairHits++;
  const pct = (_repairHits / _repairTotal) * 100;
  document.getElementById('repair-progress-bar').style.width = pct + '%';

  if(_repairHits >= _repairTotal) {
    setTimeout(() => _completeRepair(), 400);
    return;
  }

  // Delay, then add a new spark if none remain
  const t = setTimeout(() => {
    const remaining = document.getElementById('repair-grid')
      .querySelectorAll('[data-spark="1"]').length;
    if(remaining === 0) _addNewSparks(2);
  }, 300);
  _repairSparkTimers.push(t);
}

function _addNewSparks(count = 2) {
  const grid = document.getElementById('repair-grid');
  if(!grid) return;
  const empty = [...grid.children].filter(b => !b.disabled && b.dataset.spark !== '1' && b.textContent !== '💨');
  const toLight = Math.min(count, empty.length);
  for(let i = 0; i < toLight; i++) {
    const idx = Math.floor(Math.random() * empty.length);
    const btn = empty.splice(idx, 1)[0];
    _makeSpark(btn);
  }
}

function _missClick(btn) {
  btn.style.background = 'rgba(220,80,60,.2)';
  btn.style.borderColor = 'rgba(220,80,60,.5)';
  setTimeout(() => {
    btn.style.background = 'rgba(255,255,255,.05)';
    btn.style.borderColor = 'rgba(255,255,255,.1)';
  }, 300);
}

function _completeRepair() {
  _repairSparkTimers.forEach(t => clearTimeout(t));
  const m = G.machines.find(m => m.id === _repairMid);
  if(m) {
    m.broken = false;
    m.health = 60; // restored at 60%
    spawnFloat(
      tile2world(m.tx, m.ty).x + TILE/2,
      tile2world(m.tx, m.ty).y,
      '✅ Fixed!', '#7aba70'
    );
    toast('Machine repaired! ✅', 'g');
  }
  closeRepairPanel();
}

function repairPayAndFix() {
  const m = G.machines.find(m => m.id === _repairMid);
  if(!m) return;
  const def = MACHINE_DEFS[m.type];
  const cost = def.repairCost || 100;
  if(G.money < cost) { toast('Not enough money! Need $'+cost,'r'); return; }
  G.money -= cost;
  m.broken = false;
  m.health = 80; // paid repair restores to 80%
  spawnFloat(
    tile2world(m.tx, m.ty).x + TILE/2,
    tile2world(m.tx, m.ty).y,
    '✅ Repaired! -$'+cost, '#f0c840'
  );
  toast('Machine repaired for $'+cost,'g');
  closeRepairPanel();
}

function closeRepairPanel() {
  _repairSparkTimers.forEach(t => clearTimeout(t));
  _repairSparkTimers = [];
  _repairMid = null;
  document.getElementById('repair-panel').style.display = 'none';
}
