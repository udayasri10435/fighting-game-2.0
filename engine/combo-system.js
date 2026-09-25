/**
 * Shadow Samurai - Professional Combo Engine
 * Tracks combo inputs, sequences, branch detection, combo counter, damage scaling,
 * combo tiers, combo break, combo reset, and unlockable combo database.
 * Complies with specification 72.
 */

class ComboEngine {
  constructor() {
    this.hitCount = 0;
    this.maxCombo = 0;
    this.totalComboDamage = 0;
    this.timer = 0;
    this.maxTimer = COMBAT_DATA.CONFIG.COMBO_TIMEOUT;
    this.attackHistory = []; // Recent attack IDs
    this.discoveredCombos = new Set(['combo_swift_cleave', 'combo_shadow_flurry', 'combo_sky_fall', 'combo_counter_vendetta']);
    this.unlockedCombos = new Set(['combo_swift_cleave', 'combo_shadow_flurry', 'combo_sky_fall', 'combo_counter_vendetta']);
    
    // Listeners for UI popups
    this.onComboHit = null;
    this.onComboTier = null;
    this.onComboComplete = null;
    this.onComboDiscovered = null;
  }

  // Called when an attack cleanly hits opponent
  recordHit(attacker, attack, damage, isCrit = false) {
    this.hitCount++;
    this.totalComboDamage += damage;
    this.timer = this.maxTimer;

    if (this.hitCount > this.maxCombo) {
      this.maxCombo = this.hitCount;
    }

    this.attackHistory.push(attack.id);
    if (this.attackHistory.length > 6) {
      this.attackHistory.shift();
    }

    // Check for recipe matches in Combo Database (Spec 72)
    const matchedCombo = this.checkRecipeMatch();
    if (matchedCombo) {
      this.handleMatchedCombo(matchedCombo, attacker);
    }

    // Determine current Combo Tier (Spec 72)
    const currentTier = this.getCurrentTier();

    // Trigger UI Callback
    if (this.onComboHit) {
      this.onComboHit({
        hits: this.hitCount,
        damage: this.totalComboDamage,
        tier: currentTier,
        isCrit,
        matchedCombo
      });
    }

    return {
      hits: this.hitCount,
      damage: this.totalComboDamage,
      tier: currentTier,
      matchedCombo
    };
  }

  get currentCombo() {
    return this.hitCount;
  }

  // Extend combo timing with special abilities (Spec 282)
  extendComboTimer(bonusFrames = 45) {
    this.timer = Math.min(this.maxTimer * 1.8, this.timer + bonusFrames);
  }

  // Update combo timer every frame with forgiving decay (Spec 282)
  update() {
    if (this.hitCount > 0) {
      this.timer--;
      if (this.timer <= 0) {
        if (this.hitCount > 3) {
          // Graceful decay: decreases hitCount step-by-step
          this.hitCount = Math.max(0, this.hitCount - 1);
          this.timer = 35; // Brief buffer before next decay step
        } else {
          this.resetCombo('timeout');
        }
      }
    }
  }

  // Interrupt combo (e.g. Player hit by opponent)
  breakCombo(reason = 'interrupted') {
    if (this.hitCount > 0) {
      this.resetCombo('break');
    }
  }

  resetCombo(reason) {
    if (this.hitCount >= 2 && this.onComboComplete) {
      this.onComboComplete({
        hits: this.hitCount,
        totalDamage: this.totalComboDamage,
        reason
      });
    }
    this.hitCount = 0;
    this.totalComboDamage = 0;
    this.timer = 0;
    this.attackHistory = [];
  }

  // Check if recent attacks match any defined combo recipes (Spec 72)
  checkRecipeMatch() {
    for (const combo of COMBAT_DATA.COMBOS) {
      const seq = combo.sequence;
      if (this.attackHistory.length >= seq.length) {
        const slice = this.attackHistory.slice(-seq.length);
        const match = seq.every((val, idx) => val === slice[idx]);
        if (match) return combo;
      }
    }
    return null;
  }

  handleMatchedCombo(combo, attacker) {
    // Reward bonus energy on triggering combos
    attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 18);

    if (!this.discoveredCombos.has(combo.id)) {
      this.discoveredCombos.add(combo.id);
      this.unlockedCombos.add(combo.id);

      if (this.onComboDiscovered) {
        this.onComboDiscovered(combo);
      }
      if (window.soundEngine) {
        window.soundEngine.playTempleGong();
      }
    }
  }

  getCurrentTier() {
    let tierFound = COMBAT_DATA.COMBO_TIERS[0];
    for (const tier of COMBAT_DATA.COMBO_TIERS) {
      if (this.hitCount >= tier.hits) {
        tierFound = tier;
      }
    }
    return tierFound;
  }

  // Progression & Unlock System (Spec 72)
  isComboUnlocked(comboId) {
    return this.unlockedCombos.has(comboId);
  }

  unlockCombo(comboId) {
    this.unlockedCombos.add(comboId);
    this.discoveredCombos.add(comboId);
  }

  getAllCombos() {
    return COMBAT_DATA.COMBOS.map(c => ({
      ...c,
      isUnlocked: this.unlockedCombos.has(c.id),
      isDiscovered: this.discoveredCombos.has(c.id)
    }));
  }
}

window.ComboEngine = ComboEngine;
