/**
 * Shadow Samurai - RPG Systems, Progression, Merchant, Forge, Quests, Codex & 40 Achievements
 * Implements attribute point allocation, weapon mastery 1-10, categorized inventory,
 * blacksmith forge, merchant bazaar, daily challenges, challenge modifiers, and lore codex.
 * Complies with specifications 85, 86, 87, 88, 95, 96, 97, 98, 113, 114, 115, 116, 117, 118, 119, 120, 121.
 */

class RPGSystem {
  constructor() {
    // Player Currencies & Level (Spec 115, 117)
    this.playerLevel = 48;
    this.playerXp = 8400;
    this.playerXpNext = 10000;
    this.gold = 42500;
    this.shadowSouls = 1840;
    this.vermilionSeals = 14;
    this.attributePoints = 6;

    // Attributes (Spec 86)
    this.attributes = {
      strength: 18,
      defense: 15,
      agility: 16,
      endurance: 14,
      energy: 12,
      weaponMastery: 4
    };

    // Weapon Mastery XP (Spec 85: Level 1 -> 10)
    this.weaponMasteries = {
      katana: { level: 6, xp: 450, maxLevel: 10, name: 'Katana Mastery' },
      daggers: { level: 3, xp: 180, maxLevel: 10, name: 'Daggers Mastery' },
      staff: { level: 2, xp: 90, maxLevel: 10, name: 'Bo Staff Mastery' },
      heavy_blade: { level: 4, xp: 320, maxLevel: 10, name: 'Odachi Mastery' },
      kusarigama: { level: 1, xp: 20, maxLevel: 10, name: 'Kusarigama Mastery' },
      muramasa_eclipse: { level: 1, xp: 0, maxLevel: 10, name: 'Muramasa Mastery' }
    };

    // Active Equipment & Style (Spec 87, 88)
    this.activeStyle = 'shadow';
    this.unlockedStyles = ['dragon', 'tiger', 'wind', 'iron', 'shadow'];
    this.activeWeapon = 'katana';
    this.unlockedWeapons = ['katana', 'daggers', 'staff', 'heavy_blade', 'kusarigama'];

    // Categorized Inventory System (Spec 118)
    this.inventory = [
      // Weapons
      { id: 'katana', cat: 'weapons', type: 'Katana', name: 'Kuro-Dragon Katana', level: 6, desc: 'Balanced forged steel. Exceptionally sharp.', equipped: true, icon: '🗡️' },
      { id: 'daggers', cat: 'weapons', type: 'Daggers', name: 'Viper Twin Daggers', level: 3, desc: 'Ultra-fast double strikes with high crit.', equipped: false, icon: '🔪' },
      { id: 'staff', cat: 'weapons', type: 'Staff', name: 'Monk Iron-Wood Bo Staff', level: 2, desc: 'Extended sweeping reach and guard pressure.', equipped: false, icon: '🥢' },
      { id: 'heavy_blade', cat: 'weapons', type: 'Heavy Blade', name: 'Demon-Bane Odachi', level: 4, desc: 'Colossal two-handed greatsword with super armor.', equipped: false, icon: '⚔️' },
      { id: 'kusarigama', cat: 'weapons', type: 'Chain Weapon', name: 'Kusanagi Chain Sickle', level: 1, desc: 'Sickle with weighted chain pulling enemies.', equipped: false, icon: '⛓️' },
      
      // Equipment / Armor
      { id: 'shadow_mantle', cat: 'equipment', type: 'Garb', name: 'Shadow Shinobi Garb', defBonus: 14, desc: 'Midnight silk robe dampening sound and impacts.', equipped: true, icon: '🥋' },
      { id: 'iron_greaves', cat: 'equipment', type: 'Armor', name: 'Black Iron Greaves', defBonus: 18, desc: 'Reinforced leg armor absorbing heavy impacts.', equipped: false, icon: '🛡️' },

      // Charms & Talismans
      { id: 'dragon_jade', cat: 'charms', type: 'Talisman', name: 'Azure Dragon Jade', critBonus: 0.08, desc: 'Grants +8% critical strike probability.', equipped: true, icon: '💠' },
      { id: 'oni_talisman', cat: 'charms', type: 'Talisman', name: 'Talisman of the Oni', rageBonus: 0.20, desc: 'Increases Rage meter gain rate by +20%.', equipped: false, icon: '👺' },

      // Materials
      { id: 'iron_ore', cat: 'materials', type: 'Ore', name: 'Black Iron Ore', quantity: 38, desc: 'Dense volcanic ore for forging blades.', icon: '🪨' },
      { id: 'spirit_silk', cat: 'materials', type: 'Silk', name: 'Spirit Weaver Silk', quantity: 24, desc: 'Ethereal thread spun from mountain spirits.', icon: '🧶' },

      // Special Items
      { id: 'vermilion_seal_token', cat: 'special', type: 'Artifact', name: 'Vermilion Seal of Shogun', quantity: 14, desc: 'Royal clan insignia awarded upon vanquishing chapter champions.', icon: '💮' },
      { id: 'secret_scroll_void', cat: 'special', type: 'Secret', name: 'Tome of the Void Sovereign', quantity: 1, desc: 'Forbidden calligraphy teaching the mythical Void stance.', icon: '📜' }
    ];

    // Merchant Bazaar Catalog (Spec 115)
    this.merchantStock = [
      { id: 'muramasa_hilt', name: 'Cursed Muramasa Hilt', type: 'material', price: 3500, desc: 'Increases weapon critical multiplier by +0.3' },
      { id: 'oni_talisman', name: 'Talisman of the Oni', type: 'charm', price: 5000, desc: 'Grants +20% faster Rage meter accumulation' },
      { id: 'iron_whetstone', name: 'Imperial Whetstone', type: 'consumable', price: 800, desc: 'Restores weapon durability to 100% instantly' },
      { id: 'void_essence', name: 'Void Soul Orb', type: 'material', price: 2400, desc: 'Rare essence required for forging mythical tier arms' },
      { id: 'tiger_scroll', name: 'Tiger Stance Secret Manual', type: 'charm', price: 4200, desc: 'Increases heavy attack guard damage by +25%' }
    ];

    // 40 Achievements Catalog (Spec 97)
    this.achievements = this.createAchievementsCatalog();

    // Daily Challenges (Spec 96)
    this.dailyChallenges = [
      { id: 'daily_1', text: 'Win 3 Combat Duels', target: 3, current: 1, reward: 1200, completed: false },
      { id: 'daily_2', text: 'Perform 50 Total Attacks', target: 50, current: 32, reward: 800, completed: false },
      { id: 'daily_3', text: 'Execute 5 Perfect Blocks', target: 5, current: 3, reward: 1500, completed: false },
      { id: 'daily_4', text: 'Achieve a 10-Hit Combo', target: 10, current: 12, reward: 2000, completed: true }
    ];

    // Challenge Modifiers (Spec 95)
    this.challengeModifiers = {
      doubleDamage: false,
      lowStamina: false,
      noBlock: false,
      noWeapon: false,
      timeLimit: false,
      oneHitMode: false,
      enemyRage: false,
      lowGravity: false,
      fastCombat: false
    };

    // Lore Codex & Factions (Spec 120, 121)
    this.codex = this.createCodexData();
  }

