"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
const { server, rooms } = require("../server.js");

function message(socket) {
  return new Promise((resolve, reject) => {
    const timer=setTimeout(()=>reject(new Error("WebSocket message timeout")),2000);
    socket.addEventListener("message",event=>{clearTimeout(timer);resolve(JSON.parse(event.data));},{once:true});
  });
}

function open(url) {
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url);
    socket.addEventListener("open",()=>resolve(socket),{once:true});
    socket.addEventListener("error",reject,{once:true});
  });
}

test.before(async () => {
  if (!server.listening) await new Promise(resolve=>server.once("listening",resolve));
});

test.after(async () => {
  for (const room of rooms.values()) { room.host?.socket.destroy(); room.guest?.socket.destroy(); }
  await new Promise(resolve=>server.close(resolve));
});

test("serves the game and health endpoint but not server source", async () => {
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await fetch(base+"/healthz");
  assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
  assert.equal((await fetch(base+"/")).status,200);
  assert.equal((await fetch(base+"/js/game.js")).status,200);
  assert.equal((await fetch(base+"/server.js")).status,403);
});

test("pairs exactly two pilots and relays only allowed messages", async () => {
  const url=`ws://127.0.0.1:${server.address().port}/ws`;
  const host=await open(url),guest=await open(url),third=await open(url);
  const createdPromise=message(host);host.send(JSON.stringify({type:"create",ship:2}));
  const created=await createdPromise;assert.match(created.room,/^[A-Z]{5}$/);

  const hostReady=message(host),guestReady=message(guest);
  guest.send(JSON.stringify({type:"join",room:created.room,ship:2}));
  assert.deepEqual(await hostReady,{type:"ready",role:"host",room:created.room,ships:[2,3]});
  assert.deepEqual(await guestReady,{type:"ready",role:"guest",room:created.room,ships:[2,3],shipAdjusted:true});

  const full=message(third);third.send(JSON.stringify({type:"join",room:created.room}));
  assert.equal((await full).type,"error");

  const input=message(host);guest.send(JSON.stringify({type:"input",x:2,y:-1,seq:9}));
  assert.deepEqual(await input,{type:"input",x:1,y:0,seq:9});

  const pulse=message(host);guest.send(JSON.stringify({type:"pulse"}));
  assert.deepEqual(await pulse,{type:"pulse"});

  const state=message(guest);host.send(JSON.stringify({type:"state",state:{score:42,players:[]}}));
  assert.deepEqual(await state,{type:"state",state:{score:42,players:[]}});

  const left=message(host);guest.close();assert.deepEqual(await left,{type:"peer_left"});
  host.close();third.close();
});
