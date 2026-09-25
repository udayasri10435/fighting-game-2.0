/**
 * Shadow Samurai - Advanced Combat Engine
 * Manages frame collisions, attack priority & weapon clashing, counter hits,
 * perfect dodge bullet-time, projectiles, environmental destructions, executions,
 * replay recording, and combat telemetry.
 * Complies with specifications 71, 73, 77, 79, 80, 81, 106, 108, 128, 129, 134.
 */

class CombatEngine {
  constructor(arena) {
    this.arena = arena;
    this.player = null;
    this.enemy = null;
    this.comboEngine = new ComboEngine();
    this.enhancements = (typeof CombatEnhancements !== 'undefined') ? new CombatEnhancements(this) : null;
    this.director = (typeof CombatDirector !== 'undefined') ? new CombatDirector(this) : null;
    
    // Projectiles & Environmental Objects
    this.projectiles = [];
    this.environmentalObjects = [];
    this.firePatches = []; // Ground fire zones from broken lanterns
    
    // Slow Motion & Cinematic State (Spec 108)
    this.timeScale = 1.0;
    this.slowMoTimer = 0;
    this.cameraShake = 0;
    this.screenFlashAlpha = 0;
    
    // Telemetry Statistics (Spec 134)
    this.telemetry = {
      attacksThrown: 0,
      attacksLanded: 0,
      damageDealt: 0,
      damageReceived: 0,
      criticalHits: 0,
      blocks: 0,
      perfectBlocks: 0,
      perfectDodges: 0,
      combosExecuted: 0,
      highestCombo: 0,
      specialsUsed: 0,
      ultimatesUsed: 0,
      fightDurationSeconds: 0
    };

    // Execution State (Spec 79)
    this.executionAvailable = false;
    this.isExecuting = false;
    this.executionTimer = 0;

    // Replay Recording Architecture (Spec 106)
    this.replayRecorder = {
      isRecording: true,
      frames: [],
      maxFrames: 3600 // 60 seconds of replay
    };

    this.onVictory = null;
    this.onDefeat = null;
    this.onExecutionPrompt = null;
    this.activeMutator = null;
    this.damageMultiplier = 1.0;
  }

  triggerSlowMo(frames = 30, scale = 0.25) {
    this.slowMoTimer = frames;
    this.timeScale = scale;
  }

  triggerCameraShake(intensity = 10) {
    this.cameraShake = intensity;
  }

  applyHitStop(profileName = 'medium') {
    const profile = (typeof HIT_STOP_PROFILES !== 'undefined' && HIT_STOP_PROFILES[profileName]) 
      ? HIT_STOP_PROFILES[profileName] 
      : { frames: 6, cameraShake: 5, timeScale: 0.1 };
    this.triggerSlowMo(profile.frames, profile.timeScale);
    this.triggerCameraShake(profile.cameraShake);
  }

  // Level Mutators System (Spec 300)
  applyMutator(mutator) {
    this.activeMutator = mutator;
    if (!mutator) return;
    if (mutator.id === 'double_damage') {
      this.damageMultiplier = 2.0;
    } else if (mutator.id === 'fast_enemies' && this.enemy) {
      this.enemy.style.speedMult = (this.enemy.style.speedMult || 1.0) * 1.25;
    } else if (mutator.id === 'no_blocking' && this.player) {
      this.player.canBlock = false;
    } else if (mutator.id === 'invisible_hud') {
      const hud = document.getElementById('combat-battle-hud');
      if (hud) hud.style.display = 'none';
    }
  }

  setFighters(player, enemy) {
    this.player = player;
    this.enemy = enemy;
    this.telemetry.fightDurationSeconds = 0;
    this.executionAvailable = false;
    this.isExecuting = false;
    this.projectiles = [];
    this.firePatches = [];
    this.replayRecorder.frames = [];
    this.damageMultiplier = 1.0;
    if (this.director) {
      this.director.firstBlood = false;
      this.director.fightTimerFrames = 0;
    }
    if (this.enhancements) {
      this.enhancements.activeClash = null;
      this.enhancements.activeThrow = null;
      this.enhancements.inputBuffer.clear();
    }
    this.initEnvironmentalObjects();
  }

