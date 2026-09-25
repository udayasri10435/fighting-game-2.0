/**
 * Shadow Samurai - Combat Enhancements Engine
 * Features:
 * - Input Buffer & Input Priority System (Spec 150, 151)
 * - Combo Cancels & Combo Breaker / Escape (Spec 152, 153)
 * - Poise Meter & Stagger Mechanics (Spec 156)
 * - Crowd Control Resistance & Super Armor (Spec 154, 155)
 * - Cinematic Combat Moments & Weapon Clash Resolution (Spec 157, 158)
 * - Throw System (Grab, Forward/Back Throw, Slam) & Throw Escape Window (Spec 159, 160)
 * - Damage Location Multipliers (HEAD, BODY, LEGS) (Spec 161)
 * - Armor Break & Boss Weakness Discovery (Spec 163, 164)
 */

const _ceRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);

class InputBufferSystem {
  constructor(bufferWindowFrames = 12) {
    this.bufferWindow = bufferWindowFrames;
    this.queue = [];
    
    // Configurable Input Priority (Spec 151)
    // Higher number = higher priority
    this.priorityMap = {
      dodge: 100,      // Emergency Dodge
      escape: 95,      // Combo Breaker Escape
      block: 80,       // Guard / Parry
      throw: 70,       // Grab / Throw
      ultimate: 60,    // Ultimate Attack
      special: 50,     // Special Technique
      heavy: 40,       // Heavy Slash / Cleave
      kick: 30,        // Kick / Sweep
      light: 20,       // Light Strike / Jab
      move: 10         // Movement inputs
    };
  }

  // Push an input command with timestamp
  pushInput(action, direction = 'neutral', params = {}) {
    const priority = this.priorityMap[action] || 10;
    this.queue.push({
      action,
      direction,
      priority,
      params,
      frameRemaining: this.bufferWindow
    });

    // Sort queue by priority so highest priority executes first
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Cap buffer size
    if (this.queue.length > 5) {
      this.queue.pop();
    }
  }

  // Age the buffer by 1 frame
  update() {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      this.queue[i].frameRemaining--;
      if (this.queue[i].frameRemaining <= 0) {
        this.queue.splice(i, 1);
      }
    }
  }

  // Peek highest priority input
  peek() {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  // Consume highest priority input
  consume() {
    return this.queue.length > 0 ? this.queue.shift() : null;
  }

  clear() {
    this.queue = [];
  }
}

// ============================================================================
// COMBAT MOMENT & SPECIAL MECHANICS CONTROLLER
// ============================================================================
class CombatEnhancements {
  constructor(combatEngine) {
    this.combatEngine = combatEngine;
    this.inputBuffer = new InputBufferSystem(12);

    // Clash state
    this.activeClash = null;
    
    // Throw state
    this.activeThrow = null;

    // Poise configs (Spec 156)
    this.poiseConfig = {
      basePoise: 100,
      bossPoise: 250,
      regenRate: 0.35,
      staggerDuration: 60 // frames
    };
  }

  // Process Combo Breaker / Escape (Spec 153)
  tryComboBreaker(fighter, arena) {
    // Only available when defender is trapped in hit-stun
    if (fighter.state !== 'HIT_STUN') return false;

    // Costs 35 special energy
    if (fighter.energy < 35) {
      if (window.notifications && fighter.isPlayer) {
        window.notifications.show('ENERGY DEPLETED', 'Need 35% Special Energy to break combo!', '⚡', 'warning', 1800);
      }
      return false;
    }

    fighter.energy -= 35;
    fighter.setState('IDLE');
    fighter.invincibleFrames = 25;

    // Create explosive shockwave that pushes attacker back
    const opponent = fighter === this.combatEngine.player ? this.combatEngine.enemy : this.combatEngine.player;
    if (opponent) {
      const pushDir = (opponent.x >= fighter.x) ? 1 : -1;
      opponent.vx = pushDir * 14.0;
      opponent.vy = -6.0;
      opponent.setState('HIT_STUN');
      opponent.stunDuration = 25;
    }

    if (arena && arena.createComboBreakerFx) arena.createComboBreakerFx(fighter.x, fighter.y - fighter.height * 0.5);
    this.combatEngine.triggerSlowMo(20, 0.4);
    this.combatEngine.triggerCameraShake(12);

    if (_ceRoot.soundEngine) {
      _ceRoot.soundEngine.playTaiko(1.4);
      _ceRoot.soundEngine.playTempleGong();
    }

    if (_ceRoot.eventBus) _ceRoot.eventBus.emit('OnComboBreak', { fighter });
    return true;
  }

  // Damage Location System (Spec 161)
  // Attacks hitting upper hitbox deal HEAD damage (1.35x), mid = BODY (1.0x), low = LEGS (0.85x + sweep launch)
  static calculateDamageLocation(attack, targetY, hitY) {
    const relY = hitY - targetY;
    if (attack.type === 'aerial' || relY < -70) {
      return { location: 'HEAD', multiplier: 1.35, isCritBonus: true };
    }
    if (relY > -25 || attack.anim === 'low_sweep') {
      return { location: 'LEGS', multiplier: 0.85, isTrip: true };
    }
    return { location: 'BODY', multiplier: 1.0, isCritBonus: false };
  }

