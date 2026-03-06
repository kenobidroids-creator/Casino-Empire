// ═══════════════════════════════════════════
//  parking.js — Parking lot car simulation
// ═══════════════════════════════════════════

// Parking slots are defined relative to building origin (in world px, not screen px)
// Building origin = (0, 0) in building-space; entrance bottom = (floorW/2 * TILE, (floorH+2*WALL)*TILE)
// Cars park in slots left and right of the entrance road

const PARK_SLOTS_PER_SIDE = 3;

// Returns building-relative slot positions for left and right lots
function getParkingSlots() {
  const bw = (G.floorW + 2*WALL) * TILE;
  const bh = (G.floorH + 2*WALL) * TILE;
  const roadW = bw * 1.8;
  const roadX = bw/2 - roadW/2;   // relative to building left edge
  const lotW  = TILE * 8;
  const roadY = bh;               // bottom of building
  const slotH = TILE * 1.6;
  const slotW = TILE * 1.4;

  const slots = [];
  // Left lot: 3 cols × 1 row
  for (let c = 0; c < PARK_SLOTS_PER_SIDE; c++) {
    slots.push({
      id: c,
      wx: roadX + TILE * 0.5 + c * slotW + slotW/2,
      wy: roadY + TILE * 0.5 + slotH/2,
      side: 'left'
    });
  }
  // Right lot: 3 cols × 1 row
  const rightLotX = bw + (roadW/2 - bw/2) - lotW;
  for (let c = 0; c < PARK_SLOTS_PER_SIDE; c++) {
    slots.push({
      id: PARK_SLOTS_PER_SIDE + c,
      wx: rightLotX + TILE * 0.5 + c * slotW + slotW/2,
      wy: roadY + TILE * 0.5 + slotH/2,
      side: 'right'
    });
  }
  return slots;
}

// Entry/exit x positions (road runs left-right off screen)
function _carEntryX(side) {
  const bw = (G.floorW + 2*WALL) * TILE;
  const roadW = bw * 1.8;
  const roadX = bw/2 - roadW/2;
  return side === 'left'
    ? roadX - TILE * 2          // comes from off-screen left
    : roadX + roadW + TILE * 2; // comes from off-screen right
}

function tickParking(dt) {
  if (!G.parkingCars) G.parkingCars = [];

  const slots = getParkingSlots();
  const occupiedSlotIds = new Set(G.parkingCars.map(c => c.slot).filter(s => s != null));
  const freeSlots = slots.filter(s => !occupiedSlotIds.has(s.id));

  // Spawn a new arriving car occasionally when slots free
  if (!G._carSpawnAcc) G._carSpawnAcc = 0;
  G._carSpawnAcc += dt;

  // Spawn interval depends on time of day (busier = more cars)
  const spawnInterval = 12000 / Math.max(0.4, getSpawnMultiplier());

  if (G._carSpawnAcc >= spawnInterval && freeSlots.length > 0 && G.parkingCars.length < 6) {
    G._carSpawnAcc = 0;
    const slot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const entX = _carEntryX(slot.side);
    const bh = (G.floorH + 2*WALL) * TILE;
    const roadY = bh;
    const midY = roadY + TILE * 1.75; // centre of road

    G.parkingCars.push({
      id: G._nextCarId++,
      wx: entX,
      wy: midY,
      targetWx: entX,     // will be updated in DRIVING_TO_SLOT
      targetWy: midY,
      color,
      facing: slot.side === 'left' ? 0 : 1,  // 0=right, 1=left
      state: 'DRIVING_TO_SLOT',
      slot: slot.id,
      slotWx: slot.wx,
      slotWy: slot.wy,
      stayTimer: 30000 + Math.random() * 60000,  // stay 30–90 s
      alpha: 0,
    });
  }

  // Update each car
  for (const car of G.parkingCars) {
    // Fade in/out
    if (car.state !== 'LEAVING') car.alpha = Math.min(1, (car.alpha||0) + dt/400);

    switch (car.state) {
      case 'DRIVING_TO_SLOT': {
        // First drive along road to x-position of slot, then turn into slot
        const bh = (G.floorH + 2*WALL) * TILE;
        const roadY = bh;
        const midY = roadY + TILE * 1.75;
        const speed = TILE * 0.08 * (dt / 16);

        // Phase 1: drive along road to slot's x
        if (Math.abs(car.wy - midY) > 3) {
          // snap to road height first
          car.wy += (midY - car.wy) * 0.15;
        }
        const targetX = car.slotWx;
        const dx = targetX - car.wx;
        if (Math.abs(dx) > speed) {
          car.wx += Math.sign(dx) * speed;
          car.facing = dx > 0 ? 0 : 1;
        } else {
          // Phase 2: pull into slot (move south)
          car.wx = targetX;
          car.wy += speed;
          car.facing = 2; // facing down
          if (car.wy >= car.slotWy) {
            car.wy = car.slotWy;
            car.facing = 2;
            car.state = 'PARKED';
          }
        }
        break;
      }
      case 'PARKED': {
        car.stayTimer -= dt;
        if (car.stayTimer <= 0) car.state = 'LEAVING';
        break;
      }
      case 'LEAVING': {
        // Reverse out (north), then drive away on road
        const bh = (G.floorH + 2*WALL) * TILE;
        const roadY = bh;
        const midY  = roadY + TILE * 1.75;
        const speed = TILE * 0.08 * (dt / 16);
        car.alpha = Math.max(0, (car.alpha||1) - dt/800);

        if (car.wy > midY) {
          // Still backing out
          car.wy -= speed;
          car.facing = 3; // facing up (reversing)
        } else {
          // On road — drive away
          car.wy = midY;
          const exitX = _carEntryX(car.slot < PARK_SLOTS_PER_SIDE ? 'left' : 'right');
          const dx2 = exitX - car.wx;
          car.wx += Math.sign(dx2) * speed * 1.4;
          car.facing = dx2 > 0 ? 0 : 1;
        }
        break;
      }
    }
  }

  // Remove cars that have driven off screen
  G.parkingCars = G.parkingCars.filter(car => {
    if (car.state !== 'LEAVING') return true;
    if (car.alpha <= 0) return false;
    const bw = (G.floorW + 2*WALL) * TILE;
    const roadW = bw * 1.8;
    return car.wx > -TILE * 4 && car.wx < bw + roadW + TILE * 4;
  });
}
