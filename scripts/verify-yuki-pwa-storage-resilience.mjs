import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const original=readFileSync("public/sw.js","utf8");
const pwa=readFileSync("components/PwaRegister.tsx","utf8");
const store=readFileSync("lib/local-store.ts","utf8");
assert.match(original,/kiubo-shell-v10/);
assert.match(pwa,/sw\.js\?v=10/);
assert.ok(!/failed to fetch\/i\.test/.test(pwa),"Network drop must not clear a healthy offline worker");
assert.ok(store.includes("next.syncQueue=[...synced,...active];"),"Pending operations cannot be truncated on busy offline days");

function workerHarness(){
  const listeners={};
  const buckets=new Map();
  const state={failPut:false,failOpen:false,failNetwork:false,skipWaiting:0,claimed:0,networkHits:0};
  const origin="https://kiubo-platform.vercel.app";
  const keyOf=request=>new URL(typeof request==="string"?request:request.url,origin).toString();
  class Request{
    constructor(url,options={}){this.url=keyOf(url);this.method="GET";this.mode=options.mode||"same-origin";this.destination=options.destination||""}
  }
  class Response{
    constructor(body,{status=200}={}){this.body=body;this.status=status;this.ok=status>=200&&status<300}
    clone(){return new Response(this.body,{status:this.status})}
    static error(){return new Response("offline",{status:0})}
  }
  const caches={
    async open(name){
      if(state.failOpen)throw new Error("CacheStorage blocked");
      if(!buckets.has(name))buckets.set(name,new Map());
      const map=buckets.get(name);
      return {
        async match(request){return map.get(keyOf(request))?.clone()},
        async put(request,response){
          if(state.failPut)throw Object.assign(new Error("Browser quota reached"),{name:"QuotaExceededError"});
          map.set(keyOf(request),response.clone());
        },
        async keys(){return Array.from(map.keys(),url=>new Request(url))},
        async delete(request){return map.delete(keyOf(request))},
      };
    },
    async keys(){return [...buckets.keys()]},
    async delete(name){return buckets.delete(name)},
  };
  const context={
    self:{
      location:{origin},
      addEventListener(name,fn){listeners[name]=fn},
      skipWaiting(){state.skipWaiting++;return Promise.resolve()},
      clients:{claim(){state.claimed++;return Promise.resolve()}},
    },
    caches,
    Request,
    Response,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    fetch:async request=>{
      state.networkHits++;
      if(state.failNetwork)throw new Error("No network");
      return new Response("network:"+keyOf(request),{status:200});
    }
  };
  vm.runInNewContext(original,context,{filename:"public/sw.js",timeout:2500});
  async function event(type,request){
    const waits=[];
    let result;
    const evt={
      request,
      respondWith(promise){result=Promise.resolve(promise)},
      waitUntil(promise){waits.push(Promise.resolve(promise))},
    };
    listeners[type](evt);
    const response=await result;
    await Promise.all(waits);
    return response;
  }
  async function lifecycle(type){
    const waits=[];
    listeners[type]({waitUntil(p){waits.push(Promise.resolve(p))}});
    await Promise.all(waits);
  }
  return {state,origin,buckets,caches,Request,Response,event,lifecycle};
}
const h=workerHarness();
const nav=new h.Request(h.origin+"/pos",{mode:"navigate"});
const js=new h.Request(h.origin+"/_next/static/chunks/runtime-123.js",{destination:"script"});

h.state.failPut=true;
const onlineNav=await h.event("fetch",nav);
assert.equal(onlineNav.body,"network:"+nav.url,"Quota failure must not break a successful POS navigation");
const onlineJs=await h.event("fetch",js);
assert.equal(onlineJs.body,"network:"+js.url,"Quota failure must not break a JS chunk");
h.state.failOpen=true;
const withoutCache=await h.event("fetch",nav);
assert.equal(withoutCache.body,"network:"+nav.url,"Unavailable CacheStorage must never block online navigation");
h.state.failOpen=false;
h.state.failPut=false;
await h.event("fetch",nav);
h.state.failNetwork=true;
const offlineNav=await h.event("fetch",nav);
assert.equal(offlineNav.body,"network:"+nav.url,"Offline navigation must recover its last usable shell");
console.log("✓ Navigation/chunk failures: quota, CacheStorage denial, offline and normal network");

