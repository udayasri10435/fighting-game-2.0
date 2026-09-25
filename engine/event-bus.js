/**
 * Shadow Samurai - Central Event Bus, Game State Machine, Localization & Notification Queue
 * Complies with specifications 182, 183, 184, 244, 245, 246, 247, 256, 258.
 */

// ============================================================================
// 1. EVENT BUS (Spec 182)
// ============================================================================
class GameEventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err);
        }
      });
    }
  }

  clear() {
    this.listeners.clear();
  }
}

// Safe global environment helper
const _root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);

// Global EventBus Singleton
_root.eventBus = new GameEventBus();

// ============================================================================
// 2. GLOBAL GAME STATE MACHINE (Spec 183, 184)
// ============================================================================
class GameStateMachine {
  constructor() {
    this.states = [
      'BOOT',
      'MAIN_MENU',
      'HUB',
      'MAP',
      'PRE_BATTLE',
      'COMBAT',
      'PAUSE',
      'VICTORY',
      'DEFEAT',
      'SETTINGS',
      'GALLERY',
      'TRAINING'
    ];
    this.currentState = 'BOOT';
    this.previousState = null;
    this.stateData = {};
  }

  setState(newState, data = {}) {
    if (!this.states.includes(newState)) {
      console.warn(`[StateMachine] Unknown state: ${newState}`);
      return false;
    }

    if (this.currentState === newState) return false;

    const oldState = this.currentState;
    this.previousState = oldState;
    this.currentState = newState;
    this.stateData = data;

    // Emit state transition
    window.eventBus.emit('OnGameStateChange', {
      from: oldState,
      to: newState,
      data
    });

    return true;
  }

  is(state) {
    return this.currentState === state;
  }

  revert() {
    if (this.previousState) {
      this.setState(this.previousState);
    }
  }
}

_root.gameState = new GameStateMachine();

// ============================================================================
// 3. TOAST NOTIFICATION QUEUE (Spec 258)
// ============================================================================
class NotificationQueue {
  constructor() {
    this.queue = [];
    this.isDisplaying = false;
    this.container = null;
  }

  ensureContainer() {
    if (!this.container && typeof document !== 'undefined') {
      let el = document.getElementById('game-toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'game-toast-container';
        el.className = 'game-toast-container';
        const viewport = document.getElementById('aspect-stage') || document.body;
        viewport.appendChild(el);
      }
      this.container = el;
    }
    return this.container;
  }

  show(title, message, icon = '📜', type = 'info', duration = 3200) {
    this.queue.push({ title, message, icon, type, duration });
    if (!this.isDisplaying) {
      this.processQueue();
    }
  }

  processQueue() {
    if (this.queue.length === 0) {
      this.isDisplaying = false;
      return;
    }

    this.isDisplaying = true;
    const item = this.queue.shift();
    const container = this.ensureContainer();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `game-toast-card toast-${item.type}`;
    toast.innerHTML = `
      <span class="toast-icon">${item.icon}</span>
      <div class="toast-body">
        <h4 class="toast-title">${item.title}</h4>
        <p class="toast-desc">${item.message}</p>
      </div>
    `;

    container.appendChild(toast);

    // Audio chime
    if (window.soundEngine && typeof window.soundEngine.playTaiko === 'function') {
      window.soundEngine.playTaiko(0.6);
    }

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
        this.processQueue();
      }, 350);
    }, item.duration);
  }
}

_root.notifications = new NotificationQueue();

