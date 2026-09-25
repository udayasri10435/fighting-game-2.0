/**
 * Shadow Samurai - Game Modes Engine
 * Implements Story Campaign, Survival Mode, Boss Rush, Arcade Mode,
 * New Game Plus, and Advanced Training Mode.
 * Complies with specifications 99, 100, 101, 102, 103, 104, 105.
 */

class GameModesManager {
  constructor(combatEngine, rpgSystem) {
    this.combatEngine = combatEngine;
    this.rpgSystem = rpgSystem;
    this.currentMode = 'story'; // 'story', 'survival', 'boss_rush', 'arcade', 'training'
    
    // Survival Mode State (Spec 101)
    this.survival = {
      wave: 1,
      enemiesDefeated: 0,
      score: 0,
      highScore: 18450,
      highestWave: 8,
      timer: 0,
      active: false
    };

    // Boss Rush State (Spec 102)
    this.bossRush = {
      bossIndex: 0,
      bossRoster: [
        { name: 'Ren the Wind-Cutter', title: 'Exiled Ronin Duellist', hp: 950, weapon: 'katana', style: 'wind', personality: 'rusher' },
        { name: 'Master Kurokawa', title: 'Leader of Crimson Clan', hp: 1250, weapon: 'katana', style: 'tiger', personality: 'aggressive' },
        { name: 'Lady Osen the Viper', title: 'Shadow Mistress', hp: 1450, weapon: 'kusarigama', style: 'shadow', personality: 'tactical' },
        { name: 'Lord Yoshiteru', title: 'Iron Executioner', hp: 1800, weapon: 'heavy_blade', style: 'iron', personality: 'counter' },
        { name: 'Demon Shogun Kage-No-Hao', title: 'Sovereign of the Void', hp: 2800, weapon: 'heavy_blade', style: 'dragon', personality: 'berserker', isBoss: true }
      ],
      totalTime: 0,
      damageReceived: 0,
      score: 0,
      active: false
    };

    // Arcade Mode State (Spec 103)
    this.arcade = {
      stage: 1,
      maxStages: 5,
      score: 0,
      active: false
    };

    // Advanced Training Mode Options (Spec 104, 105)
    this.training = {
      dummyBehavior: 'idle', // 'idle', 'block', 'auto_block', 'counter', 'attack', 'random'
      infiniteHp: true,
      infiniteStamina: true,
      infiniteEnergy: true,
      showHitboxes: false,
      showFrameData: false
    };

    // New Game Plus (Spec 99)
    this.isNewGamePlus = false;
    this.ngpMultiplier = 1.0;
  }

  // Story Campaign Battle (Spec 94)
  startStoryBattle(stageData) {
    this.currentMode = 'story';
    const playerFighter = this.createPlayerFighter();

    // Check challenge modifiers
    let hpMult = this.isNewGamePlus ? 1.6 : 1.0;
    if (this.rpgSystem.challengeModifiers.doubleDamage) hpMult *= 1.2;

    const enemyData = EncounterDirector.createEncounter({
      bossName: stageData.boss,
      bossTitle: stageData.bossTitle,
      bossHp: Math.round(stageData.recommendedCP * 0.35 * hpMult),
      personality: stageData.status === 'boss_locked' ? 'berserker' : (stageData.id === 4 ? 'counter' : 'tactical'),
      isBoss: stageData.status === 'boss_locked' || stageData.id === 4 || stageData.id === 6,
      uniqueMechanic: stageData.id === 6 ? 'eclipse_meteor' : (stageData.id === 4 ? 'earthquake' : 'teleport'),
      weapon: stageData.id === 4 ? 'heavy_blade' : (stageData.id === 3 ? 'kusarigama' : (stageData.id === 6 ? 'muramasa_eclipse' : 'katana'))
    });

    this.combatEngine.setFighters(playerFighter, enemyData.enemyFighter);
    return { player: playerFighter, enemy: enemyData.enemyFighter, ai: enemyData.ai };
  }

