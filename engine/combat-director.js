/**
 * Shadow Samurai - Advanced Combat Director, Fairness Telemetry, Attack Telegraphing,
 * Boss Attack Memory, Commentary, Combat Flow & Style Rank System
 * Complies with specifications 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293.
 */

// ============================================================================
// HIT-STOP PROFILES (Spec 278, 279)
// ============================================================================
const HIT_STOP_PROFILES = {
  light: { frames: 3, cameraShake: 2, shake: 2, timeScale: 0.15 },
  medium: { frames: 6, cameraShake: 5, shake: 5, timeScale: 0.12 },
  heavy: { frames: 12, cameraShake: 10, shake: 10, timeScale: 0.08 },
  critical: { frames: 16, cameraShake: 15, shake: 15, timeScale: 0.05 },
  ultimate: { frames: 24, cameraShake: 22, shake: 22, timeScale: 0.02 },
  boss: { frames: 30, cameraShake: 26, shake: 26, timeScale: 0.01 }
};

// ============================================================================
// FAIRNESS TELEMETRY MONITOR (Spec 267)
// Tracks unavoidable damage, impossible reaction windows, infinite stuns
// ============================================================================
class FairnessMonitor {
  constructor() {
    this.logs = [];
    this.metrics = {
      unavoidableHits: 0,
      insufficientWarningAttacks: 0,
      excessiveStuns: 0,
      overlappingAttacks: 0,
      infiniteCombosDetected: 0,
      impossibleReactionWindows: 0,
      cameraObstructions: 0
    };
  }

  logEvent(type, details) {
    const entry = {
      timestamp: Date.now(),
      type,
      details,
      frame: typeof CombatFrameDebugger !== 'undefined' ? CombatFrameDebugger.currentFrameIndex : 0
    };
    this.logs.push(entry);
    if (this.metrics[type] !== undefined) {
      this.metrics[type]++;
    }
    if (this.logs.length > 100) this.logs.shift();

    if (window.DEVELOPMENT_MODE) {
      console.warn(`[FairnessMonitor] ${type}:`, details);
    }
  }

  checkAttackFairness(attack) {
    if (!attack) return;
    if (attack.startup < 6) {
      this.logEvent('impossibleReactionWindows', `Attack ${attack.id} has startup of only ${attack.startup} frames.`);
    }
    if (attack.hitStun > 90) {
      this.logEvent('excessiveStuns', `Attack ${attack.id} causes excessive hitstun (${attack.hitStun} frames).`);
    }
  }

  recordAttackWindow(startupFrames, attackId = 'unknown') {
    this.checkAttackFairness({ id: attackId, startup: startupFrames, hitStun: 20 });
  }

  getFairnessReport() {
    const rep = this.getReport();
    return {
      score: rep.fairnessScore,
      ...rep
    };
  }

  getReport() {
    return {
      fairnessScore: Math.max(0, 100 - (this.metrics.unavoidableHits * 5 + this.metrics.insufficientWarningAttacks * 10 + this.metrics.excessiveStuns * 15)),
      metrics: { ...this.metrics },
      recentLogs: [...this.logs]
    };
  }
}

// ============================================================================
// ATTACK TELEGRAPH SYSTEM (Spec 268)
// Displays readable pre-attack warning glyphs, audio chimes & ground hazard decals
// ============================================================================
class AttackTelegraphSystem {
  constructor(arena) {
    this.arena = arena;
    this.activeTelegraphs = [];
  }

  createTelegraph(attacker, type = 'perilous', duration = 24) {
    return this.triggerTelegraph({
      attacker,
      attackId: 'telegraphed_strike',
      type,
      duration
    });
  }

