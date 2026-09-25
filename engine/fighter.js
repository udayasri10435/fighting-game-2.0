/**
 * Shadow Samurai - Fighter Entity & State Machine
 * Implements frame-accurate state management, directional attacks, air juggles,
 * hitboxes/hurtboxes, perfect defense timings, attributes, status effects,
 * weapon durability, and procedural Shadow Fight silhouette rendering.
 * Complies with specifications 71, 73, 74, 75, 76, 78, 81, 82, 83, 84, 86, 87.
 */

class Fighter {
  constructor(config = {}) {
    this.isPlayer = config.isPlayer || false;
    this.name = config.name || (this.isPlayer ? 'Jin Kageyoshi' : 'Shadow Duelist');
    this.title = config.title || 'Warrior';
    
    // Position & Physics
    this.x = config.x || 300;
    this.y = config.y || 420;
    this.vx = 0;
    this.vy = 0;
    this.facing = config.facing || 1; // 1 = right, -1 = left
    this.isGrounded = true;
    this.isCrouching = false;
    
    // Dimensions
    this.width = 48;
    this.height = 110;
    this.groundY = 420;
    
    // Attributes & Stats (Spec 86)
    this.attributes = {
      strength: config.strength || 15,
      defense: config.defense || 12,
      agility: config.agility || 14,
      endurance: config.endurance || 12,
      energy: config.energyAttr || 10,
      weaponMastery: config.weaponMastery || 1
    };
    
    // Vitals (Spec 74, 75, 76, 78)
    this.maxHp = config.maxHp || (COMBAT_DATA.CONFIG.BASE_HP + this.attributes.endurance * 20);
    this.hp = this.maxHp;
    this.displayHp = this.hp;
    
    this.maxStamina = config.maxStamina || (COMBAT_DATA.CONFIG.BASE_STAMINA + this.attributes.endurance * 5);
    this.stamina = this.maxStamina;
    this.isExhausted = false;
    this.exhaustTimer = 0;
    
    // Bosses have higher Guard Meter (Spec 74)
    const baseGuard = config.isBoss ? 200 : COMBAT_DATA.CONFIG.BASE_GUARD;
    this.maxGuard = config.maxGuard || (baseGuard + this.attributes.defense * 8);
    this.guard = this.maxGuard;
    this.isGuardBroken = false;
    this.guardBreakTimer = 0;
    
    this.maxEnergy = COMBAT_DATA.CONFIG.BASE_ENERGY;
    this.energy = config.initialEnergy || 0;
    
    this.maxRage = 100;
    this.rage = 0;
    this.isRageMode = false;
    this.rageTimer = 0;

    // Poise System (Spec 156)
    this.maxPoise = config.isBoss ? 250 : 100;
    this.poise = this.maxPoise;

    // Weapon & Style (Spec 83, 87)
    this.weapon = COMBAT_DATA.WEAPONS[config.weapon || 'katana'] || COMBAT_DATA.WEAPONS.katana;
    this.weaponDurability = config.weaponDurability !== undefined ? config.weaponDurability : this.weapon.durabilityMax;
    this.style = COMBAT_DATA.STYLES[config.style || (this.isPlayer ? 'shadow' : 'dragon')] || COMBAT_DATA.STYLES.dragon;
    
    // Advanced Procedural Animation Engine (Spec 144, 145, 146)
    this.animEngine = (typeof AnimationEngine !== 'undefined') ? new AnimationEngine(this) : null;

    // State Machine
    this.state = 'IDLE'; // IDLE, WALK, DASH, JUMP, CROUCH, ATTACK, BLOCK, DODGE, HIT_STUN, BLOCK_STUN, GUARD_BROKEN, KNOCKED_DOWN, EXHAUSTED, EXECUTION, STAGGERED, THROWING, GRABBED, DEAD
    this.stateTimer = 0;
    
    // Attack Frame State (Spec 71)
    this.currentAttack = null;
    this.attackFrame = 0;
    this.attackPhase = null; // 'startup', 'active', 'recovery'
    this.hasHitOpponent = false;
    this.canCancel = false;
    this.queuedAttack = null;
    
    // Defense Timings & Counter Window (Spec 73)
    this.blockStartFrame = 0;
    this.isBlocking = false;
    this.perfectBlockActive = false;
    this.dodgeStartFrame = 0;
    this.perfectDodgeActive = false;
    this.invincibleFrames = 0;
    this.armorHits = 0;
    this.counterWindow = 0; // Frames counter attack bonus is active
    this.isHighlightedByEnemy = false; // Set on perfect dodge
    
    // Wall bounce decay counter to prevent infinites (Spec 81)
    this.wallBouncesThisCombo = 0;

    // Status Effects (Spec 131)
    this.statusEffects = [];

    // Master Mechanics (Specs 287-293)
    this.reviveAvailable = true;
    this.lastStandTriggered = false;
    this.morale = 100;
    this.isRetreating = false;
    this.retreatTimer = 0;

    // Visual Art & Animation State
    this.animPose = 'idle';
    this.animTick = 0;
    this.weaponTrail = [];
    this.ghostShadows = []; // After-images during dashes/dodges
    this.eyeGlowColor = this.isPlayer ? '#00e5ff' : '#ff3333';
  }

