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

  const clampStage = (stage, cap) => Math.min(Math.max(0, stage || 0), cap);

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game || !window.Starfall || !Starfall.THEME) return;

    const T = Starfall.THEME;
    const BaseEnemy = Starfall.Enemy;
    const BaseBoss = Starfall.Boss;
    const basePowerupColors = {};
    Object.keys(Starfall.POWERUPS || {}).forEach((key) => { basePowerupColors[key] = Starfall.POWERUPS[key].color; });

    game.stage = 0;
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

    const originalResetWorld = game.resetWorld.bind(game);
    game.resetWorld = function () {
      this.stage = 0;
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
      const d = difficultyFor(this.stage);
      this.showToast(`SECTOR ${String(this.stage + 1).padStart(2, "0")}\n${this.stageName}`, T.amber);
      this.effects.wave(this.width / 2, this.height * .45, Math.min(this.width * .65, 420), T.cyan);
      this.spawnTimer = Math.max(0.4, this.spawnTimer * (1 - d.spawnPressure * .35));
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
      const d = difficultyFor(this.stage || 0);
      for (const projectile of this.enemyProjectiles) {
        if (projectile.__stageScaled) continue;
        projectile.vx *= d.projectileSpeed;
        projectile.vy *= d.projectileSpeed;
        projectile.__stageScaled = true;
      }
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
