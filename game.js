// NEON DASH — a tiny neon arcade game built from ONE prompt.
// Steer the ship, dodge asteroids, collect stars. Mouse / arrows / WASD.
// ?demo=1 turns on the autopilot: the ship plays itself (used for the video clip).
(() => {
  'use strict';

  const W = 1920, H = 1080;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const DEMO = new URLSearchParams(location.search).get('demo') === '1';

  // ---------- state ----------
  let state = 'title'; // title | play | over
  let titleT = 0;
  let score = 0, best = 0, combo = 0, comboTimer = 0;
  let elapsed = 0, level = 1, shake = 0, flash = 0;
  let shield = 0, shieldTimer = 0;
  let spawnAst = 0, spawnStar = 0, spawnShield = 0;
  let asteroids = [], stars = [], particles = [], pickups = [];
  let overT = 0, runId = 0;
  try { best = parseInt(localStorage.getItem('neon-dash-best') || '0', 10) || 0; } catch (e) {}

  const ship = { x: W / 2, y: H * 0.72, vx: 0, vy: 0, r: 20, tilt: 0, alive: true };
  const keys = {};
  const mouse = { x: W / 2, y: H * 0.72, active: false };

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.3, 1) * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.9), max: 0.9, color, r: rand(2, 5) });
    }
  }

  function makeAsteroid() {
    const r = rand(26, 62);
    const verts = [];
    const n = 9 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      verts.push({ a, d: r * rand(0.72, 1.15) });
    }
    return {
      x: rand(60, W - 60), y: -80, r,
      vy: rand(140, 230) * (1 + level * 0.08),
      vx: rand(-40, 40), rot: rand(0, Math.PI * 2), vr: rand(-1.4, 1.4),
      verts, hue: Math.random() < 0.5 ? '255,90,60' : '255,170,60'
    };
  }

  function makeStar() {
    return { x: rand(60, W - 60), y: -40, r: 16, vy: rand(170, 240), rot: 0, vr: rand(1.5, 3), pulse: rand(0, Math.PI * 2) };
  }

  function makeShieldPickup() {
    return { x: rand(80, W - 80), y: -40, r: 22, vy: 200, rot: 0, vr: 2 };
  }

  // ---------- starfield ----------
  const stars3 = [];
  for (let i = 0; i < 170; i++) {
    stars3.push({ x: Math.random() * W, y: Math.random() * H, z: rand(0.25, 1), r: rand(0.6, 2.4) });
  }
  const nebulae = [
    { x: 320, y: 260, r: 520, c: '190,40,160' },
    { x: 1650, y: 780, r: 620, c: '20,120,200' },
    { x: 1050, y: 120, r: 420, c: '120,20,180' },
  ];

  // ---------- input ----------
  addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if ((e.key === 'r' || e.key === 'R') && state === 'over') startRun();
    if (e.key === ' ' && state !== 'play') startRun();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width * W;
    mouse.y = (e.clientY - rect.top) / rect.height * H;
    mouse.active = true;
  });
  canvas.addEventListener('mousedown', () => { if (state !== 'play') startRun(); });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouse.x = (t.clientX - rect.left) / rect.width * W;
    mouse.y = (t.clientY - rect.top) / rect.height * H;
    mouse.active = true;
    e.preventDefault();
  }, { passive: false });

  // ---------- flow ----------
  function startRun() {
    runId++;
    state = 'play';
    score = 0; combo = 0; comboTimer = 0;
    elapsed = 0; level = 1; shake = 0; flash = 0;
    shield = 0; shieldTimer = 0;
    asteroids = []; stars = []; particles = []; pickups = [];
    spawnAst = 0.4; spawnStar = 0.6; spawnShield = 14;
    ship.x = W / 2; ship.y = H * 0.72; ship.vx = 0; ship.vy = 0; ship.alive = true;
  }

  function gameOver() {
    state = 'over';
    overT = 0;
    ship.alive = false;
    burst(ship.x, ship.y, '0,240,255', 60, 520);
    burst(ship.x, ship.y, '255,60,180', 40, 380);
    shake = 26; flash = 0.7;
    if (score > best) {
      best = score;
      try { localStorage.setItem('neon-dash-best', String(best)); } catch (e) {}
    }
  }

  // ---------- autopilot (demo mode) ----------
  function autopilot(dt) {
    // Threat: an asteroid actually on a collision course — falling toward the
    // ship's lane and close enough to matter. Anything else is ignored so the
    // ship chases stars instead of dodging shadows.
    let threat = null, threatGap = 1e9;
    for (const a of asteroids) {
      if (a.y > ship.y + 40) continue; // already passed
      const gapY = ship.y - a.y;
      if (gapY > 560) continue; // too far away to matter yet
      const gapX = Math.abs(a.x - ship.x);
      if (gapX < a.r + ship.r + 34) {
        const score = gapX + gapY * 0.25;
        if (score < threatGap) { threatGap = score; threat = a; }
      }
    }
    // Target: nearest star, led slightly for its fall speed.
    let star = null, starD = 1e9;
    for (const s of stars) {
      const d = Math.abs(s.x - ship.x) + Math.abs(s.y - ship.y) * 0.5;
      if (d < starD) { starD = d; star = s; }
    }
    let tx = ship.x, ty = ship.y;
    if (threat) {
      // Dodge sideways, away from the asteroid, toward the clearer side.
      const dir = threat.x >= ship.x ? -1 : 1;
      tx = clamp(ship.x + dir * 260, 70, W - 70);
      ty = clamp(ship.y, H * 0.3, H * 0.86);
    } else if (star) {
      tx = clamp(star.x, 70, W - 70);
      ty = clamp(star.y + star.vy * 0.25, H * 0.3, H * 0.86);
    } else {
      tx = W / 2; ty = H * 0.7;
    }
    // Steer by velocity, not by spring: desired velocity toward the target,
    // approached with a first-order lag. Stable at any frame rate (the old
    // spring gained per-frame and oscillated when headless rendering ran slow).
    const k = Math.min(1, dt * 10);
    const dvx = clamp((tx - ship.x) * 4, -900, 900);
    const dvy = clamp((ty - ship.y) * 4, -900, 900);
    ship.vx += (dvx - ship.vx) * k;
    ship.vy += (dvy - ship.vy) * k;
  }

  // ---------- update ----------
  function update(dt) {
    titleT += dt;
    if (state === 'title') {
      if (DEMO && titleT > 0.9) startRun();
      return;
    }
    if (state === 'over') {
      overT += dt;
      if (DEMO && overT > 2.2) startRun();
      updateParticles(dt);
      return;
    }

    elapsed += dt;
    level = 1 + Math.floor(elapsed / 12);
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    if (shieldTimer > 0) { shieldTimer -= dt; if (shieldTimer <= 0) shield = 0; }
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);

    // steering
    if (DEMO) {
      autopilot(dt);
    } else {
      const accel = 2600;
      if (keys['arrowleft'] || keys['a']) ship.vx -= accel * dt;
      if (keys['arrowright'] || keys['d']) ship.vx += accel * dt;
      if (keys['arrowup'] || keys['w']) ship.vy -= accel * dt;
      if (keys['arrowdown'] || keys['s']) ship.vy += accel * dt;
      if (mouse.active) {
        const dx = mouse.x - ship.x, dy = mouse.y - ship.y;
        ship.vx += dx * 10 * dt;
        ship.vy += dy * 10 * dt;
      }
    }
    ship.vx *= Math.pow(0.12, dt);
    ship.vy *= Math.pow(0.12, dt);
    const sp = Math.hypot(ship.vx, ship.vy), maxSp = 900;
    if (sp > maxSp) { ship.vx *= maxSp / sp; ship.vy *= maxSp / sp; }
    ship.x = clamp(ship.x + ship.vx * dt, 40, W - 40);
    ship.y = clamp(ship.y + ship.vy * dt, H * 0.22, H - 50);
    ship.tilt = clamp(ship.vx / 900, -1, 1) * 0.45;

    // engine trail
    if (Math.random() < 0.85) {
      particles.push({
        x: ship.x - Math.sin(ship.tilt) * 10 + rand(-4, 4),
        y: ship.y + 22, vx: rand(-25, 25), vy: rand(120, 220),
        life: rand(0.2, 0.45), max: 0.45, color: Math.random() < 0.5 ? '0,240,255' : '255,60,180', r: rand(2, 4.5)
      });
    }

    // spawning
    spawnAst -= dt;
    if (spawnAst <= 0) {
      asteroids.push(makeAsteroid());
      spawnAst = Math.max(0.38, 0.85 - level * 0.05) * rand(0.8, 1.25);
    }
    spawnStar -= dt;
    if (spawnStar <= 0) {
      stars.push(makeStar());
      spawnStar = rand(0.9, 1.6);
    }
    spawnShield -= dt;
    if (spawnShield <= 0) {
      pickups.push(makeShieldPickup());
      spawnShield = rand(15, 22);
    }

    // asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.y += a.vy * dt; a.x += a.vx * dt; a.rot += a.vr * dt;
      if (a.y > H + 100) { asteroids.splice(i, 1); continue; }
      if (dist2(a.x, a.y, ship.x, ship.y) < (a.r * 0.82 + ship.r) * (a.r * 0.82 + ship.r)) {
        asteroids.splice(i, 1);
        if (shield > 0) {
          shield = 0; shieldTimer = 0;
          burst(ship.x, ship.y, '120,255,140', 40, 420);
          shake = 14; flash = 0.35;
        } else {
          burst(ship.x, ship.y, '255,90,60', 50, 480);
          gameOver();
          return;
        }
      }
    }

    // stars
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.y += s.vy * dt; s.rot += s.vr * dt; s.pulse += dt * 6;
      if (s.y > H + 60) { stars.splice(i, 1); continue; }
      if (dist2(s.x, s.y, ship.x, ship.y) < (s.r + ship.r + 26) * (s.r + ship.r + 26)) {
        stars.splice(i, 1);
        combo++;
        comboTimer = 3;
        score += 10 * combo;
        burst(s.x, s.y, '255,220,90', 16, 260);
      }
    }

    // shield pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > H + 60) { pickups.splice(i, 1); continue; }
      if (dist2(p.x, p.y, ship.x, ship.y) < (p.r + ship.r + 6) * (p.r + ship.r + 6)) {
        pickups.splice(i, 1);
        shield = 1; shieldTimer = 12;
        burst(p.x, p.y, '120,255,140', 26, 320);
      }
    }

    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.4, dt); p.vy *= Math.pow(0.4, dt);
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------- draw ----------
  function drawStarfield(dt) {
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `rgba(${n.c},0.20)`);
      g.addColorStop(1, `rgba(${n.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (const s of stars3) {
      s.y += 26 * s.z * dt;
      if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      ctx.globalAlpha = 0.35 + 0.65 * s.z;
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShip() {
    if (!ship.alive) return;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.tilt);
    // glow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 28;
    // flame
    const fl = 26 + Math.sin(titleT * 40) * 8 + Math.hypot(ship.vx, ship.vy) * 0.02;
    const fg = ctx.createLinearGradient(0, 16, 0, 16 + fl);
    fg.addColorStop(0, 'rgba(255,180,60,0.95)');
    fg.addColorStop(1, 'rgba(255,60,180,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-9, 16); ctx.lineTo(0, 16 + fl); ctx.lineTo(9, 16);
    ctx.closePath(); ctx.fill();
    // hull
    const hg = ctx.createLinearGradient(0, -26, 0, 20);
    hg.addColorStop(0, '#8ef6ff');
    hg.addColorStop(0.55, '#00c8ff');
    hg.addColorStop(1, '#ff3cb4');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(0, -28); ctx.lineTo(17, 14); ctx.lineTo(7, 20); ctx.lineTo(0, 13); ctx.lineTo(-7, 20); ctx.lineTo(-17, 14);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // cockpit
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, -6, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // shield ring
    if (shield > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(120,255,140,${0.5 + 0.3 * Math.sin(titleT * 8)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#78ff8c';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(ship.x, ship.y, 44, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.shadowColor = `rgba(${a.hue},0.9)`;
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(30,8,20,0.9)';
    ctx.strokeStyle = `rgba(${a.hue},1)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    a.verts.forEach((v, i) => {
      const x = Math.cos(v.a) * v.d, y = Math.sin(v.a) * v.d;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(${a.hue},0.55)`;
    ctx.beginPath(); ctx.arc(-a.r * 0.25, -a.r * 0.2, a.r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(a.r * 0.3, a.r * 0.28, a.r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawStar(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    const pulse = 0.75 + 0.25 * Math.sin(s.pulse);
    ctx.shadowColor = '#ffd95a';
    ctx.shadowBlur = 24 * pulse;
    ctx.fillStyle = '#ffe27a';
    const R = s.r * pulse, r = R * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawShieldPickup(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.shadowColor = '#78ff8c';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#78ff8c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c8ffd2';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 0, 1);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = `rgb(${p.color})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 16;
    ctx.fillText('SCORE ' + score, 48, 84);
    ctx.font = 'bold 30px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(207,232,255,0.85)';
    ctx.shadowBlur = 0;
    ctx.fillText('BEST ' + best, 48, 128);
    // combo
    if (combo >= 2) {
      ctx.fillStyle = '#ffd95a';
      ctx.font = 'bold 44px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffd95a';
      ctx.shadowBlur = 18;
      ctx.fillText('COMBO x' + combo, W / 2, 84);
    }
    // level + time
    ctx.fillStyle = 'rgba(207,232,255,0.9)';
    ctx.font = 'bold 30px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.shadowBlur = 0;
    ctx.fillText('LEVEL ' + level + '  ·  ' + Math.floor(elapsed) + 's', W - 48, 84);
    ctx.fillText(shield > 0 ? 'SHIELD ' + Math.ceil(shieldTimer) + 's' : 'NO SHIELD', W - 48, 128);
    ctx.restore();
  }

  function drawTitle() {
    ctx.save();
    ctx.textAlign = 'center';
    const bob = Math.sin(titleT * 2) * 10;
    ctx.shadowColor = '#ff3cb4';
    ctx.shadowBlur = 42;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 150px "JetBrains Mono", monospace';
    ctx.fillText('NEON DASH', W / 2, 420 + bob);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#8ef6ff';
    ctx.font = 'bold 40px "JetBrains Mono", monospace';
    ctx.fillText('ONE PROMPT  ·  BUILT BY AN AI AGENT', W / 2, 500 + bob);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(207,232,255,0.9)';
    ctx.font = '32px "JetBrains Mono", monospace';
    const blink = Math.sin(titleT * 4) > 0;
    if (blink) ctx.fillText(DEMO ? 'AUTOPILOT ENGAGED — WATCH IT PLAY' : 'CLICK OR PRESS SPACE TO PLAY', W / 2, 640);
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(5,1,13,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3c3c';
    ctx.shadowBlur = 36;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px "JetBrains Mono", monospace';
    ctx.fillText('GAME OVER', W / 2, 440);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd95a';
    ctx.font = 'bold 64px "JetBrains Mono", monospace';
    ctx.fillText('SCORE ' + score + (score >= best && score > 0 ? '  ·  NEW BEST!' : ''), W / 2, 540);
    ctx.fillStyle = 'rgba(207,232,255,0.9)';
    ctx.font = '32px "JetBrains Mono", monospace';
    if (Math.sin(titleT * 4) > 0) ctx.fillText(DEMO ? 'RESTARTING…' : 'PRESS R OR CLICK TO RESTART', W / 2, 640);
    ctx.restore();
  }

  function draw(dt) {
    ctx.save();
    if (shake > 0) {
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
    }
    drawStarfield(dt);
    for (const s of stars) drawStar(s);
    for (const p of pickups) drawShieldPickup(p);
    for (const a of asteroids) drawAsteroid(a);
    drawShip();
    drawParticles();
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,60,60,${flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'title') drawTitle();
    if (state === 'play' || state === 'over') drawHUD();
    if (state === 'over') drawGameOver();
  }

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose a tiny probe API for the video recorder.
  window.__neonDash = {
    get state() { return state; },
    get score() { return score; },
    get elapsed() { return elapsed; },
    start: startRun
  };
})();
