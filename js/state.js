// ═══════════════════════════════════════════
//  state.js
// ═══════════════════════════════════════════

const G = {
  money:5000, totalEarned:0, day:1, speed:1,
  dayOfWeek:0,  // 0=Mon … 6=Sun, start on Monday so players see the full week
  floorLevel:0,   // index into FLOOR_LEVELS
  floorW:FLOOR_LEVELS[0].w,
  floorH:FLOOR_LEVELS[0].h,

  machines:[], patrons:[], employees:[],
  nextMid:1, nextPid:1, nextEid:1,

  cashierQueue:[], cashierServing:null, payTray:[],

  jackpots:[],
  droppedMoney:[],    // { id, wx, wy, amount, patronName }
  nextDropId:1,

  // Found money collected during the day - player decides what to do at day-end
  collectedMoneyPool: 0,
  lostAndFoundLog:     [],  // legacy
  lostAndFoundContacts:[],  // { id, name, amount, day, phone, status }
  nextContactId:       1,
  lostAndFoundVisitors:[],  // returning patrons: { id, patronName, amount, wx, wy, state, machineId }
  survTabs:            {},  // { machineId: 'topdown'|'firstperson' }

  foodOrders:[], nextOrderId:1,
  dirtyItems:[], nextDirtyId:1,
  tips:[],       nextTipId:1,

  camera:{ x:0, y:0 },
  selectedMid:null,
  deleteMode:false,
  dragging:null,
  placementSelected:null,
  placementRotation:0,

  // Move mode
  moveMode:null,   // { machineId, origTx, origTy }

  // Collection swipe
  collecting:false,

  // Day stats
  dayStats: {
    patronsVisited:0, moneyIn:0, moneyOut:0,
    wages:0, tips:0, foundMoney:0, jackpotsPaid:0
  },

  revBucket:[],
  spawnAcc:0, spawnCooldown:7000,
  autosaveAcc:0, dayAcc:0, dayLen:240000,

  minigameOpen:false,
  minigameReels:[
    {pos:0,speed:0,stopped:true,target:0,stopAt:0},
    {pos:0,speed:0,stopped:true,target:0,stopAt:0},
    {pos:0,speed:0,stopped:true,target:0,stopAt:0}
  ],
  minigameBet:5,
  minigameSpinning:false,
  minigameResult:null,

  surveillanceOpen:false,

  // Parking lot cars
  parkingCars: [],   // { id, wx, wy, color, facing, state, timer, slot }
  _nextCarId: 1,

  // Loan system
  loans:[], nextLoanId:1,
  allTimeProfit:0,   // running total of net profit across all days

  // Per-day history for P&L report (last 30 days)
  dayHistory:[],
};

// Loan system state (appended by chunk 3)
// G.loans = [{ id, principal, remaining, dailyPayment, daysLeft, interestRate }]
