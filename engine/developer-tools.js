/**
 * Shadow Samurai - Developer Debug Tools & Content Validator
 * Complies with specifications 148, 149, 232, 233, 234, 252, 253, 254, 255.
 */

class CombatFrameDebugger {
  constructor(combatEngine) {
    this.combatEngine = combatEngine;
    this.isPaused = false;
    this.playbackSpeed = 1.0; // 0.25, 1.0, 2.0
    this.currentFrameIndex = 0;
    this.frameHistory = [];
    this.maxRecordedFrames = 300; // ~5 seconds buffer
    this.showCollisionBoxes = false;
    this.showFrameDataCard = false;
    this.inputHistoryLog = [];
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (window.notifications) {
      window.notifications.show(
        this.isPaused ? 'FRAME DEBUGGER PAUSED' : 'RESUMING DUEL',
        this.isPaused ? 'Step frame-by-frame using [←] [→]' : 'Normal playback speed',
        '⏱️',
        'info',
        1400
      );
    }
    return this.isPaused;
  }

  setSpeed(speed) {
    this.playbackSpeed = speed;
    if (this.combatEngine) {
      this.combatEngine.timeScale = speed;
    }
  }

  stepNextFrame() {
    if (this.isPaused && this.combatEngine) {
      this.combatEngine.update(1 / 60);
      this.recordFrameSnapshot();
    }
  }

  recordFrameSnapshot() {
    if (!this.combatEngine.player || !this.combatEngine.enemy) return;

    const p = this.combatEngine.player;
    const e = this.combatEngine.enemy;

    const snapshot = {
      frame: this.currentFrameIndex++,
      player: {
        x: Math.round(p.x),
        y: Math.round(p.y),
        state: p.state,
        attackFrame: p.attackFrame,
        attackPhase: p.attackPhase,
        hp: p.hp,
        stamina: Math.round(p.stamina),
        guard: Math.round(p.guard),
        poise: p.poise || 100
      },
      enemy: {
        x: Math.round(e.x),
        y: Math.round(e.y),
        state: e.state,
        attackFrame: e.attackFrame,
        hp: e.hp,
        stamina: Math.round(e.stamina),
        guard: Math.round(e.guard),
        poise: e.poise || 100
      }
    };

    this.frameHistory.push(snapshot);
    if (this.frameHistory.length > this.maxRecordedFrames) {
      this.frameHistory.shift();
    }
  }

  logInput(action, direction) {
    this.inputHistoryLog.unshift({
      action,
      direction,
      frame: this.currentFrameIndex,
      time: new Date().toLocaleTimeString()
    });
    if (this.inputHistoryLog.length > 12) {
      this.inputHistoryLog.pop();
    }
  }

