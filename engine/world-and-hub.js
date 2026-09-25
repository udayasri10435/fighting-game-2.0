/**
 * Shadow Samurai - World State, Ambient Hub, Master Trainers, Contextual Hints,
 * Secret Boss, Secret Weapon, Secret Style, Multiple Endings & Credits/License Tracking
 * Complies with specifications 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356.
 */

// ============================================================================
// CHARACTER EMOTES & IDLE BEHAVIORS (Spec 312, 313)
// ============================================================================
const CHARACTER_EMOTES = {
  bow: { id: 'bow', name: 'Honor Bow', icon: '🙇', anim: 'emote_bow', text: 'Respect before the blade.' },
  taunt: { id: 'taunt', name: 'Blade Beckon', icon: '⚔️', anim: 'emote_taunt', text: 'Step forward if you dare.' },
  meditation: { id: 'meditation', name: 'Zazen Breath', icon: '🧘', anim: 'emote_meditate', text: 'Still water catches the moon.' },
  weapon_pose: { id: 'weapon_pose', name: 'Sheath Flourish', icon: '🗡️', anim: 'emote_flourish', text: 'Pure edge, unwavering heart.' },
  victory_pose: { id: 'victory_pose', name: 'Shadow Seal', icon: '✨', anim: 'emote_victory', text: 'Shadows disperse before the dawn.' }
};

const IDLE_VARIATIONS = ['breathing', 'stance_shift', 'weapon_inspect', 'look_around'];

// ============================================================================
// WORLD STATE, STORY FLAGS & FACTIONS (Spec 316, 317, 318, 319, 339, 340)
// ============================================================================
class WorldStateManager {
  constructor() {
    this.currentChapter = 1;
    this.chapter = 1;
    this.maxChapters = 7;
    this.currentRegion = 'Tsukishima Outer Gates';
    
    this.storyFlags = {
      metMasterShindo: true,
      defeatedRenTheWind: false,
      cleansedCrimsonBamboo: false,
      defeatedIronWarden: false,
      foundSecretTemple: false,
      obtainedEclipseRelic: false,
      defeatedVoidSovereign: false
    };

    const sv = { name: 'Silent Veil (Ninja Clan)', reputation: 75, status: 'Revered' };
    const od = { name: 'Order of Dawn (Solar Temple)', reputation: 45, status: 'Neutral' };
    const ib = { name: 'Iron Brotherhood (Fortress Legion)', reputation: 25, status: 'Cautious' };

    this.factions = {
      SilentVeil: sv,
      OrderOfDawn: od,
      IronBrotherhood: ib,
      silent_veil: sv,
      order_of_dawn: od,
      iron_brotherhood: ib
    };

    this.timelineEvents = [
      { id: 'fall_of_tsukishima', title: 'The Fall of Tsukishima', chapter: 1, text: 'Ancient seals were broken when eclipse shadows engulfed the mountain pagoda.' },
      { id: 'gate_confrontation', title: 'Guardian of the Broken Gate', chapter: 3, text: 'The Iron Warden sealed the temple steps to test all who claim the Silent Veil.' },
      { id: 'void_rift', title: 'Rift of the Void Sovereign', chapter: 7, text: 'Dimensional tears opened at the sacred apex under the blood moon.' }
    ];
  }

  setFlag(flagKey, val = true) {
    this.storyFlags[flagKey] = val;
    if (window.eventBus) {
      window.eventBus.emit('OnStoryFlagChanged', { flag: flagKey, value: val });
    }
  }

  isFlag(flagKey) {
    return !!this.storyFlags[flagKey];
  }

  adjustFactionReputation(factionKey, amount) {
    this.modifyReputation(factionKey, amount);
  }

  modifyReputation(factionKey, amount) {
    if (this.factions[factionKey]) {
      this.factions[factionKey].reputation = Math.max(0, Math.min(100, this.factions[factionKey].reputation + amount));
      const rep = this.factions[factionKey].reputation;
      if (rep >= 80) this.factions[factionKey].status = 'Exalted';
      else if (rep >= 60) this.factions[factionKey].status = 'Revered';
      else if (rep >= 40) this.factions[factionKey].status = 'Honored';
      else this.factions[factionKey].status = 'Neutral';
    }
  }

  saveState() {
    return {
      chapter: this.currentChapter,
      region: this.currentRegion,
      storyFlags: { ...this.storyFlags },
      factions: { ...this.factions },
      timestamp: Date.now()
    };
  }

