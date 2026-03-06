// ═══════════════════════════════════════════
//  employees.js — Employee hire & AI
// ═══════════════════════════════════════════

function hireEmployee(type) {
  const def=EMPLOYEE_DEFS[type];
  if(G.money<def.cost){toast('Need $'+def.cost+' to hire '+def.name,'r');return;}
  G.money-=def.cost;
  const wp=tile2world(ENT_TX(),ENT_TY());
  const names=['Sam','Pat','Alex','Morgan','Jordan','Taylor','Casey','Robin'];
  const e = {
    id:G.nextEid++,
    type, name:names[Math.floor(Math.random()*names.length)]+'('+def.name[0]+')',
    wx:wp.x+TILE/2, wy:wp.y+TILE/2+TILE*.5,
    state:'IDLE', speed:60,
    targetX:wp.x+TILE/2, targetY:wp.y+TILE/2,
    task:null, carryingOrder:null, taskId:null,
  };
  G.employees.push(e);
  toast('Hired '+def.name+'!','g');
  // Immediately walk to their post
  walkToPost(e);
}

// ── Walk to natural post position ──────────
function getPostPosition(e) {
  if(e.type==='cashier_staff') {
    const m=G.machines.find(m=>m.type==='cashier');
    if(m) { const bp=getMachineBackPos(m); return { x:bp.wx, y:bp.wy }; }
  }
  if(e.type==='food_server') {
    const m=G.machines.find(m=>m.type==='bar');
    if(m) { const bp=getMachineBackPos(m); return { x:bp.wx, y:bp.wy }; }
  }
  if(e.type==='slot_attendant') {
    const wp=tile2world(Math.floor(G.floorW/2), Math.floor(G.floorH/2));
    return { x: wp.x+TILE/2, y: wp.y+TILE/2 };
  }
  if(e.type==='dealer') {
    const m=G.machines.find(m=>MACHINE_DEFS[m.type]?.tableGame);
    if(m) { const bp=getMachineBackPos(m); return { x:bp.wx, y:bp.wy }; }
  }
  const wp=tile2world(ENT_TX(), ENT_TY());
  return { x: wp.x+TILE/2, y: wp.y-TILE };
}

function walkToPost(e) {
  const pos = getPostPosition(e);
  const dist = Math.hypot(pos.x - e.wx, pos.y - e.wy);
  if(dist < 8) return; // already there
  e.targetX = pos.x;
  e.targetY = pos.y;
  e.state = 'WALKING_TO_POST';
  e.task = null;
}



function fireEmployee(eid) {
  G.employees=G.employees.filter(e=>e.id!==eid);
  toast('Employee dismissed');
}

// ── Per-frame employee AI ──────────────────
function updateEmployee(e,dt) {
  switch(e.state) {
    case 'IDLE':
      // Try to find work; if none, walk to post
      if(!findTask(e)) walkToPost(e);
      break;
    case 'WALKING':
    case 'WALKING_TO_POST':
      moveEmployee(e,dt); break;
    case 'WORKING':      doWork(e,dt); break;
    case 'CARRYING':     moveEmployee(e,dt); break;
    case 'DELIVERING':   moveEmployee(e,dt); break;
  }
}

function findTask(e) {
  if(e.type==='cashier_staff') {
    if(G.cashierQueue.length===0) return false;
    const cashier=G.machines.find(m=>m.type==='cashier');
    if(!cashier) return false;
    if(G.cashierServing) return false;
    e.task='cashier';
    const fp=getMachineFrontPos(cashier);
    e.targetX=fp.wx; e.targetY=fp.wy;
    e.state='WALKING';
    return true;
  }

  if(e.type==='slot_attendant') {
    if(G.jackpots.length===0) return false;
    const j=G.jackpots[0];
    const m=G.machines.find(m=>m.id===j.machineId);
    if(!m) return false;
    e.task='jackpot'; e.taskId=j.id;
    const fp=getMachineFrontPos(m);
    e.targetX=fp.wx; e.targetY=fp.wy;
    e.state='WALKING';
    return true;
  }

  if(e.type==='food_server') {
    // Take a waiting order
    const order=G.foodOrders.find(o=>o.state==='waiting_take'&&!o.serverId);
    if(order) {
      order.serverId=e.id;
      e.task='food'; e.taskId=order.id;
      const bar=G.machines.find(m=>m.id===order.barId);
      if(!bar){order.serverId=null;e.task=null;return false;}
      const fp=getMachineFrontPos(bar);
      e.targetX=fp.wx; e.targetY=fp.wy;
      e.state='WALKING';
      return true;
    }
    // Deliver a ready order
    const ready=G.foodOrders.find(o=>o.state==='ready'&&(!o.deliverId||o.deliverId===e.id));
    if(ready) {
      ready.deliverId=e.id;
      e.task='deliver'; e.taskId=ready.id;
      const bar=G.machines.find(m=>m.id===ready.barId);
      if(!bar) return false;
      const fp=getMachineFrontPos(bar);
      e.targetX=fp.wx; e.targetY=fp.wy;
      e.state='WALKING';
      return true;
    }
    // Clean dirty items
    if(G.dirtyItems.length>0) {
      const d=G.dirtyItems[0];
      e.task='clean'; e.taskId=d.id;
      e.targetX=d.wx; e.targetY=d.wy;
      e.state='WALKING';
      return true;
    }
    return false;
  }

  return false;
}

