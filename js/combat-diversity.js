(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game || !window.Starfall || !Starfall.Projectile || !Starfall.Boss || !Starfall.Enemy) return;

    const T = Starfall.THEME;
    const Projectile = Starfall.Projectile;
    const BaseBoss = Starfall.Boss;
    const BaseEnemy = Starfall.Enemy;
    const clamp = Starfall.clamp;

    function fireAngle(g, x, y, angle, speed, damage, radius, color, extras) {
      const p = new Projectile(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, false, {
        damage, radius, color, fromBoss: Boolean(extras && extras.fromBoss),
      });
      if (extras) Object.assign(p, extras);
      g.enemyProjectiles.push(p);
      return p;
    }

    function aimAngle(from, target) {
      return Math.atan2(target.y - from.y, target.x - from.x);
    }

    function targetOf(g, from) {
      return g.getTargetPlayer ? g.getTargetPlayer(from) : g.player;
    }

    function dist2(x1, y1, x2, y2) {
      const dx = x1 - x2, dy = y1 - y2;
      return dx * dx + dy * dy;
    }

    const BOSS_RULES = [
      { key: "gate", weak: "CORE APERTURE", note: "Core opens between radial volleys" },
      { key: "blade", weak: "ALTERNATING WING", note: "Strike the glowing blade" },
      { key: "vent", weak: "VENT CORE", note: "Vulnerable after furnace barrage" },
      { key: "oracle", weak: "ORBITAL EYE", note: "Track the active eye" },
      { key: "nodes", weak: "SHIELD NODES", note: "Break both pylons, then the core" },
      { key: "mask", weak: "SHIFTING MASK", note: "Weak point changes sides after each attack" },
    ];

    class TacticalBoss extends BaseBoss {
      constructor(width) {
        super(width);
        this.combatIndex = Math.max(0, window.starfallGame?.stage || 0) % 6;
        this.rule = BOSS_RULES[this.combatIndex];
        this.attackClock = .9;
        this.specialClock = 3.5;
        this.vulnerableClock = 0;
        this.activeSide = 1;
        this.nodeHP = [150, 150];
        this.nodeBroken = [false, false];
        this.eyeAngle = 0;
        this.teleportClock = 4.5;
        this.phaseStep = 0;
        this.attackTimer = 999;
      }

      weakPoint() {
        const i = this.combatIndex;
        if (i === 0) return { x: this.x, y: this.y + 5, r: 18, active: this.vulnerableClock > 0 };
        if (i === 1) return { x: this.x + this.activeSide * 62, y: this.y - 5, r: 22, active: true };
        if (i === 2) return { x: this.x, y: this.y + 30, r: 20, active: this.vulnerableClock > 0 };
        if (i === 3) {
          const a = this.eyeAngle + this.phaseStep * Math.PI * 2 / 3;
          return { x: this.x + Math.cos(a) * 48, y: this.y + 4 + Math.sin(a) * 24, r: 17, active: true };
        }
        if (i === 4) {
          if (!this.nodeBroken[0]) return { x: this.x - 62, y: this.y - 8, r: 19, active: true, node: 0 };
          if (!this.nodeBroken[1]) return { x: this.x + 62, y: this.y - 8, r: 19, active: true, node: 1 };
          return { x: this.x, y: this.y + 10, r: 21, active: true };
        }
        return { x: this.x + this.activeSide * 34, y: this.y + 18, r: 18, active: true };
      }

      receiveLaser(laser, g) {
        const wp = this.weakPoint();
        const onWeak = wp.active && dist2(laser.x, laser.y, wp.x, wp.y) <= Math.pow(laser.radius + wp.r, 2);
        let amount = laser.damage;

        if (this.combatIndex === 4 && wp.node != null && onWeak) {
          this.nodeHP[wp.node] -= amount;
          g.effects.burst(wp.x, wp.y, T.amber, 5, 85);
          if (this.nodeHP[wp.node] <= 0 && !this.nodeBroken[wp.node]) {
            this.nodeBroken[wp.node] = true;
            g.showToast(wp.node === 0 ? "LEFT SHIELD NODE DOWN" : "RIGHT SHIELD NODE DOWN", T.amber);
            g.effects.wave(wp.x, wp.y, 75, T.amber);
          }
          return;
        }

        if (onWeak) {
          amount *= this.combatIndex === 3 ? 1.9 : 1.7;
          g.effects.burst(wp.x, wp.y, T.amber, 6, 95);
          g.damageBoss(amount);
        } else {
          const armorScale = (this.combatIndex === 0 || this.combatIndex === 2 || this.combatIndex === 4) ? .18 : .38;
          g.effects.burst(laser.x, laser.y, T.muted, 2, 45);
          g.damageBoss(amount * armorScale);
        }
      }

      update(dt, g) {
        this.age += dt;
        this.eyeAngle += dt * .9;
        this.vulnerableClock = Math.max(0, this.vulnerableClock - dt);

        if (this.entering) {
          this.y += (128 - this.y) * Math.min(1, dt * 1.8);
          if (Math.abs(this.y - 128) < 2) {
            this.y = 128;
            this.entering = false;
            this.attackClock = .65;
            const profile = this.profile;
            if (profile) g.showToast(`${profile.name}\n${this.rule.weak}: ${this.rule.note}`, T[profile.accent] || T.coral);
          }
          return;
        }

        const target = targetOf(g, this);
        const i = this.combatIndex;
        if (i === 0) this.x = g.width * .5 + Math.sin(this.age * .42) * Math.min(185, g.width * .22);
        else if (i === 1) this.x = g.width * .5 + Math.sin(this.age * .85) * Math.min(225, g.width * .28);
        else if (i === 2) this.x = g.width * .5 + Math.sin(this.age * .27) * Math.min(145, g.width * .18);
        else if (i === 3) this.x += clamp(target.x - this.x, -80, 80) * dt * .18;
        else if (i === 4) this.x = g.width * .5 + Math.sin(this.age * .31) * Math.min(120, g.width * .15);
        else this.x = g.width * .5 + Math.sin(this.age * .68) * Math.min(205, g.width * .25);

        this.attackClock -= dt;
        this.specialClock -= dt;
        if (i === 5) this.teleportClock -= dt;

        if (i === 5 && this.teleportClock <= 0) {
          this.teleportClock = 4.4;
          this.activeSide *= -1;
          this.x = clamp(target.x + this.activeSide * (90 + Math.random() * 80), 95, g.width - 95);
          g.effects.wave(this.x, this.y, 95, T.ivory);
        }

        if (this.attackClock <= 0) {
          this.attackClock = this.attack(g);
          this.phaseStep += 1;
        }
      }

      attack(g) {
        const target = targetOf(g, this);
        const base = aimAngle(this, target);
        const i = this.combatIndex;

        if (i === 0) {
          // Kage Warden: alternating radial lattice and short vulnerable core window.
          if (this.phaseStep % 2 === 0) {
            for (let k = 0; k < 12; k++) fireAngle(g, this.x, this.y + 18, k * Math.PI * 2 / 12 + this.age * .12, 150, 10, 7, T.coral, { fromBoss: true });
            this.vulnerableClock = 1.45;
            return 2.45;
          }
          for (let k = -2; k <= 2; k++) fireAngle(g, this.x, this.y + 28, base + k * .11, 205, 11, 8, T.cyan, { fromBoss: true });
          return 1.55;
        }

        if (i === 1) {
          // Torii Reaper: one blade glows; attacks sweep from that side across the arena.
          this.activeSide *= -1;
          const ox = this.activeSide * 65;
          for (let k = 0; k < 6; k++) {
            const angle = Math.PI / 2 + this.activeSide * (.38 - k * .13);
            fireAngle(g, this.x + ox, this.y + 12, angle, 185 + k * 5, 10, 7, T.amber, { fromBoss: true });
          }
          if (this.phaseStep % 3 === 2) {
            for (let k = -1; k <= 1; k++) fireAngle(g, this.x - ox, this.y + 12, base + k * .08, 230, 12, 6, T.coral, { fromBoss: true });
          }
          return 1.4;
        }

        if (i === 2) {
          // Ashen Shogun: dense furnace shotgun, then vents open briefly.
          for (let k = -4; k <= 4; k++) fireAngle(g, this.x, this.y + 40, base + k * .105, 150 + Math.abs(k) * 7, 10, 8, T.coral, { fromBoss: true });
          if (this.phaseStep % 2 === 1) {
            this.vulnerableClock = 1.9;
            for (let x = 70; x < g.width; x += 105) fireAngle(g, x, -10, Math.PI / 2, 135, 9, 10, T.amber, { fromBoss: true });
            return 2.75;
          }
          return 1.75;
        }

        if (i === 3) {
          // Veil Oracle: rotating eye + slow seekers mixed with a geometric spiral.
          const wp = this.weakPoint();
          if (this.phaseStep % 2 === 0) {
            for (let k = 0; k < 3; k++) {
              const a = base + (k - 1) * .22;
              fireAngle(g, wp.x, wp.y, a, 115, 10, 10, T.cyan, { fromBoss: true, seeker: true, seekStrength: .75, maxSpeed: 165 });
            }
          } else {
            for (let k = 0; k < 9; k++) fireAngle(g, this.x, this.y + 10, Math.PI * .18 + k * Math.PI * .64 / 8 + this.age * .08, 165, 9, 7, T.coral, { fromBoss: true });
          }
          return 1.85;
        }

        if (i === 4) {
          // Crimson Daimyo: shield-node phase; creates deliberate vertical safe lanes.
          const gap = clamp(target.x, 80, g.width - 80);
          for (let x = 35; x < g.width; x += 55) {
            if (Math.abs(x - gap) < 62) continue;
            fireAngle(g, x, -8, Math.PI / 2, 178, 10, 7, T.coral, { fromBoss: true });
          }
          if (this.nodeBroken[0] && this.nodeBroken[1]) {
            for (let k = -2; k <= 2; k++) fireAngle(g, this.x, this.y + 30, base + k * .14, 215, 11, 8, T.amber, { fromBoss: true });
          }
          return 1.8;
        }

        // Pale Oni: feints, teleporting mask, and crossing diagonal cuts.
        this.activeSide *= -1;
        for (let k = -1; k <= 1; k++) fireAngle(g, this.x, this.y + 22, base + k * .2, 225, 10, 5, T.ivory, { fromBoss: true });
        for (const s of [-1, 1]) fireAngle(g, this.x + s * 52, this.y + 18, Math.PI / 2 - s * .48, 190, 11, 9, T.coral, { fromBoss: true });
        return 1.35;
      }

      draw(ctx, time) {
        super.draw(ctx, time);
        if (this.entering) return;
        const wp = this.weakPoint();
        ctx.save();
        const pulse = 1 + Math.sin(time * 6) * .12;
        ctx.strokeStyle = wp.active ? T.amber : T.muted;
        ctx.fillStyle = wp.active ? T.amber : T.muted;
        ctx.globalAlpha = wp.active ? .9 : .35;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2); ctx.fill();
        if (this.combatIndex === 4) {
          for (let n = 0; n < 2; n++) {
            if (this.nodeBroken[n]) continue;
            const nx = this.x + (n ? 62 : -62), ny = this.y - 8;
            ctx.strokeStyle = T.coral; ctx.globalAlpha = .65;
            ctx.beginPath(); ctx.arc(nx, ny, 19, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    Starfall.Boss = TacticalBoss;

    // Distinct post-stage enemy families. Their silhouettes and projectile behaviors
    // intentionally differ so the player can read threats before the bullets arrive.
    class BladeSkimmer extends BaseEnemy {
      constructor(x, y, difficulty) {
        super("scout", x, y, difficulty);
        this.archetype = "BLADE SKIMMER";
        this.radius = 18; this.speed *= 1.2; this.maxHealth *= .95; this.health = this.maxHealth;
        this.shootTimer = 1.2; this.turn = Math.random() < .5 ? -1 : 1;
      }
      update(dt, g) {
        this.age += dt; this.y += this.speed * .72 * dt;
        this.x += this.turn * (70 + Math.sin(this.age * 3) * 35) * dt;
        if (this.x < 30 || this.x > g.width - 30) this.turn *= -1;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y < g.height * .62) {
          for (const s of [-1, 1]) fireAngle(g, this.x + s * 12, this.y + 8, Math.PI / 2 + s * .13, 210, 9, 5, T.cyan);
          this.shootTimer = 2.15;
        }
        if (this.y > g.height + 50) this.dead = true;
      }
      draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = T.steel; ctx.strokeStyle = T.cyan; ctx.lineWidth = 1.5;
        T.poly(ctx, [[0,-18],[31,-4],[12,4],[25,16],[0,9],[-25,16],[-12,4],[-31,-4]], T.steel, T.cyan);
        T.disc(ctx,0,0,4,T.cyan); ctx.restore();
      }
    }

    class PrismWeaver extends BaseEnemy {
      constructor(x, y, difficulty) {
        super("zigzag", x, y, difficulty);
        this.archetype = "PRISM WEAVER";
        this.radius = 21; this.speed *= .82; this.maxHealth *= 1.18; this.health = this.maxHealth;
        this.shootTimer = 1.55;
      }
      update(dt, g) {
        this.age += dt; this.y += this.speed * .8 * dt;
        this.x = this.baseX + Math.sin(this.age * 1.45 + this.phase) * Math.min(150, g.width * .2);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y < g.height * .6) {
          for (let k = -2; k <= 2; k++) fireAngle(g, this.x, this.y + 12, Math.PI / 2 + k * .16, 155, 9, 6, k % 2 ? T.coral : T.amber);
          this.shootTimer = 2.45;
        }
        if (this.y > g.height + 55) this.dead = true;
      }
      draw(ctx, time) {
        ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(Math.sin(time * 2 + this.phase) * .12);
        T.poly(ctx, [[0,-26],[18,-8],[29,0],[18,8],[0,26],[-18,8],[-29,0],[-18,-8]], T.navy, T.coral);
        ctx.strokeStyle=T.amber; ctx.beginPath(); ctx.moveTo(-20,0); ctx.lineTo(20,0); ctx.moveTo(0,-20); ctx.lineTo(0,20); ctx.stroke();
        ctx.restore();
      }
    }

    class LanternSeeker extends BaseEnemy {
      constructor(x, y, difficulty) {
        super("heavy", x, y, difficulty);
        this.archetype = "LANTERN SEEKER";
        this.radius = 24; this.speed *= .72; this.maxHealth *= 1.3; this.health = this.maxHealth;
        this.shootTimer = 1.8;
      }
      update(dt, g) {
        this.age += dt; this.y += this.speed * .66 * dt;
        this.x += Math.sin(this.age * .9 + this.phase) * 20 * dt;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.y < g.height * .58) {
          const target = targetOf(g, this), a = aimAngle(this, target);
          fireAngle(g, this.x, this.y + 16, a, 105, 12, 10, T.amber, { seeker: true, seekStrength: .9, maxSpeed: 155 });
          this.shootTimer = 2.8;
        }
        if (this.y > g.height + 65) this.dead = true;
      }
      draw(ctx, time) {
        ctx.save(); ctx.translate(this.x,this.y);
        T.poly(ctx,[[-22,-17],[22,-17],[29,0],[17,22],[-17,22],[-29,0]],T.steel,T.amber);
        T.disc(ctx,0,2,9,T.navy); T.disc(ctx,0,2,4 + Math.sin(time*4)*1.2,T.amber);
        ctx.restore();
      }
    }

    // Seekers gently curve; capped steering keeps them readable and dodgeable.
    const originalUpdate = game.update.bind(game);
    game.update = function (dt) {
      const result = originalUpdate(dt);
      for (const p of this.enemyProjectiles) {
        if (!p.seeker || p.dead) continue;
        const target = targetOf(this, p);
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        const current = Math.atan2(p.vy, p.vx);
        let delta = ((desired - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const turn = clamp(delta, -p.seekStrength * dt, p.seekStrength * dt);
        const next = current + turn;
        const nextSpeed = Math.min(p.maxSpeed || speed, speed + 16 * dt);
        p.vx = Math.cos(next) * nextSpeed;
        p.vy = Math.sin(next) * nextSpeed;
      }
      return result;
    };

    // Inject new silhouettes gradually without replacing the existing roster.
    game.combatDiversityTimer = 7;
    const updateWithDiversity = game.update.bind(game);
    game.update = function (dt) {
      const result = updateWithDiversity(dt);
      const stage = this.stage || 0;
      if (stage < 2 || this.boss) return result;
      this.combatDiversityTimer -= dt;
      if (this.combatDiversityTimer > 0) return result;
      const diff = Math.min(1.9, this.elapsed / Starfall.CONFIG.SPAWN.difficultyRampSeconds + stage * .075);
      const x = 55 + Math.random() * Math.max(10, this.width - 110);
      const roll = Math.random();
      if (stage >= 4 && roll > .7) this.enemies.push(new LanternSeeker(x, -48, diff));
      else if (stage >= 3 && roll > .38) this.enemies.push(new PrismWeaver(x, -45, diff));
      else this.enemies.push(new BladeSkimmer(x, -42, diff));
      this.combatDiversityTimer = Math.max(7.5, 13 - Math.min(stage, 8) * .42) + Math.random() * 2.5;
      return result;
    };

    // Boss lasers are resolved here first so weak points are real gameplay, then the
    // original collision system handles normal enemies, players and power-ups.
    const originalHandleCollisions = game.handleCollisions.bind(game);
    game.handleCollisions = function () {
      const boss = this.boss;
      if (!boss || boss.dead || boss.entering || typeof boss.receiveLaser !== "function") return originalHandleCollisions();

      for (const laser of this.playerProjectiles) {
        if (laser.dead) continue;
        if (dist2(laser.x, laser.y, boss.x, boss.y) <= Math.pow(laser.radius + boss.radius, 2)) {
          laser.dead = true;
          boss.receiveLaser(laser, this);
        }
      }

      const wasEntering = boss.entering;
      boss.entering = true;
      try { originalHandleCollisions(); }
      finally { boss.entering = wasEntering; }
    };

    // Pulse remains useful, but armored bosses cannot be bypassed completely with it.
    const originalDamageBoss = game.damageBoss.bind(game);
    game.damageBoss = function (amount) {
      const boss = this.boss;
      if (boss && boss instanceof TacticalBoss) {
        if (boss.combatIndex === 4 && (!boss.nodeBroken[0] || !boss.nodeBroken[1])) amount *= .28;
        else if ((boss.combatIndex === 0 || boss.combatIndex === 2) && boss.vulnerableClock <= 0) amount *= .42;
      }
      return originalDamageBoss(amount);
    };

    const originalSummonBoss = game.summonBoss.bind(game);
    game.summonBoss = function () {
      originalSummonBoss();
      if (this.boss && this.boss.rule) {
        const label = this.ui?.["boss-hud"]?.querySelector("span");
        if (label && this.boss.profile) label.textContent = `${this.boss.profile.name} · ${this.boss.rule.weak}`;
      }
    };
  });
})();
