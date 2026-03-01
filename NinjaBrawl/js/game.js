/* ============================================================
   game.js — Main Game Controller
   ============================================================ */

// ── Mode Detection ───────────────────────────────────────────
const isMultiplayer = new URLSearchParams(window.location.search).get('mode') === 'pvp';

// ── Character Config ─────────────────────────────────────────
let charConfig = null; // set in init from PlayerProfile

// ── Player ───────────────────────────────────────────────────
const player = {
  x: 0, y: 0, r: 18,
  hp: 100, maxHp: 100,
  speed: 188,
  vx: 0, vy: 0,
  angle: 0,
  color: '#00ffcc',
  ammo:              3,
  maxAmmo:           3,
  ammoRechargeTimer: 0,
  ultCharge:     0,
  ultMax:        100,
  invincible:    0,
  ultFlash:      0,
};

let enemy = null;

// ── Game State ───────────────────────────────────────────────
let score      = 0;
let gameTime   = 60;
let killCount  = 0;
let bulletsHit = 0;
let shotsFired = 0;
let running    = false;
let countdownVal = 3;

// ── Controls ─────────────────────────────────────────────────
const joystick    = { active: false, dx: 0, dy: 0, id: null };
const aimJoystick = { active: false, dx: 0, dy: 0, id: null, shouldFire: false, fireAngle: null };
const keys        = { shoot: false, ult: false };

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Init Firebase (silent, for score sync)
  if (typeof FirebaseAuth !== 'undefined') FirebaseAuth.init();

  // Load selected character
  if (typeof PlayerProfile !== 'undefined') {
    PlayerProfile.load();
    charConfig = PlayerProfile.getSelectedChar();
  }
  if (!charConfig) {
    charConfig = { color: '#00ffcc', bulletColor: '#00ffcc', bulletBounce: false, bulletLife: 0.8, ultType: 'explosion' };
  }
  player.color = charConfig.color;

  setupControls();
  document.getElementById('playAgainBtn').onclick = () => {
    if (isMultiplayer) {
      window.location.href = 'game.html?mode=pvp';
    } else {
      startCountdown();
    }
  };

  if (isMultiplayer) {
    initMultiplayer();
  } else {
    startCountdown();
  }
});

// ══════════════════════════════════════════════════════════════
// MULTIPLAYER INIT
// ══════════════════════════════════════════════════════════════
function initMultiplayer() {
  const matchScreen = document.getElementById('matchmakingScreen');
  const matchStatus = document.getElementById('matchStatus');
  const matchDots   = document.getElementById('matchDots');

  matchScreen.classList.remove('hidden');
  matchStatus.textContent = I18n.t('connecting');
  matchDots.innerHTML = '<span></span><span></span><span></span>';

  // ── Socket event handlers ──────────────────────────────
  SocketClient.on('waiting', () => {
    matchStatus.textContent = I18n.t('searching');
  });

  SocketClient.on('matched', () => {
    matchStatus.textContent = I18n.t('opponent_found');
    matchDots.innerHTML = '';
    setTimeout(() => {
      matchScreen.classList.add('hidden');
      startCountdown();
    }, 1000);
  });

  SocketClient.on('enemyState', (data) => {
    if (enemy && isMultiplayer && running) {
      enemy.x  = data.x;
      enemy.y  = data.y;
      enemy.vx = data.vx || 0;
      enemy.vy = data.vy || 0;
      enemy.angle       = data.angle;
    }
  });

  SocketClient.on('enemyShoot', (data) => {
    if (!running) return;
    // Spawn enemy bullet locally
    GameEngine.bullets.push({
      x:     data.x,
      y:     data.y,
      vx:    data.vx,
      vy:    data.vy,
      r:     data.r    || 5,
      dmg:   data.dmg  || 10,
      color: '#ff3355',
      owner: 'enemy',
      life:  data.life || 1.5,
      trail: [],
    });
  });

  SocketClient.on('opponentLeft', () => {
    if (running) endGame('opponentLeft');
  });

  SocketClient.on('error', (data) => {
    matchStatus.textContent = data?.message || I18n.t('connection_failed');
    matchDots.innerHTML = '';
  });

  SocketClient.on('disconnected', () => {
    if (running) {
      endGame('disconnected');
    } else {
      matchStatus.textContent = I18n.t('reconnecting');
    }
  });

  // ── Connect and join matchmaking ─────────────────────────
  SocketClient.connect(() => {
    matchStatus.textContent = I18n.t('opponent_found');
    SocketClient.joinMatchmaking();
  });

  // ── Cancel button ────────────────────────────────────────
  document.getElementById('cancelMatchBtn').onclick = () => {
    SocketClient.disconnect();
    window.location.href = 'index.html';
  };
}