  // Survival Mode (Spec 101)
  startSurvivalWave() {
    this.currentMode = 'survival';
    this.survival.active = true;
    const playerFighter = this.createPlayerFighter();

    const isBossWave = (this.survival.wave % 10 === 0);
    const isEliteWave = (this.survival.wave % 5 === 0 && !isBossWave);

    const enemyHp = 700 + this.survival.wave * 140 + (isBossWave ? 1100 : (isEliteWave ? 450 : 0));
    const enemyName = isBossWave ? `Abyssal Commander (Wave ${this.survival.wave})` : 
                     (isEliteWave ? `Elite Shadow Assassin (Wave ${this.survival.wave})` : `Shadow Minion Lv.${this.survival.wave}`);

    const enemyData = EncounterDirector.createEncounter({
      enemyName,
      bossTitle: isBossWave ? 'Wave Sovereign' : (isEliteWave ? 'Elite Vanguard' : 'Shadow Legion'),
      bossHp: enemyHp,
      personality: isBossWave ? 'berserker' : (isEliteWave ? 'counter' : 'aggressive'),
      isBoss: isBossWave,
      uniqueMechanic: isBossWave ? 'eclipse_meteor' : 'teleport',
      strength: 14 + Math.floor(this.survival.wave * 1.5)
    });

    this.combatEngine.setFighters(playerFighter, enemyData.enemyFighter);
    return { player: playerFighter, enemy: enemyData.enemyFighter, ai: enemyData.ai };
  }

  advanceSurvival() {
    this.survival.wave++;
    this.survival.enemiesDefeated++;
    this.survival.score += 1500 * this.survival.wave;
    if (this.survival.score > this.survival.highScore) {
      this.survival.highScore = this.survival.score;
    }
    if (this.survival.wave > this.survival.highestWave) {
      this.survival.highestWave = this.survival.wave;
    }
    return this.startSurvivalWave();
  }

  // Boss Rush Mode (Spec 102)
  startBossRush() {
    this.currentMode = 'boss_rush';
    this.bossRush.active = true;
    this.bossRush.bossIndex = 0;
    this.bossRush.totalTime = 0;
    this.bossRush.damageReceived = 0;
    this.bossRush.score = 0;
    return this.startNextBossRush();
  }

  startNextBossRush() {
    const bossData = this.bossRush.bossRoster[this.bossRush.bossIndex];
    if (!bossData) return null; // Complete!

    const playerFighter = this.createPlayerFighter();
    const enemyData = EncounterDirector.createEncounter({
      bossName: bossData.name,
      bossTitle: bossData.title,
      bossHp: bossData.hp,
      weapon: bossData.weapon,
      style: bossData.style,
      personality: bossData.personality,
      isBoss: bossData.isBoss || true,
      uniqueMechanic: bossData.isBoss ? 'eclipse_meteor' : 'teleport'
    });

    this.combatEngine.setFighters(playerFighter, enemyData.enemyFighter);
    return { player: playerFighter, enemy: enemyData.enemyFighter, ai: enemyData.ai };
  }

  // Arcade Mode (Spec 103)
  startArcade() {
    this.currentMode = 'arcade';
    this.arcade.active = true;
    this.arcade.stage = 1;
    this.arcade.score = 0;
    return this.startArcadeStage();
  }

  startArcadeStage() {
    const playerFighter = this.createPlayerFighter();
    const isFinalStage = (this.arcade.stage === this.arcade.maxStages);
    const weapons = ['katana', 'daggers', 'staff', 'heavy_blade', 'kusarigama'];
    const chosenWeapon = isFinalStage ? 'heavy_blade' : weapons[this.arcade.stage - 1];

    const enemyData = EncounterDirector.createEncounter({
      bossName: isFinalStage ? 'Demon Sovereign Azuma' : `Arcade Contender Stage ${this.arcade.stage}`,
      bossTitle: isFinalStage ? 'Grand Champion of Tsukishima' : 'Tournament Challenger',
      bossHp: 800 + this.arcade.stage * 250,
      weapon: chosenWeapon,
      personality: isFinalStage ? 'berserker' : (this.arcade.stage >= 3 ? 'counter' : 'tactical'),
      isBoss: isFinalStage
    });

    this.combatEngine.setFighters(playerFighter, enemyData.enemyFighter);
    return { player: playerFighter, enemy: enemyData.enemyFighter, ai: enemyData.ai };
  }

