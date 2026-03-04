// ═══════════════════════════════════════════
//  food.js — Food ordering, cooking, delivery
// ═══════════════════════════════════════════

// Player is carrying this order (for manual delivery)
let playerCarrying = null;

// ── Tick food orders (cooking progress) ────
function updateFoodOrders(dt) {
  for(const order of G.foodOrders) {
    if(order.state==='cooking') {
      const def=FOOD_MENU.find(f=>f.id===order.item);
      if(!def) continue;
      order.progress=(order.progress||0)+dt;
      if(order.progress>=def.prepTime) {
        order.state='ready';
        toast((FOOD_MENU.find(f=>f.id===order.item)?.icon||'🍽')+' Order ready!');
      }
    }
  }

  // Jackpot timers
  for(const j of [...G.jackpots]) {
    j.timer-=dt; // raw dt (not speed scaled for this)
    if(j.timer<=0) {
      // Auto-resolve but penalise player less (patron walks away angry)
      G.money-=j.amount*.5;
      G.jackpots=G.jackpots.filter(x=>x.id!==j.id);
      const p=G.patrons.find(p=>p.id===j.patronId);
      if(p){spawnFloat(p.wx,p.wy-20,'😠 Left angry!','#e07070');kickOut(p);}
      toast('Jackpot timed out — patron left angry!','r');
    }
  }
}

// ── Player clicks bar counter ──────────────
function handleBarClick(machineId) {
  const bar=G.machines.find(m=>m.id===machineId);
  if(!bar) return;

  // If player is carrying, they can only deliver — handled in canvas click
  if(playerCarrying) return;

  // Check for order waiting to be taken by player
  const waitingOrder=G.foodOrders.find(o=>o.barId===machineId&&o.state==='waiting_take'&&!o.serverId);
  if(waitingOrder) {
    waitingOrder.state='cooking';
    waitingOrder.progress=0;
    const fi=FOOD_MENU.find(f=>f.id===waitingOrder.item);
    toast('Making '+fi?.icon+' '+fi?.name+'…');
    return;
  }

  // Check for ready order to pick up
  const readyOrder=G.foodOrders.find(o=>o.barId===machineId&&o.state==='ready'&&!o.deliverId);
  if(readyOrder) {
    playerCarrying=readyOrder;
    readyOrder.state='delivering';
    readyOrder.deliverId='player';
    const fi=FOOD_MENU.find(f=>f.id===readyOrder.item);
    toast('Picked up '+fi?.icon+' — click the patron to deliver!','g');
    updatePlayerCarryUI();
    return;
  }
}

// ── Player clicks patron to deliver ────────
function handlePatronDelivery(patronId) {
  if(!playerCarrying) return;
  const order=playerCarrying;
  if(order.patronId!==patronId) {
    toast('Wrong patron!','r'); return;
  }
  const patron=G.patrons.find(p=>p.id===patronId);
  if(patron) {
    patron.state='EATING';
    patron.eatTimer=4000;
    const fi=FOOD_MENU.find(f=>f.id===order.item);
    spawnFloat(patron.wx,patron.wy-20,fi?.icon+' Enjoy! +$'+order.tip.toFixed(2),'#f0d060');
    G.money+=order.tip; trackRev(order.tip);
  }
  cleanupOrder(order);
  playerCarrying=null;
  updatePlayerCarryUI();
}

// ── Player clicks dirty dish ───────────────
function handleDirtyClick(dirtyId) {
  G.dirtyItems=G.dirtyItems.filter(d=>d.id!==dirtyId);
  toast('🧹 Cleaned up!','g');
}

// ── Player picks up tip ────────────────────
function collectTip(tipId) {
  const t=G.tips.find(t=>t.id===tipId);
  if(!t) return;
  G.money+=t.amount; trackRev(t.amount);
  spawnFloat(t.wx,t.wy,'+$'+t.amount.toFixed(2)+' tip','#f0d060');
  G.tips=G.tips.filter(x=>x.id!==tipId);
}

function updatePlayerCarryUI() {
  const bar=document.getElementById('carry-bar');
  if(!bar) return;
  if(playerCarrying) {
    const fi=FOOD_MENU.find(f=>f.id===playerCarrying.item);
    bar.style.display='block';
    bar.textContent=fi?.icon+' Carrying: '+fi?.name+' — Click patron to deliver';
  } else {
    bar.style.display='none';
  }
}

// ── Player handles jackpot ─────────────────
function handleJackpotClick(machineId) {
  const j=G.jackpots.find(j=>j.machineId===machineId);
  if(!j) return;
  openJackpotPanel(j);
}

function openJackpotPanel(j) {
  document.getElementById('jp-amount').textContent='$'+j.amount.toFixed(2);
  document.getElementById('jp-panel').style.display='block';
  document.getElementById('jp-panel').dataset.jid=j.id;
}

function confirmJackpay() {
  const panel=document.getElementById('jp-panel');
  const jid=parseInt(panel.dataset.jid);
  const j=G.jackpots.find(j=>j.id===jid);
  if(!j) return;
  resolveJackpot(j);
  panel.style.display='none';
}

// ── Dropped money interact ─────────────────
function openDroppedMoneyMenu(dropId) {
  const d=G.droppedMoney.find(d=>d.id===dropId);
  if(!d) return;
  document.getElementById('dm-amount').textContent='$'+d.amount.toFixed(2);
  document.getElementById('dm-panel').style.display='block';
  document.getElementById('dm-panel').dataset.did=dropId;
}

function collectDropped(choice) {
  const panel=document.getElementById('dm-panel');
  const did=parseInt(panel.dataset.did);
  const d=G.droppedMoney.find(d=>d.id===did);
  if(!d) {panel.style.display='none';return;}

  if(choice==='keep') {
    G.money+=d.amount; trackRev(d.amount*.5);
    toast('Pocketed $'+d.amount.toFixed(2)+'  😈','g');
  } else if(choice==='lostandfound') {
    // Give back = reputation bonus (not modelled yet, just display)
    toast('📦 Added $'+d.amount.toFixed(2)+' to lost & found!','');
  } else {
    toast('❤️ Donated $'+d.amount.toFixed(2)+' to charity!','');
  }
  G.droppedMoney=G.droppedMoney.filter(x=>x.id!==did);
  panel.style.display='none';
}
