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

function load(saved) {
  const values=new Map();if(saved)values.set("starfall-environment",saved);
  const ctx=context();
  const sandbox={console,Math,
    document:{createElement:()=>({width:1,height:1,getContext:()=>ctx})},
    localStorage:{getItem:(key)=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
    Starfall:{
      THEME:{reducedMotion:{matches:false},poly(c,points,fill){c.beginPath();points.forEach(([x,y],index)=>index?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();}},
      OrbitalPort:class { constructor(width){this.edge=width*.19;this.layers=[];}resize(width){this.edge=width*.19;} },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../js/environments.js"),"utf8"),sandbox);
  return {sandbox,values,ctx};
}

test("registers all stable environment ids and renderer contracts",()=>{
  const {sandbox}=load();
  assert.deepEqual(Array.from(sandbox.Starfall.ENVIRONMENTS,item=>item.id),["neo-shibuya","neon-rift","outer-rim","shogun-valley"]);
  const manager=new sandbox.Starfall.EnvironmentManager(800,600,{persist:false});
  for(const item of sandbox.Starfall.ENVIRONMENTS){
    manager.setEnvironment(item.id);
    assert.equal(manager.id,item.id);
    for(const method of ["resize","update","draw","destroy"])assert.equal(typeof manager.active[method],"function");
  }
});

test("invalid ids safely fall back to Neo Shibuya",()=>{
  const {sandbox}=load("unknown-world");
  const manager=new sandbox.Starfall.EnvironmentManager(640,480);
  assert.equal(manager.id,"neo-shibuya");
  assert.equal(manager.setEnvironment("also-invalid"),"neo-shibuya");
});

test("environment selection persists and is restored locally",()=>{
  const {sandbox,values}=load();
  const manager=new sandbox.Starfall.EnvironmentManager(640,480);
  manager.setEnvironment("shogun-valley");
  assert.equal(values.get("starfall-environment"),"shogun-valley");
  const restored=new sandbox.Starfall.EnvironmentManager(640,480);
  assert.equal(restored.id,"shogun-valley");
});