  // Populate breakable objects in arena (Spec 80)
  initEnvironmentalObjects() {
    this.environmentalObjects = [
      { id: 'crate_1', x: 220, y: 410, width: 34, height: 34, type: 'crate', hp: 30, destroyed: false },
      { id: 'barrel_1', x: 340, y: 405, width: 36, height: 42, type: 'explosive_barrel', hp: 20, destroyed: false },
      { id: 'lantern_1', x: 500, y: 220, width: 24, height: 40, type: 'lantern', hp: 15, destroyed: false },
      { id: 'crate_2', x: 920, y: 410, width: 34, height: 34, type: 'crate', hp: 30, destroyed: false },
      { id: 'barrel_2', x: 1020, y: 405, width: 36, height: 42, type: 'explosive_barrel', hp: 20, destroyed: false }
    ];
  }

  update() {
    if (!this.player || !this.enemy) return;

    // Slow-motion timer decay (Spec 108)
    if (this.slowMoTimer > 0) {
      this.slowMoTimer--;
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1.0;
        if (this.enemy) this.enemy.isHighlightedByEnemy = false;
      }
    }

    // Camera shake decay
    if (this.cameraShake > 0) {
      this.cameraShake *= 0.88;
      if (this.cameraShake < 0.2) this.cameraShake = 0;
    }

