"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");

function element() {
  return {
    value:"", textContent:"", nextElementSibling:{textContent:""},
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},
    setAttribute(){},
  };
}

const elements=new Map();
global.window=global;
global.location={protocol:"http:",host:"localhost"};
Object.defineProperty(global,"navigator",{value:{clipboard:{writeText:async()=>{}}},configurable:true});
global.document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector(){return null;},querySelectorAll(){return[];}};
global.addEventListener=()=>{};
global.requestAnimationFrame=()=>{};
global.Starfall={clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),CONFIG:{PLAYER:{followSpeed:7.2}}};
for(const name of ["Player","Projectile","Enemy","PowerUp","Boss","CompanionDrone"])Starfall[name]=class{};
require("../js/online.js");

function game(width,height) {
  const player={x:width*.4,y:height*.75,targetX:width*.4,targetY:height*.75,radius:17,health:100,shield:90,fireTimer:0,damageCooldown:0,sinceDamage:5,rapidFire:0,tripleLaser:0,invincible:0,droneTime:0,tilt:0,dead:false,variant:0};
  return {
    width,height,players:[player,{...player,x:width*.6,targetX:width*.6,variant:1}],player,
    playerProjectiles:[{x:width*.5,y:height*.4,vx:0,vy:-720,friendly:true,damage:14,radius:5,color:"#fff",life:2,fromBoss:false,dead:false}],
    enemyProjectiles:[],enemies:[],powerups:[],boss:null,
    companions:[{x:width*.45,y:height*.7,side:1,playerIndex:0,fireTimer:0}],
    elapsed:12,score:42,kills:2,killChain:2,comboTimer:3,combo:1,bestCombo:1,pulseEnergy:60,nextBossTime:150,
    state:"playing",onlineRole:"guest",localPlayerIndex:1,effects:{update(){}},updateHUD(){this.hudUpdated=true;},endGame(){this.ended=true;},showScreen(){},
  };
}

test("snapshot uses normalized positions and hydrates at another viewport size",()=>{
  const host=new Starfall.CoopClient(game(1000,800));
  const snapshot=host.snapshot();
  assert.equal(snapshot.players[0].x,.4);assert.equal(snapshot.playerProjectiles[0].y,.4);
  const guestGame=game(500,400),guest=new Starfall.CoopClient(guestGame);
  guest.applySnapshot(snapshot);
  assert.equal(guestGame.players[0].x,200);
  assert.equal(guestGame.players[1].x,300);
  assert.equal(guestGame.playerProjectiles[0].y,160);
  assert.equal(Object.getPrototypeOf(guestGame.players[0]),Starfall.Player.prototype);
  assert.equal(guestGame.hudUpdated,true);
});

test("snapshot hydration ignores unexpected object fields",()=>{
  const target=game(500,400),guest=new Starfall.CoopClient(target),snapshot=new Starfall.CoopClient(game(1000,800)).snapshot();
  snapshot.players[0].unexpected="ignored";
  guest.applySnapshot(snapshot);
  assert.equal(target.players[0].unexpected,undefined);
});

test("guest rejects stale snapshots and smooths remote entities between updates",()=>{
  const hostGame=game(1000,800),host=new Starfall.CoopClient(hostGame);
  const guestGame=game(500,400),guest=new Starfall.CoopClient(guestGame);
  guest.role="guest";
  const first=host.snapshot();assert.equal(guest.applySnapshot(first),true);
  const before=guestGame.players[0].x;
  hostGame.players[0].x+=100;
  const second=host.snapshot();assert.equal(guest.applySnapshot(second),true);
  assert.equal(guestGame.players[0].x,before,"snapshot target does not teleport an existing remote ship");
  guest.updatePresentation(.016);
  assert.ok(guestGame.players[0].x>before&&guestGame.players[0].x<250,"remote ship advances smoothly toward the new state");
  assert.equal(guest.applySnapshot(first),false,"out-of-order state is ignored");
});

test("guest predicts its local movement before the host snapshot returns",()=>{
  const guestGame=game(500,400),guest=new Starfall.CoopClient(guestGame);
  guest.role="guest";
  const local=guestGame.players[1],before=local.x;
  guest.sendInput(.9,.6);
  guest.updatePresentation(.016);
  assert.ok(local.x>before,"local ship reacts immediately to pointer input");
});
