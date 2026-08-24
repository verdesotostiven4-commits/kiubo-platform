import { loadLocalDatabase,saveLocalDatabase } from "./local-store";

const PRIMARY_KEY="kiubo.foundation.v2";
const SESSION_KEY="kiubo.local.session.v1";
const DATA_CACHE="kiubo-data-durability-v1";
const SHADOW_PATH="/__kiubo/local-db-shadow";
const SNAPSHOT_INTERVAL_MS=5000;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ShadowEnvelope={
  format:"kiubo-local-shadow-v1";
  writtenAt:string;
  checksum:string;
  raw:string;
};

function checksum(input:string){
  let hash=2166136261;
  for(let i=0;i<input.length;i++){
    hash^=input.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,"0");
}

function expectedTenantFromSession(){
  if(typeof window==="undefined")return"";
  try{
    const raw=window.localStorage.getItem(SESSION_KEY);
    if(!raw)return"";
    const session=JSON.parse(raw) as {tenantId?:string;activeTenantId?:string};
    const tenant=String(session.activeTenantId||session.tenantId||"");
    return UUID_RE.test(tenant)?tenant:"";
  }catch{return""}
}

function validPrimary(raw:string|null,expectedTenant=""){
  if(!raw)return false;
  try{
    const parsed=JSON.parse(raw) as {tenants?:Array<{id?:string}>;syncQueue?:unknown[]};
    if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.tenants)||!Array.isArray(parsed.syncQueue))return false;
    if(expectedTenant&&!parsed.tenants.some(tenant=>tenant?.id===expectedTenant))return false;
    return true;
  }catch{return false}
}

function shadowRequest(){
  return new Request(new URL(SHADOW_PATH,window.location.origin).toString(),{method:"GET"});
}

async function readShadow(expectedTenant:string){
  if(typeof window==="undefined"||!("caches" in window))return null;
  try{
    const cache=await caches.open(DATA_CACHE);
    const response=await cache.match(shadowRequest());
    if(!response)return null;
    const envelope=await response.json() as ShadowEnvelope;
    if(envelope?.format!=="kiubo-local-shadow-v1"||typeof envelope.raw!=="string")return null;
    if(checksum(envelope.raw)!==envelope.checksum)return null;
    if(!validPrimary(envelope.raw,expectedTenant))return null;
    return envelope;
  }catch{return null}
}

export async function snapshotOfflineDatabase(){
  if(typeof window==="undefined"||!("caches" in window))return false;
  const raw=window.localStorage.getItem(PRIMARY_KEY);
  if(!validPrimary(raw))return false;
  try{
    const cache=await caches.open(DATA_CACHE);
    const existing=await cache.match(shadowRequest());
    if(existing){
      try{
        const previous=await existing.clone().json() as ShadowEnvelope;
        if(previous?.checksum===checksum(raw!))return true;
      }catch{}
    }
    const envelope:ShadowEnvelope={format:"kiubo-local-shadow-v1",writtenAt:new Date().toISOString(),checksum:checksum(raw!),raw:raw!};
    await cache.put(shadowRequest(),new Response(JSON.stringify(envelope),{headers:{"content-type":"application/json","cache-control":"no-store"}}));
    return true;
  }catch{return false}
}

export function recoverInterruptedSyncQueue(){
  if(typeof window==="undefined")return 0;
  const db=loadLocalDatabase(),now=new Date().toISOString();
  let recovered=0;
  db.syncQueue=db.syncQueue.map(item=>{
    if(item.status!=="syncing")return item;
    recovered++;
    return{...item,status:"pending" as const,updatedAt:now,lastError:item.lastError||"Reanudada después de un cierre inesperado"};
  });
  if(recovered)saveLocalDatabase(db,{trackChanges:false});
  return recovered;
}

export async function initializeOfflineDurability(){
  if(typeof window==="undefined")return{recoveredPrimary:false,recoveredQueue:0,persistentStorage:false};
  const expectedTenant=expectedTenantFromSession();
  const primaryAtBoot=window.localStorage.getItem(PRIMARY_KEY);
  let recoveredPrimary=false;

  if(!validPrimary(primaryAtBoot,expectedTenant)){
    const shadow=await readShadow(expectedTenant);
    if(shadow){
      window.localStorage.setItem(PRIMARY_KEY,shadow.raw);
      recoveredPrimary=true;
    }
  }

  const recoveredQueue=recoverInterruptedSyncQueue();
  await snapshotOfflineDatabase();

  let persistentStorage=false;
  try{
    if(navigator.storage?.persist)persistentStorage=await navigator.storage.persist();
  }catch{}

  return{recoveredPrimary,recoveredQueue,persistentStorage};
}

export function startOfflineDurability(){
  if(typeof window==="undefined")return()=>{};
  let stopped=false;
  const snapshot=()=>{if(!stopped)void snapshotOfflineDatabase()};
  const timer=window.setInterval(snapshot,SNAPSHOT_INTERVAL_MS);
  const onVisibility=()=>{if(document.visibilityState==="hidden")snapshot()};
  const onStorage=(event:StorageEvent)=>{if(event.key===PRIMARY_KEY)snapshot()};
  window.addEventListener("pagehide",snapshot);
  window.addEventListener("online",snapshot);
  window.addEventListener("storage",onStorage);
  document.addEventListener("visibilitychange",onVisibility);
  return()=>{
    stopped=true;
    window.clearInterval(timer);
    window.removeEventListener("pagehide",snapshot);
    window.removeEventListener("online",snapshot);
    window.removeEventListener("storage",onStorage);
    document.removeEventListener("visibilitychange",onVisibility);
  };
}
