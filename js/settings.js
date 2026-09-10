(function () {
  "use strict";

  window.addEventListener("DOMContentLoaded", () => {
    const settingsButton = document.getElementById("settings-button");
    const settingsBackButton = document.getElementById("settings-back-button");
    const settingsMenu = document.getElementById("settings-menu");

    if (!settingsButton || !settingsBackButton || !settingsMenu) return;

    settingsButton.addEventListener("click", () => {
      if (window.starfallGame) window.starfallGame.showScreen("settings-menu");
    });

    settingsBackButton.addEventListener("click", () => {
      if (window.starfallGame) window.starfallGame.showScreen("main-menu");
    });
  });
})();
