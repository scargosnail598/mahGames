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
    const TOUCH_OFFSET_PX = 110;

    const applyTouchTarget = (event) => {
      if (event.pointerType !== "touch" || game.state !== "playing") return;
      const local = game.getLocalPlayer();
      if (!local) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = game.width / rect.width;
      const scaleY = game.height / rect.height;
      const touchX = (event.clientX - rect.left) * scaleX;
      const touchY = (event.clientY - rect.top) * scaleY;

      // Keep the fighter visibly above the player's finger while preserving
      // direct horizontal control. Clamp at the playfield edges.
      const offset = Math.min(TOUCH_OFFSET_PX * scaleY, game.height * 0.18);
      local.targetX = Math.max(30, Math.min(game.width - 30, touchX));
      local.targetY = Math.max(100, Math.min(game.height - 30, touchY - offset));

      if (game.onlineRole === "guest" && window.coopClient) {
        window.coopClient.sendInput(local.targetX / game.width, local.targetY / game.height);
      }
    };

    // Capture touch starts before the game's generic canvas pointerdown handler.
    // This prevents a normal steering touch from consuming Pulse Blast.
    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" || game.state !== "playing") return;
      activeTouchPointer = event.pointerId;
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      game.audio.setBackgrounded(false);
      game.audio.unlock();
      applyTouchTarget(event);
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    // Registered after game.js, so this touch-specific target wins over the
    // generic mouse mapping without changing desktop behavior.
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch" || event.pointerId !== activeTouchPointer) return;
      applyTouchTarget(event);
      event.preventDefault();
    });

    const endTouch = (event) => {
      if (event.pointerType !== "touch" || event.pointerId !== activeTouchPointer) return;
      activeTouchPointer = null;
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    };

    canvas.addEventListener("pointerup", endTouch);
    canvas.addEventListener("pointercancel", endTouch);
  });
})();
