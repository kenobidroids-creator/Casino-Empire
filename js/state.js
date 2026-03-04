// ═══════════════════════════════════════════
//  state.js
// ═══════════════════════════════════════════

const G = {
  money:0, totalEarned:0, day:1, speed:1,

  machines:[], patrons:[], employees:[],
  nextMid:1, nextPid:1, nextEid:1,

  cashierQueue:[], cashierServing:null, payTray:[],

  jackpots:[],         // { id, machineId, patronId, amount, timer }
  droppedMoney:[],     // { id, wx, wy, amount }
  nextDropId:1,

  foodOrders:[],       // { id, patronId, barId, item, state, progress, serverId, tray, tip }
  nextOrderId:1,
  dirtyItems:[],       // { id, machineId | barId | tableId, wx, wy }
  nextDirtyId:1,

  // Tips waiting to be collected
  tips:[],             // { id, wx, wy, amount, patronId }
  nextTipId:1,

  camera:{ x:0, y:0 },
  selectedMid:null,
  deleteMode:false,
  dragging:null,         // { type } hotbar drag (desktop)
  placementSelected:null,// type string — mobile tap-to-place selection
  placementRotation:0,   // 0-3

  revBucket:[],
  spawnAcc:0,
  spawnCooldown:7000,
  autosaveAcc:0,
  dayAcc:0,
  dayLen:240000,

  minigameOpen:false,
  minigameReels:[ {pos:0,speed:0,stopped:true,target:0},
                  {pos:0,speed:0,stopped:true,target:0},
                  {pos:0,speed:0,stopped:true,target:0} ],
  minigameBet:5,
  minigameSpinning:false,
  minigameResult:null,
};
