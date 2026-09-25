/**
 * Shadow Samurai - Environmental Arena, Cinematic Renderer & Photo Mode
 * Handles 2D canvas rendering, dynamic camera tracking, particle object pooling,
 * environmental destructibles, wall impacts, damage numbers, hitbox visualization,
 * developer performance overlay, and interactive Photo Mode.
 * Complies with specifications 80, 81, 104, 105, 107, 108, 127, 128.
 */

class EnvironmentalArena {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Internal Virtual Resolution (16:9 1280x720)
    this.virtualWidth = 1280;
    this.virtualHeight = 720;
    
    // Arena Boundaries (Spec 81)
    this.x = 80;
    this.width = 1120;
    this.groundY = 560;
    
    // Camera Tracking & Zoom (Spec 108, 276, 277)
    this.camX = 0;
    this.camY = 0;
    this.camZoom = 1.0;
    this.targetZoom = 1.0;
    this.attackCam = {
      active: false,
      timer: 0,
      maxTimer: 0,
      focusX: 0,
      focusY: 0,
      zoomBoost: 0.25
    };
    
    // Photo Mode State (Spec 107)
    this.photoMode = {
      active: false,
      panX: 0,
      panY: 0,
      zoom: 1.0,
      hideUI: false,
      slowMo: false
    };

    // Performance Overlay Metrics (Spec 127)
    this.perfMetrics = {
      fps: 60,
      frameTime: 16.6,
      lastTimestamp: performance.now(),
      framesCount: 0,
      particleCount: 0,
      activeEntities: 2
    };
    this.showPerfOverlay = false; // Toggle with F3
    
    // Particle Object Pooling (Spec 128)
    this.sparks = [];
    this.floatingTexts = [];
    this.groundImpacts = [];
    this.debrisList = [];
    
    // Training Mode Display Toggles (Spec 104, 105)
    this.showHitboxes = false;
    this.showFrameData = false;
    
    // Arena Environment Atmosphere (Boss Phase 1, 2, 3)
    this.arenaPhase = 1;

    // Dynamic Weather & Atmospheric Lighting System (Specs 168-176)
    this.weather = {
      preset: 'clear',
      activePreset: 'clear',
      rainDensity: 0,
      snowDensity: 0,
      ashDensity: 0,
      fogDensity: 0,
      lightingTint: '#ffffff',
      bloomIntensity: 0.15
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupPhotoModeMouse();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.scale = rect.width / this.virtualWidth;
  }

