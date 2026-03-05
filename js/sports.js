// ═══════════════════════════════════════════
//  sports.js  — Pixel sports animations
// ═══════════════════════════════════════════
// Each sport renderer takes (mc, W, H, t) where t = Date.now()
// and draws an animated pixel scene into the provided canvas context.

const SPORT_ANIM = {
  football: drawFootball,
  baseball:  drawBaseball,
  hockey:    drawHockey,
  f1:        drawF1,
  horses:    drawHorses,
};
const SPORT_KEYS = Object.keys(SPORT_ANIM);

// ── shared helpers ────────────────────────────────────────────────────────
function pixelRect(mc,x,y,w,h,col){mc.fillStyle=col;mc.fillRect(Math.round(x),Math.round(y),w,h);}
function pixelCirc(mc,x,y,r,col){mc.fillStyle=col;mc.beginPath();mc.arc(Math.round(x),Math.round(y),r,0,Math.PI*2);mc.fill();}
function pixelLine(mc,x1,y1,x2,y2,col,lw=1){mc.strokeStyle=col;mc.lineWidth=lw;mc.beginPath();mc.moveTo(Math.round(x1),Math.round(y1));mc.lineTo(Math.round(x2),Math.round(y2));mc.stroke();}

// ── FOOTBALL ─────────────────────────────────────────────────────────────
function drawFootball(mc, W, H, t) {
  const ms = t % 6000; // 6-second play cycle

  // Grass field
  pixelRect(mc,0,0,W,H,'#1a5c10');
  // Field lines
  mc.strokeStyle='rgba(255,255,255,.25)'; mc.lineWidth=.5;
  for(let x=0;x<W;x+=W/5){mc.beginPath();mc.moveTo(x,0);mc.lineTo(x,H);mc.stroke();}
  pixelRect(mc,0,H/2-0.5,W,1,'rgba(255,255,255,.2)');
  // End zones
  pixelRect(mc,0,0,W*0.08,H,'rgba(50,100,200,.35)');
  pixelRect(mc,W*0.92,0,W*0.08,H,'rgba(200,50,50,.35)');
  // Goal posts (yellow pixels)
  const gpx=W*0.07; mc.fillStyle='#f0d020';
  mc.fillRect(gpx-1,H*0.15,2,H*0.7);
  mc.fillRect(gpx-8,H*0.15,16,2);

  // Players — blue team (offense)
  const offX = ms<3000 ? W*0.35+ms/3000*W*0.3 : W*0.65;
  drawPixelPlayer(mc, offX,      H*0.42, '#2060c0', '#f0c890');
  drawPixelPlayer(mc, offX-14,   H*0.30, '#2060c0', '#f0c890');
  drawPixelPlayer(mc, offX-14,   H*0.55, '#2060c0', '#f0c890');
  // Red team (defense)
  drawPixelPlayer(mc, offX+18,   H*0.38, '#c02020', '#e8b870');
  drawPixelPlayer(mc, offX+24,   H*0.52, '#c02020', '#e8b870');

  // Ball
  const bx = ms<3000 ? offX+6 : offX+6+(ms-3000)/3000*W*0.15;
  const by = H*0.44 - (ms<3000?0:Math.sin((ms-3000)/3000*Math.PI)*H*0.25);
  mc.fillStyle='#8b4513'; mc.beginPath(); mc.ellipse(bx,by,4,2.5,0.4,0,Math.PI*2); mc.fill();
  mc.strokeStyle='#fff'; mc.lineWidth=0.5;
  mc.beginPath(); mc.moveTo(bx-2,by); mc.lineTo(bx+2,by); mc.stroke();

  // Score overlay
  drawSportScore(mc, W, 'FOOTBALL', '14', '17', '#2060c0','#c02020');
  if(ms>4500) {drawStatusBadge(mc,W,H,'TOUCHDOWN! 🏈','#f0d020');}
}

