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
global.Starfall={clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),CONFIG:{PLAYER:{followSpeed:7.2}},THEME:{amber:"#fc6",cyan:"#5ef"}};
for(const name of ["Player","Projectile","Enemy","PowerUp","Boss","CompanionDrone"])Starfall[name]=class{};
Starfall.RoninSpearPickup=class RoninSpearPickup extends Starfall.PowerUp{};
Starfall.RoninSpearProjectile=class RoninSpearProjectile extends Starfall.Projectile{};
Starfall.NetworkEnemyTypes={"blade-skimmer":class BladeSkimmer extends Starfall.Enemy{}};
require("../js/online.js");

function game(width,height) {
  const player={x:width*.4,y:height*.75,targetX:width*.4,targetY:height*.75,radius:17,health:100,shield:90,fireTimer:0,damageCooldown:0,sinceDamage:5,rapidFire:0,tripleLaser:0,invincible:0,droneTime:0,tilt:0,dead:false,variant:0};
  return {
    width,height,players:[player,{...player,x:width*.6,targetX:width*.6,variant:1}],player,
    playerProjectiles:[{x:width*.5,y:height*.4,vx:0,vy:-720,friendly:true,damage:14,radius:5,color:"#fff",life:2,fromBoss:false,dead:false}],
    enemyProjectiles:[],enemies:[],powerups:[],boss:null,
    companions:[{x:width*.45,y:height*.7,side:1,playerIndex:0,fireTimer:0}],
    roninSpearProjectiles:[],roninSpears:0,maxRoninSpears:2,stage:0,shipRank:0,victoryDanceTime:0,
    elapsed:12,score:42,kills:2,killChain:2,comboTimer:3,combo:1,bestCombo:1,pulseEnergy:60,nextBossTime:150,shake:0,
    state:"playing",onlineRole:"guest",localPlayerIndex:1,environment:{id:"shogun-valley"},
    effects:{events:[],update(){},wave(...args){this.events.push(["wave",...args]);},burst(...args){this.events.push(["burst",...args]);},text(...args){this.events.push(["text",...args]);}},
    audio:{events:[],play(name){this.events.push(name);},tone(){}},
    updateHUD(){this.hudUpdated=true;},endGame(){this.ended=true;},showScreen(){},showToast(message){this.toast=message;},
    setEnvironment(id){this.environment.id=id;this.environmentApplied=id;},
    applyNetworkStage(stage,rank){this.stage=stage;this.shipRank=rank;this.stageApplied=true;},
    updateRoninSpearBadge(){this.roninBadgeUpdated=true;},
  };
}

