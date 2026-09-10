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

  function pick(source, fields, width, height, netId) {
    const out = {};
    for (const field of fields) out[field] = source[field];
    out.netId = netId;
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

  const NETWORK_POSITION_FIELDS = new Set(["x", "y", "targetX", "targetY", "baseX", "tilt"]);

  function reconcile(current, sources, Type, fields, width, height, prefix, localIndex, receivedAt) {
    const existing = new Map((current || []).filter((item) => item._networkId).map((item) => [item._networkId, item]));
    return sources.map((source, index) => {
      const id = typeof source.netId === "string" ? source.netId : `${prefix}-${index}`;
      const target = hydrate(Type, source, fields, width, height);
      let object = existing.get(id);
      if (!object && prefix === "player") object = (current || [])[index];
      if (object && !(object instanceof Type)) object = null;
      if (!object) object = target;
      const firstNetworkUpdate = !object._networkId;
      object._networkId = id;
      for (const field of fields) if (!NETWORK_POSITION_FIELDS.has(field)) object[field] = target[field];
      object._networkX = target.x;
      object._networkY = target.y;
      object._networkTilt = Number.isFinite(target.tilt) ? target.tilt : object.tilt;
      object._networkAt = receivedAt;
      if (Number.isFinite(target.baseX)) object.baseX = target.baseX;
      if (index !== localIndex || prefix !== "player") {
        if (Number.isFinite(target.targetX)) object.targetX = target.targetX;
        if (Number.isFinite(target.targetY)) object.targetY = target.targetY;
      }
      if (firstNetworkUpdate) {
        object.x = target.x;
        object.y = target.y;
        if (Number.isFinite(target.tilt)) object.tilt = target.tilt;
      }
      return object;
    });
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
      this.stateSeq = 0;
      this.inputSeq = 0;
      this.lastGuestInputSeq = 0;
      this.lastSnapshotAck = 0;
      this.lastSnapshotSeq = -1;
      this.localTarget = null;
      this.pendingInputs = new Map();
      this.controlLatency = null;
      this.selectedShip = 0;
      this.bindUI();
    }

    bindUI() {
      this.status = document.getElementById("coop-status");
      this.actions = document.getElementById("coop-actions");
      this.waiting = document.getElementById("coop-waiting");
      this.input = document.getElementById("room-code-input");
      this.codeDisplay = document.getElementById("room-code-display");
      this.latencyLabel = document.getElementById("network-latency");
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
        this.latencyLabel.textContent = this.role === "host" ? "HOST" : "SYNC…";
        this.game.startCoop(this.role, this.room, message.ships, Boolean(message.shipAdjusted));
      } else if (message.type === "input" && this.role === "host") {
        this.lastGuestInputSeq = Number.isSafeInteger(message.seq) ? message.seq : this.lastGuestInputSeq;
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
      this.localTarget = { x:Starfall.clamp(x, 0, 1), y:Starfall.clamp(y, 0, 1) };
      const local=this.game.players?.[this.game.localPlayerIndex];
      if(local){local.targetX=this.localTarget.x*this.game.width;local.targetY=this.localTarget.y*this.game.height;}
      if (now - this.lastInputAt < 33) return;
      this.lastInputAt = now;
      const seq = ++this.inputSeq;
      this.pendingInputs.set(seq, now);
      this.send({ type: "input", x:this.localTarget.x, y:this.localTarget.y, seq });
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
      if (!this.socket || this.socket.bufferedAmount > 65536) return;
      this.lastStateAt = now;
      this.send({ type: "state", state: this.snapshot() });
    }

    idFor(item, prefix, index) {
      if (prefix === "player" || prefix === "companion") return `${prefix}-${index}`;
      if (!item._networkId) item._networkId = `${prefix}-${++this.nextEntityId}`;
      return item._networkId;
    }

    snapshot() {
      const g = this.game, w = g.width, h = g.height;
      if (!this.nextEntityId) this.nextEntityId = 0;
      return {
        seq:++this.stateSeq, guestInputAck:this.lastGuestInputSeq,
        elapsed:g.elapsed, score:g.score, kills:g.kills, killChain:g.killChain,
        comboTimer:g.comboTimer, combo:g.combo, bestCombo:g.bestCombo,
        pulseEnergy:g.pulseEnergy, nextBossTime:g.nextBossTime, finished:g.state === "gameover",
        players:g.players.map((item,index) => pick(item,FIELDS.player,w,h,this.idFor(item,"player",index))),
        playerProjectiles:g.playerProjectiles.map((item,index) => pick(item,FIELDS.projectile,w,h,this.idFor(item,"shot",index))),
        enemyProjectiles:g.enemyProjectiles.map((item,index) => pick(item,FIELDS.projectile,w,h,this.idFor(item,"enemy-shot",index))),
        enemies:g.enemies.map((item,index) => pick(item,FIELDS.enemy,w,h,this.idFor(item,"enemy",index))),
        powerups:g.powerups.map((item,index) => pick(item,FIELDS.powerup,w,h,this.idFor(item,"powerup",index))),
        boss:g.boss ? pick(g.boss,FIELDS.boss,w,h,"boss") : null,
        companions:g.companions.map((item,index) => pick(item,FIELDS.companion,w,h,this.idFor(item,"companion",index))),
      };
    }

    applySnapshot(state) {
      if (!state || !Array.isArray(state.players)) return false;
      if (Number.isSafeInteger(state.seq) && state.seq <= this.lastSnapshotSeq) return false;
      if (Number.isSafeInteger(state.seq)) this.lastSnapshotSeq = state.seq;
      const receivedAt=performance.now(),g=this.game,w=g.width,h=g.height;
      for (const key of ["elapsed","score","kills","killChain","comboTimer","combo","bestCombo","pulseEnergy","nextBossTime"]) {
        if (Number.isFinite(state[key])) g[key]=state[key];
      }
      this.acknowledgeInput(state.guestInputAck, receivedAt);
      g.players=reconcile(g.players,state.players,Starfall.Player,FIELDS.player,w,h,"player",g.localPlayerIndex,receivedAt);
      g.player=g.players[0];
      if(this.localTarget && g.players[g.localPlayerIndex]) {
        g.players[g.localPlayerIndex].targetX=this.localTarget.x*w;
        g.players[g.localPlayerIndex].targetY=this.localTarget.y*h;
      }
      g.playerProjectiles=reconcile(g.playerProjectiles,state.playerProjectiles||[],Starfall.Projectile,FIELDS.projectile,w,h,"shot",-1,receivedAt);
      g.enemyProjectiles=reconcile(g.enemyProjectiles,state.enemyProjectiles||[],Starfall.Projectile,FIELDS.projectile,w,h,"enemy-shot",-1,receivedAt);
      g.enemies=reconcile(g.enemies,state.enemies||[],Starfall.Enemy,FIELDS.enemy,w,h,"enemy",-1,receivedAt);
      g.powerups=reconcile(g.powerups,state.powerups||[],Starfall.PowerUp,FIELDS.powerup,w,h,"powerup",-1,receivedAt);
      g.boss=state.boss ? reconcile(g.boss?[g.boss]:[],[state.boss],Starfall.Boss,FIELDS.boss,w,h,"boss",-1,receivedAt)[0] : null;
      g.companions=reconcile(g.companions,state.companions||[],Starfall.CompanionDrone,FIELDS.companion,w,h,"companion",-1,receivedAt);
      g.companion=g.companions[0] || new Starfall.CompanionDrone(1,0);
      g.updateHUD();
      if (state.finished && g.state === "playing") g.endGame();
      return true;
    }

    acknowledgeInput(ack, now) {
      if (!Number.isSafeInteger(ack) || ack <= 0) return;
      this.lastSnapshotAck=Math.max(this.lastSnapshotAck,ack);
      const sentAt=this.pendingInputs.get(ack);
      for(const seq of this.pendingInputs.keys()) if(seq<=ack)this.pendingInputs.delete(seq);
      if(!Number.isFinite(sentAt))return;
      const sample=now-sentAt;
      this.controlLatency=this.controlLatency==null?sample:this.controlLatency*.78+sample*.22;
      const rounded=Math.round(this.controlLatency);
      this.latencyLabel.textContent=`${rounded} ms`;
      this.latencyLabel.classList.toggle("fair",rounded>=120&&rounded<220);
      this.latencyLabel.classList.toggle("poor",rounded>=220);
    }

    smooth(object, dt, rate, extrapolate) {
      if(!object || !Number.isFinite(object._networkX))return;
      const age=Math.min(.12,Math.max(0,(performance.now()-object._networkAt)/1000));
      const targetX=object._networkX+(extrapolate&&Number.isFinite(object.vx)?object.vx*age:0);
      const targetY=object._networkY+(extrapolate&&Number.isFinite(object.vy)?object.vy*age:0);
      const dx=targetX-object.x,dy=targetY-object.y;
      if(dx*dx+dy*dy>90000){object.x=targetX;object.y=targetY;}
      else {const blend=1-Math.exp(-rate*dt);object.x+=dx*blend;object.y+=dy*blend;}
      if(Number.isFinite(object._networkTilt))object.tilt+=(object._networkTilt-object.tilt)*(1-Math.exp(-14*dt));
    }

    updatePresentation(dt) {
      if(this.role!=="guest"||this.game.onlineRole!=="guest")return;
      const g=this.game,local=g.players[g.localPlayerIndex];
      if(local&&!local.dead){
        const pad=30,desiredX=Starfall.clamp(local.targetX,pad,g.width-pad),desiredY=Starfall.clamp(local.targetY,105,g.height-pad);
        const oldX=local.x,easing=1-Math.exp(-Starfall.CONFIG.PLAYER.followSpeed*dt);
        local.x+=(desiredX-local.x)*easing;local.y+=(desiredY-local.y)*easing;
        local.tilt+=((local.x-oldX)*.065-local.tilt)*Math.min(1,dt*9);
        const caughtUp=this.lastSnapshotAck>=this.inputSeq;
        if(caughtUp&&Number.isFinite(local._networkX)){
          const dx=local._networkX-local.x,dy=local._networkY-local.y;
          if(dx*dx+dy*dy>62500){local.x=local._networkX;local.y=local._networkY;}
          else if(dx*dx+dy*dy>36){const correction=1-Math.exp(-1.8*dt);local.x+=dx*correction;local.y+=dy*correction;}
        }
      }
      g.players.forEach((player,index)=>{if(index!==g.localPlayerIndex)this.smooth(player,dt,20,false);});
      g.playerProjectiles.forEach((item)=>this.smooth(item,dt,28,true));
      g.enemyProjectiles.forEach((item)=>this.smooth(item,dt,28,true));
      g.enemies.forEach((item)=>this.smooth(item,dt,18,false));
      g.powerups.forEach((item)=>this.smooth(item,dt,18,false));
      if(g.boss)this.smooth(g.boss,dt,14,false);
      g.companions.forEach((item)=>this.smooth(item,dt,20,false));
      g.effects.update(dt);
      g.updateHUD();
    }

    leave(sendMessage) {
      if (sendMessage !== false) this.send({ type: "leave" });
      this.intentionalClose = true;
      if (this.socket) this.socket.close();
      this.socket = null;
      this.role = null;
      this.room = null;
      this.lastSnapshotSeq = -1;
      this.lastSnapshotAck = 0;
      this.pendingInputs.clear();
      this.localTarget = null;
      this.controlLatency = null;
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