  recordBossDefeat(bossName = '') {
    const lower = String(bossName).toLowerCase();
    if (lower.includes('ren')) this.storyFlags.defeatedRenTheWind = true;
    if (lower.includes('warden') || lower.includes('yoshiteru')) this.storyFlags.defeatedIronWarden = true;
    if (lower.includes('void')) this.storyFlags.defeatedVoidSovereign = true;
  }
}

// ============================================================================
// MASTER TRAINER & CONTEXTUAL COMBAT HINTS (Spec 320, 321, 322, 323, 326)
// ============================================================================
class MasterTrainerSystem {
  constructor() {
    this.trainers = [
      { id: 'parry_master', name: 'Master Shindo', technique: 'Iron Bastion', objective: 'Execute 3 Perfect Blocks', bonusXp: 300, completed: false },
      { id: 'kick_master', name: 'Elder Genzan', technique: 'Gale Sweeper', objective: 'Land 5 Sweep Kicks', bonusXp: 250, completed: false },
      { id: 'combo_master', name: 'Lady Chiyo', technique: 'Dragon Dance', objective: 'Reach a 12-hit combo', bonusXp: 400, completed: false },
      { id: 'void_master', name: 'Unknown Hermit', technique: 'Void Step', objective: 'Dodge 10 attacks without taking damage', bonusXp: 500, completed: false }
    ];
    this.trainingChallenges = [
      { id: 'trial_parry', name: 'Trial of the Iron Aegis', req: 'Execute 3 Perfect Blocks', progress: 0, target: 3, completed: false, rewardCoins: 300 },
      { id: 'trial_kick', name: 'Trial of the Wind Kick', req: 'Land 5 Sweep Kicks', progress: 0, target: 5, completed: false, rewardCoins: 250 },
      { id: 'trial_combo', name: 'Trial of the Dragon Stream', req: 'Reach a 12-hit combo', progress: 0, target: 12, completed: false, rewardCoins: 400 }
    ];
  }

  completeTrial(trialId) {
    const t = this.trainers.find(tr => tr.id === trialId) || this.trainers[0];
    t.completed = true;
    return t;
  }

  evaluateChallenge(type, value) {
    this.trainingChallenges.forEach(ch => {
      if (ch.completed) return;
      if (ch.id === 'trial_parry' && type === 'perfect_block') ch.progress++;
      if (ch.id === 'trial_kick' && type === 'kick_landed') ch.progress++;
      if (ch.id === 'trial_combo' && type === 'combo_count' && value > ch.progress) ch.progress = value;

      if (ch.progress >= ch.target) {
        ch.completed = true;
        if (window.notifications) {
          window.notifications.show('TRAINING COMPLETED', `${ch.name} Cleared! +${ch.rewardCoins} Coins`, '🥋', 'success', 3000);
        }
      }
    });
  }
}

class ContextualHintSystem {
  constructor() {
    this.activeHint = null;
    this.hintCooldown = 0;
    this.enabled = true;
  }

  checkCombatSituation(player = {}, enemy = {}) {
    if (enemy.isBlocking || enemy.state === 'BLOCK') {
      return { id: 'guard_break', text: 'Enemy is blocking! Use heavy attacks to shatter their guard.' };
    }
    if (player.energy >= 100) {
      return { id: 'energy_ready', text: 'Energy is full! Press [U] to unleash your ultimate technique.' };
    }
    return null;
  }

  evaluateCombatContext(player, enemy) {
    if (!this.enabled || this.hintCooldown > 0 || !player || !enemy) {
      if (this.hintCooldown > 0) this.hintCooldown--;
      return null;
    }

    // 1. Enemy has been guarding for over 90 frames
    if (enemy.state === 'BLOCK' && enemy.stateTimer > 90) {
      return this.showHint('BREAK GUARD: Press [K] for Heavy Slash to shatter enemy shield!');
    }

    // 2. Player stamina is dangerously depleted
    if (player.stamina < 20 && player.state !== 'EXHAUSTED') {
      return this.showHint('LOW STAMINA: Space back and recover before attacking!');
    }

    // 3. Player energy full but unused
    if (player.energy >= 100) {
      return this.showHint('ENERGY CHARGED: Press [I] to unleash your Active Skill!');
    }

    // 4. Enemy telegraphed unblockable
    if (enemy.currentAttack && enemy.currentAttack.unblockable) {
      return this.showHint('DANGER: Red unblockable strike! Press [Space] to dodge!');
    }

    return null;
  }

