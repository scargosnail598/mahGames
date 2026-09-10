(function () {
  "use strict";

  const FIELDS = {
    player: ["x","y","targetX","targetY","radius","health","shield","fireTimer","damageCooldown","sinceDamage","rapidFire","tripleLaser","invincible","droneTime","tilt","dead","variant"],
    projectile: ["x","y","vx","vy","friendly","damage","radius","color","life","fromBoss","dead"],
    enemy: ["type","x","y","baseX","radius","maxHealth","health","speed","score","contactDamage","color","age","phase","shootTimer","entrySide","dead"],
    powerup: ["x","y","type","radius","speed","age","dead"],
    boss: ["x","y","radius","maxHealth","health","age","attackTimer","pattern","entering","weakPhase","dead","score","contactDamage"],
    companion: ["x","y","side","playerIndex","fireTimer"],
  };

  function pick(source, fields, width, height) {
    const out = {};
    for (const field of fields) out[field] = source[field];
    out.x = source.x / width;
    out.y = source.y / height;
    if (typeof source.targetX === "number") out.targetX = source.targetX / width;
    if (typeof source.targetY === "number") out.targetY = source.targetY / height;
    if (typeof source.baseX === "number") out.baseX = source.baseX / width;
    return out;
  }

  function hydrate(Type, source, fields, width, height) {
    const object = Object.create(Type.prototype);
    for (const field of fields) object[field] = source[field];
    object.x = source.x * width;
    object.y = source.y * height;
    if (typeof source.targetX === "number") object.targetX = source.targetX * width;
    if (typeof source.targetY === "number") object.targetY = source.targetY * height;
    if (typeof source.baseX === "number") object.baseX = source.baseX * width;
    return object;
  }

  class CoopClient {
    constructor(game) {
      this.game = game;
      this.socket = null;
      this.role = null;
      this.room = null;
      this.intentionalClose = false;
      this.lastInputAt = 0;
      this.lastStateAt = 0;
      this.selectedShip = 0;
      this.bindUI();
    }

    bindUI() {
      this.status = document.getElementById("coop-status");
      this.actions = document.getElementById("coop-actions");
      this.waiting = document.getElementById("coop-waiting");
      this.input = document.getElementById("room-code-input");
      this.codeDisplay = document.getElementById("room-code-display");
      const soloPicker = document.getElementById("solo-ship-picker");
      const picker = document.querySelector(".ship-picker");
      if (soloPicker && picker) soloPicker.appendChild(picker.cloneNode(true));
      this.shipChoices = Array.from(document.querySelectorAll(".ship-choice"));
      this.shipChoices.forEach((choice) => {
        const canvas = document.createElement("canvas");
        canvas.width = 240; canvas.height = 180;
        canvas.className = "fighter-preview";
        canvas.setAttribute("aria-hidden", "true");
        choice.querySelector(".ship-preview").replaceWith(canvas);
        choice.previewCanvas = canvas;
      });
      this.shipChoices.forEach((choice) => choice.addEventListener("click", () => {
        this.selectedShip = Number(choice.dataset.ship);
        this.shipChoices.forEach((item) => {
          const selected = Number(item.dataset.ship) === this.selectedShip;
          item.classList.toggle("selected", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
      }));
      document.getElementById("coop-button").addEventListener("click", () => {
        this.game.showScreen("coop-menu");
        this.setStatus("CONNECT TO CREATE OR JOIN A ROOM");
      });
      document.getElementById("coop-back-button").addEventListener("click", () => {
        this.leave();
        this.game.showScreen("main-menu");
      });
      document.getElementById("create-room-button").addEventListener("click", () => this.createRoom());
      document.getElementById("join-room-button").addEventListener("click", () => this.joinRoom());
      this.input.addEventListener("input", () => { this.input.value = this.input.value.toUpperCase().replace(/[^A-Z]/g, ""); });
      this.input.addEventListener("keydown", (event) => { if (event.key === "Enter") this.joinRoom(); });
      document.getElementById("copy-room-button").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(this.room || "");
          this.setStatus("ROOM CODE COPIED");
        } catch (_) {
          this.setStatus(`ROOM: ${this.room}`);
        }
      });
    }

    setStatus(message, error) {
      this.status.textContent = message;
      this.status.classList.toggle("error", Boolean(error));
    }

    async connect() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
      if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
        await new Promise((resolve, reject) => {
          this.socket.addEventListener("open", resolve, { once: true });
          this.socket.addEventListener("error", reject, { once: true });
        });
        return;
      }
      this.intentionalClose = false;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      this.socket = new WebSocket(`${protocol}//${location.host}/ws`);
      this.setStatus("CONNECTING…");
      this.socket.addEventListener("message", (event) => this.onMessage(event));
      this.socket.addEventListener("close", () => this.onClose());
      await new Promise((resolve, reject) => {
        this.socket.addEventListener("open", resolve, { once: true });
        this.socket.addEventListener("error", reject, { once: true });
      });
    }

    async createRoom() {
      try {
        await this.connect();
        this.send({ type: "create", ship: this.selectedShip });
      } catch (_) { this.setStatus("SERVER CONNECTION FAILED", true); }
    }

    async joinRoom() {
      const room = this.input.value.trim().toUpperCase();
      if (room.length !== 5) { this.setStatus("ENTER THE FIVE-LETTER CODE", true); return; }
      try {
        await this.connect();
        this.send({ type: "join", room, ship: this.selectedShip });
      } catch (_) { this.setStatus("SERVER CONNECTION FAILED", true); }
    }

    send(message) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    }

    onMessage(event) {
      let message;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      if (message.type === "created") {
        this.role = "host";
        this.room = message.room;
        this.actions.classList.add("hidden");
        this.waiting.classList.remove("hidden");
        this.codeDisplay.textContent = message.room;
        this.setStatus("WAITING FOR WINGMATE");
      } else if (message.type === "ready") {
        this.role = message.role;
        this.room = message.room;
        this.actions.classList.add("hidden");
        this.waiting.classList.add("hidden");
        this.game.startCoop(this.role, this.room, message.ships, Boolean(message.shipAdjusted));
      } else if (message.type === "input" && this.role === "host") {
        const player = this.game.players[1];
        if (player) {
          player.targetX = Starfall.clamp(message.x, 0, 1) * this.game.width;
          player.targetY = Starfall.clamp(message.y, 0, 1) * this.game.height;
        }
      } else if (message.type === "pulse" && this.role === "host") {
        this.game.activatePulse(1);
      } else if (message.type === "state" && this.role === "guest") {
        this.applySnapshot(message.state);
      } else if (message.type === "peer_left") {
        this.setStatus("THE OTHER PILOT DISCONNECTED", true);
        this.game.mainMenu();
        this.game.showScreen("coop-menu");
      } else if (message.type === "error") {
        this.setStatus(message.message || "CO-OP ERROR", true);
      }
    }

    sendInput(x, y) {
      const now = performance.now();
      if (now - this.lastInputAt < 33) return;
      this.lastInputAt = now;
      this.send({ type: "input", x, y });
    }

    sendPulse() { this.send({ type: "pulse" }); }

    tick(now) {
      if (!document.hidden) this.shipChoices.forEach((choice) => {
        if (!choice.getClientRects().length) return;
        const canvas = choice.previewCanvas, ctx = canvas.getContext("2d");
        const time = Starfall.THEME.reducedMotion.matches ? 0 : now / 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(120, 86 + Math.sin(time * 1.7) * 4);
        ctx.scale(2.25, 2.25);
        ctx.rotate(Math.sin(time * .7) * .08);
        Starfall.THEME.ship(ctx, "player", time, Number(choice.dataset.ship));
        ctx.restore();
      });
      if (this.role !== "host" || this.game.onlineRole !== "host" || now - this.lastStateAt < 50) return;
      this.lastStateAt = now;
      this.send({ type: "state", state: this.snapshot() });
    }

    snapshot() {
      const g = this.game, w = g.width, h = g.height;
      return {
        elapsed:g.elapsed, score:g.score, kills:g.kills, killChain:g.killChain,
        comboTimer:g.comboTimer, combo:g.combo, bestCombo:g.bestCombo,
        pulseEnergy:g.pulseEnergy, nextBossTime:g.nextBossTime, finished:g.state === "gameover",
        players:g.players.map((item) => pick(item, FIELDS.player, w, h)),
        playerProjectiles:g.playerProjectiles.map((item) => pick(item, FIELDS.projectile, w, h)),
        enemyProjectiles:g.enemyProjectiles.map((item) => pick(item, FIELDS.projectile, w, h)),
        enemies:g.enemies.map((item) => pick(item, FIELDS.enemy, w, h)),
        powerups:g.powerups.map((item) => pick(item, FIELDS.powerup, w, h)),
        boss:g.boss ? pick(g.boss, FIELDS.boss, w, h) : null,
        companions:g.companions.map((item) => pick(item, FIELDS.companion, w, h)),
      };
    }

    applySnapshot(state) {
      if (!state || !Array.isArray(state.players)) return;
      const g=this.game, w=g.width, h=g.height;
      for (const key of ["elapsed","score","kills","killChain","comboTimer","combo","bestCombo","pulseEnergy","nextBossTime"]) {
        if (Number.isFinite(state[key])) g[key]=state[key];
      }
      g.players=state.players.map((item) => hydrate(Starfall.Player,item,FIELDS.player,w,h));
      g.player=g.players[0];
      g.playerProjectiles=(state.playerProjectiles || []).map((item) => hydrate(Starfall.Projectile,item,FIELDS.projectile,w,h));
      g.enemyProjectiles=(state.enemyProjectiles || []).map((item) => hydrate(Starfall.Projectile,item,FIELDS.projectile,w,h));
      g.enemies=(state.enemies || []).map((item) => hydrate(Starfall.Enemy,item,FIELDS.enemy,w,h));
      g.powerups=(state.powerups || []).map((item) => hydrate(Starfall.PowerUp,item,FIELDS.powerup,w,h));
      g.boss=state.boss ? hydrate(Starfall.Boss,state.boss,FIELDS.boss,w,h) : null;
      g.companions=(state.companions || []).map((item) => hydrate(Starfall.CompanionDrone,item,FIELDS.companion,w,h));
      g.companion=g.companions[0] || new Starfall.CompanionDrone(1,0);
      g.updateHUD();
      if (state.finished && g.state === "playing") g.endGame();
    }

    leave(sendMessage) {
      if (sendMessage !== false) this.send({ type: "leave" });
      this.intentionalClose = true;
      if (this.socket) this.socket.close();
      this.socket = null;
      this.role = null;
      this.room = null;
      this.actions.classList.remove("hidden");
      this.waiting.classList.add("hidden");
    }

    onClose() {
      if (!this.intentionalClose && this.game.onlineRole) {
        this.game.mainMenu();
        this.game.showScreen("coop-menu");
        this.setStatus("CONNECTION LOST — TRY AGAIN", true);
      }
    }
  }

  Starfall.CoopClient = CoopClient;

  window.addEventListener("DOMContentLoaded", () => {
    window.coopClient = new CoopClient(window.starfallGame);
    const frame = (now) => { window.coopClient.tick(now); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
})();
