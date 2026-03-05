// ═══════════════════════════════════════════
//  patrons.js — Patron AI
// ═══════════════════════════════════════════

const HAIR_COLORS=['#3a2808','#1a1008','#c8a040','#a06020','#e0c890','#202020','#e04040'];

function spawnPatron() {
  if(G.patrons.length>=22) return;
  // Spawn if there's any machine patrons can interact with
  const hasMachines=G.machines.some(m=>{
    const def=MACHINE_DEFS[m.type];
    return def.isSlot||def.tableGame||def.isSportsbook||def.isBand||def.isBar;
  });
  if(!hasMachines) return;

  const wp=tile2world(ENT_TX(),ENT_TY());
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
    budget:8+Math.random()*22,   // $8–30 keeps sessions realistic vs. lower bets
    playTimer:0, spinInterval:0, spinsLeft:0, _won:false,
    wantsFood:Math.random()<.30,
    foodState:null, eatTimer:0,
    _kioskTimer:0, _barId:null,
    visited:true
  };
  G.dayStats.patronsVisited++;
  G.patrons.push(p);
}

function updatePatron(p,dt) {
  switch(p.state) {
    case 'ENTERING':
    case 'WALKING_TO_MACHINE':
    case 'WALKING_TO_CASHIER':
    case 'WALKING_TO_KIOSK':
    case 'WALKING_TO_BAR':
    case 'WALKING_TO_TABLE':
    case 'LEAVING':
      movePatron(p,dt); break;
    case 'PLAYING':
      updatePlaying(p,dt); break;
    case 'WAITING_CASHIER':
    case 'WAITING_AT_BAR':
    case 'WAITING_JACKPOT':
    case 'IDLE_AT_TABLE':
      break; // idle
    case 'WAITING_KIOSK':
      p._kioskTimer-=dt;
      if(p._kioskTimer<=0) {
        const paid=p.ticketValue;
        G.money-=paid; G.dayStats.moneyOut+=paid;
        spawnFloat(p.wx,p.wy-18,'-$'+paid.toFixed(2)+' kiosk','#e08060');
        p.ticketPaid=true; p.ticketValue=0;
        afterPayment(p);
      }
      break;
    case 'EATING':
      p.eatTimer-=dt;
      if(p.eatTimer<=0) finishEating(p);
      break;
    case 'PAID':
      p.ticketPaid=true;
      G.money -= p.ticketValue;
      G.dayStats.moneyOut += p.ticketValue;
      p.ticketValue=0;
      afterPayment(p);
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

  // Don't finish if state was changed to WAITING_JACKPOT inside doSpin
  if(p.state !== 'PLAYING') return;

  if(p.spinsLeft<=0) {
    // Wait for the last spin's reels to stop before walking away
    const m = G.machines.find(m=>m.id===p.machineId);
    const reelsStillSpin = m && m._reels && m._reels.some(r=>!r.stopped);
    if(!reelsStillSpin) finishPlaying(p);
  }
}

function assignMachine(p) {
  const slots=G.machines.filter(m=>MACHINE_DEFS[m.type].isSlot&&m.occupied==null);
  const tables=G.machines.filter(m=>MACHINE_DEFS[m.type].isTable&&MACHINE_DEFS[m.type].tableGame);
  const bands=G.machines.filter(m=>MACHINE_DEFS[m.type].isBand);
  const sports=G.machines.filter(m=>MACHINE_DEFS[m.type].isSportsbook);

  // Weighted choice: 65% slots, 20% tables, 10% band/sports, 5% leave
  const r=Math.random();
  let candidates=[];
  if(r<0.65&&slots.length)       candidates=slots;
  else if(r<0.85&&tables.length) candidates=tables;
  else if(r<0.92&&(bands.length||sports.length)) candidates=[...bands,...sports];
  else if(slots.length)          candidates=slots; // fallback

  if(!candidates.length){kickOut(p);return;}

  let best=null,bestDist=Infinity;
  for(const m of candidates) {
    if(MACHINE_DEFS[m.type].isSlot&&m.occupied!=null) continue;
    const wp=tile2world(m.tx,m.ty);
    const dx=wp.x+TILE/2-p.wx, dy=wp.y+TILE/2-p.wy;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<bestDist){best=m;bestDist=d;}
  }
  if(!best){kickOut(p);return;}

  const def=MACHINE_DEFS[best.type];
  if(def.isSlot) {
    best.occupied=p.id;
    p.machineId=best.id;
    p.state='WALKING_TO_MACHINE';
    const fp=getMachineFrontPos(best);
    p.targetX=fp.wx; p.targetY=fp.wy;
  } else if(def.isTable&&def.tableGame) {
    const ts=TABLE_STATES[best.id];
    const totalSeats=def.seats||4;
    const seatsTaken=ts?ts.players.length:0;
    // Count patrons already walking to or sitting at this table
    const alreadyHere=G.patrons.filter(p2=>
      p2.id!==p.id&&(p2.tableId===best.id)&&
      (p2.state==='WALKING_TO_TABLE'||p2.state==='IDLE_AT_TABLE')
    ).length;
    if(alreadyHere>=totalSeats){kickOut(p);return;}
    const nextSeat=seatsTaken+alreadyHere;
    routePatronToTableSeat(p, best, nextSeat);
  } else if(def.isBand||def.isSportsbook) {
    // Spread watchers out in an arc in front of the machine
    const fp=getMachineFrontPos(best);
    const watcherCount=G.patrons.filter(p2=>
      p2.id!==p.id&&p2.machineId===best.id&&
      (p2.state==='WALKING_TO_MACHINE'||p2.state==='PLAYING')
    ).length;
    // Fan out: each watcher offset by 32px tangentially
    const angle=(watcherCount%8)*(Math.PI/4);
    const spread=Math.floor(watcherCount/8+1)*28;
    p.state='WALKING_TO_MACHINE';
    p.machineId=best.id;
    p.targetX=fp.wx + Math.cos(angle)*spread;
    p.targetY=fp.wy + Math.sin(angle)*spread*0.5 + 8;
  } else {
    kickOut(p);
  }
}