// ============================================================================
// 4. MULTILINGUAL LOCALIZATION PIPELINE (Spec 244, 245, 246)
// English, Sinhala (සිංහල), and Tamil (தமிழ்)
// ============================================================================
const LOCALIZATION_DICTIONARY = {
  en: {
    // Top Nav & System
    MENU_HUB: '⛩️ HUB',
    MENU_MAP: '📜 MAP',
    MENU_MODES: '🏆 MODES',
    MENU_FORGE: '⚒️ FORGE',
    MENU_BAZAAR: '🛍️ BAZAAR',
    MENU_GEAR: '🎒 GEAR',
    MENU_COMBOS: '📖 COMBOS',
    MENU_QUESTS: '📜 QUESTS',
    MENU_CODEX: '📖 CODEX',
    MENU_AWARDS: '🎖️ AWARDS',
    MENU_SAVES: '💾 SAVES',
    MENU_PROFILE: '👤 PROFILE',
    MENU_SETTINGS: '⚙️ SETTINGS',
    
    // Combat UI
    COMBAT_COMMENCE: 'COMMENCE DUEL',
    COMBAT_RETREAT: 'ESC • RETREAT',
    COMBAT_VS: 'VS',
    COMBAT_LIGHT: 'J • LIGHT',
    COMBAT_KICK: 'K • KICK',
    COMBAT_HEAVY: 'L • HEAVY',
    COMBAT_SPECIAL: 'I • SPECIAL',
    COMBAT_ULTIMATE: 'U • ULTIMATE',
    COMBAT_DODGE: 'SPACE • DODGE',
    COMBAT_BLOCK: 'SHIFT • BLOCK',
    COMBAT_GRAB: 'G • THROW',
    COMBAT_STYLE: 'Q • STYLE',
    COMBAT_RAGE: 'RAGE READY [R]',
    COMBAT_EXECUTION: 'EXECUTION WINDOW OPEN — PRESS [U]',
    COMBAT_WEAPON_CLASH: 'WEAPON CLASH!',
    COMBAT_PERFECT_PARRY: 'PERFECT PARRY!',
    COMBAT_PERFECT_DODGE: 'PERFECT DODGE!',
    COMBAT_GUARD_BREAK: 'GUARD BROKEN!',
    
    // Results
    RESULT_VICTORY: 'VICTORY',
    RESULT_DEFEAT: 'DEFEATED',
    RESULT_CONTINUE: 'CONTINUE JOURNEY',
    RESULT_RETRY: 'RETRY DUEL',
    RESULT_SCORE: 'SCORE',
    RESULT_TIME: 'DUEL TIME',
    
    // Hub
    HUB_TITLE: 'THE FORGOTTEN DOJO',
    HUB_SUBTITLE: 'SANCTUARY OF THE SILENT VEIL',
    ATTR_POINTS: 'ATTRIBUTE POINTS'
  },
  si: {
    // Sinhala (සිංහල)
    MENU_HUB: '⛩️ කඳවුර',
    MENU_MAP: '📜 සිතියම',
    MENU_MODES: '🏆 ක්‍රම',
    MENU_FORGE: '⚒️ කම්මල',
    MENU_BAZAAR: '🛍️ පොළ',
    MENU_GEAR: '🎒 ආයුධ',
    MENU_COMBOS: '📖 සංයෝජන',
    MENU_QUESTS: '📜 අභියෝග',
    MENU_CODEX: '📖 ලේඛන',
    MENU_AWARDS: '🎖️ සම්මාන',
    MENU_SAVES: '💾 සුරැකුම්',
    MENU_PROFILE: '👤 පැතිකඩ',
    MENU_SETTINGS: '⚙️ සැකසුම්',
    
    COMBAT_COMMENCE: 'සටන අරඹන්න',
    COMBAT_RETREAT: 'පසුබසින්න',
    COMBAT_VS: 'එදිරිව',
    COMBAT_LIGHT: 'J • පහර',
    COMBAT_KICK: 'K • පාපහර',
    COMBAT_HEAVY: 'L • බර පහර',
    COMBAT_SPECIAL: 'I • විශේෂ',
    COMBAT_ULTIMATE: 'U • මහා ප්‍රහාරය',
    COMBAT_DODGE: 'SPACE • මඟහරින්න',
    COMBAT_BLOCK: 'SHIFT • වළකන්න',
    COMBAT_GRAB: 'G • අල්ලා විසි කරන්න',
    COMBAT_STYLE: 'Q • විලාසය',
    COMBAT_RAGE: 'කෝපය සූදානම් [R]',
    COMBAT_EXECUTION: 'අවසන් පහර සඳහා [U] ඔබන්න',
    COMBAT_WEAPON_CLASH: 'ආයුධ ගැටුම!',
    COMBAT_PERFECT_PARRY: 'විශිෂ්ට රැකවරණය!',
    COMBAT_PERFECT_DODGE: 'විශිෂ්ට මඟහැරීම!',
    COMBAT_GUARD_BREAK: 'ආවරණය බිඳුණි!',
    
    RESULT_VICTORY: 'ජයග්‍රහණයයි',
    RESULT_DEFEAT: 'පරාජය විය',
    RESULT_CONTINUE: 'ඉදිරියට යන්න',
    RESULT_RETRY: 'නැවත උත්සාහ කරන්න',
    RESULT_SCORE: 'ලකුණු',
    RESULT_TIME: 'ගතවූ කාලය',
    
    HUB_TITLE: 'අමතක වූ දෝජෝව',
    HUB_SUBTITLE: 'නිහඬ සෙවණැලි අභයභූමිය',
    ATTR_POINTS: 'ලබාගත හැකි ලකුණු'
  },
  ta: {
    // Tamil (தமிழ்)
    MENU_HUB: '⛩️ பாசறை',
    MENU_MAP: '📜 வரைபடம்',
    MENU_MODES: '🏆 களங்கள்',
    MENU_FORGE: '⚒️ பட்டறை',
    MENU_BAZAAR: '🛍️ சந்தை',
    MENU_GEAR: '🎒 கருவிகள்',
    MENU_COMBOS: '📖 வரிசைகள்',
    MENU_QUESTS: '📜 இலக்குகள்',
    MENU_CODEX: '📖 ஏடுகள்',
    MENU_AWARDS: '🎖️ விருதுகள்',
    MENU_SAVES: '💾 பதிவுகள்',
    MENU_PROFILE: '👤 சுயவிவரம்',
    MENU_SETTINGS: '⚙️ அமைப்புகள்',
    
    COMBAT_COMMENCE: 'போரைத் தொடங்கு',
    COMBAT_RETREAT: 'பின்வாங்கு',
    COMBAT_VS: 'எதிர்',
    COMBAT_LIGHT: 'J • எளிய அடி',
    COMBAT_KICK: 'K • உதை',
    COMBAT_HEAVY: 'L • பலத்த அடி',
    COMBAT_SPECIAL: 'I • சிறப்பு',
    COMBAT_ULTIMATE: 'U • உச்சப்போர்',
    COMBAT_DODGE: 'SPACE • தவிர்',
    COMBAT_BLOCK: 'SHIFT • தடு',
    COMBAT_GRAB: 'G • பிடித்து வீசு',
    COMBAT_STYLE: 'Q • பாணி',
    COMBAT_RAGE: 'சீற்றம் தயார் [R]',
    COMBAT_EXECUTION: 'மரண அடிக்கு [U] அழுத்தவும்',
    COMBAT_WEAPON_CLASH: 'ஆயுத மோதல்!',
    COMBAT_PERFECT_PARRY: 'துல்லியத் தடுப்பு!',
    COMBAT_PERFECT_DODGE: 'துல்லிய விலகல்!',
    COMBAT_GUARD_BREAK: 'தடுப்பு உடைந்தது!',
    
    RESULT_VICTORY: 'வெற்றி',
    RESULT_DEFEAT: 'தோல்வி',
    RESULT_CONTINUE: 'தொடர்க',
    RESULT_RETRY: 'மீண்டும் முயல்க',
    RESULT_SCORE: 'மதிப்பெண்',
    RESULT_TIME: 'போர் நேரம்',
    
    HUB_TITLE: 'மறக்கப்பட்ட பாசறை',
    HUB_SUBTITLE: 'அமைதி நிழல் புகலிடம்',
    ATTR_POINTS: 'திறன் புள்ளிகள்'
  }
};

class LocalizationManager {
  constructor() {
    this.currentLocale = 'en';
    this.dictionary = LOCALIZATION_DICTIONARY;
  }

  setLocale(locale) {
    if (this.dictionary[locale]) {
      this.currentLocale = locale;
      window.eventBus.emit('OnLocaleChanged', { locale });
      this.updateDomTranslations();
      return true;
    }
    return false;
  }

  t(key, fallback = '') {
    const table = this.dictionary[this.currentLocale] || this.dictionary.en;
    return table[key] || this.dictionary.en[key] || fallback || key;
  }

  updateDomTranslations() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    const elements = document.querySelectorAll('[data-i18n]');
    if (elements && elements.forEach) {
      elements.forEach(el => {
        const key = el.getAttribute ? el.getAttribute('data-i18n') : null;
        if (key) {
          el.textContent = this.t(key);
        }
      });
    }
  }
}

_root.loc = new LocalizationManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameEventBus,
    eventBus: _root.eventBus,
    GameStateMachine,
    gameState: _root.gameState,
    NotificationQueue,
    notifications: _root.notifications,
    LOCALIZATION_DICTIONARY,
    LocalizationManager,
    loc: _root.loc
  };
}
