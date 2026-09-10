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
      const T=Starfall.THEME; ctx.save(); ctx.translate(this.x,this.y);
      const color=this.friendly?T.cyan:T.coral;
      if(this.friendly) {
        ctx.rotate(Math.atan2(this.vy,this.vx)+Math.PI/2);
        ctx.fillStyle=color; ctx.fillRect(-2,-this.radius*2,4,this.radius*4);
        ctx.fillStyle=T.ivory; ctx.fillRect(-.75,-this.radius*2,1.5,this.radius*4);
      } else {
        T.disc(ctx,0,0,this.radius,color); T.disc(ctx,0,0,this.radius*.48,T.navy);
        T.disc(ctx,0,0,1.5,T.ivory);
      }
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
      const T=Starfall.THEME;
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.tilt);
      if(this.damageCooldown>0) ctx.globalAlpha=.65;
      if(this.invincible>0 || (this.shield>0 && this.damageCooldown>0)) {
        ctx.strokeStyle=this.invincible>0?T.amber:T.cyan; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,0,29,0,Math.PI*2); ctx.stroke();
      }
      T.ship(ctx,'player',time); ctx.restore();
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
      const T=Starfall.THEME;
      ctx.save(); ctx.translate(this.x,this.y); T.ship(ctx,this.type,time);
      if(this.health<this.maxHealth && this.type!=='scout') {
        ctx.fillStyle=T.navy; ctx.fillRect(-this.radius,-this.radius-10,this.radius*2,3);
        ctx.fillStyle=T.coral; ctx.fillRect(-this.radius,-this.radius-10,this.radius*2*this.health/this.maxHealth,3);
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
      ctx.save(); ctx.translate(this.x,this.y);
      Starfall.THEME.ship(ctx,'boss',time,this.weakPhase); ctx.restore();
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
      const T=Starfall.THEME, data=POWERUPS[this.type];
      ctx.save(); ctx.translate(this.x,this.y);
      T.poly(ctx,[[0,-19],[17,-9],[17,9],[0,19],[-17,9],[-17,-9]],T.navy,data.color);
      T.icon(ctx,this.type,data.color); ctx.restore();
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
      ctx.save(); ctx.translate(this.x,this.y); Starfall.THEME.ship(ctx,'drone',time); ctx.restore();
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
