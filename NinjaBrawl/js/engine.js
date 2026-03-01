/* ============================================================
   engine.js — Physics + Rendering Engine
   ============================================================ */

const GameEngine = (() => {

  // ── Canvas Setup ─────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, S;

  // ── Responsive scale ── reference: 1200×700 desktop
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    S = Math.min(W / 1200, H / 700);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── State ────────────────────────────────────────────────
  let running  = false;
  let paused   = false;
  let animId   = null;
  let lastTs   = 0;

  // Entity lists
  let bullets   = [];
  let particles = [];
  let obstacles = [];

  // ── Arena margins (responsive) ────────────────────────────
  function margin() {
    return {
      top:    Math.round(40 * S + 20),
      bottom: Math.round(40 * S + 20),
      side:   Math.round(10 * S + 6),
    };
  }

  // ── Obstacle Colors ─────────────────────────────────────
  const OBS_PALETTES = [
    { top: '#2a1a3e', bot: '#1a0f28', border: 'rgba(180,80,255,0.35)', glow: 'rgba(140,60,220,0.25)', accent: '#b050ff' },  // purple
    { top: '#1a2e3e', bot: '#0f1a28', border: 'rgba(60,180,255,0.35)',  glow: 'rgba(40,140,220,0.25)', accent: '#3cb4ff' },  // blue
    { top: '#3e2a1a', bot: '#281a0f', border: 'rgba(255,140,40,0.35)',  glow: 'rgba(220,100,20,0.25)', accent: '#ff8c28' },  // orange
    { top: '#1a3e2a', bot: '#0f281a', border: 'rgba(40,255,140,0.35)',  glow: 'rgba(20,200,100,0.25)', accent: '#28ff8c' },  // green
    { top: '#3e1a2a', bot: '#280f1a', border: 'rgba(255,60,120,0.35)',  glow: 'rgba(220,40,80,0.25)',  accent: '#ff3c78' },  // pink
    { top: '#3e3a1a', bot: '#28250f', border: 'rgba(255,220,40,0.35)',  glow: 'rgba(220,180,20,0.25)', accent: '#ffdc28' },  // yellow
  ];

  // ── Obstacle Generation ──────────────────────────────────
  function generateObstacles() {
    obstacles = [];
    const m = margin();
    const count = S < 0.6 ? 4 + Math.floor(Math.random() * 3) : 7 + Math.floor(Math.random() * 4);

    // Center cross obstacle (always)
    const cw = Math.round(30 * S);
    const ch = Math.round(120 * S);
    obstacles.push({
      x: W / 2 - cw / 2, y: H / 2 - ch / 2,
      w: cw, h: ch,
      type: 'center',
      palette: OBS_PALETTES[0],
    });

    // Random obstacles
    for (let i = 0; i < count; i++) {
      const w = Math.round((35 + Math.random() * 75) * S);
      const h = Math.round((25 + Math.random() * 50) * S);
      const areaW = W - m.side * 2 - w;
      const areaH = H - m.top - m.bottom - h;
      if (areaW < 10 || areaH < 10) continue;
      obstacles.push({
        x: m.side + Math.random() * areaW,
        y: m.top  + Math.random() * areaH,
        w, h,
        type: 'random',
        palette: OBS_PALETTES[Math.floor(Math.random() * OBS_PALETTES.length)],
      });
    }
    return obstacles;
  }

  // ── Physics Helpers ──────────────────────────────────────
  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function clampToArena(entity) {
    const mg = margin();
    entity.x = Math.max(mg.side + entity.r, Math.min(W - mg.side - entity.r, entity.x));
    entity.y = Math.max(mg.top + entity.r,  Math.min(H - mg.bottom - entity.r, entity.y));
  }

  function resolveObstacles(entity) {
    for (const o of obstacles) {
      const cx = Math.max(o.x, Math.min(entity.x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(entity.y, o.y + o.h));
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < entity.r && d > 0) {
        const overlap = entity.r - d;
        entity.x += (dx / d) * overlap;
        entity.y += (dy / d) * overlap;
        // Dampen velocity on collision
        if (entity.vx !== undefined) {
          entity.vx *= 0.3;
          entity.vy *= 0.3;
        }
      }
    }
  }

  // ── Spawn Bullet ─────────────────────────────────────────
  function spawnBullet(from, targetX, targetY, owner, opts = {}) {
    const angle  = Math.atan2(targetY - from.y, targetX - from.x);
    const spread = opts.spread || 0;
    const spd    = opts.speed  || 390;

    bullets.push({
      x:     from.x + Math.cos(angle) * (from.r + 7),
      y:     from.y + Math.sin(angle) * (from.r + 7),
      vx:    Math.cos(angle + spread) * spd,
      vy:    Math.sin(angle + spread) * spd,
      r:     opts.r     || 5,
      dmg:   opts.dmg   || 10,
      color: opts.color || '#00ffcc',
      owner,
      life:  opts.life  || 1.0,
      trail: [],
    });
  }

  // ── Spawn Particles ──────────────────────────────────────
  function spawnParticles(x, y, color, count = 8, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (opts.angle !== undefined)
        ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI * 2)
        : Math.random() * Math.PI * 2;
      const spd = (opts.minSpd || 60) + Math.random() * (opts.maxSpd || 160);
      particles.push({
        x, y,
        vx:      Math.cos(angle) * spd,
        vy:      Math.sin(angle) * spd,
        r:       (opts.minR || 2) + Math.random() * (opts.maxR || 4),
        color,
        life:    0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        gravity: opts.gravity || 0,
      });
    }
  }

  // ── Update Bullets ───────────────────────────────────────
  function updateBullets(dt, onHit) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];

      // Save trail point
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 5) b.trail.shift();

      b.x    += b.vx * dt;
      b.y    += b.vy * dt;
      b.life -= dt;

      // Wall hit
      const mg = margin();
      if (b.x < mg.side || b.x > W - mg.side || b.y < mg.top || b.y > H - mg.bottom) {
        if (b.bounce) {
          // Bounce off wall
          if (b.x < mg.side || b.x > W - mg.side) b.vx *= -1;
          if (b.y < mg.top  || b.y > H - mg.bottom) b.vy *= -1;
          b.x = Math.max(mg.side, Math.min(W - mg.side, b.x));
          b.y = Math.max(mg.top,  Math.min(H - mg.bottom, b.y));
          spawnParticles(b.x, b.y, b.color, 2, { minSpd: 15, maxSpd: 40, minR: 1, maxR: 2 });
        } else {
          spawnParticles(b.x, b.y, b.color, 3, { minSpd: 20, maxSpd: 60, minR: 1, maxR: 2 });
          bullets.splice(i, 1);
          continue;
        }
      }

      // Obstacle hit
      let hitObs = false;
      for (const o of obstacles) {
        if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
          if (b.bounce) {
            // Bounce off obstacle — determine which side was hit
            const fromLeft  = b.x - o.x;
            const fromRight = (o.x + o.w) - b.x;
            const fromTop   = b.y - o.y;
            const fromBot   = (o.y + o.h) - b.y;
            const minH = Math.min(fromLeft, fromRight);
            const minV = Math.min(fromTop, fromBot);
            if (minH < minV) { b.vx *= -1; b.x += b.vx > 0 ? 2 : -2; }
            else              { b.vy *= -1; b.y += b.vy > 0 ? 2 : -2; }
            spawnParticles(b.x, b.y, b.color, 2, { minSpd: 15, maxSpd: 40, minR: 1, maxR: 2 });
          } else {
            spawnParticles(b.x, b.y, '#888', 3, { minSpd: 20, maxSpd: 70, minR: 1, maxR: 2 });
            hitObs = true;
          }
          break;
        }
      }
      if (hitObs) {
        bullets.splice(i, 1);
        continue;
      }

      if (b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }

      // Hit callback
      if (onHit) onHit(b, i);
    }
  }

  // ── Update Particles ─────────────────────────────────────
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += p.gravity * dt;
      p.vx   *= 0.88;
      p.vy   *= 0.88;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ── Draw: Background ─────────────────────────────────────
  function drawBackground() {
    // Base fill
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    // Subtle radial vignette
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
    vig.addColorStop(0, 'rgba(0,20,15,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,255,204,0.032)';
    ctx.lineWidth   = 1;
    const gs = 48;
    for (let x = 0; x < W; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Arena border glow (animated)
    const mg = margin();
    const borderHue = (Date.now() * 0.02) % 360;
    const borderColor = `hsla(${borderHue}, 100%, 70%, 0.15)`;
    const borderGlow  = `hsla(${borderHue}, 100%, 60%, 0.25)`;

    ctx.shadowBlur  = 10;
    ctx.shadowColor = borderGlow;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth   = 2;
    ctx.strokeRect(mg.side, mg.top, W - mg.side * 2, H - mg.top - mg.bottom);
    ctx.shadowBlur  = 0;

    // Corner accents (colored)
    const cSize = Math.round(18 * S);
    const cornerColors = ['#00ffcc', '#ff3355', '#ffd700', '#b050ff'];
    const corners = [
      [mg.side, mg.top], [W - mg.side, mg.top], [mg.side, H - mg.bottom], [W - mg.side, H - mg.bottom]
    ];
    for (let ci = 0; ci < corners.length; ci++) {
      const [cx, cy] = corners[ci];
      const cc = cornerColors[ci];
      const sx = cx === mg.side ? 1 : -1;
      const sy = cy === mg.top  ? 1 : -1;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = cc;
      ctx.strokeStyle = cc + '88';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * cSize);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * cSize, cy);
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }
  }

  // ── Draw: Obstacles ──────────────────────────────────────
  function drawObstacles() {
    for (const o of obstacles) {
      const p = o.palette || OBS_PALETTES[0];

      // Shadow
      ctx.shadowBlur  = 12;
      ctx.shadowColor = p.glow;
      ctx.fillStyle   = 'rgba(0,0,0,0.6)';
      ctx.fillRect(o.x + 3, o.y + 3, o.w, o.h);
      ctx.shadowBlur  = 0;

      // Body gradient
      const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
      grad.addColorStop(0, p.top);
      grad.addColorStop(1, p.bot);
      ctx.fillStyle = grad;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      // Inner glow
      const innerGlow = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y);
      innerGlow.addColorStop(0, p.glow);
      innerGlow.addColorStop(0.5, 'transparent');
      innerGlow.addColorStop(1, p.glow);
      ctx.fillStyle = innerGlow;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      // Glowing border
      ctx.shadowBlur  = 6;
      ctx.shadowColor = p.glow;
      ctx.strokeStyle = p.border;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.shadowBlur  = 0;

      // Scanlines with color
      const scanAlpha = p.accent + '08';
      ctx.fillStyle = scanAlpha;
      for (let ly = o.y + 5; ly < o.y + o.h; ly += 6) {
        ctx.fillRect(o.x + 1, ly, o.w - 2, 2);
      }

      // Top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(o.x, o.y, o.w, 2);

      // Corner dots
      const dotR = 2;
      ctx.fillStyle = p.border;
      ctx.beginPath(); ctx.arc(o.x + 4, o.y + 4, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + o.w - 4, o.y + 4, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + 4, o.y + o.h - 4, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + o.w - 4, o.y + o.h - 4, dotR, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Draw: Bullets ────────────────────────────────────────
  function drawBullets() {
    ctx.save();
    for (const b of bullets) {
      // Trail
      if (b.trail.length > 1) {
        for (let t = 1; t < b.trail.length; t++) {
          const alpha = (t / b.trail.length) * 0.4;
          ctx.beginPath();
          ctx.moveTo(b.trail[t-1].x, b.trail[t-1].y);
          ctx.lineTo(b.trail[t].x,   b.trail[t].y);
          ctx.strokeStyle = b.color + Math.floor(alpha * 255).toString(16).padStart(2,'0');
          ctx.lineWidth   = b.r * 0.8;
          ctx.stroke();
        }
      }

      // Glow
      ctx.shadowBlur  = 14;
      ctx.shadowColor = b.color;

      // Bullet body
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();

      // White center
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Draw: Particles ──────────────────────────────────────
  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = 4;
      ctx.shadowColor = p.color;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ── Draw: Entity (ninja) ─────────────────────────────────
  function drawEntity(e, color, opts = {}) {
    const { x, y, r, angle, hp, maxHp } = e;

    // Invincibility flicker
    if (e.invincible > 0 && Math.floor(e.invincible * 12) % 2 === 0) return;

    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.0, r * 0.8, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // Melee range indicator
    if (opts.meleeFlash) {
      ctx.beginPath();
      ctx.arc(x, y, r + Math.round(77 * S), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,100,0,0.35)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.save();

    // ── Arms / weapon lines ──
    const armLen = r * 1.3;
    const armAngleL = angle + 0.5;
    const armAngleR = angle - 0.5;
    ctx.strokeStyle = color + '88';
    ctx.lineWidth   = Math.max(2, r * 0.2);
    ctx.lineCap     = 'round';
    // Left arm
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(armAngleL) * armLen, y + Math.sin(armAngleL) * armLen);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(armAngleR) * armLen, y + Math.sin(armAngleR) * armLen);
    ctx.stroke();

    // Weapon tip glow (on the forward arm)
    const weapX = x + Math.cos(angle) * (armLen + 2);
    const weapY = y + Math.sin(angle) * (armLen + 2);
    ctx.beginPath();
    ctx.arc(weapX, weapY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // ── Body ──
    ctx.shadowBlur  = opts.meleeFlash ? 28 : 18;
    ctx.shadowColor = opts.meleeFlash ? '#ff6600' : color;

    // Body gradient
    const grad = ctx.createRadialGradient(
      x - r * 0.25, y - r * 0.25, r * 0.1,
      x, y, r
    );
    grad.addColorStop(0, color + 'dd');
    grad.addColorStop(0.45, color + '88');
    grad.addColorStop(0.8, color + '33');
    grad.addColorStop(1, color + '11');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outer ring
    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Inner ring detail
    ctx.beginPath();
    ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = color + '22';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // ── Headband ──
    const hbPerp = angle + Math.PI / 2;
    const hbLen  = r * 0.85;
    const hbY    = y - r * 0.15;
    const hbX    = x;
    ctx.beginPath();
    ctx.moveTo(hbX - Math.cos(hbPerp) * hbLen, hbY - Math.sin(hbPerp) * hbLen);
    ctx.lineTo(hbX + Math.cos(hbPerp) * hbLen, hbY + Math.sin(hbPerp) * hbLen);
    ctx.strokeStyle = color;
    ctx.lineWidth   = Math.max(2.5, r * 0.18);
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Headband tail (flowing behind)
    const tailBaseX = x - Math.cos(angle) * r * 0.6;
    const tailBaseY = y - Math.sin(angle) * r * 0.6;
    const tailWave  = Math.sin(Date.now() * 0.006) * 4;
    ctx.beginPath();
    ctx.moveTo(tailBaseX + Math.cos(hbPerp) * r * 0.3, tailBaseY + Math.sin(hbPerp) * r * 0.3);
    ctx.quadraticCurveTo(
      tailBaseX - Math.cos(angle) * r * 0.8 + tailWave,
      tailBaseY - Math.sin(angle) * r * 0.8 + tailWave,
      tailBaseX - Math.cos(angle) * r * 1.2 + tailWave * 1.5,
      tailBaseY - Math.sin(angle) * r * 1.2 + tailWave * 1.5
    );
    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth   = Math.max(1.5, r * 0.1);
    ctx.stroke();

    // ── Eyes (two eyes) ──
    const eyeSpacing = r * 0.28;
    const eyeForward = r * 0.35;

    for (let side = -1; side <= 1; side += 2) {
      const ex = x + Math.cos(angle) * eyeForward + Math.cos(hbPerp) * eyeSpacing * side;
      const ey = y + Math.sin(angle) * eyeForward + Math.sin(hbPerp) * eyeSpacing * side;
      const eyeR = Math.max(2.5, r * 0.18);

      // Eye white
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth   = 0.5;
      ctx.stroke();

      // Pupil
      const pupR = eyeR * 0.55;
      ctx.beginPath();
      ctx.arc(
        ex + Math.cos(angle) * eyeR * 0.35,
        ey + Math.sin(angle) * eyeR * 0.35,
        pupR, 0, Math.PI * 2
      );
      ctx.fillStyle = '#111';
      ctx.fill();

      // Eye shine
      ctx.beginPath();
      ctx.arc(
        ex - Math.cos(angle) * eyeR * 0.15 + side * 0.5,
        ey - Math.sin(angle) * eyeR * 0.15 - 0.5,
        pupR * 0.45, 0, Math.PI * 2
      );
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    ctx.restore();

    // ── HP bar above entity ──
    const bw    = r * 2.8;
    const bx    = x - bw / 2;
    const by    = y - r - 16;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(bx - 1, by - 1, bw + 2, 7, 3);
    ctx.fill();

    // Fill
    const hpRatio = hp / maxHp;
    const hpColor = hpRatio > 0.5 ? color
                  : hpRatio > 0.25 ? '#ff9900'
                  : '#ff3333';

    // HP glow
    ctx.shadowBlur  = 4;
    ctx.shadowColor = hpColor;
    ctx.fillStyle   = hpColor;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * hpRatio, 5, 2);
    ctx.fill();
    ctx.shadowBlur  = 0;

    // HP bar shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * hpRatio, 2.5, 2);
    ctx.fill();
  }

  // ── Draw: Ultimate Flash ─────────────────────────────────
  function drawUltFlash(alpha) {
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Game Loop ────────────────────────────────────────────
  function startLoop(onFrame) {
    running = true;
    paused  = false;
    lastTs  = performance.now();

    const loop = (ts) => {
      if (!running || paused) return;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs   = ts;
      onFrame(dt, ctx, W, H);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(animId);
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    document.getElementById('pauseScreen').classList.toggle('hidden', !paused);
    if (!paused) {
      lastTs = performance.now();
      if (window._resumeGame) window._resumeGame();
    }
  }

  // ── Public API ───────────────────────────────────────────
  return {
    ctx, canvas,
    get W() { return W; },
    get H() { return H; },
    get S() { return S; },
    margin,
    get bullets()   { return bullets;   },
    get particles() { return particles; },
    get obstacles() { return obstacles; },
    set bullets(v)  { bullets = v; },

    resize,
    generateObstacles,
    dist,
    clampToArena,
    resolveObstacles,
    spawnBullet,
    spawnParticles,
    updateBullets,
    updateParticles,
    drawBackground,
    drawObstacles,
    drawBullets,
    drawParticles,
    drawEntity,
    drawUltFlash,
    startLoop,
    stopLoop,
    togglePause,
    isRunning: () => running,
    isPaused:  () => paused,
  };

})();