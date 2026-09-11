(function () {
  "use strict";

  function install() {
    const presence=window.presenceClient;
    if(!presence){setTimeout(install,50);return;}
    presence.syncActivity=function () {
      if(!this.user)return;
      const game=window.starfallGame;
      const inGame=Boolean(game?.state==="playing"||window.coopClient?.role||game?.onlineRole);
      const activity=inGame?"in_game":"online";
      if(activity!==this.lastActivity){
        this.lastActivity=activity;
        if(inGame)this.openToCoop=false;
        if(this.toggle)this.toggle.checked=this.openToCoop;
        this.sendPresence();
        this.render();
      }
    };
    presence.syncActivity();
  }

  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