  // Advanced Training Mode (Spec 104, 105)
  startTrainingMode() {
    this.currentMode = 'training';
    const playerFighter = this.createPlayerFighter();
    const enemyFighter = new Fighter({
      isPlayer: false,
      name: 'Training Master Dummy',
      title: 'Dojo Sparring Automaton',
      x: 750,
      y: 420,
      facing: -1,
      maxHp: 9999
    });

    const ai = new AIDirector(enemyFighter, playerFighter, 'defensive');
    this.combatEngine.setFighters(playerFighter, enemyFighter);
    return { player: playerFighter, enemy: enemyFighter, ai };
  }

  // Update training rules per frame
  updateTrainingRules(player, enemy) {
    if (this.currentMode !== 'training') return;

    if (this.training.infiniteHp) {
      player.hp = player.maxHp;
      enemy.hp = enemy.maxHp;
    }
    if (this.training.infiniteStamina) {
      player.stamina = player.maxStamina;
      player.isExhausted = false;
    }
    if (this.training.infiniteEnergy) {
      player.energy = player.maxEnergy;
    }

    // Dummy Behavior Switch (Spec 104)
    switch (this.training.dummyBehavior) {
      case 'idle':
        enemy.block(false);
        break;
      case 'block':
        enemy.block(true);
        break;
      case 'auto_block':
        if (player.state === 'ATTACK') enemy.block(true);
        else enemy.block(false);
        break;
      case 'counter':
        if (player.state === 'ATTACK') {
          enemy.block(true);
          if (enemy.counterWindow > 0) enemy.executeAttack('counter_strike');
        } else {
          enemy.block(false);
        }
        break;
      case 'attack':
        if (Math.random() < 0.03) enemy.executeAttack('light_1');
        break;
      case 'random':
        if (Math.random() < 0.02) {
          const acts = ['light_1', 'kick_front', 'dodge'];
          const chosen = acts[Math.floor(Math.random() * acts.length)];
          if (chosen === 'dodge') enemy.dodge();
          else enemy.executeAttack(chosen);
        }
        break;
    }
  }

  createPlayerFighter() {
    return new Fighter({
      isPlayer: true,
      name: 'Jin Kageyoshi',
      title: 'Shadow Ronin',
      x: 380,
      y: 420,
      facing: 1,
      weapon: this.rpgSystem.activeWeapon,
      style: this.rpgSystem.activeStyle,
      strength: this.rpgSystem.attributes.strength,
      defense: this.rpgSystem.attributes.defense,
      agility: this.rpgSystem.attributes.agility,
      endurance: this.rpgSystem.attributes.endurance,
      energyAttr: this.rpgSystem.attributes.energy
    });
  }

  // New Game Plus (Spec 99)
  activateNewGamePlus() {
    this.isNewGamePlus = true;
    this.ngpMultiplier = 1.6;
    this.rpgSystem.gold += 15000;
    this.rpgSystem.shadowSouls += 1000;
    this.rpgSystem.vermilionSeals += 5;

    // Unlock Secret Weapon & Style on NG+ (Spec 98)
    if (!this.rpgSystem.unlockedWeapons.includes('muramasa_eclipse')) {
      this.rpgSystem.unlockedWeapons.push('muramasa_eclipse');
      this.rpgSystem.inventory.push({
        id: 'muramasa_eclipse',
        cat: 'weapons',
        type: 'Mythic Katana',
        name: 'Mythic Muramasa Katana',
        level: 1,
        desc: 'Ancient cursed blade cloaked in black void fire.',
        equipped: false,
        icon: '🔥'
      });
    }
    if (!this.rpgSystem.unlockedStyles.includes('void')) {
      this.rpgSystem.unlockedStyles.push('void');
    }

    this.rpgSystem.checkAchievement('story_complete');
    this.rpgSystem.checkAchievement('secret_void_style');
    if (window.soundEngine) window.soundEngine.playDuelStart();
  }
}

window.GameModesManager = GameModesManager;
