(function () {
  "use strict";

  const C = Starfall.CONFIG;
  const { clamp, random, collides, distanceSq } = Starfall;

  class Game {
    constructor() {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.audio = new Starfall.AudioManager();
      this.effects = new Starfall.EffectSystem();
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.state = "menu";
      this.lastTime = performance.now();
      this.backgroundTime = 0;
      this.shake = 0;
      this.toastTimer = null;
      this.cacheElements();
      this.resize();
      this.starfield = new Starfall.Starfield(this.width, this.height);
      this.port = new Starfall.OrbitalPort(this.width, this.height);
      this.bindEvents();
      this.resetWorld();
      requestAnimationFrame((time) => this.loop(time));
    }

    cacheElements() {
      const ids = [
        "hud", "health-fill", "shield-fill", "health-text", "shield-text", "score-text", "combo-text",
        "boss-hud", "boss-fill", "pulse-button", "pulse-fill", "pulse-label", "powerup-status", "toast",
        "main-menu", "how-menu", "pause-menu", "game-over-menu", "final-score", "final-kills", "final-time", "final-combo", "result-message",
      ];
      this.ui = {};
      ids.forEach((id) => { this.ui[id] = document.getElementById(id); });
    }

    bindEvents() {
      window.addEventListener("resize", () => this.resize());
      this.canvas.addEventListener("pointermove", (event) => this.movePointer(event));
      this.canvas.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && this.state === "playing") this.activatePulse();
      });
      document.getElementById("pulse-button").addEventListener("click", () => this.activatePulse());
      document.getElementById("play-button").addEventListener("click", () => this.start());
      document.getElementById("how-button").addEventListener("click", () => this.showScreen("how-menu"));
      document.getElementById("how-back-button").addEventListener("click", () => this.showScreen("main-menu"));
      document.getElementById("pause-button").addEventListener("click", () => this.pause(false));
      document.getElementById("continue-button").addEventListener("click", () => this.resume());
      document.getElementById("restart-button").addEventListener("click", () => this.start());
      document.getElementById("pause-main-button").addEventListener("click", () => this.mainMenu());
      document.getElementById("again-button").addEventListener("click", () => this.start());
      document.getElementById("over-main-button").addEventListener("click", () => this.mainMenu());
      document.querySelectorAll(".sound-button").forEach((button) => button.addEventListener("click", () => this.toggleSound()));
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.state === "playing") this.pause(true);
      });
      window.addEventListener("blur", () => {
        if (this.state === "playing") this.pause(true);
      });
      document.addEventListener("contextmenu", (event) => {
        if (event.target === this.canvas) event.preventDefault();
      });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.width = Math.max(320, rect.width || window.innerWidth);
      this.height = Math.max(480, rect.height || window.innerHeight);
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.port) this.port.resize(this.width, this.height);
      if (this.starfield) this.starfield.resize(this.width, this.height, false);
      if (this.player) {
        this.player.x = clamp(this.player.x, 30, this.width - 30);
        this.player.y = clamp(this.player.y, 100, this.height - 30);
        this.player.targetX = clamp(this.player.targetX, 30, this.width - 30);
        this.player.targetY = clamp(this.player.targetY, 100, this.height - 30);
      }
    }

    resetWorld() {
      this.player = new Starfall.Player(this.width / 2, this.height * .78);
      this.player.targetX = this.width / 2;
      this.player.targetY = this.height * .78;
      this.playerProjectiles = [];
      this.enemyProjectiles = [];
      this.enemies = [];
      this.powerups = [];
      this.boss = null;
      this.companion = new Starfall.CompanionDrone(1);
      this.companion.x = this.player.x + 38;
      this.companion.y = this.player.y + 14;
      this.effects.clear();
      this.elapsed = 0;
      this.spawnTimer = .8;
      this.nextBossTime = C.SPAWN.bossFirstTime;
      this.score = 0;
      this.kills = 0;
      this.killChain = 0;
      this.comboTimer = 0;
      this.combo = 1;
      this.bestCombo = 1;
      this.pulseEnergy = 35;
      this.shake = 0;
      this.updateHUD();
    }

    start() {
      this.audio.unlock();
      this.resetWorld();
      this.state = "playing";
      this.hideScreens();
      this.ui.hud.classList.remove("hidden");
      this.lastTime = performance.now();
      this.showToast("MISSION START", "#7ff7ff");
    }

    mainMenu() {
      this.state = "menu";
      this.ui.hud.classList.add("hidden");
      this.showScreen("main-menu");
      this.resetWorld();
    }

    pause(automatic) {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.showScreen("pause-menu");
      const eyebrow = document.querySelector("#pause-menu .eyebrow");
      eyebrow.textContent = automatic ? "PAUSED FOR YOUR COMFORT" : "SYSTEMS HOLDING";
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.hideScreens();
      this.lastTime = performance.now();
      this.player.targetX = this.player.x;
      this.player.targetY = this.player.y;
    }

    showScreen(id) {
      this.hideScreens();
      document.getElementById(id).classList.add("visible");
    }

    hideScreens() {
      document.querySelectorAll(".overlay").forEach((screen) => screen.classList.remove("visible"));
    }

    toggleSound() {
      const on = this.audio.toggle();
      document.querySelectorAll(".sound-button").forEach((button) => { button.textContent = `SOUND: ${on ? "ON" : "OFF"}`; });
    }

    movePointer(event) {
      if (!this.player) return;
      const rect = this.canvas.getBoundingClientRect();
      this.player.targetX = (event.clientX - rect.left) * this.width / rect.width;
      this.player.targetY = (event.clientY - rect.top) * this.height / rect.height;
    }

    loop(timestamp) {
      const rawDt = Math.max(0, (timestamp - this.lastTime) / 1000);
      const dt = Math.min(C.WORLD.maxDelta, rawDt);
      this.lastTime = timestamp;
      this.backgroundTime += dt;
      this.port.update(dt, this.state === "playing" ? 1 : .38);
      this.starfield.update(Starfall.THEME.reducedMotion.matches ? 0 : dt, this.state === "playing" ? 1 : .38);
      if (this.state === "playing") this.update(dt);
      else if (this.state === "menu" || this.state === "gameover") this.effects.update(dt);
      this.draw();
      requestAnimationFrame((time) => this.loop(time));
    }

    update(dt) {
      this.elapsed += dt;
      this.player.update(dt, this);
      this.pulseEnergy = Math.min(C.PULSE.maxEnergy, this.pulseEnergy + C.PULSE.passiveCharge * dt);

      if (this.player.droneTime > 0) this.companion.update(dt, this);
      this.updateCombo(dt);
      this.spawnEnemies(dt);

      for (const projectile of this.playerProjectiles) projectile.update(dt, this.width, this.height);
      for (const projectile of this.enemyProjectiles) projectile.update(dt, this.width, this.height);
      for (const enemy of this.enemies) enemy.update(dt, this);
      for (const powerup of this.powerups) powerup.update(dt, this);
      if (this.boss) this.boss.update(dt, this);
      this.effects.update(dt);

      this.handleCollisions();
      this.cleanEntities();
      this.shake = Math.max(0, this.shake - dt * 22);
      this.updateHUD();
      if (this.player.dead) this.endGame();
    }

    updateCombo(dt) {
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.killChain = 0;
          this.combo = 1;
        }
      }
    }

    spawnEnemies(dt) {
      if (!this.boss && this.elapsed >= this.nextBossTime) {
        this.summonBoss();
        return;
      }
      if (this.boss) return;
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      const difficulty = clamp(this.elapsed / C.SPAWN.difficultyRampSeconds, 0, 1.6);
      const interval = Math.max(C.SPAWN.minimumInterval, C.SPAWN.startingInterval - difficulty * .46);
      this.spawnTimer = interval * random(.78, 1.25);
      if (this.enemies.length > 11 + Math.floor(difficulty * 3)) return;

      const roll = Math.random();
      let type = "scout";
      if (this.elapsed > 70 && roll > .78) type = "hunter";
      else if (this.elapsed > 36 && roll > .6) type = "heavy";
      else if (this.elapsed > 12 && roll > .38) type = "zigzag";
      const margin = type === "heavy" ? 35 : 22;
      if (this.elapsed > 40 && (type === "scout" || type === "hunter") && Math.random() < .18) {
        const fromLeft = Math.random() < .5;
        const enemy = new Starfall.Enemy(type, fromLeft ? -margin : this.width + margin, random(115, this.height * .42), difficulty);
        enemy.entrySide = fromLeft ? 1 : -1;
        this.enemies.push(enemy);
      } else {
        this.enemies.push(new Starfall.Enemy(type, random(margin, this.width - margin), -45, difficulty));
      }
    }

    summonBoss() {
      this.boss = new Starfall.Boss(this.width);
      this.enemies.forEach((enemy) => { enemy.dead = true; });
      this.enemyProjectiles.forEach((projectile) => { projectile.dead = true; });
      this.effects.wave(this.width / 2, 100, Math.min(360, this.width * .4), "#d75cff");
      this.showToast("WARNING\nLARGE SIGNAL", "#ff76d6");
      this.audio.play("warning");
      this.shake = 5;
    }

    activatePulse() {
      if (this.state !== "playing" || this.pulseEnergy < C.PULSE.maxEnergy) return;
      this.pulseEnergy = 0;
      this.effects.wave(this.player.x, this.player.y, C.PULSE.radius, "#6fffff");
      this.effects.burst(this.player.x, this.player.y, "#7dffff", 34, 310);
      this.audio.play("pulse");
      this.shake = 9;
      for (const enemy of this.enemies) {
        if (distanceSq(this.player, enemy) <= C.PULSE.radius * C.PULSE.radius) {
          enemy.health -= C.PULSE.damage;
          if (enemy.health <= 0) this.destroyEnemy(enemy, true);
        }
      }
      if (this.boss && distanceSq(this.player, this.boss) <= Math.pow(C.PULSE.radius + this.boss.radius, 2)) {
        this.damageBoss(C.PULSE.damage * (this.boss.weakPhase ? 1.5 : 1));
      }
      for (const projectile of this.enemyProjectiles) {
        if (distanceSq(this.player, projectile) <= C.PULSE.radius * C.PULSE.radius) projectile.dead = true;
      }
    }

    handleCollisions() {
      for (const laser of this.playerProjectiles) {
        if (laser.dead) continue;
        let hit = false;
        for (const enemy of this.enemies) {
          if (!enemy.dead && collides(laser, enemy, 1)) {
            laser.dead = true;
            enemy.health -= laser.damage;
            this.effects.burst(laser.x, laser.y, enemy.color, 3, 70);
            if (enemy.health <= 0) this.destroyEnemy(enemy, false);
            hit = true;
            break;
          }
        }
        if (!hit && this.boss && !this.boss.dead && !this.boss.entering && collides(laser, this.boss, .86)) {
          laser.dead = true;
          this.damageBoss(laser.damage * (this.boss.weakPhase ? 1.65 : 1));
          this.effects.burst(laser.x, laser.y, this.boss.weakPhase ? "#ffe879" : "#d869f4", 2, 60);
        }
      }

      for (const projectile of this.enemyProjectiles) {
        if (!projectile.dead && collides(projectile, this.player, C.WORLD.collisionForgiveness)) {
          projectile.dead = true;
          this.player.takeDamage(projectile.damage, this);
        }
      }

      for (const enemy of this.enemies) {
        if (!enemy.dead && collides(enemy, this.player, .68)) {
          this.player.takeDamage(enemy.contactDamage, this);
          this.destroyEnemy(enemy, false, true);
        }
      }

      for (const powerup of this.powerups) {
        if (!powerup.dead && collides(powerup, this.player, 1.35)) powerup.apply(this.player, this);
      }
    }

    damageBoss(amount) {
      if (!this.boss || this.boss.dead) return;
      this.boss.health -= amount;
      if (this.boss.health <= 0) this.destroyBoss();
    }

    destroyEnemy(enemy, byPulse, collision) {
      if (enemy.dead) return;
      enemy.dead = true;
      this.effects.burst(enemy.x, enemy.y, "#ffb35a", enemy.type === "heavy" ? 24 : 14, enemy.type === "heavy" ? 255 : 185);
      this.audio.play("explosion");
      if (!collision) this.registerKill(enemy.x, enemy.y, enemy.score);
      if (!collision && Math.random() < C.SPAWN.powerUpChance) this.powerups.push(new Starfall.PowerUp(enemy.x, enemy.y));
      if (byPulse) this.effects.text(enemy.x, enemy.y, "PULSE!", "#8effff", 13);
      this.shake = Math.max(this.shake, enemy.type === "heavy" ? 5 : 2);
    }

    destroyBoss() {
      if (!this.boss || this.boss.dead) return;
      this.boss.dead = true;
      this.effects.wave(this.boss.x, this.boss.y, 260, "#ff70dd");
      for (let i = 0; i < 5; i += 1) {
        const angle = i / 5 * Math.PI * 2;
        this.effects.burst(this.boss.x + Math.cos(angle) * 44, this.boss.y + Math.sin(angle) * 30, "#ffb35a", 24, 290);
      }
      this.audio.play("explosion");
      this.registerKill(this.boss.x, this.boss.y, this.boss.score);
      this.showToast("SENTINEL DEFEATED!", "#ffe273");
      this.enemyProjectiles.forEach((projectile) => { projectile.dead = true; });
      this.powerups.push(new Starfall.PowerUp(this.boss.x - 35, this.boss.y, "repair"));
      this.powerups.push(new Starfall.PowerUp(this.boss.x + 35, this.boss.y, "invincible"));
      this.shake = 12;
      this.nextBossTime = this.elapsed + C.SPAWN.bossRepeatTime;
    }

    registerKill(x, y, baseScore) {
      this.kills += 1;
      this.killChain += 1;
      this.comboTimer = C.COMBO.resetTime;
      const previousCombo = this.combo;
      this.combo = Math.min(C.COMBO.maxMultiplier, 1 + Math.floor(this.killChain / C.COMBO.stepEvery));
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const gained = baseScore * this.combo;
      this.score += gained;
      this.pulseEnergy = Math.min(C.PULSE.maxEnergy, this.pulseEnergy + C.PULSE.killCharge);
      this.effects.text(x, y, `+${gained}`, this.combo > 1 ? "#ffe56b" : "#c6f9ff", this.combo > 2 ? 19 : 15);
      if (this.combo > previousCombo) {
        this.effects.text(x, y - 24, `COMBO x${this.combo}!`, "#ffdf68", 22);
        this.showToast(`COMBO x${this.combo}!`, "#ffdf68");
      }
    }

    cleanEntities() {
      this.playerProjectiles = this.playerProjectiles.filter((item) => !item.dead);
      this.enemyProjectiles = this.enemyProjectiles.filter((item) => !item.dead);
      this.enemies = this.enemies.filter((item) => !item.dead);
      this.powerups = this.powerups.filter((item) => !item.dead);
      if (this.boss && this.boss.dead) this.boss = null;
    }

    updateHUD() {
      const healthPercent = clamp(this.player.health / C.PLAYER.maxHealth * 100, 0, 100);
      const shieldPercent = clamp(this.player.shield / C.PLAYER.maxShield * 100, 0, 100);
      this.ui["health-fill"].style.width = `${healthPercent}%`;
      this.ui["shield-fill"].style.width = `${shieldPercent}%`;
      this.ui["health-text"].textContent = Math.ceil(this.player.health);
      this.ui["shield-text"].textContent = Math.ceil(this.player.shield);
      this.ui["score-text"].textContent = this.score.toLocaleString();
      this.ui["combo-text"].textContent = this.combo > 1 ? `COMBO x${this.combo}` : "";
      const pulsePercent = clamp(this.pulseEnergy / C.PULSE.maxEnergy * 100, 0, 100);
      this.ui["pulse-fill"].style.height = `${pulsePercent}%`;
      this.ui["pulse-label"].textContent = pulsePercent >= 100 ? "READY — CLICK!" : `CHARGING ${Math.floor(pulsePercent)}%`;
      this.ui["pulse-button"].classList.toggle("ready", pulsePercent >= 100);
      this.ui["boss-hud"].classList.toggle("hidden", !this.boss);
      if (this.boss) this.ui["boss-fill"].style.width = `${clamp(this.boss.health / this.boss.maxHealth * 100, 0, 100)}%`;

      const buffs = [];
      if (this.player.rapidFire > 0) buffs.push(`<span>RAPID FIRE</span> ${Math.ceil(this.player.rapidFire)}s`);
      if (this.player.tripleLaser > 0) buffs.push(`<span>TRIPLE LASER</span> ${Math.ceil(this.player.tripleLaser)}s`);
      if (this.player.invincible > 0) buffs.push(`<span>INVINCIBLE</span> ${Math.ceil(this.player.invincible)}s`);
      if (this.player.droneTime > 0) buffs.push(`<span>DRONE ONLINE</span> ${Math.ceil(this.player.droneTime)}s`);
      this.ui["powerup-status"].innerHTML = buffs.join("<br>");
    }

    showToast(message, color) {
      const toast = this.ui.toast;
      toast.textContent = message;
      toast.style.whiteSpace = "pre-line";
      toast.style.color = color || "#fff";
      toast.classList.remove("show");
      void toast.offsetWidth;
      toast.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("show"), 1850);
    }

    endGame() {
      if (this.state !== "playing") return;
      this.state = "gameover";
      this.effects.burst(this.player.x, this.player.y, "#ffb35a", 55, 350);
      this.effects.wave(this.player.x, this.player.y, 150, "#ff708d");
      this.audio.play("explosion");
      this.ui.hud.classList.add("hidden");
      this.ui["final-score"].textContent = this.score.toLocaleString();
      this.ui["final-kills"].textContent = this.kills.toLocaleString();
      this.ui["final-time"].textContent = this.formatTime(this.elapsed);
      this.ui["final-combo"].textContent = `x${this.bestCombo}`;
      const message = this.elapsed > 150 ? "Amazing defense, pilot! The stars are safe." : this.elapsed > 60 ? "Strong flying! The squadron is proud of you." : "Nice try, pilot. Every flight makes you stronger!";
      this.ui["result-message"].textContent = message;
      this.showScreen("game-over-menu");
    }

    formatTime(seconds) {
      const whole = Math.max(0, Math.floor(seconds));
      return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
    }

    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      const background = ctx.createLinearGradient(0, 0, 0, this.height);
      background.addColorStop(0, Starfall.THEME.navy);
      background.addColorStop(.5, "#0B1524");
      background.addColorStop(1, Starfall.THEME.navy);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, this.width, this.height);
      this.starfield.draw(ctx, this.backgroundTime);
      this.port.draw(ctx);

      const sx = !Starfall.THEME.reducedMotion.matches && this.state === "playing" && this.shake > 0 ? random(-Math.min(this.shake, 2), Math.min(this.shake, 2)) : 0;
      const sy = !Starfall.THEME.reducedMotion.matches && this.state === "playing" && this.shake > 0 ? random(-Math.min(this.shake, 2), Math.min(this.shake, 2)) : 0;
      ctx.save();
      ctx.translate(sx, sy);
      if (this.state !== "menu") {
        for (const powerup of this.powerups) powerup.draw(ctx);
        for (const projectile of this.playerProjectiles) projectile.draw(ctx);
        for (const projectile of this.enemyProjectiles) projectile.draw(ctx);
        for (const enemy of this.enemies) enemy.draw(ctx, this.backgroundTime);
        if (this.boss) this.boss.draw(ctx, this.backgroundTime);
        if (!this.player.dead) this.player.draw(ctx, this.backgroundTime);
        if (!this.player.dead && this.player.droneTime > 0) this.companion.draw(ctx, this.backgroundTime);
      } else {
        this.drawMenuShips(ctx);
      }
      this.effects.draw(ctx);
      ctx.restore();
    }

    drawMenuShips(ctx) {
      const x=this.width>950 ? this.width*.78 : this.width*.85;
      ctx.save(); ctx.translate(x,this.height*.64); ctx.rotate(-.28);
      const scale=this.width>950?3.6:1.7; ctx.scale(scale,scale);
      ctx.globalAlpha=this.width>950?.9:.35;
      Starfall.THEME.ship(ctx,'player',this.backgroundTime); ctx.restore();
    }
  }

  window.addEventListener("DOMContentLoaded", () => { window.starfallGame = new Game(); });
})();