// ══════════════════════════════════════════════════════════════
// COUNTDOWN
// ══════════════════════════════════════════════════════════════
function startCountdown() {
  // Hide game over, show countdown
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');
  document.getElementById('countdownScreen').classList.remove('hidden');

  // Draw empty arena while counting
  GameEngine.resize();
  GameEngine.generateObstacles();
  GameEngine.drawBackground();
  GameEngine.drawObstacles();

  countdownVal = 3;
  const numEl  = document.getElementById('countdownNumber');
  numEl.textContent = countdownVal;

  const tick = () => {
    numEl.style.animation = 'none';
    void numEl.offsetWidth; // reflow
    numEl.style.animation  = 'countPop 0.5s ease-out';

    if (countdownVal <= 0) {
      numEl.textContent = I18n.t('go');
      numEl.style.color = '#ffd700';
      setTimeout(() => {
        document.getElementById('countdownScreen').classList.add('hidden');
        startGame();
      }, 600);
      return;
    }

    numEl.textContent = countdownVal;
    numEl.style.color = countdownVal === 1 ? '#ff3355' : '#00ffcc';
    countdownVal--;
    setTimeout(tick, 800);
  };
  tick();
}

// ══════════════════════════════════════════════════════════════
// START GAME
// ══════════════════════════════════════════════════════════════
function startGame() {
  const E = GameEngine;
  const s = E.S;

  // Scale sizes for mobile
  const pRadius = Math.max(10, Math.round(18 * s));
  const pSpeed  = Math.round(188 * Math.max(0.7, s));

  // Reset player
  player.x             = E.W * 0.22;
  player.y             = E.H * 0.5;
  player.r             = pRadius;
  player.speed         = pSpeed;
  player.hp            = 100;
  player.vx            = 0;
  player.vy            = 0;
  player.angle         = 0;
  player.ammo              = 3;
  player.ammoRechargeTimer = 0;
  player.ultCharge     = 0;
  player.invincible    = 0;
  player.ultFlash      = 0;

  // Create enemy
  if (isMultiplayer) {
    enemy = {
      x: E.W * 0.78, y: E.H * 0.5,
      r: pRadius, hp: 100, maxHp: 100,
      speed: pSpeed, vx: 0, vy: 0,
      angle: 0, color: '#ff3355',
      meleeCooldown: 0, invincible: 0,
      meleeActive: 0, _meleeHit: false,
    };
  } else {
    enemy = EnemyAI.createEnemy(E.W * 0.78, E.H * 0.5);
    enemy.r = pRadius;
  }

  // Reset stats
  score      = 0;
  gameTime   = 60;
  killCount  = 0;
  bulletsHit = 0;
  shotsFired = 0;
  running    = true;

  // Clear bullets/particles
  while (E.bullets.length) E.bullets.pop();

  // Show HUD + controls
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('controls').classList.remove('hidden');

  // Resume hook for pause
  window._resumeGame = () => {
    if (running) E.startLoop(onFrame);
  };

  E.startLoop(onFrame);
}

// ══════════════════════════════════════════════════════════════
// MAIN FRAME
// ══════════════════════════════════════════════════════════════
function onFrame(dt, ctx, W, H) {
  gameTime -= dt;
  if (gameTime <= 0) { endGame('time'); return; }

  // Update
  updatePlayer(dt);

  // Send state in multiplayer
  if (isMultiplayer) {
    SocketClient.sendGameState({
      x: player.x,  y: player.y,
      vx: player.vx, vy: player.vy,
      angle: player.angle,
    });
  }

  updateEnemy(dt);
  updateBulletsWithCollision(dt);
  GameEngine.updateParticles(dt);

  // Draw
  GameEngine.drawBackground();
  GameEngine.drawObstacles();
  GameEngine.drawParticles();
  GameEngine.drawBullets();

  // Ult flash overlay
  if (player.ultFlash > 0) {
    GameEngine.drawUltFlash(player.ultFlash * 0.35);
    player.ultFlash -= dt * 4;
  }

  GameEngine.drawEntity(enemy,  enemy.color);

  // Shield visual: rotating ring around enemy
  if (enemy.shieldTimer > 0) {
    const ctx = GameEngine.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,51,85,0.4)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -Date.now() * 0.01;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Shield glow
    ctx.shadowBlur  = 12;
    ctx.shadowColor = 'rgba(255,51,85,0.3)';
    ctx.strokeStyle = 'rgba(255,51,85,0.15)';
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  drawAimIndicator();
  GameEngine.drawEntity(player, player.color);
  drawAmmoAbovePlayer();

  updateHUD();
}

