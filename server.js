"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { AuthService } = require("./lib/auth.js");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const APP_VERSION = process.env.APP_VERSION || "dev";
const ROOT = __dirname;
const MAX_MESSAGE = 128 * 1024;
const rooms = new Map();
const presencePeers = new Set();
const presenceByUser = new Map();
const invites = new Map();
const auth = new AuthService({databasePath:process.env.AUTH_DB_PATH||path.join(ROOT,"data","starfall.sqlite")});

const MIME = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon",
};

function escapeAttribute(value) { return String(value).replace(/[&"<>]/g,character=>({"&":"&amp;","\"":"&quot;","<":"&lt;",">":"&gt;"})[character]); }

async function staticHandler(request, response) {
  let url;
  try { url=new URL(request.url,"http://localhost"); }
  catch (_) { response.writeHead(400); response.end("Bad request"); return; }
  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type":"application/json", "cache-control":"no-store" });
    response.end(JSON.stringify({ ok:true, rooms:rooms.size, online:presenceByUser.size, version:APP_VERSION }));
    return;
  }
  if(await auth.handle(request,response,url.pathname))return;
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow:"GET, HEAD" }); response.end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch (_) { response.writeHead(400); response.end("Bad request"); return; }
  if (pathname === "/") pathname = "/index.html";
  const relative = path.posix.normalize(pathname).replace(/^\/+/, "");
  const filename = path.join(ROOT, relative);
  const publicFile = relative === "index.html" || relative.startsWith("css/") || relative.startsWith("js/");
  if (!publicFile || !filename.startsWith(ROOT + path.sep) || relative.startsWith(".") || relative.includes("/.")) {
    response.writeHead(403); response.end("Forbidden"); return;
  }
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404); response.end("Not found"); return; }
    const isHtml=path.extname(filename) === ".html";
    const headers={
      "content-type":MIME[path.extname(filename)] || "application/octet-stream",
      "cache-control":isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=3600",
      "x-content-type-options":"nosniff",
      "referrer-policy":"strict-origin-when-cross-origin",
      "cross-origin-opener-policy":"same-origin-allow-popups",
      "content-security-policy":"default-src 'self'; connect-src 'self' ws: wss: https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; img-src 'self' data: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; script-src 'self' https://accounts.google.com/gsi/client",
    };
    if (!isHtml) {
      response.writeHead(200,headers);
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(filename).pipe(response);
      return;
    }
    fs.readFile(filename,"utf8",(readError,source)=>{
      if(readError){response.writeHead(500);response.end("Server error");return;}
      const version=encodeURIComponent(APP_VERSION);
      const configured=source.replace("__GOOGLE_CLIENT_ID__",escapeAttribute(auth.clientId));
      const body=Buffer.from(configured.replace(/((?:src|href)="(?:css|js)\/[^"?]+)(?:\?[^\"]*)?"/g,`$1?v=${version}"`));
      response.writeHead(200,{...headers,"content-length":body.length});
      response.end(request.method === "HEAD" ? undefined : body);
    });
  });
}

function frame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || "");
  let header;
  if (body.length < 126) { header=Buffer.alloc(2); header[1]=body.length; }
  else if (body.length < 65536) { header=Buffer.alloc(4); header[1]=126; header.writeUInt16BE(body.length,2); }
  else { header=Buffer.alloc(10); header[1]=127; header.writeBigUInt64BE(BigInt(body.length),2); }
  header[0]=0x80 | opcode;
  return Buffer.concat([header,body]);
}

