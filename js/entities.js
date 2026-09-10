(function () {
  "use strict";

  const C = Starfall.CONFIG;
  const { clamp, random } = Starfall;

  class Projectile {
    constructor(x, y, vx, vy, friendly, options) {
      const opts = options || {};
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.friendly = friendly;
      this.damage = opts.damage || (friendly ? 14 : 12);
      this.radius = opts.radius || (friendly ? 5 : 8);
      this.color = opts.color || (friendly ? "#63f5ff" : "#ff6bcf");
      this.life = opts.life || 5;
      this.fromBoss = Boolean(opts.fromBoss);
      this.dead = false;
    }

    update(dt, width, height) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0 || this.x < -50 || this.x > width + 50 || this.y < -60 || this.y > height + 60) this.dead = true;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.fromBoss ? 20 : 13;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.roundRect(-this.radius * 0.55, -this.radius * 2.2, this.radius * 1.1, this.radius * 4.4, this.radius);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.targetX = x;
      this.targetY = y;
      this.radius = C.PLAYER.radius;
      this.health = C.PLAYER.maxHealth;
      this.shield = C.PLAYER.maxShield;
      this.fireTimer = 0;
      this.damageCooldown = 0;
      this.sinceDamage = 99;
      this.rapidFire = 0;
      this.tripleLaser = 0;
      this.invincible = 0;
      this.droneTime = 0;
      this.tilt = 0;
      this.dead = false;
    }

    update(dt, game) {
      const pad = 30;
      const desiredX = clamp(this.targetX, pad, game.width - pad);
      const desiredY = clamp(this.targetY, Math.max(105, pad), game.height - pad);
      const easing = 1 - Math.exp(-C.PLAYER.followSpeed * dt);
      const oldX = this.x;
      this.x += (desiredX - this.x) * easing;
      this.y += (desiredY - this.y) * easing;
      this.tilt += ((this.x - oldX) * 0.065 - this.tilt) * Math.min(1, dt * 9);
      this.tilt = clamp(this.tilt, -0.32, 0.32);

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.shoot(game);
        this.fireTimer = this.rapidFire > 0 ? C.PLAYER.rapidFireRate : C.PLAYER.autoFireRate;
      }
      this.damageCooldown = Math.max(0, this.damageCooldown - dt);
      this.sinceDamage += dt;
      this.rapidFire = Math.max(0, this.rapidFire - dt);
      this.tripleLaser = Math.max(0, this.tripleLaser - dt);
      this.invincible = Math.max(0, this.invincible - dt);
      this.droneTime = Math.max(0, this.droneTime - dt);
      if (this.sinceDamage >= C.PLAYER.shieldRechargeDelay && this.shield < C.PLAYER.maxShield) {
        this.shield = Math.min(C.PLAYER.maxShield, this.shield + C.PLAYER.shieldRechargeRate * dt);
      }
      game.effects.trail(this.x, this.y + 23, "#4beaff", Math.random() > 0.45 ? 1 : 0);
    }

    shoot(game) {
      const speed = C.PLAYER.laserSpeed;
      game.playerProjectiles.push(new Projectile(this.x - 9, this.y - 19, 0, -speed, true, { damage: 14 }));
      game.playerProjectiles.push(new Projectile(this.x + 9, this.y - 19, 0, -speed, true, { damage: 14 }));
      if (this.tripleLaser > 0) {
        game.playerProjectiles.push(new Projectile(this.x - 12, this.y - 15, -150, -speed * 0.95, true, { damage: 11, color: "#9c8cff" }));
        game.playerProjectiles.push(new Projectile(this.x + 12, this.y - 15, 150, -speed * 0.95, true, { damage: 11, color: "#9c8cff" }));
      }
      game.audio.play("laser");
    }

    takeDamage(amount, game) {
      if (this.damageCooldown > 0 || this.invincible > 0 || this.dead) return false;
      this.damageCooldown = C.PLAYER.invulnerabilityAfterHit;
      this.sinceDamage = 0;
      let remaining = amount;
      if (this.shield > 0) {
        const blocked = Math.min(this.shield, remaining);
        this.shield -= blocked;
        remaining -= blocked;
        game.effects.wave(this.x, this.y, 48, "#63eaff");
        game.audio.play("shield");
      }
      if (remaining > 0) {
        this.health = Math.max(0, this.health - remaining);
        game.audio.play("hit");
      }
      game.effects.burst(this.x, this.y, remaining > 0 ? "#ff6b7f" : "#6eefff", 10, 125);
      game.shake = Math.max(game.shake, remaining > 0 ? 6 : 3);
      if (this.health <= 0) this.dead = true;
      return true;
    }

    draw(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.tilt);
      if (this.damageCooldown > 0 && Math.floor(time * 15) % 2 === 0) ctx.globalAlpha = 0.42;

      if (this.invincible > 0) {
        ctx.strokeStyle = "#ffe878";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ffe878";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, 29 + Math.sin(time * 7) * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.shield > 0 && this.damageCooldown > 0) {
        ctx.strokeStyle = "#67eaff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#67eaff";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      const flame = 14 + Math.sin(time * 28) * 4;
      const engineGlow = ctx.createLinearGradient(0, 12, 0, 35);
      engineGlow.addColorStop(0, "#ffffff");
      engineGlow.addColorStop(.3, "#57f5ff");
      engineGlow.addColorStop(1, "rgba(55,85,255,0)");
      ctx.fillStyle = engineGlow;
      ctx.shadowColor = "#4beaff";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-7, 13); ctx.lineTo(0, 15 + flame); ctx.lineTo(7, 13); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;

      const hull = ctx.createLinearGradient(-20, -20, 20, 20);
      hull.addColorStop(0, "#d8fbff"); hull.addColorStop(.45, "#7899cf"); hull.addColorStop(1, "#273466");
      ctx.fillStyle = hull;
      ctx.strokeStyle = "#80efff";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -27); ctx.lineTo(8, -12); ctx.lineTo(24, 9); ctx.lineTo(22, 17); ctx.lineTo(7, 12); ctx.lineTo(0, 21); ctx.lineTo(-7, 12); ctx.lineTo(-22, 17); ctx.lineTo(-24, 9); ctx.lineTo(-8, -12); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#152154";
      ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(7, 2); ctx.lineTo(0, 9); ctx.lineTo(-7, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8cfcff";
      ctx.shadowColor = "#55eaff"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(0, -3, 4.2, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff68d4";
      ctx.fillRect(-20, 8, 7, 2); ctx.fillRect(13, 8, 7, 2);
      ctx.restore();
    }
  }

  const ENEMY_STATS = {
    scout: { hp: 26, speed: 104, radius: 15, score: 100, contact: 14, color: "#ff6d9e" },
    zigzag: { hp: 48, speed: 72, radius: 19, score: 170, contact: 18, color: "#bb76ff" },
    heavy: { hp: 105, speed: 43, radius: 25, score: 290, contact: 24, color: "#ff9c59" },
    hunter: { hp: 68, speed: 63, radius: 20, score: 230, contact: 20, color: "#f258d4" },
  };

  class Enemy {
    constructor(type, x, y, difficulty) {
      const stats = ENEMY_STATS[type];
      this.type = type;
      this.x = x;
      this.y = y;
      this.baseX = x;
      this.radius = stats.radius;
      this.maxHealth = stats.hp * (1 + difficulty * 0.33);
      this.health = this.maxHealth;
      this.speed = stats.speed * (1 + difficulty * 0.05);
      this.score = stats.score;
      this.contactDamage = stats.contact;
      this.color = stats.color;
      this.age = 0;
      this.phase = random(0, Math.PI * 2);
      this.shootTimer = random(1.2, 2.5);
      this.entrySide = 0;
      this.dead = false;
    }

    update(dt, game) {
      this.age += dt;
      if (this.entrySide) {
        this.x += this.entrySide * this.speed * 1.25 * dt;
        this.y += this.speed * .22 * dt;
        const safelyInside = this.entrySide > 0 ? this.x > this.radius + 12 : this.x < game.width - this.radius - 12;
        if (safelyInside) this.entrySide = 0;
        return;
      }
      if (this.type === "scout") {
        const dx = game.player.x - this.x;
        const dy = Math.max(80, game.player.y - this.y);
        const length = Math.hypot(dx, dy) || 1;
        this.x += (dx / length) * this.speed * 0.3 * dt;
        this.y += this.speed * dt;
      } else if (this.type === "zigzag") {
        this.y += this.speed * dt;
        this.x = this.baseX + Math.sin(this.age * 2.25 + this.phase) * Math.min(105, game.width * .14);
      } else if (this.type === "heavy") {
        this.y += this.speed * dt;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y < game.height * .72) {
          this.fireAtPlayer(game, 210, 14, "#ffad55");
          this.shootTimer = random(2.15, 3.0);
        }
      } else {
        this.y += this.speed * dt;
        const desired = game.player.x;
        this.x += clamp(desired - this.x, -75, 75) * dt * 0.52;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y < game.height * .6) {
          this.fireAtPlayer(game, 190, 11, "#ff62d0");
          this.shootTimer = random(2.5, 3.5);
        }
      }
      this.x = clamp(this.x, this.radius + 5, game.width - this.radius - 5);
      if (this.y > game.height + this.radius * 2) this.dead = true;
    }

    fireAtPlayer(game, speed, damage, color) {
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      const length = Math.hypot(dx, dy) || 1;
      game.enemyProjectiles.push(new Projectile(this.x, this.y + this.radius, dx / length * speed, dy / length * speed, false, { damage, color, radius: 7 }));
    }

    draw(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const scale = 1 + Math.sin(this.age * 4 + this.phase) * 0.025;
      ctx.scale(scale, scale);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.4;
      const grad = ctx.createLinearGradient(-25, -20, 25, 20);
      grad.addColorStop(0, "#752b68"); grad.addColorStop(.5, "#39285d"); grad.addColorStop(1, "#181b3d");
      ctx.fillStyle = grad;

      if (this.type === "scout") {
        ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-17, -10); ctx.lineTo(-7, -15); ctx.lineTo(0, -8); ctx.lineTo(7, -15); ctx.lineTo(17, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (this.type === "zigzag") {
        ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(-22, 3); ctx.lineTo(-16, -13); ctx.lineTo(-4, -8); ctx.lineTo(0, -17); ctx.lineTo(4, -8); ctx.lineTo(16, -13); ctx.lineTo(22, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (this.type === "heavy") {
        ctx.beginPath(); ctx.moveTo(0, 25); ctx.lineTo(-25, 13); ctx.lineTo(-27, -9); ctx.lineTo(-13, -22); ctx.lineTo(13, -22); ctx.lineTo(27, -9); ctx.lineTo(25, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#11172f"; ctx.fillRect(-17, -5, 34, 13);
        ctx.fillStyle = "#ffb15e"; ctx.fillRect(-21, 10, 7, 4); ctx.fillRect(14, 10, 7, 4);
      } else {
        ctx.rotate(Math.sin(time * 2 + this.phase) * .08);
        ctx.beginPath(); ctx.moveTo(0, 23); ctx.lineTo(-11, 7); ctx.lineTo(-25, 0); ctx.lineTo(-13, -16); ctx.lineTo(0, -9); ctx.lineTo(13, -16); ctx.lineTo(25, 0); ctx.lineTo(11, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, this.type === "heavy" ? -5 : 0, this.type === "heavy" ? 7 : 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (this.health < this.maxHealth && this.type !== "scout") {
        ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(-this.radius, -this.radius - 10, this.radius * 2, 4);
        ctx.fillStyle = this.color; ctx.fillRect(-this.radius, -this.radius - 10, this.radius * 2 * (this.health / this.maxHealth), 4);
      }
      ctx.restore();
    }
  }

  class Boss {
    constructor(width) {
      this.x = width / 2;
      this.y = -130;
      this.radius = 67;
      this.maxHealth = 1750;
      this.health = this.maxHealth;
      this.age = 0;
      this.attackTimer = 1.8;
      this.pattern = 0;
      this.entering = true;
      this.weakPhase = false;
      this.dead = false;
      this.score = 5000;
      this.contactDamage = 30;
    }

    update(dt, game) {
      this.age += dt;
      if (this.entering) {
        this.y += (128 - this.y) * Math.min(1, dt * 1.7);
        if (Math.abs(this.y - 128) < 2) {
          this.y = 128;
          this.entering = false;
          this.attackTimer = 1.2;
          game.showToast("VOID SENTINEL", "#ff7bdc");
        }
        return;
      }
      this.x = game.width * .5 + Math.sin(this.age * .43) * Math.min(210, game.width * .25);
      this.weakPhase = this.age % 12 > 8.2;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        if (this.pattern % 3 === 0) this.aimedFan(game);
        else if (this.pattern % 3 === 1) this.arcPattern(game);
        else this.sideLanes(game);
        this.pattern += 1;
        this.attackTimer = this.weakPhase ? 2.5 : 1.75;
      }
    }

    aimedFan(game) {
      const base = Math.atan2(game.player.y - this.y, game.player.x - this.x);
      for (let i = -2; i <= 2; i += 1) {
        const angle = base + i * .17;
        game.enemyProjectiles.push(new Projectile(this.x, this.y + 36, Math.cos(angle) * 175, Math.sin(angle) * 175, false, { damage: 12, radius: 9, color: "#ff54c8", fromBoss: true }));
      }
      game.audio.play("bossShot");
    }

    arcPattern(game) {
      for (let i = 0; i < 7; i += 1) {
        const angle = Math.PI * .2 + (Math.PI * .6 / 6) * i;
        game.enemyProjectiles.push(new Projectile(this.x, this.y + 30, Math.cos(angle) * 155, Math.sin(angle) * 155, false, { damage: 11, radius: 9, color: "#ad6cff", fromBoss: true }));
      }
      game.audio.play("bossShot");
    }

    sideLanes(game) {
      [-46, 46].forEach((offset) => {
        for (let i = -1; i <= 1; i += 1) {
          const angle = Math.PI / 2 + i * .11;
          game.enemyProjectiles.push(new Projectile(this.x + offset, this.y + 20, Math.cos(angle) * 165, Math.sin(angle) * 165, false, { damage: 11, radius: 8, color: "#ff9363", fromBoss: true }));
        }
      });
      game.audio.play("bossShot");
    }

    draw(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const hover = Math.sin(time * 2.2) * 3;
      ctx.translate(0, hover);
      ctx.shadowColor = this.weakPhase ? "#ffdf70" : "#d957ff";
      ctx.shadowBlur = this.weakPhase ? 28 : 18;
      const hull = ctx.createLinearGradient(-70, -45, 70, 55);
      hull.addColorStop(0, "#8a3faf"); hull.addColorStop(.45, "#342657"); hull.addColorStop(1, "#12162f");
      ctx.fillStyle = hull;
      ctx.strokeStyle = this.weakPhase ? "#ffe072" : "#ef77f1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 66); ctx.lineTo(-22, 35); ctx.lineTo(-67, 29); ctx.lineTo(-88, -4); ctx.lineTo(-51, -30); ctx.lineTo(-20, -19); ctx.lineTo(0, -48); ctx.lineTo(20, -19); ctx.lineTo(51, -30); ctx.lineTo(88, -4); ctx.lineTo(67, 29); ctx.lineTo(22, 35); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#151431";
      ctx.beginPath(); ctx.moveTo(-63, -4); ctx.lineTo(-25, -13); ctx.lineTo(-15, 17); ctx.lineTo(-51, 19); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(63, -4); ctx.lineTo(25, -13); ctx.lineTo(15, 17); ctx.lineTo(51, 19); ctx.closePath(); ctx.fill();
      const core = this.weakPhase ? "#ffe872" : "#e652e8";
      ctx.fillStyle = core;
      ctx.shadowColor = core; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(0, 5, this.weakPhase ? 14 + Math.sin(time * 12) * 2 : 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,150,245,.55)";
      ctx.beginPath(); ctx.arc(0, 5, 31 + Math.sin(time * 2) * 3, 0, Math.PI * 2); ctx.stroke();
      if (this.entering) {
        ctx.globalAlpha = .5 + Math.sin(time * 10) * .25;
        ctx.fillStyle = "#fff"; ctx.fillRect(-90, -2, 180, 3);
      }
      ctx.restore();
    }
  }

  const POWERUPS = {
    shield: { icon: "S", color: "#4deaff", label: "SHIELD RECHARGE" },
    rapid: { icon: "R", color: "#ffd35e", label: "RAPID FIRE" },
    triple: { icon: "3", color: "#a984ff", label: "TRIPLE LASER" },
    repair: { icon: "+", color: "#69f19a", label: "HULL REPAIR" },
    invincible: { icon: "I", color: "#fff08a", label: "INVINCIBLE" },
    drone: { icon: "D", color: "#ff89dc", label: "DRONE COMPANION" },
  };

  class PowerUp {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type || Object.keys(POWERUPS)[Math.floor(Math.random() * Object.keys(POWERUPS).length)];
      this.radius = 20;
      this.speed = 68;
      this.age = 0;
      this.dead = false;
    }

    update(dt, game) {
      this.age += dt;
      this.y += this.speed * dt;
      this.x += Math.sin(this.age * 2.5) * 18 * dt;
      if (this.y > game.height + 35) this.dead = true;
    }

    apply(player, game) {
      if (this.type === "shield") player.shield = Math.min(C.PLAYER.maxShield, player.shield + 55);
      else if (this.type === "repair") player.health = Math.min(C.PLAYER.maxHealth, player.health + 35);
      else if (this.type === "rapid") player.rapidFire = Math.max(player.rapidFire, C.POWERUP.duration);
      else if (this.type === "triple") player.tripleLaser = Math.max(player.tripleLaser, C.POWERUP.duration);
      else if (this.type === "invincible") player.invincible = Math.max(player.invincible, C.POWERUP.invincibilityDuration);
      else if (this.type === "drone") player.droneTime = Math.max(player.droneTime, C.POWERUP.droneDuration);
      game.audio.play("powerup");
      game.effects.wave(this.x, this.y, 75, POWERUPS[this.type].color);
      game.showToast(POWERUPS[this.type].label, POWERUPS[this.type].color);
      this.dead = true;
    }

    draw(ctx) {
      const data = POWERUPS[this.type];
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.age * .7);
      ctx.shadowColor = data.color; ctx.shadowBlur = 18;
      ctx.strokeStyle = data.color; ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(15,22,67,.88)";
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = i * Math.PI / 3 - Math.PI / 2;
        const px = Math.cos(a) * 18, py = Math.sin(a) * 18;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-this.age * .7);
      ctx.fillStyle = "#fff"; ctx.font = "900 17px 'Exo 2', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(data.icon, 0, 0);
      ctx.restore();
    }
  }

  class CompanionDrone {
    constructor(side) {
      this.side = side || 1;
      this.x = 0;
      this.y = 0;
      this.fireTimer = 0;
    }

    update(dt, game) {
      const targetX = game.player.x + this.side * 38;
      const targetY = game.player.y + 14;
      this.x += (targetX - this.x) * Math.min(1, dt * 8);
      this.y += (targetY - this.y) * Math.min(1, dt * 8);
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        game.playerProjectiles.push(new Projectile(this.x, this.y - 10, 0, -620, true, { damage: 10, radius: 4, color: "#ff8cdd" }));
        this.fireTimer = .42;
      }
    }

    draw(ctx, time) {
      ctx.save(); ctx.translate(this.x, this.y + Math.sin(time * 5) * 2);
      ctx.shadowColor = "#ff76d7"; ctx.shadowBlur = 11;
      ctx.fillStyle = "#38234f"; ctx.strokeStyle = "#ff85d9"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(11, 0); ctx.lineTo(5, 9); ctx.lineTo(-5, 9); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  Starfall.Projectile = Projectile;
  Starfall.Player = Player;
  Starfall.Enemy = Enemy;
  Starfall.Boss = Boss;
  Starfall.PowerUp = PowerUp;
  Starfall.CompanionDrone = CompanionDrone;
  Starfall.POWERUPS = POWERUPS;
})();