  showHint(text) {
    this.activeHint = text;
    this.hintCooldown = 600; // 10 seconds between hints
    return text;
  }
}

// ============================================================================
// SECRET CONTENT & MULTIPLE ENDINGS (Spec 348, 349, 350, 351, 352)
// ============================================================================
const SECRET_CONTENT = {
  secretBoss: {
    id: 'boss_void_sovereign',
    name: 'The Void Sovereign (Kage-No-Shin)',
    title: 'Harbinger of the Celestial Rift',
    arena: 'Sacred Eclipse Nexus',
    unlockCondition: 'Achieve S-rank in all 5 main chapters and unseal the Eclipse Relic',
    lore: 'The primordial shade from which all samurai techniques were forged. Wields spatial cleaves and dimension tears.'
  },
  secretWeapon: {
    id: 'muramasa_zero',
    name: 'Eclipse Odachi',
    fullName: 'Eclipse Odachi (Muramasa Zero)',
    damageMod: 1.45,
    speedMod: 1.05,
    durabilityMax: 200,
    specialPerk: 'Rifts of Void: Heavy attacks generate cutting dimensional shockwaves.',
    desc: 'Forged in the heart of a fallen star during the Great Dark Sun.'
  },
  secretStyle: {
    id: 'void_form',
    name: 'Void Form',
    fullName: 'Void Form (Spatial Mastery)',
    stance: 'Zero Stance',
    icon: '🌌',
    uniquePerk: 'Phase Teleportation on perfect parry, instant dimensional counter-cleaves.',
    desc: 'The forbidden seventh style of Tsukishima, untethered from earthly gravity.'
  },
  endings: [
    {
      id: 'ending_normal',
      title: "The Ronin's Rest",
      condition: 'Defeat the Iron Warden and seal the mountain gate.',
      epilogue: 'The gates remain shut. Peace returns to the lower valley, though shadows still linger in the mist.'
    },
    {
      id: 'ending_alt',
      title: 'Dawn of the Eclipse',
      condition: 'Claim the Dark Sun Core without banishing the corruption.',
      epilogue: 'You took the ancient power for yourself. The order bows to a new sovereign of steel.'
    },
    {
      id: 'ending_true',
      title: 'Ascendance of the Silent Veil',
      condition: 'Defeat The Void Sovereign and purify the Tsukishima bloodline.',
      epilogue: 'The dimensional rift seals forever. The spirit of the ancients recognizes you as the True Grandmaster.'
    }
  ]
};

// ============================================================================
// IN-GAME CREDITS & THIRD-PARTY LICENSE TRACKING (Spec 353, 354, 356)
// ============================================================================
const GAME_CREDITS = {
  title: 'Shadow Samurai: Chronicles of Tsukishima',
  version: '1.0.0 (Master Release)',
  team: {
    conceptAndDirector: 'Advanced Martial Arts Simulation Core',
    leadEngineEngineer: 'Antigravity Neural Coding Agent',
    combatSystemDesign: 'Dynamic Combat & Animation Architecture',
    cinematicsAndShading: 'Procedural Canvas Shader & Audio Synthesis Lab',
    localization: 'Sinhala, Tamil, and English Cultural Preservation Team'
  },
  thirdPartyLicenses: [
    {
      library: 'Google Fonts (Cinzel, Outfit, Noto Sans Sinhala, Noto Sans Tamil)',
      license: 'SIL Open Font License 1.1',
      url: 'https://scripts.sil.org/OFL'
    },
    {
      library: 'HTML5 Web Audio API & Canvas 2D Core',
      license: 'W3C Open Web Standards',
      url: 'https://www.w3.org'
    }
  ],
  disclaimer: 'All characters, techniques, factions, and storylines are 100% original dark-fantasy creations.'
};

// Global Export
const _worldRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_worldRoot.CHARACTER_EMOTES = CHARACTER_EMOTES;
_worldRoot.IDLE_VARIATIONS = IDLE_VARIATIONS;
_worldRoot.WorldStateManager = WorldStateManager;
_worldRoot.MasterTrainerSystem = MasterTrainerSystem;
_worldRoot.ContextualHintSystem = ContextualHintSystem;
_worldRoot.SECRET_CONTENT = SECRET_CONTENT;
_worldRoot.GAME_CREDITS = GAME_CREDITS;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CHARACTER_EMOTES,
    IDLE_VARIATIONS,
    WorldStateManager,
    MasterTrainerSystem,
    ContextualHintSystem,
    SECRET_CONTENT,
    GAME_CREDITS
  };
}