  triggerTelegraph({
    attacker,
    attackId,
    type = 'HEAVY', // 'HEAVY', 'UNBLOCKABLE', 'AREA', 'THRUST', 'perilous'
    duration = 24,  // frames
    targetX = 0,
    targetY = 0,
    radius = 60
  }) {
    const normType = String(type).toUpperCase();
    const telegraph = {
      id: `${attackId}_${Date.now()}_${Math.random()}`,
      attacker,
      attackId,
      type: type,
      maxFrames: duration,
      remainingFrames: duration,
      targetX: targetX || (attacker ? attacker.x : 0),
      targetY: targetY || (attacker ? attacker.y : 0),
      radius,
      color: (normType === 'UNBLOCKABLE' || normType === 'PERILOUS') ? '#ff1744' : (normType === 'AREA' ? '#ff9100' : '#ffd700')
    };

    this.activeTelegraphs.push(telegraph);

    // Audio Cue (Spec 268)
    if (window.soundEngine) {
      if (normType === 'UNBLOCKABLE' || normType === 'PERILOUS') {
        if (typeof window.soundEngine.playChainRattle === 'function') window.soundEngine.playChainRattle();
      } else {
        if (typeof window.soundEngine.playSwordSlash === 'function') window.soundEngine.playSwordSlash();
      }
    }

    if (window.eventBus) {
      window.eventBus.emit('OnAttackTelegraphed', telegraph);
    }
    return telegraph;
  }

  update() {
    for (let i = this.activeTelegraphs.length - 1; i >= 0; i--) {
      const tel = this.activeTelegraphs[i];
      tel.remainingFrames--;
      if (tel.attacker) {
        tel.targetX = tel.attacker.x + (tel.attacker.facing * 40);
        tel.targetY = tel.attacker.y;
      }
      if (tel.remainingFrames <= 0) {
        this.activeTelegraphs.splice(i, 1);
      }
    }
  }

  render(ctx, camera) {
    if (!ctx || this.activeTelegraphs.length === 0) return;

    ctx.save();
    this.activeTelegraphs.forEach(tel => {
      const progress = 1.0 - (tel.remainingFrames / tel.maxFrames);
      const alpha = 0.4 + (progress * 0.5);

      if (tel.type === 'AREA') {
        // Radial Ground Danger Decal
        ctx.strokeStyle = tel.color;
        ctx.fillStyle = tel.color + '22';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(tel.targetX, this.arena.groundY, tel.radius * progress, (tel.radius * 0.35) * progress, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Overhead Warning Indicator Glyph
        const overheadY = tel.targetY - 110;
        ctx.fillStyle = tel.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.font = 'bold 20px Cinzel, serif';
        ctx.textAlign = 'center';

        const symbol = tel.type === 'UNBLOCKABLE' ? '⚠️ UNBLOCKABLE' : (tel.type === 'THRUST' ? '➔ THRUST' : '⚡ DANGER');
        ctx.strokeText(symbol, tel.targetX, overheadY);
        ctx.fillText(symbol, tel.targetX, overheadY);

        // Pulsing directional indicator bar
        ctx.fillRect(tel.targetX - 25, overheadY + 6, 50 * (1.0 - progress), 3);
      }
    });
    ctx.restore();
  }
}

// ============================================================================
// Personality Profiles & Behavior Matrix (Spec 272)
const BOSS_PERSONALITIES = {
  Disciplined: { aggression: 1.0, blockRate: 0.35, dodgeRate: 0.25, counterBias: 0.30, preferredCategory: 'Counter' },
  Aggressive: { aggression: 1.4, blockRate: 0.15, dodgeRate: 0.15, counterBias: 0.10, preferredCategory: 'Combo' },
  Proud: { aggression: 1.1, blockRate: 0.20, dodgeRate: 0.10, counterBias: 0.20, preferredCategory: 'Opening' },
  Cunning: { aggression: 0.9, blockRate: 0.40, dodgeRate: 0.40, counterBias: 0.45, preferredCategory: 'Punish' },
  Unpredictable: { aggression: 1.25, blockRate: 0.25, dodgeRate: 0.30, counterBias: 0.25, preferredCategory: 'Area' },
  Defensive: { aggression: 0.75, blockRate: 0.60, dodgeRate: 0.35, counterBias: 0.40, preferredCategory: 'Defensive' },
  Berserker: { aggression: 1.6, blockRate: 0.05, dodgeRate: 0.10, counterBias: 0.05, preferredCategory: 'Ultimate' }
};

class BossAttackMemory {
  constructor(bossId = 'the_iron_warden', personality = 'Disciplined') {
    this.bossId = bossId;
    this.isEnraged = false;
    this.personality = personality; // 'Disciplined', 'Aggressive', 'Proud', 'Cunning', 'Unpredictable', 'Defensive', 'Berserker'
    this.personalities = BOSS_PERSONALITIES;

    // Categorized Boss Moveset (Spec 269)
    this.categories = {
      Opening: ['dash_cleave', 'thrust_strike'],
      Combo: ['heavy_slash', 'spin_sweep', 'overhead_smash'],
      Punish: ['crushing_blow', 'ground_quake'],
      Defensive: ['parry_stance', 'tactical_backstep'],
      Counter: ['counter_riposte', 'iron_shatter'],
      Area: ['earthquake_slam', 'flame_shockwave'],
      Ultimate: ['ultimate_eclipse', 'void_rend'],
      Emergency: ['radial_shatter', 'shadow_vanish']
    };

    // Attack Cooldown Timers in frames (Spec 270)
    this.cooldowns = {
      ultimate_eclipse: 0,
      void_rend: 0,
      earthquake_slam: 0,
      flame_shockwave: 0,
      ground_quake: 0,
      crushing_blow: 0,
      radial_shatter: 0
    };

    // Contextual Boss Taunt Catalog (Spec 273)
    this.taunts = {
      general: [
        "Your blade lacks spirit!",
        "Is that the best the Silent Veil can muster?",
        "Pathetic defense! Fall before my steel!",
        "You shall not pass this sacred gate!",
        "Yield, wanderer, before your soul breaks!"
      ],
      playerLowHealth: [
        "Your inner flame flickers into ashes!",
        "Kneel! The reaper is already at your back!"
      ],
      playerRepeatedBlocking: [
        "Cowering behind iron will not save you!",
        "I will shatter that brittle guard to splinters!"
      ],
      playerRepeatedDodging: [
        "Dance across the mist, but you cannot outrun fate!",
        "Cowardly footwork! Face me in honorable clash!"
      ],
      playerHighCombo: [
        "A fierce flurry! But steel bends before resolve!",
        "Enjoy your momentum while it lasts, shadow!"
      ],
      playerUltimate: [
        "Desperate magic cannot pierce my iron fortress!",
        "Is that your zenith? How disappointing!"
      ],
      bossNewPhase: [
        "You have only scratched the outer armor!",
        "Witness the true fury of Tsukishima's wrath!"
      ]
    };

    this.lastTauntFrame = 0;
  }

