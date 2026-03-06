// ═══════════════════════════════════════════
//  patrons.js — Patron AI
// ═══════════════════════════════════════════

const HAIR_COLORS=['#3a2808','#1a1008','#c8a040','#a06020','#e0c890','#202020','#e04040'];

function spawnPatron() {
  // Cap is managed by the game loop using getSpawnMultiplier()
  // Spawn if there's any machine patrons can interact with
  const hasMachines=G.machines.some(m=>{
    const def=MACHINE_DEFS[m.type];
    return def.isSlot||def.tableGame||def.isSportsbook||def.isBand||def.isBar;
  });
  if(!hasMachines) return;

  const isHighRoller = Math.random() < 0.10; // 10% chance
  const wp=tile2world(ENT_TX(),ENT_TY());
  const p={
    id:G.nextPid++,
    name:PATRON_NAMES[Math.floor(Math.random()*PATRON_NAMES.length)],
    color: isHighRoller ? '#d4a820' : PATRON_COLORS[Math.floor(Math.random()*PATRON_COLORS.length)],
    hairColor:HAIR_COLORS[Math.floor(Math.random()*HAIR_COLORS.length)],
    wx:wp.x+TILE/2, wy:wp.y+TILE/2+TILE*1.3,
    state:'ENTERING',
    targetX:wp.x+TILE/2, targetY:wp.y+TILE/2,
    speed:50+Math.random()*40,
    machineId:null, ticketValue:0, ticketPaid:false,
    // High rollers have 5–15× normal budget
    budget: isHighRoller
      ? 150 + Math.random()*350
      : 25  + Math.random()*55,
    isHighRoller,
    playTimer:0, spinInterval:0, spinsLeft:0, _won:false,
    wantsFood:Math.random()<.30,
    foodState:null, eatTimer:0,
    _kioskTimer:0, _barId:null,
    visited:true,
    _spentTotal:0, _wonTotal:0,
    _machineVisits:{},
    _favMachine:null,
    _mood:100,
    _waitTimer:0,
    _waitMax:0,
    _thought:null,
    _wanderTimer:0,
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
    case 'WANDERING':
      movePatron(p,dt); break;
    case 'PLAYING':
      updatePlaying(p,dt); break;
    case 'WAITING_CASHIER':
      // Patience: leave after ~90 real-seconds if nobody serves them
      if(!p._cashierWait) p._cashierWait = 90000;
      p._cashierWait -= dt;
      if(p._cashierWait <= 0) {
        G.cashierQueue = G.cashierQueue.filter(id=>id!==p.id);
        _refreshCashierQueuePositions();
        updateCashierAlert();
        p._cashierWait = null;
        spawnFloat(p.wx, p.wy-18, '😤 Gave up!', '#e07070');
        kickOut(p);
      }
      break;
    case 'WAITING_AT_BAR':
    case 'WAITING_JACKPOT':
    case 'IDLE_AT_TABLE':
      break; // idle
    case 'WANDERING':
      movePatron(p,dt); // walk to wander target
      p._mood = Math.max(0, p._mood - dt*0.002);
      p._waitTimer -= dt;
      if(p._waitTimer <= 0) {
        // Patience expired — leave frustrated
        p._mood = Math.max(0, p._mood - 20);
        p._thought = pickThought(p,'frustrated');
        kickOut(p);
        break;
      }
      // Retry assignment every 3 seconds
      if(!p._retryAcc) p._retryAcc = 0;
      p._retryAcc += dt;
      if(p._retryAcc >= 3000) {
        p._retryAcc = 0;
        assignMachine(p);
        if(p.state !== 'WANDERING') break; // got assigned, stop wandering
      }
      // Pick a new random wander target when we arrive
      if(Math.hypot(p.wx-p.targetX, p.wy-p.targetY) < 8) {
        _pickWanderTarget(p);
      }
      break;
    case 'WAITING_MACHINE': // legacy compat
      p.state = 'WANDERING';
      _pickWanderTarget(p);
      break;
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
  const m=G.machines.find(m=>m.id===p.machineId);
  // Band / sportsbook watcher — just count down and leave
  if(m && (MACHINE_DEFS[m.type].isBand || MACHINE_DEFS[m.type].isSportsbook)) {
    p._watchTimer = (p._watchTimer||20000) - dt;
    if(p._watchTimer <= 0) {
      p.machineId=null;
      afterPlayment(p);
    }
    return;
  }

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
  const slots      = G.machines.filter(m => MACHINE_DEFS[m.type].isSlot);
  const freeSlots  = slots.filter(m => m.occupied == null && !m.broken);
  const tables     = G.machines.filter(m => MACHINE_DEFS[m.type].isTable && MACHINE_DEFS[m.type].tableGame);
  const bands      = G.machines.filter(m => MACHINE_DEFS[m.type].isBand);
  const sports     = G.machines.filter(m => MACHINE_DEFS[m.type].isSportsbook);
  const allEntertainment = [...tables, ...bands, ...sports];

  const r = Math.random();
  let candidates = [];

  if (r < 0.65 && slots.length) {
    // Wants a slot
    if (freeSlots.length > 0) {
      candidates = freeSlots;
    } else if (allEntertainment.length > 0) {
      // All slots full — try entertainment as fallback instead of leaving
      candidates = allEntertainment;
    } else {
      // Nothing free at all — wander and keep checking
      p.state = 'WANDERING';
      p._waitTimer = 20000 + Math.random() * 15000;
      p._retryAcc = 0;
      p._mood = Math.max(50, p._mood - 8);
      p._thought = pickThought(p, 'full');
      _pickWanderTarget(p);
      return;
    }
  } else if (r < 0.85 && tables.length) {
    candidates = tables;
  } else if (r < 0.92 && allEntertainment.length) {
    candidates = allEntertainment;
  } else if (freeSlots.length) {
    candidates = freeSlots;
  } else if (allEntertainment.length) {
    candidates = allEntertainment;
  }

  // Still nothing? Wander if any machine exists, otherwise kick out
  if (!candidates.length) {
    if (slots.length > 0 || allEntertainment.length > 0) {
      p.state = 'WANDERING';
      p._waitTimer = 16000 + Math.random() * 10000;
      p._retryAcc = 0;
      p._thought = pickThought(p, 'full');
      _pickWanderTarget(p);
    } else {
      kickOut(p);
    }
    return;
  }

  // Find closest valid candidate
  let best = null, bestDist = Infinity;
  for (const m of candidates) {
    if (MACHINE_DEFS[m.type].isSlot && m.occupied != null) continue;
    const wp = tile2world(m.tx, m.ty);
    const dx = wp.x + TILE/2 - p.wx, dy = wp.y + TILE/2 - p.wy;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < bestDist) { best = m; bestDist = d; }
  }

  if (!best) {
    // Candidates exist but all occupied — wander
    p.state = 'WANDERING';
    p._waitTimer = 14000 + Math.random() * 8000;
    p._retryAcc = 0;
    p._thought = pickThought(p, 'full');
    _pickWanderTarget(p);
    return;
  }

  const def = MACHINE_DEFS[best.type];
  if (def.isSlot) {
    best.occupied = p.id;
    p.machineId = best.id;
    p.state = 'WALKING_TO_MACHINE';
    const fp = getMachineFrontPos(best);
    p.targetX = fp.wx; p.targetY = fp.wy;
    p._machineVisits[best.type] = (p._machineVisits[best.type] || 0) + 1;
    const fav = Object.entries(p._machineVisits).sort((a,b) => b[1]-a[1])[0];
    if (fav) p._favMachine = fav[0];
  } else if(def.isTable&&def.tableGame) {
    const ts=TABLE_STATES[best.id];
    const totalSeats=def.seats||4;
    const seatsTaken=ts?ts.players.length:0;
    const alreadyHere=G.patrons.filter(p2=>
      p2.id!==p.id&&(p2.tableId===best.id)&&
      (p2.state==='WALKING_TO_TABLE'||p2.state==='IDLE_AT_TABLE')
    ).length;
    if(alreadyHere>=totalSeats){
      p.state='WANDERING'; p._waitTimer=14000; p._retryAcc=0;
      p._thought=pickThought(p,'full');
      _pickWanderTarget(p);
      return;
    }
    const nextSeat=seatsTaken+alreadyHere;
    routePatronToTableSeat(p, best, nextSeat);
    p._machineVisits[best.type]=(p._machineVisits[best.type]||0)+1;
  } else if(def.isBand||def.isSportsbook) {
    const fp=getMachineFrontPos(best);
    const watcherCount=G.patrons.filter(p2=>
      p2.id!==p.id&&p2.machineId===best.id&&
      (p2.state==='WALKING_TO_MACHINE'||p2.state==='PLAYING')
    ).length;
    const angle=(watcherCount%8)*(Math.PI/4);
    const spread=Math.floor(watcherCount/8+1)*28;
    p.state='WALKING_TO_MACHINE';
    p.machineId=best.id;
    p.targetX=fp.wx + Math.cos(angle)*spread;
    p.targetY=fp.wy + Math.sin(angle)*spread*0.5 + 8;
    p._machineVisits[best.type]=(p._machineVisits[best.type]||0)+1;
  } else {
    kickOut(p);
  }
}