  // Setup Photo Mode Mouse Dragging & Zooming (Spec 107)
  setupPhotoModeMouse() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.photoMode.active) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.photoMode.active || !isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;
      this.photoMode.panX += dx;
      this.photoMode.panY += dy;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.photoMode.active) return;
      e.preventDefault();
      this.photoMode.zoom = Math.max(0.6, Math.min(2.5, this.photoMode.zoom - e.deltaY * 0.0015));
    }, { passive: false });
  }

  // Dynamic Camera Tracking & Attack Camera (Specs 108, 276, 277)
  triggerAttackCamera(focusX, focusY, zoomBoost = 0.25, durationFrames = 22) {
    this.attackCam.active = true;
    this.attackCam.focusX = focusX;
    this.attackCam.focusY = focusY;
    this.attackCam.zoomBoost = zoomBoost;
    this.attackCam.timer = durationFrames;
    this.attackCam.maxTimer = durationFrames;
  }

  updateCamera(player, enemy, cameraShake = 0) {
    if (this.photoMode.active) {
      // Photo Mode manual camera
      this.camX = (this.virtualWidth * 0.5) - (player.x * this.photoMode.zoom) + this.photoMode.panX;
      this.camY = (this.virtualHeight * 0.5) - ((player.y - 40) * this.photoMode.zoom) + this.photoMode.panY;
      this.camZoom = this.photoMode.zoom;
      return;
    }

    let midX = (player.x + enemy.x) * 0.5;
    let midY = (player.y + enemy.y) * 0.5;
    const dist = Math.abs(player.x - enemy.x);

    // Dynamic zoom based on fighters distance & boss presence (Spec 276)
    if (dist < 220) {
      this.targetZoom = 1.15;
    } else if (dist > 650) {
      this.targetZoom = 0.92;
    } else {
      this.targetZoom = 1.0;
    }

    if (enemy && enemy.isBoss) {
      // Pull back slightly to keep large boss majestically framed
      this.targetZoom *= 0.96;
    }

    // Attack Camera Impact Zoom & Focus (Spec 277)
    if (this.attackCam && this.attackCam.active && this.attackCam.timer > 0) {
      this.attackCam.timer--;
      const progress = this.attackCam.timer / this.attackCam.maxTimer;
      this.targetZoom += this.attackCam.zoomBoost * progress;
      midX = midX * (1 - progress * 0.6) + this.attackCam.focusX * (progress * 0.6);
      midY = midY * (1 - progress * 0.6) + this.attackCam.focusY * (progress * 0.6);
      if (this.attackCam.timer <= 0) {
        this.attackCam.active = false;
      }
    }

    this.camZoom += (this.targetZoom - this.camZoom) * 0.08;

    // Smooth camera target with Arena boundary considerations (Spec 276)
    const minX = this.x + 120;
    const maxX = this.x + this.width - 120;
    const clampedMidX = Math.max(minX, Math.min(maxX, midX));

    const targetCamX = (this.virtualWidth * 0.5) - clampedMidX * this.camZoom;
    const targetCamY = (this.virtualHeight * 0.5) - (midY - 40) * this.camZoom;

    // Apply Screen Shake (Spec 108, 278)
    const shakeOffsetX = (Math.random() - 0.5) * cameraShake * 2;
    const shakeOffsetY = (Math.random() - 0.5) * cameraShake * 2;

    this.camX += (targetCamX - this.camX) * 0.12 + shakeOffsetX;
    this.camY += (targetCamY - this.camY) * 0.12 + shakeOffsetY;
  }

  // Performance Telemetry Update (Spec 127)
  updatePerfMetrics() {
    const now = performance.now();
    const delta = now - this.perfMetrics.lastTimestamp;
    this.perfMetrics.framesCount++;

    if (delta >= 500) {
      this.perfMetrics.fps = Math.round((this.perfMetrics.framesCount * 1000) / delta);
      this.perfMetrics.frameTime = (delta / this.perfMetrics.framesCount).toFixed(1);
      this.perfMetrics.framesCount = 0;
      this.perfMetrics.lastTimestamp = now;
      this.perfMetrics.particleCount = this.sparks.length + this.debrisList.length + this.floatingTexts.length;
    }
  }

  // Main Render Loop
  render(player, enemy, combatEngine) {
    if (!this.ctx) return;
    this.updatePerfMetrics();

    this.ctx.save();
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.ctx.scale(this.scale, this.scale);

    // Clear Canvas
    this.ctx.fillStyle = '#0a0604';
    this.ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    // Update Camera
    this.updateCamera(player, enemy, combatEngine.cameraShake);

    // Apply Camera Transform
    this.ctx.save();
    this.ctx.translate(this.camX, this.camY);
    this.ctx.scale(this.camZoom, this.camZoom);

    // 1. Render Atmospheric Dojo / Eclipse Arena Backdrop (Spec 91)
    this.renderDojoBackdrop();

    // 2. Render Arena Ground Impacts & Cracks
    this.renderGroundImpacts();

    // 3. Render Environmental Destructible Objects & Fire (Spec 80)
    combatEngine.render(this.ctx);

    // 4. Render Fighter Silhouettes & Weapons
    enemy.render(this.ctx);
    player.render(this.ctx);

    // 5. Render Particle Sparks & Debris Pools (Spec 128)
    this.renderParticles();

    // 6. Hitbox Visualization (Training Mode: Spec 104)
    if (this.showHitboxes) {
      this.renderHitboxes(player, enemy);
    }

    this.ctx.restore();

    // 7. Render Floating Damage Numbers (Screen Space)
    this.renderDamageTexts();

    // 8. Screen Flash Overlay on Lethal Impacts
    if (combatEngine.screenFlashAlpha > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${combatEngine.screenFlashAlpha})`;
      this.ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
    }

    // 9. Frame Data Overlay (Spec 105)
    if (this.showFrameData) {
      this.renderFrameDataOverlay(player);
    }

    // 10. Performance Monitor Overlay (Spec 127)
    if (this.showPerfOverlay) {
      this.renderPerfOverlay();
    }

    this.ctx.restore();
  }

  // Atmospheric Arena Backdrop with Boss Phase Lighting Shifts (Spec 91, 110)
  renderDojoBackdrop() {
    const ctx = this.ctx;

    // Sky colors based on Boss Phase
    let skyHue = 'rgba(255, 240, 200, 0.45)';
    let moonCore = 'rgba(255, 220, 130, 0.15)';
    if (this.arenaPhase === 2) {
      skyHue = 'rgba(255, 120, 40, 0.55)'; // Crimson Twilight
      moonCore = 'rgba(255, 90, 20, 0.25)';
    } else if (this.arenaPhase === 3) {
      skyHue = 'rgba(215, 30, 30, 0.65)'; // Abyssal Eclipse Blood Moon
      moonCore = 'rgba(180, 0, 40, 0.4)';
    }

    // Radial Moon Halo
    const moonGrad = ctx.createRadialGradient(640, 200, 20, 640, 200, 180);
    moonGrad.addColorStop(0, skyHue);
    moonGrad.addColorStop(0.5, moonCore);
    moonGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(640, 200, 180, 0, Math.PI * 2);
    ctx.fill();

    // Golden / Blood Eclipse Moon Disc
    ctx.fillStyle = this.arenaPhase === 3 ? 'rgba(255, 60, 60, 0.25)' : 'rgba(255, 220, 130, 0.15)';
    ctx.beginPath();
    ctx.arc(640, 200, 75, 0, Math.PI * 2);
    ctx.fill();

    // Distant Temple Gate & Pagoda Silhouette
    ctx.fillStyle = '#140c08';
    ctx.fillRect(this.x - 20, 100, 30, this.groundY - 100);
    ctx.fillRect(this.x + this.width - 10, 100, 30, this.groundY - 100);
    ctx.fillRect(this.x - 20, 100, this.width + 40, 24);

    // Arena Floor
    const floorGrad = ctx.createLinearGradient(0, this.groundY, 0, this.virtualHeight);
    floorGrad.addColorStop(0, '#1c100a');
    floorGrad.addColorStop(0.3, '#100805');
    floorGrad.addColorStop(1, '#050201');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(-200, this.groundY, this.virtualWidth + 400, 300);

    // Floor edge highlight line
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-200, this.groundY);
    ctx.lineTo(this.virtualWidth + 200, this.groundY);
    ctx.stroke();

    // Wall Boundary Glow (Spec 81)
    ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
    ctx.fillRect(this.x - 20, 100, 15, this.groundY - 100);
    ctx.fillStyle = 'rgba(255, 60, 60, 0.06)';
    ctx.fillRect(this.x + this.width + 5, 100, 15, this.groundY - 100);
  }

  // Particle Generators (Sparks, Impacts, Debris) (Spec 128)
  createHitImpact(x, y, isCrit = false) {
    const count = isCrit ? 22 : 12;
    const color = isCrit ? '#ffd56b' : '#ffffff';
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * (isCrit ? 9 : 6);
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        alpha: 1.0,
        color,
        life: 25
      });
    }
  }

  createBlockSparks(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const speed = 2 + Math.random() * 5;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2,
        alpha: 1.0,
        color: '#ffd43b',
        life: 18
      });
    }
  }

  createPerfectBlockFx(x, y) {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 8;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5,
        alpha: 1.0,
        color: '#00e5ff',
        life: 30
      });
    }
  }

  createArmorSparks(x, y) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        alpha: 1.0,
        color: '#ff922b',
        life: 22
      });
    }
  }

  createGuardBreakFx(x, y) {
    // Glass shatter sparks
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4,
        alpha: 1.0,
        color: '#00e5ff',
        life: 35
      });
    }
  }

  createWallImpact(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        alpha: 1.0,
        color: '#ff922b',
        life: 25
      });
    }
  }

  createGroundImpact(x, y) {
    this.groundImpacts.push({
      x, y,
      alpha: 0.85,
      size: 42,
      life: 60
    });
  }

  createObjectDebris(x, y, type) {
    const count = 12;
    const color = type === 'crate' ? '#6b4426' : (type === 'lantern' ? '#ff6b6b' : '#8c1d1d');
    for (let i = 0; i < count; i++) {
      this.debrisList.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: -(3 + Math.random() * 6),
        size: 4 + Math.random() * 5,
        alpha: 1.0,
        color,
        life: 45
      });
    }
  }

  createSmokePuff(x, y) {
    for (let i = 0; i < 14; i++) {
      this.sparks.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 50 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 2,
        vy: -(0.5 + Math.random() * 1.5),
        size: 14 + Math.random() * 12,
        alpha: 0.6,
        color: '#332b26',
        life: 40
      });
    }
  }

  // Floating Damage Number System with Distinct Animations (Spec 280)
  createDamageText(x, y, text, typeOrIsCrit = 'normal') {
    let type = (typeOrIsCrit === true) ? 'critical' : (typeOrIsCrit || 'normal');
    let displayText = `${text}`;
    let color = '#ffffff';
    let size = 16;
    let vy = -1.8;
    let vx = 0;
    let maxLife = 45;

    if (type === 'critical') {
      displayText = `★ CRIT ${text} ★`;
      color = '#ffd56b';
      size = 23;
      vy = -2.4;
      maxLife = 52;
    } else if (type === 'blocked') {
      displayText = `[BLOCKED ${text}]`;
      color = '#90caf9';
      size = 14;
      vy = -0.9;
      vx = (Math.random() > 0.5 ? 1 : -1) * 1.8; // Horizontal recoil
      maxLife = 38;
    } else if (type === 'resisted') {
      displayText = `[RESIST ${text}]`;
      color = '#ce93d8';
      size = 14;
      vy = 0.8; // Downward sink
      maxLife = 40;
    } else if (type === 'status') {
      displayText = `[${text}]`;
      color = '#81c784';
      size = 15;
      vy = -1.2;
      maxLife = 48;
    }

    this.floatingTexts.push({
      x, y: y - 20,
      text: displayText,
      type,
      alpha: 1.0,
      vx,
      vy,
      color,
      size,
      life: maxLife,
      maxLife,
      initialY: y - 20,
      sineWave: type === 'status' ? Math.random() * Math.PI : 0
    });
  }

  createComboBreakerFx(x, y) {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4,
        alpha: 1.0,
        color: '#ffd875',
        life: 30
      });
    }
  }

  createPoiseBreakFx(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4.5,
        alpha: 1.0,
        color: '#ff3344',
        life: 35
      });
    }
  }

  createWeaponClashFx(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 10;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5,
        alpha: 1.0,
        color: '#ffffff',
        life: 25
      });
    }
  }

  createHealFx(x, y) {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: 3.5,
        alpha: 1.0,
        color: '#00ff88',
        life: 35
      });
    }
  }

  createEnergySparks(x, y) {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3,
        alpha: 1.0,
        color: '#00e5ff',
        life: 25
      });
    }
  }

  // Render Ground Impacts
  renderGroundImpacts() {
    const ctx = this.ctx;
    for (let i = this.groundImpacts.length - 1; i >= 0; i--) {
      const g = this.groundImpacts[i];
      g.life--;
      g.alpha = g.life / 60;

      ctx.save();
      ctx.strokeStyle = `rgba(0, 0, 0, ${g.alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.size, g.size * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (g.life <= 0) this.groundImpacts.splice(i, 1);
    }
  }

  // Render Particles (Sparks & Debris) (Spec 128)
  renderParticles() {
    const ctx = this.ctx;

    // Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
      p.alpha = p.life / 25;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      if (p.life <= 0) this.sparks.splice(i, 1);
    }

    // Debris
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.35;
      d.life--;
      d.alpha = d.life / 45;

      ctx.fillStyle = d.color;
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.fillRect(d.x, d.y, d.size, d.size);

      if (d.life <= 0 || d.y >= this.groundY) {
        this.debrisList.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // Render Floating Damage Texts with Unique Animations (Spec 280)
  renderDamageTexts() {
    const ctx = this.ctx;
    ctx.save();
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life--;
      const maxL = t.maxLife || 45;
      const progress = 1.0 - (t.life / maxL);
      t.alpha = Math.max(0, t.life / maxL);

      // Animation motion updates based on type
      if (t.type === 'critical') {
        // Dramatic explosive pop & slight vibration
        const jitter = (Math.random() - 0.5) * 1.5;
        t.x += jitter;
        t.y += t.vy * (1.0 - progress * 0.5);
      } else if (t.type === 'blocked') {
        // Horizontal recoil with parabolic arc
        t.x += t.vx;
        t.y += t.vy;
        t.vy += 0.08; // Gravity curve
      } else if (t.type === 'resisted') {
        // Heavy downward sink
        t.y += t.vy * (0.8 + progress * 0.5);
      } else if (t.type === 'status') {
        // Sinusoidal wavy vapor drift
        t.sineWave = (t.sineWave || 0) + 0.15;
        t.x += Math.sin(t.sineWave) * 1.2;
        t.y += t.vy;
      } else {
        // Normal upward float
        t.y += t.vy;
      }

      ctx.save();
      ctx.globalAlpha = t.alpha;

      if (t.type === 'critical') {
        // Scale pulse
        const scale = 1.0 + Math.sin(progress * Math.PI) * 0.35;
        ctx.translate(t.x, t.y);
        ctx.scale(scale, scale);
        ctx.font = `900 ${t.size}px 'Cinzel', serif`;
        ctx.fillStyle = t.color;
        ctx.shadowColor = '#ffd56b';
        ctx.shadowBlur = 10;
        ctx.fillText(t.text, 0, 0);
      } else if (t.type === 'blocked') {
        ctx.font = `700 ${t.size}px 'Outfit', sans-serif`;
        ctx.fillStyle = t.color;
        ctx.shadowColor = '#1e88e5';
        ctx.shadowBlur = 8;
        ctx.fillText(t.text, t.x, t.y);
      } else {
        ctx.font = `900 ${t.size}px 'Cinzel', serif`;
        ctx.fillStyle = t.color;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.restore();

      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }
    ctx.restore();
  }

  // Hitbox / Hurtbox Visualizer (Training Mode: Spec 104)
  renderHitboxes(player, enemy) {
    const ctx = this.ctx;
    const fighters = [player, enemy];

    for (const f of fighters) {
      // 1. Green Hurtbox
      const hurt = f.getHurtbox();
      ctx.strokeStyle = '#51cf66';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hurt.x, hurt.y, hurt.width, hurt.height);

      // 2. Red Hitbox (if active)
      const hit = f.getHitbox();
      if (hit) {
        ctx.fillStyle = 'rgba(255, 60, 60, 0.35)';
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 2;
        ctx.fillRect(hit.x, hit.y, hit.width, hit.height);
        ctx.strokeRect(hit.x, hit.y, hit.width, hit.height);
      }

      // 3. Blue Guard Box
      if (f.state === 'BLOCK') {
        ctx.strokeStyle = '#339af0';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(f.x - f.width * 0.6, f.y - f.height, f.width * 1.2, f.height);
      }
    }
  }

  // Technical Frame Data Overlay (Spec 105)
  renderFrameDataOverlay(player) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 6, 4, 0.88)';
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(20, 80, 240, 160);
    ctx.strokeRect(20, 80, 240, 160);

    ctx.font = '700 12px "Cinzel", serif';
    ctx.fillStyle = '#ffd56b';
    ctx.fillText('FRAME DATA TELEMETRY', 32, 102);

    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = '#eeddbb';
    if (player.currentAttack) {
      const atk = player.currentAttack;
      ctx.fillText(`Attack: ${atk.name}`, 32, 124);
      ctx.fillText(`Startup: ${atk.startup}f | Active: ${atk.active}f`, 32, 142);
      ctx.fillText(`Recovery: ${atk.recovery}f | Cancel: ${atk.cancelWindow}f`, 32, 160);
      ctx.fillText(`Hit Stun: +${atk.hitStun}f | Block: +${atk.blockStun}f`, 32, 178);
      ctx.fillText(`Current Frame: ${player.attackFrame}f (${player.attackPhase})`, 32, 196);
    } else {
      ctx.fillText(`State: ${player.state}`, 32, 124);
      ctx.fillText(`Invincible: ${player.invincibleFrames > 0 ? 'YES' : 'NO'}`, 32, 142);
      ctx.fillText(`Super Armor: ${player.armorHits}`, 32, 160);
      ctx.fillText(`Perfect Block: ${player.perfectBlockActive ? 'READY' : 'OFF'}`, 32, 178);
      ctx.fillText(`Counter Window: ${player.counterWindow}f`, 32, 196);
    }
    ctx.restore();
  }

  // Developer Performance Monitor Overlay (Spec 127)
  renderPerfOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.fillRect(this.virtualWidth - 210, 80, 190, 110);
    ctx.strokeRect(this.virtualWidth - 210, 80, 190, 110);

    ctx.font = '700 11px monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('⚡ DEV PERFORMANCE [F3]', this.virtualWidth - 200, 98);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`FPS: ${this.perfMetrics.fps} (${this.perfMetrics.frameTime} ms)`, this.virtualWidth - 200, 118);
    ctx.fillText(`Particles: ${this.perfMetrics.particleCount}`, this.virtualWidth - 200, 136);
    ctx.fillText(`Entities: ${this.perfMetrics.activeEntities}`, this.virtualWidth - 200, 154);
    ctx.fillText(`Zoom: ${this.camZoom.toFixed(2)}x`, this.virtualWidth - 200, 172);
    ctx.restore();
  }

  // Weather & Atmosphere System (Spec 172, 173)
  setWeather(weatherType = 'clear') {
    const validPresets = ['clear', 'rain', 'storm', 'fog', 'snow', 'ash', 'eclipse'];
    const preset = validPresets.includes(weatherType) ? weatherType : 'clear';
    
    if (!this.weather || typeof this.weather !== 'object') {
      this.weather = {};
    }
    this.weather.preset = preset;
    this.weather.activePreset = preset;

    switch (preset) {
      case 'storm':
        this.weather.rainDensity = 120;
        this.weather.snowDensity = 0;
        this.weather.ashDensity = 0;
        this.weather.fogDensity = 0.35;
        this.weather.lightingTint = '#2a3b5c';
        this.weather.bloomIntensity = 0.4;
        break;
      case 'rain':
        this.weather.rainDensity = 60;
        this.weather.snowDensity = 0;
        this.weather.ashDensity = 0;
        this.weather.fogDensity = 0.15;
        this.weather.lightingTint = '#4a5d78';
        this.weather.bloomIntensity = 0.2;
        break;
      case 'snow':
        this.weather.rainDensity = 0;
        this.weather.snowDensity = 80;
        this.weather.ashDensity = 0;
        this.weather.fogDensity = 0.2;
        this.weather.lightingTint = '#c0d4ec';
        this.weather.bloomIntensity = 0.25;
        break;
      case 'fog':
        this.weather.rainDensity = 0;
        this.weather.snowDensity = 0;
        this.weather.ashDensity = 0;
        this.weather.fogDensity = 0.65;
        this.weather.lightingTint = '#606b7a';
        this.weather.bloomIntensity = 0.3;
        break;
      case 'ash':
        this.weather.rainDensity = 0;
        this.weather.snowDensity = 0;
        this.weather.ashDensity = 70;
        this.weather.fogDensity = 0.35;
        this.weather.lightingTint = '#3a2e2b';
        this.weather.bloomIntensity = 0.3;
        break;
      case 'eclipse':
        this.weather.rainDensity = 0;
        this.weather.snowDensity = 0;
        this.weather.ashDensity = 20;
        this.weather.fogDensity = 0.25;
        this.weather.lightingTint = '#4a1525';
        this.weather.bloomIntensity = 0.5;
        break;
      case 'clear':
      default:
        this.weather.rainDensity = 0;
        this.weather.snowDensity = 0;
        this.weather.ashDensity = 0;
        this.weather.fogDensity = 0;
        this.weather.lightingTint = '#ffffff';
        this.weather.bloomIntensity = 0.15;
        break;
    }
  }

  // Render Contact Shadow Under Characters (Spec 175)
  renderContactShadow(fighter) {
    const ctx = this.ctx;
    ctx.save();
    const shadowDist = Math.max(0, this.groundY - fighter.y);
    const shadowAlpha = Math.max(0.15, 0.75 - shadowDist * 0.0035);
    const shadowScale = Math.max(0.4, 1.0 - shadowDist * 0.002);

    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(fighter.x, this.groundY, 32 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Silhouette Readability Rim Lighting (Spec 176)
  renderRimLighting(fighter) {
    const ctx = this.ctx;
    ctx.save();
    const rimColor = fighter.isPlayer ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 180, 70, 0.35)';
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rimColor;
    ctx.shadowBlur = 8;
    ctx.strokeRect(fighter.x - fighter.width * 0.45, fighter.y - fighter.height + 10, fighter.width * 0.9, fighter.height - 10);
    ctx.restore();
  }

  // Cinematic Post-Processing & Photo Mode Filters (Spec 177, 226)
  renderPostProcessing() {
    const ctx = this.ctx;
    ctx.save();

    // 1. Cinematic Vignette (Dark Edges)
    const vignette = ctx.createRadialGradient(
      this.virtualWidth * 0.5, this.virtualHeight * 0.5, this.virtualWidth * 0.35,
      this.virtualWidth * 0.5, this.virtualHeight * 0.5, this.virtualWidth * 0.75
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    // 2. Photo Mode Color Filter
    if (this.photoMode.active && this.photoMode.filter) {
      if (this.photoMode.filter === 'noir') {
        ctx.fillStyle = 'rgba(20, 20, 20, 0.45)';
        ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
      } else if (this.photoMode.filter === 'sepia') {
        ctx.fillStyle = 'rgba(160, 110, 50, 0.25)';
        ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
      } else if (this.photoMode.filter === 'blood_moon') {
        ctx.fillStyle = 'rgba(180, 20, 20, 0.30)';
        ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
      }
    }

    ctx.restore();
  }

  // Photo Mode Screenshot Download (Spec 107, 227)
  captureScreenshot() {
    if (!this.canvas) return;
    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `shadow_samurai_photo_${Date.now()}.png`;
      a.click();
      if (window.notifications) {
        window.notifications.show('PHOTO CAPTURED', 'High-res duel screenshot saved!', '📸', 'info', 2000);
      }
    } catch (e) {
      console.warn('Screenshot capture error:', e);
    }
  }
}

const _arenaRoot = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
_arenaRoot.EnvironmentalArena = EnvironmentalArena;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnvironmentalArena };
}

