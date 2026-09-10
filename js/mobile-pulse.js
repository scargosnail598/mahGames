(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    const hud = document.getElementById("hud");
    if (!game || !hud) return;

    const indicator = document.createElement("div");
    indicator.id = "mobile-pulse-indicator";
    indicator.setAttribute("aria-live", "polite");
    indicator.innerHTML = '<div class="pulse-indicator-content"><span>PULSE</span><strong>0%</strong><small>CHARGING</small></div>';
    hud.appendChild(indicator);

    let wasReady = false;

    function updateIndicator() {
      const max = Starfall.CONFIG.PULSE.maxEnergy;
      const pct = Math.max(0, Math.min(100, Math.round((game.pulseEnergy / max) * 100)));
      const ready = pct >= 100;

      indicator.style.setProperty("--pulse-charge", `${pct}%`);
      indicator.classList.toggle("ready", ready);
      indicator.querySelector("strong").textContent = ready ? "READY" : `${pct}%`;
      indicator.querySelector("small").textContent = ready ? "2× TAP" : "CHARGING";

      if (ready && !wasReady) {
        indicator.classList.remove("flash");
        void indicator.offsetWidth;
        indicator.classList.add("flash");
      }
      wasReady = ready;
      requestAnimationFrame(updateIndicator);
    }

    updateIndicator();
  });
})();