h.state.failNetwork=false;
h.state.failPut=true;
const image=new h.Request(h.origin+"/_next/image?w=256&q=80",{destination:"image"});
const imageResponse=await h.event("fetch",image);
assert.equal(imageResponse.body,"network:"+image.url,"Asset cache full must not break images");
h.state.failPut=false;
for(let n=0;n<75;n++){
  const img=new h.Request(h.origin+"/image-"+n+".png",{destination:"image"});
  await h.event("fetch",img);
}
assert.ok(h.buckets.get("kiubo-assets-v10").size<=48,"Images must not accumulate forever in the origin");
h.state.failNetwork=true;
const cachedImage=await h.event("fetch",new h.Request(h.origin+"/image-74.png",{destination:"image"}));
assert.equal(cachedImage.body,"network:"+h.origin+"/image-74.png","Offline asset fallback must survive network outage");
console.log("✓ Image/font caching is bounded and independent of successful online requests");

h.state.failNetwork=false;
h.buckets.set("kiubo-data-durability-v1",new Map([["protected",new h.Response("local-orders")]]));
h.buckets.set("kiubo-shell-v9",new Map());
await h.lifecycle("activate");
assert.ok(h.buckets.has("kiubo-data-durability-v1"),"Never delete recoverable offline database backups");
assert.ok(!h.buckets.has("kiubo-shell-v9"),"Obsolete shell cache should be retired");
assert.equal(h.state.claimed,1,"New service worker should take control");
h.state.failPut=true;
await h.lifecycle("install");
assert.equal(h.state.skipWaiting,1,"Cache quota failure must not prevent installation of the new worker");
console.log("✓ SW upgrades survive full caches and preserve the KIUBO durability shadow");

const transpiled=ts.transpileModule(store,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("module","exports",transpiled)(module,module.exports);
const local=new Map();
const priorWindow=globalThis.window,priorEvent=globalThis.CustomEvent;
globalThis.window={
  localStorage:{
    getItem:key=>local.get(key)??null,
    setItem:(key,val)=>{local.set(key,val)},
    removeItem:key=>{local.delete(key)}
  },
  dispatchEvent(){},
};
globalThis.CustomEvent=class CustomEvent{constructor(type){this.type=type}};
try{
  const db=module.exports.loadLocalDatabase();
  db.syncQueue=Array.from({length:2150},(_,i)=>({
    id:"queue-"+i,operationId:"op-"+i,tenantId:"8e2d0299-5680-4eec-8c57-e37fe29086aa",
    branchId:"branch",entityType:"orders",entityId:"order-"+i,
    action:"upsert",payload:{id:"order-"+i},
    status:"pending",attempts:0,createdAt:"2026-10-01T00:00:00Z",updatedAt:"2026-10-01T00:00:00Z"
  }));
  module.exports.saveLocalDatabase(db);
  const restored=module.exports.loadLocalDatabase();
  assert.equal(restored.syncQueue.filter(x=>x.status==="pending").length,2150,"All unpaid/unsynced events must survive storage compaction");
  assert.equal(restored.syncQueue[0].operationId,"op-0","The oldest pending operation must survive");
  console.log("✓ Offline queue: 2,150 unsynced operations retained, with no silent truncation");
}finally{
  if(priorWindow===undefined)delete globalThis.window;
  else globalThis.window=priorWindow;
  if(priorEvent===undefined)delete globalThis.CustomEvent;
  else globalThis.CustomEvent=priorEvent;
}
