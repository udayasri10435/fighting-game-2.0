/**
 * Shadow Samurai - Challenge Modes, Level Mutators, Gauntlet & Roguelite Engine,
 * Tournament Bracket, Daily Seed System, Battle Medals & Badges
 * Complies with specifications 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311.
 */

// ============================================================================
// LEVEL MUTATORS (Spec 300)
// ============================================================================
const LEVEL_MUTATORS = {
  fast_enemies: {
    id: 'fast_enemies',
    name: 'Gale Velocity',
    icon: '⚡',
    desc: 'Enemies move and strike 25% faster.',
    multiplier: 1.25
  },
  low_gravity: {
    id: 'low_gravity',
    name: 'Feather Fall',
    icon: '🪶',
    desc: 'Airborne hang-time doubled for extended aerial combos.',
    multiplier: 1.15
  },
  no_blocking: {
    id: 'no_blocking',
    name: 'Naked Steel',
    icon: '🚫',
    desc: 'Blocking is disabled. You must rely purely on dodging.',
    multiplier: 1.40
  },
  double_stamina: {
    id: 'double_stamina',
    name: 'Endless Vigor',
    icon: '💨',
    desc: 'Stamina regeneration doubled for all duelists.',
    multiplier: 1.10
  },
  double_damage: {
    id: 'double_damage',
    name: 'Deadly Edge',
    icon: '💀',
    desc: 'Both player and enemy deal 200% lethal damage.',
    multiplier: 1.50
  },
  invisible_hud: {
    id: 'invisible_hud',
    name: 'Blind Bushido',
    icon: '👁️',
    desc: 'HUD vitals and combo counters are completely hidden.',
    multiplier: 1.35
  },
  one_weapon_only: {
    id: 'one_weapon_only',
    name: 'Ronin Vow',
    icon: '🗡️',
    desc: 'Restricted strictly to the starting steel Katana.',
    multiplier: 1.20
  }
};

Object.defineProperty(LEVEL_MUTATORS, 'length', {
  get: () => Object.keys(LEVEL_MUTATORS).length,
  enumerable: false
});

// ============================================================================
// BATTLE MEDALS & SPECIAL VICTORY CONDITIONS (Spec 294, 295, 296, 297, 298)
// ============================================================================
class BattleMedalsManager {
  evaluateVictory(result = {}, player = {}, telemetry = {}) {
    const res = BattleMedalsManager.evaluateDuel({
      damageTaken: player ? Math.max(0, (player.maxHp || 1000) - (player.hp || 1000)) : 0,
      durationSeconds: telemetry ? (telemetry.fightDurationSeconds || 30) : 30,
      usedWeapon: player ? !!player.weapon : true,
      finishedWithSpecial: !!result.finishedWithSpecial,
      highestCombo: telemetry ? (telemetry.highestCombo || 0) : 0,
      perfectBlocks: telemetry ? (telemetry.perfectBlocks || 0) : 0
    });
    return res.medals;
  }

  static evaluateDuel({
    damageTaken = 0,
    durationSeconds = 60,
    usedWeapon = true,
    finishedWithSpecial = false,
    highestCombo = 0,
    perfectBlocks = 0,
    styleRank = 'B'
  }) {
    const medals = [];
    const titles = [];

    // 1. Perfect Victory (Spec 294)
    if (damageTaken === 0) {
      medals.push({ id: 'PERFECT_VICTORY', name: 'Flawless Shogun', icon: '👑', bonusGold: 300, bonusXp: 500 });
      titles.push('PERFECT VICTORY');
    }

    // 2. Speed Victory (Spec 295)
    if (durationSeconds <= 35) {
      medals.push({ id: 'SPEED_VICTORY', name: 'Lightning Slash', icon: '⚡', bonusGold: 150, bonusXp: 250 });
      titles.push('SPEED VICTORY');
    }

    // 3. No-Weapon Victory (Spec 296)
    if (!usedWeapon) {
      medals.push({ id: 'MARTIAL_VICTORY', name: 'Iron Fist Monk', icon: '🥋', bonusGold: 200, bonusXp: 400 });
      titles.push('MARTIAL VICTORY');
    }

    // 4. Special Finish (Spec 297)
    if (finishedWithSpecial) {
      medals.push({ id: 'SPECIAL_FINISH', name: 'Soul Cleave', icon: '✨', bonusGold: 100, bonusXp: 200 });
      titles.push('SPECIAL FINISH');
    }

    // Additional Performance Medals (Spec 298)
    if (highestCombo >= 15) {
      medals.push({ id: 'COMBO_LEGEND', name: 'Combo Master', icon: '🔥', bonusGold: 120, bonusXp: 200 });
    }
    if (perfectBlocks >= 3) {
      medals.push({ id: 'IRON_SHIELD', name: 'Aegis Bastion', icon: '🛡️', bonusGold: 120, bonusXp: 200 });
    }
    if (styleRank === 'S' || styleRank === 'SS') {
      medals.push({ id: 'STYLE_GOD', name: 'Cinematic Grandmaster', icon: '🎭', bonusGold: 150, bonusXp: 250 });
    }

    return {
      specialTitles: titles,
      medals,
      totalBonusGold: medals.reduce((sum, m) => sum + m.bonusGold, 0),
      totalBonusXp: medals.reduce((sum, m) => sum + m.bonusXp, 0)
    };
  }
}