class Peer {
  constructor(socket, kind) {
    this.socket=socket; this.kind=kind||"game"; this.buffer=Buffer.alloc(0); this.fragments=[]; this.fragmentBytes=0;
    this.fragmenting=false; this.room=null; this.role=null; this.alive=true; this.windowStarted=Date.now(); this.messages=0;
    this.user=null; this.available=false; this.activity="online";
    socket.on("data", (data) => this.read(data));
    socket.on("close", () => disconnect(this));
    socket.on("error", () => disconnect(this));
  }
  send(message) {
    if (!this.socket.destroyed) this.socket.write(frame(1,JSON.stringify(message)));
  }
  close(code, reason) {
    if (this.socket.destroyed) return;
    const text=Buffer.from(reason || "").subarray(0,123),body=Buffer.alloc(2+text.length);
    body.writeUInt16BE(code || 1000,0);text.copy(body,2);
    this.socket.end(frame(8,body));
  }
  read(chunk) {
    this.buffer=Buffer.concat([this.buffer,chunk]);
    while (this.buffer.length >= 2) {
      const first=this.buffer[0],second=this.buffer[1],fin=Boolean(first&0x80),opcode=first&0x0f,masked=Boolean(second&0x80);
      let length=second&0x7f,offset=2;
      if (!masked) { this.close(1002,"Mask required"); return; }
      if (length===126) { if(this.buffer.length<4)return;length=this.buffer.readUInt16BE(2);offset=4; }
      else if(length===127) { if(this.buffer.length<10)return;const n=this.buffer.readBigUInt64BE(2);if(n>BigInt(MAX_MESSAGE)){this.close(1009,"Too large");return;}length=Number(n);offset=10; }
      if(length>MAX_MESSAGE){this.close(1009,"Too large");return;}
      if(this.buffer.length<offset+4+length)return;
      const mask=this.buffer.subarray(offset,offset+4),payload=Buffer.from(this.buffer.subarray(offset+4,offset+4+length));
      this.buffer=this.buffer.subarray(offset+4+length);
      for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
      if(opcode>=8 && (!fin || payload.length>125)){this.close(1002,"Invalid control frame");return;}
      if(opcode===8){disconnect(this);this.close(1000);return;}
      if(opcode===9){this.socket.write(frame(10,payload));continue;}
      if(opcode===10){this.alive=true;continue;}
      if(opcode!==0 && opcode!==1){this.close(1003,"Text only");return;}
      if(opcode===0 && !this.fragmenting){this.close(1002,"Unexpected continuation");return;}
      if(opcode===1 && this.fragmenting){this.close(1002,"Expected continuation");return;}
      if(opcode===1 && !fin)this.fragmenting=true;
      this.fragments.push(payload);this.fragmentBytes+=payload.length;
      if(this.fragmentBytes>MAX_MESSAGE){this.close(1009,"Too large");return;}
      if(fin){const message=Buffer.concat(this.fragments).toString("utf8");this.fragments=[];this.fragmentBytes=0;this.fragmenting=false;this.onText(message);}
    }
  }
  onText(text) {
    const now=Date.now();
    if(now-this.windowStarted>1000){this.windowStarted=now;this.messages=0;}
    if(++this.messages>90){this.close(1008,"Rate limit");return;}
    let message;try{message=JSON.parse(text);}catch(_){return;}
    if(this.kind==="presence")handlePresence(this,message);else handle(this,message);
  }
}

function code() {
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ";
  for(let tries=0;tries<50;tries++){
    let value="";for(let i=0;i<5;i++)value+=alphabet[crypto.randomInt(alphabet.length)];
    if(!rooms.has(value))return value;
  }
  throw new Error("Room code exhaustion");
}

function ship(value) { return Number.isInteger(value) && value >= 0 && value < 4 ? value : 0; }
const ENVIRONMENTS=new Set(["neo-shibuya","neon-rift","outer-rim","shogun-valley"]);
function environment(value) { return ENVIRONMENTS.has(value) ? value : "neo-shibuya"; }

function publicPresence(peer) {
  const user=peer.user||{};
  return {userId:Number(user.id),displayName:user.displayName||"Pilot",avatarUrl:user.avatarUrl||"",bestScore:Number(user.bestScore||0),available:Boolean(peer.available),activity:peer.activity==="in_game"?"in_game":"online"};
}

function presenceSnapshot() {
  const users=[];
  for(const peers of presenceByUser.values()){
    const peer=[...peers][0];
    if(peer)users.push(publicPresence(peer));
  }
  users.sort((a,b)=>Number(b.available)-Number(a.available)||b.bestScore-a.bestScore||a.displayName.localeCompare(b.displayName));
  return users;
}

function broadcastPresence() {
  const message={type:"presence_list",users:presenceSnapshot()};
  for(const peer of presencePeers)peer.send(message);
}

