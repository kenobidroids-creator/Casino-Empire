// ═══════════════════════════════════════════
//  cashier.js
// ═══════════════════════════════════════════

function updateCashierAlert() {
  const open=document.getElementById('cashier-panel').style.display==='block';
  document.getElementById('cashier-alert').style.display=
    G.cashierQueue.length>0&&!open?'block':'none';
}

function openCashierPanel() {
  if(G.cashierQueue.length===0){toast('No patrons in queue!');return;}
  const cashier=G.machines.find(m=>m.type==='cashier');
  if(!cashier){toast('Place a Cashier Window first!','r');return;}

  // Flush stale entries
  while(G.cashierQueue.length>0) {
    const p=G.patrons.find(p=>p.id===G.cashierQueue[0]);
    if(p){G.cashierServing=p;break;}
    G.cashierQueue.shift();
  }
  if(!G.cashierServing){updateCashierAlert();return;}

  G.payTray=[];
  document.getElementById('cpat-name').textContent=G.cashierServing.name+"'s Ticket";
  document.getElementById('ctick').textContent='$'+G.cashierServing.ticketValue.toFixed(2);
  buildTill();
  renderTray();
  document.getElementById('queue-info').textContent=
    G.cashierQueue.length>1?(G.cashierQueue.length-1)+' more waiting':'';
  document.getElementById('cashier-panel').style.display='block';
  document.getElementById('cashier-alert').style.display='none';
}

function buildTill() {
  const billsEl=document.getElementById('till-bills');
  const coinsEl=document.getElementById('till-coins');
  billsEl.innerHTML=''; coinsEl.innerHTML='';
  for(const d of TILL_BILLS) {
    const el=document.createElement('div');
    el.className='bill'; el.textContent=d.label;
    el.onclick=()=>addToTray(d.value);
    billsEl.appendChild(el);
  }
  for(const d of TILL_COINS) {
    const el=document.createElement('div');
    el.className='coin'; el.textContent=d.label;
    el.onclick=()=>addToTray(d.value);
    coinsEl.appendChild(el);
  }
}

function addToTray(v) { G.payTray.push(v); renderTray(); }

function renderTray() {
  const area=document.getElementById('pay-area');
  const owed=G.cashierServing?G.cashierServing.ticketValue:0;
  const total=parseFloat(G.payTray.reduce((s,v)=>s+v,0).toFixed(2));

  if(!G.payTray.length) {
    area.innerHTML='<span class="pay-placeholder">Add bills or coins…</span>';
    area.className='pay-area';
  } else {
    area.innerHTML='';
    const suf=total>=owed-.001?(total>owed+.001?' over':' correct'):'';
    area.className='pay-area'+suf;
    G.payTray.forEach((v,i)=>{
      const el=document.createElement('div');
      if(v>=1){
        el.className='pay-bill'; el.textContent='$'+v.toFixed(0);
      } else {
        el.className='pay-coin';
        el.textContent=v>=.5?'50¢':v>=.25?'25¢':v>=.1?'10¢':v>=.05?'5¢':'1¢';
      }
      el.title='Click to remove';
      el.onclick=()=>{G.payTray.splice(i,1);renderTray();};
      area.appendChild(el);
    });
  }
  document.getElementById('pay-total').textContent=
    'Tray: $'+total.toFixed(2)+' / Owed: $'+owed.toFixed(2);
}

function confirmPay() {
  if(!G.cashierServing) return;
  const total=parseFloat(G.payTray.reduce((s,v)=>s+v,0).toFixed(2));
  const owed=G.cashierServing.ticketValue;
  if(total<owed-.005){toast('Need $'+owed.toFixed(2),'r');return;}
  G.money-=total;
  const chg=parseFloat((total-owed).toFixed(2));
  toast(chg>.005?'Paid! Change: $'+chg.toFixed(2):'Exact change ✓','g');
  finalizePayment();
}

function autoPay() {
  if(!G.cashierServing) return;
  G.money-=G.cashierServing.ticketValue;
  toast('Auto-paid $'+G.cashierServing.ticketValue.toFixed(2),'g');
  finalizePayment();
}

function finalizePayment() {
  G.cashierServing.state='PAID';
  G.cashierQueue.shift();
  G.cashierServing=null; G.payTray=[];
  closeCashierPanel();
  updateCashierAlert();
}

function clearTray(){G.payTray=[];renderTray();}
function closeCashierPanel(){
  document.getElementById('cashier-panel').style.display='none';
  updateCashierAlert();
}
