(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game || !window.Starfall || !Starfall.THEME) return;

    const T = Starfall.THEME;
    const Projectile = Starfall.Projectile;
    const BaseEnemy = Starfall.Enemy;
    const BaseBoss = Starfall.Boss;

    const params = new URLSearchParams(window.location.search);
    const fastTest = params.get("test") === "1";
    const requestedBossDelay = Number(params.get("boss"));
    const bossDelay = fastTest ? Math.max(4, Math.min(45, Number.isFinite(requestedBossDelay) && requestedBossDelay > 0 ? requestedBossDelay : 12)) : null;

    // Keep the constant auto-fire sound comfortably behind music and impacts.
    // This intentionally replaces only the laser branch; all other stage-aware SFX stay intact.
    if (game.audio) {
      const audio = game.audio;
      const previousPlay = audio.play.bind(audio);
      audio.play = function (name) {
        if (name !== "laser") return previousPlay(name);
        const now = performance.now();
        if (now - this.lastLaser < 78) return;
        this.lastLaser = now;
        const stage = Math.min(10, this.stageIntensity || 0);
        this.tone(810 + stage * 8, 430 + stage * 5, 0.065, "square", 0.034);
        if (stage >= 3 && Math.random() < .13) this.tone(1030 + stage * 12, 590, .038, "triangle", .009);
      };
    }

    // Stage-specific scenery is inserted at the environment boundary, so it
    // remains behind ships/projectiles and survives world changes.
    const environment = game.environment;
    const originalEnvironmentDraw = environment.draw.bind(environment);
    environment.draw = function (ctx) {
      originalEnvironmentDraw(ctx);
      const stage = Math.max(0, game.stage || 0);
      const scene = stage % 6;
      const w = game.width, h = game.height;
      const drift = (game.backgroundTime * (7 + Math.min(stage, 8))) % Math.max(1, h);
      ctx.save();
      ctx.globalAlpha = .18 + Math.min(.10, stage * .012);
      ctx.lineWidth = 2;
      ctx.strokeStyle = T.muted;
      ctx.fillStyle = T.steel;

      if (scene === 0) {
        // Jade dock: torii-like orbital gantries.
        for (let i = 0; i < 4; i++) {
          const y = ((i * h / 3 + drift * .22) % (h + 180)) - 90;
          const span = Math.min(w * .32, 230);
          ctx.fillRect(w * .5 - span, y, span * 2, 5);
          ctx.fillRect(w * .5 - span * .78, y - 10, span * 1.56, 3);
          ctx.fillRect(w * .5 - span * .68, y, 5, 42);
          ctx.fillRect(w * .5 + span * .68 - 5, y, 5, 42);
        }
      } else if (scene === 1) {
        // Violet Tide: distant orbital rings and antenna clusters.
        ctx.strokeStyle = T.coral;
        for (let i = 0; i < 3; i++) {
          const x = w * (.22 + i * .29);
          const y = h * (.2 + (i % 2) * .28);
          ctx.beginPath(); ctx.ellipse(x, y, 85 + i * 24, 23 + i * 7, -.25, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x, y + 70); ctx.stroke();
        }
      } else if (scene === 2) {
        // Ember Reach: industrial furnace towers and luminous exhaust stacks.
        for (let i = 0; i < 7; i++) {
          const x = (i + .35) * w / 7;
          const bh = 55 + (i % 3) * 38;
          ctx.fillRect(x - 16, h - bh, 32, bh);
          ctx.fillRect(x - 5, h - bh - 50, 10, 50);
          ctx.fillStyle = T.amber; ctx.globalAlpha = .12;
          ctx.beginPath(); ctx.arc(x, h - bh - 62, 18 + (i % 2) * 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = T.steel; ctx.globalAlpha = .22;
        }
      } else if (scene === 3) {
        // Azure Veil: huge suspended arcology ribs.
        ctx.strokeStyle = T.cyan;
        for (let i = 0; i < 5; i++) {
          const y = ((i * 180 + drift * .35) % (h + 220)) - 110;
          ctx.beginPath();
          ctx.arc(w * .5, y, Math.min(w * .42, 310), Math.PI * .12, Math.PI * .88);
          ctx.stroke();
          ctx.beginPath(); ctx.moveTo(w * .16, y + 60); ctx.lineTo(w * .84, y + 60); ctx.stroke();
        }
      } else if (scene === 4) {
        // Crimson Moon: fortress silhouettes and blade-like pylons.
        ctx.strokeStyle = T.coral;
        for (let i = 0; i < 6; i++) {
          const x = i * w / 5;
          const top = h * (.25 + (i % 3) * .1);
          ctx.beginPath(); ctx.moveTo(x - 45, h); ctx.lineTo(x, top); ctx.lineTo(x + 45, h); ctx.closePath(); ctx.stroke();
          ctx.fillRect(x - 3, top - 45, 6, 45);
        }
      } else {
        // Ghost Nebula: derelict station fragments and slow debris slabs.
        ctx.strokeStyle = T.ivory;
        for (let i = 0; i < 8; i++) {
          const x = (i * 137 + stage * 29) % (w + 120) - 60;
          const y = ((i * 191 + drift * .18) % (h + 160)) - 80;
          ctx.save(); ctx.translate(x, y); ctx.rotate((i % 3 - 1) * .22);
          ctx.strokeRect(-28, -8, 56, 16);
          ctx.beginPath(); ctx.moveTo(-42, 0); ctx.lineTo(42, 0); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    };

    class RoninInterceptor extends BaseEnemy {
      constructor(x, y, difficulty) {
        super("hunter", x, y, difficulty);
        this.archetype = "RONIN INTERCEPTOR";
        this.speed *= 1.05;
        this.maxHealth *= 1.08;
        this.health = this.maxHealth;
        this.shootTimer = 1.35;
      }
      update(dt, activeGame) {
        this.age += dt;
        const target = activeGame.getTargetPlayer ? activeGame.getTargetPlayer(this) : activeGame.player;
        const leadX = target.x + (target.targetX - target.x) * .42;
        this.x += Math.max(-105, Math.min(105, leadX - this.x)) * dt * .78;
        this.y += this.speed * .62 * dt;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y < activeGame.height * .67) {
          this.fireAtPlayer(activeGame, 205, 11, T.coral);
          this.shootTimer = 1.75 + Math.random() * .8;
        }
        this.x = Math.max(this.radius + 5, Math.min(activeGame.width - this.radius - 5, this.x));
        if (this.y > activeGame.height + 60) this.dead = true;
      }
      draw(ctx, time) {
        super.draw(ctx, time);
        ctx.save(); ctx.translate(this.x, this.y); ctx.strokeStyle = T.cyan; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.moveTo(-29, -4); ctx.lineTo(-18, -17); ctx.moveTo(29, -4); ctx.lineTo(18, -17); ctx.stroke();
        ctx.restore();
      }
    }

    class ShrineLancer extends BaseEnemy {
      constructor(x, y, difficulty) {
        super("zigzag", x, y, difficulty);
        this.archetype = "SHRINE LANCER";
        this.maxHealth *= 1.22;
        this.health = this.maxHealth;
        this.speed *= .82;
        this.shootTimer = 1.8;
      }
      update(dt, activeGame) {
        this.age += dt;
        this.y += this.speed * dt;
        this.x = this.baseX + Math.sin(this.age * 1.7 + this.phase) * Math.min(130, activeGame.width * .17);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y > 70 && this.y < activeGame.height * .57) {
          const target = activeGame.getTargetPlayer ? activeGame.getTargetPlayer(this) : activeGame.player;
          const dx = target.x - this.x, dy = target.y - this.y, len = Math.hypot(dx, dy) || 1;
          const speed = 185 + Math.min(35, (activeGame.stage || 0) * 4);
          activeGame.enemyProjectiles.push(new Projectile(this.x, this.y + 14, dx / len * speed, dy / len * speed, false, { damage: 12, radius: 6, color: T.amber }));
          this.shootTimer = 2.25 + Math.random() * .7;
        }
        if (this.y > activeGame.height + 50) this.dead = true;
      }
      draw(ctx, time) {
        super.draw(ctx, time);
        ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = T.amber; ctx.globalAlpha = .85;
        ctx.fillRect(-2, -27, 4, 22); ctx.fillRect(-13, -22, 26, 3); ctx.restore();
      }
    }

    const BOSS_PROFILES = [
      { name: "KAGE WARDEN", title: "KEEPER OF THE JADE GATE", accent: "cyan" },
      { name: "TORII REAPER", title: "BLADE OF THE VIOLET TIDE", accent: "amber" },
      { name: "ASHEN SHOGUN", title: "WARLORD OF EMBER REACH", accent: "coral" },
      { name: "VEIL ORACLE", title: "EYE OF THE AZURE VEIL", accent: "cyan" },
      { name: "CRIMSON DAIMYO", title: "LORD OF THE RED FORTRESS", accent: "coral" },
      { name: "PALE ONI", title: "GHOST OF THE DEAD ORBIT", accent: "ivory" },
    ];

    Starfall.Boss = class CharacterBoss extends BaseBoss {
      constructor(width) {
        super(width);
        this.profileIndex = Math.max(0, window.starfallGame?.stage || 0) % BOSS_PROFILES.length;
        this.profile = BOSS_PROFILES[this.profileIndex];
        this.pattern = this.profileIndex;
      }
      update(dt, activeGame) {
        super.update(dt, activeGame);
        if (!this.entering && !this.__introduced) {
          this.__introduced = true;
          activeGame.showToast(`${this.profile.name}\n${this.profile.title}`, T[this.profile.accent] || T.coral);
        }
        if (!this.entering && this.profileIndex === 1) this.x += Math.sin(this.age * 1.7) * .45;
        if (!this.entering && this.profileIndex === 3 && this.attackTimer > 0) this.attackTimer -= dt * .08;
        if (!this.entering && this.profileIndex === 4 && this.weakPhase) this.attackTimer -= dt * .12;
      }
      draw(ctx, time) {
        super.draw(ctx, time);
        const color = T[this.profile.accent] || T.coral;
        ctx.save(); ctx.translate(this.x, this.y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = .72; ctx.lineWidth = 2;
        if (this.profileIndex === 0) {
          ctx.beginPath(); ctx.arc(0, 5, 31, 0, Math.PI * 2); ctx.stroke();
        } else if (this.profileIndex === 1) {
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 48, -25); ctx.lineTo(s * 96, -53); ctx.lineTo(s * 69, 4); ctx.stroke(); }
        } else if (this.profileIndex === 2) {
          ctx.beginPath(); ctx.moveTo(-55, -30); ctx.lineTo(-26, -62); ctx.lineTo(0, -43); ctx.lineTo(26, -62); ctx.lineTo(55, -30); ctx.stroke();
        } else if (this.profileIndex === 3) {
          ctx.beginPath(); ctx.ellipse(0, 4, 47, 18, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 4, 5 + Math.sin(time * 4) * 2, 0, Math.PI * 2); ctx.fill();
        } else if (this.profileIndex === 4) {
          for (const s of [-1, 1]) { ctx.fillRect(s * 61 - 3, -44, 6, 65); ctx.beginPath(); ctx.moveTo(s * 61, -44); ctx.lineTo(s * 81, -64); ctx.stroke(); }
        } else {
          ctx.beginPath(); ctx.arc(0, 4, 44, Math.PI * .15, Math.PI * .85); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 4, 58, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        }
        ctx.restore();
      }
    };

    const originalSummonBoss = game.summonBoss.bind(game);
    game.summonBoss = function () {
      originalSummonBoss();
      if (this.boss && this.ui && this.ui["boss-hud"]) {
        const label = this.ui["boss-hud"].querySelector("span");
        if (label && this.boss.profile) label.textContent = this.boss.profile.name;
      }
    };

    // Advanced enemies arrive gradually: one archetype from sector 3, another from sector 4.
    game.advancedEnemyTimer = 8;
    const originalUpdate = game.update.bind(game);
    game.update = function (dt) {
      const result = originalUpdate(dt);
      const stage = this.stage || 0;
      if (stage >= 2 && !this.boss) {
        this.advancedEnemyTimer -= dt;
        if (this.advancedEnemyTimer <= 0) {
          const difficulty = Math.min(1.8, this.elapsed / Starfall.CONFIG.SPAWN.difficultyRampSeconds + stage * .08);
          const margin = 45;
          if (stage >= 3 && Math.random() < .44) this.enemies.push(new ShrineLancer(margin + Math.random() * (this.width - margin * 2), -45, difficulty));
          else this.enemies.push(new RoninInterceptor(margin + Math.random() * (this.width - margin * 2), -45, difficulty));
          this.advancedEnemyTimer = Math.max(6.5, 12.5 - Math.min(stage, 8) * .45) + Math.random() * 3;
        }
      }
      return result;
    };

    // Developer-only fast boss cycle via ?test=1 or ?test=1&boss=6.
    if (fastTest) {
      const previousReset = game.resetWorld.bind(game);
      game.resetWorld = function () {
        const result = previousReset();
        this.nextBossTime = this.elapsed + bossDelay;
        this.advancedEnemyTimer = Math.min(5, bossDelay * .45);
        return result;
      };
      const previousDestroyBoss = game.destroyBoss.bind(game);
      game.destroyBoss = function () {
        previousDestroyBoss();
        this.nextBossTime = this.elapsed + bossDelay;
      };
      // Existing world was created before this wrapper was installed.
      game.nextBossTime = game.elapsed + bossDelay;
      console.info(`[Starfall test mode] Boss interval: ${bossDelay}s`);
    }
  });
})();