// ══════════════════════════════════════════════════════════════
// PLAYER UPDATE
// ══════════════════════════════════════════════════════════════
function updatePlayer(dt) {
  // ── Movement ──────────────────────────────────────────────
  const jLen = Math.sqrt(joystick.dx ** 2 + joystick.dy ** 2);
  if (jLen > 0.08) {
    const spd = player.speed * Math.min(1, jLen);
    player.vx = (joystick.dx / jLen) * spd;
    player.vy = (joystick.dy / jLen) * spd;
  } else {
    player.vx *= 0.78;
    player.vy *= 0.78;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  GameEngine.clampToArena(player);
  GameEngine.resolveObstacles(player);

  // Aim: manual joystick overrides auto-aim
  const aimLen = Math.sqrt(aimJoystick.dx ** 2 + aimJoystick.dy ** 2);
  if (aimJoystick.active && aimLen > 0.15) {
    player.angle = Math.atan2(aimJoystick.dy, aimJoystick.dx);
  } else {
    player.angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
  }

  // ── Cooldowns ────────────────────────────────────────────
  if (player.invincible > 0) player.invincible -= dt;

  // ── Ammo recharge (1 ammo per second) ──────────────────
  if (player.ammo < player.maxAmmo) {
    player.ammoRechargeTimer += dt;
    if (player.ammoRechargeTimer >= 1.0) {
      player.ammo++;
      player.ammoRechargeTimer -= 1.0;
    }
  } else {
    player.ammoRechargeTimer = 0;
  }

  // ── Ult charge ───────────────────────────────────────────
  if (player.ultCharge < player.ultMax) {
    player.ultCharge = Math.min(
      player.ultMax,
      player.ultCharge + dt * 5.5
    );
  }

  // ── Shoot (6-bullet spread, costs 1 ammo) ──────────────
  // Trigger from keyboard (Space) or aim joystick release
  const wantShoot = keys.shoot || aimJoystick.shouldFire;
  if (wantShoot && player.ammo > 0) {
    // Apply aimed angle from joystick if set
    if (aimJoystick.shouldFire && aimJoystick.fireAngle !== null) {
      player.angle = aimJoystick.fireAngle;
    }
    aimJoystick.shouldFire = false;
    aimJoystick.fireAngle  = null;

    player.ammo--;
    player.ammoRechargeTimer = 0;

    const bRadius   = Math.max(2, Math.round(4 * GameEngine.S));
    const baseAngle = player.angle;
    const startIdx  = GameEngine.bullets.length;
    let bulletCount = 0;

    if (charConfig.shootPattern === 'line') {
      // ── Line pattern: 6 bullets in a row along the same direction ──
      const spd = 390;
      for (let i = 0; i < 6; i++) {
        const dist = player.r + 7 + i * 12;
        GameEngine.bullets.push({
          x:     player.x + Math.cos(baseAngle) * dist,
          y:     player.y + Math.sin(baseAngle) * dist,
          vx:    Math.cos(baseAngle) * spd,
          vy:    Math.sin(baseAngle) * spd,
          r:     bRadius,
          dmg:   4,
          color: charConfig.bulletColor,
          owner: 'player',
          life:  charConfig.bulletLife,
          trail: [],
          bounce: charConfig.bulletBounce,
        });
      }
      bulletCount = 6;
    } else {
      // ── Spread pattern: 6 bullets in a fan ──
      const SPREAD = [-0.20, -0.12, -0.04, 0.04, 0.12, 0.20];
      for (const offset of SPREAD) {
        const a   = baseAngle + offset;
        const spd = 390;
        GameEngine.bullets.push({
          x:     player.x + Math.cos(baseAngle) * (player.r + 7),
          y:     player.y + Math.sin(baseAngle) * (player.r + 7),
          vx:    Math.cos(a) * spd,
          vy:    Math.sin(a) * spd,
          r:     bRadius,
          dmg:   4,
          color: charConfig.bulletColor,
          owner: 'player',
          life:  charConfig.bulletLife,
          trail: [],
          bounce: charConfig.bulletBounce,
        });
      }
      bulletCount = 6;
    }
    shotsFired += bulletCount;
    score++;

    // Send all spread bullets to opponent in multiplayer
    if (isMultiplayer) {
      for (let i = startIdx; i < GameEngine.bullets.length; i++) {
        const b = GameEngine.bullets[i];
        if (b && b.owner === 'player') {
          SocketClient.sendShoot({
            x: b.x, y: b.y, vx: b.vx, vy: b.vy,
            r: b.r, dmg: b.dmg, life: b.life,
          });
        }
      }
    }

    // Muzzle flash particles
    GameEngine.spawnParticles(
      player.x + Math.cos(player.angle) * 22,
      player.y + Math.sin(player.angle) * 22,
      charConfig.bulletColor, 5,
      {
        angle:   player.angle,
        spread:  0.8,
        minSpd:  40, maxSpd: 120,
        minR: 1, maxR: 3,
      }
    );

    keys.shoot = false;
  } else if (aimJoystick.shouldFire) {
    // No ammo — clear the fire request
    aimJoystick.shouldFire = false;
    aimJoystick.fireAngle  = null;
  }

  // ── Ultimate ─────────────────────────────────────────────
  if (keys.ult && player.ultCharge >= player.ultMax) {
    fireUltimate();
  }

  // ── Ult button visual ────────────────────────────────────
  const ultBtn = document.getElementById('ultBtn');
  if (ultBtn) {
    ultBtn.classList.toggle('ready', player.ultCharge >= player.ultMax);
  }
}

// ══════════════════════════════════════════════════════════════
// ULTIMATE
// ══════════════════════════════════════════════════════════════
function fireUltimate() {
  player.ultCharge  = 0;
  player.invincible = 2.5;
  player.ultFlash   = 1.0;

  if (charConfig.ultType === 'heal') {
    // ── Heal Ultimate: restore 50% HP ────────────────────────
    const healAmount = Math.round(player.maxHp * 0.5);
    player.hp = Math.min(player.maxHp, player.hp + healAmount);

    // Green healing particles
    GameEngine.spawnParticles(
      player.x, player.y, '#00ff66', 30,
      { minSpd: 40, maxSpd: 160, minR: 2, maxR: 5 }
    );
    GameEngine.spawnParticles(
      player.x, player.y, '#88ffaa', 15,
      { minSpd: 20, maxSpd: 80, minR: 1, maxR: 3 }
    );

    score += 5;
  } else {
    // ── Explosion Ultimate: ring of 12 bullets ───────────────
    const startIdx = GameEngine.bullets.length;
    const ultR   = Math.max(4, Math.round(8 * GameEngine.S));
    const ultSpd = Math.round(430 * Math.max(0.7, GameEngine.S));
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      GameEngine.bullets.push({
        x:     player.x,
        y:     player.y,
        vx:    Math.cos(angle) * ultSpd,
        vy:    Math.sin(angle) * ultSpd,
        r:     ultR,
        dmg:   30,
        color: '#ffd700',
        owner: 'player',
        life:  1.3,
        trail: [],
      });
    }

    // Send ult bullets to opponent
    if (isMultiplayer) {
      for (let i = startIdx; i < GameEngine.bullets.length; i++) {
        const b = GameEngine.bullets[i];
        if (b) {
          SocketClient.sendShoot({
            x: b.x, y: b.y, vx: b.vx, vy: b.vy,
            r: b.r, dmg: b.dmg, life: b.life,
          });
        }
      }
    }

    // Big particle burst
    GameEngine.spawnParticles(
      player.x, player.y, '#ffd700', 28,
      { minSpd: 100, maxSpd: 280, minR: 2, maxR: 6 }
    );
    GameEngine.spawnParticles(
      player.x, player.y, '#ffffff', 12,
      { minSpd: 60, maxSpd: 140, minR: 1, maxR: 3 }
    );

    score += 10;
  }
}

