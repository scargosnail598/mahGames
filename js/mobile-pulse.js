(function () {
  "use strict";

  const isTouchPointer = (event) => event.pointerType === "touch" || event.pointerType === "pen";
  const DOUBLE_TAP_MS = 300;
  const DOUBLE_TAP_DISTANCE = 56;
  const TOUCH_Y_OFFSET = 110;

  window.addEventListener("DOMContentLoaded", () => {
    const game = window.starfallGame;
    const canvas = document.getElementById("game-canvas");
    const hud = document.getElementById("hud");
    if (!game || !canvas || !hud) return;

    const indicator = document.createElement("div");
    indicator.id = "mobile-pulse-indicator";
    indicator.setAttribute("aria-live", "polite");
    indicator.innerHTML = '<span>PULSE</span><strong>CHARGING 0%</strong><small>DOUBLE TAP WHEN READY</small>';
    hud.appendChild(indicator);

    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    function moveTouchShip(event) {
      if (!isTouchPointer(event) || game.state !== "playing") return;
      const local = game.getLocalPlayer && game.getLocalPlayer();
      if (!local) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = game.width / rect.width;
      const scaleY = game.height / rect.height;
      const rawX = (event.clientX - rect.left) * scaleX;
      const rawY = (event.clientY - rect.top) * scaleY;
      const adaptiveOffset = Math.min(TOUCH_Y_OFFSET, Math.max(60, rawY * 0.42));

      local.targetX = Math.max(30, Math.min(game.width - 30, rawX));
      local.targetY = Math.max(100, Math.min(game.height - 30, rawY - adaptiveOffset));

      if (game.onlineRole === "guest" && window.coopClient) {
        window.coopClient.sendInput(local.targetX / game.width, local.targetY / game.height);
      }
    }

    function handleTouchDown(event) {
      if (!isTouchPointer(event) || game.state !== "playing") return;

      // Prevent the legacy canvas pointerdown handler from consuming Pulse on every touch.
      event.preventDefault();
      event.stopImmediatePropagation();
      moveTouchShip(event);

      const now = performance.now();
      const dx = event.clientX - lastTapX;
      const dy = event.clientY - lastTapY;
      const closeEnough = dx * dx + dy * dy <= DOUBLE_TAP_DISTANCE * DOUBLE_TAP_DISTANCE;
      const isDoubleTap = now - lastTapAt <= DOUBLE_TAP_MS && closeEnough;

      if (isDoubleTap) {
        lastTapAt = 0;
        if (game.pulseEnergy >= Starfall.CONFIG.PULSE.maxEnergy) {
          game.activatePulse();
          indicator.classList.remove("flash");
          void indicator.offsetWidth;
          indicator.classList.add("flash");
        }
      } else {
        lastTapAt = now;
        lastTapX = event.clientX;
        lastTapY = event.clientY;
      }
    }

    function handleTouchMove(event) {
      if (!isTouchPointer(event) || game.state !== "playing") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      moveTouchShip(event);
    }

    canvas.addEventListener("pointerdown", handleTouchDown, { capture: true, passive: false });
    canvas.addEventListener("pointermove", handleTouchMove, { capture: true, passive: false });

    function updateIndicator() {
      const max = Starfall.CONFIG.PULSE.maxEnergy;
      const pct = Math.max(0, Math.min(100, Math.round((game.pulseEnergy / max) * 100)));
      const ready = pct >= 100;
      indicator.classList.toggle("ready", ready);
      const strong = indicator.querySelector("strong");
      strong.textContent = ready ? "READY — DOUBLE TAP" : `CHARGING ${pct}%`;
      requestAnimationFrame(updateIndicator);
    }

    updateIndicator();
  });
})();
