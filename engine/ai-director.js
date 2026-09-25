/**
 * Shadow Samurai - Adaptive AI & Encounter Director
 * Implements 6 distinct enemy personalities, machine adaptation to player habits,
 * cinematic boss phase transitions (70% and 30%), aerial AI moves, and unique boss mechanics.
 * Complies with specifications 89, 90, 91, 92, 93, 94.
 */

class AIDirector {
  constructor(enemy, player, personalityId = 'tactical') {
    this.enemy = enemy;
    this.player = player;
    this.personality = COMBAT_DATA.AI_PERSONALITIES[personalityId] || COMBAT_DATA.AI_PERSONALITIES.tactical;
    
    // Player Observation Analytics (Spec 90: Adaptive AI)
    this.playerHistory = {
      kickCount: 0,
      lightCount: 0,
      heavyCount: 0,
      dodgeCount: 0,
      blockDuration: 0,
      jumpCount: 0,
      recentActions: []
    };
    
    // Decision Timers
    this.decisionTimer = 0;
    this.actionCooldown = 0;
    
    // Boss Phase Transitions (Spec 91, 92)
    this.isBoss = false;
    this.bossPhase = 1; // 1: 100-70%, 2: 70-30%, 3: <30%
    this.bossUniqueMechanic = null;
    this.mechanicCooldown = 0;

    // Morale & Retreat System (Spec 287, 288)
    this.morale = 100;
    this.isRetreating = false;
    this.retreatTimer = 0;

    this.onBossPhaseChange = null;
  }

  setBoss(isBoss, mechanic = 'teleport') {
    this.isBoss = isBoss;
    this.bossUniqueMechanic = mechanic;
    this.bossPhase = 1;
    if (this.enemy) this.enemy.isBoss = isBoss;
  }

  // Update AI Logic per frame
  update(combatEngine) {
    if (!this.enemy || this.enemy.state === 'DEAD' || this.enemy.state === 'HIT_STUN' || this.enemy.state === 'GUARD_BROKEN') {
      return;
    }

    // Wake-up Recovery / Roll Behavior (Spec 289, 290)
    if (this.enemy.state === 'KNOCKDOWN' || this.enemy.state === 'KNOCKED_DOWN') {
      if (this.enemy.stateTimer >= 38) {
        if (Math.random() < 0.45) {
          // Telegraphed wake-up recovery sweep attack (Spec 290)
          this.enemy.executeAttack('kick_sweep');
          if (combatEngine && combatEngine.director && combatEngine.director.telegraphSystem) {
            combatEngine.director.telegraphSystem.triggerTelegraph({
              attacker: this.enemy,
              attackId: 'wake_up_sweep',
              type: 'AREA',
              duration: 18
            });
          }
        } else {
          // Wake-up roll backward (Spec 289)
          this.enemy.dodge();
        }
      }
      return;
    }

    // Combat Morale & Retreat Behavior (Spec 287, 288)
    if (this.enemy.morale < 35 && !this.isRetreating && !this.isBoss) {
      this.isRetreating = true;
      this.retreatTimer = 110;
      this.enemy.isRetreating = true;
    }

    if (this.isRetreating) {
      this.retreatTimer--;
      const retreatDir = this.enemy.x < this.player.x ? -1 : 1;
      const arenaMin = combatEngine.arena ? combatEngine.arena.x + 80 : 160;
      const arenaMax = combatEngine.arena ? combatEngine.arena.x + combatEngine.arena.width - 80 : 1000;
      
      const targetX = this.enemy.x + retreatDir * 4.2;
      if (targetX >= arenaMin && targetX <= arenaMax) {
        this.enemy.x = targetX;
        this.enemy.facing = (this.player.x > this.enemy.x) ? 1 : -1;
      }
      this.enemy.block(true);

      if (this.retreatTimer <= 0) {
        this.isRetreating = false;
        this.enemy.isRetreating = false;
        this.enemy.morale = 75; // Morale recovered after spacing
        this.enemy.block(false);
      }
      return;
    }

    this.decisionTimer++;
    if (this.mechanicCooldown > 0) this.mechanicCooldown--;

    // 1. Observe and Track Player Behavior (Spec 90)
    this.analyzePlayerHabits();

    // 2. Boss Phase Transitions Check (Spec 91)
    if (this.isBoss) {
      this.checkBossPhases(combatEngine);
    }

    // 3. Spacing & Tactical Decision Making
    if (this.actionCooldown > 0) {
      this.actionCooldown--;
      return;
    }

    this.makeTacticalDecision(combatEngine);
  }

