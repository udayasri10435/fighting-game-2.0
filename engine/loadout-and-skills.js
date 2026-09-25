/**
 * Shadow Samurai - Loadouts, Active/Passive Skills, Consumables, Objectives & Player Profile
 * Complies with specifications 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 200, 201, 202, 203, 204, 205, 206, 208, 209, 210, 211.
 */

// ============================================================================
// PLAYABLE CHARACTERS ROSTER (Spec 208, 209, 210, 211)
// ============================================================================
const PLAYABLE_CHARACTERS = {
  jin: {
    id: 'jin',
    name: 'Jin Kageyoshi',
    title: 'Shadow Ronin',
    clan: 'Silent Veil',
    avatar: '影',
    baseHp: 1000,
    baseStamina: 100,
    baseSpeed: 1.0,
    signatureMove: 'special_shadow_step',
    defaultWeapon: 'katana',
    desc: 'Master of the dual edge and shadow counters. Balanced agility and precision strikes.',
    stats: { strength: 75, defense: 70, agility: 80, endurance: 75, energy: 70 },
    attributes: { strength: 75, defense: 70, agility: 80, endurance: 75, energy: 70 }
  },
  tomoe: {
    id: 'tomoe',
    name: 'Priestess Tomoe',
    title: 'Solar Mystic',
    clan: 'Order of Dawn',
    avatar: '光',
    baseHp: 880,
    baseStamina: 115,
    baseSpeed: 1.15,
    signatureMove: 'special_dragon_wave',
    defaultWeapon: 'staff',
    desc: 'Wields sacred solar energy and long-reach naginata techniques. Superior energy generation.',
    stats: { strength: 65, defense: 60, agility: 92, endurance: 68, energy: 95 },
    attributes: { strength: 65, defense: 60, agility: 92, endurance: 68, energy: 95 }
  },
  raizo: {
    id: 'raizo',
    name: 'Raizo the Iron Mountain',
    title: 'Fortress Champion',
    clan: 'Iron Brotherhood',
    avatar: '鐵',
    baseHp: 1350,
    baseStamina: 90,
    baseSpeed: 0.85,
    signatureMove: 'special_whirlwind',
    defaultWeapon: 'heavy_blade',
    desc: 'Colossal barbarian warrior with immense poise and devastating cleaving blows.',
    stats: { strength: 95, defense: 90, agility: 45, endurance: 95, energy: 50 },
    attributes: { strength: 95, defense: 90, agility: 45, endurance: 95, energy: 50 }
  }
};

// ============================================================================
// ACTIVE SKILLS CATALOG (Spec 192, 193)
// ============================================================================
const ACTIVE_SKILLS_LIST = [
  {
    id: 'dash_strike',
    name: 'Ghost Flash Dash',
    type: 'dash',
    cooldown: 8, // seconds
    energyCost: 20,
    damage: 85,
    icon: '⚡',
    desc: 'Instantly teleports forward, slicing through enemy guard.'
  },
  {
    id: 'energy_burst',
    name: 'Ki Detonation Burst',
    type: 'projectile',
    cooldown: 10,
    energyCost: 25,
    damage: 110,
    icon: '💥',
    desc: 'Unleashes a radial blast of spiritual kinetic energy.'
  },
  {
    id: 'counter_shield',
    name: 'Iron Reflection Barrier',
    type: 'shield',
    cooldown: 14,
    energyCost: 30,
    duration: 3,
    icon: '🛡️',
    desc: 'Deploys a barrier that automatically parries the next 2 hits.'
  },
  {
    id: 'healing_focus',
    name: 'Inner Sanctuary Heal',
    type: 'heal',
    cooldown: 18,
    energyCost: 40,
    healAmount: 220,
    icon: '🌿',
    desc: 'Channels spiritual breathing to restore 220 Health.'
  },
  {
    id: 'shadow_step',
    name: 'Void Phase Step',
    type: 'teleport',
    cooldown: 7,
    energyCost: 15,
    invulnFrames: 30,
    icon: '👤',
    desc: 'Phases behind the opponent with brief invulnerability.'
  },
  {
    id: 'ground_breaker',
    name: 'Earthquake Slam',
    type: 'area',
    cooldown: 12,
    energyCost: 35,
    damage: 130,
    icon: '🌋',
    desc: 'Slams ground creating a seismic wave that launches foes.'
  }
];

const ACTIVE_SKILLS = ACTIVE_SKILLS_LIST;
ACTIVE_SKILLS_LIST.forEach(s => {
  ACTIVE_SKILLS[s.id] = s;
});

