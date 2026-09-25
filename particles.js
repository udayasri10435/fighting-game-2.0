/**
 * Shadow Samurai Atmospheric Particle Simulation
 * Realistic 3D Sakura Petals, Golden Embers, Cyan Soul Wisps & Mouse Lantern Lighting
 */

class ParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.petals = [];
    this.embers = [];
    this.wisps = [];
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.targetMouseX = 0.5;
    this.targetMouseY = 0.5;
    this.wind = 1.2;
    this.windTimer = 0;
    this.activeNodePos = { x: 0.58, y: 0.30 }; // Active Stage 4 position

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Mouse lantern tracking
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.targetMouseX = (e.clientX - rect.left) / rect.width;
        this.targetMouseY = (e.clientY - rect.top) / rect.height;
      }
    });

    // Create Sakura Petals
    const petalCount = 45;
    for (let i = 0; i < petalCount; i++) {
      this.petals.push(this.createPetal(true));
    }

    // Create Golden Embers
    const emberCount = 30;
    for (let i = 0; i < emberCount; i++) {
      this.embers.push(this.createEmber(true));
    }

    // Create Cyan Wisps around active node
    const wispCount = 18;
    for (let i = 0; i < wispCount; i++) {
      this.wisps.push(this.createWisp(true));
    }

    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
  }

  createPetal(randomY = false) {
    return {
      x: Math.random() * (this.width || 1200),
      y: randomY ? Math.random() * (this.height || 675) : -20,
      size: 9 + Math.random() * 8,
      speedX: 0.8 + Math.random() * 1.5,
      speedY: 1.0 + Math.random() * 1.4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.02 + Math.random() * 0.03,
      swayOffset: Math.random() * 100,
      opacity: 0.45 + Math.random() * 0.45
    };
  }

  createEmber(randomY = false) {
    return {
      x: Math.random() * (this.width || 1200),
      y: randomY ? Math.random() * (this.height || 675) : (this.height || 675) + 15,
      size: 1.2 + Math.random() * 2.2,
      speedX: (Math.random() - 0.4) * 0.8,
      speedY: -(0.5 + Math.random() * 1.2),
      alpha: 0.2 + Math.random() * 0.6,
      maxAlpha: 0.4 + Math.random() * 0.5,
      life: 0,
      maxLife: 150 + Math.random() * 150,
      hue: 35 + Math.random() * 15 // Golden warm amber
    };
  }

  createWisp(randomSpawn = false) {
    const originX = (this.width || 1200) * this.activeNodePos.x;
    const originY = (this.height || 675) * this.activeNodePos.y;
    const angle = Math.random() * Math.PI * 2;
    const dist = randomSpawn ? Math.random() * 45 : Math.random() * 15;

    return {
      x: originX + Math.cos(angle) * dist,
      y: originY + Math.sin(angle) * dist,
      vx: Math.cos(angle) * (0.3 + Math.random() * 0.6),
      vy: Math.sin(angle) * (0.3 + Math.random() * 0.6) - 0.5,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.1,
      maxAlpha: 0.5 + Math.random() * 0.4,
      life: 0,
      maxLife: 60 + Math.random() * 60
    };
  }

  drawPetal(p) {
    this.ctx.save();
    this.ctx.translate(p.x, p.y);
    this.ctx.rotate(p.rotation);
    this.ctx.scale(Math.cos(p.flip), 1);

    this.ctx.globalAlpha = p.opacity;

    // Gradient between delicate pink and inner darker blush
    const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
    grad.addColorStop(0, '#ffe4ec');
    grad.addColorStop(0.5, '#f7b2c4');
    grad.addColorStop(1, '#db728e');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    // Beautiful notched sakura petal geometry
    this.ctx.moveTo(0, -p.size);
    this.ctx.bezierCurveTo(p.size * 0.6, -p.size * 0.8, p.size * 0.8, -p.size * 0.1, 0, p.size);
    this.ctx.bezierCurveTo(-p.size * 0.8, -p.size * 0.1, -p.size * 0.6, -p.size * 0.8, 0, -p.size);
    this.ctx.fill();

    this.ctx.restore();
  }

  drawEmber(e) {
    this.ctx.save();
    this.ctx.globalAlpha = e.alpha;
    this.ctx.fillStyle = `hsl(${e.hue}, 90%, 65%)`;
    this.ctx.shadowColor = `hsl(${e.hue}, 100%, 55%)`;
    this.ctx.shadowBlur = 6;
    this.ctx.beginPath();
    this.ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawWisp(w) {
    this.ctx.save();
    this.ctx.globalAlpha = w.alpha;
    this.ctx.fillStyle = '#00e5ff';
    this.ctx.shadowColor = '#00e5ff';
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  animate() {
    if (!this.ctx || !this.width) {
      requestAnimationFrame(() => this.animate());
      return;
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    // Smooth lantern cursor interpolation
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.08;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.08;

    // Draw Dynamic Torchlight / Lantern reflection on parchment
    const lx = this.mouseX * this.width;
    const ly = this.mouseY * this.height;
    const lanternGrad = this.ctx.createRadialGradient(lx, ly, 30, lx, ly, 340);
    lanternGrad.addColorStop(0, 'rgba(255, 235, 185, 0.07)');
    lanternGrad.addColorStop(0.5, 'rgba(230, 190, 120, 0.03)');
    lanternGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = lanternGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Wind gust fluctuation
    this.windTimer += 0.02;
    const currentWind = this.wind + Math.sin(this.windTimer) * 0.6;

    // Update & draw Sakura Petals
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.x += p.speedX * currentWind + Math.sin(p.swayOffset + this.windTimer * 2) * 0.5;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      p.flip += p.flipSpeed;

      this.drawPetal(p);

      // Reset when out of view
      if (p.y > this.height + 20 || p.x > this.width + 40) {
        this.petals[i] = this.createPetal(false);
      }
    }

    // Update & draw Golden Embers
    for (let i = 0; i < this.embers.length; i++) {
      const e = this.embers[i];
      e.life++;
      e.x += e.speedX + (Math.sin(e.life * 0.05) * 0.4);
      e.y += e.speedY;

      // Alpha fade in and out
      if (e.life < 30) {
        e.alpha = (e.life / 30) * e.maxAlpha;
      } else if (e.life > e.maxLife - 30) {
        e.alpha = ((e.maxLife - e.life) / 30) * e.maxAlpha;
      }

      this.drawEmber(e);

      if (e.life >= e.maxLife || e.y < -10) {
        this.embers[i] = this.createEmber(false);
      }
    }

    // Update & draw Cyan Wisps around active node
    for (let i = 0; i < this.wisps.length; i++) {
      const w = this.wisps[i];
      w.life++;
      w.x += w.vx;
      w.y += w.vy;

      if (w.life < 20) {
        w.alpha = (w.life / 20) * w.maxAlpha;
      } else if (w.life > w.maxLife - 20) {
        w.alpha = ((w.maxLife - w.life) / 20) * w.maxAlpha;
      }

      this.drawWisp(w);

      if (w.life >= w.maxLife) {
        this.wisps[i] = this.createWisp(false);
      }
    }

    requestAnimationFrame(() => this.animate());
  }
}

window.ParticleEngine = ParticleEngine;