function registerPresence(peer,user) {
  peer.user=user;presencePeers.add(peer);
  const id=Number(user.id);let peers=presenceByUser.get(id);
  if(!peers){peers=new Set();presenceByUser.set(id,peers);}peers.add(peer);
  peer.send({type:"presence_ready",userId:id});broadcastPresence();
}

function cleanupInvite(invite,notifyType) {
  if(!invite)return;
  invites.delete(invite.id);
  if(notifyType){for(const peer of presenceByUser.get(invite.fromUserId)||[])peer.send({type:notifyType,inviteId:invite.id,userId:invite.toUserId});}
}

function handlePresence(peer,message) {
  if(!peer.user||!message||typeof message.type!=="string")return;
  if(message.type==="presence"){
    peer.available=Boolean(message.available)&&message.activity!=="in_game";
    peer.activity=message.activity==="in_game"?"in_game":"online";
    broadcastPresence();return;
  }
  if(message.type==="invite"){
    const targetUserId=Number(message.targetUserId),fromUserId=Number(peer.user.id);
    if(!Number.isSafeInteger(targetUserId)||targetUserId===fromUserId){peer.send({type:"error",message:"INVALID INVITE"});return;}
    const targets=presenceByUser.get(targetUserId);
    const target=targets?[...targets].find(item=>item.available&&item.activity!=="in_game"):null;
    if(!peer.available||peer.activity==="in_game"||!target){peer.send({type:"error",message:"PILOT IS NOT AVAILABLE"});return;}
    for(const invite of invites.values())if(invite.fromUserId===fromUserId&&invite.toUserId===targetUserId)cleanupInvite(invite);
    const id=crypto.randomBytes(12).toString("base64url");
    const invite={id,fromUserId,toUserId:targetUserId,createdAt:Date.now(),accepted:false};invites.set(id,invite);
    target.send({type:"invite_received",inviteId:id,from:publicPresence(peer)});
    peer.send({type:"invite_sent",inviteId:id,userId:targetUserId});return;
  }
  if(message.type==="invite_accept"||message.type==="invite_decline"){
    const id=String(message.inviteId||""),invite=invites.get(id);
    if(!invite||invite.toUserId!==Number(peer.user.id)){peer.send({type:"error",message:"INVITE EXPIRED"});return;}
    if(message.type==="invite_decline"){
      cleanupInvite(invite,"invite_declined");return;
    }
    invite.accepted=true;peer.available=false;broadcastPresence();
    for(const source of presenceByUser.get(invite.fromUserId)||[])source.send({type:"invite_accepted",inviteId:id,userId:invite.toUserId});
    peer.send({type:"invite_accept_confirmed",inviteId:id});return;
  }
  if(message.type==="invite_room"){
    const id=String(message.inviteId||""),room=String(message.room||"").toUpperCase(),invite=invites.get(id);
    if(!invite||!invite.accepted||invite.fromUserId!==Number(peer.user.id)||room.length!==5||!rooms.has(room)){peer.send({type:"error",message:"ROOM LINK FAILED"});return;}
    for(const target of presenceByUser.get(invite.toUserId)||[])target.send({type:"invite_room",inviteId:id,room});
    invites.delete(id);return;
  }
}

function leave(peer) {
  if(!peer.room)return;
  const room=rooms.get(peer.room);peer.room=null;
  if(!room)return;
  const other=room.host===peer?room.guest:room.host;
  if(other){other.send({type:"peer_left"});other.room=null;}
  rooms.delete(room.code);
}

function disconnect(peer) {
  leave(peer);
  if(peer.kind!=="presence"||!peer.user)return;
  presencePeers.delete(peer);
  const userId=Number(peer.user.id),peers=presenceByUser.get(userId);
  if(peers){peers.delete(peer);if(!peers.size)presenceByUser.delete(userId);}
  for(const invite of [...invites.values()]){
    if(invite.fromUserId===userId)cleanupInvite(invite);
    else if(invite.toUserId===userId)cleanupInvite(invite,"invite_expired");
  }
  broadcastPresence();
}

