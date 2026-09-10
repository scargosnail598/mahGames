(function () {
  "use strict";

  const PALETTES = [
    { name: "JADE ORBIT", navy: "#070B18", steel: "#24334A", ivory: "#E8EDF2", cyan: "#56E7F2", coral: "#FF625A", amber: "#FFC66D", muted: "#456078", tint: "rgba(48,126,133,.035)" },
    { name: "VIOLET TIDE", navy: "#0A091B", steel: "#2C3150", ivory: "#EEEAF8", cyan: "#77DDF4", coral: "#D96BFF", amber: "#FFD07A", muted: "#515D80", tint: "rgba(123,72,180,.045)" },
    { name: "EMBER REACH", navy: "#120A0D", steel: "#493033", ivory: "#F4E9DE", cyan: "#78E2D1", coral: "#FF765E", amber: "#FFBC62", muted: "#715048", tint: "rgba(190,74,44,.05)" },
    { name: "AZURE VEIL", navy: "#060E1C", steel: "#213C56", ivory: "#E5F2F7", cyan: "#66CFFF", coral: "#FF6F9E", amber: "#F5D56F", muted: "#3C6581", tint: "rgba(40,105,185,.05)" },
    { name: "CRIMSON MOON", navy: "#13070B", steel: "#4A2730", ivory: "#F5E6E6", cyan: "#7FE1DC", coral: "#FF526B", amber: "#FFC56E", muted: "#75434D", tint: "rgba(180,35,60,.055)" },
    { name: "GHOST NEBULA", navy: "#080B16", steel: "#33404D", ivory: "#EBF0ED", cyan: "#86DCC9", coral: "#C983FF", amber: "#EBCB7B", muted: "#526871", tint: "rgba(91,133,121,.05)" },
  ];

  const POWERUP_PALETTES = [
    ["#4deaff", "#ffd35e", "#a984ff", "#69f19a", "#fff08a", "#ff89dc"],
    ["#77ddff", "#ffd47f", "#c991ff", "#71e8bb", "#fff0a0", "#e784ff"],
    ["#73e5cf", "#ffbf68", "#c889ff", "#7de39b", "#ffe89a", "#ff8db1"],
    ["#65d0ff", "#f5d56f", "#9ca8ff", "#78e2be", "#fff0a0", "#df86ff"],
    ["#7fe1dc", "#ffc56e", "#c68cff", "#73dfa0", "#ffe99b", "#ff7899"],
    ["#86dcc9", "#ebcb7b", "#b693ff", "#78ddb0", "#f4eba1", "#d68aff"],
  ];

  const STAGE_PERKS = [
    "BASE SYSTEMS",
    "TUNED CANNONS",
    "FLUX SHIELD",
    "PULSE CORE",
    "VECTOR THRUST",
    "OVERCHARGED LASERS",
    "RONIN FRAME",
  ];

  const clampStage = (stage, cap) => Math.min(Math.max(0, stage || 0), cap);

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game || !window.Starfall || !Starfall.THEME) return;

    const T = Starfall.THEME;
    const C = Starfall.CONFIG;
    const BaseEnemy = Starfall.Enemy;
    const BaseBoss = Starfall.Boss;
    const baseShip = T.ship.bind(T);
    const basePowerupColors = {};
    Object.keys(Starfall.POWERUPS || {}).forEach((key) => { basePowerupColors[key] = Starfall.POWERUPS[key].color; });

    game.stage = 0;
    game.shipRank = 0;
    game.stageTint = PALETTES[0].tint;

    function applyTheme(stage) {
      const palette = PALETTES[stage % PALETTES.length];
      ["navy", "steel", "ivory", "cyan", "coral", "amber", "muted"].forEach((key) => { T[key] = palette[key]; });
      game.stageTint = palette.tint;
      game.stageName = palette.name;

      const root = document.documentElement;
      root.style.setProperty("--cyan", palette.cyan);
      root.style.setProperty("--blue", palette.steel);
      root.style.setProperty("--pink", palette.coral);
      root.style.setProperty("--gold", palette.amber);
      root.style.setProperty("--line", palette.muted);

      const colors = POWERUP_PALETTES[stage % POWERUP_PALETTES.length];
      Object.keys(Starfall.POWERUPS || {}).forEach((key, index) => {
        Starfall.POWERUPS[key].color = colors[index] || basePowerupColors[key];
      });

      if (game.audio) game.audio.stageIntensity = stage;
    }

    function difficultyFor(stage) {
      const s = clampStage(stage, 12);
      return {
        enemySpeed: Math.min(1.30, 1 + s * 0.025),
        enemyHealth: Math.min(1.45, 1 + s * 0.035),
        enemyDamage: Math.min(1.20, 1 + s * 0.015),
        projectileSpeed: Math.min(1.25, 1 + s * 0.02),
        spawnPressure: Math.min(0.24, s * 0.018),
        bossHealth: Math.min(1.65, 1 + s * 0.055),
        bossTempo: Math.min(1.22, 1 + s * 0.018),
      };
    }

    function upgradeFor(stage) {
      const s = clampStage(stage, 10);
      return {
        laserDamage: 1 + Math.min(.28, s * .035),
        extraFireDrain: Math.min(.22, s * .025),
        shieldRegenBonus: Math.min(3.2, s * .42),
        pulseBonus: Math.min(1.4, s * .18),
      };
    }

    function shipRankFor(score, stage) {
      const scoreRank = Math.floor(Math.max(0, score || 0) / 7000);
      return Math.min(6, Math.max(stage || 0, scoreRank));
    }

    Starfall.Enemy = class StageEnemy extends BaseEnemy {
      constructor(type, x, y, difficulty) {
        super(type, x, y, difficulty);
        const d = difficultyFor(window.starfallGame?.stage || 0);
        this.speed *= d.enemySpeed;
        this.maxHealth *= d.enemyHealth;
        this.health = this.maxHealth;
        this.contactDamage *= d.enemyDamage;
      }
    };

    Starfall.Boss = class StageBoss extends BaseBoss {
      constructor(width) {
        super(width);
        const stage = window.starfallGame?.stage || 0;
        const d = difficultyFor(stage);
        this.stageTempo = d.bossTempo;
        this.maxHealth *= d.bossHealth;
        this.health = this.maxHealth;
        this.contactDamage *= d.enemyDamage;
      }

      update(dt, activeGame) {
        super.update(dt * this.stageTempo, activeGame);
      }
    };

    // Visual evolution: subtle extra wing lights / core rings as the run advances.
    T.ship = function (ctx, kind, time, weak) {
      baseShip(ctx, kind, time, weak);
      if (kind !== "player") return;
      const rank = window.starfallGame?.shipRank || 0;
      if (!rank) return;

      ctx.save();
      ctx.globalAlpha = .45 + Math.min(.3, rank * .05);
      ctx.strokeStyle = T.cyan;
      ctx.fillStyle = rank >= 4 ? T.amber : T.cyan;
      ctx.lineWidth = 1;
      if (rank >= 1) { ctx.fillRect(-27, 8, 3, 6); ctx.fillRect(24, 8, 3, 6); }
      if (rank >= 2) { ctx.beginPath(); ctx.arc(0, -2, 11, 0, Math.PI * 2); ctx.stroke(); }
      if (rank >= 3) { ctx.fillRect(-18, 18, 3, 5); ctx.fillRect(15, 18, 3, 5); }
      if (rank >= 4) { ctx.beginPath(); ctx.moveTo(-30, -5); ctx.lineTo(-20, -12); ctx.moveTo(30, -5); ctx.lineTo(20, -12); ctx.stroke(); }
      if (rank >= 5) { ctx.globalAlpha *= .65; ctx.beginPath(); ctx.arc(0, 0, 25 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    };

    // Music becomes gradually more energetic after each boss without changing track identity.
    if (game.audio) {
      const audio = game.audio;
      const originalPlay = audio.play.bind(audio);
      audio.stageIntensity = 0;

      audio.scheduleMusic = function () {
        if (!this.ctx || this.ctx.state !== "running") return;
        const stage = clampStage(this.stageIntensity || 0, 10);
        const bpm = 72 + Math.min(14, stage * 1.6);
        const beat = 60 / bpm;
        const now = this.ctx.currentTime;
        if (this.nextMusicTime < now - .4) this.nextMusicTime = now + .05;

        while (this.nextMusicTime < now + .3) {
          const step = this.musicStep;
          const t = this.nextMusicTime;
          const bar = Math.floor(step / 8) % 8;
          if (this.enabled && !this.backgrounded && this.musicVolume > 0) {
            const chords = [[45,52,59],[41,48,55],[48,55,62],[43,50,57]];
            const chord = chords[Math.floor(bar / 2)];
            if (step % 8 === 0) {
              chord.forEach((n,i)=>this.musicNote(n,t,beat*5,.13,"sine",(i-1)*.35,.7));
              this.musicNote(chord[0]-12,t,beat*3,.10,"sine",0,.4);
            }
            const melody=[69,null,72,76,null,79,76,null,72,null,69,null,67,64,null,null];
            const note=melody[step%16];
            if(note!==null)this.musicNote(note+(bar>=4?-12:0),t,beat*2.8,.14,"triangle",Math.sin(step*.7)*.45,.018);
            if(step%16===12)this.musicNote(88,t,beat*3,.035,"sine",-.3,.025);
            if(stage >= 2 && step % 4 === 2) this.musicNote(57 + (stage % 3) * 2, t, beat * .45, .018 + stage * .0015, "triangle", .2, .01);
            if(stage >= 4 && step % 8 === 6) this.musicNote(81, t, beat * .35, .016, "square", -.2, .008);
          }
          this.musicStep++;
          this.nextMusicTime += beat / 2;
        }
      };

      audio.play = function (name) {
        originalPlay(name);
        const stage = clampStage(this.stageIntensity || 0, 10);
        if (!stage || !this.enabled || !this.ctx) return;
        const accent = Math.min(.05, stage * .004);
        if (name === "laser" && Math.random() < .22) this.tone(980 + stage * 18, 520 + stage * 12, .045, "triangle", .018 + accent * .2);
        else if (name === "explosion" && stage >= 2) this.tone(95 + stage * 3, 42, .16, "sine", .025 + accent);
        else if (name === "powerup") this.tone(760 + stage * 24, 1180 + stage * 28, .12, "sine", .025 + accent * .4, .035);
        else if (name === "bossShot" && stage >= 3) this.tone(330 + stage * 9, 125, .12, "triangle", .018 + accent * .3);
      };
    }

    const originalResetWorld = game.resetWorld.bind(game);
    game.resetWorld = function () {
      this.stage = 0;
      this.shipRank = 0;
      applyTheme(0);
      return originalResetWorld();
    };

    const originalDestroyBoss = game.destroyBoss.bind(game);
    game.destroyBoss = function () {
      const bossWasAlive = Boolean(this.boss && !this.boss.dead);
      originalDestroyBoss();
      if (!bossWasAlive) return;

      this.stage = (this.stage || 0) + 1;
      applyTheme(this.stage);
      this.shipRank = shipRankFor(this.score, this.stage);
      const d = difficultyFor(this.stage);
      const perk = STAGE_PERKS[Math.min(this.stage, STAGE_PERKS.length - 1)];
      this.showToast(`SECTOR ${String(this.stage + 1).padStart(2, "0")}\n${this.stageName}\n${perk}`, T.amber);
      this.effects.wave(this.width / 2, this.height * .45, Math.min(this.width * .65, 420), T.cyan);
      this.spawnTimer = Math.max(0.4, this.spawnTimer * (1 - d.spawnPressure * .35));

      // A small post-boss reward keeps upgrades satisfying without making the run trivial.
      for (const player of this.players || []) {
        if (!player || player.dead) continue;
        player.shield = Math.min(C.PLAYER.maxShield, player.shield + 10 + Math.min(18, this.stage * 2));
      }
    };

    const originalSpawnEnemies = game.spawnEnemies.bind(game);
    game.spawnEnemies = function (dt) {
      const d = difficultyFor(this.stage || 0);
      if (!this.boss && this.stage > 0) this.spawnTimer -= dt * d.spawnPressure;
      return originalSpawnEnemies(dt);
    };

    const originalUpdate = game.update.bind(game);
    game.update = function (dt) {
      const result = originalUpdate(dt);
      const stage = this.stage || 0;
      const d = difficultyFor(stage);
      const up = upgradeFor(stage);
      this.shipRank = shipRankFor(this.score, stage);

      for (const projectile of this.enemyProjectiles) {
        if (projectile.__stageScaled) continue;
        projectile.vx *= d.projectileSpeed;
        projectile.vy *= d.projectileSpeed;
        projectile.__stageScaled = true;
      }

      for (const projectile of this.playerProjectiles) {
        if (projectile.__upgradeScaled) continue;
        projectile.damage *= up.laserDamage;
        projectile.__upgradeScaled = true;
      }

      for (const player of this.players || []) {
        if (!player || player.dead) continue;
        if (stage >= 1 && player.fireTimer > 0) player.fireTimer = Math.max(0, player.fireTimer - dt * up.extraFireDrain);
        if (stage >= 2 && player.sinceDamage >= C.PLAYER.shieldRechargeDelay && player.shield < C.PLAYER.maxShield) {
          player.shield = Math.min(C.PLAYER.maxShield, player.shield + up.shieldRegenBonus * dt);
        }
      }
      if (stage >= 3) this.pulseEnergy = Math.min(C.PULSE.maxEnergy, this.pulseEnergy + up.pulseBonus * dt);
      return result;
    };

    const originalDraw = game.draw.bind(game);
    game.draw = function () {
      originalDraw();
      if (!this.stage || this.state === "menu" || !this.stageTint) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = this.stageTint;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    };

    applyTheme(0);
  });
})();
