(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game || !window.Starfall || !Starfall.THEME) return;

    const T = Starfall.THEME;
    const C = Starfall.CONFIG;
    const bossHud = game.ui && game.ui["boss-hud"];
    if (!bossHud) return;

    const hint = document.createElement("small");
    hint.id = "boss-tactical-hint";
    hint.textContent = "SCAN THE TARGET";
    bossHud.appendChild(hint);

    const VICTORY_LINES = [
      "BOSS DOWN — TRY NOT TO LOOK TOO PROUD.",
      "TARGET ERASED. VERY DIPLOMATIC.",
      "THREAT REMOVED. STYLE POINTS: ACCEPTABLE.",
      "BOSS DEFEATED — SOMEONE OWES YOU NOODLES.",
      "SECTOR CLEAR. THAT WAS PROBABLY EXPENSIVE.",
      "BIG SHIP, SMALL PROBLEM NOW.",
    ];

    function tacticalHint(boss) {
      if (!boss || boss.dead) return "";
      const i = boss.combatIndex;
      if (i === 0) return boss.vulnerableClock > 0 ? "CORE OPEN — FIRE NOW!" : "WAIT FOR THE CORE APERTURE";
      if (i === 1) return boss.activeSide < 0 ? "WEAK BLADE: LEFT SIDE" : "WEAK BLADE: RIGHT SIDE";
      if (i === 2) return boss.vulnerableClock > 0 ? "VENT OPEN — HIT THE CENTER!" : "SURVIVE THE BARRAGE — WATCH THE VENT";
      if (i === 3) return "TRACK THE GLOWING ORBITAL EYE";
      if (i === 4) {
        if (boss.nodeBroken && !boss.nodeBroken[0]) return "BREAK THE LEFT SHIELD NODE";
        if (boss.nodeBroken && !boss.nodeBroken[1]) return "BREAK THE RIGHT SHIELD NODE";
        return "SHIELDS DOWN — CORE EXPOSED!";
      }
      if (i === 5) return boss.activeSide < 0 ? "MASK SHIFTED — AIM LEFT" : "MASK SHIFTED — AIM RIGHT";
      return boss.weakPhase ? "VULNERABLE — PRESS THE ATTACK" : "SCAN FOR THE GLOWING WEAK POINT";
    }

    function bossVulnerable(boss) {
      if (!boss || boss.dead || boss.entering) return false;
      if (typeof boss.weakPoint === "function") {
        const wp = boss.weakPoint();
        return Boolean(wp && wp.active);
      }
      return Boolean(boss.weakPhase);
    }

    const originalUpdate = game.update.bind(game);
    game.update = function (dt) {
      const result = originalUpdate(dt);
      const boss = this.boss;

      if (boss && !boss.dead) {
        const text = tacticalHint(boss);
        if (hint.textContent !== text) hint.textContent = text;
        const vulnerable = bossVulnerable(boss);
        bossHud.classList.toggle("boss-vulnerable", vulnerable);
        bossHud.classList.toggle("boss-weak-hit", (boss.weakHitFlash || 0) > 0);
        bossHud.classList.toggle("boss-special-hit", (boss.specialHitFlash || 0) > 0);
      } else {
        bossHud.classList.remove("boss-vulnerable", "boss-weak-hit", "boss-special-hit");
      }

      this.victoryDanceTime = Math.max(0, (this.victoryDanceTime || 0) - dt);
      return result;
    };

    // Pulse gets a meaningful proximity reward against bosses. The existing damageBoss
    // pipeline still applies armor/node rules, so this cannot bypass boss mechanics.
    const originalDamageBoss = game.damageBoss.bind(game);
    game.damageBoss = function (amount) {
      if (this.__pulseBossMultiplier && this.boss && !this.boss.dead) amount *= this.__pulseBossMultiplier;
      return originalDamageBoss(amount);
    };

    const originalActivatePulse = game.activatePulse.bind(game);
    game.activatePulse = function (playerIndex) {
      const source = this.players && this.players[playerIndex == null ? this.localPlayerIndex : playerIndex] || this.player;
      const boss = this.boss;
      let multiplier = 1;
      let pointBlank = false;

      if (source && boss && !boss.dead && !boss.entering && this.pulseEnergy >= C.PULSE.maxEnergy) {
        const distance = Math.hypot(source.x - boss.x, source.y - boss.y);
        const edgeDistance = Math.max(0, distance - (boss.radius || 0));
        if (edgeDistance <= 125) { multiplier = 2.15; pointBlank = true; }
        else if (edgeDistance <= 205) multiplier = 1.55;
        else if (edgeDistance <= 285) multiplier = 1.22;
      }

      this.__pulseBossMultiplier = multiplier;
      try {
        const result = originalActivatePulse(playerIndex);
        if (boss && multiplier > 1 && this.pulseEnergy < C.PULSE.maxEnergy) {
          this.effects.wave(boss.x, boss.y, pointBlank ? 245 : 185, pointBlank ? T.amber : T.cyan);
          this.effects.burst(boss.x, boss.y, pointBlank ? T.amber : T.cyan, pointBlank ? 32 : 18, pointBlank ? 310 : 210);
          this.effects.text(boss.x, boss.y + 78, pointBlank ? "POINT-BLANK PULSE!" : "CLOSE PULSE!", pointBlank ? T.amber : T.cyan, pointBlank ? 23 : 17);
          this.showToast(pointBlank ? "POINT-BLANK PULSE!" : "CLOSE-RANGE PULSE", pointBlank ? T.amber : T.cyan);
          this.shake = Math.max(this.shake, pointBlank ? 14 : 10);
        }
        return result;
      } finally {
        this.__pulseBossMultiplier = 1;
      }
    };

    // A tiny victory flourish: visual barrel-roll treatment only, so steering input and
    // collision coordinates remain untouched.
    const previousShip = T.ship.bind(T);
    T.ship = function (ctx, kind, time, weak) {
      if (kind !== "player" || !window.starfallGame || window.starfallGame.victoryDanceTime <= 0) {
        return previousShip(ctx, kind, time, weak);
      }
      const g = window.starfallGame;
      const remaining = g.victoryDanceTime;
      const progress = 1 - remaining / 1.65;
      const envelope = Math.sin(Math.min(1, progress) * Math.PI);
      ctx.save();
      ctx.rotate(Math.sin(progress * Math.PI * 4) * .34 * envelope);
      ctx.translate(Math.sin(progress * Math.PI * 2) * 9 * envelope, -Math.sin(progress * Math.PI) * 10);
      const scale = 1 + .055 * envelope;
      ctx.scale(scale, scale);
      previousShip(ctx, kind, time, weak);
      ctx.restore();
    };

    const originalDestroyBoss = game.destroyBoss.bind(game);
    game.destroyBoss = function () {
      const boss = this.boss;
      const wasAlive = Boolean(boss && !boss.dead);
      originalDestroyBoss();
      if (!wasAlive) return;

      this.victoryDanceTime = 1.65;
      const local = this.getLocalPlayer && this.getLocalPlayer();
      if (local) {
        this.effects.wave(local.x, local.y, 105, T.cyan);
        this.effects.burst(local.x - 28, local.y + 8, T.cyan, 10, 120);
        this.effects.burst(local.x + 28, local.y + 8, T.amber, 10, 120);
      }

      const line = VICTORY_LINES[(this.stage || 0) % VICTORY_LINES.length];
      setTimeout(() => {
        if (this.state === "playing") this.showToast(`VICTORY!\n${line}`, T.amber);
      }, 420);
      if (this.audio) {
        this.audio.tone(440, 660, .12, "triangle", .055, .08);
        this.audio.tone(660, 880, .16, "triangle", .05, .22);
        this.audio.tone(880, 1180, .2, "sine", .045, .38);
      }
    };
  });
})();