  setPersonality(name) {
    if (this.personalities[name]) {
      this.personality = name;
    }
  }

  updateCooldowns() {
    Object.keys(this.cooldowns).forEach(key => {
      if (this.cooldowns[key] > 0) this.cooldowns[key]--;
    });
  }

  canUseAttack(attackId) {
    if (attackId === 'ultimate') {
      return (this.cooldowns.ultimate_eclipse || 0) <= 0;
    }
    return (this.cooldowns[attackId] || 0) <= 0;
  }

  triggerAttack(attackId, cooldownFrames = 300) {
    if (attackId === 'ultimate') {
      this.cooldowns.ultimate_eclipse = cooldownFrames;
      return;
    }
    this.cooldowns[attackId] = cooldownFrames;
  }

  selectAttack(context = {}) {
    this.updateCooldowns();
    const { playerHpRatio = 1.0, playerState = 'IDLE', distance = 100, playerIsBlocking = false, currentPhase = 1 } = context;
    const traits = this.personalities[this.personality] || this.personalities.Disciplined;

    // 1. Enraged Special Selection (Spec 271)
    if (this.isEnraged && this.cooldowns.ultimate_eclipse === 0 && Math.random() < (0.35 * traits.aggression)) {
      this.cooldowns.ultimate_eclipse = 480; // 8 seconds cooldown (prevents infinite ultimate spam - Spec 270)
      return { category: 'Ultimate', attack: 'ultimate_eclipse', unblockable: true };
    }

    // 2. Punish heavy player blocking
    if (playerIsBlocking && distance < 110) {
      if (this.cooldowns.crushing_blow === 0) {
        this.cooldowns.crushing_blow = 180;
        return { category: 'Punish', attack: 'crushing_blow', unblockable: true };
      }
      return { category: 'Combo', attack: 'spin_sweep', unblockable: false };
    }

    // 3. Area Attack if player is evasive or mid-range
    if (distance >= 90 && distance <= 180 && this.cooldowns.earthquake_slam === 0 && (currentPhase >= 2 || Math.random() < 0.3)) {
      this.cooldowns.earthquake_slam = 360;
      return { category: 'Area', attack: 'earthquake_slam', unblockable: true };
    }

    // 4. Spacing / Opening
    if (distance > 180) {
      return { category: 'Opening', attack: 'dash_cleave', unblockable: false };
    }

    // 5. Default Combo / Close-range based on Personality
    if (distance <= 90) {
      if (traits.preferredCategory === 'Combo') {
        return { category: 'Combo', attack: 'heavy_slash', unblockable: false };
      }
      return { category: 'Combo', attack: 'overhead_smash', unblockable: false };
    }

    return { category: 'Opening', attack: 'thrust_strike', unblockable: false };
  }

