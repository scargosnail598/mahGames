(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    if (!game) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("test") !== "1") return;

    const requested = Number(params.get("spear"));
    const testSpears = Math.max(0, Math.min(2, Number.isFinite(requested) ? requested : 2));

    const previousReset = game.resetWorld.bind(game);
    game.resetWorld = function () {
      const result = previousReset();
      this.roninSpears = testSpears;
      if (this.roninSpearBadge) {
        this.roninSpearBadge.querySelector("strong").textContent = `×${this.roninSpears}`;
        this.roninSpearBadge.classList.toggle("armed", this.roninSpears > 0);
      }
      return result;
    };

    game.roninSpears = testSpears;
    if (game.roninSpearBadge) {
      game.roninSpearBadge.querySelector("strong").textContent = `×${game.roninSpears}`;
      game.roninSpearBadge.classList.toggle("armed", game.roninSpears > 0);
    }
  });
})();
