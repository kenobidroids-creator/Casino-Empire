// ═══════════════════════════════════════════
//  config.js
// ═══════════════════════════════════════════

const TILE = 64;
const FW   = 30;
const FH   = 22;
const WALL = 1;

const ENT_TX = Math.floor(FW / 2);
const ENT_TY = FH - 1;

const REEL_SYMBOLS   = ['7','BAR','🔔','🍊','🍋','🍒','⭐','💎'];
const REEL_COLORS    = ['#ff4444','#fff','#f0c040','#f07020','#e8e040','#e04060','#f8e040','#80c8ff'];
const JACKPOT_THRESH = 200;   // ticket value that triggers jackpot hand-pay
const JACKPOT_TIMEOUT = 40000; // ms before unclaimed jackpot auto-pays (deducted)

const MACHINE_DEFS = {
  slot_basic: {
    name:'Basic Slot',    icon:'🎰', color:'#9a1818', w:1, h:1,
    cost:200, betMin:1,  betMax:3,   winRate:.30, winMultMin:2, winMultMax:5,
    playTime:4500, tier:1, isSlot:true
  },
  slot_silver: {
    name:'Silver Slot',   icon:'🎲', color:'#4a6070', w:1, h:1,
    cost:650, betMin:3,  betMax:10,  winRate:.32, winMultMin:2, winMultMax:6,
    playTime:4000, tier:2, isSlot:true
  },
  slot_gold: {
    name:'Gold Slot',     icon:'⭐', color:'#b07008', w:1, h:1,
    cost:2200, betMin:12, betMax:30,  winRate:.34, winMultMin:2, winMultMax:7,
    playTime:3500, tier:3, isSlot:true
  },
  slot_diamond: {
    name:'Diamond Slot',  icon:'💎', color:'#1058a8', w:1, h:1,
    cost:8500, betMin:60, betMax:160, winRate:.36, winMultMin:2, winMultMax:8,
    playTime:3000, tier:4, isSlot:true
  },
  kiosk: {
    name:'Ticket Kiosk',  icon:'🏧', color:'#1a7840', w:1, h:1,
    cost:450, tier:0, isSlot:false, isKiosk:true
  },
  cashier: {
    name:'Cashier Window', icon:'💰', color:'#502880', w:2, h:1,
    cost:280, tier:0, isSlot:false, isCashier:true
  },
  bar: {
    name:'Bar & Grill',   icon:'🍺', color:'#5c2008', w:2, h:1,
    cost:600, tier:0, isSlot:false, isBar:true
  },
  table: {
    name:'Table',          icon:'🪑', color:'#3a2010', w:1, h:1,
    cost:120, tier:0, isSlot:false, isTable:true, seats:1
  }
};

const UPGRADES = {
  speed: { name:'Speed Boost', icon:'⚡', maxLv:3, baseCost:150, mult:2.0, desc:'Play 20% faster/level' },
  luck:  { name:'Lucky Charm', icon:'🍀', maxLv:3, baseCost:220, mult:2.2, desc:'+2% win rate/level'    },
  bet:   { name:'High Stakes', icon:'💸', maxLv:3, baseCost:300, mult:2.5, desc:'Max bet +25%/level'     }
};

const EMPLOYEE_DEFS = {
  cashier_staff:    { name:'Cashier',       icon:'👔', color:'#2060c0', cost:400, wage:80  },
  slot_attendant:   { name:'Slot Attendant',icon:'🎩', color:'#a04020', cost:500, wage:100 },
  food_server:      { name:'Food Server',   icon:'🧑‍🍳', color:'#208040', cost:450, wage:90  }
};

const FOOD_MENU = [
  { id:'beer',     name:'Beer',       icon:'🍺', price:6,  prepTime:3000 },
  { id:'cocktail', name:'Cocktail',   icon:'🍹', price:12, prepTime:5000 },
  { id:'burger',   name:'Burger',     icon:'🍔', price:14, prepTime:7000 },
  { id:'nachos',   name:'Nachos',     icon:'🌮', price:10, prepTime:6000 },
  { id:'water',    name:'Water',      icon:'💧', price:3,  prepTime:1500 },
  { id:'coffee',   name:'Coffee',     icon:'☕', price:5,  prepTime:3500 }
];

const TILL_BILLS = [
  {value:100,label:'$100'},{value:50,label:'$50'},{value:20,label:'$20'},
  {value:10,label:'$10'},{value:5,label:'$5'},{value:1,label:'$1'}
];
const TILL_COINS = [
  {value:0.50,label:'50¢'},{value:0.25,label:'25¢'},{value:0.10,label:'10¢'},
  {value:0.05,label:'5¢'},{value:0.01,label:'1¢'}
];

const PATRON_COLORS = ['#e04040','#4080d0','#30b060','#d08010','#9040c0','#20b0a0','#d06020','#808090'];
const PATRON_NAMES  = ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jack',
                        'Kim','Lee','Mia','Ned','Ora','Pete','Quinn','Rose','Sam','Tina'];

// Rotation helpers
// rot 0=south, 1=west, 2=north, 3=east (front face)
function getPatronOffset(rot) {
  // Returns tile offset from machine top-left for patron standing position
  // Patron stands 1 tile beyond the front face
  switch(rot) {
    case 0: return { dx:0,   dy:1   }; // front = south
    case 1: return { dx:-1,  dy:0   }; // front = west
    case 2: return { dx:0,   dy:-1  }; // front = north
    case 3: return { dx:1,   dy:0   }; // front = east
  }
}