  checkEnrage(hpRatio) {
    if (!this.isEnraged && hpRatio <= 0.25) {
      this.isEnraged = true;
      if (window.eventBus) {
        window.eventBus.emit('OnBossEnraged', { bossId: this.bossId, personality: this.personality });
      }
      return true;
    }
    return false;
  }

  getTaunt(context = {}) {
    const now = Date.now();
    if (now - this.lastTauntFrame > 7000) {
      this.lastTauntFrame = now;
      let pool = this.taunts.general;
      if (context.playerLowHealth && this.taunts.playerLowHealth) pool = this.taunts.playerLowHealth;
      else if (context.playerRepeatedBlocking && this.taunts.playerRepeatedBlocking) pool = this.taunts.playerRepeatedBlocking;
      else if (context.playerRepeatedDodging && this.taunts.playerRepeatedDodging) pool = this.taunts.playerRepeatedDodging;
      else if (context.playerHighCombo && this.taunts.playerHighCombo) pool = this.taunts.playerHighCombo;
      else if (context.bossNewPhase && this.taunts.bossNewPhase) pool = this.taunts.bossNewPhase;

      const t = pool[Math.floor(Math.random() * pool.length)];
      return t;
    }
    return null;
  }
}

// ============================================================================
// COMBAT COMMENTARY / HERALD SYSTEM (Spec 274)
// Subtle announcer banners and cues
// ============================================================================
class CombatCommentarySystem {
  constructor() {
    this.currentCallout = null;
    this.timer = 0;
  }

  announce(event, subtitle = '') {
    const callouts = {
      FIRST_BLOOD: { title: 'FIRST BLOOD', desc: 'The duel is ignited!', icon: '🩸' },
      COMBO_10: { title: 'DECISIVE ONSLAUGHT', desc: '10-hit relentless assault!', icon: '⚡' },
      COMBO_20: { title: 'DOMINION UNLEASHED', desc: '20-hit godlike mastery!', icon: '🔥' },
      PERFECT_BLOCK: { title: 'IRON PARRY', desc: 'Flawless steel reversal!', icon: '🛡️' },
      PERFECT_DODGE: { title: 'GHOST MIRAGE', desc: 'Sublime evasive timing!', icon: '💨' },
      BOSS_ENRAGE: { title: 'BERSERK AWAKENING', desc: 'The sovereign enters blood rage!', icon: '👹' },
      LOW_HEALTH: { title: 'EDGE OF ABYSS', desc: 'Last stand focus ignited!', icon: '⚠️' },
      VICTORY: { title: 'DUEL CONCLUDED', desc: 'Mastery over the shadows!', icon: '🏆' }
    };

    const callout = callouts[event] || { title: event, desc: subtitle, icon: '⚔️' };
    this.currentCallout = callout;
    this.timer = 120; // 2 seconds display

    if (window.notifications) {
      window.notifications.show(callout.title, callout.desc, callout.icon, 'combat', 2200);
    }
  }

  update() {
    if (this.timer > 0) {
      this.timer--;
      if (this.timer <= 0) this.currentCallout = null;
    }
  }
}

// ============================================================================
// COMBAT FLOW METER (Spec 286)
// Represents momentum: gains on perfect actions/combos, grants buffs at high flow
// ============================================================================
class CombatFlowSystem {
  constructor() {
    this.flow = 0; // 0 to 100%
    this.maxFlow = 100;
    this.inFlowState = false;
  }

