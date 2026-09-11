"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.APP_VERSION = "test-sha";
process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.AUTH_DB_PATH = ":memory:";
const { server, rooms, auth } = require("../server.js");
auth.verifyGoogleToken=async()=>{throw new Error("invalid token");};
let sessionCookie="";

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

test("guest server startup and gameplay assets remain functional", async () => {
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await fetch(base+"/healthz");
  assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true,rooms:0,online:0,version:"test-sha"});
  const index=await fetch(base+"/");
  assert.equal(index.status,200);
  const html=await index.text();
  assert.match(html,/src="js\/game\.js\?v=test-sha"/);
  assert.match(html,/content="test-client\.apps\.googleusercontent\.com"/);
  assert.match(index.headers.get("content-security-policy"),/https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(index.headers.get("cache-control"),/no-store/);
  assert.equal((await fetch(base+"/js/game.js")).status,200);
  assert.equal((await fetch(base+"/js/leaderboard.js")).status,200);
  assert.equal((await fetch(base+"/js/presence.js")).status,200);
  assert.equal((await fetch(base+"/server.js")).status,403);
});

test("unauthenticated /api/me returns no user",async()=>{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/me`);
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{user:null});
  assert.match(response.headers.get("cache-control"),/no-store/);
});

test("invalid Google credentials are rejected",async()=>{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/google`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({credential:"malformed"})});
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:"invalid_google_token"});
  assert.equal(auth.db.prepare("SELECT count(*) AS total FROM users").get().total,0);
});

test("verified Google identity creates a user and secure server session",async()=>{
  auth.verifyGoogleToken=async token=>{
    assert.equal(token,"verified-id-token");
    return {sub:"google-user-123",name:"Nova Pilot",email:"Nova@Example.com",email_verified:true,picture:"https://lh3.googleusercontent.com/avatar.jpg"};
  };
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/google`,{method:"POST",headers:{"content-type":"application/json","x-forwarded-proto":"https"},body:JSON.stringify({credential:"verified-id-token"})});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{user:{id:1,displayName:"Nova Pilot",email:"nova@example.com",avatarUrl:"https://lh3.googleusercontent.com/avatar.jpg",bestScore:0}});
  const setCookie=response.headers.get("set-cookie");
  assert.match(setCookie,/^starfall_session=[A-Za-z0-9_-]{43};/);assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);assert.match(setCookie,/Secure/);
  sessionCookie=setCookie.split(";",1)[0];
  const token=sessionCookie.split("=",2)[1],stored=auth.db.prepare("SELECT id_hash FROM sessions").get();
  assert.notEqual(stored.id_hash,token,"only a hash of the session token is stored");
  const me=await fetch(`http://127.0.0.1:${server.address().port}/api/me`,{headers:{cookie:sessionCookie}});
  assert.equal(me.status,200);assert.equal((await me.json()).user.displayName,"Nova Pilot");
});

test("signed-in solo scores persist and leaderboard keeps each pilot's best",async()=>{
  const base=`http://127.0.0.1:${server.address().port}`;
  const first=await fetch(base+"/api/scores",{method:"POST",headers:{cookie:sessionCookie,"content-type":"application/json"},body:JSON.stringify({score:1250,kills:12,durationSeconds:91,environment:"neo-shibuya",mode:"solo"})});
  assert.equal(first.status,201);assert.deepEqual(await first.json(),{saved:true,bestScore:1250,personalBest:true});
  const lower=await fetch(base+"/api/scores",{method:"POST",headers:{cookie:sessionCookie,"content-type":"application/json"},body:JSON.stringify({score:900,kills:8,durationSeconds:70,environment:"shogun-valley",mode:"solo"})});
  assert.equal(lower.status,201);assert.deepEqual(await lower.json(),{saved:true,bestScore:1250,personalBest:false});
  const board=await fetch(base+"/api/leaderboard");
  assert.equal(board.status,200);
  const boardBody=await board.json();
  assert.equal(boardBody.entries.length,1);assert.equal(boardBody.entries[0].displayName,"Nova Pilot");assert.equal(boardBody.entries[0].score,1250);
  const me=await fetch(base+"/api/me",{headers:{cookie:sessionCookie}});
  assert.equal((await me.json()).user.bestScore,1250);
  const coop=await fetch(base+"/api/scores",{method:"POST",headers:{cookie:sessionCookie,"content-type":"application/json"},body:JSON.stringify({score:9999,kills:1,durationSeconds:10,environment:"neo-shibuya",mode:"coop"})});
  assert.equal(coop.status,400);
});

test("logout invalidates the session and clears its cookie",async()=>{
  const logout=await fetch(`http://127.0.0.1:${server.address().port}/api/logout`,{method:"POST",headers:{cookie:sessionCookie}});
  assert.equal(logout.status,204);assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
  const me=await fetch(`http://127.0.0.1:${server.address().port}/api/me`,{headers:{cookie:sessionCookie}});
  assert.equal(me.status,401);assert.equal(auth.db.prepare("SELECT count(*) AS total FROM sessions").get().total,0);
});

test("pairs exactly two pilots and relays only allowed messages", async () => {
  const url=`ws://127.0.0.1:${server.address().port}/ws`;
  const host=await open(url),guest=await open(url),third=await open(url);
  const createdPromise=message(host);host.send(JSON.stringify({type:"create",ship:2,environment:"shogun-valley"}));
  const created=await createdPromise;assert.match(created.room,/^[A-Z]{5}$/);
  assert.equal(rooms.get(created.room).environment,"shogun-valley");

  const hostReady=message(host),guestReady=message(guest);
  guest.send(JSON.stringify({type:"join",room:created.room,ship:2}));
  assert.deepEqual(await hostReady,{type:"ready",role:"host",room:created.room,ships:[2,3],environment:"shogun-valley"});
  assert.deepEqual(await guestReady,{type:"ready",role:"guest",room:created.room,ships:[2,3],environment:"shogun-valley",shipAdjusted:true});

  const full=message(third);third.send(JSON.stringify({type:"join",room:created.room}));
  assert.equal((await full).type,"error");

  const input=message(host);guest.send(JSON.stringify({type:"input",x:2,y:-1,seq:9}));
  assert.deepEqual(await input,{type:"input",x:1,y:0,seq:9});

  const pulse=message(host);guest.send(JSON.stringify({type:"pulse"}));
  assert.deepEqual(await pulse,{type:"pulse"});

  const state=message(guest);host.send(JSON.stringify({type:"state",state:{score:42,players:[]}}));
  assert.deepEqual(await state,{type:"state",state:{score:42,players:[]}});

  const left=message(host);guest.close();assert.deepEqual(await left,{type:"peer_left"});
  const fallbackPromise=message(host);host.send(JSON.stringify({type:"create",environment:"not-a-world"}));
  const fallback=await fallbackPromise;assert.equal(rooms.get(fallback.room).environment,"neo-shibuya");
  host.close();third.close();
});
