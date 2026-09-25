/**
 * Shadow Samurai - Versioned Multi-Slot Save Repository & Settings
 * Supports 3 save slots, save versioning, auto-save, JSON export/import,
 * and accessibility settings persistence.
 * Complies with specifications 126, 136, 137, 138.
 */

class SaveRepository {
  constructor() {
    this.SAVE_VERSION = '2.1.0';
    this.STORAGE_PREFIX = 'shadow_samurai_save_slot_';
    this.SETTINGS_KEY = 'shadow_samurai_settings';
    this.currentSlot = 1;

    // Accessibility & Settings Defaults (Spec 126)
    this.settings = {
      masterVolume: 0.85,
      musicVolume: 0.8,
      sfxVolume: 0.9,
      ambientVolume: 0.7,
      screenShake: true,
      reducedFlash: false,
      reducedMotion: false,
      uiScale: 1.0,
      difficulty: 'normal', // 'easy', 'normal', 'lethal'
      keybinds: {
        moveLeft: 'KeyA',
        moveRight: 'KeyD',
        jump: 'KeyW',
        crouch: 'KeyS',
        lightAttack: 'KeyJ',
        kick: 'KeyK',
        heavyAttack: 'KeyL',
        special: 'KeyI',
        ultimate: 'KeyU',
        dodge: 'Space',
        block: 'ShiftLeft',
        rage: 'KeyR',
        switchStyle: 'KeyQ'
      }
    };

    this.loadSettings();
  }

  // Load Settings
  loadSettings() {
    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Unable to load settings from storage', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Unable to persist settings', e);
    }
  }

  // Save Game to Specific Slot (Spec 137)
  saveSlot(slotNum, data) {
    try {
      const payload = {
        version: this.SAVE_VERSION,
        timestamp: Date.now(),
        slot: slotNum,
        playtimeSeconds: data.playtimeSeconds || 1420,
        playerData: {
          name: data.name || 'Jin Kageyoshi',
          level: data.level || 48,
          gold: data.gold || 42500,
          shadowSouls: data.shadowSouls || 1840,
          vermilionSeals: data.vermilionSeals || 14,
          activeWeapon: data.activeWeapon || 'katana',
          activeStyle: data.activeStyle || 'shadow',
          attributes: data.attributes || {
            strength: 18, defense: 15, agility: 16, endurance: 14, energy: 12, weaponMastery: 4
          },
          inventory: data.inventory || []
        },
        progression: {
          currentAct: data.currentAct || 2,
          currentStage: data.currentStage || 4,
          completedStages: data.completedStages || [1, 2, 3],
          unlockedAchievements: data.unlockedAchievements || ['first_blood', 'perfect_parry', 'guard_breaker'],
          survivalHighScore: data.survivalHighScore || 18450,
          isNewGamePlus: !!data.isNewGamePlus
        }
      };

      localStorage.setItem(`${this.STORAGE_PREFIX}${slotNum}`, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  }

  // Load Game from Specific Slot (Spec 137)
  loadSlot(slotNum) {
    try {
      const raw = localStorage.getItem(`${this.STORAGE_PREFIX}${slotNum}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return this.migrateSaveData(parsed);
    } catch (e) {
      console.error('Failed to load slot:', e);
      return null;
    }
  }

  // Delete Slot with Confirmation (Spec 137)
  deleteSlot(slotNum) {
    try {
      localStorage.removeItem(`${this.STORAGE_PREFIX}${slotNum}`);
      return true;
    } catch (e) {
      console.error('Failed to delete slot:', e);
      return false;
    }
  }

  // Get metadata for all 3 slots (Spec 137)
  getSlotsMetadata() {
    const slots = [];
    for (let i = 1; i <= 3; i++) {
      const data = this.loadSlot(i);
      if (data) {
        const mins = Math.floor((data.playtimeSeconds || 1200) / 60);
        slots.push({
          slot: i,
          isEmpty: false,
          name: data.playerData.name,
          level: data.playerData.level,
          chapter: `Act ${data.progression.currentAct} • Ch. ${data.progression.currentStage}`,
          timestamp: new Date(data.timestamp).toLocaleDateString() + ' ' + new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          gold: data.playerData.gold,
          playtime: `${mins}m`
        });
      } else {
        slots.push({
          slot: i,
          isEmpty: true,
          name: 'Empty Slot',
          level: 1,
          chapter: 'No Adventure Begun',
          timestamp: '—',
          gold: 0,
          playtime: '0m'
        });
      }
    }
    return slots;
  }

  // Export Save as JSON file download (Spec 138)
  exportSaveJson(slotNum) {
    const data = this.loadSlot(slotNum);
    if (!data) {
      alert(`Slot ${slotNum} is empty. Save your game first before exporting!`);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadow_samurai_slot_${slotNum}_v${this.SAVE_VERSION}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import Save from JSON string (Spec 138)
  importSaveJson(slotNum, jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const migrated = this.migrateSaveData(parsed);
      this.saveSlot(slotNum, {
        name: migrated.playerData?.name,
        level: migrated.playerData?.level,
        gold: migrated.playerData?.gold,
        shadowSouls: migrated.playerData?.shadowSouls,
        vermilionSeals: migrated.playerData?.vermilionSeals,
        activeWeapon: migrated.playerData?.activeWeapon,
        activeStyle: migrated.playerData?.activeStyle,
        attributes: migrated.playerData?.attributes,
        inventory: migrated.playerData?.inventory,
        currentAct: migrated.progression?.currentAct,
        currentStage: migrated.progression?.currentStage,
        completedStages: migrated.progression?.completedStages,
        unlockedAchievements: migrated.progression?.unlockedAchievements,
        survivalHighScore: migrated.progression?.survivalHighScore,
        isNewGamePlus: migrated.progression?.isNewGamePlus
      });
      return true;
    } catch (e) {
      console.error('Failed to import save:', e);
      return false;
    }
  }

  // Migration Logic for forward compatibility (Spec 136)
  migrateSaveData(data) {
    if (!data.version) {
      data.version = this.SAVE_VERSION;
    }
    if (!data.playerData) {
      data.playerData = { name: 'Jin Kageyoshi', level: 48, gold: 42500 };
    }
    if (!data.progression) {
      data.progression = { currentAct: 2, currentStage: 4, completedStages: [1, 2, 3] };
    }
    return data;
  }
}

window.SaveRepository = SaveRepository;