// ============================================================================
// PASSIVE SKILLS CATALOG (Spec 191)
// ============================================================================
const PASSIVE_SKILLS = {
  stamina_surge: {
    id: 'stamina_surge',
    name: 'Endless Breath',
    icon: '💨',
    desc: '+20% faster stamina regeneration.',
    effect: { staminaRegenMult: 1.20 }
  },
  iron_skin: {
    id: 'iron_skin',
    name: 'Steel Bastion',
    icon: '🛡️',
    desc: '+15% damage reduction on all incoming attacks.',
    effect: { defenseMult: 1.15 }
  },
  critical_edge: {
    id: 'critical_edge',
    name: 'Razor Mind',
    icon: '🎯',
    desc: '+8% base critical hit chance and +0.3x multiplier.',
    effect: { critChanceBonus: 0.08, critMultBonus: 0.3 }
  },
  soul_reaper: {
    id: 'soul_reaper',
    name: 'Essence Siphon',
    icon: '💠',
    desc: '+25% faster special energy acquisition.',
    effect: { energyGainMult: 1.25 }
  }
};

// ============================================================================
// COMBAT CONSUMABLES (Spec 194)
// ============================================================================
const CONSUMABLES_CATALOG = {
  healing_gourd: {
    id: 'healing_gourd',
    name: 'Mountain Spring Gourd',
    icon: '🍶',
    maxCharges: 3,
    cooldown: 15,
    desc: 'Instantly recovers 280 HP.',
    action: (player) => {
      player.hp = Math.min(player.maxHp, player.hp + 280);
      return 'Restored 280 HP!';
    }
  },
  spirit_elixir: {
    id: 'spirit_elixir',
    name: 'Shadow Soul Elixir',
    icon: '🧪',
    maxCharges: 2,
    cooldown: 20,
    desc: 'Fully charges 50% Special Energy.',
    action: (player) => {
      player.energy = Math.min(player.maxEnergy, player.energy + 50);
      return '+50% Special Energy!';
    }
  },
  tiger_tonic: {
    id: 'tiger_tonic',
    name: 'Tiger Berserk Brew',
    icon: '🍷',
    maxCharges: 2,
    cooldown: 25,
    desc: 'Grants +30% attack damage for 10 seconds.',
    action: (player) => {
      player.rage = Math.min(player.maxRage, player.rage + 40);
      return '+40% Rage and Damage boost!';
    }
  }
};

// ============================================================================
// BUILD PRESETS MANAGER (Spec 189)
// ============================================================================
const DEFAULT_BUILD_PRESETS = [
  {
    id: 'balanced',
    name: 'Dragon Vanguard',
    weapon: 'katana',
    style: 'dragon',
    skills: ['dash_strike', 'healing_focus'],
    passives: ['stamina_surge', 'iron_skin']
  },
  {
    id: 'fast',
    name: 'Shadow Phantom',
    weapon: 'daggers',
    style: 'wind',
    skills: ['dash_strike', 'counter_shield'],
    passives: ['critical_edge', 'soul_reaper']
  },
  {
    id: 'heavy',
    name: 'Iron Juggernaut',
    weapon: 'heavy_blade',
    style: 'iron',
    skills: ['ground_breaker', 'counter_shield'],
    passives: ['iron_skin', 'stamina_surge']
  },
  {
    id: 'boss_hunter',
    name: 'Demon Sovereign Slayer',
    weapon: 'muramasa_eclipse',
    style: 'void',
    skills: ['ground_breaker', 'healing_focus'],
    passives: ['critical_edge', 'soul_reaper']
  }
];

DEFAULT_BUILD_PRESETS.forEach(p => {
  DEFAULT_BUILD_PRESETS[p.id] = p;
});

// ============================================================================
// LIFETIME STATISTICS & COMBAT HISTORY (Spec 204, 205, 206)
// ============================================================================
class CombatStatisticsManager {
  static _instance = null;

  static getInstance() {
    if (!this._instance) {
      this._instance = new CombatStatisticsManager();
    }
    return this._instance;
  }

  static recordDuel(summary) {
    return this.getInstance().recordDuel(summary);
  }

  static getStats() {
    return this.getInstance().getStats();
  }

