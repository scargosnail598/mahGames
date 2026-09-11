(function () {
  "use strict";

  const authScript=document.currentScript;
  const assetVersion=authScript&&authScript.src.includes("?")?authScript.src.slice(authScript.src.indexOf("?")):"";

  function loadLeaderboardModule() {
    if(document.querySelector('script[data-starfall-leaderboard]'))return;
    const script=document.createElement("script");
    script.src=`js/leaderboard.js${assetVersion}`;
    script.defer=true;
    script.dataset.starfallLeaderboard="true";
    document.head.appendChild(script);
  }

  loadLeaderboardModule();

  window.addEventListener("DOMContentLoaded",()=>{
    const clientId=document.querySelector('meta[name="google-client-id"]')?.content||"";
    const control=document.getElementById("auth-control");
    if(!clientId||!control)return;

    const signIn=document.getElementById("auth-sign-in");
    const identity=document.getElementById("auth-identity");
    const signInPanel=document.getElementById("auth-signin-panel");
    const profilePanel=document.getElementById("auth-profile-panel");
    const signOut=document.getElementById("auth-sign-out");
    const status=document.getElementById("auth-status");
    const googleSlot=document.getElementById("google-signin-slot");
    let user=null,googlePromise=null,googleInitialized=false,buttonRendered=false;

    function initials(name) {
      return String(name||"P").trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();
    }

    function avatar(container,url,name) {
      const image=container.querySelector(".auth-avatar"),fallback=container.querySelector(".auth-avatar-fallback");
      if(url){image.onerror=()=>{image.classList.add("hidden");fallback.textContent=initials(name);fallback.classList.remove("hidden");};image.src=url;image.alt=`${name} avatar`;image.classList.remove("hidden");fallback.classList.add("hidden");}
      else{image.removeAttribute("src");image.alt="";image.classList.add("hidden");fallback.textContent=initials(name);fallback.classList.remove("hidden");}
    }

    function closePanels() {
      signInPanel.classList.add("hidden");profilePanel.classList.add("hidden");
      signIn.setAttribute("aria-expanded","false");identity.setAttribute("aria-expanded","false");
    }

    function showLoggedOut() {
      user=null;window.starfallUser=null;control.classList.remove("hidden");signIn.classList.remove("hidden");identity.classList.add("hidden");closePanels();
    }

    function showUser(nextUser) {
      user=nextUser;window.starfallUser=user;control.classList.remove("hidden");signIn.classList.add("hidden");identity.classList.remove("hidden");
      identity.querySelector("strong").textContent=user.displayName;avatar(identity,user.avatarUrl,user.displayName);
      const heading=profilePanel.querySelector(".auth-profile-heading");
      heading.querySelector("strong").textContent=user.displayName;heading.querySelector("small").textContent=user.email;avatar(heading,user.avatarUrl,user.displayName);
      let best=profilePanel.querySelector(".auth-best-score");
      if(!best){best=document.createElement("p");best.className="auth-best-score";profilePanel.insertBefore(best,signOut);}
      best.textContent=`BEST SCORE  ${(Number(user.bestScore)||0).toLocaleString()}`;
      closePanels();
    }

    async function exchangeCredential(response) {
      status.textContent="VERIFYING…";status.classList.remove("error");
      try{
        const result=await fetch("/api/auth/google",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({credential:response.credential})});
        const body=await result.json();
        if(!result.ok||!body.user)throw new Error("Sign-in could not be verified");
        showUser(body.user);
      }catch(_){status.textContent="SIGN-IN UNAVAILABLE — KEEP PLAYING AS GUEST";status.classList.add("error");}
    }

    function loadGoogle() {
      if(window.google?.accounts?.id)return Promise.resolve();
      if(googlePromise)return googlePromise;
      googlePromise=new Promise((resolve,reject)=>{
        const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;
        script.onload=()=>window.google?.accounts?.id?resolve():reject(new Error("Google unavailable"));script.onerror=reject;
        document.head.appendChild(script);
      });
      return googlePromise;
    }

    async function openSignIn() {
      const opening=signInPanel.classList.contains("hidden");closePanels();
      if(!opening)return;
      signInPanel.classList.remove("hidden");signIn.setAttribute("aria-expanded","true");status.textContent="LOADING GOOGLE SIGN-IN…";status.classList.remove("error");
      try{
        await loadGoogle();
        if(!googleInitialized){google.accounts.id.initialize({client_id:clientId,callback:exchangeCredential,auto_select:false,cancel_on_tap_outside:true});googleInitialized=true;}
        if(!buttonRendered){google.accounts.id.renderButton(googleSlot,{type:"standard",theme:"outline",size:"medium",text:"signin_with",shape:"rectangular",width:210});buttonRendered=true;}
        status.textContent="";
      }catch(_){status.textContent="GOOGLE SIGN-IN IS TEMPORARILY UNAVAILABLE";status.classList.add("error");}
    }

    signIn.addEventListener("click",openSignIn);
    identity.addEventListener("click",()=>{
      const opening=profilePanel.classList.contains("hidden");closePanels();
      if(opening){profilePanel.classList.remove("hidden");identity.setAttribute("aria-expanded","true");}
    });
    signOut.addEventListener("click",async()=>{
      signOut.disabled=true;signOut.textContent="SIGNING OUT…";
      try{
        const response=await fetch("/api/logout",{method:"POST",credentials:"same-origin"});
        if(!response.ok)throw new Error("Logout failed");
        window.google?.accounts?.id?.disableAutoSelect();signOut.textContent="SIGN OUT";showLoggedOut();
      }catch(_){signOut.textContent="SIGN OUT FAILED";setTimeout(()=>{signOut.textContent="SIGN OUT";},1400);}
      finally{signOut.disabled=false;}
    });
    document.addEventListener("pointerdown",event=>{if(!control.contains(event.target))closePanels();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape")closePanels();});

    fetch("/api/me",{credentials:"same-origin",cache:"no-store"}).then(async response=>response.ok?showUser((await response.json()).user):showLoggedOut()).catch(showLoggedOut);
  });
})();