test("snapshot uses normalized positions and hydrates at another viewport size",()=>{
  const host=new Starfall.CoopClient(game(1000,800));
  const snapshot=host.snapshot();
  assert.equal(snapshot.environment,"shogun-valley");
  assert.equal(snapshot.players[0].x,.4);assert.equal(snapshot.playerProjectiles[0].y,.4);
  const guestGame=game(500,400),guest=new Starfall.CoopClient(guestGame);
  guest.applySnapshot(snapshot);
  assert.equal(guestGame.environment.id,"shogun-valley");
  assert.equal(guestGame.environmentApplied,undefined,"an unchanged environment is not needlessly reapplied");
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

test("new guest-owned shots spawn beside the locally predicted guest ship",()=>{
  const hostGame=game(1000,800),host=new Starfall.CoopClient(hostGame);
  hostGame.playerProjectiles=[{x:600,y:560,vx:0,vy:-720,friendly:true,damage:14,radius:5,color:"#fff",life:2,fromBoss:false,dead:false}];
  const snapshot=host.snapshot();
  const guestGame=game(500,400),guest=new Starfall.CoopClient(guestGame);
  Object.setPrototypeOf(guestGame.players[1],Starfall.Player.prototype);
  guest.role="guest";guest.controlLatency=100;
  guestGame.players[1].x=420;
  guest.applySnapshot(snapshot);
  const shot=guestGame.playerProjectiles[0];
  assert.equal(shot._localGuestShot,true,"the fresh projectile is classified as the guest's shot");
  assert.ok(Math.abs(shot.x-420)<8,"the shot is horizontally aligned to the locally predicted guest ship");
  assert.ok(shot.y<280,"latency compensation advances the guest shot along its travel direction");
});

test("phase-one state hydrates stage, tactical boss, custom entities, and Ronin state",()=>{
  const hostGame=game(1000,800),host=new Starfall.CoopClient(hostGame);
  hostGame.stage=4;hostGame.shipRank=4;hostGame.victoryDanceTime=1.2;hostGame.roninSpears=2;
  hostGame.enemies=[{networkKind:"blade-skimmer",archetype:"BLADE SKIMMER",type:"scout",x:240,y:180,baseX:240,radius:18,maxHealth:25,health:20,speed:120,score:100,contactDamage:14,color:"#fff",age:2,phase:.4,shootTimer:1,entrySide:0,turn:-1,dead:false}];
  hostGame.powerups=[{networkKind:"ronin-spear-pickup",type:"ronin-spear",x:400,y:240,radius:21,speed:58,age:.5,dead:false}];
  hostGame.boss={networkKind:"tactical-boss",x:500,y:128,radius:67,maxHealth:2500,health:1800,age:5,attackTimer:999,pattern:4,entering:false,weakPhase:false,dead:false,score:5000,contactDamage:30,profileIndex:4,profile:{name:"CRIMSON DAIMYO",accent:"coral"},combatIndex:4,rule:{key:"nodes"},attackClock:.4,specialClock:2,vulnerableClock:0,activeSide:-1,nodeHP:[0,92],nodeBroken:[true,false],eyeAngle:1.1,teleportClock:3,phaseStep:6,specialHitFlash:.6,specialHitKick:8,weakHitFlash:.1,weakHitCount:3};
  hostGame.roninSpearProjectiles=[{networkKind:"ronin-spear-projectile",x:430,y:420,radius:10,speed:520,dead:false,life:2.4,angle:-1.2}];

  const snapshot=host.snapshot(),guestGame=game(500,400),guest=new Starfall.CoopClient(guestGame);
  assert.equal(guest.applySnapshot(snapshot),true);
  assert.equal(guestGame.stage,4);assert.equal(guestGame.shipRank,4);assert.equal(guestGame.stageApplied,true);
  assert.equal(guestGame.victoryDanceTime,1.2);assert.equal(guestGame.roninSpears,2);assert.equal(guestGame.roninBadgeUpdated,true);
  assert.ok(guestGame.enemies[0] instanceof Starfall.NetworkEnemyTypes["blade-skimmer"]);
  assert.ok(guestGame.powerups[0] instanceof Starfall.RoninSpearPickup);
  assert.ok(guestGame.roninSpearProjectiles[0] instanceof Starfall.RoninSpearProjectile);
  assert.ok(guestGame.boss instanceof Starfall.Boss);
  assert.deepEqual(guestGame.boss.nodeBroken,[true,false]);assert.equal(guestGame.boss.profile.name,"CRIMSON DAIMYO");
});

test("host routes a guest Ronin command to the wingmate",()=>{
  const hostGame=game(500,400),client=new Starfall.CoopClient(hostGame);
  client.role="host";hostGame.activateRoninSpear=index=>{hostGame.roninSource=index;return true;};
  client.onMessage({data:JSON.stringify({type:"ronin_spear"})});
  assert.equal(hostGame.roninSource,1);
});

test("guest replays Ronin impact and stage-clear presentation effects",()=>{
  const guestGame=game(500,400),client=new Starfall.CoopClient(guestGame);client.role="guest";
  client.playFx("ronin_impact",{x:.5,y:.25});
  assert.equal(guestGame.toast,"DIRECT SPEAR IMPACT");
  assert.ok(guestGame.effects.events.some(event=>event[0]==="wave"&&event[1]===250&&event[2]===100));
  client.playFx("stage_clear",{line:"TARGET ERASED"});
  assert.equal(guestGame.toast,"VICTORY!\nTARGET ERASED");
});
