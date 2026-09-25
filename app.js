/**
 * Shadow Samurai - Master Application Controller
 * Coordinates Views (Hub, Map, Arena, Modes, Modals), Real-Time 60 FPS Combat Loop,
 * Directional Input Management, Dynamic HUD, Audio Reactive Sequencer,
 * Photo Mode, 3-Slot Save Repository, and RPG Systems Integration.
 */

class AppController {
  constructor() {
    this.rpg = new RPGSystem();
    this.saveRepo = new SaveRepository();
    this.arena = new EnvironmentalArena('combat-canvas');
    this.combatEngine = new CombatEngine(this.arena);
    this.gameModes = new GameModesManager(this.combatEngine, this.rpg);
    
    // Active Combat State
    this.isInCombat = false;
    this.currentCombatMode = 'story'; // 'story', 'survival', 'boss_rush', 'arcade', 'training'
    this.currentStage = null;
    this.playerFighter = null;
    this.enemyFighter = null;
    this.aiDirector = null;
    this.battleTimerSeconds = 0;
    this.activeInvCategory = 'all';
    
    // Input State
    this.keysHeld = {};
    
    // Advanced Expansion State (Specs 144-265)
    this.selectedCharacter = 'jin';
    this.activePreset = 'balanced';
    this.consumables = { gourd: 3, elixir: 2, tonic: 2 };
    this.isPaused = false;
    this.frameDebuggerActive = false;
    this._prevGpButtons = [];
    
    // Master Release Systems Integration (Specs 266-387)
    this.worldState = typeof WorldStateManager !== 'undefined' ? new WorldStateManager() : null;
    this.trainerSystem = typeof MasterTrainerSystem !== 'undefined' ? new MasterTrainerSystem() : null;
    this.hintSystem = typeof ContextualHintSystem !== 'undefined' ? new ContextualHintSystem() : null;
    this.battleMedals = typeof BattleMedalsManager !== 'undefined' ? new BattleMedalsManager() : null;
    this.challengeGen = typeof ChallengeGenerator !== 'undefined' ? new ChallengeGenerator() : null;
    this.gauntlet = typeof GauntletRogueliteManager !== 'undefined' ? new GauntletRogueliteManager() : null;
    this.tournament = typeof TournamentMode !== 'undefined' ? new TournamentMode() : null;
    this.qaDashboard = typeof BalanceDashboard !== 'undefined' ? new BalanceDashboard(this.combatEngine) : null;
    this.smokeTester = typeof SmokeTestRunner !== 'undefined' ? new SmokeTestRunner() : null;
    this.activeMutator = null;
    
    this.init();
  }

  init() {
    // 1. Initialize Audio and Particles
    document.addEventListener('click', () => {
      if (window.soundEngine) window.soundEngine.ensureContext();
    }, { once: true });

    if (window.ParticleEngine) {
      this.particles = new window.ParticleEngine('particles-canvas');
    }

    // 2. Wire Combat Engine Callbacks
    this.setupCombatCallbacks();

    // 3. Render World Map Route and Nodes
    this.renderWorldMap();

    // 4. Render Hub Elements & Modifiers
    this.renderHubAttributes();
    this.renderModesModifiers();

    // 5. Bind Global Navigation & Input Events
    this.bindEvents();
    this.updateUniversalHud();

    // 6. Hook Global EventBus (Spec 182) & Auto-Pause (Spec 239)
    if (window.eventBus) {
      window.eventBus.on('OnLocaleChanged', () => this.updateUniversalHud());
      window.eventBus.on('OnComboBreak', () => {
        if (window.notifications) window.notifications.show('COMBO BROKEN', 'Shockwave repelled assailant!', '⚡', 'info', 1600);
      });
      window.eventBus.on('OnPoiseBreak', (d) => {
        if (window.notifications) window.notifications.show('POISE SHATTERED', `${d.fighter.name} staggered!`, '💥', 'warning', 1800);
      });
    }

    window.addEventListener('blur', () => {
      if (this.isInCombat && !this.isPaused) {
        this.togglePauseCombat(true);
      }
    });

    // Start in Story Map View
    this.switchView('map');
  }

  // Setup callbacks from Combat Engine
  setupCombatCallbacks() {
    // Combo Counter Hook
    this.combatEngine.comboEngine.onComboHit = (data) => {
      const container = document.getElementById('combo-feedback-container');
      if (container && data.hits >= 2) {
        container.style.display = 'flex';
        document.getElementById('combo-hit-num').textContent = data.hits;
        document.getElementById('combo-tier-title').textContent = data.tier.title;
        document.getElementById('combo-tier-title').style.color = data.tier.color;
        document.getElementById('combo-dmg-total').textContent = `${data.damage} DMG`;
      }
    };

    this.combatEngine.comboEngine.onComboComplete = () => {
      const container = document.getElementById('combo-feedback-container');
      if (container) container.style.display = 'none';
    };

    // Execution Opportunity Hook (Spec 79)
    this.combatEngine.onExecutionPrompt = (available) => {
      const banner = document.getElementById('execution-prompt-banner');
      if (banner) banner.style.display = available ? 'flex' : 'none';
    };

    // Victory Hook (Spec 123, 134)
    this.combatEngine.onVictory = (result) => {
      this.isInCombat = false;
      if (window.soundEngine) {
        window.soundEngine.setMusicPhase('ambient');
        window.soundEngine.playTempleGong();
      }

      // Check mode progression
      if (this.currentCombatMode === 'survival') {
        this.gameModes.survival.wave++;
        this.gameModes.survival.enemiesDefeated++;
        this.gameModes.survival.score += 2000;
        this.rpg.checkAchievement('survival_wave_5');
      } else if (this.currentCombatMode === 'boss_rush') {
        this.gameModes.bossRush.bossIndex++;
        if (this.gameModes.bossRush.bossIndex >= this.gameModes.bossRush.bossRoster.length) {
          this.rpg.checkAchievement('boss_rush_init');
        }
      } else if (this.currentCombatMode === 'gauntlet' && this.gauntlet) {
        const gauntletRes = this.gauntlet.advanceFloor();
        if (gauntletRes.runComplete) {
          if (window.notifications) window.notifications.show('GAUNTLET CONQUERED', `Victory through all 5 floors! Score: ${gauntletRes.summary.score}`, '🏆', 'success', 3500);
        } else {
          if (window.notifications) window.notifications.show('FLOOR ADVANCED', `Victory! Advancing to Floor ${this.gauntlet.activeRun ? this.gauntlet.activeRun.currentFloor : 2}/5.`, '✨', 'info', 3000);
        }
      } else if (this.currentCombatMode === 'tournament' && this.tournament) {
        const tourneyRes = this.tournament.recordMatchWin();
        if (tourneyRes.tournamentWon) {
          if (window.notifications) window.notifications.show('TOURNAMENT GRAND CHAMPION', 'You have conquered all tournament brackets!', '👑', 'success', 4000);
        } else {
          if (window.notifications) window.notifications.show('ROUND ADVANCED', `Victory! Next round: ${tourneyRes.nextMatch ? tourneyRes.nextMatch.round : 'Next Round'}`, '⚔️', 'info', 2500);
        }
      }

      this.showVictoryModal(result);
    };

    // Defeat Hook
    this.combatEngine.onDefeat = (result) => {
      this.isInCombat = false;
      if (window.soundEngine) {
        window.soundEngine.setMusicPhase('ambient');
        window.soundEngine.playTaiko(0.8);
      }

      if (this.currentCombatMode === 'gauntlet' && this.gauntlet) {
        const summary = this.gauntlet.endRun(false);
        if (window.notifications) window.notifications.show('GAUNTLET DEFEAT', `Run concluded at Floor ${summary.floorsCompleted}. Final Score: ${summary.score}`, '💀', 'warning', 3000);
      } else if (this.currentCombatMode === 'tournament' && this.tournament) {
        this.tournament.recordMatchResult(false);
        if (window.notifications) window.notifications.show('TOURNAMENT ELIMINATION', 'Defeated in championship bracket.', '⚠️', 'warning', 3000);
      }

      this.showDefeatModal(result);
    };
  }

  // =========================================================================
  // VIEW SWITCHING (Hub, Map, Arena, Modes)
  // =========================================================================
  switchView(viewId) {
    const views = ['hub', 'map', 'arena', 'modes'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = (v === viewId) ? 'block' : 'none';
    });

    // Update Top Navigation Tab Highlight
    const tabs = document.querySelectorAll('.act-nav-tab');
    tabs.forEach(tab => tab.classList.remove('active-act'));
    const activeTab = document.getElementById(`nav-btn-${viewId}`);
    if (activeTab) activeTab.classList.add('active-act');

    // Music update
    if (window.soundEngine) {
      if (viewId === 'arena') {
        window.soundEngine.setMusicPhase('combat');
      } else {
        window.soundEngine.setMusicPhase('ambient');
      }
    }