// ══════════════════════════════════════════════════════════════
// ENEMY UPDATE
// ══════════════════════════════════════════════════════════════
function updateEnemy(dt) {
  if (isMultiplayer) {
    // Check if remote player is meleing us
    if (enemy.meleeActive > 0 && !enemy._meleeHit) {
      enemy._meleeHit = true;
      const d = GameEngine.dist(player, enemy);
      if (d < player.r + enemy.r + (enemy._meleeRange || 75) && player.invincible <= 0) {
        player.hp = Math.max(0, player.hp - 24);
        GameEngine.spawnParticles(
          player.x, player.y, '#ff6600', 10,
          { minSpd: 80, maxSpd: 200, minR: 2, maxR: 5 }
        );
        const kAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        player.vx = Math.cos(kAngle) * 280;
        player.vy = Math.sin(kAngle) * 280;
        shakeScreen(4, 0.2);
        if (player.hp <= 0) endGame('dead');
      }
    }
    if (enemy.meleeActive <= 0) enemy._meleeHit = false;

    GameEngine.clampToArena(enemy);
    return;
  }

  // AI mode
  EnemyAI.update(
    enemy,
    player,
    dt,
    // onShoot callback
    (e, predX, predY, spread) => {
      GameEngine.spawnBullet(
        e, predX, predY, 'enemy',
        { color: '#ff3355', dmg: 10, spread, r: 5 }
      );
      // Muzzle flash
      GameEngine.spawnParticles(
        e.x + Math.cos(e.angle) * 22,
        e.y + Math.sin(e.angle) * 22,
        '#ff3355', 3,
        {
          angle:  e.angle,
          spread: 0.5,
          minSpd: 30, maxSpd: 80,
          minR: 1, maxR: 2,
        }
      );
    },
    // onMeleeHit callback
    (dmg) => {
      if (player.invincible > 0) return;
      player.hp = Math.max(0, player.hp - dmg);
      if (player.hp <= 0) endGame('dead');
    }
  );
}

