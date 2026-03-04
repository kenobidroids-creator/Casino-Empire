// ═══════════════════════════════════════════
//  minigame.js — Player slot mini-game
// ═══════════════════════════════════════════

const MG_PAYOUTS = {
  '7':   8.0,
  '💎':  5.0,
  '⭐':  3.0,
  'BAR': 2.5,
  '🔔':  2.0,
  '🍊':  1.5,
  '🍋':  1.4,
  '🍒':  1.2
};
const MG_WIN_RATE = 0.38;

function openMinigame() {
  G.minigameOpen=true;
  G.minigameResult=null;
  G.minigameSpinning=false;
  G.minigameReels=[
    {pos:0,speed:0,stopped:true,target:0},
    {pos:0,speed:0,stopped:true,target:0},
    {pos:0,speed:0,stopped:true,target:0}
  ];
  document.getElementById('mg-panel').style.display='block';
  updateMgUI();
}

function closeMinigame() {
  G.minigameOpen=false;
  document.getElementById('mg-panel').style.display='none';
}

function mgSetBet(v) {
  G.minigameBet=Math.max(1,Math.min(100,G.minigameBet+v));
  updateMgUI();
}

function mgSpin() {
  if(G.minigameSpinning) return;
  if(G.money<G.minigameBet){toast('Not enough money!','r');return;}
  G.money-=G.minigameBet;
  G.minigameSpinning=true;
  G.minigameResult=null;
  document.getElementById('mg-result').textContent='';
  document.getElementById('mg-spin-btn').disabled=true;

  // Determine result
  const win=Math.random()<MG_WIN_RATE;
  let reelResult;
  if(win) {
    const sym=REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)];
    reelResult=[sym,sym,sym];
    const mult=MG_PAYOUTS[sym]||1.2;
    G.minigameResult={win:true, mult, winnings:parseFloat((G.minigameBet*mult).toFixed(2)), symbols:reelResult};
  } else {
    do {
      reelResult=[
        REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)],
        REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)],
        REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)]
      ];
    } while(reelResult[0]===reelResult[1]&&reelResult[1]===reelResult[2]);
    G.minigameResult={win:false, winnings:0, symbols:reelResult};
  }

  // Animate reels
  const speeds=[14,12,11];
  const symIndices=reelResult.map(s=>REEL_SYMBOLS.indexOf(s));
  G.minigameReels.forEach((r,i)=>{
    r.stopped=false; r.speed=speeds[i];
    const base=Math.round(r.pos)+10+i*2;
    r.target=base+symIndices[i];
    setTimeout(()=>{ r.speed=0.5; },1800+i*400);
  });

  // Wait for all reels to stop
  setTimeout(()=>{
    G.minigameSpinning=false;
    document.getElementById('mg-spin-btn').disabled=false;
    if(G.minigameResult.win) {
      G.money+=G.minigameResult.winnings;
      trackRev(-G.minigameResult.winnings); // negative — you're the player here
      document.getElementById('mg-result').textContent=
        '🎉 WIN! $'+G.minigameResult.winnings.toFixed(2)+' ('+G.minigameResult.mult+'x)';
      document.getElementById('mg-result').style.color='#90e060';
    } else {
      document.getElementById('mg-result').textContent='No match — try again!';
      document.getElementById('mg-result').style.color='#e06060';
    }
  }, 3500);

  updateMgUI();
}

function updateMgReels(dt) {
  if(!G.minigameOpen) return;
  for(let i=0;i<3;i++) {
    const r=G.minigameReels[i];
    if(r.stopped) continue;
    r.pos+=r.speed*dt/1000;
    const dist=r.target-r.pos%REEL_SYMBOLS.length;
    if(r.speed<0.5&&Math.abs(dist%REEL_SYMBOLS.length)<0.15) {
      r.pos=Math.round(r.pos); r.stopped=true; r.speed=0;
    } else {
      r.speed=Math.max(0.4,r.speed-r.speed*dt*.003);
    }
  }
}

function updateMgUI() {
  document.getElementById('mg-bet').textContent='$'+G.minigameBet.toFixed(2);
  drawMgReels();
}

function drawMgReels() {
  const mgCanvas=document.getElementById('mg-canvas');
  if(!mgCanvas) return;
  const mc=mgCanvas.getContext('2d');
  mc.imageSmoothingEnabled=false;
  const W=mgCanvas.width, H=mgCanvas.height;
  mc.fillStyle='#060a06'; mc.fillRect(0,0,W,H);

  const reelW=(W-8)/3, reelH=H-4;
  for(let i=0;i<3;i++) {
    const r=G.minigameReels[i]||{pos:0,stopped:true};
    const rx=4+i*(reelW+2);

    mc.fillStyle='#0a100a'; mc.fillRect(rx,2,reelW,reelH);
    mc.save(); mc.beginPath(); mc.rect(rx,2,reelW,reelH); mc.clip();

    const symH=reelH*.92;
    const frac=r.pos%1;
    for(let j=-1;j<=1;j++) {
      const idx=((Math.floor(r.pos)+j+REEL_SYMBOLS.length*100)%REEL_SYMBOLS.length);
      const sym=REEL_SYMBOLS[idx];
      const col=REEL_COLORS[idx];
      const sy=2+(j-frac+.5)*symH+symH*.5;
      mc.fillStyle=col;
      mc.font=`bold ${Math.floor(symH*.44)}px monospace`;
      mc.textAlign='center'; mc.textBaseline='middle';
      mc.shadowColor=r.stopped&&j===0?col:'transparent';
      mc.shadowBlur=r.stopped&&j===0?8:0;
      mc.fillText(sym,rx+reelW/2,sy);
      mc.shadowBlur=0;
    }
    mc.restore();

    // Center highlight
    mc.strokeStyle='rgba(255,220,0,.4)'; mc.lineWidth=1; mc.setLineDash([3,3]);
    mc.beginPath();
    mc.moveTo(rx,2+reelH*.38); mc.lineTo(rx+reelW,2+reelH*.38);
    mc.moveTo(rx,2+reelH*.62); mc.lineTo(rx+reelW,2+reelH*.62);
    mc.stroke(); mc.setLineDash([]);
    mc.strokeStyle='rgba(255,255,255,.15)'; mc.lineWidth=1;
    mc.strokeRect(rx,2,reelW,reelH);
  }

  // Center payline
  mc.strokeStyle='rgba(255,200,0,.6)'; mc.lineWidth=2; mc.setLineDash([]);
  mc.beginPath(); mc.moveTo(0,H/2); mc.lineTo(W,H/2); mc.stroke();
}
