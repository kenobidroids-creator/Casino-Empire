// ═══════════════════════════════════════════════
//  machines.js — Place, upgrade, and sell machines
// ═══════════════════════════════════════════════

// ── Place ─────────────────────────────────────
function placeMachine(type, tx, ty) {
  const def = MACHINE_DEFS[type];
  if (!def) return false;

  if (G.money < def.cost) {
    toast('Need $' + def.cost.toLocaleString() + ' for ' + def.name + '!', 'r');
    return false;
  }

  for (let dx = 0; dx < def.w; dx++) {
    for (let dy = 0; dy < def.h; dy++) {
      if (!validTile(tx + dx, ty + dy) || tileOccupied(tx + dx, ty + dy)) {
        toast('Cannot place here!', 'r');
        return false;
      }
    }
  }

  G.money -= def.cost;
  G.machines.push({
    id:           G.nextMid++,
    type,
    tx, ty,
    upgrades:     { speed: 0, luck: 0, bet: 0 },
    occupied:     null,
    totalEarned:  0
  });

  toast('Placed ' + def.name, 'g');
  return true;
}

// ── Open upgrade panel ────────────────────────
function openUpgradePanel(mid) {
  const m = G.machines.find(m => m.id === mid);
  if (!m) return;
  G.selectedMid = mid;

  const def = MACHINE_DEFS[m.type];
  document.getElementById('upg-title').textContent = def.icon + ' ' + def.name;

  // Stats grid
  const sg = document.getElementById('mstats');
  if (def.isSlot) {
    const betLv  = m.upgrades.bet  || 0;
    const luckLv = m.upgrades.luck || 0;
    sg.innerHTML = `
      <div class="mstat-box">
        <div class="mstat-lbl">Bet Range</div>
        <div class="mstat-val">
          $${(def.betMin  * (1 + betLv * 0.25)).toFixed(2)}–$${(def.betMax * (1 + betLv * 0.25)).toFixed(2)}
        </div>
      </div>
      <div class="mstat-box">
        <div class="mstat-lbl">Win Rate</div>
        <div class="mstat-val">${((def.winRate + luckLv * 0.02) * 100).toFixed(0)}%</div>
      </div>
      <div class="mstat-box">
        <div class="mstat-lbl">Total Earned</div>
        <div class="mstat-val">$${(m.totalEarned || 0).toFixed(2)}</div>
      </div>
      <div class="mstat-box">
        <div class="mstat-lbl">Status</div>
        <div class="mstat-val">${m.occupied != null ? '🟢 Active' : '⚪ Idle'}</div>
      </div>`;
  } else {
    sg.innerHTML = `
      <div class="mstat-box">
        <div class="mstat-lbl">Type</div>
        <div class="mstat-val">${def.icon} ${def.name}</div>
      </div>
      <div class="mstat-box">
        <div class="mstat-lbl">Cost Paid</div>
        <div class="mstat-val">$${def.cost}</div>
      </div>`;
  }

  // Upgrade rows (slots only)
  const og = document.getElementById('upg-options');
  og.innerHTML = '';
  if (def.isSlot) {
    for (const [key, upg] of Object.entries(UPGRADES)) {
      const lv   = m.upgrades[key] || 0;
      const maxd = lv >= upg.maxLv;
      const cost = Math.round(upg.baseCost * Math.pow(upg.mult, lv));

      const row = document.createElement('div');
      row.className = 'upg-row';
      row.innerHTML = `
        <div class="upg-info">
          <h4>${upg.icon} ${upg.name} ${'★'.repeat(lv)}${'☆'.repeat(upg.maxLv - lv)}</h4>
          <p>${upg.desc}${maxd ? ' (MAXED)' : ' — $' + cost}</p>
        </div>
        <button class="btn-upg" ${maxd || G.money < cost ? 'disabled' : ''} data-key="${key}" data-cost="${cost}">
          ${maxd ? 'MAX' : '$' + cost}
        </button>`;
      row.querySelector('.btn-upg').onclick = () => buyUpgrade(mid, key, cost);
      og.appendChild(row);
    }
  }

  document.getElementById('upgrade-panel').style.display = 'block';
}

// ── Buy an upgrade ────────────────────────────
function buyUpgrade(mid, key, cost) {
  const m   = G.machines.find(m => m.id === mid);
  const upg = UPGRADES[key];
  if (!m || !upg) return;
  if (G.money < cost)                    { toast('Not enough money!', 'r'); return; }
  if ((m.upgrades[key] || 0) >= upg.maxLv) { toast('Already maxed!',    'r'); return; }

  G.money           -= cost;
  m.upgrades[key]    = (m.upgrades[key] || 0) + 1;
  toast(upg.name + ' upgraded! ★', 'g');
  openUpgradePanel(mid);  // refresh panel
}

// ── Sell selected machine ─────────────────────
function sellSelected() {
  if (!G.selectedMid) return;
  const m   = G.machines.find(m => m.id === G.selectedMid);
  if (!m) return;

  const def = MACHINE_DEFS[m.type];
  const val = Math.floor(def.cost * 0.5);
  if (!confirm('Sell ' + def.name + ' for $' + val + '?')) return;

  // Release any occupying patron
  if (m.occupied != null) {
    const p = G.patrons.find(p => p.id === m.occupied);
    if (p) { p.machineId = null; kickOut(p); }
  }

  G.machines = G.machines.filter(x => x.id !== G.selectedMid);
  G.money   += val;
  toast('Sold for $' + val, 'g');
  closeUpgradePanel();
}

function closeUpgradePanel() {
  document.getElementById('upgrade-panel').style.display = 'none';
  G.selectedMid = null;
}
