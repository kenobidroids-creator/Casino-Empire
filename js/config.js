// ═══════════════════════════════════════════
//  config.js
// ═══════════════════════════════════════════

const TILE = 64;
const WALL = 1;

const FLOOR_LEVELS = [
  { w:14, h:10, cost:0,    label:'Starter'    },
  { w:22, h:14, cost:3000, label:'Mid-size'   },
  { w:30, h:20, cost:8000, label:'Full Casino' }
];

const ENT_TX = () => Math.floor(G.floorW/2);
const ENT_TY = () => G.floorH - 1;

const REEL_SYMBOLS = ['7','BAR','🔔','🍊','🍋','🍒','⭐','💎'];
const REEL_COLORS  = ['#ff4444','#fff','#f0c040','#f07020','#e8e040','#e04060','#f8e040','#80c8ff'];
const JACKPOT_THRESH  = 50;
const JACKPOT_TIMEOUT = 50000;

// ── Slot house-edge math ─────────────────────────────────────────────────
// Net per $1 bet = 1 – winRate×avgMult
// Basic:   1 – 0.22×2.85 = 0.373  → 37% edge  (budget machine)
// Silver:  1 – 0.25×3.1  = 0.225  → 22% edge
// Gold:    1 – 0.28×3.0  = 0.160  → 16% edge
// Diamond: 1 – 0.30×2.9  = 0.130  → 13% edge
// ─────────────────────────────────────────────────────────────────────────
const MACHINE_DEFS = {
  slot_basic: {
    name:'Basic Slot',   icon:'🎰', color:'#9a1818', w:1, h:1,
    cost:200,  betMin:1,  betMax:4,   winRate:.22, winMultMin:1.5, winMultMax:4.2,
    playTime:4000, tier:1, isSlot:true, houseEdge:0.373,
    repairCost:50,  degradePerSpin:1.8  // health lost per spin
  },
  slot_silver: {
    name:'Silver Slot',  icon:'🎲', color:'#4a6070', w:1, h:1,
    cost:650,  betMin:3,  betMax:12,  winRate:.25, winMultMin:1.8, winMultMax:4.4,
    playTime:3600, tier:2, isSlot:true, houseEdge:0.225,
    repairCost:120, degradePerSpin:1.4
  },
  slot_gold: {
    name:'Gold Slot',    icon:'⭐', color:'#b07008', w:1, h:1,
    cost:2200, betMin:8,  betMax:30,  winRate:.28, winMultMin:2.0, winMultMax:4.0,
    playTime:3200, tier:3, isSlot:true, houseEdge:0.16,
    repairCost:300, degradePerSpin:1.0
  },
  slot_diamond: {
    name:'Diamond Slot', icon:'💎', color:'#1058a8', w:1, h:1,
    cost:8500, betMin:25, betMax:100, winRate:.30, winMultMin:2.0, winMultMax:3.8,
    playTime:2800, tier:4, isSlot:true, houseEdge:0.13,
    repairCost:800, degradePerSpin:0.7
  },

  // ── Support ──────────────────────────────
  kiosk:        { name:'Ticket Kiosk',   icon:'🏧', color:'#1a7840', w:1,h:1, cost:450,  isKiosk:true },
  cashier:      { name:'Cashier Window', icon:'💰', color:'#502880', w:2,h:1, cost:280,  isCashier:true },
  bar:          { name:'Bar & Grill',    icon:'🍺', color:'#5c2008', w:2,h:1, cost:600,  isBar:true },
  table:        { name:'Table',          icon:'🪑', color:'#3a2010', w:1,h:1, cost:120,  isTable:true, seats:1 },
  surveillance: { name:'Surveillance',  icon:'📷', color:'#182840', w:1,h:1, cost:900,  isSurveillance:true },
  security:     { name:'Security Desk', icon:'🔒', color:'#203040', w:1,h:1, cost:500,  isSecurity:true },

  // ── Entertainment ────────────────────────
  band:         { name:'Band Stage',     icon:'🎸', color:'#1a0a40', w:2,h:2, cost:1200, isBand:true,
                  desc:'Keeps patrons entertained, slowing their departure' },

  // ── Sportsbook ───────────────────────────
  sportsbook:   { name:'Sportsbook',     icon:'📺', color:'#082820', w:2,h:1, cost:2000, isSportsbook:true,
                  houseEdge:0.16, desc:'Patrons bet on live sports events' },
  tv_screen:    { name:'TV Screen',      icon:'📺', color:'#0a1020', w:1,h:1, cost:400,  isTvScreen:true },

  // ── Table Games ─────────────────────────
  blackjack_table: {
    name:'Blackjack',   icon:'🃏', color:'#062a14', w:2,h:2, cost:3500,
    isTable:true, tableGame:'blackjack', seats:5, houseEdge:0.005,
    desc:'Classic blackjack, house edge ~0.5%'
  },
  roulette_table: {
    name:'Roulette',    icon:'🎡', color:'#1a0006', w:2,h:2, cost:4000,
    isTable:true, tableGame:'roulette', seats:8, houseEdge:0.053,
    desc:'American roulette, 5.3% house edge'
  },
  poker_table: {
    name:'Poker Table', icon:'♠', color:'#0a1a06', w:2,h:2, cost:3000,
    isTable:true, tableGame:'poker', seats:6, houseEdge:0.12,
    desc:'Texas Hold\'em style poker vs house'
  },
};