  // Allocate Attribute Point (Spec 86)
  investAttribute(attr) {
    if (this.attributePoints > 0 && this.attributes[attr] !== undefined) {
      this.attributes[attr]++;
      this.attributePoints--;
      if (window.soundEngine) window.soundEngine.playTaiko(1.1);
      return true;
    }
    return false;
  }

  // Equip / Unequip Inventory Item (Spec 118)
  equipItem(itemId) {
    const item = this.inventory.find(i => i.id === itemId);
    if (!item) return false;

    if (item.cat === 'weapons') {
      this.inventory.filter(i => i.cat === 'weapons').forEach(w => w.equipped = false);
      item.equipped = true;
      this.activeWeapon = item.id;
      if (window.app && window.app.playerFighter) {
        window.app.playerFighter.weapon = COMBAT_DATA.WEAPONS[item.id];
      }
    } else if (item.cat === 'equipment' || item.cat === 'charms') {
      item.equipped = !item.equipped;
    }

    if (window.soundEngine) window.soundEngine.playSwordSlash();
    return true;
  }

  // Forge Weapon Upgrade (Spec 116)
  upgradeWeapon(weaponId) {
    const cost = 2500;
    if (this.gold >= cost && this.weaponMasteries[weaponId]) {
      this.gold -= cost;
      this.weaponMasteries[weaponId].level++;
      if (window.soundEngine) window.soundEngine.playTaiko(1.2);
      this.checkAchievement('forge_master');
      return true;
    }
    return false;
  }

  // Repair Weapon Durability (Spec 84)
  repairWeapon(fighter) {
    const cost = fighter.weapon.costRepair;
    if (this.gold >= cost) {
      this.gold -= cost;
      fighter.weaponDurability = fighter.weapon.durabilityMax;
      if (window.soundEngine) window.soundEngine.playSwordSlash();
      return true;
    }
    return false;
  }

