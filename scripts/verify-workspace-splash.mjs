import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source=readFileSync(join(process.cwd(),"components/WorkspaceSplash.tsx"),"utf8");
const cloudAuth=readFileSync(join(process.cwd(),"lib/cloud-auth.ts"),"utf8");

for(const needle of [
  'useState(false)',
  'useRef("")',
  'const launchId=`${session.userId}:${session.startedAt}`',
  'window.sessionStorage.getItem(SESSION_SPLASH_KEY)===launchId',
  'activeLaunchRef.current!==launchId',
  'window.sessionStorage.setItem(SESSION_SPLASH_KEY,launchId)',
])assert.ok(source.includes(needle),`workspace splash guard missing: ${needle}`);

assert.ok(!source.includes("useState(initialEligible)"),"Splash must not be server-rendered before sessionStorage is checked");
assert.ok(!source.includes('sessionStorage.setItem(SESSION_SPLASH_KEY,"1")'),"Splash playback must be scoped to the real login session");
assert.ok(cloudAuth.includes("function sessionStartedAt(previousSession:LocalSession|null,userId:string)"),"Cloud auth must preserve the real login start time");
assert.equal(cloudAuth.split("startedAt:sessionStartedAt(previousSession,user.id)").length-1,2,"Both cloud identity paths must preserve the login start time");

console.log("✓ Workspace splash passed: one launch per login session, no refresh flash, Strict Mode safe.");