  // Export Telemetry & Frame Data to JSON / CSV (Spec 232)
  exportTelemetry(format = 'json') {
    const data = {
      gameVersion: '2.1.0',
      timestamp: Date.now(),
      telemetry: this.combatEngine.telemetry,
      frameHistory: this.frameHistory,
      inputHistory: this.inputHistoryLog
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadow_samurai_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV format
      let csv = 'Frame,PlayerState,PlayerHP,PlayerStamina,EnemyState,EnemyHP,EnemyGuard\n';
      this.frameHistory.forEach(f => {
        csv += `${f.frame},${f.player.state},${f.player.hp},${f.player.stamina},${f.enemy.state},${f.enemy.hp},${f.enemy.guard}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadow_samurai_telemetry_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}

// ============================================================================
// CONTENT & DATA VALIDATOR (Spec 252, 253, 254, 255)
// Scans for duplicate IDs, missing references, invalid damage, negative stats
// ============================================================================
class ContentValidator {
  static validateAll() {
    const report = {
      valid: true,
      isValid: true,
      errors: [],
      warnings: [],
      itemsScanned: 0,
      attacksChecked: 0,
      weaponsChecked: 0,
      stylesChecked: 0,
      enemiesChecked: 0
    };

    const seenIds = new Set();
    const combatData = typeof COMBAT_DATA !== 'undefined' ? COMBAT_DATA :
                       (typeof window !== 'undefined' ? window.COMBAT_DATA :
                       (typeof global !== 'undefined' ? global.COMBAT_DATA : null));

    function checkUniqueId(id, category) {
      report.itemsScanned++;
      if (!id || typeof id !== 'string') {
        report.errors.push(`[${category}] Missing or invalid ID field.`);
        report.valid = false;
        report.isValid = false;
        return;
      }
      if (seenIds.has(id)) {
        report.errors.push(`[${category}] Duplicate unique ID detected: "${id}".`);
        report.valid = false;
        report.isValid = false;
      } else {
        seenIds.add(id);
      }
    }

    // 1. Validate Attacks (Spec 71, 255)
    if (combatData && combatData.ATTACKS) {
      Object.keys(combatData.ATTACKS).forEach(key => {
        const atk = combatData.ATTACKS[key];
        report.attacksChecked++;
        checkUniqueId(atk.id, 'ATTACKS');

        if (atk.damage < 0) report.errors.push(`Attack "${atk.id}" has negative damage (${atk.damage}).`);
        if (atk.staminaCost < 0) report.errors.push(`Attack "${atk.id}" has negative stamina cost.`);
        if (atk.startup < 0 || atk.active < 0 || atk.recovery < 0) {
          report.errors.push(`Attack "${atk.id}" has invalid negative frame data.`);
        }
      });
    } else {
      report.errors.push('COMBAT_DATA.ATTACKS is missing or undefined.');
      report.valid = false;
      report.isValid = false;
    }

    // 2. Validate Weapons (Spec 83)
    if (combatData && combatData.WEAPONS) {
      Object.keys(combatData.WEAPONS).forEach(key => {
        const w = combatData.WEAPONS[key];
        report.weaponsChecked++;
        checkUniqueId(w.id, 'WEAPONS');
        if (w.damageMod <= 0) report.errors.push(`Weapon "${w.id}" has non-positive damage modifier.`);
        if (w.durabilityMax <= 0) report.errors.push(`Weapon "${w.id}" has invalid durabilityMax.`);
      });
    }

    // 3. Validate Styles (Spec 87)
    if (combatData && combatData.STYLES) {
      Object.keys(combatData.STYLES).forEach(key => {
        const s = combatData.STYLES[key];
        report.stylesChecked++;
        checkUniqueId(s.id, 'STYLES');
      });
    }

    // 4. Validate Enemies / Personalities (Spec 89, 93)
    if (combatData && combatData.AI_PERSONALITIES) {
      Object.keys(combatData.AI_PERSONALITIES).forEach(key => {
        const p = combatData.AI_PERSONALITIES[key];
        report.enemiesChecked++;
        checkUniqueId(p.id || key, 'PERSONALITIES');
      });
    }

    // 5. Validate Combos (Spec 72)
    if (combatData && combatData.COMBOS) {
      combatData.COMBOS.forEach(c => {
        checkUniqueId(c.id, 'COMBOS');
        if (!Array.isArray(c.sequence) || c.sequence.length < 2) {
          report.errors.push(`Combo "${c.id}" has invalid attack sequence.`);
        }
      });
    }

    // 6. Validate Achievements (Spec 97)
    if (typeof RPGSystem !== 'undefined') {
      const rpg = new RPGSystem();
      if (rpg.achievements) {
        rpg.achievements.forEach(a => {
          checkUniqueId(a.id, 'ACHIEVEMENTS');
          if (a.rewardGold < 0) report.errors.push(`Achievement "${a.id}" has negative reward.`);
        });
      }
    }

    if (report.errors.length > 0) {
      report.valid = false;
      report.isValid = false;
      console.error('[ContentValidator] Integrity scan found issues:', report.errors);
    } else {
      console.log(`[ContentValidator] Integrity scan PASSED! ${report.itemsScanned} elements verified without error.`);
    }

    return report;
  }

  static runIntegrityScan() {
    return this.validateAll();
  }
}

// ============================================================================
// AUTOMATED BALANCE TESTER & AI SIMULATION MODE (Spec 233, 234)
// ============================================================================
class BalanceSimulator {
  static runHeadlessDuelSimulation(styleA = 'dragon', styleB = 'shadow', numRounds = 5) {
    const results = {
      roundsPlayed: numRounds,
      winsA: 0,
      winsB: 0,
      averageDurationFrames: 0,
      damageDealtA: 0,
      damageDealtB: 0
    };

    let totalFrames = 0;

    for (let r = 0; r < numRounds; r++) {
      const dummyArena = { groundY: 420, x: 0, width: 1280, height: 720 };
      const fighterA = new Fighter({ isPlayer: true, name: 'Combatant A', style: styleA, x: 400 });
      const fighterB = new Fighter({ isPlayer: false, name: 'Combatant B', style: styleB, x: 700 });

      let frames = 0;
      while (fighterA.hp > 0 && fighterB.hp > 0 && frames < 1800) {
        frames++;

        // Basic AI attack decisions
        if (fighterA.state === 'IDLE' && Math.random() < 0.25) {
          fighterA.executeAttack('light_1');
        }
        if (fighterB.state === 'IDLE' && Math.random() < 0.25) {
          fighterB.executeAttack('light_2');
        }

        fighterA.update(1 / 60, dummyArena);
        fighterB.update(1 / 60, dummyArena);
      }

      totalFrames += frames;
      if (fighterA.hp > fighterB.hp) results.winsA++;
      else results.winsB++;
    }

    results.averageDurationFrames = Math.round(totalFrames / numRounds);
    return results;
  }
}
const _devRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);

_devRoot.CombatFrameDebugger = CombatFrameDebugger;
_devRoot.ContentValidator = ContentValidator;
_devRoot.BalanceSimulator = BalanceSimulator;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CombatFrameDebugger,
    ContentValidator,
    BalanceSimulator
  };
}