  gainFlow(action) {
    let amount = 5;
    if (action === 'light_hit') amount = 6;
    if (action === 'heavy_hit') amount = 14;
    if (action === 'perfect_block') amount = 22;
    if (action === 'perfect_dodge') amount = 20;
    if (action === 'combo_threshold') amount = 15;
    if (action === 'counter_strike') amount = 25;

    this.flow = Math.min(this.maxFlow, this.flow + amount);
    if (this.flow >= 75 && !this.inFlowState) {
      this.inFlowState = true;
      if (window.eventBus) window.eventBus.emit('OnFlowStateEntered');
    }
  }

  loseFlow(amount = 20) {
    this.flow = Math.max(0, this.flow - amount);
    if (this.flow < 60) {
      this.inFlowState = false;
    }
  }

  update(dt = 1 / 60) {
    // Gentle natural decay when inactive
    if (this.flow > 0) {
      this.flow = Math.max(0, this.flow - dt * 2.5);
      if (this.flow < 60) this.inFlowState = false;
    }
  }

  getMultiplier() {
    return this.inFlowState ? 1.25 : 1.0;
  }

  registerEvent(event) {
    this.gainFlow(event);
  }

  getRewardMultiplier() {
    return this.getMultiplier();
  }
}

// ============================================================================
// STYLE RANK SYSTEM (Spec 283, 284, 285)
// Dynamic combat variety score: D, C, B, A, S, SS with forgiving decay
// ============================================================================
class StyleRankSystem {
  constructor() {
    this.score = 50;
    this.rank = 'D';
    this.recentActions = [];
    this.decayTimer = 0;
  }

  registerMove(move) {
    this.recordAction(move);
  }

  recordAction(actionType) {
    // Variety check
    let points = 50;
    const repeats = this.recentActions.filter(a => a === actionType).length;
    if (repeats === 0) points = 80; // High variety reward
    else if (repeats >= 3) points = 15; // Diminishing returns on spam

    this.score += points;
    this.recentActions.push(actionType);
    if (this.recentActions.length > 8) this.recentActions.shift();

    this.decayTimer = 180; // 3 seconds before decay
    this.updateRank();
  }

  takeDamagePenalty() {
    this.score = Math.max(0, this.score - 80);
    this.updateRank();
  }

  updateDecay(dt = 1) {
    this.update(dt);
  }

  update(dt = 1 / 60) {
    if (this.decayTimer > 0) {
      this.decayTimer--;
    } else {
      this.score = Math.max(0, this.score - dt * 25);
      this.updateRank();
    }
  }

  updateRank() {
    if (this.score >= 1500) this.rank = 'SS';
    else if (this.score >= 1000) this.rank = 'S';
    else if (this.score >= 700) this.rank = 'A';
    else if (this.score >= 400) this.rank = 'B';
    else if (this.score >= 200) this.rank = 'C';
    else this.rank = 'D';
  }

  getTitle() {
    const titles = { D: 'DISMAL', C: 'CLEAN', B: 'BRUTAL', A: 'ARTISTIC', S: 'SUPREME', SS: 'SHADOW MASTER' };
    return titles[this.rank] || 'FIGHTER';
  }
}

// ============================================================================
// ADVANCED COMBAT DIRECTOR (Spec 266, 275)
// Controls encounter pacing, dynamic aggression, visual/audio intensity without cheating
// ============================================================================
class CombatDirector {
  constructor(combatEngine) {
    this.combatEngine = combatEngine;
    this.pacingPhase = 'INTRO'; // 'INTRO', 'OPENING', 'BUILDUP', 'PEAK', 'CLIMAX', 'FINISH'
    this.fairnessMonitor = new FairnessMonitor();
    this.telegraphSystem = new AttackTelegraphSystem(combatEngine.arena);
    this.bossMemory = new BossAttackMemory();
    this.commentary = new CombatCommentarySystem();
    this.flowSystem = new CombatFlowSystem();
    this.styleSystem = new StyleRankSystem();

    // Spec 266 Monitoring Variables
    this.playerHealth = 1000;
    this.enemyHealth = 1000;
    this.playerStamina = 100;
    this.enemyStamina = 100;
    this.comboLength = 0;
    this.fightDuration = 0;
    this.playerPerformance = { hitsLanded: 0, hitsTaken: 0, parries: 0, dodges: 0, accuracy: 1.0 };
    this.bossPhase = 1;
    this.arenaState = 'normal'; // 'normal', 'fissured', 'burning', 'eclipse'
    this.difficulty = 'normal'; // 'easy', 'normal', 'hard', 'master' (Spec 325)

    // Output Controls (Spec 266)
    this.aggressionModifier = 1.0;
    this.musicIntensity = 1.0;
    this.vfxIntensity = 1.0;
    this.cinematicMomentActive = false;
    this.fightTimerFrames = 0;
    this.firstBlood = false;
  }