// ── BASEBALL ─────────────────────────────────────────────────────────────
function drawBaseball(mc, W, H, t) {
  const ms = t % 5000;

  // Grass + dirt diamond
  pixelRect(mc,0,0,W,H,'#2a7a18');
  // Infield dirt
  mc.fillStyle='#c8882a';
  mc.beginPath();
  mc.moveTo(W/2,H*0.1); mc.lineTo(W*0.85,H*0.55); mc.lineTo(W/2,H*0.98); mc.lineTo(W*0.15,H*0.55);
  mc.closePath(); mc.fill();
  // Grass inside diamond
  mc.fillStyle='#22680f';
  mc.beginPath();
  mc.moveTo(W/2,H*0.22); mc.lineTo(W*0.73,H*0.53); mc.lineTo(W/2,H*0.85); mc.lineTo(W*0.27,H*0.53);
  mc.closePath(); mc.fill();
  // Bases
  const bases=[[W/2,H*0.12],[W*0.84,H*0.54],[W/2,H*0.97],[W*0.16,H*0.54]];
  mc.fillStyle='#fff';
  for(const [bx,by] of bases) mc.fillRect(bx-4,by-3,8,6);

  // Pitcher mound
  pixelCirc(mc,W/2,H*0.55,7,'#b87820');

  // Pitcher
  drawPixelPlayer(mc,W/2,H*0.48,'#c02020','#f0c890');
  // Batter
  drawPixelPlayer(mc,W/2-4,H*0.92,'#2060c0','#e8b870');
  // Catcher
  drawPixelPlayer(mc,W/2,H*0.96,'#2060c0','#e8b870');

  // Ball in flight
  if(ms<2500) {
    const bx=W/2 + (ms/2500)*(W/2-4-W/2)*0.5;
    const by=H*0.48 + (ms/2500)*(H*0.88-H*0.48);
    const arc=-Math.sin(ms/2500*Math.PI)*H*0.1;
    pixelCirc(mc,bx,by+arc,2.5,'#fff');
  }

  // Bat swing
  if(ms>2200&&ms<2800) {
    const ang=((ms-2200)/600)*Math.PI*0.8-0.3;
    mc.strokeStyle='#8b5a00'; mc.lineWidth=2;
    mc.beginPath();
    mc.moveTo(W/2-2,H*0.9);
    mc.lineTo(W/2-2+Math.cos(ang)*18, H*0.9+Math.sin(ang)*18);
    mc.stroke();
  }

  drawSportScore(mc,W,'BASEBALL','3','2','#c02020','#2060c0');
  if(ms>3000&&ms<4200) drawStatusBadge(mc,W,H,'STRIKE! ⚾','#f0d020');
}

// ── HOCKEY ───────────────────────────────────────────────────────────────
function drawHockey(mc, W, H, t) {
  const ms = t % 4500;

  // Ice
  pixelRect(mc,0,0,W,H,'#cce8f8');
  // Rink markings
  mc.strokeStyle='rgba(200,50,50,.4)'; mc.lineWidth=1.5;
  mc.beginPath(); mc.arc(W/2,H/2,H*0.35,0,Math.PI*2); mc.stroke();
  mc.strokeStyle='rgba(200,50,50,.6)'; mc.lineWidth=2;
  mc.beginPath(); mc.moveTo(W/2,0); mc.lineTo(W/2,H); mc.stroke();
  // Goals
  mc.fillStyle='rgba(180,180,180,.6)';
  mc.fillRect(2,H*0.35,6,H*0.3);
  mc.fillRect(W-8,H*0.35,6,H*0.3);
  mc.strokeStyle='rgba(255,0,0,.5)'; mc.lineWidth=1;
  mc.strokeRect(2,H*0.35,6,H*0.3); mc.strokeRect(W-8,H*0.35,6,H*0.3);

  // Blue line
  mc.strokeStyle='rgba(50,80,200,.35)'; mc.lineWidth=2;
  mc.beginPath(); mc.moveTo(W*0.3,0); mc.lineTo(W*0.3,H); mc.stroke();
  mc.beginPath(); mc.moveTo(W*0.7,0); mc.lineTo(W*0.7,H); mc.stroke();

  // Players
  const puck_x = W*0.25 + (ms/4500)*W*0.55;
  const puck_y = H*0.45 + Math.sin(ms/1000)*H*0.1;
  drawPixelPlayer(mc,puck_x-8, puck_y,   '#c02020','#f0c890');
  drawPixelPlayer(mc,puck_x+10,puck_y-6,'#2060c0','#e8b870');
  // Puck
  mc.fillStyle='#111'; mc.beginPath(); mc.ellipse(puck_x,puck_y+8,4,2,0,0,Math.PI*2); mc.fill();

  // Goal flash
  if(ms<400||ms>4000) {
    mc.fillStyle='rgba(255,200,0,.4)';
    mc.fillRect(2,H*0.35,6,H*0.3);
  }

  drawSportScore(mc,W,'HOCKEY','2','1','#c02020','#2060c0');
  if(ms<600) drawStatusBadge(mc,W,H,'GOAL! 🏒','#f0d020');
}

