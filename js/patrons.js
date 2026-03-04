// ═══════════════════════════════════════════
//  patrons.js — Patron AI
// ═══════════════════════════════════════════

const HAIR_COLORS=['#3a2808','#1a1008','#c8a040','#a06020','#e0c890','#202020','#e04040'];

function spawnPatron() {
  if(G.patrons.length>=28) return;
  const slots=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot&&m.occupied==null);
  if(slots.length===0) return;

  const wp=tile2world(ENT_TX,ENT_TY);
  const p={
    id:G.nextPid++,
    name:PATRON_NAMES[Math.floor(Math.random()*PATRON_NAMES.length)],
    color:PATRON_COLORS[Math.floor(Math.random()*PATRON_COLORS.length)],
    hairColor:HAIR_COLORS[Math.floor(Math.random()*HAIR_COLORS.length)],
    wx:wp.x+TILE/2, wy:wp.y+TILE/2+TILE*1.3,
    state:'ENTERING',
    targetX:wp.x+TILE/2, targetY:wp.y+TILE/2,
    speed:50+Math.random()*40,
    machineId:null, ticketValue:0, ticketPaid:false,
    budget:20+Math.random()*100,
    playTimer:0, spinInterval:0, spinsLeft:0, _won:false,
    wantsFood:Math.random()<.35,  // does this patron want food?
    foodState:null,               // null | 'will_order' | 'ordering' | 'waiting' | 'eating' | 'done'
    eatTimer:0,
    _kioskTimer:0,
  };
  G.patrons.push(p);
}

// ── State machine update ─────────────────
function updatePatron(p,dt) {
  switch(p.state) {
    case 'ENTERING':
    case 'WALKING_TO_MACHINE':
    case 'WALKING_TO_CASHIER':
    case 'WALKING_TO_KIOSK':
    case 'WALKING_TO_BAR':
    case 'LEAVING':
      movePatron(p,dt);
      break;

    case 'PLAYING':
      updatePlaying(p,dt);
      break;

    case 'WAITING_CASHIER':
    case 'WAITING_KIOSK':
    case 'WAITING_AT_BAR':
    case 'WAITING_JACKPOT':
      updateWaiting(p,dt);
      break;

    case 'EATING':
      p.eatTimer-=dt;
      if(p.eatTimer<=0) finishEating(p);
      break;

    case 'PAID':
      p.ticketPaid=true; p.ticketValue=0;
      kickOut(p);
      break;
  }
}

function updatePlaying(p,dt) {
  p.playTimer+=dt;
  if(p.spinsLeft>0 && p.playTimer>=p.spinInterval) {
    p.playTimer-=p.spinInterval;
    p.spinsLeft--;
    doSpin(p);
  }
  if(p.spinsLeft<=0) finishPlaying(p);
}

function updateWaiting(p,dt) {
  if(p.state==='WAITING_KIOSK') {
    p._kioskTimer-=dt;
    if(p._kioskTimer<=0) {
      G.money-=p.ticketValue;
      spawnFloat(p.wx,p.wy-18,'-$'+p.ticketValue.toFixed(2)+' kiosk','#e08060');
      p.ticketPaid=true; p.ticketValue=0;
      afterPayment(p);
    }
  }
}

// ── Machine assignment ─────────────────────
function assignMachine(p) {
  const slots=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot&&m.occupied==null);
  if(!slots.length){kickOut(p);return;}
  let best=null,bestDist=Infinity;
  for(const m of slots) {
    const wp=tile2world(m.tx,m.ty);
    const dx=wp.x+TILE/2-p.wx, dy=wp.y+TILE/2-p.wy;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<bestDist){best=m;bestDist=d;}
  }
  best.occupied=p.id;
  p.machineId=best.id;
  p.state='WALKING_TO_MACHINE';
  // Walk to front of machine
  const fp=getMachineFrontPos(best);
  p.targetX=fp.wx; p.targetY=fp.wy;
}

