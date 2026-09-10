(function () {
  "use strict";

  const { random } = Starfall;

  class Starfield {
    constructor(width, height) {
      this.stars = [];
      this.resize(width, height, true);
    }

    resize(width, height, reset) {
      this.width = width;
      this.height = height;
      if (reset || this.stars.length === 0) {
        this.stars.length = 0;
        for (let i = 0; i < Starfall.CONFIG.WORLD.starCount; i += 1) this.stars.push(this.createStar(true));
      }
    }

    createStar(anywhere) {
      const layer = Math.random();
      return {
        x: Math.random() * this.width,
        y: anywhere ? Math.random() * this.height : -5,
        size: layer > 0.92 ? random(1.5, 2.6) : random(0.45, 1.35),
        speed: 20 + layer * 105,
        alpha: random(0.25, 0.95),
        blue: Math.random() > 0.72,
      };
    }

    update(dt, speedMultiplier) {
      for (const star of this.stars) {
        star.y += star.speed * dt * (speedMultiplier || 1);
        if (star.y > this.height + 5) Object.assign(star, this.createStar(false));
      }
    }

    draw(ctx, time) {
      const nebulaA = ctx.createRadialGradient(this.width * 0.18, this.height * 0.28, 10, this.width * 0.18, this.height * 0.28, this.width * 0.55);
      nebulaA.addColorStop(0, "rgba(100,48,171,.20)");
      nebulaA.addColorStop(0.5, "rgba(36,46,124,.08)");
      nebulaA.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebulaA;
      ctx.fillRect(0, 0, this.width, this.height);
      const nebulaB = ctx.createRadialGradient(this.width * 0.82, this.height * 0.55, 20, this.width * 0.82, this.height * 0.55, this.width * 0.42);
      nebulaB.addColorStop(0, "rgba(0,192,209,.10)");
      nebulaB.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebulaB;
      ctx.fillRect(0, 0, this.width, this.height);
      for (const star of this.stars) {
        const shimmer = Starfall.THEME.reducedMotion.matches ? .6 : 0.62 + Math.sin(time * 2 + star.x) * 0.1;
        ctx.globalAlpha = star.alpha * shimmer * .45;
        ctx.fillStyle = star.blue ? "#8eeeff" : "#ffffff";
        ctx.fillRect(star.x, star.y, star.size, star.size * (star.speed > 90 ? 2.5 : 1));
      }
      ctx.globalAlpha = 1;
    }
  }

  class Particle {
    constructor(x, y, options) {
      const angle = options.angle == null ? random(0, Math.PI * 2) : options.angle;
      const speed = options.speed == null ? random(35, 210) : options.speed;
      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = options.life || random(0.25, 0.65);
      this.maxLife = this.life;
      this.size = options.size || random(1.5, 5.5);
      this.color = options.color || "#8ffaff";
      this.drag = options.drag == null ? 2.4 : options.drag;
      this.gravity = options.gravity || 0;
      this.dead = false;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      const damping = Math.exp(-this.drag * dt);
      this.vx *= damping;
      this.vy = this.vy * damping + this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  class FloatingText {
    constructor(x, y, text, color, size) {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color || "#fff";
      this.size = size || 16;
      this.life = 1.05;
      this.maxLife = this.life;
      this.dead = false;
    }

    update(dt) {
      this.life -= dt;
      this.y -= 35 * dt;
      if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
      const progress = 1 - this.life / this.maxLife;
      ctx.globalAlpha = Math.min(1, this.life * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.font = `900 ${this.size * (1 + progress * 0.08)}px 'Exo 2', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(this.text, this.x, this.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  class PulseWave {
    constructor(x, y, maxRadius, color) {
      this.x = x;
      this.y = y;
      this.radius = 12;
      this.maxRadius = maxRadius;
      this.life = 0.65;
      this.maxLife = this.life;
      this.color = color || "#69f7ff";
      this.dead = false;
    }

    update(dt) {
      this.life -= dt;
      const progress = 1 - Math.max(0, this.life) / this.maxLife;
      this.radius = this.maxRadius * (1 - Math.pow(1 - progress, 3));
      if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4 + alpha * 8;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  class EffectSystem {
    constructor() {
      this.particles = [];
      this.texts = [];
      this.waves = [];
    }

    burst(x, y, color, count, strength) {
      for (let i = 0; i < count; i += 1) {
        this.particles.push(new Particle(x, y, { color, speed: random(25, strength || 200), size: random(1.5, 6), life: random(0.25, 0.72) }));
      }
      const secondary = color === "#ffb35a" ? "#ff5f73" : "#ffffff";
      for (let i = 0; i < Math.ceil(count * 0.28); i += 1) {
        this.particles.push(new Particle(x, y, { color: secondary, speed: random(20, 150), size: random(1, 3), life: random(0.15, 0.4) }));
      }
    }

    trail(x, y, color, count) {
      for (let i = 0; i < (count || 1); i += 1) {
        this.particles.push(new Particle(x + random(-3, 3), y + random(-2, 3), {
          color, angle: random(Math.PI * 0.35, Math.PI * 0.65), speed: random(25, 80), size: random(1, 3.5), life: random(0.12, 0.32), drag: 3,
        }));
      }
    }

    text(x, y, text, color, size) { this.texts.push(new FloatingText(x, y, text, color, size)); }
    wave(x, y, radius, color) { this.waves.push(new PulseWave(x, y, radius, color)); }

    update(dt) {
      for (const group of [this.particles, this.texts, this.waves]) {
        for (const item of group) item.update(dt);
        for (let i = group.length - 1; i >= 0; i -= 1) if (group[i].dead) group.splice(i, 1);
      }
      if (this.particles.length > 650) this.particles.splice(0, this.particles.length - 650);
    }

    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const wave of this.waves) wave.draw(ctx);
      for (const particle of this.particles) particle.draw(ctx);
      ctx.restore();
      for (const item of this.texts) item.draw(ctx);
    }

    clear() { this.particles.length = 0; this.texts.length = 0; this.waves.length = 0; }
  }

  Starfall.Starfield = Starfield;
  Starfall.EffectSystem = EffectSystem;
})();
