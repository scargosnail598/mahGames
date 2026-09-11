"use strict";

const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const { DatabaseSync }=require("node:sqlite");
const { OAuth2Client }=require("google-auth-library");

const COOKIE_NAME="starfall_session";
const SESSION_SECONDS=60*60*24*30;
const MAX_BODY_BYTES=20*1024;
const MAX_SCORE=10_000_000;
const MAX_KILLS=100_000;
const MAX_DURATION=6*60*60;
const ENVIRONMENTS=new Set(["neo-shibuya","neon-rift","outer-rim","shogun-valley"]);

function json(response,status,body,headers) {
  const data=Buffer.from(JSON.stringify(body));
  response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","content-length":data.length,...headers});
  response.end(data);
}

function readJson(request) {
  return new Promise((resolve,reject)=>{
    if(!String(request.headers["content-type"]||"").toLowerCase().startsWith("application/json")){
      reject(Object.assign(new Error("JSON required"),{status:415}));return;
    }
    const chunks=[];let size=0;let settled=false;
    request.on("data",chunk=>{
      if(settled)return;
      size+=chunk.length;
      if(size>MAX_BODY_BYTES){settled=true;reject(Object.assign(new Error("Request too large"),{status:413}));request.resume();return;}
      chunks.push(chunk);
    });
    request.on("end",()=>{
      if(settled)return;
      try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"));}
      catch(_){reject(Object.assign(new Error("Invalid JSON"),{status:400}));}
    });
    request.on("error",reject);
  });
}

function cookies(request) {
  const result={};
  for(const part of String(request.headers.cookie||"").split(";")){
    const at=part.indexOf("=");if(at<1)continue;
    result[part.slice(0,at).trim()]=part.slice(at+1).trim();
  }
  return result;
}

function sessionHash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }

function isSecure(request) {
  return Boolean(request.socket.encrypted)||String(request.headers["x-forwarded-proto"]||"").split(",")[0].trim().toLowerCase()==="https";
}

function sessionCookie(request,token,maxAge) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure(request)?"; Secure":""}`;
}

function requestOrigin(request) {
  const forwarded=String(request.headers["x-forwarded-proto"]||"").split(",")[0].trim();
  const protocol=forwarded||(request.socket.encrypted?"https":"http");
  return `${protocol}://${request.headers.host||""}`;
}

function cleanText(value,max) { return typeof value==="string"?value.trim().slice(0,max):""; }

function avatarUrl(value) {
  try { const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="googleusercontent.com"||url.hostname.endsWith(".googleusercontent.com"))?url.href.slice(0,2048):""; }
  catch(_) { return ""; }
}