  // Update loop called every frame
  update(arena) {
    this.stateTimer++;
    this.animTick++;

    // Update Vitals & Timers
    this.updateStatusEffects();
    this.updateStaminaAndGuard();
    this.updateRage();
    this.updateDefenseWindows();
    this.updatePhysics(arena);
    this.updateStateLogic(arena);

    // Update Procedural Animation Engine (Spec 144, 145, 146)
    if (this.animEngine) {
      this.animEngine.update(1 / 60, arena);
    }

    // Poise Regeneration (Spec 156)
    if (this.state !== 'HIT_STUN' && this.state !== 'STAGGERED' && this.state !== 'KNOCKED_DOWN') {
      const poiseRegen = 0.35 * (this.isBoss ? 2.0 : 1.0);
      this.poise = Math.min(this.maxPoise, this.poise + poiseRegen);
    }

    // Update Ghost Shadows
    if (this.state === 'DODGE' || this.isRageMode || (this.currentAttack && this.currentAttack.type === 'ultimate')) {
      if (this.animTick % 3 === 0) {
        this.ghostShadows.push({
          x: this.x,
          y: this.y,
          facing: this.facing,
          alpha: 0.5,
          color: this.isPlayer ? '#00e5ff' : '#ff3333'
        });
      }
    }

    // Smooth health bar interpolation
    if (this.displayHp > this.hp) {
      this.displayHp -= (this.displayHp - this.hp) * 0.08;
    } else {
      this.displayHp = this.hp;
    }
  }

  // Physics, Gravity & Arena Bounds (Spec 81, 82)
  updatePhysics(arena) {
    // Apply gravity if airborne
    if (!this.isGrounded) {
      const gravity = COMBAT_DATA.CONFIG.GRAVITY;
      this.vy += gravity;
      this.y += this.vy;

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.isGrounded = true;

        if (this.state === 'JUMP') {
          this.setState('IDLE');
        } else if (this.state === 'KNOCKED_DOWN') {
          arena.createGroundImpact(this.x, this.y);
          if (window.soundEngine) window.soundEngine.playTaiko(1.1);
        }
      }
    }

    // Apply horizontal velocity with friction
    this.x += this.vx;
    if (this.isGrounded) {
      this.vx *= 0.82;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    } else {
      this.vx *= 0.95; // Less air resistance
    }

    // Arena Wall Collisions & Wall Bounce (Spec 81)
    const wallMargin = 40;
    const minX = arena.x + wallMargin;
    const maxX = arena.x + arena.width - wallMargin;