// ============================================================================
// RANDOMIZED & DETERMINISTIC DAILY SEED CHALLENGE GENERATOR (Spec 301, 304, 305)
// ============================================================================
class ChallengeGenerator {
  // Simple deterministic PRNG from string seed
  static hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  getDailyChallenge(dateStr = new Date().toISOString().split('T')[0]) {
    const res = ChallengeGenerator.generateDailyChallenge(dateStr);
    return {
      seed: ChallengeGenerator.hashString(dateStr),
      date: dateStr,
      boss: { name: res.enemy, title: 'Trial Champion' },
      rewards: { gold: res.rewardGold, souls: 120, badge: 'Daily Conqueror' },
      ...res
    };
  }

  getWeeklyChallenge(weekNumber = 38) {
    const res = ChallengeGenerator.generateWeeklyChallenge(weekNumber);
    return {
      ...res,
      stages: [
        { floor: 1, boss: 'Ren the Wind-Cutter' },
        { floor: 2, boss: 'Master Kurokawa' },
        { floor: 3, boss: 'The Iron Warden' }
      ]
    };
  }

  static generateDailyChallenge(dateStr = new Date().toISOString().split('T')[0]) {
    const seed = this.hashString(dateStr);
    const enemies = ['Ren the Wind-Cutter', 'Master Kurokawa', 'The Iron Warden', 'Akane the Dual Edge', 'The Crimson Spearman'];
    const arenas = ['Crimson Bamboo Grove', 'The Iron Pagoda', 'Wind Shrine Steps', 'Sacred Torii Gate'];
    const mutatorsList = Object.keys(LEVEL_MUTATORS);

    const enemyIndex = seed % enemies.length;
    const arenaIndex = (seed >> 2) % arenas.length;
    const mutatorKey = mutatorsList[(seed >> 4) % mutatorsList.length];

    return {
      seedDate: dateStr,
      title: `Daily Trial: ${dateStr}`,
      enemy: enemies[enemyIndex],
      arena: arenas[arenaIndex],
      mutator: LEVEL_MUTATORS[mutatorKey],
      targetTimeSeconds: 45,
      rewardGold: 500,
      rewardXp: 750
    };
  }

  static generateWeeklyChallenge(weekNumber = 38) {
    const dateStr = `2026-W${weekNumber}`;
    const challenge = this.generateDailyChallenge(dateStr);
    challenge.title = `Weekly Grand Trial #${weekNumber}`;
    challenge.rewardGold = 1200;
    challenge.rewardXp = 2000;
    challenge.mutator2 = LEVEL_MUTATORS.double_damage;
    return challenge;
  }
}

// ============================================================================
// ROGUELITE & GAUNTLET MODE ENGINE (Spec 307, 308, 309, 310)
// Multi-floor ascent with randomized perk choices & permanent run summaries
// ============================================================================
const ROGUELITE_PERKS = [
  { id: 'iron_shin', name: 'Iron Shin', icon: '🦵', desc: '+25% Kick damage and instant sweep knockdown.', effect: { kickDamage: 1.25 } },
  { id: 'wind_gait', name: 'Wind Gait', icon: '💨', desc: '+20% Dodge distance and +6 invulnerability frames.', effect: { dodgeDist: 1.20 } },
  { id: 'spirit_font', name: 'Spirit Font', icon: '🔮', desc: '+35% faster Special Energy generation.', effect: { energyRegen: 1.35 } },
  { id: 'blade_edge', name: 'Razor Edge', icon: '🗡️', desc: '+12% Critical chance and +0.4x critical multiplier.', effect: { critChance: 0.12 } },
  { id: 'stone_will', name: 'Stone Will', icon: '🗿', desc: '+40 Max Poise and 50% faster poise recovery.', effect: { poiseBonus: 40 } },
  { id: 'vampiric_edge', name: 'Blood Leech', icon: '🩸', desc: 'Lifesteal: recover 4% of damage dealt as Health.', effect: { lifeSteal: 0.04 } }
];

class GauntletRogueliteManager {
  constructor() {
    this.activeRun = null;
    this.perksPool = ROGUELITE_PERKS;
  }

  startRun() {
    return this.startNewRun();
  }

  startNewRun() {
    this.activeRun = {
      floor: 1,
      currentFloor: 1,
      maxFloors: 5,
      playerHpCarry: 1000,
      upgradesCollected: [],
      perks: [],
      score: 0,
      enemiesDefeated: 0,
      startTime: Date.now(),
      completed: false
    };
    return this.activeRun;
  }