function handle(peer,message) {
  if(!message || typeof message.type!=="string")return;
  if(message.type==="create"){
    leave(peer);const roomCode=code();
    rooms.set(roomCode,{code:roomCode,host:peer,guest:null,hostShip:ship(message.ship),environment:environment(message.environment),createdAt:Date.now()});
    peer.room=roomCode;peer.role="host";peer.send({type:"created",room:roomCode});
  }else if(message.type==="join"){
    const roomCode=String(message.room||"").toUpperCase();const room=rooms.get(roomCode);
    if(!room || room.guest){peer.send({type:"error",message:"ROOM NOT FOUND OR ALREADY FULL"});return;}
    leave(peer);room.guest=peer;peer.room=roomCode;peer.role="guest";
    const requestedShip=ship(message.ship),guestShip=requestedShip===room.hostShip?(room.hostShip+1)%4:requestedShip,ships=[room.hostShip,guestShip];
    room.host.send({type:"ready",role:"host",room:roomCode,ships,environment:room.environment});peer.send({type:"ready",role:"guest",room:roomCode,ships,environment:room.environment,shipAdjusted:guestShip!==requestedShip});
  }else if(message.type==="leave")leave(peer);
  else if(!peer.room)return;
  else {
    const room=rooms.get(peer.room);if(!room)return;
    if(message.type==="input" && peer===room.guest && Number.isFinite(message.x) && Number.isFinite(message.y))
      room.host.send({type:"input",x:Math.max(0,Math.min(1,message.x)),y:Math.max(0,Math.min(1,message.y)),seq:Number.isSafeInteger(message.seq)?Math.max(0,message.seq):0});
    else if(message.type==="pulse" && peer===room.guest)room.host.send({type:"pulse"});
    else if(message.type==="state" && peer===room.host && room.guest && message.state && typeof message.state==="object")
      room.guest.send({type:"state",state:message.state});
  }
}

const server=http.createServer((request,response)=>{
  staticHandler(request,response).catch(error=>{
    console.error("Request failed",error);
    if(!response.headersSent)response.writeHead(500,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
    if(!response.writableEnded)response.end(JSON.stringify({error:"server_error"}));
  });
});
server.on("upgrade",(request,socket)=>{
  const connection=String(request.headers.connection||"").toLowerCase().split(",").map(value=>value.trim());
  let pathname;try{pathname=new URL(request.url,"http://localhost").pathname;}catch(_){return socket.destroy();}
  if((pathname!=="/ws"&&pathname!=="/presence") || request.headers.upgrade?.toLowerCase()!=="websocket" || !connection.includes("upgrade") || request.headers["sec-websocket-version"]!=="13")return socket.destroy();
  if(ALLOWED_ORIGIN && request.headers.origin!==ALLOWED_ORIGIN)return socket.destroy();
  const presenceUser=pathname==="/presence"?auth.currentUser(request):null;
  if(pathname==="/presence"&&!presenceUser)return socket.destroy();
  const key=request.headers["sec-websocket-key"];
  if(!key || !/^[A-Za-z0-9+/]{22}==$/.test(key))return socket.destroy();
  const accept=crypto.createHash("sha1").update(key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+accept+"\r\n\r\n");
  const peer=new Peer(socket,pathname==="/presence"?"presence":"game");
  if(presenceUser)registerPresence(peer,presenceUser);
});

const heartbeat=setInterval(()=>{
  const peers=new Set(presencePeers);
  for(const room of rooms.values())for(const peer of [room.host,room.guest])if(peer)peers.add(peer);
  for(const peer of peers){if(!peer.alive)peer.socket.destroy();else{peer.alive=false;peer.socket.write(frame(9,"ping"));}}
  const cutoff=Date.now()-6*60*60*1000;
  for(const room of rooms.values())if(room.createdAt<cutoff){room.host?.close(1001,"Room expired");room.guest?.close(1001,"Room expired");rooms.delete(room.code);}
  const inviteCutoff=Date.now()-30000;
  for(const invite of [...invites.values()])if(invite.createdAt<inviteCutoff)cleanupInvite(invite,"invite_expired");
},30000);
heartbeat.unref();

server.listen(PORT,HOST,()=>console.log(`Starfall co-op listening on http://${HOST}:${server.address().port}`));

server.on("close",()=>auth.close());

module.exports={server,rooms,auth,presenceByUser,invites};