function getMachineFrontPos(m) {
  const def=MACHINE_DEFS[m.type];
  const rot=m.rotation||0;
  const off=getPatronOffset(rot);
  const pw=rot%2===0?def.w:def.h;
  const ph=rot%2===0?def.h:def.w;
  const wp=tile2world(m.tx,m.ty);
  return { wx:wp.x+(pw/2+off.dx)*TILE, wy:wp.y+(ph/2+off.dy)*TILE };
}

function startPlaying(p) {
  p.state='PLAYING';
  const m=G.machines.find(m=>m.id===p.machineId);
  if(!m){kickOut(p);return;}
  const def=MACHINE_DEFS[m.type];
  p.spinInterval=def.playTime*(1-(m.upgrades.speed||0)*.18);
  p.spinsLeft=3+Math.floor(Math.random()*7);
  p.playTimer=0; p._won=false;
  if(!m._reels) initMachineReels(m);
}

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
  G.dayStats.moneyIn+=bet;
  trackRev(bet);
  m._flash=Date.now(); m._flashTxt='+$'+bet.toFixed(2);

  // Very small chance to drop money near machine during play (1 in 200 spins)
  if(Math.random()<0.005) dropMoneyNear(m,p);

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
    const winSym=REEL_SYMBOLS[Math.floor(Math.random()*REEL_SYMBOLS.length)];
    reelResult=[winSym,winSym,winSym];
    spawnFloat(p.wx,p.wy-20,'WIN $'+payout.toFixed(2),'#f0d060');
    // Rare chance to drop a coin on a large win
    if(payout>8&&Math.random()<0.025) dropMoneyNear(m,p);

    if(p.ticketValue>=JACKPOT_THRESH&&!G.jackpots.find(j=>j.patronId===p.id)) {
      triggerJackpot(m,p,p.ticketValue);
    }
  }
  startMachineReels(m,reelResult);
}