    // Screen flash decay
    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha *= 0.85;
      if (this.screenFlashAlpha < 0.01) this.screenFlashAlpha = 0;
    }

    // Update Telemetry Time
    this.telemetry.fightDurationSeconds += (1 / COMBAT_DATA.CONFIG.FPS) * this.timeScale;

    // Update Combat Director (Spec 266, 275)
    if (this.director) {
      this.director.update();
    }

    // Update Enhancements (Input Buffer, Throws) (Spec 150, 159)
    if (this.enhancements) {
      this.enhancements.inputBuffer.update();
      this.enhancements.updateThrowPhysics(this.arena);

      // Buffer execution during combo/cancel window
      if (this.player && (this.player.canCancel || this.player.state === 'IDLE' || this.player.state === 'WALK')) {
        const buffered = this.enhancements.inputBuffer.peek();
        if (buffered) {
          if (buffered.action === 'throw') {
            if (this.enhancements.executeThrow(this.player, this.enemy, this.arena, buffered.direction)) {
              this.enhancements.inputBuffer.consume();
            }
          } else if (buffered.action === 'escape') {
            if (this.enhancements.tryComboBreaker(this.player, this.arena)) {
              this.enhancements.inputBuffer.consume();
            }
          } else if (['light', 'kick', 'heavy'].includes(buffered.action)) {
            const atkId = this.player.resolveAttack(buffered.action, buffered.direction);
            if (this.player.executeAttack(atkId)) {
              this.enhancements.inputBuffer.consume();
            }
          } else if (buffered.action === 'special') {
            if (this.player.executeAttack('special_shadow_dash')) {
              this.enhancements.inputBuffer.consume();
            }
          } else if (buffered.action === 'dodge') {
            if (this.player.dodge()) {
              this.enhancements.inputBuffer.consume();
            }
          }
        }
      }
    }

    // Update Fighters
    this.player.update(this.arena);
    this.enemy.update(this.arena);
    this.comboEngine.update();

    // Check Collisions & Combat Interactions
    this.checkMeleeCollisions();
    this.checkPerfectDodge();
    this.updateProjectiles();
    this.checkEnvironmentalCollisions();
    this.updateFirePatches();

    // Check Execution Availability (Spec 79)
    this.checkExecutionOpportunity();

    // Record Replay Frame (Spec 106)
    if (this.replayRecorder.isRecording && this.replayRecorder.frames.length < this.replayRecorder.maxFrames) {
      this.replayRecorder.frames.push({
        px: this.player.x, py: this.player.y, pState: this.player.state, pHp: this.player.hp,
        ex: this.enemy.x, ey: this.enemy.y, eState: this.enemy.state, eHp: this.enemy.hp
      });
    }

    // Win / Loss Condition
    if (this.enemy.hp <= 0 && this.enemy.state !== 'DEAD' && !this.isExecuting) {
      this.handleEnemyDefeated();
    } else if (this.player.hp <= 0 && this.player.state !== 'DEAD') {
      this.handlePlayerDefeated();
    }
  }

  // Melee Collisions & Priority System & Weapon Clashes (Spec 71)
  checkMeleeCollisions() {
    const playerHitbox = this.player.getHitbox();
    const enemyHitbox = this.enemy.getHitbox();
    const playerHurtbox = this.player.getHurtbox();
    const enemyHurtbox = this.enemy.getHurtbox();

    // Both hitboxes connect simultaneously on the same frame: Priority Resolution / Clash!
    if (playerHitbox && enemyHitbox && !this.player.hasHitOpponent && !this.enemy.hasHitOpponent) {
      const pHitsE = this.intersects(playerHitbox, enemyHurtbox);
      const eHitsP = this.intersects(enemyHitbox, playerHurtbox);

      if (pHitsE && eHitsP) {
        // Evaluate attack priority
        const pPriority = (playerHitbox.attack.armor * 10) + playerHitbox.attack.damage;
        const ePriority = (enemyHitbox.attack.armor * 10) + enemyHitbox.attack.damage;

        if (Math.abs(pPriority - ePriority) < 25) {
          // WEAPON CLASH! (Spec 71)
          this.player.hasHitOpponent = true;
          this.enemy.hasHitOpponent = true;
          this.triggerWeaponClash();
          return;
        } else if (pPriority > ePriority) {
          this.player.hasHitOpponent = true;
          this.processHit(this.player, this.enemy, playerHitbox.attack);
          return;
        } else {
          this.enemy.hasHitOpponent = true;
          this.processHit(this.enemy, this.player, enemyHitbox.attack);
          return;
        }
      }
    }

    // 1. Player Attacks Enemy
    if (playerHitbox && !this.player.hasHitOpponent) {
      if (this.intersects(playerHitbox, enemyHurtbox)) {
        this.player.hasHitOpponent = true;
        this.processHit(this.player, this.enemy, playerHitbox.attack);
      }
    }

    // 2. Enemy Attacks Player
    if (enemyHitbox && !this.enemy.hasHitOpponent) {
      if (this.intersects(enemyHitbox, playerHurtbox)) {
        this.enemy.hasHitOpponent = true;
        this.processHit(this.enemy, this.player, enemyHitbox.attack);
      }
    }
  }

  // Weapon Clash (Spec 71, 158)
  triggerWeaponClash() {
    if (this.enhancements) {
      this.enhancements.resolveWeaponClash(this.player, this.enemy, this.arena);
      return;
    }

    const midX = (this.player.x + this.enemy.x) * 0.5;
    const midY = (this.player.y + this.enemy.y) * 0.5 - 50;

    this.arena.createPerfectBlockFx(midX, midY);
    this.triggerCameraShake(12);
    this.triggerSlowMo(15, 0.25);

    // Recoil both fighters backward
    this.player.vx = -this.player.facing * 6;
    this.enemy.vx = -this.enemy.facing * 6;
    this.player.setState('IDLE');
    this.enemy.setState('IDLE');

    if (window.soundEngine) {
      window.soundEngine.playTempleGong();
      window.soundEngine.playTaiko(1.2);
    }
  }

  // Perfect Dodge Detection (Spec 73)
  checkPerfectDodge() {
    if (this.player.state === 'DODGE' && this.player.perfectDodgeActive) {
      // Check if enemy was actively attacking
      if (this.enemy.state === 'ATTACK' && (this.enemy.attackPhase === 'startup' || this.enemy.attackPhase === 'active')) {
        const dist = Math.abs(this.player.x - this.enemy.x);
        if (dist < 140) {
          // Trigger Perfect Dodge Bullet-Time!
          this.player.perfectDodgeActive = false; // Only once per dodge
          this.telemetry.perfectDodges++;
          this.triggerSlowMo(32, 0.22); // Bullet time
          this.enemy.isHighlightedByEnemy = true;
          this.player.counterWindow = COMBAT_DATA.CONFIG.COUNTER_WINDOW_DURATION + 10;
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 15);

          if (window.soundEngine) {
            window.soundEngine.playBeaconPulse();
          }
        }
      }
    }
  }

  // Process Hit with Counter Hits, Combos, and Audio
  processHit(attacker, defender, attack) {
    // Counter Hit Check (Spec 71): defender caught in startup
    const isCounterHit = defender.state === 'ATTACK' && defender.attackPhase === 'startup';
    if (isCounterHit) {
      attack = { ...attack, damage: Math.round(attack.damage * 1.35) };
      this.triggerSlowMo(14, 0.35);
      this.triggerCameraShake(8);
    }

    const result = defender.takeHit(attacker, attack, this.arena, this);

    if (attacker.isPlayer) {
      this.telemetry.attacksLanded++;
      if (this.damageMultiplier > 1.0 && result.damage) {
        result.damage = Math.round(result.damage * this.damageMultiplier);
      }
      this.telemetry.damageDealt += result.damage || 0;
      if (result.isCrit) this.telemetry.criticalHits++;

      if (result.type === 'hit' || result.type === 'armored') {
        const comboInfo = this.comboEngine.recordHit(attacker, attack, result.damage, result.isCrit);
        if (comboInfo.hits > this.telemetry.highestCombo) {
          this.telemetry.highestCombo = comboInfo.hits;
        }
        if (this.director) {
          this.director.onPlayerHit({ attackId: attack.id, isHeavy: attack.type === 'heavy' });
        }
      }
    } else {
      if (this.damageMultiplier > 1.0 && result.damage) {
        result.damage = Math.round(result.damage * this.damageMultiplier);
      }
      this.telemetry.damageReceived += result.damage || 0;
      if (result.type === 'blocked') this.telemetry.blocks++;
      if (result.type === 'perfect_block') {
        this.telemetry.perfectBlocks++;
        this.triggerSlowMo(18, 0.25);
        this.triggerCameraShake(12);
        if (this.director) this.director.onPerfectDefend('block');
      }
      if (result.type === 'hit') {
        this.comboEngine.breakCombo('player_hit');
        if (this.director) this.director.onPlayerDamageReceived();
      }
    }

    // Configurable Hit-Stop Profile (Spec 278, 279)
    const profileKey = (attacker.isBoss && attack.type === 'ultimate') ? 'boss' :
                       (attack.type === 'ultimate') ? 'ultimate' : 
                       (result.isCrit ? 'critical' : 
                       (attack.type === 'heavy' ? 'heavy' : 'light'));
    this.applyHitStop(profileKey);

    // Impact FX
    if (result.type === 'hit' || result.type === 'perfect_block') {
      this.triggerCameraShake(attack.knockback * 0.7);
    }
  }

  // Projectile System (Spec 129)
  spawnProjectile(owner, projData) {
    this.projectiles.push({
      owner,
      x: owner.x + owner.facing * 35,
      y: owner.y - owner.height * 0.5,
      vx: owner.facing * projData.speed,
      vy: projData.vy || 0,
      radius: projData.radius || 18,
      damage: projData.damage || 120,
      color: projData.color || '#00e5ff',
      trail: projData.trail || 'cyan',
      life: 70
    });
    if (owner.isPlayer) this.telemetry.specialsUsed++;
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      const target = p.owner === this.player ? this.enemy : this.player;
      const targetHurtbox = target.getHurtbox();

      if (this.intersectsCircleBox(p, targetHurtbox)) {
        target.takeHit(p.owner, {
          damage: p.damage,
          knockback: 7,
          launchForce: 2,
          hitStun: 28,
          blockStun: 14,
          guardDamage: 25,
          criticalChance: 0.1,
          criticalMultiplier: 1.5
        }, this.arena, this);
        this.arena.createHitImpact(p.x, p.y, false);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0 || p.x < this.arena.x - 50 || p.x > this.arena.x + this.arena.width + 50) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  // Environmental Object Interactivity (Spec 80)
  checkEnvironmentalCollisions() {
    const playerHitbox = this.player.getHitbox();
    const enemyHitbox = this.enemy.getHitbox();
    const hitboxes = [playerHitbox, enemyHitbox].filter(Boolean);

    for (const hb of hitboxes) {
      for (const obj of this.environmentalObjects) {
        if (!obj.destroyed && this.intersects(hb, obj)) {
          obj.hp -= hb.attack.damage;
          if (obj.hp <= 0) {
            obj.destroyed = true;
            this.handleObjectDestruction(obj);
          }
        }
      }
    }
  }

  handleObjectDestruction(obj) {
    const centerX = obj.x + obj.width * 0.5;
    const centerY = obj.y + obj.height * 0.5;
    this.arena.createObjectDebris(centerX, centerY, obj.type);

    if (obj.type === 'crate') {
      // Reward energy & souls
      this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 15);
      if (window.soundEngine) window.soundEngine.playTaiko(1.0);
    } else if (obj.type === 'lantern') {
      // Drops fire onto the ground
      this.firePatches.push({
        x: centerX - 30,
        y: this.arena.groundY - 10,
        width: 60,
        height: 15,
        duration: 300 // 5 seconds
      });
      if (window.soundEngine) window.soundEngine.playSwordSlash();
    } else if (obj.type === 'explosive_barrel') {
      // Big AoE Explosion! (Spec 80)
      this.arena.createHitImpact(centerX, centerY, true);
      this.triggerCameraShake(18);
      this.screenFlashAlpha = 0.6;

      // Check proximity to fighters
      [this.player, this.enemy].forEach(f => {
        const dist = Math.abs(f.x - centerX);
        if (dist < 140) {
          f.hp = Math.max(0, f.hp - 120);
          f.vx = (f.x > centerX ? 1 : -1) * 12;
          f.vy = -6;
          f.isGrounded = false;
          f.setState('KNOCKED_DOWN');
          f.applyStatusEffect({ type: 'burn', duration: 180, dps: 15 });
        }
      });

      if (window.soundEngine) {
        window.soundEngine.playTaiko(1.5);
        window.soundEngine.playTempleGong();
      }
    }
  }

  // Ground Fire Patches (Spec 80)
  updateFirePatches() {
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const patch = this.firePatches[i];
      patch.duration--;

      // Burn fighters standing in fire
      [this.player, this.enemy].forEach(f => {
        if (f.x >= patch.x && f.x <= patch.x + patch.width && f.isGrounded) {
          f.applyStatusEffect({ type: 'burn', duration: 60, dps: 8 });
        }
      });

      if (patch.duration <= 0) {
        this.firePatches.splice(i, 1);
      }
    }
  }

  // Execution System (Spec 79)
  checkExecutionOpportunity() {
    if (!this.enemy || this.enemy.state === 'DEAD') return;

    const hpRatio = this.enemy.hp / this.enemy.maxHp;
    if (hpRatio <= COMBAT_DATA.CONFIG.EXECUTION_HP_THRESHOLD && !this.executionAvailable) {
      this.executionAvailable = true;
      if (this.onExecutionPrompt) {
        this.onExecutionPrompt(true);
      }
    }
  }

  triggerExecution() {
    if (!this.executionAvailable || this.isExecuting) return;
    this.isExecuting = true;
    this.telemetry.ultimatesUsed++;

    // Cinematic execution sequence (Spec 79)
    this.triggerSlowMo(90, 0.15); // Dramatic time slow
    this.triggerCameraShake(22);
    this.screenFlashAlpha = 0.95;

    // Defeat enemy
    this.enemy.hp = 0;
    this.enemy.setState('KNOCKED_DOWN');
    this.arena.createHitImpact(this.enemy.x, this.enemy.y - 50, true);

    if (window.soundEngine) {
      window.soundEngine.playDuelStart();
      window.soundEngine.playVoiceKiai();
    }

    setTimeout(() => {
      this.handleEnemyDefeated(true);
    }, 1600);
  }

  handleEnemyDefeated(wasExecuted = false) {
    this.enemy.setState('DEAD');
    if (this.onVictory) {
      this.onVictory({
        wasExecuted,
        telemetry: this.telemetry,
        stars: this.calculateStarRating()
      });
    }
  }

  handlePlayerDefeated() {
    this.player.setState('DEAD');
    if (this.onDefeat) {
      this.onDefeat({
        telemetry: this.telemetry
      });
    }
  }

  // 1-3 Stars Rating (Spec 123)
  calculateStarRating() {
    let stars = 1;
    if (this.telemetry.highestCombo >= 5) stars++;
    if (this.telemetry.fightDurationSeconds <= 90 && this.telemetry.damageReceived < (this.player.maxHp * 0.5)) {
      stars++;
    }
    return Math.min(3, stars);
  }

  // Utilities
  triggerSlowMo(frames = 30, scale = 0.3) {
    this.slowMoTimer = frames;
    this.timeScale = scale;
  }

  triggerCameraShake(amount = 10) {
    // Accessibility check: suppress screen shake if disabled (Spec 126)
    if (window.app && window.app.saveRepo && !window.app.saveRepo.settings.screenShake) {
      return;
    }
    this.cameraShake = Math.max(this.cameraShake, amount);
  }

  intersects(r1, r2) {
    return !(
      r2.x > r1.x + r1.width ||
      r2.x + r2.width < r1.x ||
      r2.y > r1.y + r1.height ||
      r2.y + r2.height < r1.y
    );
  }

  intersectsCircleBox(c, b) {
    const closestX = Math.max(b.x, Math.min(c.x, b.x + b.width));
    const closestY = Math.max(b.y, Math.min(c.y, b.y + b.height));
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return (dx * dx + dy * dy) < (c.radius * c.radius);
  }

  // Render Projectiles & Environmental Objects
  render(ctx) {
    // Render Ground Fire Patches
    for (const patch of this.firePatches) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 90, 0, 0.45)';
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 15;
      ctx.fillRect(patch.x, patch.y, patch.width, patch.height);
      ctx.restore();
    }

    // Render Projectiles
    for (const p of this.projectiles) {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Environmental Objects (Spec 80)
    for (const obj of this.environmentalObjects) {
      if (obj.destroyed) continue;
      ctx.save();

      if (obj.type === 'crate') {
        ctx.fillStyle = '#3a2213';
        ctx.strokeStyle = '#6b4426';
        ctx.lineWidth = 2;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
        ctx.moveTo(obj.x + obj.width, obj.y);
        ctx.lineTo(obj.x, obj.y + obj.height);
        ctx.stroke();
      } else if (obj.type === 'explosive_barrel') {
        ctx.fillStyle = '#8c1d1d';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.width, obj.height, 6);
        ctx.fill();
        ctx.stroke();
        // Danger Kanji "危"
        ctx.fillStyle = '#ffd56b';
        ctx.font = '700 14px "Noto Serif JP", serif';
        ctx.fillText('危', obj.x + 11, obj.y + 26);
      } else if (obj.type === 'lantern') {
        ctx.fillStyle = '#ff6b6b';
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(obj.x + obj.width * 0.5, obj.y + obj.height * 0.5, obj.width * 0.5, obj.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Render Attack Telegraph Decals & Warning Glyphs (Spec 268)
    if (this.director && this.director.telegraphSystem) {
      this.director.telegraphSystem.render(ctx, this.arena);
    }
  }
}

const _combatRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_combatRoot.CombatEngine = CombatEngine;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CombatEngine;
}
