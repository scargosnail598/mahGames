(function(){
  "use strict";

  function ready(fn){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fn,{once:true});else fn();}

  ready(()=>{
    if(document.getElementById("leaderboard-menu"))return;
    const shell=document.getElementById("game-shell");
    const mainCard=document.querySelector("#main-menu .hero-card");
    if(!shell||!mainCard)return;

    const style=document.createElement("style");
    style.textContent=`
      .leaderboard-entry{position:absolute;left:16px;top:16px;z-index:4;width:auto!important;min-width:0;padding:9px 12px!important;font-size:.72rem!important;letter-spacing:.08em}
      .leaderboard-card{width:min(92vw,520px)}
      .leaderboard-list{display:grid;gap:7px;margin:14px 0 18px;max-height:min(52vh,430px);overflow:auto;padding-right:3px}
      .leaderboard-row{display:grid;grid-template-columns:34px 36px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 10px;border:1px solid rgba(127,247,255,.16);background:rgba(7,11,24,.58);border-radius:9px}
      .leaderboard-row.me{border-color:rgba(127,247,255,.62);box-shadow:0 0 16px rgba(127,247,255,.08)}
      .leaderboard-rank{font-weight:800;opacity:.78;text-align:center}
      .leaderboard-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.08)}
      .leaderboard-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
      .leaderboard-score{font-variant-numeric:tabular-nums;font-weight:900;color:#7ff7ff}
      .leaderboard-empty{opacity:.68;padding:22px 10px;text-align:center}
      .leaderboard-note{font-size:.72rem;opacity:.58;margin:-4px 0 10px}
      .auth-best-score{font-size:.72rem;letter-spacing:.08em;color:#7ff7ff;margin:8px 0 10px}
      @media(max-width:520px){.leaderboard-entry{top:12px;left:12px;padding:7px 9px!important;font-size:.64rem!important}.leaderboard-row{grid-template-columns:28px 30px minmax(0,1fr) auto;gap:7px;padding:7px}.leaderboard-avatar{width:28px;height:28px}}
    `;
    document.head.appendChild(style);

    const button=document.createElement("button");
    button.id="leaderboard-button";button.className="secondary-button leaderboard-entry";button.type="button";button.textContent="🏆 LEADERBOARD";
    mainCard.appendChild(button);

    const section=document.createElement("section");
    section.id="leaderboard-menu";section.className="overlay";section.setAttribute("aria-label","Leaderboard");
    section.innerHTML=`<div class="menu-card compact-card leaderboard-card"><div class="eyebrow">PILOT RANKINGS</div><h2>LEADERBOARD</h2><p class="leaderboard-note">Best solo score per signed-in pilot</p><div id="leaderboard-list" class="leaderboard-list" role="list"><div class="leaderboard-empty">LOADING…</div></div><button id="leaderboard-back-button" class="primary-button" type="button">BACK</button></div>`;
    shell.appendChild(section);

    const list=section.querySelector("#leaderboard-list");
    const back=section.querySelector("#leaderboard-back-button");
    let loading=false;

    function esc(value){return String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);}
    function fallbackAvatar(name){const text=String(name||"P").trim().split(/\s+/).slice(0,2).map(p=>p[0]||"").join("").toUpperCase();return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#142038"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="24" fill="#7ff7ff">${text}</text></svg>`)}`;}

    async function loadLeaderboard(){
      if(loading)return;loading=true;list.innerHTML='<div class="leaderboard-empty">LOADING…</div>';
      try{
        const response=await fetch("/api/leaderboard",{credentials:"same-origin",cache:"no-store"});
        const body=await response.json();
        if(!response.ok||!Array.isArray(body.entries))throw new Error("leaderboard unavailable");
        if(!body.entries.length){list.innerHTML='<div class="leaderboard-empty">NO SCORES YET — BE THE FIRST PILOT</div>';return;}
        const me=window.starfallUser&&Number(window.starfallUser.id);
        list.innerHTML=body.entries.map((entry,index)=>{
          const mine=me&&Number(entry.userId)===me;
          const avatar=entry.avatarUrl||fallbackAvatar(entry.displayName);
          return `<div class="leaderboard-row${mine?" me":""}" role="listitem"><span class="leaderboard-rank">${index+1}</span><img class="leaderboard-avatar" src="${esc(avatar)}" alt=""><span class="leaderboard-name">${esc(entry.displayName)}</span><strong class="leaderboard-score">${Number(entry.score||0).toLocaleString()}</strong></div>`;
        }).join("");
      }catch(_){list.innerHTML='<div class="leaderboard-empty">LEADERBOARD TEMPORARILY UNAVAILABLE</div>';}
      finally{loading=false;}
    }

    button.addEventListener("click",()=>{window.starfallGame?.showScreen("leaderboard-menu");loadLeaderboard();});
    back.addEventListener("click",()=>window.starfallGame?.showScreen("main-menu"));

    async function submitScore(result){
      try{
        const response=await fetch("/api/scores",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(result)});
        if(response.status===401)return;
        const body=await response.json();
        if(!response.ok)return;
        if(window.starfallUser){window.starfallUser.bestScore=body.bestScore||window.starfallUser.bestScore||0;}
        const best=document.querySelector(".auth-best-score");if(best)best.textContent=`BEST SCORE  ${Number(body.bestScore||0).toLocaleString()}`;
        if(body.personalBest&&window.starfallGame)window.starfallGame.showToast("NEW PERSONAL BEST!","#7ff7ff");
      }catch(_){}
    }

    const game=window.starfallGame;
    if(game&&!game.__leaderboardWrapped){
      game.__leaderboardWrapped=true;
      const original=game.endGame.bind(game);
      game.endGame=function(){
        if(this.state!=="playing")return original();
        const solo=!this.onlineRole;
        const result=solo?{score:Math.max(0,Math.round(this.score||0)),kills:Math.max(0,Math.round(this.kills||0)),durationSeconds:Math.max(0,Math.floor(this.elapsed||0)),environment:this.environment?.id||"neo-shibuya",mode:"solo"}:null;
        original();
        if(result)submitScore(result);
      };
    }
  });
})();