// Drop money in FRONT of machine (at patron's feet), never under it
function dropMoneyNear(m,p) {
  const front = getMachineFrontPos(m);
  const amt   = parseFloat((.10+Math.random()*1.90).toFixed(2));
  // Scatter a little around front position
  G.droppedMoney.push({
    id:G.nextDropId++,
    wx: front.wx + (Math.random()*24-12),
    wy: front.wy + (Math.random()*16),
    amount:amt,
    patronName:p.name
  });
}

function triggerJackpot(m,p,amount) {
  G.jackpots.push({id:G.nextDropId++,machineId:m.id,patronId:p.id,amount,timer:JACKPOT_TIMEOUT});
  p.state='WAITING_JACKPOT'; p.spinsLeft=0;
  toast('🏆 JACKPOT! $'+amount.toFixed(2)+' — Handle it!','g');
}

function finishPlaying(p) {
  const m=G.machines.find(m=>m.id===p.machineId);
  if(m) m.occupied=null;
  p.machineId=null;

  // Chance to drop money at the cashier window when redeeming
  if(p.ticketValue>0) {
    routeToPayment(p);
  } else {
    afterPlayment(p);
  }
}

function afterPlayment(p) {
  if(p.wantsFood&&!p.foodState) {
    const bar=G.machines.find(m=>m.type==='bar');
    if(bar){routeToBar(p,bar);return;}
  }
  kickOut(p);
}

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
  // Rare chance to drop coins near cashier counter (in front, not under)
  if(Math.random()<0.02) {
    const cashier=G.machines.find(m=>m.type==='cashier');
    if(cashier) {
      const fp=getMachineFrontPos(cashier);
      const amt=parseFloat((.05+Math.random()*0.95).toFixed(2));
      G.droppedMoney.push({
        id:G.nextDropId++,
        wx:fp.wx+(Math.random()*32-16),
        wy:fp.wy+(Math.random()*10),
        amount:amt, patronName:p.name
      });
    }
  }
  if(p.wantsFood&&!p.foodState) {
    const bar=G.machines.find(m=>m.type==='bar');
    if(bar){routeToBar(p,bar);return;}
  }
  kickOut(p);
}

function routeToBar(p,bar) {
  p.state='WALKING_TO_BAR'; p.foodState='will_order';
  // Walk to front face of bar, not overlapping bar tiles
  const fp=getMachineFrontPos(bar);
  p.targetX=fp.wx+(Math.random()*20-10);
  p.targetY=fp.wy+8;
  p._barId=bar.id;
}

function finishEating(p) {
  p.foodState='done';
  const tipAmt=parseFloat((0.5+Math.random()*3.5).toFixed(2));
  G.tips.push({id:G.nextTipId++,wx:p.wx,wy:p.wy-18,amount:tipAmt,patronId:p.id});
  const bar=G.machines.find(m=>m.id===p._barId);
  if(bar) {
    const wp=tile2world(bar.tx,bar.ty);
    G.dirtyItems.push({id:G.nextDirtyId++,wx:wp.x+TILE/2,wy:wp.y+TILE*.4,machineId:bar.id});
  }
  kickOut(p);
}

function kickOut(p) {
  p.state='LEAVING';
  const wp=tile2world(ENT_TX(),ENT_TY());
  p.targetX=wp.x+TILE/2; p.targetY=wp.y+TILE*2.5;
  // NO money drop here - drops only happen near machines/cashier
}

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
    case 'WALKING_TO_TABLE':
      p.state='IDLE_AT_TABLE';
      break;
  }
}

function createFoodOrder(p) {
  const item=FOOD_MENU[Math.floor(Math.random()*FOOD_MENU.length)];
  const bar=G.machines.find(m=>m.id===p._barId);
  if(!bar){kickOut(p);return;}
  G.foodOrders.push({
    id:G.nextOrderId++,
    patronId:p.id, barId:bar.id,
    item:item.id, state:'waiting_take',
    progress:0, serverId:null,
    tip:parseFloat((.5+Math.random()*4).toFixed(2))
  });
  p.foodState='ordering';
  toast(p.name+' orders '+item.icon+' '+item.name);
}