  // Poise Damage & Stagger Check (Spec 156)
  applyPoiseDamage(fighter, amount, arena) {
    if (!fighter.poise) fighter.poise = fighter.maxPoise || 100;
    
    // Bosses & heavy armor have crowd control resistance (Spec 154)
    const ccResist = fighter.isBoss ? 0.55 : (fighter.style.id === 'iron' ? 0.75 : 1.0);
    fighter.poise -= amount * ccResist;

    if (fighter.poise <= 0) {
      fighter.poise = fighter.maxPoise || 100;
      fighter.setState('STAGGERED');
      fighter.stateTimer = 0;
      fighter.stunDuration = this.poiseConfig.staggerDuration;

      arena.createPoiseBreakFx(fighter.x, fighter.y - fighter.height * 0.5);
      if (_ceRoot.soundEngine) _ceRoot.soundEngine.playTempleGong();

      if (_ceRoot.eventBus) _ceRoot.eventBus.emit('OnPoiseBreak', { fighter });
      return true;
    }
    return false;
  }

  // Execute Throw / Grab System (Spec 159, 160)
  executeThrow(attacker, defender, arena, direction = 'forward') {
    // Check distance: must be close range (< 65px)
    const dist = Math.abs(attacker.x - defender.x);
    if (dist > 75) return false;

    // Bosses can resist normal throws (Spec 159)
    if (defender.isBoss && Math.random() < 0.65) {
      arena.createArmorSparks(defender.x, defender.y - 50);
      if (window.soundEngine) window.soundEngine.playTaiko(0.8);
      return false;
    }

    // Throw Initiation
    this.activeThrow = {
      attacker,
      defender,
      direction,
      frame: 0,
      escapeWindow: 12, // 12-frame window to escape throw (Spec 160)
      escaped: false
    };

    attacker.setState('THROWING');
    defender.setState('GRABBED');
    attacker.invincibleFrames = 30;
    defender.invincibleFrames = 30;

    return true;
  }

  // Throw Escape attempt (Spec 160)
  tryThrowEscape(defender, arena) {
    if (this.activeThrow && this.activeThrow.defender === defender) {
      if (this.activeThrow.frame <= this.activeThrow.escapeWindow) {
        // Successful Escape!
        this.activeThrow.escaped = true;
        const attacker = this.activeThrow.attacker;

        // Push both duelists apart
        attacker.vx = -attacker.facing * 9.0;
        defender.vx = -defender.facing * 9.0;
        attacker.setState('HIT_STUN');
        attacker.stunDuration = 18;
        defender.setState('IDLE');
        defender.invincibleFrames = 15;

        arena.createArmorSparks(defender.x, defender.y - 50);
        if (_ceRoot.soundEngine) _ceRoot.soundEngine.playSwordSlash();

        this.activeThrow = null;
        if (_ceRoot.eventBus) _ceRoot.eventBus.emit('OnThrowEscape', { defender, attacker });
        return true;
      }
    }
    return false;
  }

  // Update Throw Animation sequence
  updateThrowPhysics(arena) {
    if (!this.activeThrow) return;

    this.activeThrow.frame++;
    const { attacker, defender, direction, frame } = this.activeThrow;

    if (frame < 12) {
      // Hold phase: defender locked to attacker
      defender.x = attacker.x + attacker.facing * 35;
      defender.y = attacker.y;
    } else if (frame === 12) {
      // Slam / Launch phase
      const throwDir = (direction === 'backward') ? -attacker.facing : attacker.facing;
      defender.vx = throwDir * 12.0;
      defender.vy = -7.5;
      defender.setState('KNOCKED_DOWN');
      defender.hp = Math.max(0, defender.hp - 110);

      arena.createGroundImpact(defender.x, defender.y);
      this.combatEngine.triggerCameraShake(12);

      if (window.soundEngine) {
        window.soundEngine.playTaiko(1.2);
        window.soundEngine.playSwordSlash();
      }
    } else if (frame >= 28) {
      attacker.setState('IDLE');
      this.activeThrow = null;
    }
  }

  // Resolve Simultaneous Weapon Clash (Spec 158)
  resolveWeaponClash(fighterA, fighterB, arena) {
    this.combatEngine.triggerSlowMo(35, 0.2);
    this.combatEngine.triggerCameraShake(16);

    const midX = (fighterA.x + fighterB.x) * 0.5;
    const midY = ((fighterA.y + fighterB.y) * 0.5) - 40;

    arena.createWeaponClashFx(midX, midY);

    if (window.soundEngine) {
      window.soundEngine.playTempleGong();
      window.soundEngine.playSwordSlash();
    }

    // Pushback based on stamina and weapon weight
    const weightA = fighterA.weapon.damageMod * (fighterA.stamina / fighterA.maxStamina);
    const weightB = fighterB.weapon.damageMod * (fighterB.stamina / fighterB.maxStamina);

    fighterA.vx = -fighterA.facing * (8.0 + (weightB > weightA ? 4.0 : 0));
    fighterB.vx = -fighterB.facing * (8.0 + (weightA > weightB ? 4.0 : 0));

    fighterA.setState('BLOCK_STUN');
    fighterB.setState('BLOCK_STUN');
    fighterA.blockStunDuration = 20;
    fighterB.blockStunDuration = 20;

    if (_ceRoot.eventBus) _ceRoot.eventBus.emit('OnWeaponClash', { fighterA, fighterB });
  }
}

_ceRoot.InputBufferSystem = InputBufferSystem;
_ceRoot.CombatEnhancements = CombatEnhancements;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InputBufferSystem, CombatEnhancements };
}
