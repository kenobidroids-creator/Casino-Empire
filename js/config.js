// ═══════════════════════════════════════════════
//  config.js — All static constants & definitions
// ═══════════════════════════════════════════════

const TILE  = 64;
const FW    = 26;   // floor width  (tiles)
const FH    = 18;   // floor height (tiles)
const WALL  = 1;    // wall thickness (tiles)

const ENT_TX = Math.floor(FW / 2);
const ENT_TY = FH - 1;

// ── Machine definitions ──────────────────────
const MACHINE_DEFS = {
  slot_basic: {
    name: 'Basic Slot',    icon: '🎰', color: '#b82020',
    cost: 200,  w: 1, h: 1,
    betMin: 1,  betMax: 3,
    winRate: 0.30, winMultMin: 2, winMultMax: 5,
    playTime: 4500, tier: 1, isSlot: true
  },
  slot_silver: {
    name: 'Silver Slot',   icon: '🎲', color: '#607080',
    cost: 650,  w: 1, h: 1,
    betMin: 3,  betMax: 10,
    winRate: 0.32, winMultMin: 2, winMultMax: 6,
    playTime: 4000, tier: 2, isSlot: true
  },
  slot_gold: {
    name: 'Gold Slot',     icon: '⭐', color: '#d4900a',
    cost: 2200, w: 1, h: 1,
    betMin: 12, betMax: 30,
    winRate: 0.34, winMultMin: 2, winMultMax: 7,
    playTime: 3500, tier: 3, isSlot: true
  },
  slot_diamond: {
    name: 'Diamond Slot',  icon: '💎', color: '#1a70c0',
    cost: 8500, w: 1, h: 1,
    betMin: 60, betMax: 160,
    winRate: 0.36, winMultMin: 2, winMultMax: 8,
    playTime: 3000, tier: 4, isSlot: true
  },
  kiosk: {
    name: 'Ticket Kiosk',  icon: '🏧', color: '#1a7840',
    cost: 450,  w: 1, h: 1, tier: 0, isSlot: false
  },
  cashier: {
    name: 'Cashier Window', icon: '💰', color: '#6030a0',
    cost: 280,  w: 2, h: 1, tier: 0, isSlot: false
  }
};

// ── Upgrade definitions ──────────────────────
const UPGRADES = {
  speed: {
    name: 'Speed Boost', icon: '⚡', maxLv: 3, baseCost: 150,  mult: 2.0,
    desc: 'Patrons play 20% faster per level'
  },
  luck: {
    name: 'Lucky Charm',  icon: '🍀', maxLv: 3, baseCost: 220,  mult: 2.2,
    desc: '+2% win rate & patron appeal'
  },
  bet: {
    name: 'High Stakes',  icon: '💸', maxLv: 3, baseCost: 300,  mult: 2.5,
    desc: 'Max bet +25% per level'
  }
};

// ── Cashier till denominations ───────────────
// Bills and coins combined, split by type flag
const TILL_BILLS = [
  { value: 100,  label: '$100' },
  { value: 50,   label: '$50'  },
  { value: 20,   label: '$20'  },
  { value: 10,   label: '$10'  },
  { value: 5,    label: '$5'   },
  { value: 1,    label: '$1'   }
];

const TILL_COINS = [
  { value: 0.50, label: '50¢'  },
  { value: 0.25, label: '25¢'  },
  { value: 0.10, label: '10¢'  },
  { value: 0.05, label: '5¢'   },
  { value: 0.01, label: '1¢'   }
];

// ── Patron flavour ───────────────────────────
const PATRON_COLORS = [
  '#e04040','#4080d0','#30b060','#d08010',
  '#9040c0','#20b0a0','#d06020','#808090'
];

const PATRON_NAMES = [
  'Alice','Bob','Carol','Dave','Eve','Frank',
  'Grace','Hank','Iris','Jack','Kim','Lee',
  'Mia','Ned','Ora','Pete','Quinn','Rose'
];