  setDifficulty(diff = 'normal') {
    this.difficulty = diff;
    if (diff === 'easy') {
      this.aggressionModifier = 0.75;
    } else if (diff === 'hard') {
      this.aggressionModifier = 1.30;
    } else if (diff === 'master') {
      this.aggressionModifier = 1.60;
    } else {
      this.aggressionModifier = 1.0;
    }
  }

  update() {
    this.fightTimerFrames++;
    const player = this.combatEngine.player;
    const enemy = this.combatEngine.enemy;
    if (!player || !enemy) return;

    // Spec 266 Telemetry Updates
    this.playerHealth = player.hp;
    this.enemyHealth = enemy.hp;
    this.playerStamina = player.stamina;
    this.enemyStamina = enemy.stamina;
    this.comboLength = this.combatEngine.comboEngine ? this.combatEngine.comboEngine.hitCount : 0;
    this.fightDuration = this.fightTimerFrames / 60;
    this.bossPhase = enemy.isBoss ? (this.combatEngine.aiDirector ? this.combatEngine.aiDirector.bossPhase : 1) : 1;
    if (this.combatEngine.arena) {
      this.arenaState = this.combatEngine.arena.weatherPreset || 'normal';
    }

    // Update child systems
    this.telegraphSystem.update();
    this.commentary.update();
    this.flowSystem.update();
    this.styleSystem.update();

    // 1. Evaluate Pacing Phase (Spec 275)
    this.evaluatePacing(player, enemy);

    // 2. Boss Enrage Check (Spec 271)
    if (enemy.isBoss) {
      const enrageTriggered = this.bossMemory.checkEnrage(enemy.hp / enemy.maxHp);
      if (enrageTriggered) {
        this.commentary.announce('BOSS_ENRAGE', 'The Warden embraces ancient wrath!');
        this.combatEngine.triggerSlowMo(60, 0.2);
        this.combatEngine.triggerCameraShake(24);
        this.vfxIntensity = 1.6;
        if (this.combatEngine.arena) {
          this.combatEngine.arena.setWeather('eclipse');
        }
      }
    }

    // 3. First Blood Check (Spec 274)
    if (!this.firstBlood && (player.hp < player.maxHp || enemy.hp < enemy.maxHp)) {
      this.firstBlood = true;
      this.commentary.announce('FIRST_BLOOD', 'Steel has struck flesh!');
    }

    // 4. Player Last Stand Warning (Spec 292)
    if (player.hp > 0 && player.hp / player.maxHp <= 0.15 && !player.lastStandTriggered) {
      player.lastStandTriggered = true;
      this.commentary.announce('LOW_HEALTH', 'Inner flame burning at critical boundary!');
      this.combatEngine.triggerSlowMo(40, 0.3);
      this.vfxIntensity = 1.4;
    }
  }

