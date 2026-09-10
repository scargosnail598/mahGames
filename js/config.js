(function () {
  "use strict";

  window.Starfall = window.Starfall || {};
  Starfall.CONFIG = Object.freeze({
    PLAYER: {
      maxHealth: 100,
      maxShield: 100,
      radius: 17,
      followSpeed: 7.2,
      autoFireRate: 0.22,
      rapidFireRate: 0.105,
      laserSpeed: 720,
      invulnerabilityAfterHit: 0.7,
      shieldRechargeDelay: 4.0,
      shieldRechargeRate: 11,
    },
    PULSE: {
      maxEnergy: 100,
      passiveCharge: 2.7,
      killCharge: 11,
      radius: 330,
      damage: 150,
    },
    COMBO: {
      resetTime: 4.0,
      stepEvery: 3,
      maxMultiplier: 8,
    },
    SPAWN: {
      startingInterval: 1.18,
      minimumInterval: 0.48,
      difficultyRampSeconds: 260,
      powerUpChance: 0.12,
      bossFirstTime: 150,
      bossRepeatTime: 165,
    },
    POWERUP: {
      duration: 10,
      invincibilityDuration: 7,
      droneDuration: 16,
    },
    WORLD: {
      maxDelta: 0.033,
      collisionForgiveness: 0.78,
      starCount: 115,
    },
  });

  Starfall.clamp = function (value, min, max) { return Math.max(min, Math.min(max, value)); };
  Starfall.lerp = function (a, b, t) { return a + (b - a) * t; };
  Starfall.random = function (min, max) { return min + Math.random() * (max - min); };
  Starfall.distanceSq = function (a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  Starfall.collides = function (a, b, forgiveness) {
    const radius = (a.radius + b.radius) * (forgiveness || 1);
    return Starfall.distanceSq(a, b) < radius * radius;
  };
})();
