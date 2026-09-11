(function () {
  "use strict";

  function installCoopPulseReliability() {
    const Client = window.Starfall?.CoopClient;
    if (!Client || Client.prototype.__pulseReliabilityPatch) return;

    const proto = Client.prototype;
    const originalPlayFx = proto.playFx;
    const originalTick = proto.tick;
    const originalSmooth = proto.smooth;

    proto.__pulseReliabilityPatch = true;

    // Keep important combat FX in a short rolling history. Each snapshot repeats
    // them for about a second, while the guest de-duplicates by event id. This
    // prevents a Pulse/Blast from disappearing when one presentation update is
    // delayed or a snapshot is superseded.
    proto.queueFx = function queueReliableFx(event, data) {
      if (this.role !== "host") return;
      this._fxEventSeq = (this._fxEventSeq || 0) + 1;
      const id = `${this.room || "coop"}:${this._fxEventSeq}`;
      const payload = Object.assign({}, data || {}, { __fxId: id });
      this.fxQueue.push({ event, data: payload, _expiresAt: performance.now() + 1100 });
      if (this.fxQueue.length > 64) this.fxQueue.splice(0, this.fxQueue.length - 64);
    };

    proto.drainFx = function retainRecentFx() {
      const now = performance.now();
      this.fxQueue = this.fxQueue.filter((item) => !item._expiresAt || item._expiresAt > now);
      if (!this.fxQueue.length) return undefined;
      return this.fxQueue.map((item) => ({ event: item.event, data: item.data }));
    };

    proto.playFx = function playReliableFx(event, data) {
      const id = data && data.__fxId;
      if (id) {
        if (!this._seenFx) this._seenFx = new Map();
        if (this._seenFx.has(id)) return;
        const now = performance.now();
        this._seenFx.set(id, now);
        for (const [seenId, seenAt] of this._seenFx) {
          if (now - seenAt > 5000) this._seenFx.delete(seenId);
        }
        while (this._seenFx.size > 96) this._seenFx.delete(this._seenFx.keys().next().value);
      }
      return originalPlayFx.call(this, event, data);
    };

    // The allocation-heavy reconciliation was already removed, so healthy links
    // can safely return to ~20 Hz snapshots. Congested sockets still fall back to
    // the existing slower cadence/backpressure behavior in online.js.
    proto.tick = function smootherHostTick(now) {
      const buffered = this.socket?.bufferedAmount || 0;
      if (
        this.role === "host" &&
        this.game?.onlineRole === "host" &&
        buffered <= 16384 &&
        now - this.lastStateAt >= 50 &&
        now - this.lastStateAt < 75
      ) {
        this.lastStateAt -= 25;
      }
      return originalTick.call(this, now);
    };

    // Slightly stronger presentation convergence reduces the soft trailing look
    // without changing the guest-owned projectile correction that fixed lasers.
    proto.smooth = function smootherPresentation(object, dt, rate, extrapolate) {
      return originalSmooth.call(this, object, dt, Math.min(30, rate * 1.12), extrapolate);
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCoopPulseReliability();

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