function _positionInCashierQueue(p) {
  const cashier = G.machines.find(m=>m.type==='cashier');
  if(!cashier) return;
  const fp = getMachineFrontPos(cashier);
  const qIdx = G.cashierQueue.indexOf(p.id);
  const rot = cashier.rotation||0;
  // Queue stretches away from the machine face
  const queueDir = [
    {dx:0, dy:1},   // rot 0: queue goes further south
    {dx:-1,dy:0},   // rot 1: queue goes further west
    {dx:0, dy:-1},  // rot 2: queue goes further north
    {dx:1, dy:0},   // rot 3: queue goes further east
  ][rot];
  const spacing = TILE * 0.9;
  p.wx = fp.wx + queueDir.dx * spacing * qIdx;
  p.wy = fp.wy + queueDir.dy * spacing * qIdx;
  p.targetX = p.wx;
  p.targetY = p.wy;
}

function _refreshCashierQueuePositions() {
  // After someone is paid and leaves, slide everyone forward
  const cashier = G.machines.find(m=>m.type==='cashier');
  if(!cashier) return;
  for(const pid of G.cashierQueue) {
    const p = G.patrons.find(x=>x.id===pid);
    if(p) _positionInCashierQueue(p);
  }
}


function _pickWanderTarget(p) {
  // Pick a random walkable tile on the floor
  const tries = 8;
  for(let i=0;i<tries;i++){
    const tx = Math.floor(Math.random()*G.floorW);
    const ty = Math.floor(Math.random()*G.floorH);
    if(!validTile(tx,ty)) continue;
    // Don't walk into a machine tile
    if(G.machines.some(m=>{
      const def=MACHINE_DEFS[m.type]; const r=m.rotation||0;
      const pw=r%2===0?def.w:def.h,ph=r%2===0?def.h:def.w;
      return tx>=m.tx&&tx<m.tx+pw&&ty>=m.ty&&ty<m.ty+ph;
    })) continue;
    const wp=tile2world(tx,ty);
    p.targetX=wp.x+TILE/2; p.targetY=wp.y+TILE/2;
    return;
  }
  // Fallback — wander near entrance
  const wp=tile2world(ENT_TX(),ENT_TY());
  p.targetX=wp.x+TILE/2+(Math.random()*3-1.5)*TILE;
  p.targetY=wp.y-TILE;
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

function getMachineBackPos(m) {
  // Staff stand on the back side — opposite the patron-facing direction,
  // tucked inside/behind the machine sprite so patrons have the front clear.
  const def=MACHINE_DEFS[m.type];
  const rot=m.rotation||0;
  const off=getPatronOffset(rot);
  const pw=rot%2===0?def.w:def.h;
  const ph=rot%2===0?def.h:def.w;
  const wp=tile2world(m.tx,m.ty);
  // Negate the patron offset so staff stand behind, then pull in by 0.3 tiles
  // so they're visually tucked behind the machine layer
  return {
    wx: wp.x + (pw/2 - off.dx * 0.9) * TILE,
    wy: wp.y + (ph/2 - off.dy * 0.9) * TILE,
  };
}

function startPlaying(p) {
  p.state='PLAYING';
  const m=G.machines.find(m=>m.id===p.machineId);
  if(!m){kickOut(p);return;}
  const def=MACHINE_DEFS[m.type];
  if(def.isBand||def.isSportsbook) {
    // Watchers stay for 15-40 seconds, then leave
    p._watchTimer = 15000 + Math.random()*25000;
    p._thought = pickThought(p, def.isSportsbook?'sports':'enter');
    return;
  }
  p.spinInterval=def.playTime*(1-(m.upgrades.speed||0)*.18);
  p.spinsLeft=3+Math.floor(Math.random()*7);
  p.playTimer=0; p._won=false;
  if(!m._reels) initMachineReels(m);
}

function doSpin(p) {
  const m=G.machines.find(m=>m.id===p.machineId);
  if(!m) return;
  const def=MACHINE_DEFS[m.type];
  // Degrade machine health
  if(def.degradePerSpin) {
    const speedBonus = (m.upgrades.speed||0) * 0.15; // upgrades slow degradation
    const degrade = def.degradePerSpin * (1 - speedBonus);
    m.health = Math.max(0, (m.health ?? 100) - degrade);
    if(m.health <= 0 && !m.broken) {
      m.broken = true;
      m.occupied = null;
      p.machineId = null;
      p.spinsLeft = 0;
      spawnFloat(p.wx, p.wy-22, '⚠️ Machine broke!', '#e09040');
      const _mId = m.id;
      notif('🔧 '+def.name+' broke down!', 'r',
        () => { centerOnMachine(m); openRepairPanel(_mId); }, '🔧');
      return;
    }
  }

  const betMult=1+(m.upgrades.bet||0)*.25;
  const hrMult = p.isHighRoller ? (3+Math.random()*5) : 1;
  const bet=parseFloat(((def.betMin+Math.random()*(def.betMax-def.betMin))*betMult*hrMult).toFixed(2));
  if(p.budget<bet){p.spinsLeft=0;return;}
  p.budget-=bet;
  p._spentTotal=(p._spentTotal||0)+bet;

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
    p._wonTotal=(p._wonTotal||0)+payout;
    p._won=true;
    p._mood=Math.min(100,p._mood+12);
    p._thought=pickThought(p,'win');
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
    const fp=getMachineFrontPos(kiosk);
    p.targetX=fp.wx; p.targetY=fp.wy;
    p._kioskTimer=2200;
  } else if(cashier) {
    p.state='WALKING_TO_CASHIER';
    const fp=getMachineFrontPos(cashier);
    p.targetX=fp.wx+(Math.random()*16-8);
    p.targetY=fp.wy;
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

function routeToBar(p, bar) {
  p.state='WALKING_TO_BAR'; p.foodState='will_order';
  // Assign a unique bar stool slot so patrons don't stack
  const slotsUsed = G.patrons
    .filter(p2 => p2.id !== p.id && p2._barId === bar.id &&
      (p2.state==='WALKING_TO_BAR'||p2.state==='WAITING_AT_BAR'||p2.state==='EATING'))
    .map(p2 => p2._barSlot != null ? p2._barSlot : -1);
  let slot = 0;
  while(slotsUsed.includes(slot)) slot++;
  p._barId = bar.id;
  p._barSlot = slot;
  _setBarSlotTarget(p, bar, slot);
}

function _setBarSlotTarget(p, bar, slot) {
  const fp  = getMachineFrontPos(bar);
  const def = MACHINE_DEFS[bar.type];
  const rot = bar.rotation || 0;
  const barW = (rot%2===0 ? def.w : def.h) * TILE;
  // Seat patrons evenly across the bar face width, max 5 visible seats
  const maxSeats  = 5;
  const seatSpacing = Math.min(barW / maxSeats, TILE * 0.85);
  const totalW    = (maxSeats - 1) * seatSpacing;
  const startX    = fp.wx - totalW / 2;
  // Offset along the facing direction instead of always horizontal
  const seatOff   = slot * seatSpacing;
  // For horizontal bar (rot 0 or 2) seats spread along X; for vertical spread along Y
  if (rot % 2 === 0) {
    p.targetX = startX + seatOff;
    p.targetY = fp.wy + (Math.random() * 4 - 2);  // tiny jitter so they're not pixel-perfect
  } else {
    p.targetX = fp.wx + (Math.random() * 4 - 2);
    p.targetY = fp.wy - totalW/2 + seatOff;
  }
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

// ── Patron AI thoughts ──────────────────────
const THOUGHTS={
  win:   ['Yesss! 🎉','I knew it!','Cha-ching! 💰','Lucky me!','Another round!','I\'m on fire! 🔥','This is my night!'],
  lose:  ['Ugh...','Just one more spin...','C\'mon...','I was so close!','That\'s ok...','Next one\'s mine.'],
  full:  ['All machines taken...','I\'ll wait a bit.','Hope one opens up!','Patience, patience.'],
  frustrated:['This is taking forever!','I\'m out of here! 😤','Worst casino ever.','No machines? Seriously?'],
  hungry:['I could eat something...','Is there food here? 🍔','Smells good in here!'],
  rich:  ['I\'m up big! 💎','Don\'t tell my wife...','Feeling lucky tonight!','I love this place!'],
  poor:  ['Almost out of money...','Maybe just one more?','Shoulda stopped earlier...'],
  jackpot:['JACKPOT!!! 🏆🎉','Oh my god!!!','I can\'t believe it!','Call the manager!!!'],
  enter: ['Let\'s win some money!','Feeling lucky today!','Ready to play!','Where do I start?'],
  eat:   ['That hit the spot 😋','Great service!','I\'ll be back for more.'],
  leave: ['Good run tonight!','See you next time!','I\'ll be back!','Time to head home.'],
  table: ['Deal me in!','I\'ve got a system...','Let\'s go poker! ♠','Blackjack baby!'],
  sports:['GO GO GO! 🏈','My team! My team!','I\'ll take that bet!','Easy money!'],
};

function pickThought(p, ctx) {
  let pool=THOUGHTS[ctx]||THOUGHTS.enter;
  // Contextual upgrades
  if(ctx==='lose'&&(p._mood||100)<30) pool=THOUGHTS.frustrated;
  if(ctx==='win'&&(p._wonTotal||0)>(p._spentTotal||1)*1.5) pool=THOUGHTS.rich;
  return pool[Math.floor(Math.random()*pool.length)];
}

function computePatronThought(p, forceThought=true) {
  const spent=p._spentTotal||0, won=p._wonTotal||0;
  const mood=p._mood!=null?p._mood:100;
  const moodEmoji=mood>75?'😊':mood>50?'😐':mood>25?'😟':'😤';
  const moodLabel=mood>75?'Happy':mood>50?'Neutral':mood>25?'Frustrated':'Angry';

  // Only pick a new thought when forced (state change / timer) — otherwise reuse cache
  let thought = p._thought;
  if(forceThought || !thought) {
    if(p.state==='ENTERING')                         thought=pickThought(p,'enter');
    else if(p.state==='PLAYING') {
      const m=G.machines.find(m=>m.id===p.machineId);
      if(m&&(MACHINE_DEFS[m.type]?.isSportsbook))    thought=pickThought(p,'sports');
      else if(m&&MACHINE_DEFS[m.type]?.isBand)       thought=pickThought(p,'enter');
      else thought=p._won ? pickThought(p,'win') : pickThought(p,'lose');
    }
    else if(p.state==='WAITING_MACHINE')              thought=pickThought(p,'full');
    else if(p.state==='LEAVING')                      thought=pickThought(p,'leave');
    else if(p.state==='WAITING_AT_BAR'||p.state==='EATING') thought=pickThought(p,'eat');
    else if(p.state==='IDLE_AT_TABLE')                thought=pickThought(p,'table');
    else if(p.state==='WAITING_JACKPOT')              thought=pickThought(p,'jackpot');
    else if(won>(spent*1.3)&&spent>0)                 thought=pickThought(p,'rich');
    else if(p.budget<3&&spent>0)                      thought=pickThought(p,'poor');
    else                                              thought=pickThought(p,'enter');
    p._thought=thought;
  }

  const favMach=p._favMachine?MACHINE_DEFS[p._favMachine]?.name||p._favMachine:'None yet';
  const netResult=won-spent;

  return {
    name:p.name, moodEmoji, moodLabel, mood,
    thought,
    spent:spent.toFixed(2),
    won:won.toFixed(2),
    net:(netResult>=0?'+':'')+netResult.toFixed(2),
    netColor:netResult>=0?'#7aba70':'#e07070',
    budget:p.budget.toFixed(2),
    favMach,
    state:p.state,
    visits:Object.entries(p._machineVisits||{}).map(([t,n])=>`${MACHINE_DEFS[t]?.name||t}: ${n}×`).join(', ')||'—',
  };
}

function kickOut(p) {
  p.state='LEAVING';
  const wp=tile2world(ENT_TX(),ENT_TY());
  p.targetX=wp.x+TILE/2; p.targetY=wp.y+TILE*2.5;

  // Cancel any pending food order for this patron
  G.foodOrders = G.foodOrders.filter(o => {
    if(o.patronId !== p.id) return true;
    // If player is currently carrying this order, drop it
    if(typeof playerCarrying !== 'undefined' && playerCarrying?.id === o.id) {
      playerCarrying = null;
      updatePlayerCarryUI();
      toast('Order cancelled — patron left','r');
    }
    return false;
  });

  // Free bar slot
  p._barSlot = null;
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
    case 'WALKING_TO_CASHIER':{
      p.state='WAITING_CASHIER';
      if(!G.cashierQueue.includes(p.id)) G.cashierQueue.push(p.id);
      // Position patron in their queue slot (line behind the counter)
      _positionInCashierQueue(p);
      updateCashierAlert();
      break;
    }
    case 'WALKING_TO_KIOSK':
      p.state='WAITING_KIOSK'; p._kioskTimer=2200; break;
    case 'WALKING_TO_BAR':
      p.state='WAITING_AT_BAR';
      createFoodOrder(p);
      break;
    case 'WALKING_TO_TABLE':
      p.state='IDLE_AT_TABLE';
      break;
    case 'LEAVING':
      // Patron has reached the exit — remove from world
      G.patrons = G.patrons.filter(x => x.id !== p.id);
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

// ── Time-of-day + day-of-week spawn multiplier ────────────────────────────
// Day maps 0→1 as 6 PM → 6 AM (12-hour casino night)
// Peaks around midnight (pct ≈ 0.5)
function getSpawnMultiplier() {
  const pct = Math.min(1, (G.dayAcc||0) / G.dayLen);

  // Time-of-day curve: quiet open → ramp → peak → late-night taper
  // pct 0   = 6 PM  (opening, trickling in)
  // pct 0.2 = 8 PM  (picking up)
  // pct 0.5 = midnight (peak)
  // pct 0.75= 3 AM  (winding down)
  // pct 1.0 = 6 AM  (almost empty)
  let timeMult;
  if      (pct < 0.15) timeMult = 0.4 + pct/0.15 * 0.5;   // 6–8 PM: 0.4→0.9
  else if (pct < 0.45) timeMult = 0.9 + (pct-0.15)/0.30 * 0.6; // 8 PM–midnight: 0.9→1.5
  else if (pct < 0.60) timeMult = 1.5;                     // midnight–1 AM: peak
  else if (pct < 0.80) timeMult = 1.5 - (pct-0.60)/0.20 * 0.7; // 1–3 AM: 1.5→0.8
  else                 timeMult = 0.8 - (pct-0.80)/0.20 * 0.6; // 3–6 AM: 0.8→0.2

  // Day-of-week multiplier
  const dow = G.dayOfWeek ?? 0; // 0=Mon … 6=Sun
  const DAY_MULT = [0.7, 0.75, 0.85, 0.95, 1.2, 1.6, 1.4]; // Mon–Sun
  const dayMult = DAY_MULT[dow % 7];

  return timeMult * dayMult;
}
