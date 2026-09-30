import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source=readFileSync(join(process.cwd(),"components/WorkspaceSplash.tsx"),"utf8");
const cloudAuth=readFileSync(join(process.cwd(),"lib/cloud-auth.ts"),"utf8");
const pwaRegister=readFileSync(join(process.cwd(),"components/PwaRegister.tsx"),"utf8");

for(const needle of [
  'entryEligibleRef=useRef(!SKIP_PREFIXES.some(prefix=>pathname.startsWith(prefix)))',
  'useState(entryEligibleRef.current)',
  'if(!entryEligibleRef.current)return',
  'data-splash-mode="document-entry"',
  'const closeTimer=window.setTimeout(()=>setShow(false),SPLASH_MS)',
])assert.ok(source.includes(needle),`workspace splash guard missing: ${needle}`);

assert.ok(!source.includes("sessionStorage"),"A refresh must never skip the document-entry splash");
assert.ok(!source.includes("loadLocalSession"),"The server-rendered splash must not wait for browser session hydration");
assert.match(source,/useEffect\(\(\)=>\{[\s\S]*?if\(!entryEligibleRef\.current\)return;[\s\S]*?\},\[\]\);/,"The entry animation must run once per mounted document, not on every route change");
assert.ok(cloudAuth.includes("function sessionStartedAt(previousSession:LocalSession|null,userId:string)"),"Cloud auth must preserve the real login start time");
assert.equal(cloudAuth.split("startedAt:sessionStartedAt(previousSession,user.id)").length-1,2,"Both cloud identity paths must preserve the login start time");
assert.ok(pwaRegister.includes("const registerWorker = async () =>"),"The PWA must update its worker silently");
assert.ok(!pwaRegister.includes("resetLegacyWorker"),"A normal app mount must not run a destructive worker reset");
assert.ok(!pwaRegister.includes("hadController"),"An existing service-worker controller must not trigger a reload");
assert.ok(!pwaRegister.includes("RESET_KEY"),"Routine refreshes must not use a reload sentinel");
assert.equal(pwaRegister.split("window.location.reload()").length-1,1,"Only genuine stale-asset recovery may reload the page");

console.log("✓ Workspace splash passed: server-first on entry/F5, one uninterrupted animation, silent PWA updates.");