class AuthService {
  constructor(options) {
    const settings=options||{};
    this.clientId=settings.clientId||process.env.GOOGLE_CLIENT_ID||"";
    this.allowedOrigin=settings.allowedOrigin||process.env.ALLOWED_ORIGIN||"";
    this.enabled=Boolean(this.clientId);
    const databasePath=settings.databasePath||process.env.AUTH_DB_PATH||path.join(process.cwd(),"data","starfall.sqlite");
    if(databasePath!==":memory:")fs.mkdirSync(path.dirname(databasePath),{recursive:true});
    this.db=new DatabaseSync(databasePath);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        email TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        id_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        kills INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        environment TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS scores_user_id ON scores(user_id);
      CREATE INDEX IF NOT EXISTS scores_score ON scores(score DESC,created_at ASC);
    `);
    const googleClient=this.enabled?new OAuth2Client(this.clientId):null;
    this.verifyGoogleToken=settings.verifyGoogleToken||(async(idToken)=>{
      const ticket=await googleClient.verifyIdToken({idToken,audience:this.clientId});
      return ticket.getPayload();
    });
  }

  publicUser(row) {
    return {id:Number(row.id),displayName:row.display_name,email:row.email,avatarUrl:row.avatar_url||"",bestScore:Number(row.best_score||0)};
  }

  sameOrigin(request) {
    const origin=request.headers.origin;
    if(!origin)return true;
    return origin===(this.allowedOrigin||requestOrigin(request));
  }

  currentUser(request) {
    const token=cookies(request)[COOKIE_NAME];
    if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
    const now=new Date().toISOString();
    const row=this.db.prepare(`
      SELECT u.id,u.display_name,u.email,u.avatar_url,
             COALESCE((SELECT MAX(score) FROM scores WHERE user_id=u.id),0) AS best_score
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.id_hash=? AND s.expires_at>?
    `).get(sessionHash(token),now);
    return row?this.publicUser(row):null;
  }

  async google(request,response) {
    if(!this.enabled){json(response,503,{error:"google_auth_unavailable"});return;}
    if(!this.sameOrigin(request)){json(response,403,{error:"invalid_origin"});return;}
    let body;
    try{body=await readJson(request);}
    catch(error){json(response,error.status||400,{error:"invalid_request"});return;}
    const credential=typeof body.credential==="string"&&body.credential.length<=16000?body.credential:"";
    if(!credential){json(response,400,{error:"credential_required"});return;}
    let payload;
    try{payload=await this.verifyGoogleToken(credential);}
    catch(_){json(response,401,{error:"invalid_google_token"});return;}
    const googleSub=cleanText(payload&&payload.sub,255);
    const email=cleanText(payload&&payload.email,320).toLowerCase();
    if(!googleSub||!email||payload.email_verified!==true){json(response,401,{error:"invalid_google_identity"});return;}
    const displayName=cleanText(payload.name,120)||email.split("@")[0].slice(0,120)||"Pilot";
    const avatar=avatarUrl(payload.picture);
    const now=new Date().toISOString();
    this.db.prepare(`
      INSERT INTO users(google_sub,display_name,email,avatar_url,created_at,last_login_at)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(google_sub) DO UPDATE SET
        display_name=excluded.display_name,email=excluded.email,
        avatar_url=excluded.avatar_url,last_login_at=excluded.last_login_at
    `).run(googleSub,displayName,email,avatar,now,now);
    const userRow=this.db.prepare(`SELECT id,display_name,email,avatar_url,COALESCE((SELECT MAX(score) FROM scores WHERE user_id=users.id),0) AS best_score FROM users WHERE google_sub=?`).get(googleSub);
    const token=crypto.randomBytes(32).toString("base64url");
    const expiresAt=new Date(Date.now()+SESSION_SECONDS*1000).toISOString();
    this.db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
    this.db.prepare("INSERT INTO sessions(id_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)").run(sessionHash(token),userRow.id,now,expiresAt);
    json(response,200,{user:this.publicUser(userRow)},{"set-cookie":sessionCookie(request,token,SESSION_SECONDS)});
  }

  me(request,response) {
    const user=this.currentUser(request);
    if(!user){json(response,401,{user:null});return;}
    json(response,200,{user});
  }

  async score(request,response) {
    if(!this.sameOrigin(request)){json(response,403,{error:"invalid_origin"});return;}
    const user=this.currentUser(request);
    if(!user){json(response,401,{error:"authentication_required"});return;}
    let body;
    try{body=await readJson(request);}
    catch(error){json(response,error.status||400,{error:"invalid_request"});return;}
    const score=Number(body.score),kills=Number(body.kills),duration=Number(body.durationSeconds);
    const environment=cleanText(body.environment,40),mode=cleanText(body.mode,16);
    if(mode!=="solo"||!ENVIRONMENTS.has(environment)||!Number.isSafeInteger(score)||score<0||score>MAX_SCORE||!Number.isSafeInteger(kills)||kills<0||kills>MAX_KILLS||!Number.isSafeInteger(duration)||duration<0||duration>MAX_DURATION){json(response,400,{error:"invalid_score"});return;}
    const previous=this.db.prepare("SELECT COALESCE(MAX(score),0) AS best FROM scores WHERE user_id=?").get(user.id);
    const now=new Date().toISOString();
    this.db.prepare("INSERT INTO scores(user_id,score,kills,duration_seconds,environment,created_at) VALUES(?,?,?,?,?,?)").run(user.id,score,kills,duration,environment,now);
    const bestScore=Math.max(Number(previous.best||0),score);
    json(response,201,{saved:true,bestScore,personalBest:score>Number(previous.best||0)});
  }

  leaderboard(request,response) {
    const rows=this.db.prepare(`
      SELECT u.id AS user_id,u.display_name,u.avatar_url,s.score,s.environment,s.created_at
      FROM users u
      JOIN scores s ON s.id=(
        SELECT s2.id FROM scores s2
        WHERE s2.user_id=u.id
        ORDER BY s2.score DESC,s2.created_at ASC,s2.id ASC
        LIMIT 1
      )
      ORDER BY s.score DESC,s.created_at ASC,s.id ASC
      LIMIT 25
    `).all();
    json(response,200,{entries:rows.map(row=>({userId:Number(row.user_id),displayName:row.display_name,avatarUrl:row.avatar_url||"",score:Number(row.score),environment:row.environment}))});
  }

  logout(request,response) {
    if(!this.sameOrigin(request)){json(response,403,{error:"invalid_origin"});return;}
    const token=cookies(request)[COOKIE_NAME];
    if(token&&/^[A-Za-z0-9_-]{43}$/.test(token))this.db.prepare("DELETE FROM sessions WHERE id_hash=?").run(sessionHash(token));
    response.writeHead(204,{"cache-control":"no-store","set-cookie":sessionCookie(request,"",0)});response.end();
  }

  async handle(request,response,pathname) {
    if(pathname==="/api/me"&&request.method==="GET"){this.me(request,response);return true;}
    if(pathname==="/api/auth/google"&&request.method==="POST"){await this.google(request,response);return true;}
    if(pathname==="/api/logout"&&request.method==="POST"){this.logout(request,response);return true;}
    if(pathname==="/api/scores"&&request.method==="POST"){await this.score(request,response);return true;}
    if(pathname==="/api/leaderboard"&&request.method==="GET"){this.leaderboard(request,response);return true;}
    if(pathname.startsWith("/api/")){
      const routes={"/api/me":"GET","/api/auth/google":"POST","/api/logout":"POST","/api/scores":"POST","/api/leaderboard":"GET"};
      if(routes[pathname])response.writeHead(405,{allow:routes[pathname],"cache-control":"no-store"});
      else response.writeHead(404,{"cache-control":"no-store"});
      response.end();return true;
    }
    return false;
  }

  close() { if(this.db){this.db.close();this.db=null;} }
}

module.exports={AuthService,COOKIE_NAME};