function doWork(e,dt) {
  if(e.type==='cashier_staff') {
    if(G.cashierQueue.length===0){e.state='IDLE';e.task=null;return;}
    const pid=G.cashierQueue[0];
    const patron=G.patrons.find(p=>p.id===pid);
    if(!patron){G.cashierQueue.shift();e.state='IDLE';e.task=null;return;}
    // Process from post — no walking to patron
    const delay = 1400 / Math.max(1, G.speed);
    setTimeout(()=>{
      const p2=G.patrons.find(p=>p.id===pid);
      if(!p2){G.cashierQueue.shift();updateCashierAlert();return;}
      G.money -= p2.ticketValue;
      spawnFloat(p2.wx, p2.wy-20, 'Paid $'+p2.ticketValue.toFixed(2), '#7aca70');
      p2.state='PAID';
      G.cashierQueue.shift();
      _refreshCashierQueuePositions();
      updateCashierAlert();
    }, delay);
    e.state='IDLE'; e.task=null;
  }

  else if(e.type==='slot_attendant') {
    const j=G.jackpots.find(j=>j.id===e.taskId);
    if(!j){e.state='IDLE';e.task=null;return;}
    setTimeout(()=>{ resolveJackpot(j); }, 2000/Math.max(1,G.speed));
    e.state='IDLE'; e.task=null;
  }

  else if(e.type==='food_server'&&e.task==='food') {
    const order=G.foodOrders.find(o=>o.id===e.taskId);
    if(!order){e.state='IDLE';e.task=null;return;}
    if(order.state==='waiting_take') { order.state='cooking'; order.progress=0; }
    e.state='IDLE'; e.task=null;
  }

  else if(e.type==='food_server'&&e.task==='deliver') {
    const order=G.foodOrders.find(o=>o.id===e.taskId);
    if(!order||order.state!=='ready'){e.state='IDLE';e.task=null;return;}
    const patron=G.patrons.find(p=>p.id===order.patronId);
    if(!patron){cleanupOrder(order);e.state='IDLE';e.task=null;return;}
    // Bar patrons: deliver from behind counter instantly
    // Table patrons: walk to them
    const atBar = patron.state==='WAITING_AT_BAR'||patron.state==='EATING'||patron._barId!=null;
    if(atBar) {
      order.state='delivering';
      e.carryingOrder=order;
      setTimeout(()=>{ employeeDeliversOrder(order); e.carryingOrder=null; e.state='IDLE'; e.task=null; }, 700/Math.max(1,G.speed));
      e.state='IDLE'; e.task=null;
    } else {
      e.carryingOrder=order;
      order.state='delivering';
      e.targetX=patron.wx; e.targetY=patron.wy-8;
      e.state='DELIVERING';
    }
  }

  else if(e.type==='food_server'&&e.task==='clean') {
    const d=G.dirtyItems.find(d=>d.id===e.taskId);
    if(!d){e.state='IDLE';e.task=null;return;}
    G.dirtyItems=G.dirtyItems.filter(x=>x.id!==d.id);
    toast('🍽 Cleaned up','');
    e.state='IDLE'; e.task=null;
  }
}

function moveEmployee(e,dt) {
  const dx=e.targetX-e.wx, dy=e.targetY-e.wy;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const step=e.speed*dt/1000;
  if(dist<=step+.5) {
    e.wx=e.targetX; e.wy=e.targetY;
    onEmployeeArrival(e);
  } else {
    e.wx+=dx/dist*step; e.wy+=dy/dist*step;
  }
}

function onEmployeeArrival(e) {
  switch(e.state) {
    case 'WALKING':        e.state='WORKING'; break;
    case 'WALKING_TO_POST': e.state='IDLE'; break;  // reached post, now watch for work
    case 'DELIVERING':     deliverFood(e); break;
  }
}

function deliverFood(e) {
  const order = e.carryingOrder;
  if(!order) { e.state='IDLE'; e.task=null; return; }
  employeeDeliversOrder(order);
  e.carryingOrder = null;
  e.state = 'IDLE'; e.task = null;
}

function resolveJackpot(j) {
  G.money-=j.amount;
  G.dayStats.jackpotsPaid=(G.dayStats.jackpotsPaid||0)+j.amount;
  G.dayStats.moneyOut=(G.dayStats.moneyOut||0)+j.amount;
  G.jackpots=G.jackpots.filter(x=>x.id!==j.id);
  const patron=G.patrons.find(p=>p.id===j.patronId);
  if(patron) {
    patron.ticketValue=0;
    spawnFloat(patron.wx,patron.wy-20,'🏆 PAID $'+j.amount.toFixed(2),'#f0d060');
    afterPayment(patron);
  }
  toast('Jackpot paid: $'+j.amount.toFixed(2),'g');
}

function cleanupOrder(order) {
  G.foodOrders=G.foodOrders.filter(o=>o.id!==order.id);
}