function getMachineFrontPos(m) {
  const def=MACHINE_DEFS[m.type];
  const rot=m.rotation||0;
  const off=getPatronOffset(rot);
  const pw=rot%2===0?def.w:def.h;
  const ph=rot%2===0?def.h:def.w;
  const wp=tile2world(m.tx,m.ty);
  return {
    wx: wp.x + (pw/2+off.dx)*TILE,
    wy: wp.y + (ph/2+off.dy)*TILE
  };
}

function startPlaying(p) {
  p.state='PLAYING';
  const m=G.machines.find(m=>m.id===p.machineId);
  if(!m){kickOut(p);return;}
  const def=MACHINE_DEFS[m.type];
  p.spinInterval=def.playTime*(1-(m.upgrades.speed||0)*.18);
  p.spinsLeft=3+Math.floor(Math.random()*7);
  p.playTimer=0; p._won=false;
  // Start reel animation
  if(!m._reels) initMachineReels(m);
}

// ── Spin logic ────────────────────────────
function doSpin(p) {
  const m=G.machines.find(m=>m.id===p.machineId);
  if(!m) return;
  const def=MACHINE_DEFS[m.type];
  const betMult=1+(m.upgrades.bet||0)*.25;
  const bet=parseFloat(((def.betMin+Math.random()*(def.betMax-def.betMin))*betMult).toFixed(2));
  if(p.budget<bet){p.spinsLeft=0;return;}
  p.budget-=bet;

  G.money+=bet; G.totalEarned+=bet;
  m.totalEarned=(m.totalEarned||0)+bet;
  trackRev(bet);
  m._flash=Date.now(); m._flashTxt='+$'+bet.toFixed(2);

  const luckBonus=(m.upgrades.luck||0)*.02;
  const winRate=def.winRate+luckBonus;
  let reelResult=[
    REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)],
    REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)],
    REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)]
  ];

  if(Math.random()<winRate) {
    const mult=def.winMultMin+Math.random()*(def.winMultMax-def.winMultMin);
    const payout=parseFloat((bet*mult).toFixed(2));
    p.ticketValue=parseFloat((p.ticketValue+payout).toFixed(2));
    p._won=true;
    // Match reels on win
    const winSym=REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)];
    reelResult=[winSym,winSym,winSym];
    spawnFloat(p.wx,p.wy-20,'WIN $'+payout.toFixed(2),'#f0d060');

    // Jackpot check
    if(p.ticketValue>=JACKPOT_THRESH&&!G.jackpots.find(j=>j.patronId===p.id)) {
      triggerJackpot(m,p,p.ticketValue);
    }
  }
  startMachineReels(m,reelResult);
}

function triggerJackpot(m,p,amount) {
  G.jackpots.push({
    id:G.nextDropId++,
    machineId:m.id, patronId:p.id,
    amount, timer:JACKPOT_TIMEOUT
  });
  p.state='WAITING_JACKPOT';
  p.spinsLeft=0;
  toast('🏆 JACKPOT! $'+amount.toFixed(2)+' — Handle it!','g');
}

function finishPlaying(p) {
  const m=G.machines.find(m=>m.id===p.machineId);
  if(m) m.occupied=null;
  p.machineId=null;

  if(p.ticketValue>0) routeToPayment(p);
  else afterPlayment(p);
}

function afterPlayment(p) {
  // Patron may want food/drinks after playing
  if(p.wantsFood&&!p.foodState) {
    const bar=G.machines.find(m=>m.type==='bar');
    if(bar) {
      routeToBar(p,bar);
      return;
    }
  }
  kickOut(p);
}

// ── Payment routing ────────────────────────
function routeToPayment(p) {
  const kiosk=G.machines.find(m=>m.type==='kiosk');
  const cashier=G.machines.find(m=>m.type==='cashier');
  if(kiosk&&(!cashier||Math.random()<.55)) {
    p.state='WALKING_TO_KIOSK';
    const wp=tile2world(kiosk.tx,kiosk.ty);
    p.targetX=wp.x+TILE/2; p.targetY=wp.y+TILE+8;
    p._kioskTimer=2200;
  } else if(cashier) {
    p.state='WALKING_TO_CASHIER';
    const wp=tile2world(cashier.tx,cashier.ty);
    p.targetX=wp.x+MACHINE_DEFS.cashier.w*TILE/2;
    p.targetY=wp.y+TILE+8;
  } else {
    spawnFloat(p.wx,p.wy-16,'Need cashier!','#e07070');
    kickOut(p);
  }
}