// ── F1 RACING ────────────────────────────────────────────────────────────
function drawF1(mc, W, H, t) {
  const ms = t % 3000;
  const spd = ms/3000;

  // Tarmac track
  pixelRect(mc,0,0,W,H,'#1a1a1a');
  // Track surface (oval layout)
  mc.fillStyle='#303030';
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.4,H*0.35,0,0,Math.PI*2); mc.fill();
  mc.fillStyle='#1a1a1a';
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.25,H*0.2,0,0,Math.PI*2); mc.fill();
  // White lines
  mc.strokeStyle='rgba(255,255,255,.15)'; mc.lineWidth=1;
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.37,H*0.32,0,0,Math.PI*2); mc.stroke();
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.43,H*0.38,0,0,Math.PI*2); mc.stroke();

  // Cars on track
  const a1 = spd*Math.PI*2;
  const a2 = a1 + 0.4;
  const a3 = a1 - 0.6;
  drawF1Car(mc, W/2+Math.cos(a1)*W*0.4, H/2+Math.sin(a1)*H*0.35, a1, '#e02020');
  drawF1Car(mc, W/2+Math.cos(a2)*W*0.4, H/2+Math.sin(a2)*H*0.35, a2, '#1060c0');
  drawF1Car(mc, W/2+Math.cos(a3)*W*0.4, H/2+Math.sin(a3)*H*0.35, a3, '#f0d020');

  // Exhaust particles from lead car
  for(let i=0;i<4;i++){
    const pa=a1-0.05-i*0.04;
    const px=W/2+Math.cos(pa)*W*0.4-Math.cos(a1)*6-Math.cos(a1)*i*3;
    const py=H/2+Math.sin(pa)*H*0.35-Math.sin(a1)*6;
    const alpha=1-i/4;
    mc.fillStyle=`rgba(200,100,20,${alpha*0.6})`;
    mc.beginPath(); mc.arc(px,py,1.5-i*0.2,0,Math.PI*2); mc.fill();
  }

  // Lap counter
  drawSportScore(mc,W,'F1 RACING','LAP 42/57','','#e02020','#1060c0');
  if(ms<500) drawStatusBadge(mc,W,H,'PIT STOP! 🏎','#f0d020');
}

function drawF1Car(mc,x,y,angle,col){
  mc.save(); mc.translate(x,y); mc.rotate(angle+Math.PI/2);
  mc.fillStyle=col;
  mc.fillRect(-2,-5,4,10);
  mc.fillStyle='#111';
  mc.fillRect(-4,-3,2,6); mc.fillRect(2,-3,2,6); // tyres
  mc.fillStyle='rgba(150,200,255,.7)';
  mc.fillRect(-1.5,-3,3,3); // cockpit
  mc.restore();
}