const UPGRADES = {
  speed: { name:'Speed Boost', icon:'⚡', maxLv:3, baseCost:200,  mult:2.0, desc:'Play 20% faster/level' },
  luck:  { name:'Lucky Charm', icon:'🍀', maxLv:3, baseCost:300,  mult:2.2, desc:'+2% win rate/level'    },
  bet:   { name:'High Stakes', icon:'💸', maxLv:3, baseCost:400,  mult:2.5, desc:'Max bet +25%/level'     }
};

const EMPLOYEE_DEFS = {
  cashier_staff:  { name:'Cashier',         icon:'👔', color:'#2060c0', cost:400, wage:80  },
  slot_attendant: { name:'Slot Attendant',  icon:'🎩', color:'#a04020', cost:500, wage:100 },
  food_server:    { name:'Food Server',     icon:'🧑‍🍳', color:'#208040', cost:450, wage:90  },
  dealer:         { name:'Table Dealer',    icon:'🃏', color:'#183060', cost:600, wage:120 }
};

const FOOD_MENU = [
  { id:'beer',     name:'Beer',      icon:'🍺', price:8,  prepTime:2500 },
  { id:'cocktail', name:'Cocktail',  icon:'🍹', price:14, prepTime:4500 },
  { id:'burger',   name:'Burger',    icon:'🍔', price:16, prepTime:7000 },
  { id:'nachos',   name:'Nachos',    icon:'🌮', price:12, prepTime:5500 },
  { id:'water',    name:'Water',     icon:'💧', price:4,  prepTime:1500 },
  { id:'coffee',   name:'Coffee',    icon:'☕', price:6,  prepTime:3000 }
];

const TILL_BILLS = [
  {value:100,label:'$100'},{value:50,label:'$50'},{value:20,label:'$20'},
  {value:10,label:'$10'},{value:5,label:'$5'},{value:1,label:'$1'}
];
const TILL_COINS = [
  {value:0.50,label:'50¢'},{value:0.25,label:'25¢'},{value:0.10,label:'10¢'},
  {value:0.05,label:'5¢'},{value:0.01,label:'1¢'}
];

const PATRON_COLORS=['#e04040','#4080d0','#30b060','#d08010','#9040c0','#20b0a0','#d06020','#808090'];
const PATRON_NAMES=['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jack',
                     'Kim','Lee','Mia','Ned','Ora','Pete','Quinn','Rose','Sam','Tina',
                     'Uma','Vic','Wendy','Xav','Yara','Zoe'];

function getPatronOffset(rot) {
  // rot 0 = facing south (default, patron stands below machine)
  // rot 1 = facing west  (patron stands left)
  // rot 2 = facing north (patron stands above)
  // rot 3 = facing east  (patron stands right)
  switch(rot) {
    case 0: return {dx: 0,    dy: 0.7 };  // south
    case 1: return {dx:-0.7,  dy: 0   };  // west
    case 2: return {dx: 0,    dy:-0.7 };  // north
    case 3: return {dx: 0.7,  dy: 0   };  // east
    default:return {dx: 0,    dy: 0.7 };
  }
}
