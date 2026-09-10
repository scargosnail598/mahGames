"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {AuthService}=require("../lib/auth.js");

test("missing Google client id disables sign-in without disabling the auth store",async()=>{
  const auth=new AuthService({clientId:"",databasePath:":memory:"});
  assert.equal(auth.enabled,false);
  const columns=auth.db.prepare("PRAGMA table_info(users)").all().map(column=>column.name);
  assert.deepEqual(columns,["id","google_sub","display_name","email","avatar_url","created_at","last_login_at"]);
  let status=0,body="";
  const request={method:"POST",headers:{},socket:{encrypted:false}};
  const response={writeHead(value){status=value;},end(value){body=String(value||"");}};
  assert.equal(await auth.handle(request,response,"/api/auth/google"),true);
  assert.equal(status,503);assert.deepEqual(JSON.parse(body),{error:"google_auth_unavailable"});
  auth.close();
});
