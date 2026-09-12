"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

function context() {
  const base={createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
  return new Proxy(base,{get(object,key){return key in object?object[key]:()=>{};},set(object,key,value){object[key]=value;return true;}});
}

function loadGame(extended) {
  const ctx=context(),elements=new Map(),ready=[];let rafCalls=0;
  function element(id) {
    if(!elements.has(id))elements.set(id,{
      style:{setProperty(){}},innerHTML:"",textContent:"",offsetWidth:0,
      classList:{add(){},remove(){},toggle(){}},addEventListener(){},
      setAttribute(){},appendChild(){},replaceWith(){},cloneNode(){return element(`${id}:clone`);},
      querySelector(selector){return element(`${id}:${selector}`);},getClientRects(){return[];},
      getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800}),
    });
    return elements.get(id);
  }
  let created=0;
  const document={
    hidden:false,getElementById:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){},
    documentElement:element("document-element"),createElement:()=>element(`created-${++created}`),
  };
  const quietConsole=Object.create(console);quietConsole.error=()=>{};
  const sandbox={console:quietConsole,Math,document,URLSearchParams,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>1,requestAnimationFrame(){rafCalls+=1;},
    localStorage:{getItem:()=>null,setItem(){}},
    window:{matchMedia:()=>({matches:false}),addEventListener:(name,callback)=>{if(name==="DOMContentLoaded")ready.push(callback);},devicePixelRatio:1,innerWidth:1000,innerHeight:800,location:{search:""}},
  };
  Object.assign(sandbox,sandbox.window);sandbox.window=sandbox;vm.createContext(sandbox);
  const files=["config.js","theme.js","environments.js","audio.js","effects.js","entities.js","game.js"];
  if(extended)files.push("stage-progression.js","stage-content.js","combat-diversity.js","special-weapon.js","boss-feedback.js");
  for(const file of files)
    vm.runInContext(fs.readFileSync(path.join(__dirname,"../js",file),"utf8"),sandbox);
  ready.forEach(callback=>callback());
  sandbox.rafCalls=()=>rafCalls;
  return sandbox;
}

test("solo uses the selected fighter on start and restart",()=>{
  const sandbox=loadGame(),game=sandbox.starfallGame;
  sandbox.coopClient={selectedShip:3,leave(){}};
  game.start();assert.equal(game.player.variant,3);
  game.start();assert.equal(game.player.variant,3);
  assert.equal(game.players.length,1);
});

test("co-op host updates both pilots and ends only when both are down",()=>{
  const sandbox=loadGame(),game=sandbox.starfallGame;
  game.startCoop("host","ABCDE",[2,3],false,"outer-rim");
  assert.equal(game.environment.id,"outer-rim");
  assert.equal(game.players.length,2);assert.equal(game.companions.length,2);
  assert.equal(game.players[0].variant,2);assert.equal(game.players[1].variant,3);assert.equal(game.localPlayerIndex,0);
  game.spawnTimer=999;
  const oldX=game.players[1].x;game.players[1].targetX=oldX+100;
  game.update(.03);assert.ok(game.players[1].x>oldX,"wingmate moves in host simulation");
  assert.ok(game.playerProjectiles.length>=4,"both ships auto-fire");
  game.players[0].dead=true;game.update(.01);assert.equal(game.state,"playing");
  game.players[1].dead=true;game.update(.01);assert.equal(game.state,"gameover");
});

test("enemy hits and pickups are handled independently for the wingmate",()=>{
  const sandbox=loadGame(),game=sandbox.starfallGame;
  game.startCoop("host","ABCDE");
  const wingmate=game.players[1],before=wingmate.shield;
  game.enemyProjectiles.push(new sandbox.Starfall.Projectile(wingmate.x,wingmate.y,0,0,false,{damage:12}));
  game.handleCollisions();assert.ok(wingmate.shield<before);
  const drone=new sandbox.Starfall.PowerUp(wingmate.x,wingmate.y,"drone");game.powerups.push(drone);
  game.handleCollisions();assert.ok(wingmate.droneTime>0);assert.equal(drone.dead,true);
});

test("a presentation error is contained and the next animation frame stays scheduled",()=>{
  const sandbox=loadGame(),game=sandbox.starfallGame,before=sandbox.rafCalls();
  game.draw=()=>{throw new Error("synthetic draw failure");};
  assert.doesNotThrow(()=>game.loop(16));
  assert.equal(sandbox.rafCalls(),before+1);
  assert.equal(game.lastFrameError.message,"synthetic draw failure");
});

test("an unknown network power-up uses a safe fallback renderer",()=>{
  const sandbox=loadGame(),game=sandbox.starfallGame;
  const pickup=new sandbox.Starfall.PowerUp(120,180,"future-network-pickup");
  assert.doesNotThrow(()=>pickup.draw(game.ctx));
});

test("post-boss presentation draws tactical bosses and Ronin objects without freezing",()=>{
  const sandbox=loadGame(true),game=sandbox.starfallGame;
  game.state="playing";game.onlineRole="guest";game.applyNetworkStage(2,2);
  const boss=Object.assign(Object.create(sandbox.Starfall.Boss.prototype),{
    x:500,y:128,radius:67,maxHealth:2500,health:1800,age:5,attackTimer:999,pattern:4,
    entering:false,weakPhase:false,dead:false,score:5000,contactDamage:30,profileIndex:2,
    combatIndex:4,vulnerableClock:0,activeSide:-1,nodeBroken:[true,false],eyeAngle:1,phaseStep:5,
  });
  game.boss=boss;
  game.powerups=[Object.assign(Object.create(sandbox.Starfall.RoninSpearPickup.prototype),{x:330,y:260,type:"ronin-spear",radius:21,speed:58,age:.7,dead:false})];
  game.roninSpearProjectiles=[Object.assign(Object.create(sandbox.Starfall.RoninSpearProjectile.prototype),{x:420,y:370,radius:10,speed:520,dead:false,life:2,angle:-1.2})];
  assert.doesNotThrow(()=>game.draw(),"sector-three tactical content renders");

  game.boss=null;game.powerups=[];game.roninSpearProjectiles=[];game.applyNetworkStage(3,3);
  assert.doesNotThrow(()=>game.draw(),"the post-boss transition renders");
  game.applyNetworkStage(4,4);game.boss=boss;boss.profileIndex=4;boss.combatIndex=5;boss.nodeBroken=undefined;
  assert.doesNotThrow(()=>game.draw(),"a later boss remains safe with legacy/missing optional state");
});