  // Track player habits to adapt counter-strategies (Spec 90)
  analyzePlayerHabits() {
    if (this.player.state === 'ATTACK' && this.player.attackFrame === 1 && this.player.currentAttack) {
      const type = this.player.currentAttack.type;
      if (type === 'kick') this.playerHistory.kickCount++;
      if (type === 'light') this.playerHistory.lightCount++;
      if (type === 'heavy') this.playerHistory.heavyCount++;

      this.playerHistory.recentActions.push(type);
      if (this.playerHistory.recentActions.length > 10) {
        this.playerHistory.recentActions.shift();
      }
    }
    if (this.player.state === 'DODGE' && this.player.stateTimer === 1) {
      this.playerHistory.dodgeCount++;
    }
    if (this.player.state === 'BLOCK') {
      this.playerHistory.blockDuration++;
    }
    if (this.player.state === 'JUMP' && this.player.stateTimer === 1) {
      this.playerHistory.jumpCount++;
    }
  }

  // Boss Phase Transition Watcher (Spec 91)
  checkBossPhases(combatEngine) {
    const hpRatio = this.enemy.hp / this.enemy.maxHp;

    if (this.bossPhase === 1 && hpRatio <= 0.70) {
      this.bossPhase = 2;
      this.triggerPhaseTransition(2, combatEngine);
    } else if (this.bossPhase === 2 && hpRatio <= 0.30) {
      this.bossPhase = 3;
      this.triggerPhaseTransition(3, combatEngine);
    }
  }

  triggerPhaseTransition(newPhase, combatEngine) {
    combatEngine.triggerSlowMo(45, 0.25);
    combatEngine.triggerCameraShake(18);
    combatEngine.screenFlashAlpha = 0.8;

    // Boss gains stat buff and armor burst
    this.enemy.invincibleFrames = 30;
    this.enemy.energy = this.enemy.maxEnergy; // Fully charges energy

    if (newPhase === 3) {
      this.enemy.activateRage(); // Enters berserk rage mode
    }

    if (this.onBossPhaseChange) {
      this.onBossPhaseChange(newPhase);
    }

    if (window.soundEngine) {
      window.soundEngine.setMusicPhase(newPhase === 3 ? 'boss' : 'combat');
      window.soundEngine.playTempleGong();
      window.soundEngine.playTaiko(1.4);
    }
  }