    if (this.x < minX) {
      const impactVelocity = Math.abs(this.vx);
      this.x = minX;
      if (impactVelocity > COMBAT_DATA.CONFIG.WALL_BOUNCE_MIN_FORCE) {
        this.onWallImpact(arena, impactVelocity, 1);
      }
      this.vx = 0;
    } else if (this.x > maxX) {
      const impactVelocity = Math.abs(this.vx);
      this.x = maxX;
      if (impactVelocity > COMBAT_DATA.CONFIG.WALL_BOUNCE_MIN_FORCE) {
        this.onWallImpact(arena, impactVelocity, -1);
      }
      this.vx = 0;
    }
  }

  // Wall Impact & Wall Bounce (Spec 81)
  onWallImpact(arena, force, bounceDir) {
    arena.createWallImpact(this.x, this.y - this.height * 0.5);

    // Wall bounce only if in hit stun or knocked down, capped at max bounces
    if ((this.state === 'HIT_STUN' || this.state === 'KNOCKED_DOWN') && 
        this.wallBouncesThisCombo < COMBAT_DATA.CONFIG.MAX_WALL_BOUNCES_PER_COMBO) {
      this.wallBouncesThisCombo++;
      this.vx = bounceDir * (force * 0.55);
      this.vy = -8.0; // Launch upward from wall
      this.isGrounded = false;
      this.stateTimer = 0; // Refresh stun for wall combo follow-up!
      if (window.soundEngine) {
        window.soundEngine.playTaiko(1.2);
        window.soundEngine.playChainRattle();
      }
    }
  }

  // Stamina Regeneration & Guard Recovery (Spec 74, 75)
  updateStaminaAndGuard() {
    // Stamina Exhaustion recovery (Spec 75)
    if (this.isExhausted) {
      this.exhaustTimer--;
      if (this.exhaustTimer <= 0) {
        this.isExhausted = false;
        this.stamina = this.maxStamina * 0.45;
        if (this.state === 'EXHAUSTED') this.setState('IDLE');
      }
    } else if (this.state !== 'ATTACK' && this.state !== 'DASH' && this.state !== 'BLOCK') {
      const staminaRegen = COMBAT_DATA.CONFIG.STAMINA_REGEN * this.style.staminaCostMult;
      this.stamina = Math.min(this.maxStamina, this.stamina + staminaRegen);
    }

    // Guard Break Recovery (Spec 74)
    if (this.isGuardBroken) {
      this.guardBreakTimer--;
      if (this.guardBreakTimer <= 0) {
        this.isGuardBroken = false;
        this.guard = this.maxGuard * 0.5;
        if (this.state === 'GUARD_BROKEN') this.setState('IDLE');
      }
    } else if (this.state !== 'BLOCK') {
      this.guard = Math.min(this.maxGuard, this.guard + COMBAT_DATA.CONFIG.GUARD_REGEN);
    }
  }

  // Rage Mode (Spec 78)
  updateRage() {
    if (this.isRageMode) {
      this.rageTimer--;
      this.rage = (this.rageTimer / COMBAT_DATA.CONFIG.RAGE_DURATION) * this.maxRage;
      if (this.rageTimer <= 0) {
        this.isRageMode = false;
        this.rage = 0;
      }
    }
  }

  activateRage() {
    if (this.rage >= this.maxRage && !this.isRageMode) {
      this.isRageMode = true;
      this.rageTimer = COMBAT_DATA.CONFIG.RAGE_DURATION;
      this.invincibleFrames = 25; // Brief invincible burst
      if (window.soundEngine) {
        window.soundEngine.playTaiko(1.4);
        window.soundEngine.playSwordSlash();
      }
      return true;
    }
    return false;
  }

  // Defensive Windows & Counter Timer (Spec 73)
  updateDefenseWindows() {
    if (this.invincibleFrames > 0) this.invincibleFrames--;
    if (this.counterWindow > 0) this.counterWindow--;

    // Perfect Block window check
    if (this.state === 'BLOCK') {
      const windowFrames = this.style.id === 'shadow' ? 
        COMBAT_DATA.CONFIG.PERFECT_BLOCK_WINDOW * 1.5 : COMBAT_DATA.CONFIG.PERFECT_BLOCK_WINDOW;
      this.perfectBlockActive = this.stateTimer <= windowFrames;
    } else {
      this.perfectBlockActive = false;
    }

    // Perfect Dodge window check
    if (this.state === 'DODGE') {
      const windowFrames = this.style.id === 'shadow' ? 
        COMBAT_DATA.CONFIG.PERFECT_DODGE_WINDOW * 1.5 : COMBAT_DATA.CONFIG.PERFECT_DODGE_WINDOW;
      this.perfectDodgeActive = this.stateTimer <= windowFrames;
      this.invincibleFrames = Math.max(this.invincibleFrames, 14);
    } else {
      this.perfectDodgeActive = false;
    }
  }

  // State Machine Transitions & Frame Logic (Spec 71)
  updateStateLogic(arena) {
    switch (this.state) {
      case 'ATTACK':
        this.updateAttackFrames(arena);
        break;

      case 'HIT_STUN':
        if (this.stateTimer >= this.stunDuration) {
          this.setState('IDLE');
          this.wallBouncesThisCombo = 0; // Reset wall bounce count
        }
        break;

      case 'BLOCK_STUN':
        if (this.stateTimer >= this.blockStunDuration) {
          this.setState(this.isBlocking ? 'BLOCK' : 'IDLE');
        }
        break;

      case 'DODGE':
        // Move during dodge
        const dodgeSpeed = COMBAT_DATA.CONFIG.DASH_SPEED * this.style.speedMult;
        this.x += this.facing * dodgeSpeed * 0.95;
        if (this.stateTimer >= 18) {
          this.setState('IDLE');
        }
        break;

      case 'KNOCKED_DOWN':
        if (this.isGrounded) {
          // Recovery behavior states: Down (0-25) -> Wake (25-40) -> Roll/Stand/Defend/Recovery Attack (40+) (Spec 289)
          if (this.stateTimer >= 42) {
            this.invincibleFrames = 20; // Wake-up invincibility window
            this.wallBouncesThisCombo = 0;

            if (!this.isPlayer) {
              const roll = Math.random();
              if (roll < 0.35) {
                // Wake-up Roll backward to reposition (Spec 289)
                this.vx = -this.facing * 5.5;
                this.setState('DODGE');
              } else if (roll < 0.65) {
                // Wake-up Recovery Attack (Spec 290): telegraphed sweep
                this.setState('IDLE');
                this.executeAttack('kick_sweep');
                const _fRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
                if (_fRoot.app && _fRoot.app.combatEngine && _fRoot.app.combatEngine.director && _fRoot.app.combatEngine.director.telegraphSystem) {
                  _fRoot.app.combatEngine.director.telegraphSystem.triggerTelegraph({
                    attacker: this,
                    attackId: 'wake_up_sweep',
                    type: 'AREA',
                    duration: 18
                  });
                }
              } else if (roll < 0.85) {
                // Wake-up Stand & Immediate Defend (Spec 289)
                this.setState('BLOCK');
                this.block(true);
              } else {
                // Wake-up Stand Normal
                this.setState('IDLE');
              }
            } else {
              this.setState('IDLE');
            }
          }
        }
        break;
    }
  }

  // Frame-accurate Attack Execution (Startup -> Active -> Recovery) (Spec 71)
  updateAttackFrames(arena) {
    if (!this.currentAttack) {
      this.setState('IDLE');
      return;
    }

    const atk = this.currentAttack;
    this.attackFrame++;

    // 1. Startup Phase
    if (this.attackFrame <= atk.startup) {
      this.attackPhase = 'startup';
      this.canCancel = false;
    }
    // 2. Active Hitbox Phase
    else if (this.attackFrame <= atk.startup + atk.active) {
      this.attackPhase = 'active';
      this.canCancel = false;

      // Generate weapon trail
      if (this.attackFrame % 2 === 0) {
        this.weaponTrail.push({
          x: this.x + this.facing * (atk.range * 0.8),
          y: this.y - this.height * 0.5,
          alpha: 0.85,
          color: this.isPlayer ? (this.weapon.color || '#00e5ff') : '#ff4444'
        });
      }
    }
    // 3. Recovery Phase & Cancel Window
    else if (this.attackFrame <= atk.startup + atk.active + atk.recovery) {
      this.attackPhase = 'recovery';
      const currentRecoveryFrame = this.attackFrame - (atk.startup + atk.active);
      this.canCancel = currentRecoveryFrame >= (atk.recovery - atk.cancelWindow);

      // Check if player buffered an attack during cancel window
      if (this.canCancel && this.queuedAttack) {
        const nextAtk = this.queuedAttack;
        this.queuedAttack = null;
        this.executeAttack(nextAtk);
        return;
      }
    } else {
      // Completed naturally
      this.currentAttack = null;
      this.setState(this.isGrounded ? 'IDLE' : 'JUMP');
    }
  }

  // Resolve Directional Attack mapping (Spec 71, 82)
  resolveAttack(category, direction = 'neutral') {
    // Airborne mapping
    if (!this.isGrounded) {
      if (category === 'kick') return 'air_kick';
      if (category === 'heavy') return 'air_slash';
      return 'air_punch';
    }

    // Counter Strike mapping
    if (this.counterWindow > 0 && (category === 'light' || category === 'heavy')) {
      return 'counter_strike';
    }

    // Grounded directional mapping
    if (category === 'light') {
      if (direction === 'forward') return 'light_2';
      if (direction === 'back') return 'light_3';
      return 'light_1';
    }

    if (category === 'kick') {
      if (direction === 'down' || this.isCrouching) return 'kick_sweep';
      if (direction === 'forward') return 'kick_roundhouse';
      return 'kick_front';
    }

    if (category === 'heavy') {
      if (direction === 'down' || this.isCrouching) return 'heavy_cleave';
      if (direction === 'forward') return 'heavy_thrust';
      return 'heavy_slash';
    }

    return category;
  }

  // Attempt to execute attack by ID
  executeAttack(attackId) {
    if (this.isExhausted || this.state === 'EXHAUSTED') return false;

    const atk = COMBAT_DATA.ATTACKS[attackId];
    if (!atk) return false;

    // Check stamina and energy costs (Spec 75, 76)
    const staminaNeeded = atk.staminaCost * (this.style.staminaCostMult || 1.0);
    if (this.stamina < staminaNeeded) {
      this.triggerExhaustion();
      return false;
    }

    if (atk.energyCost > 0 && this.energy < atk.energyCost) {
      return false; // Insufficient special energy
    }

    // If currently attacking: verify cancel window
    if (this.state === 'ATTACK') {
      if (this.canCancel) {
        // Cancel window active: continue
      } else {
        // Buffer attack for immediate follow-up
        this.queuedAttack = attackId;
        return false;
      }
    }

    // Deduct resources
    this.stamina -= staminaNeeded;
    this.energy = Math.max(0, this.energy - atk.energyCost);
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.triggerExhaustion();
    }

    // Set state to attack
    this.setState('ATTACK');
    this.currentAttack = atk;
    this.attackFrame = 0;
    this.attackPhase = 'startup';
    this.hasHitOpponent = false;
    this.canCancel = false;
    this.armorHits = atk.armor || 0;

    // Weapon Durability Wear (Spec 84)
    if (this.weaponDurability > 0 && Math.random() < 0.2) {
      this.weaponDurability = Math.max(0, this.weaponDurability - 1);
    }

    // Audio SFX
    if (window.soundEngine) {
      if (atk.sfx === 'heavy_slash') window.soundEngine.playSwordSlash();
      else if (atk.sfx === 'taiko') window.soundEngine.playTaiko(1.0);
      else if (atk.sfx === 'duel_start') window.soundEngine.playDuelStart();
      else window.soundEngine.playSwordSlash();
    }

    return true;
  }

  // Stamina Exhaustion (Spec 75)
  triggerExhaustion() {
    this.isExhausted = true;
    this.exhaustTimer = COMBAT_DATA.CONFIG.STAMINA_EXHAUST_RECOVERY * COMBAT_DATA.CONFIG.FPS;
    this.setState('EXHAUSTED');
    if (window.soundEngine) window.soundEngine.playTaiko(0.8);
  }

  // Guard Break (Spec 74)
  triggerGuardBreak(arena) {
    this.isGuardBroken = true;
    this.guard = 0;
    this.guardBreakTimer = COMBAT_DATA.CONFIG.GUARD_BREAK_STUN;
    this.setState('GUARD_BROKEN');
    arena.createGuardBreakFx(this.x, this.y - this.height * 0.5);
    if (window.soundEngine) window.soundEngine.playTempleGong();
  }

  // Receive Hit or Block from Opponent (Spec 71, 73, 74)
  takeHit(attacker, attack, arena, combatEngine) {
    // 1. Invincibility Check (Spec 71)
    if (this.invincibleFrames > 0) {
      return { type: 'miss', damage: 0 };
    }

    // 2. Super Armor Check
    if (this.armorHits > 0) {
      this.armorHits--;
      const mitigatedDmg = Math.round(attack.damage * 0.6);
      this.hp = Math.max(0, this.hp - mitigatedDmg);
      arena.createArmorSparks(this.x, this.y - this.height * 0.5);
      return { type: 'armored', damage: mitigatedDmg };
    }

    // 3. Perfect Block Window Check (Spec 73)
    if (this.state === 'BLOCK' && this.perfectBlockActive) {
      const damageTaken = Math.round(attack.damage * 0.05); // 95% reduction
      this.hp = Math.max(0, this.hp - damageTaken);
      this.energy = Math.min(this.maxEnergy, this.energy + 25); // +25 Special Energy
      this.counterWindow = COMBAT_DATA.CONFIG.COUNTER_WINDOW_DURATION; // Unlock Counter bonus

      // Stun attacker briefly!
      attacker.stunDuration = 30;
      attacker.setState('HIT_STUN');

      arena.createPerfectBlockFx(this.x + this.facing * 20, this.y - this.height * 0.5);
      if (window.soundEngine) {
        window.soundEngine.playTempleGong();
        window.soundEngine.playTaiko(1.2);
      }
      return { type: 'perfect_block', damage: damageTaken };
    }

    // 4. Standard Block Check
    if (this.state === 'BLOCK') {
      const styleBlockReduction = this.style.id === 'iron' ? 0.85 : 0.65;
      const damageTaken = Math.round(attack.damage * (1 - styleBlockReduction));
      this.hp = Math.max(0, this.hp - damageTaken);

      // Guard Meter Damage (Spec 74)
      const guardDmg = attack.guardDamage * (attacker.style.id === 'tiger' ? 1.4 : 1.0);
      this.guard -= guardDmg;

      if (this.guard <= 0) {
        this.triggerGuardBreak(arena);
        return { type: 'guard_break', damage: damageTaken };
      }

      this.blockStunDuration = attack.blockStun;
      this.setState('BLOCK_STUN');
      this.vx = -this.facing * (attack.knockback * 0.4);

      arena.createBlockSparks(this.x + this.facing * 15, this.y - this.height * 0.5);
      if (arena && arena.createDamageText) arena.createDamageText(this.x, this.y - this.height * 0.7, damageTaken, 'blocked');
      if (window.soundEngine) window.soundEngine.playSwordSlash();
      return { type: 'blocked', damage: damageTaken };
    }

    // 5. Clean Hit Taken
    let damage = attack.damage * attacker.weapon.damageMod * attacker.style.damageMult;

    // Weapon Durability penalty (Spec 84)
    if (attacker.weaponDurability < 20) {
      damage *= 0.8;
    }

    // Counter Attack bonus (Spec 73)
    let isCounterStrike = false;
    if (attacker.counterWindow > 0) {
      damage *= 1.5;
      isCounterStrike = true;
      attacker.counterWindow = 0; // Consume counter window
    }

    // Critical Hit Calculation (Spec 133)
    const isCrit = isCounterStrike || (Math.random() < (attack.criticalChance + attacker.weapon.critMod));
    if (isCrit) {
      damage *= attack.criticalMultiplier;
    }

    // Rage Mode boost (Spec 78)
    if (attacker.isRageMode) {
      damage *= COMBAT_DATA.CONFIG.RAGE_DAMAGE_BOOST;
    }

    // Status effect debuff: Armor Break
    const hasArmorBreak = this.statusEffects.some(e => e.type === 'armor_break');
    if (hasArmorBreak || this.isGuardBroken) {
      damage *= 1.35;
    }

    // Boss Resistance: Cap extreme burst hits on bosses (Spec 77)
    if (!this.isPlayer && attack.type === 'ultimate') {
      damage = Math.min(damage, 320);
    }

    // Damage Location System (Spec 161)
    let damageLoc = 'BODY';
    let locMult = 1.0;
    if (attack.type === 'aerial' || (attacker.isGrounded === false && attacker.y < this.y - 30)) {
      damageLoc = 'HEAD';
      locMult = 1.35;
    } else if (attack.id === 'kick_sweep' || attacker.isCrouching) {
      damageLoc = 'LEGS';
      locMult = 0.85;
    }
    damage *= locMult;

    damage = Math.round(damage);
    this.hp = Math.max(0, this.hp - damage);

    // Player Revive System (Spec 293)
    if (this.isPlayer && this.hp <= 0 && this.reviveAvailable) {
      this.hp = Math.round(this.maxHp * 0.35);
      this.reviveAvailable = false;
      this.invincibleFrames = 60;
      if (combatEngine) {
        combatEngine.triggerSlowMo(60, 0.2);
        combatEngine.triggerCameraShake(22);
      }
      if (window.soundEngine) {
        window.soundEngine.playTempleGong();
      }
      if (window.notifications) {
        window.notifications.show('REVIVAL BURST', 'Celestial Spirit grants a second chance! (蘇生)', '✨', 'success', 3000);
      }
    }

    // Boss Last-Stand Mechanic (Spec 291)
    if (!this.isPlayer && this.isBoss && this.hp <= 0 && !this.lastStandTriggered) {
      this.lastStandTriggered = true;
      this.hp = Math.max(1, Math.round(this.maxHp * 0.08)); // 8% final desperation surge
      this.invincibleFrames = 60;
      this.activateRage();
      if (combatEngine) {
        combatEngine.triggerSlowMo(50, 0.2);
        combatEngine.triggerCameraShake(24);
      }
      if (window.notifications) {
        window.notifications.show('LAST STAND', 'The Champion enters their desperate final surge!', '👹', 'danger', 3000);
      }
    }

    // Player Last-Stand Mechanic (Spec 292)
    if (this.isPlayer && this.hp > 0 && this.hp <= this.maxHp * 0.15 && !this.lastStandTriggered) {
      this.lastStandTriggered = true;
      this.rage = this.maxRage; // Emergency rage burst
      if (combatEngine) {
        combatEngine.triggerSlowMo(40, 0.3);
      }
    }

    // Build energy and rage (Spec 76, 78)
    attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 8);
    attacker.rage = Math.min(attacker.maxRage, attacker.rage + 6);
    this.rage = Math.min(this.maxRage, this.rage + Math.round(damage * 0.12));

    // Near-defeat clutch rage boost (Spec 78)
    if (this.hp < this.maxHp * 0.25) {
      this.rage = Math.min(this.maxRage, this.rage + Math.round(damage * 0.15));
    }

    // Super Armor Check (Spec 155): light attacks don't interrupt super armor
    const hasSuperArmor = (this.currentAttack && this.currentAttack.armor && this.currentAttack.armor > 0) || this.armorHits > 0;
    const isLightAttack = attack.type === 'light';

    // Poise Meter & Stagger Check (Spec 156)
    const poiseDmg = (attack.damage * 0.75) + (attack.knockback * 2.5);
    const ccResist = this.isBoss ? 0.6 : (this.style && this.style.id === 'iron' ? 0.75 : 1.0);
    this.poise = Math.max(0, this.poise - (poiseDmg * ccResist));

    let triggeredStagger = false;
    if (this.poise <= 0) {
      this.poise = 0;
      this.stunDuration = 50; // Staggered!
      this.setState('STAGGERED');
      triggeredStagger = true;
      if (arena && arena.createPoiseBreakFx) arena.createPoiseBreakFx(this.x, this.y - this.height * 0.5);
    }

    // Directional Hit Reaction (Spec 147)
    let reactionDir = 'FRONT';
    if (attacker.y < this.y - 45 || attack.type === 'aerial') {
      reactionDir = 'ABOVE';
    } else if (attacker.x < this.x) {
      reactionDir = (this.facing === -1) ? 'FRONT' : 'BACK';
    } else {
      reactionDir = (this.facing === 1) ? 'FRONT' : 'BACK';
    }

    let intensity = 'light';
    if (attack.launchForce > 6) intensity = 'launch';
    else if (attack.damage > 45 || attack.knockback > 9) intensity = 'heavy';
    else if (attack.damage > 20) intensity = 'medium';

    if (this.animEngine) {
      this.animEngine.triggerHitReaction(reactionDir, intensity, damageLoc);
    }

    const _fRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
    if (_fRoot.eventBus) {
      _fRoot.eventBus.emit(this.isPlayer ? 'OnPlayerHit' : 'OnEnemyHit', {
        attacker,
        defender: this,
        damage,
        isCrit,
        location: damageLoc,
        direction: reactionDir
      });
    }

    if (hasSuperArmor && isLightAttack && !triggeredStagger) {
      // Super armor absorbs light attack hitstun (Spec 155)
      arena.createArmorSparks(this.x, this.y - this.height * 0.5);
      return { type: 'armored', damage, isCrit, isCounterStrike, location: damageLoc };
    }

    // Apply Knockback and Launch Force / Air Juggle (Spec 71, 82)
    if (!triggeredStagger) {
      this.vx = attacker.facing * attack.knockback;
      if (attack.launchForce !== 0 || (damageLoc === 'LEGS' && attack.id === 'kick_sweep')) {
        this.vy = -(attack.launchForce || 7.0);
        this.isGrounded = false;
        this.setState('KNOCKED_DOWN');
      } else {
        // If already airborne: sustain air juggle!
        if (!this.isGrounded) {
          this.vy = -4.0; // Air juggle float
        }
        this.stunDuration = attack.hitStun;
        this.setState('HIT_STUN');
      }
    }

    // Apply Status Effects (Spec 131)
    if (attack.statusEffect) {
      this.applyStatusEffect(attack.statusEffect);
    }

    // Visual FX, Attack Camera & Audio (Specs 277, 280)
    arena.createHitImpact(this.x, this.y - this.height * 0.5, isCrit);
    const dmgCategory = isCrit ? 'critical' : (hasArmorBreak ? 'resisted' : 'normal');
    arena.createDamageText(this.x, this.y - this.height * 0.7, damage, dmgCategory);

    // Dynamic Attack Camera Zoom for Heavy/Critical/Ultimate (Spec 277)
    if (arena && arena.triggerAttackCamera && (isCrit || attack.type === 'heavy' || attack.type === 'ultimate')) {
      const zoomBoost = attack.type === 'ultimate' ? 0.35 : (isCrit ? 0.25 : 0.18);
      arena.triggerAttackCamera(this.x, this.y - this.height * 0.5, zoomBoost, 22);
    }

    // Morale Telemetry: Counter-hits and heavy interruptions reduce enemy morale (Spec 287)
    if (!this.isPlayer) {
      const moraleLoss = isCounterStrike ? 20 : (isCrit ? 12 : 5);
      this.morale = Math.max(0, this.morale - moraleLoss);
    }

    if (window.soundEngine) {
      if (isCrit) window.soundEngine.playTaiko(1.3);
      window.soundEngine.playSwordSlash();
    }

    return { type: 'hit', damage, isCrit, isCounterStrike, location: damageLoc };
  }

  // Status Effects System (Spec 131)
  applyStatusEffect(effect) {
    const existing = this.statusEffects.find(e => e.type === effect.type);
    if (existing) {
      existing.duration = Math.max(existing.duration, effect.duration);
    } else {
      this.statusEffects.push({
        type: effect.type,
        duration: effect.duration,
        timer: effect.duration,
        tickTimer: 0,
        dps: effect.dps || 12
      });
    }
  }

  updateStatusEffects() {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      const e = this.statusEffects[i];
      e.timer--;
      e.tickTimer++;

      // Dot Ticks
      if (e.type === 'burn' || e.type === 'bleed' || e.type === 'poison') {
        const interval = e.type === 'bleed' ? 20 : (e.type === 'burn' ? 30 : 25);
        if (e.tickTimer % interval === 0) {
          this.hp = Math.max(0, this.hp - Math.round(e.dps));
        }
      }

      if (e.timer <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }
  }

  // Set State Helper
  setState(newState) {
    if (this.state === 'DEAD') return;
    this.state = newState;
    this.stateTimer = 0;
  }

  // Movement Helpers
  move(dir) {
    if (this.state !== 'IDLE' && this.state !== 'WALK') return;
    this.facing = dir;
    const speed = COMBAT_DATA.CONFIG.MOVE_SPEED * this.style.speedMult * (this.isExhausted ? 0.55 : 1.0);
    this.vx = dir * speed;
    this.setState('WALK');
  }

  stopMoving() {
    if (this.state === 'WALK') {
      this.setState('IDLE');
    }
  }

  jump() {
    if (this.isGrounded && (this.state === 'IDLE' || this.state === 'WALK')) {
      this.vy = COMBAT_DATA.CONFIG.JUMP_FORCE;
      this.isGrounded = false;
      this.setState('JUMP');
      if (window.soundEngine) window.soundEngine.playSwordSlash();
    }
  }

  crouch() {
    if (this.isGrounded && (this.state === 'IDLE' || this.state === 'WALK')) {
      this.isCrouching = true;
      this.setState('CROUCH');
    }
  }

  standUp() {
    if (this.isCrouching) {
      this.isCrouching = false;
      this.setState('IDLE');
    }
  }

  block(isPressed) {
    this.isBlocking = isPressed;
    if (isPressed && this.isGrounded && this.state !== 'ATTACK' && this.state !== 'HIT_STUN' && !this.isGuardBroken) {
      this.setState('BLOCK');
      this.vx = 0;
    } else if (!isPressed && this.state === 'BLOCK') {
      this.setState('IDLE');
    }
  }

  dodge() {
    if (this.isExhausted) return false;
    if (this.state === 'ATTACK' && !this.canCancel) return false;
    if (this.state === 'HIT_STUN' || this.state === 'KNOCKED_DOWN' || this.state === 'GUARD_BROKEN') return false;

    this.stamina = Math.max(0, this.stamina - 18);
    this.setState('DODGE');
    if (window.soundEngine) window.soundEngine.playSwordSlash();
    return true;
  }

  // Hurtbox Calculation
  getHurtbox() {
    const h = this.isCrouching ? 65 : (this.isGrounded ? this.height : 80);
    return {
      x: this.x - this.width * 0.5,
      y: this.y - h,
      width: this.width,
      height: h
    };
  }

  // Hitbox Calculation
  getHitbox() {
    if (this.state !== 'ATTACK' || this.attackPhase !== 'active' || !this.currentAttack) {
      return null;
    }

    const atk = this.currentAttack;
    const reach = atk.range * this.weapon.rangeMod;
    const h = 48;
    const boxX = this.facing === 1 ? this.x : this.x - reach;

    return {
      x: boxX,
      y: this.y - this.height * 0.75,
      width: reach,
      height: h,
      attack: atk
    };
  }

  // =========================================================================
  // HIGH-CONTRAST SILHOUETTE RENDERER (Shadow Fight 2 / Tsushima Art Style)
  // =========================================================================
  render(ctx) {
    ctx.save();

    // Render Ghost Shadows (After-images)
    for (let i = this.ghostShadows.length - 1; i >= 0; i--) {
      const gs = this.ghostShadows[i];
      gs.alpha -= 0.05;
      if (gs.alpha <= 0) {
        this.ghostShadows.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = gs.alpha;
      ctx.fillStyle = gs.color;
      ctx.beginPath();
      ctx.arc(gs.x, gs.y - 50, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Weapon Trails
    for (let i = this.weaponTrail.length - 1; i >= 0; i--) {
      const trail = this.weaponTrail[i];
      trail.alpha -= 0.08;
      if (trail.alpha <= 0) {
        this.weaponTrail.splice(i, 1);
        continue;
      }
      ctx.fillStyle = trail.color;
      ctx.globalAlpha = trail.alpha;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // Draw Rage Aura if active (Spec 78)
    if (this.isRageMode) {
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = 28;
      ctx.strokeStyle = 'rgba(255, 60, 0, 0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.height * 0.5, this.width * 0.95, this.height * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Highlight Outline during Perfect Dodge bullet-time (Spec 73)
    if (this.isHighlightedByEnemy) {
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 30;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.height * 0.5, this.width * 0.8, this.height * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow on Ground
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.groundY + 2, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flip context if facing left
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);

    // Compute limb angles based on state & animation
    let torsoAngle = 0;
    let headY = -92;
    let leadArmAngle = 0.2;
    let rearArmAngle = -0.4;
    let leadLegAngle = 0.1;
    let rearLegAngle = -0.1;

    if (this.state === 'WALK') {
      const cycle = Math.sin(this.animTick * 0.22);
      leadLegAngle = cycle * 0.55;
      rearLegAngle = -cycle * 0.55;
      leadArmAngle = -cycle * 0.4;
      rearArmAngle = cycle * 0.4;
      headY += Math.abs(Math.sin(this.animTick * 0.22)) * 4;
    } else if (this.state === 'JUMP') {
      leadLegAngle = -0.6;
      rearLegAngle = 0.4;
      leadArmAngle = -0.8;
      rearArmAngle = -0.9;
    } else if (this.state === 'CROUCH') {
      headY = -55;
      torsoAngle = 0.25;
      leadLegAngle = 1.1;
      rearLegAngle = 1.2;
    } else if (this.state === 'BLOCK') {
      leadArmAngle = -1.2;
      rearArmAngle = -1.0;
      torsoAngle = -0.15;
    } else if (this.state === 'DODGE') {
      torsoAngle = 0.6;
      headY = -65;
      leadLegAngle = 0.8;
      rearLegAngle = -0.8;
    } else if (this.state === 'ATTACK' && this.currentAttack) {
      const progress = this.attackFrame / (this.currentAttack.startup + this.currentAttack.active + this.currentAttack.recovery);
      if (this.currentAttack.type === 'kick') {
        leadLegAngle = -1.4 * Math.sin(progress * Math.PI);
        torsoAngle = -0.3;
      } else {
        leadArmAngle = -1.8 * Math.sin(progress * Math.PI) + 0.5;
        torsoAngle = 0.3 * Math.sin(progress * Math.PI);
      }
    } else if (this.state === 'HIT_STUN' || this.state === 'GUARD_BROKEN') {
      torsoAngle = -0.4;
      headY += 5;
    } else if (this.state === 'KNOCKED_DOWN') {
      torsoAngle = 1.4;
      headY = -20;
    } else if (this.state === 'EXHAUSTED') {
      // Panting exhausted posture (Spec 75)
      torsoAngle = 0.45;
      headY = -70 + Math.sin(this.animTick * 0.12) * 5;
    }

    // DRAW SHADOW BODY SILHOUETTES (Pitch Black Sleek Warrior)
    ctx.fillStyle = '#060507';
    ctx.strokeStyle = '#060507';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Rear Leg
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-6, -45);
    const rearKneeX = -6 + Math.sin(rearLegAngle) * 26;
    const rearKneeY = -45 + Math.cos(rearLegAngle) * 26;
    ctx.lineTo(rearKneeX, rearKneeY);
    ctx.lineTo(rearKneeX - 4, 0);
    ctx.stroke();

    // 2. Front Leg
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(6, -45);
    const frontKneeX = 6 + Math.sin(leadLegAngle) * 26;
    const frontKneeY = -45 + Math.cos(leadLegAngle) * 26;
    ctx.lineTo(frontKneeX, frontKneeY);
    ctx.lineTo(frontKneeX + 4, 0);
    ctx.stroke();

    // 3. Torso & Hakama Coat
    ctx.save();
    ctx.rotate(torsoAngle);
    ctx.beginPath();
    ctx.moveTo(-10, -82);
    ctx.lineTo(14, -82);
    ctx.lineTo(12, -45);
    ctx.lineTo(-12, -45);
    ctx.closePath();
    ctx.fill();

    // Flowing Sash Ribbon
    ctx.fillStyle = this.isPlayer ? (this.style.color || '#00e5ff') : '#c92a2a';
    ctx.beginPath();
    ctx.moveTo(-10, -48);
    ctx.lineTo(-24 - Math.sin(this.animTick * 0.15) * 6, -38);
    ctx.lineTo(-10, -42);
    ctx.fill();
    ctx.fillStyle = '#060507';

    // 4. Rear Arm & Weapon Grip
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-4, -78);
    const rearElbowX = -4 + Math.sin(rearArmAngle) * 22;
    const rearElbowY = -78 + Math.cos(rearArmAngle) * 22;
    ctx.lineTo(rearElbowX, rearElbowY);
    ctx.lineTo(rearElbowX + 16, rearElbowY - 8);
    ctx.stroke();

    // 5. Head & Mask
    ctx.beginPath();
    ctx.arc(0, headY + 82, 11, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Spectral Eye Line (Shadow Fight style)
    ctx.shadowColor = this.eyeGlowColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = this.eyeGlowColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(3, headY + 81);
    ctx.lineTo(8, headY + 80);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 6. Lead Arm
    ctx.strokeStyle = '#060507';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(8, -78);
    const frontElbowX = 8 + Math.sin(leadArmAngle) * 24;
    const frontElbowY = -78 + Math.cos(leadArmAngle) * 24;
    ctx.lineTo(frontElbowX, frontElbowY);
    const handX = frontElbowX + 18;
    const handY = frontElbowY - 4;
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // 7. Weapon Rendering
    this.renderWeapon(ctx, handX, handY, leadArmAngle);

    ctx.restore();
    ctx.restore();
  }

  // Draw Specific Weapon Geometry (Spec 83)
  renderWeapon(ctx, hx, hy, armAngle) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(armAngle * 0.7);

    const weaponGlow = this.isPlayer ? (this.weapon.color || '#00e5ff') : '#ff4444';

    if (this.weapon.id === 'katana') {
      ctx.fillStyle = '#22150c';
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = '#ffd56b';
      ctx.fillRect(8, -6, 3, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = weaponGlow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.quadraticCurveTo(45, -6, 75, -12);
      ctx.stroke();
    } else if (this.weapon.id === 'daggers') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#51cf66';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(38, -4);
      ctx.stroke();
    } else if (this.weapon.id === 'staff') {
      ctx.strokeStyle = '#dfa15a';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-45, 12);
      ctx.lineTo(85, -24);
      ctx.stroke();
    } else if (this.weapon.id === 'heavy_blade') {
      ctx.fillStyle = '#ffd56b';
      ctx.fillRect(6, -10, 4, 20);
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 7.5;
      ctx.shadowColor = '#ff6b6b';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(105, -16);
      ctx.stroke();
    } else if (this.weapon.id === 'kusarigama') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(5, -15);
      ctx.quadraticCurveTo(25, -20, 35, 5);
      ctx.stroke();
      ctx.strokeStyle = '#9e9e9e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(5, 5);
      ctx.quadraticCurveTo(-15, 25, -35, 15);
      ctx.stroke();
    } else if (this.weapon.id === 'muramasa_eclipse') {
      // Mythic Muramasa Katana (Black Fire Glow)
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = '#ffd56b';
      ctx.fillRect(8, -8, 4, 16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.5;
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.quadraticCurveTo(55, -8, 90, -16);
      ctx.stroke();
    }

    ctx.restore();
  }
}

const _fighterRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_fighterRoot.Fighter = Fighter;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Fighter;
}
