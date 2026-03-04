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