  // Core Tactical Decision Tree
  makeTacticalDecision(combatEngine) {
    const dist = Math.abs(this.enemy.x - this.player.x);
    const facingPlayer = (this.player.x > this.enemy.x) ? 1 : -1;
    this.enemy.facing = facingPlayer;

    // A. Player is currently attacking: Defend, Dodge, or Counter (Spec 73, 90)
    if (this.player.state === 'ATTACK') {
      // Adaptive AI: If player spams kicks, crouch and block low (Spec 90)
      if (this.playerHistory.kickCount >= 4 && Math.random() < 0.7) {
        this.enemy.crouch();
        this.enemy.block(true);
        this.actionCooldown = 18;
        return;
      }

      // Roll for defensive reaction based on AI Personality (Spec 89)
      if (Math.random() < this.personality.blockChance) {
        this.enemy.block(true);
        this.actionCooldown = 22;
        return;
      } else if (Math.random() < this.personality.dodgeChance) {
        this.enemy.dodge();
        this.actionCooldown = 26;
        return;
      }
    } else {
      this.enemy.block(false);
      this.enemy.standUp();
    }

    // B. Player has blocked repeatedly: Adaptive AI uses Guard-Breaking Heavy Cleave (Spec 90)
    if (this.player.state === 'BLOCK' || this.playerHistory.blockDuration > 120) {
      if (dist < 125) {
        this.enemy.executeAttack('heavy_cleave'); // Breaks guard
        this.actionCooldown = 38;
        return;
      }
    }

    // C. Execute Boss Unique Mechanic (Spec 92)
    if (this.isBoss && this.mechanicCooldown <= 0 && Math.random() < 0.4) {
      this.executeBossMechanic(combatEngine);
      return;
    }

    // D. Player is airborne: Perform Air-to-Air Attack or Anti-Air (Spec 82)
    if (!this.player.isGrounded && dist < 140 && Math.random() < 0.6) {
      this.enemy.jump();
      setTimeout(() => {
        if (this.enemy) this.enemy.executeAttack('air_kick');
      }, 120);
      this.actionCooldown = 30;
      return;
    }

    // Boss Attack Memory & Categorized Move Selection (Specs 269, 270, 272, 273)
    if (this.isBoss && combatEngine.director && combatEngine.director.bossMemory) {
      const bossMem = combatEngine.director.bossMemory;
      
      // Boss Taunt Check (Spec 273)
      const taunt = bossMem.getTaunt({
        playerLowHealth: this.player.hp < this.player.maxHp * 0.25,
        playerRepeatedBlocking: this.playerHistory.blockDuration > 80,
        playerRepeatedDodging: this.playerHistory.dodgeCount > 4,
        playerHighCombo: combatEngine.comboEngine && combatEngine.comboEngine.hitCount >= 5,
        bossNewPhase: this.bossPhase > 1
      });
      if (taunt && window.notifications) {
        window.notifications.show(this.enemy.name || 'WARLORD', taunt, '💬', 'combat', 2500);
      }

      // Memory-driven Categorized Selection
      const selection = bossMem.selectAttack({
        playerHpRatio: this.player.hp / this.player.maxHp,
        playerState: this.player.state,
        distance: dist,
        playerIsBlocking: this.player.state === 'BLOCK',
        currentPhase: this.bossPhase
      });

      if (selection && selection.attack) {
        if (selection.unblockable && combatEngine.director.telegraphSystem) {
          combatEngine.director.telegraphSystem.triggerTelegraph({
            attacker: this.enemy,
            attackId: selection.attack,
            type: selection.category === 'Area' ? 'AREA' : 'UNBLOCKABLE',
            duration: 24
          });
        }
        this.enemy.executeAttack(selection.attack);
        this.actionCooldown = 28;
        return;
      }
    }

    // E. Close Range (< 90px): Attacks, Combos, or Ultimates
    if (dist <= 90) {
      if (this.enemy.energy >= 100 && (this.bossPhase >= 2 || Math.random() < 0.35)) {
        this.enemy.executeAttack('ultimate_eclipse');
        this.actionCooldown = 65;
        return;
      }

      // Choose attack based on personality
      let choices = ['light_1', 'light_2', 'kick_front', 'heavy_slash'];
      if (this.personality.name === 'Berserker') choices = ['heavy_slash', 'heavy_cleave', 'kick_roundhouse'];
      if (this.personality.name === 'Counter') choices = ['kick_front', 'light_1', 'counter_strike'];

      const chosen = choices[Math.floor(Math.random() * choices.length)];
      this.enemy.executeAttack(chosen);
      this.actionCooldown = 20;
    }
    // F. Mid Range (90px - 220px): Gap Closers & Specials
    else if (dist <= 220) {
      if (this.enemy.energy >= 35 && Math.random() < 0.45) {
        this.enemy.executeAttack('special_shadow_dash');
        this.actionCooldown = 40;
      } else if (Math.random() < 0.5) {
        this.enemy.executeAttack('heavy_thrust');
        this.actionCooldown = 32;
      } else {
        this.enemy.move(facingPlayer);
        this.actionCooldown = 12;
      }
    }
    // G. Long Range (> 220px): Projectiles or Approach
    else {
      if (this.enemy.energy >= 50 && Math.random() < 0.55) {
        this.enemy.executeAttack('special_dragon_wave');
        combatEngine.spawnProjectile(this.enemy, {
          speed: 11,
          radius: 22,
          color: '#ff4444',
          trail: 'fire'
        });
        this.actionCooldown = 45;
      } else {
        this.enemy.move(facingPlayer);
        this.actionCooldown = 14;
      }
    }
  }