  getRandomPerkDraft(count = 3) {
    const shuffled = [...ROGUELITE_PERKS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  applyPerk(perkId) {
    if (!this.activeRun) return;
    const perk = ROGUELITE_PERKS.find(p => p.id === perkId) || { id: perkId, name: perkId, desc: 'Martial Perk' };
    this.activeRun.upgradesCollected.push(perk);
    if (!this.activeRun.perks.includes(perkId)) {
      this.activeRun.perks.push(perkId);
    }
  }

  draftPerk(perkId) {
    this.applyPerk(perkId);
  }

  completeFloor(victory = true) {
    return this.finishRun(victory);
  }

  advanceFloor(victorySummary) {
    if (!this.activeRun) return null;
    this.activeRun.enemiesDefeated++;
    this.activeRun.score += 1000 + (victorySummary.highestCombo || 0) * 50;
    this.activeRun.playerHpCarry = Math.min(1000, (victorySummary.remainingHp || 600) + 200); // 200 HP rest heal

    if (this.activeRun.currentFloor >= this.activeRun.maxFloors) {
      this.activeRun.completed = true;
      return this.finishRun(true);
    } else {
      this.activeRun.currentFloor++;
      this.activeRun.floor = this.activeRun.currentFloor;
      return {
        nextFloor: this.activeRun.currentFloor,
        perkDraft: this.getRandomPerkDraft(3)
      };
    }
  }

  finishRun(victory = false) {
    if (!this.activeRun) return null;
    const elapsedSeconds = Math.round((Date.now() - this.activeRun.startTime) / 1000);
    const summary = {
      victory,
      floorsCleared: victory ? this.activeRun.maxFloors : this.activeRun.currentFloor - 1,
      enemiesDefeated: this.activeRun.enemiesDefeated,
      upgradesCollected: [...this.activeRun.upgradesCollected],
      score: this.activeRun.score,
      timeSeconds: elapsedSeconds,
      rewardCoins: this.activeRun.enemiesDefeated * 250 + (victory ? 1000 : 0)
    };
    this.activeRun = null;
    return summary;
  }
}

// ============================================================================
// TOURNAMENT BRACKET SYSTEM (Spec 306)
// ============================================================================
class TournamentMode {
  constructor() {
    this.bracket = [
      { round: 'Quarter-Final', enemyName: 'Ren the Wind-Cutter', completed: false, won: false },
      { round: 'Semi-Final', enemyName: 'Master Kurokawa', completed: false, won: false },
      { round: 'Grand Final', enemyName: 'The Iron Warden', completed: false, won: false }
    ];
    this.currentMatchIndex = 0;
  }

  startTournament() {
    this.currentMatchIndex = 0;
    this.bracket.forEach(b => { b.completed = false; b.won = false; });
  }

  get currentRound() {
    return this.currentMatchIndex;
  }

  getCurrentMatch() {
    return this.bracket[this.currentMatchIndex] || null;
  }

  recordMatchWin() {
    return this.recordMatchResult(true);
  }

  recordMatchResult(won) {
    if (this.bracket[this.currentMatchIndex]) {
      this.bracket[this.currentMatchIndex].completed = true;
      this.bracket[this.currentMatchIndex].won = won;
      if (won) {
        this.currentMatchIndex++;
      }
    }
    return {
      tournamentWon: this.currentMatchIndex >= this.bracket.length,
      nextMatch: this.getCurrentMatch()
    };
  }
}

// ============================================================================
// COLLECTIBLE PROFILE BADGES (Spec 311)
// ============================================================================
const PROFILE_BADGES = {
  boss_slayer: { id: 'boss_slayer', name: 'Boss Slayer', icon: '👹', desc: 'Defeated all 5 Mini-Bosses and Chapter Guardians.' },
  combo_master: { id: 'combo_master', name: 'Combo Master', icon: '⚡', desc: 'Reached a flawless 25+ strike combo.' },
  perfect_fighter: { id: 'perfect_fighter', name: 'Untouchable', icon: '👑', desc: 'Earned a Perfect Victory without taking damage.' },
  weapon_master: { id: 'weapon_master', name: 'Weapon Master', icon: '⚔️', desc: 'Maxed weapon forge mastery on all 5 weapons.' },
  survivor: { id: 'survivor', name: 'Endless Survivor', icon: '🛡️', desc: 'Survived past Wave 15 in Endless Survival.' },
  speed_runner: { id: 'speed_runner', name: 'Flash Blade', icon: '⏱️', desc: 'Defeated a story champion in under 30 seconds.' }
};

Object.defineProperty(PROFILE_BADGES, 'length', {
  get: () => Object.keys(PROFILE_BADGES).length,
  enumerable: false
});

// Global Export
const _rogueliteRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_rogueliteRoot.LEVEL_MUTATORS = LEVEL_MUTATORS;
_rogueliteRoot.BattleMedalsManager = BattleMedalsManager;
_rogueliteRoot.ChallengeGenerator = ChallengeGenerator;
_rogueliteRoot.ROGUELITE_PERKS = ROGUELITE_PERKS;
_rogueliteRoot.GauntletRogueliteManager = GauntletRogueliteManager;
_rogueliteRoot.TournamentMode = TournamentMode;
_rogueliteRoot.PROFILE_BADGES = PROFILE_BADGES;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LEVEL_MUTATORS,
    BattleMedalsManager,
    ChallengeGenerator,
    ROGUELITE_PERKS,
    GauntletRogueliteManager,
    TournamentMode,
    PROFILE_BADGES
  };
}
