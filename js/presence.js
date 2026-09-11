(function () {
  "use strict";

  const script=document.currentScript;
  const assetVersion=script&&script.src.includes("?")?script.src.slice(script.src.indexOf("?")):"";
  if(!document.querySelector('link[data-starfall-presence]')){
    const link=document.createElement("link");
    link.rel="stylesheet";link.href=`css/presence.css${assetVersion}`;link.dataset.starfallPresence="true";document.head.appendChild(link);
  }

  class PresenceClient {
    constructor() {
      this.socket=null;
      this.user=null;
      this.users=[];
      this.openToCoop=false;
      this.pendingOutgoing=null;
      this.pendingIncoming=null;
      this.lastActivity="online";
      this.reconnectTimer=null;
      this.buildUI();
      this.bindAuth();
      window.setInterval(()=>this.syncActivity(),1500);
    }

    buildUI() {
      const card=document.querySelector("#coop-menu .coop-card");
      if(!card)return;
      const block=document.createElement("section");
      block.id="presence-panel";block.className="presence-panel";
      block.innerHTML=`
        <div class="presence-heading">
          <span><i id="presence-dot"></i><strong id="presence-count">0 ONLINE</strong></span>
          <label class="presence-toggle"><input id="presence-available" type="checkbox"><span>OPEN FOR CO-OP</span></label>
        </div>
        <div id="presence-signed-out" class="presence-empty">SIGN IN TO SEE ONLINE PILOTS AND SEND INVITES</div>
        <div id="presence-list" class="presence-list hidden" aria-live="polite"></div>
      `;
      const copy=card.querySelector(".coop-copy");
      copy.insertAdjacentElement("afterend",block);
      this.count=block.querySelector("#presence-count");
      this.dot=block.querySelector("#presence-dot");
      this.toggle=block.querySelector("#presence-available");
      this.list=block.querySelector("#presence-list");
      this.signedOut=block.querySelector("#presence-signed-out");
      this.toggle.addEventListener("change",()=>{
        this.openToCoop=this.toggle.checked;
        this.sendPresence();
        this.render();
      });

      const modal=document.createElement("div");
      modal.id="coop-invite-modal";modal.className="coop-invite-modal hidden";
      modal.innerHTML=`<div class="coop-invite-card"><div class="eyebrow">INCOMING LINK</div><h3>CO-OP INVITE</h3><div id="coop-invite-person"></div><p>Wants you as a wingmate.</p><div class="coop-invite-actions"><button id="coop-invite-decline" class="secondary-button" type="button">DECLINE</button><button id="coop-invite-accept" class="primary-button" type="button">ACCEPT</button></div></div>`;
      document.getElementById("game-shell").appendChild(modal);
      this.modal=modal;this.modalPerson=modal.querySelector("#coop-invite-person");
      modal.querySelector("#coop-invite-decline").addEventListener("click",()=>this.respondInvite(false));
      modal.querySelector("#coop-invite-accept").addEventListener("click",()=>this.respondInvite(true));
    }

    bindAuth() {
      window.addEventListener("starfall:auth",event=>this.setUser(event.detail?.user||null));
      if(window.starfallUser)this.setUser(window.starfallUser);
    }

    setUser(user) {
      this.user=user||null;
      if(!this.user){this.openToCoop=false;if(this.toggle)this.toggle.checked=false;this.close(true);this.users=[];this.render();return;}
      this.connect();
    }

    connect() {
      if(!this.user||this.socket?.readyState===WebSocket.OPEN||this.socket?.readyState===WebSocket.CONNECTING)return;
      clearTimeout(this.reconnectTimer);
      const protocol=location.protocol==="https:"?"wss:":"ws:";
      const socket=new WebSocket(`${protocol}//${location.host}/presence`);
      this.socket=socket;
      socket.addEventListener("open",()=>{this.dot?.classList.add("online");this.sendPresence();});
      socket.addEventListener("message",event=>this.onMessage(event));
      socket.addEventListener("close",()=>{
        if(this.socket===socket)this.socket=null;
        this.dot?.classList.remove("online");
        if(this.user)this.reconnectTimer=setTimeout(()=>this.connect(),2500);
      });
    }

    close(intentional) {
      clearTimeout(this.reconnectTimer);
      const socket=this.socket;this.socket=null;
      if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))socket.close();
      if(intentional)this.dot?.classList.remove("online");
    }

    send(message) {
      if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));
    }

    sendPresence() {
      this.send({type:"presence",available:this.openToCoop,activity:this.lastActivity});
    }

    syncActivity() {
      if(!this.user)return;
      const inGame=Boolean(window.coopClient?.role||window.starfallGame?.onlineRole);
      const activity=inGame?"in_game":"online";
      if(activity!==this.lastActivity){this.lastActivity=activity;if(inGame)this.openToCoop=false;if(this.toggle)this.toggle.checked=this.openToCoop;this.sendPresence();this.render();}
    }

    invite(userId) {
      if(!this.openToCoop)return;
      this.pendingOutgoing={targetUserId:userId};
      this.send({type:"invite",targetUserId:userId});
      this.render();
    }

    respondInvite(accept) {
      if(!this.pendingIncoming)return;
      this.send({type:accept?"invite_accept":"invite_decline",inviteId:this.pendingIncoming.inviteId});
      if(accept){
        this.openToCoop=false;if(this.toggle)this.toggle.checked=false;this.sendPresence();
        window.starfallGame?.showScreen?.("coop-menu");
      }
      this.pendingIncoming=null;this.modal.classList.add("hidden");
    }

    onMessage(event) {
      let message;try{message=JSON.parse(event.data);}catch(_){return;}
      if(message.type==="presence_list"){
        this.users=Array.isArray(message.users)?message.users:[];this.render();
      }else if(message.type==="invite_received"){
        this.pendingIncoming=message;
        const from=message.from||{};
        this.modalPerson.innerHTML=`${this.avatarMarkup(from)}<strong>${this.escape(from.displayName||"Pilot")}</strong><small>BEST ${(Number(from.bestScore)||0).toLocaleString()}</small>`;
        this.modal.classList.remove("hidden");
      }else if(message.type==="invite_accepted"){
        this.pendingOutgoing={inviteId:message.inviteId,targetUserId:message.userId};
        this.openToCoop=false;if(this.toggle)this.toggle.checked=false;this.sendPresence();
        window.starfallGame?.showScreen?.("coop-menu");
        window.coopClient?.createRoom?.();
      }else if(message.type==="invite_declined"||message.type==="invite_expired"){
        this.pendingOutgoing=null;this.render();
      }else if(message.type==="invite_room"){
        this.pendingIncoming=null;this.modal.classList.add("hidden");
        const room=String(message.room||"").toUpperCase();
        if(room.length===5&&window.coopClient){window.starfallGame?.showScreen?.("coop-menu");window.coopClient.input.value=room;window.coopClient.joinRoom();}
      }else if(message.type==="error"){
        this.pendingOutgoing=null;this.render();
      }
    }

    publishRoom(room) {
      if(!this.pendingOutgoing?.inviteId||!room)return;
      this.send({type:"invite_room",inviteId:this.pendingOutgoing.inviteId,room});
      this.pendingOutgoing=null;
    }

    avatarMarkup(user) {
      const name=this.escape(user.displayName||"Pilot"),url=String(user.avatarUrl||"");
      if(/^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com\//i.test(url))return `<img src="${this.escape(url)}" alt="${name}">`;
      const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();
      return `<span class="presence-avatar">${this.escape(initials||"P")}</span>`;
    }

    escape(value) { const node=document.createElement("span");node.textContent=String(value??"");return node.innerHTML; }

    render() {
      if(!this.list)return;
      const online=this.users.length;
      this.count.textContent=`${online} ONLINE`;
      const signedIn=Boolean(this.user);
      this.signedOut.classList.toggle("hidden",signedIn);
      this.list.classList.toggle("hidden",!signedIn);
      this.toggle.disabled=!signedIn||this.lastActivity==="in_game";
      if(!signedIn){this.list.innerHTML="";return;}
      const others=this.users.filter(item=>Number(item.userId)!==Number(this.user.id));
      if(!others.length){this.list.innerHTML='<div class="presence-empty">NO OTHER PILOTS ONLINE YET</div>';return;}
      this.list.innerHTML=others.map(item=>{
        const ready=Boolean(item.available)&&item.activity!=="in_game";
        const busy=item.activity==="in_game";
        const pending=Number(this.pendingOutgoing?.targetUserId)===Number(item.userId);
        return `<div class="presence-user">
          <div class="presence-user-main">${this.avatarMarkup(item)}<span><strong>${this.escape(item.displayName||"Pilot")}</strong><small>BEST ${(Number(item.bestScore)||0).toLocaleString()}</small></span></div>
          <span class="presence-state ${ready?"ready":busy?"busy":""}">${ready?"CO-OP READY":busy?"IN GAME":"ONLINE"}</span>
          <button class="presence-invite" type="button" data-user-id="${Number(item.userId)}" ${(!ready||!this.openToCoop||pending)?"disabled":""}>${pending?"SENT":"INVITE"}</button>
        </div>`;
      }).join("");
      this.list.querySelectorAll(".presence-invite").forEach(button=>button.addEventListener("click",()=>this.invite(Number(button.dataset.userId))));
    }
  }

  window.addEventListener("DOMContentLoaded",()=>{
    const presence=new PresenceClient();window.presenceClient=presence;
    const coop=window.coopClient;
    if(coop){
      const original=coop.onMessage.bind(coop);
      coop.onMessage=function(event){
        let message=null;try{message=JSON.parse(event.data);}catch(_){}
        original(event);
        if(message?.type==="created")presence.publishRoom(message.room);
      };
    }
  });
})();