  constructor() {
    this.stats = {
      totalDuels: 48,
      totalFights: 48,
      victories: 42,
      wins: 42,
      defeats: 6,
      losses: 6,
      totalDamageDealt: 184500,
      totalDamageTaken: 42100,
      highestCombo: 14,
      totalPerfectBlocks: 132,
      totalPerfectDodges: 89,
      totalBossesDefeated: 9,
      totalExecutions: 28,
      fastestVictorySeconds: 18,
      highestSurvivalWave: 12
    };

    this.recentHistory = [
      { enemy: 'Lord Yoshiteru', stage: 'The Iron Pagoda', result: 'VICTORY', rating: 'S', combo: 8, time: '00:48', date: 'Just now' },
      { enemy: 'Master Kurokawa', stage: 'Crimson Bamboo', result: 'VICTORY', rating: 'A', combo: 6, time: '01:05', date: '10m ago' },
      { enemy: 'Ren the Wind-Cutter', stage: 'Wind Shrine', result: 'VICTORY', rating: 'S+', combo: 11, time: '00:32', date: '25m ago' }
    ];

    this.activeTitle = 'Shadow Ronin'; // Spec 202
    this.unlockedTitles = ['Novice', 'Wanderer', 'Shadow Ronin', 'Champion of Tsukishima', 'Eclipse Hunter'];
  }

  getStats() {
    return {
      ...this.stats,
      wins: this.stats.victories,
      totalFights: this.stats.totalDuels,
      losses: this.stats.defeats
    };
  }

  recordDuel(summary) {
    this.stats.totalDuels++;
    this.stats.totalFights = this.stats.totalDuels;
    if (summary.victory) {
      this.stats.victories++;
      this.stats.wins = this.stats.victories;
    } else {
      this.stats.defeats++;
      this.stats.losses = this.stats.defeats;
    }

    this.stats.totalDamageDealt += summary.damageDealt || 0;
    this.stats.totalDamageTaken += summary.damageTaken || 0;
    this.stats.totalPerfectBlocks += summary.perfectBlocks || 0;
    this.stats.totalPerfectDodges += summary.perfectDodges || (summary.dodges || 0);

    if (summary.highestCombo > this.stats.highestCombo) {
      this.stats.highestCombo = summary.highestCombo;
    }
    if (summary.timeSeconds && summary.timeSeconds < this.stats.fastestVictorySeconds) {
      this.stats.fastestVictorySeconds = summary.timeSeconds;
    }

    // Add to history
    this.recentHistory.unshift({
      enemy: summary.enemyName || 'Champion',
      stage: summary.stageTitle || 'Sacred Ground',
      result: summary.victory ? 'VICTORY' : 'DEFEATED',
      rating: summary.rating || 'A',
      combo: summary.highestCombo || 0,
      time: summary.timeString || '01:00',
      date: 'Just now'
    });

    if (this.recentHistory.length > 8) {
      this.recentHistory.pop();
    }
  }

  // Calculate Mission Rating (Spec 197)
  static calculateMissionRating(summary) {
    let score = 100;

    // Time penalty
    if (summary.timeSeconds > 90) score -= 15;
    else if (summary.timeSeconds < 45) score += 15;

    // Damage taken penalty
    const hpLossRatio = (summary.damageTaken || 0) / (summary.playerMaxHp || 1000);
    if (hpLossRatio > 0.6) score -= 20;
    else if (hpLossRatio < 0.2) score += 20;

    // Combo reward
    if (summary.highestCombo >= 10) score += 20;
    else if (summary.highestCombo >= 5) score += 10;

    // Perfect blocks reward
    score += (summary.perfectBlocks || 0) * 5;

    if (score >= 135) return { grade: 'S+', stars: '★★★', title: 'Flawless Mastery' };
    if (score >= 115) return { grade: 'S', stars: '★★★', title: 'Exemplary Blade' };
    if (score >= 95) return { grade: 'A', stars: '★★☆', title: 'Skilled Duelist' };
    if (score >= 75) return { grade: 'B', stars: '★★☆', title: 'Hard-fought Triumph' };
    if (score >= 50) return { grade: 'C', stars: '★☆☆', title: 'Narrow Survival' };
    return { grade: 'D', stars: '★☆☆', title: 'Disheveled Victor' };
  }
}

const _loadoutRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);

_loadoutRoot.PLAYABLE_CHARACTERS = PLAYABLE_CHARACTERS;
_loadoutRoot.ACTIVE_SKILLS = ACTIVE_SKILLS;
_loadoutRoot.PASSIVE_SKILLS = PASSIVE_SKILLS;
_loadoutRoot.CONSUMABLES_CATALOG = CONSUMABLES_CATALOG;
_loadoutRoot.DEFAULT_BUILD_PRESETS = DEFAULT_BUILD_PRESETS;
_loadoutRoot.CombatStatisticsManager = CombatStatisticsManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLAYABLE_CHARACTERS,
    ACTIVE_SKILLS,
    PASSIVE_SKILLS,
    CONSUMABLES_CATALOG,
    DEFAULT_BUILD_PRESETS,
    CombatStatisticsManager
  };
}
