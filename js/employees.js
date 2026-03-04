// ═══════════════════════════════════════════
//  employees.js — Employee hire & AI
// ═══════════════════════════════════════════

function hireEmployee(type) {
  const def=EMPLOYEE_DEFS[type];
  if(G.money<def.cost){toast('Need $'+def.cost+' to hire '+def.name,'r');return;}
  G.money-=def.cost;
  const wp=tile2world(ENT_TX,ENT_TY);
  const names=['Sam','Pat','Alex','Morgan','Jordan','Taylor','Casey','Robin'];
  G.employees.push({
    id:G.nextEid++,
    type, name:names[Math.floor(Math.random()*names.length)]+'('+def.name[0]+')',
    wx:wp.x+TILE/2, wy:wp.y+TILE/2+TILE*.5,
    state:'IDLE', speed:60,
    targetX:wp.x+TILE/2, targetY:wp.y+TILE/2,
    task:null,
    carryingOrder:null,
    taskId:null,
  });
  toast('Hired '+def.name+'!','g');
}

function fireEmployee(eid) {
  G.employees=G.employees.filter(e=>e.id!==eid);
  toast('Employee dismissed');
}

// ── Per-frame employee AI ──────────────────
function updateEmployee(e,dt) {
  switch(e.state) {
    case 'IDLE':         findTask(e); break;
    case 'WALKING':      moveEmployee(e,dt); break;
    case 'WORKING':      doWork(e,dt); break;
    case 'CARRYING':     moveEmployee(e,dt); break;
    case 'DELIVERING':   moveEmployee(e,dt); break;
  }
}

function findTask(e) {
  const def=EMPLOYEE_DEFS[e.type];

  if(e.type==='cashier_staff') {
    if(G.cashierQueue.length===0) return;
    const cashier=G.machines.find(m=>m.type==='cashier');
    if(!cashier) return;
    // Only if no player is serving
    if(G.cashierServing) return;
    e.task='cashier';
    const wp=tile2world(cashier.tx,cashier.ty);
    e.targetX=wp.x+MACHINE_DEFS.cashier.w*TILE/2;
    e.targetY=wp.y+TILE*.5;
    e.state='WALKING';
  }

  else if(e.type==='slot_attendant') {
    if(G.jackpots.length===0) return;
    const j=G.jackpots[0];
    const m=G.machines.find(m=>m.id===j.machineId);
    if(!m) return;
    e.task='jackpot'; e.taskId=j.id;
    const wp=tile2world(m.tx,m.ty);
    e.targetX=wp.x+TILE/2; e.targetY=wp.y+TILE*.5;
    e.state='WALKING';
  }

  else if(e.type==='food_server') {
    // Look for order to take
    const order=G.foodOrders.find(o=>o.state==='waiting_take'&&!o.serverId);
    if(order) {
      order.serverId=e.id;
      e.task='food'; e.taskId=order.id;
      const bar=G.machines.find(m=>m.id===order.barId);
      if(!bar){order.serverId=null;e.task=null;return;}
      const wp=tile2world(bar.tx,bar.ty);
      e.targetX=wp.x+MACHINE_DEFS.bar.w*TILE/2;
      e.targetY=wp.y+TILE*.5;
      e.state='WALKING';
      return;
    }
    // Look for ready order to deliver
    const ready=G.foodOrders.find(o=>o.state==='ready'&&(!o.deliverId||o.deliverId===e.id));
    if(ready) {
      ready.deliverId=e.id;
      e.task='deliver'; e.taskId=ready.id;
      const bar=G.machines.find(m=>m.id===ready.barId);
      if(!bar) return;
      const wp=tile2world(bar.tx,bar.ty);
      e.targetX=wp.x+MACHINE_DEFS.bar.w*TILE/2;
      e.targetY=wp.y+TILE*.5;
      e.state='WALKING';
      return;
    }
    // Clean up dirty items
    if(G.dirtyItems.length>0) {
      const d=G.dirtyItems[0];
      e.task='clean'; e.taskId=d.id;
      e.targetX=d.wx; e.targetY=d.wy;
      e.state='WALKING';
    }
  }
}

function doWork(e,dt) {
  if(e.type==='cashier_staff') {
    if(G.cashierQueue.length===0){e.state='IDLE';e.task=null;return;}
    // Auto-pay first in queue
    const pid=G.cashierQueue[0];
    const patron=G.patrons.find(p=>p.id===pid);
    if(!patron){G.cashierQueue.shift();e.state='IDLE';e.task=null;return;}
    setTimeout(()=>{
      G.money-=patron.ticketValue;
      spawnFloat(patron.wx,patron.wy-20,'Paid $'+patron.ticketValue.toFixed(2),'#7aca70');
      patron.state='PAID';
      G.cashierQueue.shift();
      updateCashierAlert();
      e.state='IDLE'; e.task=null;
    }, 1500/G.speed);
    e.state='IDLE'; // prevent repeat
  }

  else if(e.type==='slot_attendant') {
    const j=G.jackpots.find(j=>j.id===e.taskId);
    if(!j){e.state='IDLE';e.task=null;return;}
    setTimeout(()=>{
      resolveJackpot(j);
      e.state='IDLE'; e.task=null;
    },2000/G.speed);
    e.state='IDLE';
  }

  else if(e.type==='food_server'&&e.task==='food') {
    const order=G.foodOrders.find(o=>o.id===e.taskId);
    if(!order){e.state='IDLE';e.task=null;return;}
    // Start cooking
    if(order.state==='waiting_take') {
      order.state='cooking';
      order.progress=0;
    }
    e.state='IDLE'; // cooking is handled in food.js tick
  }

  else if(e.type==='food_server'&&e.task==='deliver') {
    const order=G.foodOrders.find(o=>o.id===e.taskId);
    if(!order||order.state!=='ready'){e.state='IDLE';e.task=null;return;}
    e.carryingOrder=order;
    order.state='delivering';
    // Walk to patron
    const patron=G.patrons.find(p=>p.id===order.patronId);
    if(!patron){cleanupOrder(order);e.state='IDLE';e.task=null;return;}
    e.targetX=patron.wx; e.targetY=patron.wy-8;
    e.state='DELIVERING';
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
    case 'WALKING':   e.state='WORKING'; break;
    case 'DELIVERING':
      deliverFood(e);
      break;
  }
}

function deliverFood(e) {
  const order=e.carryingOrder;
  if(!order){e.state='IDLE';e.task=null;return;}
  const patron=G.patrons.find(p=>p.id===order.patronId);
  if(patron) {
    patron.state='EATING';
    patron.eatTimer=4000;
    const fi=FOOD_MENU.find(f=>f.id===order.item);
    spawnFloat(patron.wx,patron.wy-20,fi?.icon+' Enjoy!','#f0d060');
  }
  cleanupOrder(order);
  e.carryingOrder=null;
  e.state='IDLE'; e.task=null;
}

function resolveJackpot(j) {
  G.money-=j.amount;
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
