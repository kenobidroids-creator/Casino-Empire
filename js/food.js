// ═══════════════════════════════════════════
//  food.js — Food ordering, cooking, delivery
// ═══════════════════════════════════════════

let _barPanelMid   = null;   // which bar is open
let _barPanelTimer = null;   // auto-refresh interval
let _highlightPid  = null;   // patron being highlighted for delivery

// ── Tick food orders (cooking progress) ────
function updateFoodOrders(dt) {
  for(const order of G.foodOrders) {
    if(order.state === 'cooking') {
      const def = FOOD_MENU.find(f => f.id === order.item);
      if(!def) continue;
      order.progress = (order.progress||0) + dt;
      if(order.progress >= def.prepTime) {
        order.state = 'ready';
        const fi = FOOD_MENU.find(f=>f.id===order.item);
        if(_barPanelMid === order.barId) renderBarOrders(); // update panel live
        // Notif only if panel isn't open
        if(_barPanelMid !== order.barId) {
          const p = G.patrons.find(p=>p.id===order.patronId);
          persistNotif('bar-ready-'+order.id,
            (fi?.icon||'🍽')+' '+fi?.name+' ready for '+( p?.name||'patron'), 'g',
            () => openBarPanel(order.barId)
          );
        }
      }
    }
  }

  // Jackpot timers
  for(const j of [...G.jackpots]) {
    j.timer -= dt;
    if(j.timer <= 0) {
      G.money -= j.amount * .5;
      G.jackpots = G.jackpots.filter(x => x.id !== j.id);
      const p = G.patrons.find(p => p.id === j.patronId);
      if(p) { spawnFloat(p.wx,p.wy-20,'😠 Left angry!','#e07070'); kickOut(p); }
      toast('Jackpot timed out — patron left angry!','r');
    }
  }
}

// ── Open / close bar panel ─────────────────
function openBarPanel(machineId) {
  const bar = G.machines.find(m => m.id === machineId);
  if(!bar) return;
  _barPanelMid = machineId;
  _highlightPid = null;
  const def = MACHINE_DEFS[bar.type];
  document.getElementById('bar-panel-title').textContent = (def.icon||'🍺')+' '+def.name;
  document.getElementById('bar-panel').style.display = 'block';
  renderBarOrders();
  // Auto-refresh every 800ms so cooking timers update live
  clearInterval(_barPanelTimer);
  _barPanelTimer = setInterval(renderBarOrders, 800);
}

function closeBarPanel() {
  clearInterval(_barPanelTimer);
  _barPanelTimer = null;
  _barPanelMid = null;
  _highlightPid = null;
  document.getElementById('bar-panel').style.display = 'none';
}

