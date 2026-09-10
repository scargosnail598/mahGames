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

function loadGame() {
  const ctx=context(),elements=new Map(),ready=[];
  function element(id) {
    if(!elements.has(id))elements.set(id,{
      style:{},innerHTML:"",textContent:"",offsetWidth:0,
      classList:{add(){},remove(){},toggle(){}},addEventListener(){},
      getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800}),
    });
    return elements.get(id);
  }
  const document={
    hidden:false,getElementById:element,querySelector:element,querySelectorAll:()=>[],addEventListener(){},
    createElement:()=>({width:1,height:1,getContext:()=>ctx}),
  };
  const sandbox={console,Math,document,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},setInterval:()=>1,requestAnimationFrame(){},
    localStorage:{getItem:()=>null,setItem(){}},
    window:{matchMedia:()=>({matches:false}),addEventListener:(name,callback)=>{if(name==="DOMContentLoaded")ready.push(callback);},devicePixelRatio:1,innerWidth:1000,innerHeight:800},
  };
  Object.assign(sandbox,sandbox.window);sandbox.window=sandbox;vm.createContext(sandbox);
  for(const file of ["config.js","theme.js","audio.js","effects.js","entities.js","game.js"])
    vm.runInContext(fs.readFileSync(path.join(__dirname,"../js",file),"utf8"),sandbox);
  ready.forEach(callback=>callback());
  return sandbox;
}

test("co-op host updates both pilots and ends only when both are down",()=>{
  const sandbox=loadGame(),game=sandbox.starfallGame;
  game.startCoop("host","ABCDE",[2,3]);
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