    if (viewId === 'arena') {
      this.arena.resize();
    }
  }

  // =========================================================================
  // BATTLE START & REAL-TIME COMBAT LOOP (60 FPS)
  // =========================================================================
  startBattle(mode = 'story', payload = null) {
    this.currentCombatMode = mode;
    this.battleTimerSeconds = 0;
    this.isInCombat = true;
    this.isPaused = false;

    // Reset consumables & update HUD
    this.consumables = { gourd: 3, elixir: 2, tonic: 2 };
    this.updateConsumablesHud();

    // Reset arena phase lighting
    this.arena.arenaPhase = 1;

    // Create Fighters based on Mode
    if (mode === 'story') {
      const stage = payload || STAGES_DATA[3]; // Default stage 4
      this.currentStage = stage;
      const setup = this.gameModes.startStoryBattle(stage);
      this.playerFighter = setup.player;
      this.enemyFighter = setup.enemy;
      this.aiDirector = setup.ai;

      // Apply Playable Character Attributes (Spec 208-211)
      if (this.selectedCharacter === 'tomoe' && typeof PLAYABLE_CHARACTERS !== 'undefined') {
        this.playerFighter.name = PLAYABLE_CHARACTERS.tomoe.name;
        this.playerFighter.weapon = COMBAT_DATA.WEAPONS.naginata;
        this.playerFighter.style = COMBAT_DATA.STYLES.wind;
      } else if (this.selectedCharacter === 'raizo' && typeof PLAYABLE_CHARACTERS !== 'undefined') {
        this.playerFighter.name = PLAYABLE_CHARACTERS.raizo.name;
        this.playerFighter.weapon = COMBAT_DATA.WEAPONS.kanabo;
        this.playerFighter.style = COMBAT_DATA.STYLES.iron;
      }

      // Apply Build Preset (Spec 189)
      if (typeof DEFAULT_BUILD_PRESETS !== 'undefined' && DEFAULT_BUILD_PRESETS[this.activePreset]) {
        const pr = DEFAULT_BUILD_PRESETS[this.activePreset];
        if (COMBAT_DATA.WEAPONS[pr.weapon]) this.playerFighter.weapon = COMBAT_DATA.WEAPONS[pr.weapon];
        if (COMBAT_DATA.STYLES[pr.style]) this.playerFighter.style = COMBAT_DATA.STYLES[pr.style];
      }

      // Listen for boss phase transitions (Spec 91)
      this.aiDirector.onBossPhaseChange = (phase) => {
        this.arena.arenaPhase = phase;
        document.getElementById('arena-enemy-phase').textContent = `PHASE ${phase} • ${phase === 3 ? 'ABYSSAL RAGE' : 'EMPOWERED'}`;
      };

      document.getElementById('arena-player-name').textContent = this.playerFighter.name.toUpperCase();
      document.getElementById('arena-enemy-name').textContent = stage.boss.toUpperCase();
      document.getElementById('arena-enemy-style').textContent = stage.bossTitle.toUpperCase();
      document.getElementById('arena-enemy-phase').textContent = `ACT II • ${stage.title.toUpperCase()}`;
    } else if (mode === 'training') {
      const setup = this.gameModes.startTrainingMode();
      this.playerFighter = setup.player;
      this.enemyFighter = setup.enemy;
      this.aiDirector = setup.ai;

      document.getElementById('arena-player-name').textContent = 'JIN KAGEYOSHI';
      document.getElementById('arena-enemy-name').textContent = 'SPARRING AUTOMATON';
      document.getElementById('arena-enemy-style').textContent = 'DEFENSIVE STANCE';
      document.getElementById('arena-enemy-phase').textContent = 'TRAINING DOJO';
      document.getElementById('training-toolbar').style.display = 'flex';
    } else if (mode === 'survival') {
      const setup = this.gameModes.startSurvivalWave();
      this.playerFighter = setup.player;
      this.enemyFighter = setup.enemy;
      this.aiDirector = setup.ai;

      document.getElementById('arena-enemy-name').textContent = this.enemyFighter.name.toUpperCase();
      document.getElementById('arena-enemy-phase').textContent = `SURVIVAL WAVE ${this.gameModes.survival.wave}`;
    } else if (mode === 'boss_rush') {
      const setup = this.gameModes.startBossRush();
      this.playerFighter = setup.player;
      this.enemyFighter = setup.enemy;
      this.aiDirector = setup.ai;

      document.getElementById('arena-enemy-name').textContent = this.enemyFighter.name.toUpperCase();
      document.getElementById('arena-enemy-phase').textContent = `BOSS RUSH: DUEL 1 / 5`;
    } else if (mode === 'arcade') {
      const setup = this.gameModes.startArcade();
      this.playerFighter = setup.player;
      this.enemyFighter = setup.enemy;
      this.aiDirector = setup.ai;

      document.getElementById('arena-enemy-name').textContent = this.enemyFighter.name.toUpperCase();
      document.getElementById('arena-enemy-phase').textContent = `ARCADE STAGE 1 / 5`;
    }

    // Hide execution banner
    document.getElementById('execution-prompt-banner').style.display = 'none';
    if (mode !== 'training') {
      document.getElementById('training-toolbar').style.display = 'none';
    }

    // Switch view to Arena
    this.switchView('arena');

    // Start 60 FPS Combat Animation Loop
    this.combatLoop();
  }

  combatLoop() {
    if (!this.isInCombat) return;

    // Check if in Photo Mode pause (Spec 107) or Game Pause (Spec 238)
    if (!this.arena.photoMode.active && !this.isPaused) {
      // 0. Poll Controller Gamepad (Spec 240, 241)
      this.pollGamepad();

      // 1. Process Player Input
      this.handlePlayerInputs();

      // 2. Update AI Decisions
      if (this.aiDirector) {
        this.aiDirector.update(this.combatEngine);
      }

      // 3. Update Training Rules if applicable
      if (this.currentCombatMode === 'training') {
        this.gameModes.updateTrainingRules(this.playerFighter, this.enemyFighter);
      }

      // 4. Update Combat Engine
      this.combatEngine.update();
    }

    // Update Frame Debugger Telemetry if active (Spec 149)
    if (this.frameDebuggerActive) {
      this.updateDebuggerTelemetry();
    }

    // 5. Render Arena, Fighters & Particles
    this.arena.render(this.playerFighter, this.enemyFighter, this.combatEngine);

    // 6. Update Real-Time Combat Battle HUD
    this.updateBattleHud();

    // 7. Request Next Frame
    requestAnimationFrame(() => this.combatLoop());
  }

  // Directional Input Resolver
  getCurrentDirection() {
    const p = this.playerFighter;
    if (!p) return 'neutral';

    const movingLeft = this.keysHeld['KeyA'] || this.keysHeld['ArrowLeft'];
    const movingRight = this.keysHeld['KeyD'] || this.keysHeld['ArrowRight'];
    const crouching = this.keysHeld['KeyS'] || this.keysHeld['ArrowDown'] || p.isCrouching;
    const jumping = this.keysHeld['KeyW'] || this.keysHeld['ArrowUp'] || !p.isGrounded;

    if (jumping) return 'up';
    if (crouching) return 'down';

    if (movingRight) {
      return p.facing === 1 ? 'forward' : 'back';
    }
    if (movingLeft) {
      return p.facing === -1 ? 'forward' : 'back';
    }

    return 'neutral';
  }

  // Handle Real-Time Keyboard Inputs
  handlePlayerInputs() {
    if (!this.playerFighter || this.playerFighter.state === 'DEAD') return;
    const p = this.playerFighter;

    // Movement: Left / Right
    if (this.keysHeld['KeyA'] || this.keysHeld['ArrowLeft']) {
      p.move(-1);
    } else if (this.keysHeld['KeyD'] || this.keysHeld['ArrowRight']) {
      p.move(1);
    } else if (p.state === 'WALK') {
      p.stopMoving();
    }

    // Jump / Aerial (Spec 82)
    if (this.keysHeld['KeyW'] || this.keysHeld['ArrowUp']) {
      p.jump();
    }

    // Crouch
    if (this.keysHeld['KeyS'] || this.keysHeld['ArrowDown']) {
      p.crouch();
    } else if (p.isCrouching) {
      p.standUp();
    }

    // Block / Guard (Spec 73)
    const isBlocking = !!this.keysHeld['ShiftLeft'] || !!this.keysHeld['ShiftRight'];
    p.block(isBlocking);
  }

  // Real-Time In-Combat Battle HUD Update
  updateBattleHud() {
    const p = this.playerFighter;
    const e = this.enemyFighter;
    if (!p || !e) return;

    // Player Vitals
    const playerHpPercent = Math.max(0, (p.hp / p.maxHp) * 100);
    const playerHpLagPercent = Math.max(0, (p.displayHp / p.maxHp) * 100);
    document.getElementById('player-hp-fill').style.width = `${playerHpPercent}%`;
    document.getElementById('player-hp-lag').style.width = `${playerHpLagPercent}%`;
    document.getElementById('player-hp-text').textContent = `${p.hp} / ${p.maxHp}`;

    const playerStaminaPercent = (p.stamina / p.maxStamina) * 100;
    document.getElementById('player-stamina-fill').style.width = `${playerStaminaPercent}%`;

    const playerGuardPercent = (p.guard / p.maxGuard) * 100;
    document.getElementById('player-guard-fill').style.width = `${playerGuardPercent}%`;

    // Energy Gauge (25%, 50%, 75%, 100%)
    document.getElementById('eng-pip-25').classList.toggle('pip-active', p.energy >= 25);
    document.getElementById('eng-pip-50').classList.toggle('pip-active', p.energy >= 50);
    document.getElementById('eng-pip-75').classList.toggle('pip-active', p.energy >= 75);
    document.getElementById('eng-pip-100').classList.toggle('pip-active', p.energy >= 100);

    // Rage Mode Button
    const rageBtn = document.getElementById('btn-activate-rage');
    if (rageBtn) {
      rageBtn.textContent = p.isRageMode ? 'RAGE ACTIVE!' : `RAGE (${Math.round(p.rage)}%)`;
      rageBtn.classList.toggle('rage-ready', p.rage >= p.maxRage);
    }

    // Enemy Vitals
    const enemyHpPercent = Math.max(0, (e.hp / e.maxHp) * 100);
    const enemyHpLagPercent = Math.max(0, (e.displayHp / e.maxHp) * 100);
    document.getElementById('enemy-hp-fill').style.width = `${enemyHpPercent}%`;
    document.getElementById('enemy-hp-lag').style.width = `${enemyHpLagPercent}%`;
    document.getElementById('enemy-hp-text').textContent = `${e.hp} / ${e.maxHp}`;

    const enemyStaminaPercent = (e.stamina / e.maxStamina) * 100;
    document.getElementById('enemy-stamina-fill').style.width = `${enemyStaminaPercent}%`;

    const enemyGuardPercent = (e.guard / e.maxGuard) * 100;
    document.getElementById('enemy-guard-fill').style.width = `${enemyGuardPercent}%`;

    // Battle Timer
    const secs = Math.floor(this.combatEngine.telemetry.fightDurationSeconds);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    document.getElementById('arena-battle-timer').textContent = `${m}:${s}`;

    // Combat Director HUD: Style Rank & Flow Momentum (Specs 281-286)
    if (this.combatEngine && this.combatEngine.director) {
      const dir = this.combatEngine.director;
      const rankLetter = document.getElementById('hud-style-letter');
      const rankTitle = document.getElementById('hud-style-title');
      if (rankLetter && dir.styleSystem) {
        rankLetter.textContent = dir.styleSystem.rank;
        if (rankTitle) rankTitle.textContent = dir.styleSystem.getTitle();
      }
      const flowFill = document.getElementById('hud-flow-fill');
      if (flowFill && dir.flowSystem) {
        flowFill.style.width = `${Math.min(100, Math.max(0, dir.flowSystem.flow))}%`;
      }
    }

    // Contextual Hint System (Specs 323, 326)
    if (this.hintSystem) {
      const hint = this.hintSystem.checkCombatSituation(p, e);
      const hintBanner = document.getElementById('contextual-hint-banner');
      if (hintBanner) {
        if (hint) {
          hintBanner.textContent = `💡 ${hint.text}`;
          hintBanner.style.display = 'block';
        } else {
          hintBanner.style.display = 'none';
        }
      }
    }
  }

  // =========================================================================
  // MODALS & SCREENS (Victory, Defeat, Forge, Merchant, Inventory, Combos, Saves, Dialogues)
  // =========================================================================
  showVictoryModal(result) {
    const modal = document.getElementById('results-modal');
    if (!modal) return;

    document.getElementById('results-title-stamp').textContent = 'VICTORY';
    document.getElementById('results-title-stamp').style.color = '#51cf66';
    document.getElementById('results-stars').textContent = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);

    document.getElementById('res-dmg-dealt').textContent = result.telemetry.damageDealt.toLocaleString();
    document.getElementById('res-max-combo').textContent = `${result.telemetry.highestCombo} HITS`;
    document.getElementById('res-parries').textContent = result.telemetry.perfectBlocks;
    
    const secs = Math.floor(result.telemetry.fightDurationSeconds);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    document.getElementById('res-time').textContent = `${m}:${s}`;

    // Battle Medals Evaluation (Specs 294-298)
    if (this.battleMedals && this.playerFighter) {
      const medals = this.battleMedals.evaluateVictory(result, this.playerFighter, this.combatEngine.telemetry);
      if (medals && medals.length > 0) {
        const medalsRow = document.getElementById('results-medals-row');
        if (medalsRow) {
          medalsRow.innerHTML = medals.map(m => `
            <div class="result-medal-chip" title="${m.desc || ''}" style="background: rgba(255,215,0,0.15); border: 1px solid rgba(255,215,0,0.4); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; color: #ffd700; display: inline-flex; align-items: center; gap: 4px; margin: 2px;">
              <span>${m.icon || '🎖️'}</span> <b>${m.name}</b> (+${m.bonusGold || 100}g)
            </div>
          `).join('');
          medalsRow.style.display = 'flex';
        }
      }
    }

    // Rewards
    this.rpg.gold += 5000;
    this.rpg.shadowSouls += 350;
    this.rpg.vermilionSeals += 1;
    this.updateUniversalHud();

    // Record World State Progress (Specs 316, 317)
    if (this.worldState && this.currentStage) {
      this.worldState.recordBossDefeat(this.currentStage.boss);
    }

    // Mark active stage as completed in Story Mode
    if (this.currentStage && this.currentStage.id === 4) {
      this.currentStage.status = 'completed';
      this.currentStage.sealChar = '討';
      this.currentStage.sealMeaning = 'Conquered';
      const stage5 = STAGES_DATA.find(s => s.id === 5);
      if (stage5) stage5.status = 'active';
      this.renderWorldMap();
    }

    modal.style.display = 'flex';
  }

  showDefeatModal(result) {
    const modal = document.getElementById('results-modal');
    if (!modal) return;

    document.getElementById('results-title-stamp').textContent = 'DEFEATED';
    document.getElementById('results-title-stamp').style.color = '#ff6b6b';
    document.getElementById('results-stars').textContent = '☆☆☆';
    document.getElementById('res-dmg-dealt').textContent = result.telemetry.damageDealt.toLocaleString();
    document.getElementById('res-max-combo').textContent = `${result.telemetry.highestCombo} HITS`;
    document.getElementById('res-parries').textContent = result.telemetry.perfectBlocks;

    modal.style.display = 'flex';
  }

  // Render Blacksmith Forge Modal (Spec 116)
  openForgeModal() {
    const list = document.getElementById('forge-weapons-list');
    if (!list) return;

    list.innerHTML = Object.keys(COMBAT_DATA.WEAPONS).map(key => {
      const w = COMBAT_DATA.WEAPONS[key];
      const mastery = this.rpg.weaponMasteries[key] || { level: 1 };
      const isEquipped = this.rpg.activeWeapon === key;

      return `
        <div class="item-row-card">
          <div class="item-info">
            <span class="item-title">${w.icon} ${w.name} ${isEquipped ? '(EQUIPPED)' : ''}</span>
            <span class="item-sub">Mastery Level: ${mastery.level} / 10 • Durability: 100 / ${w.durabilityMax} • Type: ${w.type}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="sys-icon-btn btn-sm" onclick="app.rpg.upgradeWeapon('${key}'); app.openForgeModal(); app.updateUniversalHud();">UPGRADE (2,500 🪙)</button>
            <button class="sys-icon-btn btn-sm" onclick="app.rpg.equipItem('${key}'); app.openForgeModal();">EQUIP</button>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('forge-modal').style.display = 'flex';
  }

  // Render Merchant Bazaar Modal (Spec 115)
  openMerchantModal() {
    const grid = document.getElementById('merchant-items-grid');
    if (!grid) return;

    grid.innerHTML = this.rpg.merchantStock.map(item => `
      <div class="item-row-card">
        <div class="item-info">
          <span class="item-title">${item.name}</span>
          <span class="item-sub">${item.desc}</span>
        </div>
        <button class="sys-icon-btn btn-sm" onclick="if(app.rpg.gold >= ${item.price}){ app.rpg.gold -= ${item.price}; app.updateUniversalHud(); alert('Purchased ${item.name}!'); } else { alert('Insufficient Koku!'); }">
          BUY (${item.price.toLocaleString()} 🪙)
        </button>
      </div>
    `).join('');

    document.getElementById('merchant-modal').style.display = 'flex';
  }

  // Render Categorized Inventory Modal (Spec 118)
  openInventoryModal() {
    const grid = document.getElementById('inventory-items-grid');
    if (!grid) return;

    const items = this.rpg.inventory.filter(item => 
      this.activeInvCategory === 'all' || item.cat === this.activeInvCategory
    );

    grid.innerHTML = items.map(item => `
      <div class="inventory-card ${item.equipped ? 'inv-equipped' : ''}">
        <span class="inv-card-icon">${item.icon || '⚔️'}</span>
        <div class="inv-card-info">
          <h4 class="inv-card-title">${item.name} ${item.equipped ? '✓' : ''}</h4>
          <span class="inv-card-meta">${item.type} ${item.level ? `• Lv.${item.level}` : ''}</span>
          <p class="inv-card-desc">${item.desc}</p>
        </div>
        ${(item.cat === 'weapons' || item.cat === 'equipment' || item.cat === 'charms') ? `
          <button class="sys-icon-btn btn-sm" onclick="app.rpg.equipItem('${item.id}'); app.openInventoryModal();">
            ${item.equipped ? 'UNEQUIP' : 'EQUIP'}
          </button>
        ` : `<span class="inv-qty-badge">x${item.quantity || 1}</span>`}
      </div>
    `).join('');

    document.getElementById('inventory-modal').style.display = 'flex';
  }

  // Render Combo Database Modal (Spec 72)
  openCombosModal() {
    const area = document.getElementById('combos-scroll-area');
    if (!area) return;

    const combos = this.combatEngine.comboEngine.getAllCombos();
    area.innerHTML = combos.map(c => `
      <div class="item-row-card ${c.isUnlocked ? '' : 'locked-combo'}">
        <div class="item-info">
          <span class="item-title" style="color: var(--gold-light);">${c.name} ${c.isUnlocked ? '✓' : '🔒'}</span>
          <span class="item-sub">Recipe: <b>${c.desc}</b></span>
          <span class="item-sub">Damage Multiplier: <b>${c.bonusDamage}x</b> • Tier: <b>${c.tier} Hits</b></span>
        </div>
        ${!c.isUnlocked ? `
          <button class="sys-icon-btn btn-sm" onclick="if(app.rpg.gold >= 1500){ app.rpg.gold -= 1500; app.combatEngine.comboEngine.unlockCombo('${c.id}'); app.openCombosModal(); app.updateUniversalHud(); } else { alert('Need 1,500 Gold to unlock!'); }">
            UNLOCK (1,500 🪙)
          </button>
        ` : `<span class="loot-badge">MASTERED</span>`}
      </div>
    `).join('');

    document.getElementById('combos-modal').style.display = 'flex';
  }

  // Render Save Slots Modal (Spec 137, 138)
  openSavesModal() {
    const grid = document.getElementById('save-slots-grid');
    if (!grid) return;

    const slots = this.saveRepo.getSlotsMetadata();
    grid.innerHTML = slots.map(s => `
      <div class="save-slot-card">
        <div class="save-slot-header">
          <span class="save-slot-num">SAVE SLOT ${s.slot}</span>
          <span class="save-slot-time">${s.timestamp}</span>
        </div>
        <div class="save-slot-body">
          <span class="save-hero-name">${s.name} (Lv. ${s.level})</span>
          <span class="save-hero-meta">${s.chapter} • Playtime: ${s.playtime}</span>
          <span class="save-hero-gold">🪙 ${s.gold.toLocaleString()} Koku</span>
        </div>
        <div class="save-slot-actions">
          <button class="sys-icon-btn btn-sm" onclick="app.saveRepo.saveSlot(${s.slot}, { gold: app.rpg.gold, level: app.rpg.playerLevel }); app.openSavesModal(); alert('Saved to Slot ${s.slot}!');">SAVE</button>
          <button class="sys-icon-btn btn-sm" onclick="if(!${s.isEmpty}){ const d = app.saveRepo.loadSlot(${s.slot}); app.rpg.gold = d.playerData.gold; app.updateUniversalHud(); alert('Loaded Slot ${s.slot}!'); } else { alert('Slot is empty!'); }">LOAD</button>
          <button class="sys-icon-btn btn-sm btn-danger" onclick="if(confirm('Delete Save Slot ${s.slot}?')){ app.saveRepo.deleteSlot(${s.slot}); app.openSavesModal(); }">DELETE</button>
        </div>
      </div>
    `).join('');

    document.getElementById('saves-modal').style.display = 'flex';
  }

  // Show NPC Dialogue Modal (Spec 111, 112, 113)
  showNpcDialogue(npcId) {
    const modal = document.getElementById('dialogue-modal');
    if (!modal) return;

    const dialogues = {
      master: {
        avatar: '🥋',
        name: 'Grandmaster Jin',
        title: 'Elder of the Silent Veil',
        text: '"Steel your spirit, ronin. The Demon Shogun draws his strength from the dark eclipse. Practice your perfect blocks and cancels in the training dojo before confronting his vanguard."'
      },
      blacksmith: {
        avatar: '⚒️',
        name: 'Muramasa',
        title: 'Master Swordsmith',
        text: '"Every blade possesses a soul. Bring me black iron ore and gold koku, and I will hone your steel until it cuts through armor like winter wind."'
      },
      merchant: {
        avatar: '🏮',
        name: 'Kenji the Peddler',
        title: 'Wandering Merchant',
        text: '"I carry relics found in the deep ruins of Tsukishima. Protective talismans, spirit silks, and ancient scrolls... all for fair price of koku."'
      },
      mystic: {
        avatar: '🔮',
        name: 'Priestess Tomoe',
        title: 'Guardian of the Radiant Dawn',
        text: '"The ancient solar seal was shattered when the Demon Shogun invaded. Gather the Vermilion Seals from vanquished champions to mend the realm\'s spiritual rift."'
      }
    };

    const d = dialogues[npcId] || dialogues.master;
    document.getElementById('dialogue-speaker-avatar').textContent = d.avatar;
    document.getElementById('dialogue-speaker-name').textContent = d.name;
    document.getElementById('dialogue-speaker-title').textContent = d.title;
    document.getElementById('dialogue-text-content').textContent = d.text;

    if (window.soundEngine) window.soundEngine.playVoiceKiai();
    modal.style.display = 'flex';
  }

  // Render Hub Attribute Allocation Widget (Spec 86)
  renderHubAttributes() {
    const container = document.getElementById('hub-attr-pills');
    if (!container) return;

    const attrs = [
      { key: 'strength', name: 'STR', val: this.rpg.attributes.strength, desc: '+Damage' },
      { key: 'defense', name: 'DEF', val: this.rpg.attributes.defense, desc: '+Guard' },
      { key: 'agility', name: 'AGI', val: this.rpg.attributes.agility, desc: '+Speed' },
      { key: 'endurance', name: 'END', val: this.rpg.attributes.endurance, desc: '+HP/Stamina' },
      { key: 'energy', name: 'ENG', val: this.rpg.attributes.energy, desc: '+Energy' },
      { key: 'weaponMastery', name: 'MST', val: this.rpg.attributes.weaponMastery, desc: '+Crit' }
    ];

    container.innerHTML = attrs.map(a => `
      <div class="attr-pill-box">
        <span class="attr-pill-name">${a.name}: <b>${a.val}</b></span>
        <button class="attr-plus-btn" onclick="app.rpg.investAttribute('${a.key}'); app.renderHubAttributes(); app.updateUniversalHud();">+</button>
      </div>
    `).join('');

    document.getElementById('hub-attr-points').textContent = this.rpg.attributePoints;
  }

  // Render Modes Challenge Modifiers Chips (Spec 95)
  renderModesModifiers() {
    const container = document.getElementById('modes-modifiers-chips');
    if (!container) return;

    container.innerHTML = COMBAT_DATA.CHALLENGE_MODIFIERS.map(m => {
      const active = this.rpg.challengeModifiers[m.id];
      return `
        <button class="mod-chip ${active ? 'mod-chip-active' : ''}" onclick="app.toggleChallengeModifier('${m.id}')" title="${m.desc}">
          <span>${m.name}</span>
          <span class="mod-mult">+${Math.round((m.rewardMult - 1) * 100)}%</span>
        </button>
      `;
    }).join('');
  }

  toggleChallengeModifier(modId) {
    if (this.rpg.challengeModifiers[modId] !== undefined) {
      this.rpg.challengeModifiers[modId] = !this.rpg.challengeModifiers[modId];
      this.renderModesModifiers();
      if (window.soundEngine) window.soundEngine.playSwordSlash();
    }
  }

  // Render 40 Achievements Hall Modal (Spec 97)
  openAchievementsModal() {
    const area = document.getElementById('achievements-scroll-area');
    if (!area) return;

    area.innerHTML = this.rpg.achievements.map(ach => `
      <div class="achievement-card ${ach.unlocked ? 'ach-unlocked' : ''}">
        <div class="item-info">
          <span class="item-title">${ach.unlocked ? '🏆' : '🔒'} ${ach.name} [${ach.cat}]</span>
          <span class="item-sub">${ach.desc}</span>
        </div>
        <span class="loot-badge">${ach.unlocked ? 'CLAIMED' : `+${ach.rewardGold} 🪙`}</span>
      </div>
    `).join('');

    document.getElementById('achievements-modal').style.display = 'flex';
  }

  // Render Codex Modal (Spec 120, 121)
  openCodexModal() {
    const list = document.getElementById('codex-factions-list');
    if (!list) return;

    list.innerHTML = this.rpg.codex.factions.map(f => `
      <div class="item-row-card" style="flex-direction: column; align-items: flex-start; gap: 6px;">
        <span class="item-title" style="color: var(--gold-light);">${f.name}</span>
        <span class="item-sub" style="font-style: italic; color: #ffd875;">"${f.creed}"</span>
        <span class="item-sub">Leader: <b>${f.leader}</b> | Stance: <b>${f.style}</b></span>
        <p style="font-size: 0.72rem; color: #eeddbb; margin-top: 4px; line-height: 1.4;">${f.lore}</p>
      </div>
    `).join('');

    document.getElementById('codex-modal').style.display = 'flex';
  }

  // Render Quests Modal (Spec 96, 119)
  openQuestsModal() {
    const area = document.getElementById('quests-scroll-area');
    if (!area) return;

    area.innerHTML = this.rpg.dailyChallenges.map(q => `
      <div class="item-row-card">
        <div class="item-info">
          <span class="item-title">${q.completed ? '✅' : '⏳'} ${q.text}</span>
          <span class="item-sub">Progress: ${q.current} / ${q.target}</span>
        </div>
        <span class="loot-badge">+${q.reward} 🪙</span>
      </div>
    `).join('');

    document.getElementById('quests-modal').style.display = 'flex';
  }

  // Update Top Universal HUD Counters
  updateUniversalHud() {
    document.getElementById('hud-gold-val').textContent = this.rpg.gold.toLocaleString();
    document.getElementById('hud-souls-val').textContent = this.rpg.shadowSouls.toLocaleString();
    document.getElementById('hud-seals-val').textContent = this.rpg.vermilionSeals.toLocaleString();
    document.getElementById('hud-style-title').textContent = this.rpg.activeStyle.toUpperCase() + ' STYLE';
    document.getElementById('hud-player-level').textContent = `Lv. ${this.rpg.playerLevel}`;
  }

  // =========================================================================
  // WORLD MAP RENDERING (RETAINS ALL EXISTING FUNCTIONALITY)
  // =========================================================================
  renderWorldMap() {
    this.renderNodes();
    this.renderSvgRoute();
  }

  renderNodes() {
    const nodesContainer = document.getElementById('nodes-container');
    if (!nodesContainer) return;
    nodesContainer.innerHTML = '';

    STAGES_DATA.forEach(stage => {
      const nodeEl = document.createElement('div');
      nodeEl.className = `stage-node status-${stage.status} ${stage.status === 'boss_locked' ? 'node-boss' : ''}`;
      nodeEl.id = `node-${stage.id}`;
      nodeEl.style.left = `${stage.coords.x}%`;
      nodeEl.style.top = `${stage.coords.y}%`;
      nodeEl.setAttribute('role', 'button');
      nodeEl.setAttribute('tabindex', '0');

      let innerHTML = '';
      if (stage.status === 'completed') {
        innerHTML = `
          <div class="medallion-body completed-medallion">
            <div class="medallion-rim"></div>
            <div class="medallion-face"><span class="roman-num">${stage.number}</span></div>
            <div class="vermilion-seal-stamp" title="${stage.sealMeaning}">
              <div class="seal-wax-ring"></div>
              <span class="seal-kanji">${stage.sealChar}</span>
            </div>
          </div>
          <div class="node-label"><span class="stage-num">STAGE ${stage.number}</span><span class="stage-name">${stage.title}</span></div>
        `;
      } else if (stage.status === 'active') {
        innerHTML = `
          <div class="beacon-pulse-glow"></div>
          <div class="beacon-shockwave wave-1"></div>
          <div class="beacon-shockwave wave-2"></div>
          <div class="beacon-light-ray"></div>
          <div class="runic-ring">
            <span class="rune-glyph r1">気</span><span class="rune-glyph r2">雷</span>
            <span class="rune-glyph r3">影</span><span class="rune-glyph r4">武</span>
          </div>
          <div class="medallion-body active-medallion">
            <div class="medallion-rim"></div>
            <div class="medallion-face"><span class="roman-num active-glow">${stage.number}</span></div>
          </div>
          <div class="node-label active-label"><span class="active-badge">CURRENT TARGET</span><span class="stage-name">${stage.title}</span></div>
        `;
      } else if (stage.status === 'locked') {
        innerHTML = `
          <div class="medallion-body locked-medallion">
            <div class="medallion-rim"></div>
            <div class="medallion-face"><span class="roman-num dark-num">${stage.number}</span></div>
            <div class="iron-chains-wrap">
              <div class="chain-link link-h1"></div>
              <div class="chain-link link-h2"></div>
              <div class="chain-link link-diag"></div>
            </div>
          </div>
          <div class="node-label locked-label"><span class="stage-num">STAGE ${stage.number} • SEALED</span><span class="stage-name">${stage.title}</span></div>
        `;
      } else if (stage.status === 'boss_locked') {
        innerHTML = `
          <div class="boss-golden-halo"></div>
          <div class="medallion-body demon-boss-medallion">
            <div class="demon-medallion-art" style="background-image: url('./assets/demon-shogun.jpg');"></div>
            <div class="iron-chains-wrap boss-chains">
              <div class="chain-link link-diag1"></div>
              <div class="chain-link link-diag2"></div>
            </div>
          </div>
          <div class="node-label boss-label"><span class="boss-badge">DEMON SHOGUN</span><span class="stage-name">${stage.title}</span></div>
        `;
      }

      nodeEl.innerHTML = innerHTML;
      nodeEl.addEventListener('click', () => this.openDossier(stage.id));
      nodesContainer.appendChild(nodeEl);
    });
  }

  renderSvgRoute() {
    const svg = document.getElementById('route-svg');
    if (!svg) return;
    const points = STAGES_DATA.map(s => s.coords);
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      d += ` C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
    }

    svg.innerHTML = `
      <defs>
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="routeGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#aa823a" /><stop offset="50%" stop-color="#ffd56b" /><stop offset="100%" stop-color="#00e5ff" />
        </linearGradient>
      </defs>
      <path d="${d}" class="route-ink-base" />
      <path d="${d}" class="route-golden-core" filter="url(#goldGlow)" />
      <path d="${d}" class="route-energy-pulse" />
    `;
  }

  openDossier(stageId) {
    const stage = STAGES_DATA.find(s => s.id === stageId);
    if (!stage) return;
    this.currentStage = stage;

    document.getElementById('dossier-stage-title').textContent = stage.title;
    document.getElementById('dossier-stage-jp').textContent = stage.japanese;
    document.getElementById('dossier-chapter').textContent = stage.subtitle;
    document.getElementById('dossier-boss-name').textContent = stage.boss;
    document.getElementById('dossier-boss-title').textContent = stage.bossTitle;
    document.getElementById('dossier-lore').textContent = stage.summary;

    const diffBadge = document.getElementById('dossier-difficulty-badge');
    diffBadge.textContent = `${stage.difficulty} ${stage.difficultyStars || ''}`;

    const statusBanner = document.getElementById('dossier-status-banner');
    if (stage.status === 'completed') {
      statusBanner.innerHTML = `<span class="status-stamp">VANQUISHED • ${stage.completionGrade || 'S-RANK'}</span>`;
      statusBanner.className = 'status-banner banner-completed';
    } else if (stage.status === 'active') {
      statusBanner.innerHTML = `<span class="status-stamp">⚔️ ACTIVE COMBAT OBJECTIVE</span>`;
      statusBanner.className = 'status-banner banner-active';
    } else {
      statusBanner.innerHTML = `<span class="status-stamp">🔒 SEALED BEHIND TALISMAN WARDS</span>`;
      statusBanner.className = 'status-banner banner-locked';
    }

    document.getElementById('dossier-player-cp').textContent = '4,850 CP';
    document.getElementById('dossier-boss-cp').textContent = `${stage.recommendedCP.toLocaleString()} CP`;

    const traitsList = document.getElementById('dossier-boss-traits');
    traitsList.innerHTML = (stage.bossTraits || []).map(t => `
      <div class="trait-card"><span class="trait-name">◆ ${t.name}:</span> <span>${t.desc}</span></div>
    `).join('');

    const spoilsList = document.getElementById('dossier-spoils-list');
    spoilsList.innerHTML = (stage.spoils || []).map(sp => `
      <div class="spoil-item"><span>${sp.icon}</span><span>${sp.name}</span></div>
    `).join('');

    const ctaBtn = document.getElementById('dossier-action-btn');
    if (stage.status === 'active') {
      ctaBtn.className = 'action-cta-btn btn-active';
      ctaBtn.innerHTML = `⚔️ COMMENCE DUEL`;
      ctaBtn.disabled = false;
    } else if (stage.status === 'completed') {
      ctaBtn.className = 'action-cta-btn btn-replay';
      ctaBtn.innerHTML = `🔄 REPLAY DUEL (SPARRING)`;
      ctaBtn.disabled = false;
    } else {
      ctaBtn.className = 'action-cta-btn btn-locked';
      ctaBtn.innerHTML = `🔒 DESTINY SEALED`;
      ctaBtn.disabled = true;
    }

    document.getElementById('combat-dossier-modal').style.display = 'flex';
  }

  closeDossier() {
    document.getElementById('combat-dossier-modal').style.display = 'none';
  }

  // =========================================================================
  // EVENT BINDINGS (KEYBOARD, NAVIGATION, AND BUTTONS)
  // =========================================================================
  bindEvents() {
    // Top Tabs
    document.getElementById('nav-btn-hub').addEventListener('click', () => this.switchView('hub'));
    document.getElementById('nav-btn-map').addEventListener('click', () => this.switchView('map'));
    document.getElementById('nav-btn-modes').addEventListener('click', () => this.switchView('modes'));
    document.getElementById('nav-btn-forge').addEventListener('click', () => this.openForgeModal());
    document.getElementById('nav-btn-merchant').addEventListener('click', () => this.openMerchantModal());
    document.getElementById('nav-btn-inventory').addEventListener('click', () => this.openInventoryModal());
    document.getElementById('nav-btn-combos').addEventListener('click', () => this.openCombosModal());
    document.getElementById('nav-btn-quests').addEventListener('click', () => this.openQuestsModal());
    document.getElementById('nav-btn-codex').addEventListener('click', () => this.openCodexModal());
    document.getElementById('nav-btn-achievements').addEventListener('click', () => this.openAchievementsModal());
    document.getElementById('nav-btn-saves').addEventListener('click', () => this.openSavesModal());
    const profBtn = document.getElementById('nav-btn-profile');
    if (profBtn) profBtn.addEventListener('click', () => this.openProfileModal());

    // Specs 266-387 Top Navigation Controls
    const trialsBtn = document.getElementById('trials-toggle-btn');
    if (trialsBtn) trialsBtn.addEventListener('click', () => this.openChallengeModal());
    const worldBtn = document.getElementById('world-toggle-btn');
    if (worldBtn) worldBtn.addEventListener('click', () => this.openWorldModal());
    const creditsBtn = document.getElementById('credits-toggle-btn');
    if (creditsBtn) creditsBtn.addEventListener('click', () => this.openCreditsModal());
    const qaBtn = document.getElementById('qa-dashboard-toggle-btn');
    if (qaBtn) qaBtn.addEventListener('click', () => this.toggleQADashboard());

    // Specs 266-387 Modal Close Buttons
    const closeChallengeBtn = document.getElementById('btn-close-challenge-modal');
    if (closeChallengeBtn) closeChallengeBtn.addEventListener('click', () => {
      document.getElementById('challenge-modal').style.display = 'none';
    });
    const closeWorldBtn = document.getElementById('btn-close-world-modal');
    if (closeWorldBtn) closeWorldBtn.addEventListener('click', () => {
      document.getElementById('world-lore-modal').style.display = 'none';
    });
    const closeCreditsBtn = document.getElementById('btn-close-credits-modal');
    if (closeCreditsBtn) closeCreditsBtn.addEventListener('click', () => {
      document.getElementById('credits-modal').style.display = 'none';
    });
    const closeQaBtn = document.getElementById('btn-close-qa-dashboard');
    if (closeQaBtn) closeQaBtn.addEventListener('click', () => this.toggleQADashboard(false));

    // Trials Modal Tabs (Specs 299-311)
    document.querySelectorAll('#challenge-tabs-row .char-tab-btn, #trials-tabs-row .char-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#challenge-tabs-row .char-tab-btn, #trials-tabs-row .char-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const tab = e.currentTarget.getAttribute('data-trial') || e.currentTarget.getAttribute('data-trialtab');
        ['daily', 'gauntlet', 'tournament', 'mutators'].forEach(t => {
          const el = document.getElementById(`trial-${t}-box`);
          if (el) el.style.display = (t === tab) ? 'block' : 'none';
        });
      });
    });

    // World Modal Tabs (Specs 316-352)
    document.querySelectorAll('#world-tabs-row .char-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#world-tabs-row .char-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const tab = e.currentTarget.getAttribute('data-worldtab');
        ['factions', 'secrets', 'endings', 'trainers'].forEach(t => {
          const el = document.getElementById(`world-${t}-box`);
          if (el) el.style.display = (t === tab) ? 'block' : 'none';
        });
      });
    });

    // Start Daily Challenge (Specs 301, 304, 305)
    const handleStartDaily = () => {
      document.getElementById('challenge-modal').style.display = 'none';
      if (this.challengeGen) {
        const challenge = this.challengeGen.getDailyChallenge();
        this.activeMutator = challenge.mutator;
        if (this.combatEngine) this.combatEngine.applyMutator(this.activeMutator);
        this.startBattle('story', STAGES_DATA[3]);
        if (window.notifications) window.notifications.show('DAILY CHALLENGE', `${challenge.mutator.name}: ${challenge.mutator.description}`, '⚔️', 'warning', 2500);
      }
    };
    const startDailyBtn = document.getElementById('btn-start-daily-challenge');
    if (startDailyBtn) startDailyBtn.addEventListener('click', handleStartDaily);
    const launchDailyBtn = document.getElementById('btn-launch-daily-trial');
    if (launchDailyBtn) launchDailyBtn.addEventListener('click', handleStartDaily);

    // Start Gauntlet (Specs 307-310)
    const startGauntletBtn = document.getElementById('btn-start-gauntlet');
    if (startGauntletBtn) {
      startGauntletBtn.addEventListener('click', () => {
        document.getElementById('challenge-modal').style.display = 'none';
        if (this.gauntlet) this.gauntlet.startRun();
        this.currentCombatMode = 'gauntlet';
        this.startBattle('survival');
        if (window.notifications) window.notifications.show('GAUNTLET ASCENT', 'Floor 1/5 Commenced!', '🔥', 'info', 2000);
      });
    }

    // Start Tournament (Spec 306)
    const startTournamentBtn = document.getElementById('btn-start-tournament');
    if (startTournamentBtn) {
      startTournamentBtn.addEventListener('click', () => {
        document.getElementById('challenge-modal').style.display = 'none';
        if (this.tournament) this.tournament.startTournament();
        this.currentCombatMode = 'tournament';
        this.startBattle('arcade');
        if (window.notifications) window.notifications.show('TOURNAMENT BRACKET', 'Round 1: Quarter-Finals', '👑', 'info', 2000);
      });
    }

    // Secret Boss, Weapon, and Style Handlers (Specs 348-350)
    const secretBossBtn = document.getElementById('btn-fight-secret-boss');
    if (secretBossBtn) {
      secretBossBtn.addEventListener('click', () => {
        document.getElementById('world-lore-modal').style.display = 'none';
        const secretStage = {
          id: 99,
          number: "Ω",
          title: "Sacred Eclipse Nexus",
          japanese: "虚空の神殿",
          subtitle: "Secret Climax • Void Ascendance",
          status: "active",
          boss: "The Void Sovereign (Kage-No-Shin)",
          bossTitle: "Harbinger of the Celestial Rift",
          difficulty: "ABYSSAL VOID",
          recommendedCP: 9999,
          summary: "The primordial shade of Tsukishima manifests through a dimensional rift.",
          bossTraits: [
            { name: "Void Teleport", desc: "Phase dodges through space on counter-attack." },
            { name: "Spatial Rend", desc: "Unblockable dimensional blade slash." }
          ],
          spoils: [{ name: "Eclipse Odachi", icon: "🗡️" }, { name: "Void Form", icon: "🌌" }],
          coords: { x: 50, y: 50 }
        };
        this.startBattle('story', secretStage);
        if (window.notifications) window.notifications.show('SECRET CLASH', 'The Void Sovereign awakens from the rift!', '👹', 'warning', 3000);
      });
    }

    const secretWeaponBtn = document.getElementById('btn-equip-secret-weapon');
    if (secretWeaponBtn) {
      secretWeaponBtn.addEventListener('click', () => {
        if (this.rpg) {
          this.rpg.activeWeapon = 'muramasa_zero';
          this.rpg.weaponMasteries['muramasa_zero'] = { level: 10, xp: 9999 };
          if (this.playerFighter) this.playerFighter.weapon = COMBAT_DATA.WEAPONS['muramasa_zero'];
        }
        if (window.notifications) window.notifications.show('SECRET WEAPON EQUIPPED', 'Eclipse Odachi (Muramasa Zero) equipped!', '🗡️', 'success', 2500);
      });
    }

    const secretStyleBtn = document.getElementById('btn-equip-secret-style');
    if (secretStyleBtn) {
      secretStyleBtn.addEventListener('click', () => {
        if (this.rpg) {
          if (!this.rpg.unlockedStyles.includes('void_form')) {
            this.rpg.unlockedStyles.push('void_form');
          }
          this.rpg.activeStyle = 'void_form';
          if (this.playerFighter && typeof COMBAT_DATA !== 'undefined' && COMBAT_DATA.STYLES['void_form']) {
            this.playerFighter.style = COMBAT_DATA.STYLES['void_form'];
          }
        }
        this.updateUniversalHud();
        if (window.notifications) window.notifications.show('SECRET STYLE ADOPTED', 'Void Form (Spatial Mastery) active!', '🌌', 'success', 2500);
      });
    }

    // Ending Epilogue Viewer Handlers (Specs 351, 352)
    const endingButtons = [
      { id: 'btn-view-ending-1', title: "Ending I: The Ronin's Rest", epilogue: "The gates remain shut. Peace returns to the lower valley, though shadows still linger in the mist." },
      { id: 'btn-view-ending-2', title: "Ending II: Dawn of the Eclipse", epilogue: "You took the ancient power for yourself. The order bows to a new sovereign of steel." },
      { id: 'btn-view-ending-3', title: "True Ending: Ascendance of Veil", epilogue: "The dimensional rift seals forever. The spirit of the ancients recognizes you as the True Grandmaster." }
    ];
    endingButtons.forEach(eb => {
      const btn = document.getElementById(eb.id);
      if (btn) {
        btn.addEventListener('click', () => {
          if (window.notifications) window.notifications.show(eb.title, eb.epilogue, '📜', 'info', 4500);
        });
      }
    });

    // QA Smoke Test & Report Buttons
    const runSmokeBtn = document.getElementById('btn-run-smoke-test');
    if (runSmokeBtn) {
      runSmokeBtn.addEventListener('click', () => {
        const statusEl = document.getElementById('qa-smoke-status');
        if (statusEl) statusEl.textContent = 'RUNNING...';
        setTimeout(() => {
          if (this.smokeTester) {
            const results = this.smokeTester.runSmokeTest(this);
            if (statusEl) {
              statusEl.textContent = results.passed ? 'PASSED (100%)' : 'FAILED';
              statusEl.style.color = results.passed ? '#81c784' : '#ff5252';
            }
            if (window.notifications) window.notifications.show('SMOKE TEST COMPLETE', `Status: ${results.passed ? 'PASSED' : 'FAILED'} (${results.checks.length} assertions verified)`, '✅', 'info', 3000);
          }
        }, 100);
      });
    }

    const exportQaBtn = document.getElementById('btn-export-qa-report');
    if (exportQaBtn) {
      exportQaBtn.addEventListener('click', () => {
        const report = this.qaDashboard ? this.qaDashboard.generateQaReport() : { status: 'OK' };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shadow_samurai_qa_report_v1.0.0.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Multilingual Localization Pipeline (Spec 244)
    const localeSel = document.getElementById('locale-selector');
    if (localeSel) {
      localeSel.addEventListener('change', (e) => {
        if (window.loc) window.loc.setLocale(e.target.value);
      });
    }

    // Equippable Title Selector (Spec 202)
    const titleSel = document.getElementById('profile-title-select');
    if (titleSel) {
      titleSel.addEventListener('change', (e) => {
        const crest = document.getElementById('hud-style-title');
        if (crest) crest.textContent = e.target.value;
        if (window.notifications) window.notifications.show('TITLE EQUIPPED', `Ranked: ${e.target.value}`, '🎖️', 'info', 1600);
      });
    }

    // Pre-Battle Loadout Controls (Spec 187-194)
    document.querySelectorAll('.char-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.char-card-btn').forEach(b => b.classList.remove('char-selected'));
        const card = e.currentTarget;
        card.classList.add('char-selected');
        this.selectedCharacter = card.getAttribute('data-char');
      });
    });

    document.querySelectorAll('.preset-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-chip-btn').forEach(b => b.classList.remove('active-preset'));
        e.currentTarget.classList.add('active-preset');
        this.activePreset = e.currentTarget.getAttribute('data-preset');
      });
    });

    const quickEquipBtn = document.getElementById('btn-quick-equip');
    if (quickEquipBtn) {
      quickEquipBtn.addEventListener('click', () => {
        this.activePreset = 'boss_hunter';
        document.querySelectorAll('.preset-chip-btn').forEach(b => {
          b.classList.toggle('active-preset', b.getAttribute('data-preset') === 'boss_hunter');
        });
        if (window.notifications) window.notifications.show('RECOMMENDED LOADOUT', 'Equipped Tiger Cleave & Guard Pierce', '⚡', 'info', 1800);
      });
    }

    const loadoutCommenceBtn = document.getElementById('btn-loadout-commence');
    if (loadoutCommenceBtn) {
      loadoutCommenceBtn.addEventListener('click', () => {
        document.getElementById('loadout-modal').style.display = 'none';
        const cinematic = document.getElementById('duel-cinematic-overlay');
        cinematic.classList.add('active');
        if (window.soundEngine) window.soundEngine.playDuelStart();

        setTimeout(() => {
          cinematic.classList.remove('active');
          this.startBattle('story', this.currentStage || STAGES_DATA[3]);
        }, 1400);
      });
    }

    // Frame Debugger Buttons (Spec 148, 149)
    const dbgToggleBtn = document.getElementById('btn-toggle-debugger');
    if (dbgToggleBtn) dbgToggleBtn.addEventListener('click', () => this.toggleDebugger());
    const dbgCloseBtn = document.getElementById('btn-close-debugger');
    if (dbgCloseBtn) dbgCloseBtn.addEventListener('click', () => this.toggleDebugger(false));

    const dbgPauseBtn = document.getElementById('dbg-btn-pause');
    if (dbgPauseBtn) {
      dbgPauseBtn.addEventListener('click', () => {
        this.togglePauseCombat();
        dbgPauseBtn.textContent = this.isPaused ? '▶️ PLAY' : '⏸️ PAUSE';
      });
    }

    const dbgStepNext = document.getElementById('dbg-btn-step-next');
    if (dbgStepNext) {
      dbgStepNext.addEventListener('click', () => {
        if (this.isInCombat) {
          this.combatEngine.update();
          this.arena.render(this.playerFighter, this.enemyFighter, this.combatEngine);
          this.updateDebuggerTelemetry();
        }
      });
    }

    const dbgSlowBtn = document.getElementById('dbg-btn-slow');
    if (dbgSlowBtn) dbgSlowBtn.addEventListener('click', () => { this.combatEngine.timeScale = 0.25; });
    const dbgNormBtn = document.getElementById('dbg-btn-normal');
    if (dbgNormBtn) dbgNormBtn.addEventListener('click', () => { this.combatEngine.timeScale = 1.0; });

    const dbgValidateBtn = document.getElementById('dbg-btn-validate');
    if (dbgValidateBtn) {
      dbgValidateBtn.addEventListener('click', () => {
        if (typeof ContentValidator !== 'undefined') {
          const report = ContentValidator.validateAll();
          alert(`CONTENT VALIDATION: ${report.valid ? 'PASSED (0 ERRORS)' : 'WARNINGS FOUND'}\nScanned Attacks: ${report.attacksChecked}, Weapons: ${report.weaponsChecked}, Styles: ${report.stylesChecked}`);
        }
      });
    }

    // Consumables Click Handlers (Spec 194)
    const gourdBtn = document.getElementById('btn-use-gourd');
    if (gourdBtn) gourdBtn.addEventListener('click', () => this.useConsumable('gourd'));
    const elixirBtn = document.getElementById('btn-use-elixir');
    if (elixirBtn) elixirBtn.addEventListener('click', () => this.useConsumable('elixir'));
    const tonicBtn = document.getElementById('btn-use-tonic');
    if (tonicBtn) tonicBtn.addEventListener('click', () => this.useConsumable('tonic'));
    document.getElementById('settings-toggle-btn').addEventListener('click', () => {
      document.getElementById('settings-modal').style.display = 'flex';
    });

    // Hub Gates
    document.getElementById('gate-story-map').addEventListener('click', () => this.switchView('map'));
    document.getElementById('gate-training-dojo').addEventListener('click', () => this.startBattle('training'));
    document.getElementById('gate-modes-menu').addEventListener('click', () => this.switchView('modes'));
    document.getElementById('gate-forge').addEventListener('click', () => this.openForgeModal());
    document.getElementById('gate-merchant').addEventListener('click', () => this.openMerchantModal());
    document.getElementById('gate-inventory').addEventListener('click', () => this.openInventoryModal());
    document.getElementById('gate-combos').addEventListener('click', () => this.openCombosModal());
    document.getElementById('gate-saves').addEventListener('click', () => this.openSavesModal());

    // Hub NPCs
    document.getElementById('npc-btn-master').addEventListener('click', () => this.showNpcDialogue('master'));
    document.getElementById('npc-btn-blacksmith').addEventListener('click', () => this.showNpcDialogue('blacksmith'));
    document.getElementById('npc-btn-merchant').addEventListener('click', () => this.showNpcDialogue('merchant'));
    document.getElementById('npc-btn-mystic').addEventListener('click', () => this.showNpcDialogue('mystic'));
    document.getElementById('btn-dialogue-continue').addEventListener('click', () => {
      document.getElementById('dialogue-modal').style.display = 'none';
    });

    // Inventory Category Tabs
    document.querySelectorAll('.inv-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.inv-tab-btn').forEach(b => b.classList.remove('active-inv-tab'));
        e.target.classList.add('active-inv-tab');
        this.activeInvCategory = e.target.getAttribute('data-cat');
        this.openInventoryModal();
      });
    });

    // Save JSON Export / Import
    document.getElementById('btn-export-save-json').addEventListener('click', () => {
      this.saveRepo.exportSaveJson(1);
    });
    const importInput = document.getElementById('input-import-save-json');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = this.saveRepo.importSaveJson(1, event.target.result);
          if (success) {
            alert('Save file imported successfully into Slot 1!');
            this.openSavesModal();
            const data = this.saveRepo.loadSlot(1);
            if (data) {
              this.rpg.gold = data.playerData.gold;
              this.updateUniversalHud();
            }
          } else {
            alert('Failed to import save file.');
          }
        };
        reader.readAsText(file);
      });
    }

    // Photo Mode Controls (Spec 107)
    document.getElementById('btn-arena-photo').addEventListener('click', () => this.togglePhotoMode(true));
    document.getElementById('btn-photo-exit').addEventListener('click', () => this.togglePhotoMode(false));
    document.getElementById('btn-photo-capture').addEventListener('click', () => this.arena.captureScreenshot());
    document.getElementById('btn-photo-hide-ui').addEventListener('click', () => {
      const hud = document.getElementById('combat-battle-hud');
      if (hud) hud.style.display = (hud.style.display === 'none') ? 'flex' : 'none';
    });

    // Game Modes Buttons
    document.getElementById('btn-start-survival').addEventListener('click', () => this.startBattle('survival'));
    document.getElementById('btn-start-bossrush').addEventListener('click', () => this.startBattle('boss_rush'));
    document.getElementById('btn-start-arcade').addEventListener('click', () => this.startBattle('arcade'));
    document.getElementById('btn-start-ngp').addEventListener('click', () => {
      this.gameModes.activateNewGamePlus();
      alert('NEW GAME+ ACTIVATED! Enemies deal +60% damage with new modifiers. Muramasa Katana & Void Style unlocked.');
      this.switchView('map');
    });

    // Commence Duel CTA -> Route to Pre-Battle Loadout (Spec 187)
    document.getElementById('dossier-action-btn').addEventListener('click', () => {
      this.closeDossier();
      this.openLoadoutModal(this.currentStage);
    });

    document.getElementById('dossier-close-btn').addEventListener('click', () => this.closeDossier());

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.combat-dossier-modal');
        if (modal) modal.style.display = 'none';
      });
    });

    // Results Continue Button
    document.getElementById('btn-results-continue').addEventListener('click', () => {
      document.getElementById('results-modal').style.display = 'none';
      this.switchView('map');
    });

    // Training Toolbar Controls
    const dummySelect = document.getElementById('training-dummy-select');
    if (dummySelect) {
      dummySelect.addEventListener('change', (e) => {
        this.gameModes.training.dummyBehavior = e.target.value;
      });
    }
    document.getElementById('btn-toggle-hitboxes').addEventListener('click', (e) => {
      this.arena.showHitboxes = !this.arena.showHitboxes;
      e.target.textContent = `HITBOXES: ${this.arena.showHitboxes ? 'ON' : 'OFF'}`;
    });
    document.getElementById('btn-toggle-framedata').addEventListener('click', (e) => {
      this.arena.showFrameData = !this.arena.showFrameData;
      e.target.textContent = `FRAME DATA: ${this.arena.showFrameData ? 'ON' : 'OFF'}`;
    });
    document.getElementById('btn-reset-training').addEventListener('click', () => {
      if (this.playerFighter && this.enemyFighter) {
        this.playerFighter.x = 380;
        this.playerFighter.y = 420;
        this.enemyFighter.x = 750;
        this.enemyFighter.y = 420;
      }
    });

    // Combat Touch / Action Buttons with Directional Attack Resolution (Spec 71)
    document.querySelectorAll('.combat-key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-action');
        if (!this.playerFighter) return;
        const dir = this.getCurrentDirection();

        if (act === 'light') {
          const atk = this.playerFighter.resolveAttack('light', dir);
          this.playerFighter.executeAttack(atk);
        } else if (act === 'kick') {
          const atk = this.playerFighter.resolveAttack('kick', dir);
          this.playerFighter.executeAttack(atk);
        } else if (act === 'heavy') {
          const atk = this.playerFighter.resolveAttack('heavy', dir);
          this.playerFighter.executeAttack(atk);
        } else if (act === 'special') {
          this.playerFighter.executeAttack('special_shadow_dash');
          if (window.soundEngine) window.soundEngine.playVoiceKiai();
        } else if (act === 'ultimate') {
          if (this.combatEngine.executionAvailable) {
            this.combatEngine.triggerExecution();
          } else {
            this.playerFighter.executeAttack('ultimate_eclipse');
            if (window.soundEngine) window.soundEngine.playVoiceKiai();
          }
        } else if (act === 'dodge') {
          this.playerFighter.dodge();
        } else if (act === 'throw') {
          if (this.combatEngine.enhancements) {
            this.combatEngine.enhancements.executeThrow(this.playerFighter, this.enemyFighter, this.arena, dir);
          }
        } else if (act === 'escape') {
          if (this.combatEngine.enhancements) {
            this.combatEngine.enhancements.tryComboBreaker(this.playerFighter, this.arena);
          }
        } else if (act === 'switch') {
          this.cycleFightingStyle();
        }
      });
    });

    document.getElementById('btn-retreat-battle').addEventListener('click', () => {
      this.isInCombat = false;
      this.switchView('map');
    });

    document.getElementById('btn-activate-rage').addEventListener('click', () => {
      if (this.playerFighter) this.playerFighter.activateRage();
    });

    // Audio & Fullscreen
    document.getElementById('audio-toggle-btn').addEventListener('click', () => {
      if (window.soundEngine) {
        const isMuted = window.soundEngine.toggleMute();
        document.getElementById('audio-toggle-btn').innerHTML = isMuted ? '🔇 <span>MUTED</span>' : '🔊 <span>SOUND ON</span>';
      }
    });
    document.getElementById('fullscreen-toggle-btn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Keyboard Keydown / Keyup Listeners
    window.addEventListener('keydown', (e) => {
      this.keysHeld[e.code] = true;

      // Dev Performance Overlay Toggle [F3] (Spec 127)
      if (e.code === 'F3') {
        e.preventDefault();
        this.arena.showPerfOverlay = !this.arena.showPerfOverlay;
        return;
      }

      // Frame Debugger Toggle [F2] (Spec 149)
      if (e.code === 'F2') {
        e.preventDefault();
        this.toggleDebugger();
        return;
      }

      // QA & Balance Dashboard Toggle [F4] (Specs 370-385)
      if (e.code === 'F4') {
        e.preventDefault();
        this.toggleQADashboard();
        return;
      }

      // Photo Mode Toggle [P] (Spec 107)
      if (e.code === 'KeyP') {
        if (this.isInCombat) {
          this.togglePhotoMode(!this.arena.photoMode.active);
        }
        return;
      }

      if (!this.isInCombat) {
        if (e.key === 'Escape') this.closeDossier();
        if (e.code === 'Space') {
          const dossier = document.getElementById('combat-dossier-modal');
          if (dossier && dossier.style.display !== 'none') {
            document.getElementById('dossier-action-btn').click();
          }
        }
        return;
      }

      // In Combat Actions (Directional resolution & Input Buffer) (Spec 71, 150)
      const dir = this.getCurrentDirection();

      // Buffer input if currently trapped or recovering
      if (this.combatEngine.enhancements && this.playerFighter.state === 'ATTACK' && !this.playerFighter.canCancel) {
        if (e.code === 'KeyJ') this.combatEngine.enhancements.inputBuffer.pushInput('light', dir);
        else if (e.code === 'KeyK') this.combatEngine.enhancements.inputBuffer.pushInput('kick', dir);
        else if (e.code === 'KeyL') this.combatEngine.enhancements.inputBuffer.pushInput('heavy', dir);
        else if (e.code === 'KeyI') this.combatEngine.enhancements.inputBuffer.pushInput('special', dir);
        else if (e.code === 'Space') this.combatEngine.enhancements.inputBuffer.pushInput('dodge', dir);
        else if (e.code === 'KeyG') this.combatEngine.enhancements.inputBuffer.pushInput('throw', dir);
        return;
      }

      if (e.code === 'KeyJ') {
        const atk = this.playerFighter.resolveAttack('light', dir);
        this.playerFighter.executeAttack(atk);
      } else if (e.code === 'KeyK') {
        const atk = this.playerFighter.resolveAttack('kick', dir);
        this.playerFighter.executeAttack(atk);
      } else if (e.code === 'KeyL') {
        const atk = this.playerFighter.resolveAttack('heavy', dir);
        this.playerFighter.executeAttack(atk);
      } else if (e.code === 'KeyI') {
        this.playerFighter.executeAttack('special_shadow_dash');
        if (window.soundEngine) window.soundEngine.playVoiceKiai();
      } else if (e.code === 'KeyU') {
        if (this.combatEngine.executionAvailable) {
          this.combatEngine.triggerExecution();
        } else {
          this.playerFighter.executeAttack('ultimate_eclipse');
          if (window.soundEngine) window.soundEngine.playVoiceKiai();
        }
      } else if (e.code === 'KeyG') {
        if (this.combatEngine.enhancements) {
          this.combatEngine.enhancements.executeThrow(this.playerFighter, this.enemyFighter, this.arena, dir);
        }
      } else if (e.code === 'KeyB') {
        if (this.combatEngine.enhancements) {
          this.combatEngine.enhancements.tryComboBreaker(this.playerFighter, this.arena);
        }
      } else if (e.code === 'Digit1') {
        this.useConsumable('gourd');
      } else if (e.code === 'Digit2') {
        this.useConsumable('elixir');
      } else if (e.code === 'Digit3') {
        this.useConsumable('tonic');
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.playerFighter.dodge();
      } else if (e.code === 'KeyQ') {
        this.cycleFightingStyle();
      } else if (e.code === 'KeyR') {
        this.playerFighter.activateRage();
      } else if (e.code === 'Escape') {
        this.isInCombat = false;
        this.switchView('map');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld[e.code] = false;
    });
  }

  // Toggle Photo Mode (Spec 107)
  togglePhotoMode(active) {
    this.arena.photoMode.active = active;
    document.getElementById('photo-mode-overlay').style.display = active ? 'block' : 'none';
    if (!active) {
      const hud = document.getElementById('combat-battle-hud');
      if (hud) hud.style.display = 'flex';
      this.arena.photoMode.panX = 0;
      this.arena.photoMode.panY = 0;
      this.arena.photoMode.zoom = 1.0;
    }
  }

  // Cycle Through the 6 Fighting Styles (Spec 87, 88)
  cycleFightingStyle() {
    const styles = this.rpg.unlockedStyles;
    const currIdx = styles.indexOf(this.rpg.activeStyle);
    const nextStyle = styles[(currIdx + 1) % styles.length];
    this.rpg.activeStyle = nextStyle;
    if (this.playerFighter) {
      this.playerFighter.style = COMBAT_DATA.STYLES[nextStyle];
    }
    document.getElementById('arena-player-style').textContent = nextStyle.toUpperCase() + ' STYLE';
    this.updateUniversalHud();
    if (window.soundEngine) window.soundEngine.playSwordSlash();
  }

  // Pre-Battle Tactical Loadout Modal (Specs 187 - 194)
  openLoadoutModal(stage) {
    this.currentStage = stage || STAGES_DATA[3];
    const modal = document.getElementById('loadout-modal');
    if (!modal) return;

    const bossNameEl = document.getElementById('loadout-boss-name');
    const bossStyleEl = document.getElementById('loadout-boss-style');
    if (bossNameEl) bossNameEl.textContent = this.currentStage.boss;
    if (bossStyleEl) bossStyleEl.textContent = this.currentStage.bossTitle;

    modal.style.display = 'flex';
  }

  // Player Profile & Lifetime Statistics Modal (Specs 202 - 207, 311)
  openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    if (typeof CombatStatisticsManager !== 'undefined') {
      const stats = CombatStatisticsManager.getStats();
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setVal('stat-fights', stats.totalFights || stats.totalDuels || 0);
      setVal('stat-wins', stats.wins || stats.victories || 0);
      setVal('stat-losses', stats.losses || stats.defeats || 0);
      setVal('stat-combo', `${stats.highestCombo || stats.longestCombo || 0} Hits`);
      setVal('stat-parries', stats.totalPerfectBlocks || 0);
      setVal('stat-dodges', stats.totalPerfectDodges || stats.totalDodges || 0);
      setVal('stat-bosses', stats.totalBossesDefeated || 0);
      setVal('stat-dmg', ((stats.totalDamageDealt !== undefined ? stats.totalDamageDealt : stats.damageDealt) || 0).toLocaleString());
    }

    // Render Collectible Profile Badges (Spec 311)
    const badgesGrid = document.getElementById('profile-badges-grid');
    if (badgesGrid && typeof PROFILE_BADGES !== 'undefined') {
      const badgeList = Array.isArray(PROFILE_BADGES) ? PROFILE_BADGES : Object.values(PROFILE_BADGES);
      badgesGrid.innerHTML = badgeList.map(b => `
        <div class="skill-slot-card" style="padding: 8px; border: 1px solid rgba(212,175,55,0.4); background: rgba(212,175,55,0.06); border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 1.25rem;">${b.icon}</span>
            <b style="color: #ffd56b; font-size: 0.8rem;">${b.name}</b>
          </div>
          <p style="font-size: 0.72rem; color: #c5bcae; margin: 0; line-height: 1.3;">${b.desc}</p>
          <span style="display: inline-block; margin-top: 5px; font-size: 0.65rem; color: #81c784; font-weight: bold;">● MASTERED</span>
        </div>
      `).join('');
    }

    modal.style.display = 'flex';
  }

  // Combat Frame Debugger Overlay Toggle (Specs 148, 149)
  toggleDebugger(show = null) {
    const el = document.getElementById('frame-debugger-overlay');
    if (!el) return;
    this.frameDebuggerActive = (show !== null) ? show : !this.frameDebuggerActive;
    el.style.display = this.frameDebuggerActive ? 'flex' : 'none';
  }

  updateDebuggerTelemetry() {
    if (!this.playerFighter) return;
    const p = this.playerFighter;
    const e = this.enemyFighter;

    const frameEl = document.getElementById('dbg-frame-num');
    const scaleEl = document.getElementById('dbg-scale-num');
    const pStateEl = document.getElementById('dbg-p-state');
    const pPhaseEl = document.getElementById('dbg-p-phase');
    const pAtkFrameEl = document.getElementById('dbg-p-atkframe');
    const pPoiseEl = document.getElementById('dbg-p-poise');
    const ePoiseEl = document.getElementById('dbg-e-poise');
    const queueEl = document.getElementById('dbg-buffer-queue');

    if (frameEl) frameEl.textContent = p.animTick || 0;
    if (scaleEl) scaleEl.textContent = `${this.combatEngine.timeScale}x`;
    if (pStateEl) pStateEl.textContent = p.state;
    if (pPhaseEl) pPhaseEl.textContent = p.attackPhase || 'NONE';
    if (pAtkFrameEl) pAtkFrameEl.textContent = p.attackFrame || 0;
    if (pPoiseEl) pPoiseEl.textContent = Math.round(p.poise || 100);
    if (ePoiseEl && e) ePoiseEl.textContent = Math.round(e.poise || 100);

    if (queueEl && this.combatEngine.enhancements) {
      const q = this.combatEngine.enhancements.inputBuffer.queue;
      queueEl.textContent = q.length > 0 ? q.map(i => i.action.toUpperCase()).join(' > ') : '[EMPTY]';
    }
  }

  // =========================================================================
  // TRIALS & CHALLENGES MODAL (Specs 299-311)
  // =========================================================================
  openChallengeModal() {
    const modal = document.getElementById('challenge-modal');
    if (!modal) return;

    if (this.challengeGen) {
      const daily = this.challengeGen.getDailyChallenge();
      
      const seedEl = document.getElementById('daily-trial-seed');
      if (seedEl) seedEl.textContent = `SEED: ${daily.seed} (${daily.date})`;
      const titleEl = document.getElementById('daily-trial-title');
      if (titleEl) titleEl.textContent = `DAILY TRIAL: ${daily.date}`;
      const enemyEl = document.getElementById('daily-enemy-name');
      if (enemyEl) enemyEl.textContent = `${daily.boss.name} (${daily.boss.title})`;
      const arenaEl = document.getElementById('daily-arena-name');
      if (arenaEl) arenaEl.textContent = `${daily.arena.name} (${daily.arena.weather})`;
      const mutatorEl = document.getElementById('daily-mutator-name');
      if (mutatorEl) mutatorEl.textContent = `${daily.mutator.name} (${daily.mutator.description})`;

      const dateEl = document.getElementById('daily-seed-date');
      if (dateEl) dateEl.textContent = `Daily Seed: ${daily.seed} (${daily.date})`;
      const detailsEl = document.getElementById('daily-challenge-details');
      if (detailsEl) {
        detailsEl.innerHTML = `
          <div style="margin-bottom: 6px;"><b>Adversary:</b> ${daily.boss.name} (${daily.boss.title})</div>
          <div style="margin-bottom: 6px;"><b>Arena Realm:</b> ${daily.arena.name} (${daily.arena.weather})</div>
          <div style="margin-bottom: 6px;"><b>Active Mutator:</b> <span style="color: #ffd56b;">${daily.mutator.name}</span> — <i>${daily.mutator.description}</i></div>
          <div style="color: #81c784;"><b>Bonus Spoils:</b> +${daily.rewards.gold} Gold, +${daily.rewards.souls} Souls, ${daily.rewards.badge} Badge</div>
        `;
      }
    }

    this.renderGauntletPerksDraft();
    this.renderMutatorsCatalog();

    modal.style.display = 'flex';
  }

  renderGauntletPerksDraft() {
    const container = document.getElementById('gauntlet-perks-draft');
    if (!container || !this.gauntlet) return;
    const perks = this.gauntlet.perksPool.slice(0, 3);
    const activePerkIds = (this.gauntlet.activeRun && this.gauntlet.activeRun.upgrades) ? this.gauntlet.activeRun.upgrades : [];
    
    container.innerHTML = perks.map(p => {
      const isChosen = activePerkIds.includes(p.id);
      return `
        <div class="skill-card-slot" style="padding: 10px; cursor: pointer; border: 1px solid ${isChosen ? '#81c784' : '#4caf50'}; border-radius: 6px; background: ${isChosen ? 'rgba(76, 175, 80, 0.25)' : 'rgba(76, 175, 80, 0.08)'}; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <b style="color: #a5d6a7;">${p.name}</b>
            <button class="sys-icon-btn btn-sm" onclick="app.selectGauntletPerk('${p.id}')" style="padding: 2px 8px; font-size: 0.7rem;">
              ${isChosen ? 'DRAFTED ✓' : 'DRAFT PERK'}
            </button>
          </div>
          <p style="font-size: 0.75rem; color: #c5bcae; margin-top: 4px;">${p.desc}</p>
        </div>
      `;
    }).join('');
  }

  selectGauntletPerk(perkId) {
    if (!this.gauntlet) return;
    if (!this.gauntlet.activeRun) this.gauntlet.startRun();
    this.gauntlet.draftPerk(perkId);
    
    // Apply instant perk buff to player
    if (this.playerFighter) {
      if (perkId === 'kick_power') this.playerFighter.maxHp += 50;
      else if (perkId === 'dodge_reach') this.playerFighter.stamina = this.playerFighter.maxStamina;
      else if (perkId === 'spirit_flow') this.playerFighter.energy = Math.min(this.playerFighter.maxEnergy, this.playerFighter.energy + 30);
      else if (perkId === 'critical_eye') this.playerFighter.rage = Math.min(this.playerFighter.maxRage, this.playerFighter.rage + 25);
    }

    if (window.notifications) window.notifications.show('PERK DRAFTED', `Applied martial boon: ${perkId.replace('_', ' ').toUpperCase()}`, '✨', 'success', 2000);
    this.renderGauntletPerksDraft();
  }

  renderMutatorsCatalog() {
    const container = document.getElementById('mutators-catalog-grid');
    if (!container) return;
    const mutatorsList = typeof LEVEL_MUTATORS !== 'undefined' ? (Array.isArray(LEVEL_MUTATORS) ? LEVEL_MUTATORS : Object.values(LEVEL_MUTATORS)) : [];
    
    container.innerHTML = mutatorsList.map(m => {
      const isActive = this.activeMutator && this.activeMutator.id === m.id;
      return `
        <div class="skill-card-slot" style="padding: 10px; border: 1px solid ${isActive ? '#ffd56b' : '#444'}; border-radius: 6px; background: ${isActive ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)'}; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <b style="color: ${isActive ? '#ffd56b' : '#ddd'}; font-size: 0.85rem;">${m.icon || '⚡'} ${m.name}</b>
            <button class="sys-icon-btn btn-sm" onclick="app.toggleMutator('${m.id}')" style="padding: 2px 8px; font-size: 0.7rem; border-color: ${isActive ? '#ffd56b' : '#666'};">
              ${isActive ? 'ACTIVE ✓' : 'ENABLE'}
            </button>
          </div>
          <p style="font-size: 0.75rem; color: #aaa; margin: 4px 0;">${m.desc}</p>
          <span style="font-size: 0.7rem; color: #81c784;">Reward Multiplier: ${m.multiplier}x</span>
        </div>
      `;
    }).join('');
  }

  toggleMutator(mutatorId) {
    if (this.activeMutator && this.activeMutator.id === mutatorId) {
      this.activeMutator = null;
      if (this.combatEngine) this.combatEngine.applyMutator(null);
      if (window.notifications) window.notifications.show('MUTATOR DISABLED', 'Standard combat rules restored.', '🛡️', 'info', 1600);
    } else if (typeof LEVEL_MUTATORS !== 'undefined' && LEVEL_MUTATORS[mutatorId]) {
      this.activeMutator = LEVEL_MUTATORS[mutatorId];
      if (this.combatEngine) this.combatEngine.applyMutator(this.activeMutator);
      if (window.notifications) window.notifications.show('MUTATOR ACTIVE', `${this.activeMutator.name}: ${this.activeMutator.desc}`, '⚡', 'warning', 2500);
    }
    this.renderMutatorsCatalog();
  }

  // =========================================================================
  // WORLD LORE, FACTIONS & SECRETS MODAL (Specs 316-352)
  // =========================================================================
  openWorldModal() {
    const modal = document.getElementById('world-lore-modal');
    if (!modal) return;
    this.renderMasterTrainers();
    modal.style.display = 'flex';
  }

  renderMasterTrainers() {
    const container = document.getElementById('master-trainer-challenges');
    if (!container || !this.trainerSystem) return;
    const trainers = this.trainerSystem.trainers || [];
    container.innerHTML = trainers.map(t => `
      <div class="skill-card-slot" style="padding: 10px; border: 1px solid #7986cb; border-radius: 6px; background: rgba(121, 134, 203, 0.08); margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <b style="color: #9fa8da;">${t.name}</b>
          <span style="font-size: 0.7rem; color: ${t.completed ? '#81c784' : '#ffd56b'};">${t.completed ? 'MASTERED' : 'INCOMPLETE'}</span>
        </div>
        <p style="font-size: 0.75rem; color: #c5bcae; margin-top: 4px;"><b>Trial:</b> ${t.objective}</p>
        <p style="font-size: 0.72rem; color: #a89476;">Reward: ${t.technique} (+${t.bonusXp} XP)</p>
      </div>
    `).join('');
  }

  // =========================================================================
  // CREDITS & ORIGINAL BRAND IDENTITY MODAL (Specs 353-356)
  // =========================================================================
  openCreditsModal() {
    const modal = document.getElementById('credits-modal');
    if (!modal) return;
    modal.style.display = 'flex';
  }

  // =========================================================================
  // QA & BALANCE DASHBOARD OVERLAY (Specs 370-385)
  // =========================================================================
  toggleQADashboard(show = null) {
    const overlay = document.getElementById('qa-dashboard-overlay');
    if (!overlay) return;
    const willShow = (show !== null) ? show : (overlay.style.display === 'none' || !overlay.style.display);
    overlay.style.display = willShow ? 'block' : 'none';

    if (willShow && this.qaDashboard) {
      const m = this.qaDashboard.getSummaryMetrics();
      const pDps = document.getElementById('qa-p-dps');
      const eDps = document.getElementById('qa-e-dps');
      const fScore = document.getElementById('qa-fairness-score');
      if (pDps) pDps.textContent = m.playerDps || 0;
      if (eDps) eDps.textContent = m.enemyDps || 0;
      if (fScore) fScore.textContent = `${m.fairnessScore || 100} / 100`;
    }
  }

  // Quick Consumable Usage (Spec 194)
  useConsumable(type) {
    if (!this.isInCombat || !this.playerFighter || this.playerFighter.state === 'DEAD') return;
    if ((this.consumables[type] || 0) <= 0) {
      if (window.notifications) window.notifications.show('EMPTY VESSEL', `No ${type} remaining!`, '⚠️', 'warning', 1500);
      return;
    }

    const p = this.playerFighter;
    if (type === 'gourd') {
      p.hp = Math.min(p.maxHp, p.hp + 300);
      this.arena.createHealFx(p.x, p.y - 50);
      if (window.notifications) window.notifications.show('HEALING GOURD', '+300 Health restored', '🍶', 'heal', 1800);
      if (window.soundEngine) window.soundEngine.playBeaconPulse();
    } else if (type === 'elixir') {
      p.energy = Math.min(p.maxEnergy, p.energy + 50);
      this.arena.createEnergySparks(p.x, p.y - 50);
      if (window.notifications) window.notifications.show('SPIRIT ELIXIR', '+50% Special Energy', '🧪', 'energy', 1800);
      if (window.soundEngine) window.soundEngine.playBeaconPulse();
    } else if (type === 'tonic') {
      p.stamina = p.maxStamina;
      p.rage = Math.min(p.maxRage, p.rage + 25);
      this.arena.createArmorSparks(p.x, p.y - 50);
      if (window.notifications) window.notifications.show('TIGER TONIC', 'Stamina filled • +25% Rage', '🍯', 'buff', 1800);
      if (window.soundEngine) window.soundEngine.playTaiko(1.2);
    }

    this.consumables[type]--;
    this.updateConsumablesHud();
  }

  updateConsumablesHud() {
    const gourdCount = document.getElementById('count-gourd');
    const elixirCount = document.getElementById('count-elixir');
    const tonicCount = document.getElementById('count-tonic');

    if (gourdCount) gourdCount.textContent = `x${this.consumables.gourd}`;
    if (elixirCount) elixirCount.textContent = `x${this.consumables.elixir}`;
    if (tonicCount) tonicCount.textContent = `x${this.consumables.tonic}`;
  }

  // Safe Pause Control (Spec 238)
  togglePauseCombat(pause = null) {
    if (!this.isInCombat) return;
    this.isPaused = (pause !== null) ? pause : !this.isPaused;
    if (window.soundEngine) {
      if (this.isPaused) window.soundEngine.duckMusic(true);
      else window.soundEngine.duckMusic(false);
    }
  }

  // Gamepad Controller Polling (Spec 240, 241)
  pollGamepad() {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp) return;

    const p = this.playerFighter;
    if (!p || p.state === 'DEAD') return;

    const deadzone = 0.25;
    const axisX = gp.axes[0] || 0;
    const axisY = gp.axes[1] || 0;

    if (axisX < -deadzone || gp.buttons[14]?.pressed) {
      p.move(-1);
    } else if (axisX > deadzone || gp.buttons[15]?.pressed) {
      p.move(1);
    } else if (p.state === 'WALK') {
      p.stopMoving();
    }

    if ((axisY < -0.5 || gp.buttons[12]?.pressed) && p.isGrounded) {
      p.jump();
    }

    if (axisY > 0.5 || gp.buttons[13]?.pressed) {
      p.crouch();
    } else if (p.isCrouching) {
      p.standUp();
    }

    const dir = this.getCurrentDirection();
    if (gp.buttons[2]?.pressed && !this._prevGpButtons?.[2]) {
      const atk = p.resolveAttack('light', dir);
      p.executeAttack(atk);
    }
    if (gp.buttons[1]?.pressed && !this._prevGpButtons?.[1]) {
      const atk = p.resolveAttack('kick', dir);
      p.executeAttack(atk);
    }
    if (gp.buttons[3]?.pressed && !this._prevGpButtons?.[3]) {
      const atk = p.resolveAttack('heavy', dir);
      p.executeAttack(atk);
    }
    if (gp.buttons[0]?.pressed && !this._prevGpButtons?.[0]) {
      p.dodge();
    }
    if (gp.buttons[4]?.pressed) {
      p.block(true);
    } else if (this._prevGpButtons?.[4]) {
      p.block(false);
    }
    if (gp.buttons[5]?.pressed && !this._prevGpButtons?.[5]) {
      p.executeAttack('special_shadow_dash');
    }
    if (gp.buttons[6]?.pressed && !this._prevGpButtons?.[6]) {
      if (this.combatEngine.enhancements) {
        this.combatEngine.enhancements.executeThrow(p, this.enemyFighter, this.arena, dir);
      }
    }
    if (gp.buttons[7]?.pressed && !this._prevGpButtons?.[7]) {
      if (this.combatEngine.executionAvailable) {
        this.combatEngine.triggerExecution();
      } else {
        p.executeAttack('ultimate_eclipse');
      }
    }

    this._prevGpButtons = gp.buttons.map(b => b.pressed);
  }
}

