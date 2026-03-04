// ═══════════════════════════════════════════
//  machines.js — Place / rotate / upgrade / sell
// ═══════════════════════════════════════════

function placeMachine(type,tx,ty,rot) {
  const def=MACHINE_DEFS[type];
  if(!def) return false;
  if(G.money<def.cost){toast('Need $'+def.cost.toLocaleString(),'r');return false;}

  const r=rot||G.placementRotation||0;
  const pw=r%2===0?def.w:def.h;
  const ph=r%2===0?def.h:def.w;

  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(tx+dx,ty+dy)||tileOccupied(tx+dx,ty+dy)){toast('Cannot place here!','r');return false;}

  G.money-=def.cost;
  G.machines.push({
    id:G.nextMid++, type, tx, ty, rotation:r,
    upgrades:{speed:0,luck:0,bet:0},
    occupied:null, totalEarned:0
  });
  toast('Placed '+def.name,'g');
  return true;
}

function rotatePlacement() {
  G.placementRotation=(G.placementRotation+1)%4;
}

function rotateSelected() {
  if(!G.selectedMid) return;
  const m=G.machines.find(m=>m.id===G.selectedMid);
  if(!m) return;
  // Check if rotated version fits
  const def=MACHINE_DEFS[m.type];
  const newRot=(m.rotation+1)%4;
  const pw=newRot%2===0?def.w:def.h;
  const ph=newRot%2===0?def.h:def.w;
  for(let dx=0;dx<pw;dx++) for(let dy=0;dy<ph;dy++)
    if(!validTile(m.tx+dx,m.ty+dy)||tileOccupied(m.tx+dx,m.ty+dy,m.id)){toast('Cannot rotate here!','r');return;}
  m.rotation=newRot;
  openUpgradePanel(m.id);
}

function openUpgradePanel(mid) {
  const m=G.machines.find(m=>m.id===mid);
  if(!m) return;
  G.selectedMid=mid;
  const def=MACHINE_DEFS[m.type];
  document.getElementById('upg-title').textContent=def.icon+' '+def.name;

  const sg=document.getElementById('mstats');
  if(def.isSlot) {
    const bl=m.upgrades.bet||0, ll=m.upgrades.luck||0;
    sg.innerHTML=`
      <div class="mstat-box"><div class="mstat-lbl">Bet Range</div>
        <div class="mstat-val">$${(def.betMin*(1+bl*.25)).toFixed(2)}–$${(def.betMax*(1+bl*.25)).toFixed(2)}</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Win Rate</div>
        <div class="mstat-val">${((def.winRate+ll*.02)*100).toFixed(0)}%</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Total Earned</div>
        <div class="mstat-val">$${(m.totalEarned||0).toFixed(2)}</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Rotation</div>
        <div class="mstat-val">${['↓S','←W','↑N','→E'][m.rotation||0]}</div></div>`;
  } else {
    sg.innerHTML=`
      <div class="mstat-box"><div class="mstat-lbl">Rotation</div>
        <div class="mstat-val">${['↓S','←W','↑N','→E'][m.rotation||0]}</div></div>
      <div class="mstat-box"><div class="mstat-lbl">Cost Paid</div>
        <div class="mstat-val">$${def.cost}</div></div>`;
  }

  const og=document.getElementById('upg-options');
  og.innerHTML='';
  if(def.isSlot) {
    for(const [key,upg] of Object.entries(UPGRADES)) {
      const lv=m.upgrades[key]||0, maxd=lv>=upg.maxLv;
      const cost=Math.round(upg.baseCost*Math.pow(upg.mult,lv));
      const row=document.createElement('div'); row.className='upg-row';
      row.innerHTML=`<div class="upg-info"><h4>${upg.icon} ${upg.name} ${'★'.repeat(lv)}${'☆'.repeat(upg.maxLv-lv)}</h4>
        <p>${upg.desc}${maxd?' (MAX)':' — $'+cost}</p></div>
        <button class="btn-upg" ${maxd||G.money<cost?'disabled':''} data-key="${key}" data-cost="${cost}">
          ${maxd?'MAX':'$'+cost}</button>`;
      row.querySelector('.btn-upg').onclick=()=>buyUpgrade(mid,key,cost);
      og.appendChild(row);
    }
  }
  // Rotate button for all machines
  const rRow=document.createElement('div'); rRow.className='upg-row';
  rRow.innerHTML=`<div class="upg-info"><h4>🔄 Rotate Machine</h4><p>Change facing direction</p></div>
    <button class="btn-upg" onclick="rotateSelected()">Rotate</button>`;
  og.appendChild(rRow);

  document.getElementById('upgrade-panel').style.display='block';
}

function buyUpgrade(mid,key,cost) {
  const m=G.machines.find(m=>m.id===mid);
  if(!m||G.money<cost) return;
  const upg=UPGRADES[key];
  if((m.upgrades[key]||0)>=upg.maxLv) return;
  G.money-=cost; m.upgrades[key]=(m.upgrades[key]||0)+1;
  toast(upg.name+' upgraded ★','g');
  openUpgradePanel(mid);
}

function sellSelected() {
  if(!G.selectedMid) return;
  const m=G.machines.find(m=>m.id===G.selectedMid);
  if(!m) return;
  const def=MACHINE_DEFS[m.type], val=Math.floor(def.cost*.5);
  if(!confirm('Sell '+def.name+' for $'+val+'?')) return;
  if(m.occupied!=null){const p=G.patrons.find(p=>p.id===m.occupied);if(p){p.machineId=null;kickOut(p);}}
  G.machines=G.machines.filter(x=>x.id!==G.selectedMid);
  G.money+=val;
  toast('Sold for $'+val,'g');
  closeUpgradePanel();
}

function closeUpgradePanel() {
  document.getElementById('upgrade-panel').style.display='none';
  G.selectedMid=null;
}