  // Boss Unique Mechanics Execution (Spec 92)
  executeBossMechanic(combatEngine) {
    this.mechanicCooldown = 260; // Cooldown

    if (this.bossUniqueMechanic === 'teleport') {
      // Teleport behind player with shadow smoke
      combatEngine.arena.createSmokePuff(this.enemy.x, this.enemy.y);
      this.enemy.x = this.player.x + (this.player.facing * -90);
      this.enemy.facing = this.player.facing;
      combatEngine.arena.createSmokePuff(this.enemy.x, this.enemy.y);
      this.enemy.executeAttack('heavy_slash');
      if (window.soundEngine) window.soundEngine.playSwordSlash();
    } else if (this.bossUniqueMechanic === 'shield') {
      // Iron Fortress Shield: gains 3 super armor hits
      this.enemy.armorHits = 3;
      combatEngine.arena.createArmorSparks(this.enemy.x, this.enemy.y - 50);
      if (window.soundEngine) window.soundEngine.playTempleGong();
    } else if (this.bossUniqueMechanic === 'clones') {
      // Clones: spawns double shadow projectiles
      combatEngine.spawnProjectile(this.enemy, { speed: 12, radius: 18, color: '#9c36b5' });
      combatEngine.spawnProjectile(this.enemy, { speed: 8, radius: 18, color: '#9c36b5' });
    } else if (this.bossUniqueMechanic === 'earthquake') {
      // Earthquake Ground Fissure (Spec 92)
      combatEngine.arena.createGroundImpact(this.enemy.x, this.enemy.groundY);
      combatEngine.triggerCameraShake(16);
      combatEngine.spawnProjectile(this.enemy, {
        speed: 13,
        radius: 28,
        color: '#ff922b',
        trail: 'orange'
      });
      if (window.soundEngine) window.soundEngine.playTaiko(1.4);
    } else if (this.bossUniqueMechanic === 'venom_mist') {
      // Poison cloud across arena
      this.player.applyStatusEffect({ type: 'poison', duration: 180, dps: 12 });
      combatEngine.arena.createSmokePuff(this.player.x, this.player.y);
    } else if (this.bossUniqueMechanic === 'eclipse_meteor') {
      // Meteorite drops from sky onto player position
      combatEngine.triggerCameraShake(20);
      combatEngine.arena.createHitImpact(this.player.x, this.player.groundY, true);
      this.player.hp = Math.max(0, this.player.hp - 80);
      this.player.applyStatusEffect({ type: 'burn', duration: 150, dps: 15 });
      if (window.soundEngine) window.soundEngine.playTempleGong();
    }
  }
}

// Encounter Director (Spec 94)
class EncounterDirector {
  static createEncounter(config) {
    const enemyFighter = new Fighter({
      isPlayer: false,
      name: config.bossName || config.enemyName || 'Shadow Vanguard',
      title: config.bossTitle || 'Ronin Infiltrator',
      x: 750,
      y: 420,
      facing: -1,
      maxHp: config.bossHp || 1000,
      weapon: config.weapon || 'katana',
      style: config.style || 'dragon',
      strength: config.strength || 16,
      defense: config.defense || 14,
      isBoss: !!config.isBoss
    });

    const ai = new AIDirector(enemyFighter, null, config.personality || 'tactical');
    if (config.isBoss) {
      ai.setBoss(true, config.uniqueMechanic || 'teleport');
    }

    return { enemyFighter, ai };
  }
}

const _aiDirectorRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_aiDirectorRoot.AIDirector = AIDirector;
_aiDirectorRoot.EncounterDirector = EncounterDirector;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIDirector, EncounterDirector };
}