  evaluatePacing(player, enemy) {
    const elapsedSeconds = this.fightTimerFrames / 60;
    const totalHpRatio = (player.hp + enemy.hp) / (player.maxHp + enemy.maxHp);

    let baseAggr = 1.0;
    if (this.difficulty === 'easy') baseAggr = 0.75;
    else if (this.difficulty === 'hard') baseAggr = 1.25;
    else if (this.difficulty === 'master') baseAggr = 1.5;

    if (elapsedSeconds < 3) {
      this.pacingPhase = 'INTRO';
      this.aggressionModifier = baseAggr * 0.8;
      this.musicIntensity = 0.6;
      this.vfxIntensity = 0.8;
    } else if (totalHpRatio > 0.8) {
      this.pacingPhase = 'OPENING';
      this.aggressionModifier = baseAggr * 1.0;
      this.musicIntensity = 0.8;
      this.vfxIntensity = 1.0;
    } else if (totalHpRatio > 0.45) {
      this.pacingPhase = 'BUILDUP';
      this.aggressionModifier = baseAggr * 1.15;
      this.musicIntensity = 1.0;
      this.vfxIntensity = 1.1;
    } else if (totalHpRatio > 0.20) {
      this.pacingPhase = 'PEAK';
      this.aggressionModifier = baseAggr * 1.35;
      this.musicIntensity = 1.25;
      this.vfxIntensity = 1.35;
    } else if (enemy.hp > 0 && player.hp > 0) {
      this.pacingPhase = 'CLIMAX';
      this.aggressionModifier = baseAggr * 1.5;
      this.musicIntensity = 1.5;
      this.vfxIntensity = 1.5;
    } else {
      this.pacingPhase = 'FINISH';
      this.aggressionModifier = 0.5;
      this.musicIntensity = 1.0;
      this.vfxIntensity = 1.0;
    }

    if (window.soundEngine && typeof window.soundEngine.setIntensity === 'function') {
      window.soundEngine.setIntensity(this.musicIntensity);
    }
  }

  getEncounterTelemetry() {
    return {
      pacingPhase: this.pacingPhase,
      playerHealth: this.playerHealth,
      enemyHealth: this.enemyHealth,
      playerStamina: this.playerStamina,
      enemyStamina: this.enemyStamina,
      comboLength: this.comboLength,
      fightDurationSeconds: this.fightDuration,
      aggressionModifier: this.aggressionModifier,
      musicIntensity: this.musicIntensity,
      vfxIntensity: this.vfxIntensity,
      difficulty: this.difficulty,
      styleRank: this.styleSystem.rank,
      flow: Math.round(this.flowSystem.flow)
    };
  }

  onPlayerHit(hitInfo) {
    this.flowSystem.gainFlow(hitInfo.isHeavy ? 'heavy_hit' : 'light_hit');
    this.styleSystem.recordAction(hitInfo.attackId || 'light');
    if (this.combatEngine.comboEngine.currentCombo >= 10 && this.combatEngine.comboEngine.currentCombo % 10 === 0) {
      this.commentary.announce(`COMBO_${Math.min(20, this.combatEngine.comboEngine.currentCombo)}`);
    }
  }

  onPlayerDamageReceived() {
    this.flowSystem.loseFlow(25);
    this.styleSystem.takeDamagePenalty();
  }

  onPerfectDefend(type) {
    if (type === 'block') {
      this.flowSystem.gainFlow('perfect_block');
      this.styleSystem.recordAction('perfect_block');
      this.commentary.announce('PERFECT_BLOCK');
    } else if (type === 'dodge') {
      this.flowSystem.gainFlow('perfect_dodge');
      this.styleSystem.recordAction('perfect_dodge');
      this.commentary.announce('PERFECT_DODGE');
    }
  }
}

// Global Export
const _directorRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_directorRoot.HIT_STOP_PROFILES = HIT_STOP_PROFILES;
_directorRoot.BOSS_PERSONALITIES = BOSS_PERSONALITIES;
_directorRoot.FairnessMonitor = FairnessMonitor;
_directorRoot.AttackTelegraphSystem = AttackTelegraphSystem;
_directorRoot.BossAttackMemory = BossAttackMemory;
_directorRoot.CombatCommentarySystem = CombatCommentarySystem;
_directorRoot.CombatFlowSystem = CombatFlowSystem;
_directorRoot.StyleRankSystem = StyleRankSystem;
_directorRoot.CombatDirector = CombatDirector;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HIT_STOP_PROFILES,
    BOSS_PERSONALITIES,
    FairnessMonitor,
    AttackTelegraphSystem,
    BossAttackMemory,
    CombatCommentarySystem,
    CombatFlowSystem,
    StyleRankSystem,
    CombatDirector
  };
}