// Stage Data definition for the 6 story chapters
const STAGES_DATA = [
  {
    id: 1, number: "I", title: "Whispering Bamboo Grove", japanese: "竹林の囁き", subtitle: "Act II • Chapter 1",
    status: "completed", boss: "Ren the Wind-Cutter", bossTitle: "Exiled Ronin Duellist",
    difficulty: "Novice", recommendedCP: 2400, sealChar: "斬", sealMeaning: "Slashed • Vanquished",
    summary: "At dawn, Ronin bandits ambushed our scout party in the bamboo thickets. You cut them down cleanly in a single breath.",
    bossTraits: [{ name: "Wind Dash", desc: "Swift linear lunge." }],
    spoils: [{ name: "600 Gold Koku", icon: "🪙" }], coords: { x: 12, y: 64 }
  },
  {
    id: 2, number: "II", title: "Torii of the Blood Moon", japanese: "血月の鳥居", subtitle: "Act II • Chapter 2",
    status: "completed", boss: "Master Kurokawa", bossTitle: "Leader of Crimson Clan",
    difficulty: "Skilled", recommendedCP: 3200, sealChar: "滅", sealMeaning: "Purged • Annihilated",
    summary: "Ancient mountain shrine grounds soaked in ritual sacrifice. Kurokawa's dual nodachi bled until sundered.",
    bossTraits: [{ name: "Blood Cleave", desc: "Wide horizontal swing." }],
    spoils: [{ name: "1,200 Gold Koku", icon: "🪙" }], coords: { x: 26, y: 36 }
  },
  {
    id: 3, number: "III", title: "Fortress of Weeping Mist", japanese: "哭霧の城塞", subtitle: "Act II • Chapter 3",
    status: "completed", boss: "Lady Osen the Viper", bossTitle: "Shadow Mistress",
    difficulty: "Veteran", recommendedCP: 4100, sealChar: "破", sealMeaning: "Shattered • Broken",
    summary: "A garrison built atop sheer sea cliffs veiled in weeping fog. Lady Osen hurled poisoned kusarigama.",
    bossTraits: [{ name: "Venom Chain", desc: "Ranged chain pull." }],
    spoils: [{ name: "2,400 Gold Koku", icon: "🪙" }], coords: { x: 42, y: 62 }
  },
  {
    id: 4, number: "IV", title: "The Iron Pagoda", japanese: "鋼鉄の五重塔", subtitle: "Act II • Chapter 4 [ACTIVE]",
    status: "active", boss: "Lord Yoshiteru - The Iron Naginata", bossTitle: "Vanguard Executioner",
    difficulty: "LETHAL", recommendedCP: 4920,
    summary: "A sacred wooden sanctuary fortified with heavy black iron plating. The brutal Executioner Yoshiteru wields an eight-foot glaive.",
    bossTraits: [{ name: "Ghost Parry", desc: "Immune to frontal light hits." }, { name: "Earthquake Slam", desc: "Unblockable ground fissure." }],
    spoils: [{ name: "5,000 Gold Koku", icon: "🪙" }, { name: "Dragon Naginata", icon: "⚔️" }], coords: { x: 58, y: 28 }
  },
  {
    id: 5, number: "V", title: "Dragon's Maw Gorge", japanese: "竜顎の峡谷", subtitle: "Act II • Chapter 5 [SEALED]",
    status: "locked", boss: "Dousetsu the Soul-Binder", bossTitle: "High Onmyoji",
    difficulty: "BRUTAL", recommendedCP: 6200,
    summary: "A jagged ravine echoing with demonic chanting. Fallen sorcerers drain the life force of the valley.",
    bossTraits: [{ name: "Curse of Decay", desc: "Reverses player healing." }],
    spoils: [{ name: "8,500 Gold Koku", icon: "🪙" }], coords: { x: 74, y: 64 }
  },
  {
    id: 6, number: "VI", title: "Citadel of the Eclipse", japanese: "日蝕の覇王城", subtitle: "Act II • Climax [FINAL BOSS]",
    status: "boss_locked", boss: "Demon Shogun Kage-No-Hao", bossTitle: "Supreme Sovereign of the Void",
    difficulty: "ABYSSAL HELL", recommendedCP: 8888,
    summary: "The apex citadel soaring into the perpetual eclipse. Clad in black-gold armor forged from meteorites and demon blood.",
    bossTraits: [{ name: "Shadow Domain", desc: "Disables visual indicators." }, { name: "Muramasa Soul Rend", desc: "Lethal void strike." }],
    spoils: [{ name: "Blade of Muramasa Eclipse", icon: "🔥" }], coords: { x: 89, y: 38 }
  }
];

// Start App on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
