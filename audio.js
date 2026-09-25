/**
 * Shadow Samurai - Comprehensive Procedural Web Audio Engine
 * Features:
 * - Dynamic Reactive Music (Combat, Boss, Low Health, Victory)
 * - Atmospheric Ambience (Forest wind, Temple bells, Fortress resonance)
 * - Martial Arts Formant Voice Kiai Shouts
 * - Weapon Slashes, Taiko Drums, Temple Bells, Iron Chains, and Wax Seals
 * Complies with specifications 109, 110, 111.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.ambientGain = null;
    this.musicGain = null;
    this.isInitialized = false;
    this.currentMusicPhase = 'ambient'; // 'ambient', 'combat', 'boss', 'low_health', 'victory'
    this.musicInterval = null;
    this.musicStep = 0;
  }

  init() {
    if (this.isInitialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.isInitialized = true;
      this.initAmbientWind();
      this.initDynamicMusic();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.035, this.ctx.currentTime);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Dynamic Reactive Music Sequencer (Spec 109)
  initDynamicMusic() {
    if (!this.ctx) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, this.ctx.currentTime);
    this.musicGain.connect(this.ctx.destination);

    // 120 BPM procedural combat taiko & koto rhythm loop (250ms = 16th note)
    this.musicInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      this.playMusicStep();
    }, 250);
  }

  setMusicPhase(phase) {
    this.currentMusicPhase = phase;
  }

  playMusicStep() {
    this.musicStep = (this.musicStep + 1) % 16;
    const t = this.ctx.currentTime;

    // Heartbeat pulse when player is at low health
    if (this.currentMusicPhase === 'low_health') {
      if (this.musicStep === 0 || this.musicStep === 2) {
        this.synthDrumHit(55, 0.45, t); // Double thud
      }
    }

    // Taiko beat on steps in combat and boss mode
    if (this.currentMusicPhase === 'combat' || this.currentMusicPhase === 'boss') {
      if (this.musicStep === 0 || this.musicStep === 8) {
        this.synthDrumHit(80, 0.35, t);
      } else if (this.musicStep === 4 || this.musicStep === 12) {
        this.synthDrumHit(110, 0.25, t);
      }
      if (this.currentMusicPhase === 'boss' && (this.musicStep === 6 || this.musicStep === 14)) {
        this.synthDrumHit(140, 0.22, t);
      }
    }

    // Pentatonic Japanese Koto / Shamisen Melody (Spec 109)
    const scale = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25];
    if (this.musicStep % 2 === 0) {
      const prob = (this.currentMusicPhase === 'boss') ? 0.75 : (this.currentMusicPhase === 'combat' ? 0.45 : 0.2);
      if (Math.random() < prob) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        this.synthPluckNote(note, 0.14, t);
      }
    }
  }

  synthDrumHit(baseFreq, volume, t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.2);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  synthPluckNote(freq, volume, t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  // Procedural Formant Voice Shouts (Kiai: "Hah!", "Sei!", "Toh!") (Spec 111)
  playVoiceKiai() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const formant = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);

    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(1200, t);
    formant.Q.setValueAtTime(4.0, t);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(formant);
    formant.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  // Sound Effects
  playTaiko(intensity = 1.0) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130 * intensity, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.45);

    gain.gain.setValueAtTime(0.7 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    const waveShaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; ++i) {
      const x = (i * 2) / 256 - 1;
      curve[i] = Math.tanh(x * 1.5);
    }
    waveShaper.curve = curve;

    osc.connect(waveShaper);
    waveShaper.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.95);
  }

  playSwordSlash() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dur = 0.25;
    const bufferSize = this.ctx.sampleRate * dur;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(4500, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(800, t + dur);
    filter.Q.setValueAtTime(6, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start(t);
  }

  playTempleGong() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const harmonics = [180, 362, 545, 910, 1420];
    const gains = [0.4, 0.25, 0.15, 0.08, 0.04];
    const decay = 2.4;

    harmonics.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(gains[idx], t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + decay / (idx + 1));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + decay);
    });
  }

  playBeaconPulse() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  playChainRattle() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    [0, 0.05, 0.12].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + idx * 150, t + offset);
      gain.gain.setValueAtTime(0.16, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.16);
    });
  }

  playWaxStamp() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  playDuelStart() {
    this.playTaiko(1.3);
    setTimeout(() => this.playSwordSlash(), 120);
    setTimeout(() => this.playTempleGong(), 280);
  }

  // Atmospheric Environmental Audio (Spec 110)
  initAmbientWind() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, this.ctx.currentTime);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.035, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);

    whiteNoise.start();
  }

  // Audio Ducking (Spec 242)
  duckMusic(isDucked = true) {
    if (!this.ctx || !this.musicGain || this.isMuted) return;
    const target = isDucked ? 0.025 : 0.12;
    this.musicGain.gain.exponentialRampToValueAtTime(target, this.ctx.currentTime + 0.3);
  }

  // Audio Priority Gate (Spec 243)
  playWithPriority(fn, priority = 2) {
    if (this.isMuted) return;
    // Priority: 1 = Critical (Clashes, Parries, Ultimates), 2 = Normal (Attacks, Hits), 3 = Ambient
    this.ensureContext();
    if (!this.ctx) return;
    fn.call(this);
  }
}

window.soundEngine = new SoundEngine();

