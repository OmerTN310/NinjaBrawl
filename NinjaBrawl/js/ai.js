/* ============================================================
   ai.js — Enemy AI State Machine (v2)
   States: chase | retreat | circle | strafe | ambush |
           dodge | burst | combo | ult_attack
   ============================================================ */

const EnemyAI = (() => {

  // ── Create Enemy ─────────────────────────────────────────
  function createEnemy(x, y) {
    return {
      x, y, r: 18,
      hp: 100, maxHp: 100,
      speed: 125,
      vx: 0, vy: 0,
      angle: 0,
      color: '#ff3355',
      // AI state
      state:         'chase',
      stateTimer:    2,
      shootTimer:    1.5 + Math.random() * 0.5,
      meleeCooldown: 0,
      invincible:    0,
      // Difficulty
      difficulty:    1.0,
      // Memory
      lastPlayerX:   x,
      lastPlayerY:   y,
      targetX:       x,
      targetY:       y,
      // v2: new AI fields
      burstCount:    0,          // shots remaining in burst
      burstDelay:    0,          // time between burst shots
      dodgeAngle:    0,          // direction to dodge
      comboPhase:    0,          // 0=rush, 1=melee, 2=retreat
      ultCharge:     0,          // charge toward AI ultimate
      ultCooldown:   0,          // cooldown after AI ult
      lastDodgeTime: 0,         // prevent dodge spam
      prevPlayerVx:  0,          // track player acceleration
      prevPlayerVy:  0,
      feintDir:      1,          // feint fake-out direction
      shieldTimer:   0,          // temporary damage reduction
    };
  }

  // ── Detect Incoming Bullets ────────────────────────────────
  function findNearestThreat(enemy) {
    const bullets = GameEngine.bullets;
    let closest = null;
    let closestDist = Infinity;

    for (const b of bullets) {
      if (b.owner === 'enemy') continue;

      // Check if bullet is heading toward enemy
      const dx = enemy.x - b.x;
      const dy = enemy.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 200) continue; // too far

      // Dot product: is bullet moving toward us?
      const dotX = b.vx * dx + b.vy * dy;
      if (dotX <= 0) continue; // moving away

      // Perpendicular distance from bullet trajectory to enemy
      const bSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (bSpeed < 1) continue;
      const cross = Math.abs(b.vx * dy - b.vy * dx) / bSpeed;

      if (cross < enemy.r + 30 && dist < closestDist) {
        closestDist = dist;
        closest = b;
      }
    }

    return closest;
  }

  // ── Main Update ──────────────────────────────────────────
  function update(enemy, player, dt, onShoot, onMeleeHit) {

    // Timers
    enemy.stateTimer   -= dt;
    enemy.shootTimer   -= dt;
    if (enemy.meleeCooldown > 0) enemy.meleeCooldown -= dt;
    if (enemy.invincible    > 0) enemy.invincible    -= dt;
    if (enemy.burstDelay    > 0) enemy.burstDelay    -= dt;
    if (enemy.ultCooldown   > 0) enemy.ultCooldown   -= dt;
    if (enemy.shieldTimer   > 0) enemy.shieldTimer   -= dt;

    // Build ult charge over time (faster at higher difficulty)
    enemy.ultCharge = Math.min(100, enemy.ultCharge + dt * (3 + enemy.difficulty * 2));

    // Remember player velocity for prediction
    enemy.prevPlayerVx = player.vx || 0;
    enemy.prevPlayerVy = player.vy || 0;
    enemy.lastPlayerX = player.x;
    enemy.lastPlayerY = player.y;

    const d     = GameEngine.dist(enemy, player);
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);

    // ── Reactive: Interrupt state to dodge bullets ────────
    const threat = findNearestThreat(enemy);
    const now = Date.now();
    if (threat && enemy.state !== 'dodge' && enemy.difficulty >= 1.2
        && now - enemy.lastDodgeTime > 600) {
      // Calculate dodge direction (perpendicular to bullet)
      const bAngle = Math.atan2(threat.vy, threat.vx);
      // Dodge to whichever perpendicular side is further from walls
      const side1 = bAngle + Math.PI / 2;
      const side2 = bAngle - Math.PI / 2;
      const mg = GameEngine.margin();
      const testX1 = enemy.x + Math.cos(side1) * 60;
      const testY1 = enemy.y + Math.sin(side1) * 60;
      const testX2 = enemy.x + Math.cos(side2) * 60;
      const testY2 = enemy.y + Math.sin(side2) * 60;

      // Pick the side with more room
      const room1 = Math.min(testX1 - mg.side, GameEngine.W - mg.side - testX1,
                              testY1 - mg.top, GameEngine.H - mg.bottom - testY1);
      const room2 = Math.min(testX2 - mg.side, GameEngine.W - mg.side - testX2,
                              testY2 - mg.top, GameEngine.H - mg.bottom - testY2);

      enemy.dodgeAngle = room1 > room2 ? side1 : side2;
      enemy.state = 'dodge';
      enemy.stateTimer = 0.25 + Math.random() * 0.15;
      enemy.lastDodgeTime = now;
    }

    // ── State Transition ──────────────────────────────────
    if (enemy.stateTimer <= 0) {
      enemy.state     = pickState(enemy, player, d);
      enemy.stateTimer = getStateDuration(enemy.state);

      // Init burst fire
      if (enemy.state === 'burst') {
        enemy.burstCount = 3 + Math.floor(enemy.difficulty);
        enemy.burstDelay = 0;
      }
      // Init combo
      if (enemy.state === 'combo') {
        enemy.comboPhase = 0;
      }
      // Init feint
      if (enemy.state === 'feint') {
        enemy.feintDir = Math.random() > 0.5 ? 1 : -1;
      }
      // Init shield
      if (enemy.state === 'shield') {
        enemy.shieldTimer = getStateDuration('shield');
      }
    }

    // ── Movement ─────────────────────────────────────────
    const { tx, ty } = getMovement(enemy, player, d, angle);

    // Smooth acceleration (faster response in dodge)
    const accel = enemy.state === 'dodge' ? 0.35 : 0.15;
    enemy.vx += (tx - enemy.vx) * accel;
    enemy.vy += (ty - enemy.vy) * accel;
    enemy.x  += enemy.vx * dt;
    enemy.y  += enemy.vy * dt;

    // Always face player
    enemy.angle = angle;

    GameEngine.clampToArena(enemy);
    GameEngine.resolveObstacles(enemy);

    // ── Shoot (normal) ──────────────────────────────────
    if (enemy.state !== 'burst' && enemy.state !== 'ult_attack') {
      const shootInterval = Math.max(0.35, 0.9 / enemy.difficulty);
      if (enemy.shootTimer <= 0 && d < 450) {
        fireAtPlayer(enemy, player, onShoot);
        enemy.shootTimer = shootInterval + Math.random() * 0.3;
      }
    }

    // ── Burst Fire ──────────────────────────────────────
    if (enemy.state === 'burst' && enemy.burstCount > 0 && enemy.burstDelay <= 0 && d < 480) {
      fireAtPlayer(enemy, player, onShoot);
      enemy.burstCount--;
      enemy.burstDelay = 0.1 + 0.05 / enemy.difficulty;
      if (enemy.burstCount <= 0) {
        enemy.shootTimer = 0.8 + Math.random() * 0.5;
      }
    }

    // ── AI Ultimate Attack ──────────────────────────────
    if (enemy.state === 'ult_attack') {
      fireUltimate(enemy, player, onShoot);
      enemy.ultCharge = 0;
      enemy.ultCooldown = 12;
      enemy.invincible = 1.5;
      enemy.state = 'retreat';
      enemy.stateTimer = 1.5;
    }

    // ── Melee ─────────────────────────────────────────
    const meleeRange = enemy.r + (player.r || 18) + 26;
    if (d < meleeRange && enemy.meleeCooldown <= 0) {
      enemy.meleeCooldown = Math.max(0.5, 1.0 / enemy.difficulty);
      const meleeDmg = Math.round(14 + enemy.difficulty * 3);
      onMeleeHit(meleeDmg);
      GameEngine.spawnParticles(
        player.x, player.y, '#ff3355', 8,
        { minSpd: 80, maxSpd: 180 }
      );

      // Combo: after melee, switch to retreat briefly
      if (enemy.state === 'combo' && enemy.comboPhase === 1) {
        enemy.comboPhase = 2;
        enemy.stateTimer = 0.6;
      }
    }
  }

  // ── Pick State ───────────────────────────────────────────
  function pickState(enemy, player, d) {
    const hpRatio = enemy.hp / enemy.maxHp;
    const pHpRatio = player.hp / player.maxHp;
    const roll    = Math.random();
    const diff    = enemy.difficulty;

    // AI Ultimate when charged and difficulty >= 1.5
    if (enemy.ultCharge >= 100 && enemy.ultCooldown <= 0 && diff >= 1.5) {
      return 'ult_attack';
    }

    // Low HP — retreat, dodge, or circle
    if (hpRatio < 0.25) {
      if (roll < 0.4) return 'retreat';
      if (roll < 0.65) return 'dodge';
      return 'circle';
    }

    // Player low HP — aggressive combo or chase
    if (pHpRatio < 0.3 && diff >= 1.3) {
      if (roll < 0.5) return 'combo';
      if (roll < 0.75) return 'chase';
      return 'burst';
    }

    // Too close — variety of defensive options
    if (d < 90) {
      if (roll < 0.3) return 'retreat';
      if (roll < 0.55) return 'strafe';
      if (roll < 0.75 && diff >= 1.2) return 'burst';
      return 'circle';
    }

    // Far away — chase or ambush
    if (d > 380) {
      if (roll < 0.6) return 'chase';
      if (roll < 0.85) return 'ambush';
      return 'burst';
    }

    // Mid range — full variety
    if (roll < 0.14) return 'chase';
    if (roll < 0.26) return 'circle';
    if (roll < 0.38) return 'strafe';
    if (roll < 0.48) return 'ambush';
    if (roll < 0.58 && diff >= 1.2) return 'burst';
    if (roll < 0.68 && diff >= 1.3) return 'combo';
    if (roll < 0.78 && diff >= 1.4) return 'feint';
    if (roll < 0.88 && diff >= 1.5) return 'shield';
    return 'retreat';
  }

  function getStateDuration(state) {
    const durations = {
      chase:      1.0 + Math.random() * 1.5,
      retreat:    0.7 + Math.random() * 0.8,
      circle:     1.5 + Math.random() * 2.0,
      strafe:     1.0 + Math.random() * 1.0,
      ambush:     1.8 + Math.random() * 1.5,
      dodge:      0.2 + Math.random() * 0.15,
      burst:      0.8 + Math.random() * 0.5,
      combo:      2.0 + Math.random() * 1.0,
      feint:      1.0 + Math.random() * 0.8,
      shield:     1.5 + Math.random() * 1.0,
      ult_attack: 0.1,
    };
    return durations[state] || 1.5;
  }

  // ── Movement per State ───────────────────────────────────
  function getMovement(enemy, player, d, angle) {
    const spd = enemy.speed * enemy.difficulty;
    let tx = 0, ty = 0;

    switch (enemy.state) {

      case 'chase':
        tx = Math.cos(angle) * spd;
        ty = Math.sin(angle) * spd;
        break;

      case 'retreat':
        tx = -Math.cos(angle) * spd;
        ty = -Math.sin(angle) * spd;
        // Slight zigzag while retreating
        {
          const zig = Math.sin(Date.now() * 0.004) * 0.5;
          const perpA = angle + Math.PI / 2;
          tx += Math.cos(perpA) * spd * zig;
          ty += Math.sin(perpA) * spd * zig;
        }
        break;

      case 'circle': {
        // Alternate orbit direction
        const orbitDir = Math.sin(Date.now() * 0.0008) > 0 ? 1 : -1;
        tx = Math.cos(angle + (Math.PI / 2) * orbitDir) * spd;
        ty = Math.sin(angle + (Math.PI / 2) * orbitDir) * spd;
        // Maintain distance ~200px
        if (d > 230) {
          tx += Math.cos(angle) * spd * 0.35;
          ty += Math.sin(angle) * spd * 0.35;
        } else if (d < 130) {
          tx -= Math.cos(angle) * spd * 0.35;
          ty -= Math.sin(angle) * spd * 0.35;
        }
        break;
      }

      case 'strafe': {
        // Faster, more erratic strafing
        const strafeFreq = 0.003 + enemy.difficulty * 0.001;
        const strafeDir = Math.sin(Date.now() * strafeFreq) > 0 ? 1 : -1;
        const perp = angle + (Math.PI / 2) * strafeDir;
        tx = Math.cos(perp)  * spd * 0.9
           + Math.cos(angle) * spd * 0.2;
        ty = Math.sin(perp)  * spd * 0.9
           + Math.sin(angle) * spd * 0.2;
        break;
      }

      case 'ambush': {
        // Flank from a wider angle
        const flankSide = enemy.x > player.x ? 1 : -1;
        const flankAngle = angle + Math.PI * 0.7 * flankSide;
        if (d > 150) {
          tx = Math.cos(flankAngle) * spd * 1.15;
          ty = Math.sin(flankAngle) * spd * 1.15;
        } else {
          // Dash at player from the side
          tx = Math.cos(angle) * spd * 1.5;
          ty = Math.sin(angle) * spd * 1.5;
        }
        break;
      }

      case 'dodge':
        // Quick sidestep perpendicular to incoming bullet
        tx = Math.cos(enemy.dodgeAngle) * spd * 2.0;
        ty = Math.sin(enemy.dodgeAngle) * spd * 2.0;
        break;

      case 'burst':
        // Strafe while burst firing
        {
          const bStrafeDir = Math.sin(Date.now() * 0.005) > 0 ? 1 : -1;
          const bPerp = angle + (Math.PI / 2) * bStrafeDir;
          tx = Math.cos(bPerp)  * spd * 0.7;
          ty = Math.sin(bPerp)  * spd * 0.7;
          // Close in slightly
          if (d > 250) {
            tx += Math.cos(angle) * spd * 0.3;
            ty += Math.sin(angle) * spd * 0.3;
          }
        }
        break;

      case 'combo':
        // Phase 0: rush toward player, Phase 1: in melee range, Phase 2: retreat
        if (enemy.comboPhase === 0) {
          tx = Math.cos(angle) * spd * 1.6;
          ty = Math.sin(angle) * spd * 1.6;
          // Transition to melee phase when close
          if (d < enemy.r + 18 + 40) {
            enemy.comboPhase = 1;
          }
        } else if (enemy.comboPhase === 1) {
          // Stay close for melee
          tx = Math.cos(angle) * spd * 0.5;
          ty = Math.sin(angle) * spd * 0.5;
        } else {
          // Phase 2: retreat after melee
          tx = -Math.cos(angle) * spd * 1.2;
          ty = -Math.sin(angle) * spd * 1.2;
        }
        break;

      case 'feint':
        // Fake going one direction then suddenly dash the other way
        {
          const elapsed = getStateDuration('feint') - (enemy.stateTimer || 0);
          if (elapsed < 0.4) {
            // Fake direction
            const fakeAngle = angle + Math.PI * 0.6 * enemy.feintDir;
            tx = Math.cos(fakeAngle) * spd * 1.1;
            ty = Math.sin(fakeAngle) * spd * 1.1;
          } else {
            // Real dash - opposite direction toward player
            tx = Math.cos(angle) * spd * 1.8;
            ty = Math.sin(angle) * spd * 1.8;
          }
        }
        break;

      case 'shield':
        // Move slowly, circle player at distance - reduced damage taken
        {
          const shieldOrbit = Math.sin(Date.now() * 0.001) > 0 ? 1 : -1;
          tx = Math.cos(angle + (Math.PI / 2) * shieldOrbit) * spd * 0.4;
          ty = Math.sin(angle + (Math.PI / 2) * shieldOrbit) * spd * 0.4;
          // Keep distance
          if (d < 180) {
            tx -= Math.cos(angle) * spd * 0.5;
            ty -= Math.sin(angle) * spd * 0.5;
          }
        }
        break;

      case 'ult_attack':
        // Stand still during ult
        tx = 0;
        ty = 0;
        break;

      default:
        tx = Math.cos(angle) * spd;
        ty = Math.sin(angle) * spd;
    }

    return { tx, ty };
  }

  // ── Fire at Player (improved prediction) ───────────────
  function fireAtPlayer(enemy, player, onShoot) {
    const d = GameEngine.dist(enemy, player);
    const bulletSpeed = 390;

    // Predict where player will be when bullet arrives
    const timeToHit = d / bulletSpeed;
    const predFactor = Math.min(0.9, 0.3 + enemy.difficulty * 0.15);

    const predX = player.x + (player.vx || 0) * timeToHit * predFactor;
    const predY = player.y + (player.vy || 0) * timeToHit * predFactor;

    // Tighter spread at higher difficulty
    const spread = (Math.random() - 0.5) * (0.25 / enemy.difficulty);

    onShoot(enemy, predX, predY, spread);
  }

  // ── AI Ultimate ────────────────────────────────────────
  function fireUltimate(enemy, player, onShoot) {
    // Fire a ring of 8 bullets + 4 aimed at player
    const ringCount = 8;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      const ringX = enemy.x + Math.cos(a) * 200;
      const ringY = enemy.y + Math.sin(a) * 200;
      onShoot(enemy, ringX, ringY, 0);
    }

    // 4 aimed shots with slight spread
    for (let i = 0; i < 4; i++) {
      const spread = (i - 1.5) * 0.12;
      const predX = player.x + (player.vx || 0) * 0.3;
      const predY = player.y + (player.vy || 0) * 0.3;
      onShoot(enemy, predX, predY, spread);
    }

    // Visual: big particle burst
    GameEngine.spawnParticles(
      enemy.x, enemy.y, '#ff3355', 24,
      { minSpd: 100, maxSpd: 260, minR: 2, maxR: 6 }
    );
    GameEngine.spawnParticles(
      enemy.x, enemy.y, '#ff9900', 12,
      { minSpd: 60, maxSpd: 140, minR: 1, maxR: 3 }
    );
  }

  // ── Scale Difficulty ─────────────────────────────────────
  function scaleDifficulty(enemy, kills) {
    const s = GameEngine.S;
    enemy.difficulty = Math.min(2.8, 1.0 + kills * 0.18);
    enemy.speed      = Math.min(Math.round(195 * Math.max(0.7, s)), Math.round((125 + kills * 7) * Math.max(0.7, s)));

    // Visual feedback — enemy gets slightly bigger + redder
    const baseR = Math.max(10, Math.round(18 * s));
    enemy.r = Math.min(Math.round(22 * s), baseR + kills * 0.3);
  }

  // ── Respawn ──────────────────────────────────────────────
  function respawn(enemy, W, H, playerX, playerY) {
    let bestX = W / 2, bestY = H / 2, bestDist = 0;
    const mg = GameEngine.margin();

    for (let i = 0; i < 8; i++) {
      const cx = mg.side + 20 + Math.random() * (W - mg.side * 2 - 40);
      const cy = mg.top + 20  + Math.random() * (H - mg.top - mg.bottom - 40);
      const d  = Math.sqrt((cx - playerX) ** 2 + (cy - playerY) ** 2);
      if (d > bestDist) {
        bestDist = d;
        bestX = cx;
        bestY = cy;
      }
    }

    enemy.x          = bestX;
    enemy.y          = bestY;
    enemy.hp         = enemy.maxHp;
    enemy.vx         = 0;
    enemy.vy         = 0;
    enemy.state      = 'chase';
    enemy.stateTimer = 1.5;
    enemy.shootTimer = 1.0 + Math.random();
    enemy.burstCount = 0;
    enemy.comboPhase = 0;

    GameEngine.spawnParticles(bestX, bestY, '#ff3355', 20, {
      minSpd: 80, maxSpd: 220, minR: 2, maxR: 5,
    });
  }

  // ── Get State Label (for HUD) ────────────────────────────
  function getStateLabel(state) {
    const keys = {
      chase:      'ai_chase',
      retreat:    'ai_retreat',
      circle:     'ai_circle',
      strafe:     'ai_strafe',
      ambush:     'ai_ambush',
      dodge:      'ai_dodge',
      burst:      'ai_burst',
      combo:      'ai_combo',
      feint:      'ai_feint',
      shield:     'ai_shield',
      ult_attack: 'ai_ult',
    };
    const key = keys[state];
    if (key && typeof I18n !== 'undefined') return I18n.t(key);
    return state ? state.toUpperCase() : '';
  }

  // ── Public API ───────────────────────────────────────────
  return {
    createEnemy,
    update,
    scaleDifficulty,
    respawn,
    getStateLabel,
  };

})();