function afterPayment(p) {
  if(p.wantsFood&&!p.foodState) {
    const bar=G.machines.find(m=>m.type==='bar');
    if(bar){routeToBar(p,bar);return;}
  }
  kickOut(p);
}

// ── Food routing ───────────────────────────
function routeToBar(p,bar) {
  p.state='WALKING_TO_BAR';
  p.foodState='will_order';
  const wp=tile2world(bar.tx,bar.ty);
  const def=MACHINE_DEFS.bar;
  p.targetX=wp.x+def.w*TILE/2;
  p.targetY=wp.y+TILE+8;
  p._barId=bar.id;
}

function finishEating(p) {
  p.foodState='done';
  // Drop tip
  const tipAmt=parseFloat((1+Math.random()*4).toFixed(2));
  G.tips.push({id:G.nextTipId++,wx:p.wx,wy:p.wy-18,amount:tipAmt,patronId:p.id});
  // Drop dirty item at bar
  const bar=G.machines.find(m=>m.id===p._barId);
  if(bar) {
    const wp=tile2world(bar.tx,bar.ty);
    G.dirtyItems.push({id:G.nextDirtyId++,wx:wp.x+TILE/2,wy:wp.y+TILE*.4,machineId:bar.id});
  }
  kickOut(p);
}

function kickOut(p) {
  p.state='LEAVING';
  const wp=tile2world(ENT_TX,ENT_TY);
  p.targetX=wp.x+TILE/2; p.targetY=wp.y+TILE*2.5;
  // Chance to drop money
  if(Math.random()<.15) dropMoney(p);
}

function dropMoney(p) {
  const amt=parseFloat((.25+Math.random()*4.75).toFixed(2));
  G.droppedMoney.push({id:G.nextDropId++,wx:p.wx+Math.random()*20-10,wy:p.wy+Math.random()*10,amount:amt});
}

// ── Movement ──────────────────────────────
function movePatron(p,dt) {
  const dx=p.targetX-p.wx, dy=p.targetY-p.wy;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const step=p.speed*dt/1000;
  if(dist<=step+.5) {
    p.wx=p.targetX; p.wy=p.targetY;
    onPatronArrival(p);
  } else {
    p.wx+=dx/dist*step; p.wy+=dy/dist*step;
  }
}

function onPatronArrival(p) {
  switch(p.state) {
    case 'ENTERING':          assignMachine(p); break;
    case 'WALKING_TO_MACHINE': startPlaying(p); break;
    case 'WALKING_TO_CASHIER':
      p.state='WAITING_CASHIER';
      if(!G.cashierQueue.includes(p.id)) G.cashierQueue.push(p.id);
      updateCashierAlert();
      break;
    case 'WALKING_TO_KIOSK':
      p.state='WAITING_KIOSK'; p._kioskTimer=2200; break;
    case 'WALKING_TO_BAR':
      p.state='WAITING_AT_BAR';
      createFoodOrder(p);
      break;
    case 'LEAVING':
      G.patrons=G.patrons.filter(x=>x.id!==p.id); break;
  }
}

function createFoodOrder(p) {
  const item=FOOD_MENU[Math.floor(Math.random()*FOOD_MENU.length)];
  const bar=G.machines.find(m=>m.id===p._barId);
  if(!bar) {kickOut(p);return;}
  const order={
    id:G.nextOrderId++,
    patronId:p.id, barId:bar.id,
    item:item.id, state:'waiting_take',
    progress:0, serverId:null,
    tip:parseFloat((1+Math.random()*5).toFixed(2))
  };
  G.foodOrders.push(order);
  p.foodState='ordering';
  toast(p.name+' orders '+item.icon+' '+item.name);
}