// ── HORSE RACING ─────────────────────────────────────────────────────────
function drawHorses(mc, W, H, t) {
  const ms = t % 5500;
  const p = ms/5500;

  // Track
  pixelRect(mc,0,0,W,H,'#90c050');
  // Dirt track strip
  mc.fillStyle='#c8882a';
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.45,H*0.38,0,0,Math.PI*2); mc.fill();
  mc.fillStyle='#90c050';
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.30,H*0.24,0,0,Math.PI*2); mc.fill();
  // Railings
  mc.strokeStyle='rgba(255,255,255,.4)'; mc.lineWidth=1;
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.47,H*0.40,0,0,Math.PI*2); mc.stroke();
  mc.beginPath(); mc.ellipse(W/2,H/2,W*0.43,H*0.36,0,0,Math.PI*2); mc.stroke();

  // Horses — 3 at different positions
  const angles=[p*Math.PI*2, p*Math.PI*2+0.5, p*Math.PI*2-0.5];
  const cols=['#e02020','#2060c0','#f0c030'];
  for(let i=0;i<3;i++){
    const hx=W/2+Math.cos(angles[i])*W*0.43;
    const hy=H/2+Math.sin(angles[i])*H*0.37;
    drawPixelHorse(mc,hx,hy,angles[i],cols[i]);
  }

  // Finish line
  mc.strokeStyle='rgba(255,255,255,.7)'; mc.lineWidth=1.5; mc.setLineDash([2,2]);
  const fx=W/2, fy1=H/2-H*0.4, fy2=H/2-H*0.24;
  mc.beginPath(); mc.moveTo(fx,fy1); mc.lineTo(fx,fy2); mc.stroke();
  mc.setLineDash([]);

  drawSportScore(mc,W,'HORSE RACING','#3 AHEAD','','#e02020','#2060c0');
  if(ms<700) drawStatusBadge(mc,W,H,"AND THEY'RE OFF! 🏇",'#f0d020');
}

function drawPixelHorse(mc,x,y,angle,col){
  mc.save(); mc.translate(x,y); mc.rotate(angle+Math.PI/2);
  const t2=Date.now();
  const gallop=Math.sin(t2/80)*2;
  // Body
  mc.fillStyle='#8b5a2b';
  mc.fillRect(-3,-2,9,5);
  // Neck + head
  mc.fillRect(3,-5,4,4);
  mc.fillRect(5,-7,3,3);
  // Jockey
  mc.fillStyle=col; mc.fillRect(1,-6,4,4);
  mc.fillStyle='#f0c890'; mc.fillRect(2,-9,3,3);
  // Legs (animated)
  mc.fillStyle='#6b4020';
  mc.fillRect(-2,3,2,3+gallop);
  mc.fillRect(1,3,2,3-gallop);
  mc.fillRect(4,3,2,3+gallop);
  mc.fillRect(7,3,2,3-gallop);
  mc.restore();
}

// ── Shared player pixel-art ────────────────────────────────────────────────
function drawPixelPlayer(mc,x,y,uniformCol,skinCol){
  mc.fillStyle=skinCol; mc.fillRect(x-2,y-8,5,4);  // head
  mc.fillStyle=uniformCol; mc.fillRect(x-3,y-4,7,5);  // torso
  mc.fillStyle='#1a1a2a'; mc.fillRect(x-3,y+1,3,4); mc.fillRect(x+1,y+1,3,4); // legs
}

// ── Score overlay ──────────────────────────────────────────────────────────
function drawSportScore(mc,W,sport,score1,score2,col1,col2){
  mc.fillStyle='rgba(0,0,0,.65)'; mc.fillRect(0,0,W,11);
  mc.font='bold 6px monospace'; mc.textBaseline='middle';
  mc.fillStyle='rgba(255,255,255,.5)'; mc.textAlign='left';
  mc.fillText(sport,2,5.5);
  if(score2){
    mc.fillStyle=col1; mc.textAlign='center'; mc.fillText(score1,W*.65,5.5);
    mc.fillStyle='rgba(255,255,255,.4)'; mc.fillText('-',W*.75,5.5);
    mc.fillStyle=col2; mc.fillText(score2,W*.85,5.5);
  } else {
    mc.fillStyle=col1; mc.textAlign='right'; mc.fillText(score1,W-2,5.5);
  }
}

