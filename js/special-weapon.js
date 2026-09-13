(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game || !window.Starfall || !Starfall.Projectile || !Starfall.Boss) return;

    const T = Starfall.THEME;
    const BasePowerUp = Starfall.PowerUp;
    const originalPowerUpDraw = BasePowerUp && BasePowerUp.prototype.draw;

    game.roninSpears = 0;
    game.maxRoninSpears = 2;

    const hud = document.getElementById("hud");
    if (hud) {
      const badge = document.createElement("div");
      badge.id = "ronin-spear-badge";
      badge.innerHTML = '<span>RONIN SPEAR</span><strong>×0</strong><small>3× TAP ON BOSS</small>';
      hud.appendChild(badge);
      game.roninSpearBadge = badge;
    }

    function updateBadge() {
      const badge = game.roninSpearBadge;
      if (!badge) return;
      badge.querySelector("strong").textContent = `×${game.roninSpears}`;
      badge.classList.toggle("armed", game.roninSpears > 0);
      badge.classList.toggle("boss-live", Boolean(game.boss && !game.boss.dead));
    }
    game.updateRoninSpearBadge = updateBadge;

    class RoninSpearPickup extends BasePowerUp {
      constructor(x, y) {
        super(x, y, "shield");
        this.type = "ronin-spear";
        this.networkKind = "ronin-spear-pickup";
        this.radius = 21;
        this.speed = 58;
      }
      apply(player, activeGame) {
        const converted = activeGame.roninSpears >= activeGame.maxRoninSpears;
        if (converted) {
          player.shield = Math.min(Starfall.CONFIG.PLAYER.maxShield, player.shield + 18);
          activeGame.showToast("RONIN SPEAR CACHE FULL\nSHIELD CONVERTED", T.cyan);
        } else {
          activeGame.roninSpears += 1;
          activeGame.showToast("RONIN SPEAR ACQUIRED\n3× TAP DURING BOSS", T.amber);
          activeGame.effects.wave(this.x, this.y, 92, T.amber);
          activeGame.audio.play("powerup");
        }
        if (activeGame.onlineRole === "host" && window.coopClient && typeof window.coopClient.queueFx === "function") {
          window.coopClient.queueFx("ronin_pickup", { x: this.x / activeGame.width, y: this.y / activeGame.height, converted });
        }
        updateBadge();
        this.dead = true;
      }
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.sin(this.age * 2.2) * .18);
        ctx.strokeStyle = T.amber;
        ctx.fillStyle = T.navy;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -24); ctx.lineTo(9, -5); ctx.lineTo(5, 19); ctx.lineTo(0, 25); ctx.lineTo(-5, 19); ctx.lineTo(-9, -5); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.cyan;
        ctx.fillRect(-2, -13, 4, 23);
        ctx.fillStyle = T.amber;
        ctx.fillRect(-5, 17, 10, 4);
        ctx.restore();
      }
    }

    class RoninSpearProjectile {
      constructor(source, target) {
        this.x = source.x;
        this.y = source.y - 24;
        this.target = target;
        this.radius = 10;
        this.speed = 520;
        this.dead = false;
        this.life = 3.2;
        this.angle = -Math.PI / 2;
        this.networkKind = "ronin-spear-projectile";
      }
      update(dt) {
        if (!this.target || this.target.dead) { this.dead = true; return; }
        const wp = typeof this.target.weakPoint === "function" ? this.target.weakPoint() : { x: this.target.x, y: this.target.y };
        const dx = wp.x - this.x, dy = wp.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.angle = Math.atan2(dy, dx);
        this.x += dx / len * this.speed * dt;
        this.y += dy / len * this.speed * dt;
        this.life -= dt;
        if (len < 24) this.hit();
        if (this.life <= 0) this.dead = true;
      }
      hit() {
        if (this.dead || !this.target || this.target.dead) return;
        const g = window.starfallGame;
        const boss = this.target;
        const base = 420 + Math.min(240, (g.stage || 0) * 35);
        const wp = typeof boss.weakPoint === "function" ? boss.weakPoint() : null;
        let multiplier = 1;
        if (wp && wp.active) multiplier = 1.35;
        if (boss.combatIndex === 4 && boss.nodeBroken && (!boss.nodeBroken[0] || !boss.nodeBroken[1])) multiplier = .72;

        boss.specialHitFlash = .9;
        boss.specialHitKick = 18;
        g.effects.wave(boss.x, boss.y, 210, T.amber);
        g.effects.burst(boss.x, boss.y, T.amber, 42, 340);
        g.effects.text(boss.x, boss.y + 72, "RONIN SPEAR!", T.amber, 24);
        g.showToast("DIRECT SPEAR IMPACT", T.amber);
        g.shake = Math.max(g.shake, 16);
        if (g.audio) {
          g.audio.play("explosion");
          g.audio.tone(95, 38, .42, "sawtooth", .17);
          g.audio.tone(760, 130, .26, "triangle", .08, .03);
        }
        if (g.onlineRole === "host" && window.coopClient && typeof window.coopClient.queueFx === "function") {
          window.coopClient.queueFx("ronin_impact", { x: boss.x / g.width, y: boss.y / g.height });
        }
        g.damageBoss(base * multiplier);
        this.dead = true;
      }
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((Number.isFinite(this.angle) ? this.angle : -Math.PI / 2) + Math.PI / 2);
        ctx.strokeStyle = T.amber;
        ctx.fillStyle = T.ivory;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(7, 5); ctx.lineTo(4, 15); ctx.lineTo(-4, 15); ctx.lineTo(-7, 5); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = T.cyan;
        ctx.fillRect(-2, 12, 4, 17);
        ctx.restore();
      }
    }

    Starfall.RoninSpearPickup = RoninSpearPickup;
    Starfall.RoninSpearProjectile = RoninSpearProjectile;

    game.roninSpearProjectiles = [];
    game.activateRoninSpear = function (playerIndex) {
      if (this.state !== "playing" || !this.boss || this.boss.dead || this.boss.entering) {
        if (this.roninSpears > 0) this.showToast("RONIN SPEAR\nSAVE IT FOR THE BOSS", T.muted);
        return false;
      }
      if (this.roninSpears <= 0) {
        this.showToast("NO RONIN SPEAR", T.muted);
        return false;
      }
      const sourceIndex = playerIndex == null ? this.localPlayerIndex : Number(playerIndex);
      if (this.onlineRole === "guest") {
        if (!window.coopClient || typeof window.coopClient.sendRoninSpear !== "function") return false;
        window.coopClient.sendRoninSpear();
        this.showToast("RONIN SPEAR LAUNCHED", T.amber);
        return true;
      }
      const source = this.players?.[sourceIndex] || this.getLocalPlayer();
      if (!source || source.dead) return false;
      this.roninSpears -= 1;
      this.roninSpearProjectiles.push(new RoninSpearProjectile(source, this.boss));
      if (this.onlineRole === "host" && window.coopClient && typeof window.coopClient.queueFx === "function") {
        window.coopClient.queueFx("ronin_launch", { playerIndex: sourceIndex });
      }
      this.showToast("RONIN SPEAR LAUNCHED", T.amber);
      if (this.audio) this.audio.tone(220, 920, .24, "sawtooth", .12);
      updateBadge();
      return true;
    };

    const originalResetWorld = game.resetWorld.bind(game);
    game.resetWorld = function () {
      const result = originalResetWorld();
      this.roninSpears = 0;
      this.roninSpearProjectiles = [];
      updateBadge();
      return result;
    };

    const originalUpdate = game.update.bind(game);
    game.update = function (dt) {
      const result = originalUpdate(dt);
      for (const spear of this.roninSpearProjectiles) spear.update(dt);
      this.roninSpearProjectiles = this.roninSpearProjectiles.filter((spear) => !spear.dead);
      if (this.boss) {
        this.boss.specialHitFlash = Math.max(0, (this.boss.specialHitFlash || 0) - dt);
        this.boss.specialHitKick = Math.max(0, (this.boss.specialHitKick || 0) - dt * 40);
      }
      updateBadge();
      return result;
    };

    const originalDraw = game.draw.bind(game);
    game.draw = function () {
      originalDraw();
      if (!this.roninSpearProjectiles.length || this.state === "menu") return;
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const spear of this.roninSpearProjectiles) spear.draw(ctx);
      ctx.restore();
    };

    const originalDestroyEnemy = game.destroyEnemy.bind(game);
    game.destroyEnemy = function (enemy, byPulse, collision) {
      const x = enemy.x, y = enemy.y;
      const elite = enemy.archetype && enemy.archetype !== "";
      originalDestroyEnemy(enemy, byPulse, collision);
      if (collision || this.roninSpears >= this.maxRoninSpears) return;
      const stage = this.stage || 0;
      if (stage < 1) return;
      const chance = elite ? .055 : .012;
      if (Math.random() < chance) this.powerups.push(new RoninSpearPickup(x, y));
    };

    // Strong, readable feedback when normal fire actually strikes a boss weak point.
    const bossProto = Starfall.Boss.prototype;
    if (typeof bossProto.receiveLaser === "function") {
      const originalReceiveLaser = bossProto.receiveLaser;
      bossProto.receiveLaser = function (laser, activeGame) {
        const wp = typeof this.weakPoint === "function" ? this.weakPoint() : null;
        const weak = wp && wp.active && ((laser.x - wp.x) ** 2 + (laser.y - wp.y) ** 2 <= (laser.radius + wp.r) ** 2);
        if (weak) {
          this.weakHitFlash = .18;
          this.weakHitCount = (this.weakHitCount || 0) + 1;
          activeGame.effects.burst(wp.x, wp.y, T.cyan, 8, 120);
          if (this.weakHitCount % 5 === 1) activeGame.effects.text(wp.x, wp.y - 26, "WEAK HIT", T.cyan, 14);
        }
        return originalReceiveLaser.call(this, laser, activeGame);
      };

      const originalBossDraw = bossProto.draw;
      bossProto.draw = function (ctx, time) {
        const kick = this.specialHitKick || 0;
        if (kick > 0) {
          ctx.save();
          ctx.translate(Math.sin(time * 55) * Math.min(10, kick), Math.cos(time * 47) * Math.min(5, kick));
          originalBossDraw.call(this, ctx, time);
          ctx.restore();
        } else {
          originalBossDraw.call(this, ctx, time);
        }

        if (this.weakHitFlash > 0 || this.specialHitFlash > 0) {
          const wp = typeof this.weakPoint === "function" ? this.weakPoint() : { x: this.x, y: this.y, r: 20 };
          ctx.save();
          ctx.globalAlpha = this.specialHitFlash > 0 ? .9 : .55;
          ctx.strokeStyle = this.specialHitFlash > 0 ? T.amber : T.cyan;
          ctx.lineWidth = this.specialHitFlash > 0 ? 5 : 3;
          ctx.beginPath(); ctx.arc(wp.x, wp.y, (wp.r || 20) + (this.specialHitFlash > 0 ? 16 : 6), 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        this.weakHitFlash = Math.max(0, (this.weakHitFlash || 0) - .03);
      };
    }

    updateBadge();
  });
})();
