// ═══════════════════════════════════════════════
//  cashier.js — Cashier window UI & payment logic
// ═══════════════════════════════════════════════

// ── Alert badge ───────────────────────────────
function updateCashierAlert() {
  const panelOpen = document.getElementById('cashier-panel').style.display === 'block';
  const hasQueue  = G.cashierQueue.length > 0;
  document.getElementById('cashier-alert').style.display =
    (hasQueue && !panelOpen) ? 'block' : 'none';
}

// ── Open cashier panel ────────────────────────
function openCashierPanel() {
  if (G.cashierQueue.length === 0) { toast('No patrons in queue!'); return; }

  const cashier = G.machines.find(m => m.type === 'cashier');
  if (!cashier) { toast('Place a Cashier Window first!', 'r'); return; }

  // Find first valid queued patron
  while (G.cashierQueue.length > 0) {
    const pid    = G.cashierQueue[0];
    const patron = G.patrons.find(p => p.id === pid);
    if (patron) {
      G.cashierServing = patron;
      break;
    }
    G.cashierQueue.shift();  // stale entry — remove and try next
  }

  if (!G.cashierServing) { updateCashierAlert(); return; }

  G.payTray = [];
  document.getElementById('cpat-name').textContent = G.cashierServing.name + '\'s Ticket';
  document.getElementById('ctick').textContent      = '$' + G.cashierServing.ticketValue.toFixed(2);

  buildTill();
  renderTray();
  updateQueueInfo();

  document.getElementById('cashier-panel').style.display = 'block';
  document.getElementById('cashier-alert').style.display = 'none';
}

// ── Build the till (bills + coins) ───────────
function buildTill() {
  const billsEl = document.getElementById('till-bills');
  const coinsEl = document.getElementById('till-coins');
  billsEl.innerHTML = '';
  coinsEl.innerHTML = '';

  for (const denom of TILL_BILLS) {
    const el = document.createElement('div');
    el.className   = 'bill';
    el.textContent = denom.label;
    el.onclick     = () => addToTray(denom.value);
    billsEl.appendChild(el);
  }

  for (const denom of TILL_COINS) {
    const el = document.createElement('div');
    el.className   = 'coin';
    el.textContent = denom.label;
    el.onclick     = () => addToTray(denom.value);
    coinsEl.appendChild(el);
  }
}

// ── Add denomination to tray ──────────────────
function addToTray(value) {
  G.payTray.push(value);
  renderTray();
}

// ── Render the payment tray ───────────────────
function renderTray() {
  const area  = document.getElementById('pay-area');
  const owed  = G.cashierServing ? G.cashierServing.ticketValue : 0;
  const total = parseFloat(G.payTray.reduce((s, v) => s + v, 0).toFixed(2));

  if (G.payTray.length === 0) {
    area.innerHTML = '<span class="pay-placeholder">Add bills or coins from till above…</span>';
    area.className = 'pay-area';
  } else {
    area.innerHTML = '';

    let sufficient = total >= owed - 0.001;
    let over       = total > owed + 0.001;
    area.className = 'pay-area' + (sufficient ? (over ? ' over' : ' correct') : '');

    G.payTray.forEach((v, i) => {
      const el = document.createElement('div');
      if (v >= 1) {
        el.className   = 'pay-bill';
        el.textContent = '$' + v.toFixed(0);
      } else {
        el.className   = 'pay-coin';
        el.textContent = v >= 0.50 ? '50¢'
                       : v >= 0.25 ? '25¢'
                       : v >= 0.10 ? '10¢'
                       : v >= 0.05 ? '5¢'
                       : '1¢';
      }
      el.title   = 'Click to remove';
      el.onclick = () => { G.payTray.splice(i, 1); renderTray(); };
      area.appendChild(el);
    });
  }

  document.getElementById('pay-total').textContent =
    'Tray: $' + total.toFixed(2) + ' / Owed: $' + owed.toFixed(2);
}

// ── Confirm manual payment ────────────────────
function confirmPay() {
  if (!G.cashierServing) return;
  const total = parseFloat(G.payTray.reduce((s, v) => s + v, 0).toFixed(2));
  const owed  = G.cashierServing.ticketValue;

  if (total < owed - 0.005) {
    toast('Not enough — need $' + owed.toFixed(2), 'r');
    return;
  }

  const change = parseFloat((total - owed).toFixed(2));
  G.money -= total;

  if (change > 0.005) {
    toast('Paid! Change given: $' + change.toFixed(2), 'g');
  } else {
    toast('Exact change — paid $' + owed.toFixed(2) + ' ✓', 'g');
  }

  finalizePayment();
}

// ── Auto-pay button ───────────────────────────
function autoPay() {
  if (!G.cashierServing) return;
  const owed = G.cashierServing.ticketValue;
  G.money -= owed;
  toast('Auto-paid $' + owed.toFixed(2), 'g');
  finalizePayment();
}

// ── Shared cleanup after payment ──────────────
function finalizePayment() {
  G.cashierServing.state = 'PAID';
  G.cashierQueue.shift();
  G.cashierServing = null;
  G.payTray        = [];
  closeCashierPanel();
  updateCashierAlert();
}

function clearTray() {
  G.payTray = [];
  renderTray();
}

function closeCashierPanel() {
  document.getElementById('cashier-panel').style.display = 'none';
  updateCashierAlert();
}

function updateQueueInfo() {
  const qi = document.getElementById('queue-info');
  qi.textContent = G.cashierQueue.length > 1
    ? (G.cashierQueue.length - 1) + ' more patron(s) waiting'
    : '';
}