// ── Render order list ──────────────────────
function renderBarOrders() {
  if(!_barPanelMid) return;
  const list = document.getElementById('bar-orders-list');
  const empty = document.getElementById('bar-empty-msg');
  const orders = G.foodOrders.filter(o => o.barId === _barPanelMid);

  if(!orders.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // Preserve scroll position
  const scrollY = list.scrollTop;
  list.innerHTML = '';

  for(const order of orders) {
    const fi  = FOOD_MENU.find(f => f.id === order.item);
    const p   = G.patrons.find(p => p.id === order.patronId);
    const staffHandling = order.serverId && order.serverId !== 'player';
    const isHighlighted = _highlightPid === order.patronId;

    // ── State badge and action button ──
    let badgeHtml = '', actionHtml = '';

    if(staffHandling) {
      const emp = G.employees.find(e => e.id === order.serverId);
      badgeHtml = `<span class="bar-badge staff">👨‍🍳 ${emp?.name||'Staff'}</span>`;
      actionHtml = `<span style="font-size:10px;color:var(--text-muted)">Staff handling</span>`;
    } else if(order.state === 'waiting_take') {
      badgeHtml = `<span class="bar-badge waiting">Waiting</span>`;
      actionHtml = `<button class="bar-action-btn take" onclick="barTakeOrder(${order.id})">Take Order</button>`;
    } else if(order.state === 'cooking') {
      const def2 = FOOD_MENU.find(f=>f.id===order.item);
      const pct  = Math.min(100, Math.round((order.progress||0) / def2.prepTime * 100));
      badgeHtml = `<span class="bar-badge cooking">🔥 Cooking ${pct}%</span>`;
      actionHtml = `<div class="bar-cook-bar"><div class="bar-cook-fill" style="width:${pct}%"></div></div>`;
    } else if(order.state === 'ready') {
      badgeHtml = `<span class="bar-badge ready">✅ Ready!</span>`;
      if(isHighlighted) {
        actionHtml = `<button class="bar-action-btn deliver active" onclick="barCancelDeliver()">Cancel</button>`;
      } else {
        actionHtml = `<button class="bar-action-btn deliver" onclick="barStartDeliver(${order.id})">Deliver →</button>`;
      }
    } else if(order.state === 'delivering') {
      badgeHtml = `<span class="bar-badge delivering">📦 Delivering</span>`;
      actionHtml = '';
    }

    // ── Patron highlight row ──
    const rowHighlight = isHighlighted ? 'bar-order-row highlighted' : 'bar-order-row';

    const row = document.createElement('div');
    row.className = rowHighlight;
    if(staffHandling) row.classList.add('dimmed');
    row.innerHTML = `
      <div class="bar-order-left">
        <span class="bar-item-icon">${fi?.icon||'🍽'}</span>
        <div class="bar-order-info">
          <div class="bar-item-name">${fi?.name||'Item'}</div>
          <div class="bar-patron-name">${p?.name||'Unknown patron'} ${p?.isHighRoller?'👑':''}</div>
          ${badgeHtml}
        </div>
      </div>
      <div class="bar-order-right">
        ${actionHtml}
        <div class="bar-tip">+$${order.tip.toFixed(2)} tip</div>
      </div>`;

    // Clicking patron name centres camera on them
    if(p) {
      row.querySelector('.bar-patron-name').style.cursor = 'pointer';
      row.querySelector('.bar-patron-name').addEventListener('click', () => {
        G.camera.x = Math.round(canvas.width/2 - p.wx);
        G.camera.y = Math.round(canvas.height/2 - p.wy - 60);
        clampCam();
      });
    }

    list.appendChild(row);
  }
  list.scrollTop = scrollY;
}

// ── Take an order (player starts cooking) ──
function barTakeOrder(orderId) {
  const order = G.foodOrders.find(o => o.id === orderId);
  if(!order || order.state !== 'waiting_take') return;
  if(order.serverId && order.serverId !== 'player') {
    toast('Staff already handling this order','r'); return;
  }
  order.state = 'cooking';
  order.progress = 0;
  order.serverId = 'player';
  const fi = FOOD_MENU.find(f=>f.id===order.item);
  toast('Cooking '+fi?.icon+' '+fi?.name+'…');
  renderBarOrders();
}

// ── Start delivery — highlights patron, awaits canvas click ──
function barStartDeliver(orderId) {
  const order = G.foodOrders.find(o => o.id === orderId);
  if(!order || order.state !== 'ready') return;
  if(order.serverId && order.serverId !== 'player') {
    toast('Staff is delivering this order','r'); return;
  }
  order.state = 'delivering';
  order.deliverId = 'player';
  _highlightPid = order.patronId;
  renderBarOrders();
  toast('Tap the highlighted patron to deliver!', '');
}

function barCancelDeliver() {
  // Find the delivering order and revert to ready
  const order = G.foodOrders.find(o => o.deliverId === 'player' && o.state === 'delivering');
  if(order) {
    order.state = 'ready';
    order.deliverId = null;
  }
  _highlightPid = null;
  renderBarOrders();
}

// ── Canvas click on patron (from input.js handleCanvasClick) ──
function handlePatronDelivery(patronId) {
  if(_highlightPid !== patronId) {
    // Not the right patron — flash them but don't deliver
    if(_highlightPid !== null) toast('Wrong patron — look for the highlighted one!','r');
    return;
  }
  const order = G.foodOrders.find(o => o.patronId === patronId && o.state === 'delivering' && o.deliverId === 'player');
  if(!order) { _highlightPid = null; renderBarOrders(); return; }

  const patron = G.patrons.find(p => p.id === patronId);
  if(patron) {
    patron.state = 'EATING';
    patron.eatTimer = 4000;
    const fi = FOOD_MENU.find(f=>f.id===order.item);
    spawnFloat(patron.wx, patron.wy-20, fi?.icon+' Enjoy! +$'+order.tip.toFixed(2), '#f0d060');
    G.money += order.tip; trackRev(order.tip);
    G.dayStats.tips = (G.dayStats.tips||0) + order.tip;
  }
  clearPersistNotif('bar-ready-'+order.id);
  cleanupOrder(order);
  _highlightPid = null;
  if(_barPanelMid) renderBarOrders();
}

// ── Employee delivers (called from employees.js) ──
function employeeDeliversOrder(order) {
  const patron = G.patrons.find(p => p.id === order.patronId);
  if(patron) {
    patron.state = 'EATING';
    patron.eatTimer = 4000;
    const fi = FOOD_MENU.find(f=>f.id===order.item);
    spawnFloat(patron.wx, patron.wy-20, fi?.icon+' Enjoy!', '#f0d060');
    G.money += order.tip * 0.5; // employee earns half tip
    trackRev(order.tip * 0.5);
  }
  clearPersistNotif('bar-ready-'+order.id);
  cleanupOrder(order);
  if(_barPanelMid === order.barId) renderBarOrders();
}

// ── Dirty dish ─────────────────────────────
function handleDirtyClick(dirtyId) {
  G.dirtyItems = G.dirtyItems.filter(d => d.id !== dirtyId);
  toast('🧹 Cleaned up!','g');
}

// ── Tip pickup ─────────────────────────────
function collectTip(tipId) {
  const t = G.tips.find(t => t.id === tipId);
  if(!t) return;
  G.money += t.amount; trackRev(t.amount);
  spawnFloat(t.wx, t.wy, '+$'+t.amount.toFixed(2)+' tip','#f0d060');
  G.tips = G.tips.filter(x => x.id !== tipId);
}

// ── Old carry UI (no longer shown, kept for safety) ───
function updatePlayerCarryUI() {
  const bar = document.getElementById('carry-bar');
  if(bar) bar.style.display = 'none';
}

// ── Jackpot ────────────────────────────────
function handleJackpotClick(machineId) {
  const j = G.jackpots.find(j => j.machineId === machineId);
  if(!j) return;
  openJackpotPanel(j);
}

function openJackpotPanel(j) {
  document.getElementById('jp-amount').textContent = '$'+j.amount.toFixed(2);
  document.getElementById('jp-panel').style.display = 'block';
  document.getElementById('jp-panel').dataset.jid = j.id;
}

function confirmJackpay() {
  const panel = document.getElementById('jp-panel');
  const jid = parseInt(panel.dataset.jid);
  const j = G.jackpots.find(j => j.id === jid);
  if(!j) return;
  resolveJackpot(j);
  panel.style.display = 'none';
}

// ── Dropped money ──────────────────────────
function openDroppedMoneyMenu(dropId) {
  const d = G.droppedMoney.find(d => d.id === dropId);
  if(!d) return;
  document.getElementById('dm-amount').textContent = '$'+d.amount.toFixed(2);
  document.getElementById('dm-panel').style.display = 'block';
  document.getElementById('dm-panel').dataset.did = dropId;
}

function collectDropped(choice) {
  const panel = document.getElementById('dm-panel');
  const did = parseInt(panel.dataset.did);
  const d = G.droppedMoney.find(d => d.id === did);
  if(!d) { panel.style.display='none'; return; }
  if(choice==='keep') {
    G.money += d.amount; trackRev(d.amount*.5);
    toast('Pocketed $'+d.amount.toFixed(2)+'  😈','g');
  } else if(choice==='lostandfound') {
    toast('📦 Added $'+d.amount.toFixed(2)+' to lost & found!','');
  } else {
    toast('❤️ Donated $'+d.amount.toFixed(2)+' to charity!','');
  }
  G.droppedMoney = G.droppedMoney.filter(x => x.id !== did);
  panel.style.display = 'none';
}