function drawStatusBadge(mc,W,H,text,col){
  const tw=text.length*5.5+10;
  mc.fillStyle='rgba(0,0,0,.7)'; mc.fillRect(W/2-tw/2,H/2-8,tw,16);
  mc.fillStyle=col; mc.font='bold 7px monospace'; mc.textAlign='center'; mc.textBaseline='middle';
  mc.fillText(text,W/2,H/2);
}

// ── Sport cycle for a given machine ───────────────────────────────────────
function getSportForMachine(m){
  if(!m._sportIndex) m._sportIndex=Math.floor(Math.random()*SPORT_KEYS.length);
  // Rotate sport every ~30 seconds
  if(!m._sportRotTimer) m._sportRotTimer=0;
  m._sportRotTimer+=16; // ~60fps increment
  if(m._sportRotTimer>30000){ m._sportRotTimer=0; m._sportIndex=(m._sportIndex+1)%SPORT_KEYS.length; }
  return SPORT_KEYS[m._sportIndex];
}

// ── Draw sport into sportsbook tile sprite ────────────────────────────────
function drawSportsbookSprite(m,def,x,y,w,h) {
  const t=Date.now();
  const sport=getSportForMachine(m);

  // Outer cabinet
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#062810'); g.addColorStop(1,'#030e06');
  ctx.fillStyle=g; prect(x+1,y+1,w-2,h-2,4); ctx.fill();
  ctx.strokeStyle='rgba(60,200,80,.25)'; ctx.lineWidth=1;
  prect(x+1,y+1,w-2,h-2,4); ctx.stroke();

  // Screen area (live sport animation)
  const sx2=x+4, sy2=y+4, sw=w-8, sh=h-16;
  ctx.save();
  ctx.beginPath(); prect(sx2,sy2,sw,sh,3); ctx.clip();
  // Draw sport directly into clipped screen area
  ctx.translate(sx2,sy2);
  SPORT_ANIM[sport](ctx,sw,sh,t);
  ctx.translate(-sx2,-sy2);
  ctx.restore();
  // Screen border
  ctx.strokeStyle='rgba(60,200,80,.3)'; ctx.lineWidth=.5; ctx.strokeRect(sx2,sy2,sw,sh);

  // Bottom strip
  ctx.fillStyle='#102818'; ctx.fillRect(x+2,y+h-14,w-4,12);
  ctx.fillStyle='rgba(60,200,80,.5)'; ctx.font='bold 5px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('SPORTSBOOK',x+w/2,y+h-8);

  // Pulsing patron count
  if(m._nearPatrons>0) {
    ctx.fillStyle='rgba(60,200,80,.7)'; ctx.font='5px monospace';
    ctx.textAlign='right'; ctx.fillText(m._nearPatrons+'👤',x+w-3,y+h-8);
  }
}

// ── Sportsbook surveillance cam full-sport view ───────────────────────────
function drawSportsbookSurvView(mc, m, W, H){
  const sport=getSportForMachine(m);
  mc.fillStyle='#060c04'; mc.fillRect(0,0,W,H);
  // Draw sport fullscreen
  SPORT_ANIM[sport](mc,W,H,Date.now());
  // Scanlines
  mc.fillStyle='rgba(0,0,0,.18)';
  for(let y=0;y<H;y+=2) mc.fillRect(0,y,W,1);
  // Sport label
  mc.fillStyle='rgba(0,200,80,.6)'; mc.font='bold 6px monospace';
  mc.textAlign='left'; mc.textBaseline='bottom';
  mc.fillText(sport.toUpperCase()+' LIVE',3,H-2);
  mc.fillStyle='rgba(0,200,80,.4)'; mc.font='5px monospace';
  mc.textAlign='right';
  mc.fillText('CAM '+m.id,W-2,H-2);
}
