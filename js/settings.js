(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const settingsButton = document.getElementById("settings-button");
    const settingsBackButton = document.getElementById("settings-back-button");
    const settingsMenu = document.getElementById("settings-menu");

    if (settingsButton && settingsBackButton && settingsMenu) {
      settingsButton.addEventListener("click", () => {
        if (window.starfallGame) window.starfallGame.showScreen("settings-menu");
      });

      settingsBackButton.addEventListener("click", () => {
        if (window.starfallGame) window.starfallGame.showScreen("main-menu");
      });
    }

    const game = window.starfallGame;
    const canvas = document.getElementById("game-canvas");
    if (!game || !canvas) return;

    let activeTouchPointer = null;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const TOUCH_OFFSET_PX = 110;
    const DOUBLE_TAP_MS = 360;
    const DOUBLE_TAP_DISTANCE = 90;

    const isTouch = (event) => event.pointerType === "touch" || event.pointerType === "pen";

    const applyTouchTarget = (event) => {
      if (!isTouch(event) || game.state !== "playing") return;
      const local = game.getLocalPlayer();
      if (!local) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = game.width / rect.width;
      const scaleY = game.height / rect.height;
      const touchX = (event.clientX - rect.left) * scaleX;
      const touchY = (event.clientY - rect.top) * scaleY;

      const offset = Math.min(TOUCH_OFFSET_PX * scaleY, game.height * 0.18);
      local.targetX = Math.max(30, Math.min(game.width - 30, touchX));
      local.targetY = Math.max(100, Math.min(game.height - 30, touchY - offset));

      if (game.onlineRole === "guest" && window.coopClient) {
        window.coopClient.sendInput(local.targetX / game.width, local.targetY / game.height);
      }
    };

    canvas.addEventListener("pointerdown", (event) => {
      if (!isTouch(event) || game.state !== "playing") return;

      activeTouchPointer = event.pointerId;
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}

      game.audio.setBackgrounded(false);
      game.audio.unlock();
      applyTouchTarget(event);

      const now = performance.now();
      const dx = event.clientX - lastTapX;
      const dy = event.clientY - lastTapY;
      const closeEnough = (dx * dx + dy * dy) <= DOUBLE_TAP_DISTANCE * DOUBLE_TAP_DISTANCE;
      const doubleTap = lastTapAt > 0 && (now - lastTapAt) <= DOUBLE_TAP_MS && closeEnough;

      if (doubleTap) {
        lastTapAt = 0;
        game.activatePulse();
      } else {
        lastTapAt = now;
        lastTapX = event.clientX;
        lastTapY = event.clientY;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    canvas.addEventListener("pointermove", (event) => {
      if (!isTouch(event) || event.pointerId !== activeTouchPointer) return;
      applyTouchTarget(event);
      event.preventDefault();
    });

    const endTouch = (event) => {
      if (!isTouch(event) || event.pointerId !== activeTouchPointer) return;
      activeTouchPointer = null;
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    };

    canvas.addEventListener("pointerup", endTouch);
    canvas.addEventListener("pointercancel", endTouch);
  });
})();
