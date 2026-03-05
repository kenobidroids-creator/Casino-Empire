// ═══════════════════════════════════════════
//  tables.js — Live table games + band + sportsbook
// ═══════════════════════════════════════════

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_VALS = {A:11,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10};

function newDeck() {
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({r,s,v:CARD_VALS[r]});
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function handValue(cards) {
  let v=cards.reduce((s,c)=>s+c.v,0), aces=cards.filter(c=>c.r==='A').length;
  while(v>21&&aces-->0) v-=10;
  return v;
}
function dealCard(deck){return deck.length?deck.pop():{r:'?',s:'?',v:0};}

const ROULETTE_NUMS=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const TABLE_STATES={};

function initTableState(m) {
  const def=MACHINE_DEFS[m.type];
  const base={
    type:def.tableGame, seats:def.seats||4,
    players:[], phase:'betting', timer:4000, deck:newDeck(),
  };
  if(def.tableGame==='roulette')  { base.ballAngle=0; base.ballSpeed=0; base.wheelAngle=0; base.winNum=null; }
  if(def.tableGame==='blackjack') { base.dealerCards=[]; base.dealerRevealed=false; }
  if(def.tableGame==='poker')     { base.communityCards=[]; }
  TABLE_STATES[m.id]=base;
}

// ── Compute fixed seat positions around a table ───────────────────────────
function getTableSeatPositions(m, count) {
  const def=MACHINE_DEFS[m.type];
  const wp=tile2world(m.tx,m.ty);
  const tw=def.w*TILE, th=def.h*TILE;
  const cx=wp.x+tw/2, cy=wp.y+th/2;
  const seats=[];
  for(let i=0;i<count;i++){
    const a=(i/count)*Math.PI*2 - Math.PI/2;
    // Sit outside the table footprint
    const rx=(tw/2)+TILE*.55, ry=(th/2)+TILE*.45;
    seats.push({ wx:cx+Math.cos(a)*rx, wy:cy+Math.sin(a)*ry });
  }
  return seats;
}

// ── Route a patron to a specific seat number at a table ──────────────────
function routePatronToTableSeat(p, m, seatIdx) {
  const seats=getTableSeatPositions(m, MACHINE_DEFS[m.type].seats||4);
  const seat=seats[seatIdx % seats.length];
  p.state='WALKING_TO_TABLE';
  p.tableId=m.id;
  p.tableSeat=seatIdx;
  p.targetX=seat.wx;
  p.targetY=seat.wy;
}

// ── Update table game ─────────────────────────────────────────────────────
function updateTableGame(m, dt) {
  let ts=TABLE_STATES[m.id];
  if(!ts) { initTableState(m); ts=TABLE_STATES[m.id]; }
  if(!ts) return;

  // Pull in idle patrons waiting at this table into seats
  if(ts.players.length < ts.seats && ts.phase==='betting') {
    const waiting=G.patrons.filter(p=>p.state==='IDLE_AT_TABLE' && p.tableId===m.id);
    for(const p of waiting) {
      if(ts.players.find(pl=>pl.patronId===p.id)) continue;
      const bet=parseFloat((3+Math.random()*12).toFixed(2));
      if(p.budget < bet) { kickOut(p); continue; }
      const seatIdx=ts.players.length;
      ts.players.push({patronId:p.id, bet, cards:[], state:'seated', result:null});
      p.budget-=bet;
      G.money+=bet; G.totalEarned+=bet;
      G.dayStats.moneyIn+=bet;
      m.totalEarned=(m.totalEarned||0)+bet;
      trackRev(bet);
      spawnFloat(p.wx,p.wy-18,'BET $'+bet.toFixed(2),'#d0c060');
      // Snap patron to their assigned seat position
      const seats=getTableSeatPositions(m, ts.seats);
      const seat=seats[seatIdx % seats.length];
      p.wx=seat.wx; p.wy=seat.wy;
      p.tableSeat=seatIdx;
    }
  }

  ts.timer-=dt;

  // Roulette wheel spins independent of timer
  if(ts.type==='roulette' && ts.phase==='spinning') {
    ts.wheelAngle+=3*dt/1000;
    ts.ballAngle+=ts.ballSpeed*dt/1000;
    ts.ballSpeed=Math.max(0, ts.ballSpeed-4*dt/1000);
  }

  if(ts.timer>0) return;

  if(ts.type==='blackjack')     tickBlackjack(m,ts);
  else if(ts.type==='roulette') tickRoulette(m,ts);
  else if(ts.type==='poker')    tickPoker(m,ts);
}

function dismissTablePatrons(ts) {
  for(const pl of ts.players) {
    const p=G.patrons.find(p=>p.id===pl.patronId);
    if(p) kickOut(p);
  }
  ts.players=[];
}

function tickBlackjack(m, ts) {
  if(ts.phase==='betting') {
    if(!ts.players.length) { ts.timer=3000; return; }
    ts.deck=newDeck();
    ts.dealerCards=[dealCard(ts.deck),dealCard(ts.deck)];
    ts.dealerRevealed=false;
    for(const pl of ts.players) {
      pl.cards=[dealCard(ts.deck),dealCard(ts.deck)];
      pl.state='playing';
      while(handValue(pl.cards)<17) pl.cards.push(dealCard(ts.deck));
    }
    ts.phase='resolving'; ts.timer=2500;
  } else if(ts.phase==='resolving') {
    ts.dealerRevealed=true;
    while(handValue(ts.dealerCards)<17) ts.dealerCards.push(dealCard(ts.deck));
    const dv=handValue(ts.dealerCards);
    for(const pl of ts.players) {
      const pv=handValue(pl.cards);
      const p=G.patrons.find(p=>p.id===pl.patronId);
      if(pv>21)             { pl.result='bust'; }
      else if(dv>21||pv>dv) { pl.result='win';  G.money-=pl.bet*2; G.dayStats.moneyOut+=pl.bet*2; if(p)spawnFloat(p.wx,p.wy-18,'WIN $'+(pl.bet*2).toFixed(2),'#f0d060'); }
      else if(pv===dv)      { pl.result='push'; G.money-=pl.bet;   G.dayStats.moneyOut+=pl.bet; }
      else                  { pl.result='lose'; }
    }
    ts.phase='paying'; ts.timer=2000;
  } else if(ts.phase==='paying') {
    dismissTablePatrons(ts);
    ts.phase='betting'; ts.timer=4000;
  }
}

function tickRoulette(m, ts) {
  if(ts.phase==='betting') {
    if(!ts.players.length) { ts.timer=3000; return; }
    ts.winNum=ROULETTE_NUMS[Math.floor(Math.random()*ROULETTE_NUMS.length)];
    ts.ballSpeed=18; ts.phase='spinning'; ts.timer=3500;
  } else if(ts.phase==='spinning') {
    // timer expired – resolve
    const isRed=RED_NUMS.has(ts.winNum);
    for(const pl of ts.players) {
      const win=ts.winNum!==0 && Math.random()<0.486;
      if(win) { G.money-=pl.bet*2; G.dayStats.moneyOut+=pl.bet*2; }
      const p=G.patrons.find(p=>p.id===pl.patronId);
      if(p&&win) spawnFloat(p.wx,p.wy-18,'WIN $'+(pl.bet*2).toFixed(2),'#f0d060');
    }
    toast(ts.winNum+(isRed?' 🔴':ts.winNum===0?' 🟢':' ⚫'));
    ts.phase='result'; ts.timer=2000;
  } else if(ts.phase==='result') {
    dismissTablePatrons(ts);
    ts.phase='betting'; ts.timer=3000; ts.ballSpeed=0;
  }
}

function tickPoker(m, ts) {
  if(ts.phase==='betting') {
    if(!ts.players.length) { ts.timer=3000; return; }
    ts.deck=newDeck();
    for(const pl of ts.players) pl.cards=[dealCard(ts.deck),dealCard(ts.deck)];
    ts.communityCards=[dealCard(ts.deck),dealCard(ts.deck),dealCard(ts.deck),dealCard(ts.deck),dealCard(ts.deck)];
    ts.phase='resolving'; ts.timer=3500;
  } else if(ts.phase==='resolving') {
    for(const pl of ts.players) {
      const win=Math.random()<0.44;
      if(win) { G.money-=pl.bet*1.9; G.dayStats.moneyOut+=pl.bet*1.9; }
      const p=G.patrons.find(p=>p.id===pl.patronId);
      if(p&&win) spawnFloat(p.wx,p.wy-18,'WIN $'+(pl.bet*1.9).toFixed(2),'#f0d060');
    }
    ts.phase='paying'; ts.timer=2000;
  } else if(ts.phase==='paying') {
    dismissTablePatrons(ts);
    ts.phase='betting'; ts.timer=4000;
  }
}

// ── Band ──────────────────────────────────────────────────────────────────
function updateBand(m, dt) {
  if(!m._bandTick) m._bandTick=0;
  m._bandTick=(m._bandTick+dt)%800;
  const wp=tile2world(m.tx,m.ty);
  const cx=wp.x+MACHINE_DEFS[m.type].w*TILE/2;
  const cy=wp.y+MACHINE_DEFS[m.type].h*TILE/2;
  for(const p of G.patrons) {
    if(Math.hypot(p.wx-cx,p.wy-cy)<TILE*4 && p.state==='LEAVING')
      p.speed=Math.max(15,p.speed-0.5);
  }
}

// ── Sportsbook ────────────────────────────────────────────────────────────
function updateSportsbook(m, dt) {
  // Count nearby patrons for sprite display
  const wp=tile2world(m.tx,m.ty);
  m._nearPatrons=G.patrons.filter(p=>Math.hypot(p.wx-wp.x,p.wy-wp.y)<TILE*5).length;

  if(!m._sportTimer) m._sportTimer=15000+Math.random()*10000;
  m._sportTimer-=dt;
  if(m._sportTimer>0) return;
  m._sportTimer=20000+Math.random()*15000;
  const betAmount=parseFloat((3+Math.random()*12).toFixed(2));
  const near=G.patrons.filter(p=>
    Math.hypot(p.wx-wp.x,p.wy-wp.y)<TILE*5 && p.budget>=betAmount &&
    (p.state==='IDLE_AT_TABLE'||p.state==='PLAYING'||p.state==='ENTERING')
  );
  for(const p of near.slice(0,4)) {
    p.budget-=betAmount;
    G.money+=betAmount; G.totalEarned+=betAmount;
    G.dayStats.moneyIn+=betAmount;
    m.totalEarned=(m.totalEarned||0)+betAmount;
    trackRev(betAmount);
    if(Math.random()<0.42) {
      const payout=betAmount*2;
      G.money-=payout; G.dayStats.moneyOut+=payout;
      spawnFloat(p.wx,p.wy-18,'SPORTS +$'+payout.toFixed(2),'#60d0ff');
    }
  }
  m._lastEvent=SPORT_EVENTS[Math.floor(Math.random()*SPORT_EVENTS.length)];
  toast(m._lastEvent||'Sports result in!');
}

const SPORT_EVENTS=[
  'Home team wins! 🏈','Upset! Away scores 🏀','Overtime thriller ⚽',
  'Final: 3-2 🏒','Photo finish! 🏇','Buzzer beater! 🏀','Hat trick! ⚽'
];

// ── Master update ─────────────────────────────────────────────────────────
function updateSpecialMachines(dt) {
  for(const m of G.machines) {
    const def=MACHINE_DEFS[m.type];
    if(def.tableGame)    updateTableGame(m,dt);
    if(def.isBand)       updateBand(m,dt);
    if(def.isSportsbook) updateSportsbook(m,dt);
  }
}

// ── Self-arriving Lost & Found patrons ────────────────────────────────────
// Called from game loop; once per ~30s chance per contact
function maybeSpawnLFWalkin() {
  // Only spawn if security desk placed
  const sec=G.machines.find(m=>m.type==='security');
  if(!sec) return;
  // Only uncalled contacts
  const uncalled=G.lostAndFoundContacts.filter(c=>c.status==='uncalled');
  if(!uncalled.length) return;
  // Don't spawn if one is already walking in / waiting
  if(G.lostAndFoundVisitors.length>0) return;
  // ~1% chance per call = roughly every 100 ticks @ 60fps × speed
  if(Math.random()>0.004) return;
  // Pick a random uncalled contact
  const c=uncalled[Math.floor(Math.random()*uncalled.length)];
  c.status='self_arrived'; // mark so we know they came on their own
  callPatron(c.id);
  toast(c.name+' came in asking about their lost money!','g');
}