  // Check and unlock achievements (Spec 97)
  checkAchievement(id) {
    const ach = this.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      this.gold += ach.rewardGold || 500;
      if (window.soundEngine) window.soundEngine.playTempleGong();
      return ach;
    }
    return null;
  }

  // 40 Achievements Catalog across 8 Categories (Spec 97)
  createAchievementsCatalog() {
    return [
      // 1. Combat (5)
      { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first opponent in combat.', cat: 'Combat', unlocked: true, rewardGold: 200 },
      { id: 'perfect_parry', name: 'Ghost Parry', desc: 'Perform a Perfect Block timing window.', cat: 'Combat', unlocked: true, rewardGold: 300 },
      { id: 'perfect_dodge', name: 'Wind Dancer', desc: 'Perform a Perfect Dodge slowing time.', cat: 'Combat', unlocked: false, rewardGold: 300 },
      { id: 'combo_master', name: 'Combo Master', desc: 'Reach a 15-hit combo chain.', cat: 'Combat', unlocked: false, rewardGold: 500 },
      { id: 'guard_breaker', name: 'Iron Smasher', desc: 'Inflict Guard Break on an opponent.', cat: 'Combat', unlocked: true, rewardGold: 400 },

      // 2. Weapons (5)
      { id: 'katana_devotee', name: 'Path of the Blade', desc: 'Reach Mastery Level 5 with Katana.', cat: 'Weapons', unlocked: true, rewardGold: 600 },
      { id: 'viper_fangs', name: 'Venomous Speed', desc: 'Win 3 duels using Twin Daggers.', cat: 'Weapons', unlocked: false, rewardGold: 500 },
      { id: 'heavy_cleaver', name: 'Giant Cleaver', desc: 'Land a 200+ damage strike with Odachi.', cat: 'Weapons', unlocked: false, rewardGold: 700 },
      { id: 'staff_master', name: 'Monk Wisdom', desc: 'Defeat an enemy using only the Bo Staff.', cat: 'Weapons', unlocked: false, rewardGold: 500 },
      { id: 'kusarigama_pull', name: 'Chains of Destiny', desc: 'Pull an enemy using Kusarigama.', cat: 'Weapons', unlocked: false, rewardGold: 600 },

      // 3. Story & Progression (5)
      { id: 'act_1_clear', name: 'Fall of Tsukishima', desc: 'Complete Act I Campaign.', cat: 'Story', unlocked: true, rewardGold: 1000 },
      { id: 'act_2_active', name: 'Shadows Rising', desc: 'Reach Act II Chapter 4.', cat: 'Story', unlocked: true, rewardGold: 800 },
      { id: 'act_2_climax', name: 'Gates of the Iron Pagoda', desc: 'Breach the Iron Pagoda fortress.', cat: 'Story', unlocked: false, rewardGold: 1200 },
      { id: 'dragon_gorge', name: 'Dragon Chasm', desc: 'Dispel talisman ward at Dragon Gorge.', cat: 'Story', unlocked: false, rewardGold: 1500 },
      { id: 'story_complete', name: 'Savior of the Realm', desc: 'Complete the entire story campaign.', cat: 'Story', unlocked: false, rewardGold: 5000 },

      // 4. Bosses (5)
      { id: 'boss_ren', name: 'Wind Cutter Falls', desc: 'Vanquish Ren the Bamboo Duellist.', cat: 'Bosses', unlocked: true, rewardGold: 500 },
      { id: 'boss_kurokawa', name: 'Crimson Moon Eclipsed', desc: 'Purge Master Kurokawa.', cat: 'Bosses', unlocked: true, rewardGold: 750 },
      { id: 'boss_osen', name: 'Venom Silenced', desc: 'Shatter Lady Osen of Weeping Mist.', cat: 'Bosses', unlocked: true, rewardGold: 1000 },
      { id: 'boss_yoshiteru', name: 'Iron Executioner', desc: 'Defeat Lord Yoshiteru at Iron Pagoda.', cat: 'Bosses', unlocked: false, rewardGold: 1500 },
      { id: 'boss_shogun', name: 'Eclipse Sovereign', desc: 'Destroy Demon Shogun Kage-No-Hao.', cat: 'Bosses', unlocked: false, rewardGold: 5000 },

      // 5. Mastery & Attributes (5)
      { id: 'forge_master', name: 'Master of the Anvil', desc: 'Upgrade any weapon 3 times at the Forge.', cat: 'Mastery', unlocked: true, rewardGold: 800 },
      { id: 'style_master', name: 'Fivefold Path', desc: 'Unlock all 5 Core Fighting Styles.', cat: 'Mastery', unlocked: true, rewardGold: 1000 },
      { id: 'attribute_titan', name: 'Body of Iron', desc: 'Raise Endurance to Level 15.', cat: 'Mastery', unlocked: false, rewardGold: 600 },
      { id: 'ultimate_adept', name: 'Celestial Wrath', desc: 'Perform 10 Ultimate Attacks.', cat: 'Mastery', unlocked: false, rewardGold: 800 },
      { id: 'rage_unleashed', name: 'Asura Incarnate', desc: 'Activate Rage Mode 5 times.', cat: 'Mastery', unlocked: false, rewardGold: 700 },

      // 6. Challenges & Modes (5)
      { id: 'survival_wave_5', name: 'Survivor', desc: 'Reach Wave 5 in Survival Mode.', cat: 'Challenges', unlocked: false, rewardGold: 1000 },
      { id: 'survival_wave_10', name: 'Undying Phantom', desc: 'Reach Wave 10 in Survival Mode.', cat: 'Challenges', unlocked: false, rewardGold: 2500 },
      { id: 'boss_rush_init', name: 'Gauntlet Challenger', desc: 'Complete 3 bosses in Boss Rush.', cat: 'Challenges', unlocked: false, rewardGold: 2000 },
      { id: 'arcade_champion', name: 'Arcade Master', desc: 'Complete Arcade Mode on Master difficulty.', cat: 'Challenges', unlocked: false, rewardGold: 3000 },
      { id: 'speed_demon', name: 'Lightning Flash', desc: 'Win a duel in under 30 seconds.', cat: 'Challenges', unlocked: false, rewardGold: 1200 },

      // 7. Exploration & Dojo (5)
      { id: 'dojo_visitor', name: 'The Way of Peace', desc: 'Enter the Forgotten Dojo Hub.', cat: 'Exploration', unlocked: true, rewardGold: 300 },
      { id: 'merchant_patron', name: 'Generous Buyer', desc: 'Purchase 3 items from Merchant Kenji.', cat: 'Exploration', unlocked: false, rewardGold: 600 },
      { id: 'codex_scholar', name: 'Lorekeeper', desc: 'Unlock 10 entries in the Codex.', cat: 'Exploration', unlocked: true, rewardGold: 800 },
      { id: 'daily_conqueror', name: 'Daily Discipline', desc: 'Complete all 4 Daily Challenges in a day.', cat: 'Exploration', unlocked: false, rewardGold: 1500 },
      { id: 'parchment_voyager', name: 'Cartographer', desc: 'Inspect every stage on the World Map.', cat: 'Exploration', unlocked: true, rewardGold: 500 },

      // 8. Secrets (5) (Spec 98)
      { id: 'secret_shrine', name: 'Eclipse Shrine', desc: 'Discover the hidden Eclipse Shrine arena.', cat: 'Secrets', unlocked: false, rewardGold: 2000 },
      { id: 'secret_muramasa', name: 'Forbidden Steel', desc: 'Wield the Mythic Muramasa Katana.', cat: 'Secrets', unlocked: false, rewardGold: 3500 },
      { id: 'secret_void_style', name: 'Void Sovereign', desc: 'Unlock the hidden 6th Void Style.', cat: 'Secrets', unlocked: false, rewardGold: 4000 },
      { id: 'secret_clean_sweep', name: 'Flawless Victory', desc: 'Win a duel taking zero damage.', cat: 'Secrets', unlocked: false, rewardGold: 2500 },
      { id: 'secret_executioner', name: 'Death Dealer', desc: 'Execute 5 bosses with cinematic finishers.', cat: 'Secrets', unlocked: false, rewardGold: 3000 }
    ];
  }

  // Lore Codex & Original Factions (Spec 120, 121)
  createCodexData() {
    return {
      factions: [
        {
          id: 'silent_veil',
          name: 'The Silent Veil',
          creed: 'In silence we strike; in shadows we remain.',
          leader: 'Grandmaster Jin Kageyoshi',
          style: 'Shadow & Wind Stances',
          lore: 'An ancient brotherhood of shinobi and master swordsmen who swore allegiance to protect the spiritual balance of Tsukishima from demonic corruption.'
        },
        {
          id: 'iron_brotherhood',
          name: 'The Iron Brotherhood',
          creed: 'Unyielding as dark steel; merciless as the anvil.',
          leader: 'Lord Yoshiteru the Executioner',
          style: 'Iron & Tiger Stances',
          lore: 'Former imperial guards who fortified themselves within black iron sanctuaries, wielding massive polearms and unyielding tower defenses.'
        },
        {
          id: 'eclipse_cult',
          name: 'The Eclipse Cult',
          creed: 'Blood for the Void; immortality under the black sun.',
          leader: 'Demon Shogun Kage-No-Hao',
          style: 'Forbidden Void Sorcery & Blood Blades',
          lore: 'A cabal of corrupted samurai and fallen onmyoji who summoned the perpetual eclipse to usurp divine celestial dominion over the mortal realm.'
        },
        {
          id: 'order_of_dawn',
          name: 'Order of the Radiant Dawn',
          creed: 'From ash arises the inextinguishable flame.',
          leader: 'High Priestess Tomoe',
          style: 'Dragon Solar Stance',
          lore: 'Temple monks dedicated to the ancient sun kami, preserving ancient scrolls of calligraphy and cleansing demonic curses.'
        }
      ]
    };
  }
}

window.RPGSystem = RPGSystem;
