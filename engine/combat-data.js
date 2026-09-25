/**
 * Shadow Samurai - Central Balance & Combat Data Catalog
 * Configures all frame data, attack properties, combos, weapons, styles, status effects,
 * mini-bosses, boss mechanics, challenge modifiers, and balance constants.
 * Complies with specifications 71, 72, 73, 74, 75, 76, 77, 82, 83, 84, 85, 86, 87, 92, 93, 95, 129, 131, 135.
 */

window.COMBAT_DATA = {
  // Global Game Balance Constants (Spec 135)
  CONFIG: {
    FPS: 60,
    GRAVITY: 0.85,
    JUMP_FORCE: -17,
    MOVE_SPEED: 4.8,
    DASH_SPEED: 11.5,
    BASE_HP: 1000,
    BASE_STAMINA: 100,
    BASE_ENERGY: 100,
    BASE_GUARD: 100,
    STAMINA_REGEN: 0.45,
    STAMINA_EXHAUST_RECOVERY: 2.2, // seconds
    GUARD_REGEN: 0.25,
    GUARD_BREAK_STUN: 90, // frames (~1.5s)
    PERFECT_BLOCK_WINDOW: 8, // frames before hit
    PERFECT_DODGE_WINDOW: 8, // frames
    COUNTER_WINDOW_DURATION: 45, // frames
    COMBO_TIMEOUT: 75, // frames (~1.25s)
    RAGE_DURATION: 600, // 10s at 60fps
    RAGE_DAMAGE_BOOST: 1.35,
    RAGE_SPEED_BOOST: 1.25,
    WALL_BOUNCE_MIN_FORCE: 7.5,
    MAX_WALL_BOUNCES_PER_COMBO: 2,
    EXECUTION_HP_THRESHOLD: 0.15 // 15% HP or below
  },

  // Full Attack Catalog with Frame-Accurate Data & Configurable Properties (Spec 71, 82)
  ATTACKS: {
    // ---------------------------------------------------------
    // Grounded Light Attacks (Directional: Neutral, Forward, Back)
    // ---------------------------------------------------------
    light_1: {
      id: 'light_1',
      name: 'Shadow Jab',
      type: 'light',
      direction: 'neutral',
      damage: 35,
      staminaCost: 8,
      energyCost: 0,
      range: 75,
      startup: 5,
      active: 4,
      recovery: 8,
      hitStun: 18,
      blockStun: 8,
      guardDamage: 12,
      knockback: 2.5,
      launchForce: 0,
      criticalChance: 0.10,
      criticalMultiplier: 1.5,
      armor: 0,
      cancelWindow: 12,
      anim: 'jab',
      sfx: 'slash'
    },
    light_2: {
      id: 'light_2',
      name: 'Forward Cross Slash',
      type: 'light',
      direction: 'forward',
      damage: 48,
      staminaCost: 10,
      energyCost: 0,
      range: 88,
      startup: 6,
      active: 5,
      recovery: 10,
      hitStun: 22,
      blockStun: 10,
      guardDamage: 16,
      knockback: 3.5,
      launchForce: 0,
      criticalChance: 0.12,
      criticalMultiplier: 1.5,
      armor: 0,
      cancelWindow: 14,
      anim: 'cross_slash',
      sfx: 'slash'
    },
    light_3: {
      id: 'light_3',
      name: 'Twin Fang Backstep Finisher',
      type: 'light',
      direction: 'back',
      damage: 65,
      staminaCost: 14,
      energyCost: 0,
      range: 98,
      startup: 8,
      active: 6,
      recovery: 14,
      hitStun: 28,
      blockStun: 12,
      guardDamage: 22,
      knockback: 6.0,
      launchForce: 2.0,
      criticalChance: 0.15,
      criticalMultiplier: 1.6,
      armor: 0,
      cancelWindow: 16,
      anim: 'twin_slash',
      sfx: 'heavy_slash'
    },

    // ---------------------------------------------------------
    // Grounded Heavy Attacks (Directional: Neutral, Forward, Down)
    // ---------------------------------------------------------
    heavy_slash: {
      id: 'heavy_slash',
      name: 'Dragon Cleave',
      type: 'heavy',
      direction: 'neutral',
      damage: 95,
      staminaCost: 22,
      energyCost: 0,
      range: 110,
      startup: 16,
      active: 7,
      recovery: 20,
      hitStun: 36,
      blockStun: 22,
      guardDamage: 38,
      knockback: 8.5,
      launchForce: 3.5,
      criticalChance: 0.20,
      criticalMultiplier: 1.75,
      armor: 1, // 1 hit armor
      cancelWindow: 26,
      anim: 'cleave',
      sfx: 'heavy_slash'
    },
    heavy_thrust: {
      id: 'heavy_thrust',
      name: 'Viper Piercer Thrust',
      type: 'heavy',
      direction: 'forward',
      damage: 110,
      staminaCost: 25,
      energyCost: 0,
      range: 135,
      startup: 18,
      active: 6,
      recovery: 22,
      hitStun: 42,
      blockStun: 24,
      guardDamage: 45,
      knockback: 10.0,
      launchForce: 1.5,
      criticalChance: 0.25,
      criticalMultiplier: 1.8,
      armor: 1,
      cancelWindow: 28,
      anim: 'thrust',
      sfx: 'heavy_slash'
    },
    heavy_cleave: {
      id: 'heavy_cleave',
      name: 'Sundering Moon Overhead',
      type: 'heavy',
      direction: 'down',
      damage: 140,
      staminaCost: 32,
      energyCost: 0,
      range: 120,
      startup: 24,
      active: 8,
      recovery: 28,
      hitStun: 48,
      blockStun: 30,
      guardDamage: 65,
      knockback: 12.0,
      launchForce: 7.5, // High Launch into air
      criticalChance: 0.30,
      criticalMultiplier: 2.0,
      armor: 2, // Super armor
      cancelWindow: 34,
      anim: 'overhead_cleave',
      sfx: 'gong'
    },

    // ---------------------------------------------------------
    // Kicks (Directional: Neutral, Forward, Down)
    // ---------------------------------------------------------
    kick_front: {
      id: 'kick_front',
      name: 'Crane Snap Kick',
      type: 'kick',
      direction: 'neutral',
      damage: 40,
      staminaCost: 10,
      energyCost: 0,
      range: 82,
      startup: 6,
      active: 4,
      recovery: 9,
      hitStun: 20,
      blockStun: 8,
      guardDamage: 18,
      knockback: 4.0,
      launchForce: 0,
      criticalChance: 0.10,
      criticalMultiplier: 1.5,
      armor: 0,
      cancelWindow: 12,
      anim: 'front_kick',
      sfx: 'kick'
    },
    kick_roundhouse: {
      id: 'kick_roundhouse',
      name: 'Tornado Roundhouse',
      type: 'kick',
      direction: 'forward',
      damage: 62,
      staminaCost: 16,
      energyCost: 0,
      range: 98,
      startup: 10,
      active: 5,
      recovery: 14,
      hitStun: 28,
      blockStun: 14,
      guardDamage: 28,
      knockback: 7.0,
      launchForce: 2.5,
      criticalChance: 0.15,
      criticalMultiplier: 1.6,
      armor: 0,
      cancelWindow: 18,
      anim: 'roundhouse',
      sfx: 'kick'
    },
    kick_sweep: {
      id: 'kick_sweep',
      name: 'Low Serpent Sweep',
      type: 'kick',
      direction: 'down',
      damage: 55,
      staminaCost: 14,
      energyCost: 0,
      range: 88,
      startup: 8,
      active: 6,
      recovery: 16,
      hitStun: 35,
      blockStun: 12,
      guardDamage: 25,
      knockback: 5.0,
      launchForce: 6.0, // Knockdown launch
      criticalChance: 0.15,
      criticalMultiplier: 1.5,
      armor: 0,
      cancelWindow: 18,
      anim: 'low_sweep',
      sfx: 'kick'
    },

    // ---------------------------------------------------------
    // Aerial Attacks (Spec 82)
    // ---------------------------------------------------------
    air_punch: {
      id: 'air_punch',
      name: 'Falcon Fist',
      type: 'aerial',
      damage: 45,
      staminaCost: 12,
      energyCost: 0,
      range: 75,
      startup: 4,
      active: 6,
      recovery: 8,
      hitStun: 20,
      blockStun: 10,
      guardDamage: 15,
      knockback: 3.0,
      launchForce: -2.0,
      criticalChance: 0.12,
      criticalMultiplier: 1.5,
      armor: 0,
      cancelWindow: 12,
      anim: 'air_punch',
      sfx: 'slash'
    },
    air_kick: {
      id: 'air_kick',
      name: 'Thunderbolt Dive Kick',
      type: 'aerial',
      damage: 75,
      staminaCost: 18,
      energyCost: 0,
      range: 90,
      startup: 7,
      active: 10,
      recovery: 14,
      hitStun: 30,
      blockStun: 16,
      guardDamage: 28,
      knockback: 6.5,
      launchForce: -6.5, // Spikes downward
      criticalChance: 0.20,
      criticalMultiplier: 1.65,
      armor: 0,
      cancelWindow: 18,
      anim: 'dive_kick',
      sfx: 'kick'
    },
    air_slash: {
      id: 'air_slash',
      name: 'Sky Moon Arc',
      type: 'aerial',
      damage: 90,
      staminaCost: 20,
      energyCost: 0,
      range: 105,
      startup: 9,
      active: 8,
      recovery: 16,
      hitStun: 34,
      blockStun: 18,
      guardDamage: 32,
      knockback: 7.5,
      launchForce: 4.5, // Air juggle suspension
      criticalChance: 0.22,
      criticalMultiplier: 1.75,
      armor: 0,
      cancelWindow: 20,
      anim: 'air_slash',
      sfx: 'heavy_slash'
    },

    // ---------------------------------------------------------
    // Counter Attack (Spec 73)
    // ---------------------------------------------------------
    counter_strike: {
      id: 'counter_strike',
      name: 'Ghost Flash Counter',
      type: 'counter',
      damage: 135,
      staminaCost: 10,
      energyCost: 0,
      range: 115,
      startup: 3,
      active: 5,
      recovery: 10,
      hitStun: 45,
      blockStun: 25,
      guardDamage: 55,
      knockback: 9.5,
      launchForce: 4.5,
      criticalChance: 0.50,
      criticalMultiplier: 2.2,
      armor: 2,
      cancelWindow: 14,
      anim: 'counter_slash',
      sfx: 'slash'
    },

    // ---------------------------------------------------------
    // Special Attacks (Spec 76, 129, 130)
    // ---------------------------------------------------------
    special_shadow_dash: {
      id: 'special_shadow_dash',
      name: 'Shadow Step Lunge',
      type: 'special',
      damage: 125,
      staminaCost: 25,
      energyCost: 35,
      range: 230,
      startup: 10,
      active: 8,
      recovery: 14,
      hitStun: 40,
      blockStun: 22,
      guardDamage: 48,
      knockback: 10.0,
      launchForce: 3.5,
      criticalChance: 0.25,
      criticalMultiplier: 1.8,
      armor: 1,
      cancelWindow: 20,
      anim: 'shadow_dash',
      sfx: 'slash',
      statusEffect: { type: 'bleed', duration: 180, dps: 18 }
    },
    special_dragon_wave: {
      id: 'special_dragon_wave',
      name: 'Dragon Soul Blast',
      type: 'special',
      damage: 155,
      staminaCost: 30,
      energyCost: 50,
      range: 320,
      startup: 16,
      active: 12,
      recovery: 20,
      hitStun: 50,
      blockStun: 30,
      guardDamage: 65,
      knockback: 14.0,
      launchForce: 6.0,
      criticalChance: 0.25,
      criticalMultiplier: 1.8,
      armor: 1,
      cancelWindow: 28,
      anim: 'dragon_blast',
      sfx: 'taiko',
      projectile: {
        speed: 12,
        radius: 24,
        color: '#00e5ff',
        trail: 'cyan'
      }
    },
    special_whirlwind: {
      id: 'special_whirlwind',
      name: 'Iron Tempest Whirlwind',
      type: 'special',
      damage: 165,
      staminaCost: 35,
      energyCost: 60,
      range: 135,
      startup: 12,
      active: 24,
      recovery: 18,
      hitStun: 55,
      blockStun: 35,
      guardDamage: 80,
      knockback: 11.0,
      launchForce: 8.5,
      criticalChance: 0.20,
      criticalMultiplier: 1.7,
      armor: 2,
      cancelWindow: 32,
      anim: 'whirlwind',
      sfx: 'heavy_slash'
    },
    special_kunai_fan: {
      id: 'special_kunai_fan',
      name: 'Shadow Kunai Fan',
      type: 'special',
      damage: 115,
      staminaCost: 20,
      energyCost: 40,
      range: 280,
      startup: 8,
      active: 10,
      recovery: 14,
      hitStun: 35,
      blockStun: 20,
      guardDamage: 35,
      knockback: 6.0,
      launchForce: 2.0,
      criticalChance: 0.30,
      criticalMultiplier: 1.7,
      armor: 0,
      cancelWindow: 18,
      anim: 'kunai_throw',
      sfx: 'slash',
      statusEffect: { type: 'poison', duration: 200, dps: 14 },
      projectile: {
        speed: 14,
        radius: 12,
        color: '#51cf66',
        trail: 'green'
      }
    },

    // ---------------------------------------------------------
    // Multiple Ultimate Attacks (Spec 76, 77)
    // ---------------------------------------------------------
    ultimate_eclipse: {
      id: 'ultimate_eclipse',
      name: 'Shadow Eclipse Execution',
      type: 'ultimate',
      damage: 380,
      staminaCost: 40,
      energyCost: 100,
      range: 260,
      startup: 20,
      active: 32,
      recovery: 35,
      hitStun: 90,
      blockStun: 60,
      guardDamage: 125,
      knockback: 18.0,
      launchForce: 12.0,
      criticalChance: 0.50,
      criticalMultiplier: 2.2,
      armor: 99,
      cancelWindow: 50,
      anim: 'ultimate_slash',
      sfx: 'duel_start'
    },
    ultimate_dragon_ascent: {
      id: 'ultimate_dragon_ascent',
      name: 'Wrath of the Azure Dragon',
      type: 'ultimate',
      damage: 420,
      staminaCost: 45,
      energyCost: 100,
      range: 290,
      startup: 24,
      active: 36,
      recovery: 40,
      hitStun: 100,
      blockStun: 70,
      guardDamage: 150,
      knockback: 22.0,
      launchForce: 16.0,
      criticalChance: 0.55,
      criticalMultiplier: 2.5,
      armor: 99,
      cancelWindow: 55,
      anim: 'ultimate_dragon',
      sfx: 'duel_start'
    },
    ultimate_thousand_blossoms: {
      id: 'ultimate_thousand_blossoms',
      name: 'Thousand Blossoms Void Flurry',
      type: 'ultimate',
      damage: 460,
      staminaCost: 50,
      energyCost: 100,
      range: 300,
      startup: 22,
      active: 42,
      recovery: 42,
      hitStun: 110,
      blockStun: 75,
      guardDamage: 160,
      knockback: 20.0,
      launchForce: 14.0,
      criticalChance: 0.60,
      criticalMultiplier: 2.4,
      armor: 99,
      cancelWindow: 60,
      anim: 'ultimate_blossom',
      sfx: 'duel_start'
    }
  },

  // Professional Combo Engine Recipes & Database (Spec 72)
  COMBOS: [
    {
      id: 'combo_swift_cleave',
      name: 'Swift Dragon Cleave',
      sequence: ['light_1', 'light_2', 'heavy_slash'],
      bonusDamage: 1.25,
      tier: 3,
      desc: 'Light Jab → Cross Slash → Dragon Cleave.',
      unlocked: true
    },
    {
      id: 'combo_shadow_flurry',
      name: 'Shadow Flurry Kick',
      sequence: ['light_1', 'heavy_slash', 'kick_roundhouse'],
      bonusDamage: 1.30,
      tier: 3,
      desc: 'Light Jab → Heavy Slash → Tornado Roundhouse.',
      unlocked: true
    },
    {
      id: 'combo_iron_breaker',
      name: 'Iron Guard Breaker',
      sequence: ['kick_front', 'kick_roundhouse', 'heavy_cleave'],
      bonusDamage: 1.40,
      tier: 3,
      desc: 'Kick → Kick → Overhead Cleave.',
      unlocked: false
    },
    {
      id: 'combo_sky_fall',
      name: 'Aerial Skyfall Impact',
      sequence: ['air_punch', 'air_kick', 'kick_sweep'],
      bonusDamage: 1.35,
      tier: 3,
      desc: 'Jump Falcon Fist → Dive Kick → Ground Serpent Sweep.',
      unlocked: true
    },
    {
      id: 'combo_phantom_assault',
      name: 'Phantom Ghost Assault',
      sequence: ['light_1', 'heavy_slash', 'special_shadow_dash'],
      bonusDamage: 1.45,
      tier: 3,
      desc: 'Weapon Strike → Weapon Strike → Shadow Step Lunge.',
      unlocked: false
    },
    {
      id: 'combo_counter_vendetta',
      name: 'Vengeful Counter Strike',
      sequence: ['counter_strike', 'light_2', 'heavy_slash'],
      bonusDamage: 1.50,
      tier: 3,
      desc: 'Block Parry → Counter Strike → Heavy Cleave Combo.',
      unlocked: true
    },
    {
      id: 'combo_dodge_counter',
      name: 'Phantom Dodge Vendetta',
      sequence: ['counter_strike', 'kick_roundhouse', 'special_whirlwind'],
      bonusDamage: 1.55,
      tier: 3,
      desc: 'Perfect Dodge → Counter Strike → Tempest Whirlwind.',
      unlocked: false
    },
    {
      id: 'combo_dragon_ascension',
      name: 'Azure Dragon Ascension',
      sequence: ['light_1', 'light_2', 'light_3', 'heavy_thrust', 'special_dragon_wave'],
      bonusDamage: 1.70,
      tier: 5,
      desc: '5-Hit Master Chain concluding in Dragon Soul Blast.',
      unlocked: false
    }
  ],

  // Combo Tiers (Spec 72)
  COMBO_TIERS: [
    { hits: 2, title: 'STRIKE', color: '#eeddbb' },
    { hits: 3, title: 'BRUTAL', color: '#ffd56b' },
    { hits: 5, title: 'SAVAGE', color: '#ff922b' },
    { hits: 10, title: 'SHADOW DANCE', color: '#ff6b6b' },
    { hits: 15, title: 'TSUSHIMA WRATH', color: '#f03e3e' },
    { hits: 20, title: 'ECLIPSE DESTROYER', color: '#cc5de8' },
    { hits: 30, title: 'APEX GHOST GOD', color: '#00e5ff' }
  ],

  // Weapon Physics, Types & Mastery (Spec 83, 84, 85)
  WEAPONS: {
    katana: {
      id: 'katana',
      name: 'Kuro-Dragon Katana',
      type: 'Katana',
      speed: 1.15,
      damageMod: 1.0,
      rangeMod: 1.0,
      critMod: 0.15,
      guardMod: 1.0,
      durabilityMax: 100,
      costRepair: 80,
      desc: 'Balanced forged steel. Exceptionally sharp with rapid cancel recovery windows.',
      color: '#00e5ff',
      icon: '🗡️'
    },
    daggers: {
      id: 'daggers',
      name: 'Viper Twin Daggers',
      type: 'Daggers',
      speed: 1.45,
      damageMod: 0.75,
      rangeMod: 0.70,
      critMod: 0.30,
      guardMod: 0.70,
      durabilityMax: 80,
      costRepair: 60,
      desc: 'Ultra-fast double strikes. Short reach but builds combo counter and energy rapidly.',
      color: '#51cf66',
      icon: '🔪'
    },
    staff: {
      id: 'staff',
      name: 'Monk Iron-Wood Bo Staff',
      type: 'Staff',
      speed: 1.0,
      damageMod: 0.90,
      rangeMod: 1.45,
      critMod: 0.08,
      guardMod: 1.35,
      durabilityMax: 120,
      costRepair: 70,
      desc: 'Extended reach sweeping weapon. Exceptional block breaking and spacing control.',
      color: '#ffd43b',
      icon: '🥢'
    },
    heavy_blade: {
      id: 'heavy_blade',
      name: 'Demon-Bane Odachi',
      type: 'Heavy Blade',
      speed: 0.78,
      damageMod: 1.55,
      rangeMod: 1.35,
      critMod: 0.20,
      guardMod: 1.80,
      durabilityMax: 150,
      costRepair: 120,
      desc: 'Colossal two-handed greatsword. Super armor frames during startup; breaks guards in two hits.',
      color: '#ff6b6b',
      icon: '⚔️'
    },
    kusarigama: {
      id: 'kusarigama',
      name: 'Kusanagi Chain Sickle',
      type: 'Chain Weapon',
      speed: 1.05,
      damageMod: 0.95,
      rangeMod: 1.60,
      critMod: 0.18,
      guardMod: 1.15,
      durabilityMax: 110,
      costRepair: 95,
      desc: 'Deadly sickle anchored to a heavy weighted chain. Pulls enemies across the arena.',
      color: '#cc5de8',
      icon: '⛓️'
    },
    muramasa_eclipse: {
      id: 'muramasa_eclipse',
      name: 'Mythic Muramasa Katana',
      type: 'Mythic Katana',
      speed: 1.25,
      damageMod: 1.70,
      rangeMod: 1.20,
      critMod: 0.35,
      guardMod: 1.50,
      durabilityMax: 200,
      costRepair: 250,
      desc: 'Ancient cursed blade cloaked in black void fire. Unlocked in Secret Content / NG+.',
      color: '#ff0055',
      icon: '🔥'
    }
  },

  // 6 Martial Arts Fighting Styles (Spec 87, 88, 98)
  STYLES: {
    dragon: {
      id: 'dragon',
      name: 'Dragon Style',
      subtitle: 'The Balanced Sovereign',
      damageMult: 1.10,
      speedMult: 1.0,
      defenseMult: 1.0,
      staminaCostMult: 1.0,
      perk: 'Balanced mastery: +10% overall attack damage and standard energy gains.',
      icon: '🐉',
      color: '#ffd56b'
    },
    tiger: {
      id: 'tiger',
      name: 'Tiger Style',
      subtitle: 'The Ferocious Breaker',
      damageMult: 1.25,
      speedMult: 0.92,
      defenseMult: 1.05,
      staminaCostMult: 1.15,
      perk: 'Devastating heavy attacks with super armor frames and +40% guard damage.',
      icon: '🐅',
      color: '#ff922b'
    },
    wind: {
      id: 'wind',
      name: 'Wind Style',
      subtitle: 'The Swift Phantom',
      damageMult: 0.90,
      speedMult: 1.25,
      defenseMult: 0.88,
      staminaCostMult: 0.75,
      perk: 'Enhanced agility: 25% faster movement, lightning dashes, and quick recovery.',
      icon: '🌪️',
      color: '#00e5ff'
    },
    iron: {
      id: 'iron',
      name: 'Iron Style',
      subtitle: 'The Unyielding Fortress',
      damageMult: 0.95,
      speedMult: 0.85,
      defenseMult: 1.40,
      staminaCostMult: 0.90,
      perk: 'Fortress guard: Normal blocking reduces 85% damage; guard meter reinforced by 50%.',
      icon: '🛡️',
      color: '#a1a1aa'
    },
    shadow: {
      id: 'shadow',
      name: 'Shadow Style',
      subtitle: 'The Ghost of Tsushima',
      damageMult: 1.05,
      speedMult: 1.15,
      defenseMult: 0.95,
      staminaCostMult: 0.90,
      perk: 'Ghost parry: Doubles perfect dodge / parry window; counters inflict +50% critical damage.',
      icon: '🌑',
      color: '#b197fc'
    },
    void: {
      id: 'void',
      name: 'Void Sovereign',
      subtitle: 'The Eclipse Avatar',
      damageMult: 1.30,
      speedMult: 1.20,
      defenseMult: 1.10,
      staminaCostMult: 0.85,
      perk: 'Void Pierce: Attacks pierce 40% of enemy guard; dodges teleport across space.',
      icon: '🌌',
      color: '#e599f7'
    }
  },

  // Enemy AI Personalities (Spec 89, 90)
  AI_PERSONALITIES: {
    aggressive: {
      id: 'aggressive',
      name: 'Aggressive',
      attackFrequency: 0.85,
      blockChance: 0.20,
      dodgeChance: 0.15,
      counterChance: 0.10,
      dashTendency: 0.75,
      rageThreshold: 0.35,
      desc: 'Relentlessly charges and attacks without hesitation.'
    },
    defensive: {
      id: 'defensive',
      name: 'Defensive',
      attackFrequency: 0.40,
      blockChance: 0.75,
      dodgeChance: 0.35,
      counterChance: 0.30,
      dashTendency: 0.25,
      rageThreshold: 0.20,
      desc: 'Maintains guard patiently, waiting for player stamina exhaustion.'
    },
    counter: {
      id: 'counter',
      name: 'Counter',
      attackFrequency: 0.50,
      blockChance: 0.60,
      dodgeChance: 0.55,
      counterChance: 0.70,
      dashTendency: 0.40,
      rageThreshold: 0.25,
      desc: 'Anticipates player strikes and responds with punishing counters.'
    },
    rusher: {
      id: 'rusher',
      name: 'Rusher',
      attackFrequency: 0.90,
      blockChance: 0.15,
      dodgeChance: 0.25,
      counterChance: 0.05,
      dashTendency: 0.90,
      rageThreshold: 0.40,
      desc: 'Constantly closes distance with flying kicks and gap closers.'
    },
    tactical: {
      id: 'tactical',
      name: 'Tactical',
      attackFrequency: 0.65,
      blockChance: 0.50,
      dodgeChance: 0.45,
      counterChance: 0.40,
      dashTendency: 0.60,
      rageThreshold: 0.30,
      desc: 'Adapts dynamically to player tactics and exploits weaknesses.'
    },
    berserker: {
      id: 'berserker',
      name: 'Berserker',
      attackFrequency: 0.95,
      blockChance: 0.05,
      dodgeChance: 0.10,
      counterChance: 0.15,
      dashTendency: 0.85,
      rageThreshold: 0.50,
      desc: 'Sacrifices defense for overwhelming raw offensive power.'
    }
  },

  // 5 Mini-Bosses (Spec 93)
  MINI_BOSSES: [
    {
      id: 'mini_spear_hunter',
      name: 'The Spear Hunter',
      title: 'Mercenary of the Wild Hills',
      weapon: 'staff',
      style: 'wind',
      personality: 'rusher',
      maxHp: 1350,
      desc: 'A ruthless poacher turned bounty hunter wielding a razor-barbed lance.'
    },
    {
      id: 'mini_silent_monk',
      name: 'The Silent Monk',
      title: 'Hermit of Stone Sanctuary',
      weapon: 'staff',
      style: 'iron',
      personality: 'defensive',
      maxHp: 1500,
      desc: 'Sworn to silence, deflects strikes with unbreakable meditative iron stance.'
    },
    {
      id: 'mini_iron_beast',
      name: 'The Iron Beast',
      title: 'Colossus of the North',
      weapon: 'heavy_blade',
      style: 'tiger',
      personality: 'berserker',
      maxHp: 1800,
      desc: 'Enormous warrior in demon plate whose roar shatters wooden barriers.'
    },
    {
      id: 'mini_crimson_assassin',
      name: 'The Crimson Assassin',
      title: 'Shadow of Blood Moon',
      weapon: 'daggers',
      style: 'shadow',
      personality: 'counter',
      maxHp: 1400,
      desc: 'A phantom assassin who coats her twin blades in lethal weeping mist venom.'
    },
    {
      id: 'mini_fallen_champion',
      name: 'The Fallen Champion',
      title: 'Former Tsukishima Defender',
      weapon: 'katana',
      style: 'dragon',
      personality: 'tactical',
      maxHp: 1650,
      desc: 'A legendary master fallen under the Demon Shogun’s dark eclipse curse.'
    }
  ],

  // Boss Unique Mechanics (Spec 92)
  BOSS_MECHANICS: {
    teleport: { name: 'Shadow Step Teleport', cooldown: 240 },
    shield: { name: 'Iron Fortress Shield', cooldown: 300 },
    clones: { name: 'Void Phantom Clones', cooldown: 360 },
    earthquake: { name: 'Earthquake Ground Fissure', cooldown: 280 },
    venom_mist: { name: 'Weeping Mist Poison Cloud', cooldown: 320 },
    eclipse_meteor: { name: 'Abyssal Void Meteorite', cooldown: 400 }
  },

  // Status Effects System (Spec 131)
  STATUS_EFFECTS: {
    burn: {
      name: 'Burn',
      color: '#ff6b6b',
      icon: '🔥',
      tickInterval: 30, // Every 0.5s at 60fps
      desc: 'Continuous fire damage over time.'
    },
    bleed: {
      name: 'Bleed',
      color: '#c92a2a',
      icon: '🩸',
      tickInterval: 20,
      desc: 'Deep lacerations causing health loss.'
    },
    stun: {
      name: 'Stun',
      color: '#ffd43b',
      icon: '⚡',
      desc: 'Incapacitates target; cannot move, block or attack.'
    },
    slow: {
      name: 'Slow',
      color: '#74c0fc',
      icon: '❄️',
      speedPenalty: 0.5,
      desc: 'Reduces movement and attack speed by 50%.'
    },
    poison: {
      name: 'Poison',
      color: '#51cf66',
      icon: '☠️',
      tickInterval: 25,
      desc: 'Venom draining vitality and slowing stamina regen.'
    },
    armor_break: {
      name: 'Armor Break',
      color: '#ffa94d',
      icon: '💔',
      defensePenalty: 0.35,
      desc: 'Target takes 35% increased damage from all attacks.'
    },
    energy_drain: {
      name: 'Energy Drain',
      color: '#b197fc',
      icon: '🔮',
      desc: 'Siphons special energy from the victim.'
    }
  },

  // Challenge Modifiers (Spec 95)
  CHALLENGE_MODIFIERS: [
    { id: 'doubleDamage', name: 'DOUBLE DAMAGE', desc: 'All strikes deal 200% damage.', rewardMult: 1.5 },
    { id: 'lowStamina', name: 'LOW STAMINA', desc: 'Max stamina capped at 50%.', rewardMult: 1.4 },
    { id: 'noBlock', name: 'NO BLOCK', desc: 'Guard and blocking are disabled.', rewardMult: 1.6 },
    { id: 'noWeapon', name: 'NO WEAPON', desc: 'Combat is restricted to fists and kicks.', rewardMult: 1.8 },
    { id: 'timeLimit', name: 'TIME LIMIT', desc: 'Defeat the foe within 60 seconds.', rewardMult: 1.5 },
    { id: 'oneHitMode', name: 'ONE HIT MODE', desc: 'Lethal Sudden Death: One clean hit vanquishes.', rewardMult: 2.5 },
    { id: 'enemyRage', name: 'ENEMY RAGE', desc: 'Enemy commences duel in permanent Rage Mode.', rewardMult: 1.7 },
    { id: 'lowGravity', name: 'LOW GRAVITY', desc: 'Gravity reduced by 50% for extended air juggling.', rewardMult: 1.3 },
    { id: 'fastCombat', name: 'FAST COMBAT', desc: 'Duel runs at 1.4x hyper speed.', rewardMult: 1.4 }
  ]
};