// ══════════════════════════════════════════════════════════════
// BULLET COLLISION
// ══════════════════════════════════════════════════════════════
function updateBulletsWithCollision(dt) {
  GameEngine.updateBullets(dt, (b, i) => {

    if (b.owner === 'player') {
      // Check hit on enemy
      if (GameEngine.dist(b, enemy) < b.r + enemy.r) {
        damageEnemy(b.dmg);
        GameEngine.spawnParticles(
          b.x, b.y, '#ff3355', 6,
          { minSpd: 50, maxSpd: 130, minR: 1, maxR: 3 }
        );
        GameEngine.bullets.splice(i, 1);
        bulletsHit++;
        score += 8;
      }

    } else {
      // Check hit on player
      if (player.invincible > 0) return;
      if (GameEngine.dist(b, player) < b.r + player.r) {
        player.hp = Math.max(0, player.hp - b.dmg);
        GameEngine.spawnParticles(
          b.x, b.y, '#00ffcc', 5,
          { minSpd: 40, maxSpd: 120, minR: 1, maxR: 3 }
        );
        GameEngine.bullets.splice(i, 1);
        // Screen shake
        shakeScreen(4, 0.2);
        if (player.hp <= 0) endGame('dead');
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
// DAMAGE ENEMY
// ══════════════════════════════════════════════════════════════
function damageEnemy(amount) {
  // Shield state reduces damage by 50%
  const dmg = (enemy.shieldTimer > 0) ? Math.round(amount * 0.5) : amount;
  enemy.hp = Math.max(0, enemy.hp - dmg);

  if (enemy.hp <= 0) {
    killCount++;
    score += 100;

    // Kill counter update
    document.getElementById('killDisplay').textContent = `☠️ ${killCount}`;

    // Shake
    shakeScreen(6, 0.3);

    if (isMultiplayer) {
      // No respawn in PvP — game over
      endGame('enemyDead');
      return;
    }

    // AI mode: heal, scale, respawn
    player.hp = Math.min(player.maxHp, player.hp + 20);
    EnemyAI.scaleDifficulty(enemy, killCount);
    EnemyAI.respawn(enemy, GameEngine.W, GameEngine.H, player.x, player.y);
  }
}

// ══════════════════════════════════════════════════════════════
// SCREEN SHAKE
// ══════════════════════════════════════════════════════════════
function shakeScreen(intensity, duration) {
  const canvas  = GameEngine.canvas;
  const startTs = performance.now();

  const shake = (ts) => {
    const elapsed = (ts - startTs) / 1000;
    if (elapsed >= duration) {
      canvas.style.transform = '';
      return;
    }
    const power = (1 - elapsed / duration) * intensity;
    const dx    = (Math.random() - 0.5) * power * 2;
    const dy    = (Math.random() - 0.5) * power * 2;
    canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(shake);
  };
  requestAnimationFrame(shake);
}

// ══════════════════════════════════════════════════════════════
// AIM INDICATOR (cone for spread, line for line pattern)
// ══════════════════════════════════════════════════════════════
function drawAimIndicator() {
  // Always show aim indicator — manual when dragging, auto-aim when idle
  const aLen = Math.sqrt(aimJoystick.dx ** 2 + aimJoystick.dy ** 2);
  const isManual = aimJoystick.active && aLen > 0.15;
  const opacity  = isManual ? 1.0 : 0.45; // dimmer for auto-aim

  const ctx = GameEngine.ctx;
  const { x, y, r, angle } = player;
  const range    = Math.max(120, Math.round(220 * GameEngine.S));
  const aimColor = charConfig ? charConfig.bulletColor : '#00ffcc';

  ctx.save();

  if (charConfig.shootPattern === 'line') {
    // ── Line indicator: single straight line ──
    ctx.globalAlpha = 0.3 * opacity;
    ctx.strokeStyle = aimColor;
    ctx.lineWidth   = 3;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(
      x + Math.cos(angle) * (r + 5),
      y + Math.sin(angle) * (r + 5)
    );
    ctx.lineTo(
      x + Math.cos(angle) * range,
      y + Math.sin(angle) * range
    );
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // ── Cone indicator: spread fan ──
    const spreadHalf = 0.22;

    ctx.globalAlpha = 0.12 * opacity;
    ctx.fillStyle   = aimColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - spreadHalf, angle + spreadHalf);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.35 * opacity;
    ctx.strokeStyle = aimColor;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(
      x + Math.cos(angle - spreadHalf) * (r + 5),
      y + Math.sin(angle - spreadHalf) * (r + 5)
    );
    ctx.lineTo(
      x + Math.cos(angle - spreadHalf) * range,
      y + Math.sin(angle - spreadHalf) * range
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      x + Math.cos(angle + spreadHalf) * (r + 5),
      y + Math.sin(angle + spreadHalf) * (r + 5)
    );
    ctx.lineTo(
      x + Math.cos(angle + spreadHalf) * range,
      y + Math.sin(angle + spreadHalf) * range
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Center dot at range tip
  ctx.globalAlpha = 0.5 * opacity;
  ctx.beginPath();
  ctx.arc(
    x + Math.cos(angle) * range,
    y + Math.sin(angle) * range,
    4, 0, Math.PI * 2
  );
  ctx.fillStyle = aimColor;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ══════════════════════════════════════════════════════════════
// AMMO DISPLAY (above player on canvas)
// ══════════════════════════════════════════════════════════════
function drawAmmoAbovePlayer() {
  const ctx = GameEngine.ctx;
  const { x, y, r, ammo, maxAmmo, ammoRechargeTimer } = player;

  const pipW = Math.max(8, Math.round(12 * GameEngine.S));
  const pipH = Math.max(3, Math.round(5 * GameEngine.S));
  const gap  = Math.max(2, Math.round(3 * GameEngine.S));
  const totalW = maxAmmo * pipW + (maxAmmo - 1) * gap;
  const startX = x - totalW / 2;
  const startY = y - r - 26;

  ctx.save();
  for (let i = 0; i < maxAmmo; i++) {
    const px = startX + i * (pipW + gap);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(px - 0.5, startY - 0.5, pipW + 1, pipH + 1, 2);
    ctx.fill();

    if (i < ammo) {
      // Full pip
      ctx.shadowBlur  = 6;
      ctx.shadowColor = '#00ffcc';
      ctx.fillStyle   = '#00ffcc';
      ctx.beginPath();
      ctx.roundRect(px, startY, pipW, pipH, 1.5);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (i === ammo) {
      // Recharging pip — partial fill
      const fillW = pipW * ammoRechargeTimer;
      ctx.fillStyle = '#00aa66';
      ctx.beginPath();
      ctx.roundRect(px, startY, fillW, pipH, 1.5);
      ctx.fill();
    }
    // Empty pips just show the dark background
  }
  ctx.restore();
}

// ══════════════════════════════════════════════════════════════
// HUD UPDATE
// ══════════════════════════════════════════════════════════════
function updateHUD() {
  // Player HP
  const phpEl  = document.getElementById('playerHp');
  const hpRat  = player.hp / player.maxHp;
  phpEl.style.width = (hpRat * 100) + '%';
  phpEl.className   = 'hp-fill player'
    + (hpRat < 0.25 ? ' critical' : hpRat < 0.5 ? ' low' : '');

  // Enemy HP
  document.getElementById('enemyHp').style.width =
    (enemy.hp / enemy.maxHp * 100) + '%';

  // Ult bar
  const ultRat = player.ultCharge / player.ultMax;
  const ultEl  = document.getElementById('ultBar');
  ultEl.style.width = (ultRat * 100) + '%';
  ultEl.className   = 'ult-fill' + (ultRat >= 1 ? ' ready' : '');

  // Score
  document.getElementById('scoreDisplay').textContent = score;

  // Timer
  const t       = Math.max(0, Math.ceil(gameTime));
  const timerEl = document.getElementById('timerDisplay');
  timerEl.textContent = t;
  timerEl.className   = 'timer-display' + (t <= 10 ? ' warning' : '');

  // Enemy state label
  document.getElementById('enemyState').textContent =
    isMultiplayer ? I18n.t('pvp') : EnemyAI.getStateLabel(enemy.state);
}

// ══════════════════════════════════════════════════════════════
// END GAME
// ══════════════════════════════════════════════════════════════
function endGame(reason) {
  running = false;
  GameEngine.stopLoop();

  document.getElementById('hud').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');

  // Result
  let emoji, resultText, resultClass;

  if (isMultiplayer) {
    switch (reason) {
      case 'dead':
        emoji = '💀'; resultText = I18n.t('defeated'); resultClass = 'lose'; break;
      case 'enemyDead':
        emoji = '🏆'; resultText = I18n.t('victory'); resultClass = 'win'; break;
      case 'opponentLeft':
        emoji = '🏆'; resultText = I18n.t('opponent_left'); resultClass = 'win'; break;
      case 'disconnected':
        emoji = '⚠️'; resultText = I18n.t('disconnected'); resultClass = 'lose'; break;
      case 'time':
      default:
        if (player.hp > enemy.hp) {
          emoji = '🏆'; resultText = I18n.t('victory'); resultClass = 'win';
        } else if (player.hp < enemy.hp) {
          emoji = '💀'; resultText = I18n.t('defeated'); resultClass = 'lose';
        } else {
          emoji = '⏱️'; resultText = I18n.t('draw'); resultClass = 'draw';
        }
    }
    // Submit score to server
    SocketClient.sendScore(score);
  } else {
    // AI mode
    emoji = reason === 'dead' ? '💀' : killCount >= 3 ? '🏆' : '⏱️';

    if (reason === 'dead') {
      resultText  = I18n.t('defeated');
      resultClass = 'lose';
    } else if (killCount >= 3) {
      resultText  = I18n.t('victory');
      resultClass = 'win';
    } else {
      resultText  = I18n.t('times_up');
      resultClass = score > 150 ? 'win' : 'lose';
    }
  }

  document.getElementById('goEmoji').textContent  = emoji;
  document.getElementById('goResult').textContent  = resultText;
  document.getElementById('goResult').className    = 'go-result ' + resultClass;
  document.getElementById('goScore').textContent   = I18n.t('score_label') + ': ' + score.toLocaleString();

  // Accuracy
  const accuracy = shotsFired > 0
    ? Math.round((bulletsHit / shotsFired) * 100)
    : 0;

  document.getElementById('goStats').innerHTML = `
    <div class="go-stat">⚔️ ${I18n.t('kills_stat')}  <span>${killCount}</span></div>
    <div class="go-stat">🎯 ${I18n.t('accuracy_stat')}  <span>${accuracy}%</span></div>
    <div class="go-stat">💊 ${I18n.t('hp_left')}  <span>${Math.max(0, Math.floor(player.hp))}</span></div>
    <div class="go-stat">⏱️ ${I18n.t('time_left')}  <span>${Math.max(0, Math.ceil(gameTime))}s</span></div>
  `;

  // Submit to leaderboard
  const { rank, entries } = Leaderboard.submit(score, {
    kills: killCount, accuracy, hp: Math.floor(player.hp),
  });

  // Update profile stats (+1 TN on victory)
  if (typeof PlayerProfile !== 'undefined') {
    PlayerProfile.updateStats({ score, kills: killCount, accuracy, won: resultClass === 'win' });
  }

  // Show rank
  const rankEl = document.getElementById('goRank');
  const rankTx = document.getElementById('goRankText');
  rankEl.classList.remove('hidden');
  if (rank === 1) {
    rankTx.textContent = '🥇 ' + I18n.t('number1_ninja');
  } else {
    rankTx.textContent = `🏅 ${I18n.t('weekly_rank_num')} #${rank}`;
  }

  // Notify guests to sign in for leaderboard
  if (typeof FirebaseAuth !== 'undefined' && !FirebaseAuth.isSignedIn()) {
    setTimeout(() => {
      showToast(I18n.t('sign_in_lb_toast'), 'info');
    }, 2000);
  }

  document.getElementById('gameOverScreen').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════
// CONTROLS
// ══════════════════════════════════════════════════════════════
function setupControls() {
  const jZone  = document.getElementById('joystickZone');
  const jStick = document.getElementById('joystickStick');
  const jR     = 58;

  function getCenter() {
    const r = jZone.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  // ── Touch: Joystick ───────────────────────────────────────
  jZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t        = e.changedTouches[0];
    joystick.active = true;
    joystick.id     = t.identifier;
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joystick.id) continue;
      const { cx, cy } = getCenter();
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > jR) { dx = dx / len * jR; dy = dy / len * jR; }
      joystick.dx = dx / jR;
      joystick.dy = dy / jR;
      jStick.style.left = (50 + joystick.dx * 42) + '%';
      jStick.style.top  = (50 + joystick.dy * 42) + '%';
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joystick.id) continue;
      joystick.active = false;
      joystick.dx     = 0;
      joystick.dy     = 0;
      jStick.style.left = '50%';
      jStick.style.top  = '50%';
    }
  });

  // ── Touch: Aim Joystick (Brawl Stars style) ──────────────
  const aZone  = document.getElementById('aimZone');
  const aStick = document.getElementById('aimStick');
  const aR     = 52;

  function getAimCenter() {
    const r = aZone.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  aZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    aimJoystick.active = true;
    aimJoystick.id     = t.identifier;
    aimJoystick.dx     = 0;
    aimJoystick.dy     = 0;
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== aimJoystick.id || !aimJoystick.active) continue;
      const { cx, cy } = getAimCenter();
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > aR) { dx = dx / len * aR; dy = dy / len * aR; }
      aimJoystick.dx = dx / aR;
      aimJoystick.dy = dy / aR;
      aStick.style.left = (50 + aimJoystick.dx * 42) + '%';
      aStick.style.top  = (50 + aimJoystick.dy * 42) + '%';
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== aimJoystick.id || !aimJoystick.active) continue;
      // Fire on release
      const aLen = Math.sqrt(aimJoystick.dx ** 2 + aimJoystick.dy ** 2);
      if (aLen > 0.15) {
        // Aimed shot — use joystick direction
        aimJoystick.fireAngle = Math.atan2(aimJoystick.dy, aimJoystick.dx);
      } else {
        // Quick tap — auto-aim at enemy
        aimJoystick.fireAngle = null;
      }
      aimJoystick.shouldFire = true;
      aimJoystick.active = false;
      aimJoystick.dx = 0;
      aimJoystick.dy = 0;
      aStick.style.left = '50%';
      aStick.style.top  = '50%';
    }
  });

  // Mouse fallback for aim joystick (desktop testing)
  let aimMouseDown = false;
  aZone.addEventListener('mousedown', (e) => {
    aimMouseDown = true;
    aimJoystick.active = true;
    aimJoystick.dx = 0;
    aimJoystick.dy = 0;
  });
  document.addEventListener('mousemove', (e) => {
    if (!aimMouseDown) return;
    const { cx, cy } = getAimCenter();
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > aR) { dx = dx / len * aR; dy = dy / len * aR; }
    aimJoystick.dx = dx / aR;
    aimJoystick.dy = dy / aR;
    aStick.style.left = (50 + aimJoystick.dx * 42) + '%';
    aStick.style.top  = (50 + aimJoystick.dy * 42) + '%';
  });
  document.addEventListener('mouseup', () => {
    if (!aimMouseDown) return;
    aimMouseDown = false;
    const aLen = Math.sqrt(aimJoystick.dx ** 2 + aimJoystick.dy ** 2);
    aimJoystick.fireAngle  = aLen > 0.15 ? Math.atan2(aimJoystick.dy, aimJoystick.dx) : null;
    aimJoystick.shouldFire = true;
    aimJoystick.active = false;
    aimJoystick.dx = 0;
    aimJoystick.dy = 0;
    aStick.style.left = '50%';
    aStick.style.top  = '50%';
  });

  // ── Touch: Ult Button ──────────────────────────────────────
  function bindBtn(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      keys[key] = true;
    }, { passive: false });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      keys[key] = false;
    });
    el.addEventListener('mousedown', () => keys[key] = true);
    el.addEventListener('mouseup',   () => keys[key] = false);
  }

  bindBtn('ultBtn', 'ult');

  // ── Keyboard ─────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'Space':       keys.shoot = true;  break;
      case 'KeyZ':        keys.ult   = true;  break;
      case 'Escape':      GameEngine.togglePause(); break;
      case 'ArrowLeft':
      case 'KeyA':        joystick.dx = -1;   break;
      case 'ArrowRight':
      case 'KeyD':        joystick.dx =  1;   break;
      case 'ArrowUp':
      case 'KeyW':        joystick.dy = -1;   break;
      case 'ArrowDown':
      case 'KeyS':        joystick.dy =  1;   break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'Space':       keys.shoot = false; break;
      case 'KeyZ':        keys.ult   = false; break;
      case 'ArrowLeft':
      case 'KeyA':        if (joystick.dx < 0) joystick.dx = 0; break;
      case 'ArrowRight':
      case 'KeyD':        if (joystick.dx > 0) joystick.dx = 0; break;
      case 'ArrowUp':
      case 'KeyW':        if (joystick.dy < 0) joystick.dy = 0; break;
      case 'ArrowDown':
      case 'KeyS':        if (joystick.dy > 0) joystick.dy = 0; break;
    }
  });
}
