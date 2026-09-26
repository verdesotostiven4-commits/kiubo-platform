"use client";

import { useEffect } from "react";
import { KIUBO_SYNC_QUEUED_EVENT,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type KiuboLocalDatabase,type TenantProduct } from "@/lib/local-store";
import { runSyncCycle } from "@/lib/sync-engine";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { SyncEntity } from "@/lib/sync-types";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_SNAPSHOT_KEY="kiubo.canonical-snapshot.v1:";
const CANONICAL_SNAPSHOT_INTERVAL=5*60*1000;
const CANONICAL_ENTITIES:SyncEntity[]=["tenantProducts","settings","branding","customers","suppliers","purchases","supplierPayments","stockMovements"];
const COLLECTION_BY_ENTITY:Partial<Record<SyncEntity,keyof KiuboLocalDatabase>>={
  tenantProducts:"tenantProducts",settings:"settings",branding:"branding",customers:"customers",suppliers:"suppliers",purchases:"purchases",supplierPayments:"supplierPayments",stockMovements:"stockMovements"
};
export const KIUBO_DATA_REFRESHED="kiubo:data-refreshed";

function canonicalSnapshotDue(tenantId:string){
  if(typeof window==="undefined")return true;
  try{
    const raw=window.localStorage.getItem(CANONICAL_SNAPSHOT_KEY+tenantId);
    if(!raw)return true;
    const parsed=JSON.parse(raw) as {version?:string;completedAt?:number};
    return parsed.version!=="1"||!Number.isFinite(parsed.completedAt)||Date.now()-Number(parsed.completedAt)>=CANONICAL_SNAPSHOT_INTERVAL;
  }catch{return true}
}

function markCanonicalSnapshot(tenantId:string){
  if(typeof window!=="undefined")window.localStorage.setItem(CANONICAL_SNAPSHOT_KEY+tenantId,JSON.stringify({version:"1",completedAt:Date.now()}));
}

function isSyntheticYukiProductId(id:string){
  return id==="yuki-service-packaging"||/^yuki-menu-[a-z0-9-]+$/i.test(id);
}

function pendingEntityIds(tenantId:string,entityType:SyncEntity){
  const ids=new Set<string>(),db=loadLocalDatabase();
  for(const item of db.syncQueue){
    if(item.tenantId!==tenantId||item.status==="synced")continue;
    if(item.entityType===entityType)ids.add(item.entityId);
    const payload=item.payload&&typeof item.payload==="object"?item.payload as Record<string,unknown>:{};
    const add=(value:unknown)=>{if(typeof value==="string"&&value)ids.add(value)};
    if(entityType==="tenantProducts"){
      add(payload.productId);add((payload.productAfter as Record<string,unknown>|undefined)?.id);add((payload.productBefore as Record<string,unknown>|undefined)?.id);
      for(const key of ["stockMovements","productSnapshots","productAfterSnapshots"]){
        const rows=Array.isArray(payload[key])?payload[key] as Record<string,unknown>[]:[];
        for(const row of rows)add(row.productId||row.id);
      }
    }
    if(entityType==="customers")add(payload.customerId);
    if(entityType==="purchases"){
      add((payload.purchase as Record<string,unknown>|undefined)?.id);add((payload.purchaseAfter as Record<string,unknown>|undefined)?.id);add((payload.purchaseBefore as Record<string,unknown>|undefined)?.id);
    }
    if(entityType==="supplierPayments"){
      add((payload.payment as Record<string,unknown>|undefined)?.id);add((payload.paymentAfter as Record<string,unknown>|undefined)?.id);add((payload.paymentBefore as Record<string,unknown>|undefined)?.id);
    }
    if(entityType==="stockMovements"){
      add(payload.movementId);add((payload.movement as Record<string,unknown>|undefined)?.id);
    }
  }
  return ids;
}

async function readCanonicalRows(tenantId:string){
  const client=getSupabaseBrowserClient();
  if(!client)return null;
  const rows:Array<{entity_type?:string;entity_id?:string;branch_id?:string|null;payload?:unknown;deleted?:boolean}>=[];
  for(let offset=0;offset<10_000;offset+=1_000){
    const result=await client.from("sync_entities").select("entity_type,entity_id,branch_id,payload,deleted").eq("tenant_id",tenantId).in("entity_type",CANONICAL_ENTITIES).order("entity_type").order("entity_id").range(offset,offset+999);
    if(result.error||!Array.isArray(result.data))return null;
    rows.push(...result.data as typeof rows);
    if(result.data.length<1_000)break;
  }
  return rows;
}

async function reconcileCanonicalSnapshot(tenantId:string,branchId:string){
  if(!canonicalSnapshotDue(tenantId))return 0;
  // Read the complete canonical snapshot, including tombstones. The revision
  // cursor is intentionally not used here: an old device can have a cursor
  // ahead of changes it missed, so it still needs a periodic full reconciliation.
  const rows=await readCanonicalRows(tenantId);
  if(!rows)return 0;
  const next=loadLocalDatabase(),localContext=getWorkspaceContext(next);
  const isYuki=localContext.tenantId===tenantId&&localContext.tenant?.name.trim().toUpperCase()==="YUKI";
  // Older YUKI installations could enqueue the built-in demo menu before the
  // first Cloud pull. Those synthetic writes are not customer edits and must
  // not keep protecting stale local prices forever. Keep their queue history
  // for backup/audit purposes, but stop retrying them and let Cloud win.
  let queueChanged=false;
  if(isYuki){
    next.syncQueue=next.syncQueue.map(item=>{
      const synthetic=item.tenantId===tenantId&&item.branchId===branchId&&item.entityType==="tenantProducts"&&isSyntheticYukiProductId(item.entityId)&&item.status!=="synced";
      if(!synthetic)return item;
      queueChanged=true;
      return{...item,status:"synced" as const,lastError:"Ignorada semilla local antigua; Cloud es la fuente canónica",updatedAt:new Date().toISOString()};
    });
  }
  const protectedByEntity=new Map<SyncEntity,Set<string>>(CANONICAL_ENTITIES.map(entity=>[entity,pendingEntityIds(tenantId,entity)]));
  const remoteIds=new Map<SyncEntity,Set<string>>(CANONICAL_ENTITIES.map(entity=>[entity,new Set<string>()]));
  let changed=0;
  for(const row of rows){
    const entity=row.entity_type as SyncEntity,collectionKey=COLLECTION_BY_ENTITY[entity];
    if(!collectionKey)continue;
    const id=String(row.entity_id||"");
    if(!id||((row.branch_id||"")!==""&&(row.branch_id!==branchId)))continue;
    const protectedIds=protectedByEntity.get(entity)!;
    const collection=(next[collectionKey] as unknown as Record<string,unknown>[]);
    const key=(entity==="settings"||entity==="branding")?tenantId:id;
    if(row.deleted){
      if(!protectedIds.has(id)){
        const before=collection.length;
        (next[collectionKey] as unknown as Record<string,unknown>[])=collection.filter(record=>String(record.id||record.tenantId||"")!==key);
        if(collection.length!==before)changed++;
      }
      continue;
    }
    remoteIds.get(entity)!.add(key);
    const payload=row.payload&&typeof row.payload==="object"?row.payload as TenantProduct:null;
    if(!payload||protectedIds.has(id))continue;
    const index=collection.findIndex(record=>String(record.id||record.tenantId||"")===key);
    if(index<0){collection.push(payload as unknown as Record<string,unknown>);changed++;continue}
    if(JSON.stringify(collection[index])!==JSON.stringify(payload)){collection[index]=payload as unknown as Record<string,unknown>;changed++}
  }
  // Synthetic YUKI seed records are the only absent-record cleanup we perform:
  // canonical Cloud rows may legitimately omit a product that was never synced,
  // while an old PWA can still have those local demo rows.
  const productIds=remoteIds.get("tenantProducts")!,productProtected=protectedByEntity.get("tenantProducts")!;
  const beforeProducts=next.tenantProducts.length;
  next.tenantProducts=next.tenantProducts.filter(product=>{
    if(product.tenantId!==tenantId||product.branchId!==branchId||productProtected.has(product.id))return true;
    return productIds.has(product.id)||!isSyntheticYukiProductId(product.id);
  });
  if(next.tenantProducts.length!==beforeProducts)changed++;
  if(!changed&&!queueChanged){markCanonicalSnapshot(tenantId);return 0}
  // A second queue check closes the race where a local sale/adjustment is
  // created while the read-only Cloud snapshot is in flight.
  if(pendingEntityIds(tenantId,"tenantProducts").size>0){
    if(queueChanged)saveLocalDatabase(next,{trackChanges:false});
    markCanonicalSnapshot(tenantId);
    return 0;
  }
  saveLocalDatabase(next,{trackChanges:false});
  markCanonicalSnapshot(tenantId);
  return changed;
}

export function RealtimeSyncRuntime(){
  useEffect(()=>{
    const client=getSupabaseBrowserClient();
    if(!client)return;
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
    if(!ctx.tenant||ctx.tenant.plan==="Internal"||!UUID_RE.test(ctx.tenantId))return;
    let timer:number|undefined,disposed=false,busy=false,continueSync=false;
    const sync=()=>{
      if(disposed||busy)return;
      if(timer)window.clearTimeout(timer);
      timer=window.setTimeout(()=>{
        busy=true;
        // Reconcile the catalog before pushing local operations. This prevents
        // a stale installation from publishing an old price/menu snapshot just
        // because its revision cursor was already ahead.
        void reconcileCanonicalSnapshot(ctx.tenantId,ctx.branchId).catch(()=>0).then(productChanges=>runSyncCycle().then(result=>({result,productChanges}))).then(async ({result,productChanges})=>{
          continueSync=Boolean(result.hasMore);
          if(!disposed&&(result.pulled>0||result.pushed>0||productChanges>0))window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{...result,pulled:result.pulled+productChanges}}));
        }).finally(()=>{busy=false;if(!disposed&&continueSync){continueSync=false;sync()}});
      },350);
    };
    const channel=client.channel(`kiubo-live-${ctx.tenantId.slice(0,8)}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"sync_entities",filter:`tenant_id=eq.${ctx.tenantId}`},sync)
      .subscribe();
    const wake=()=>sync();
    const visible=()=>{if(document.visibilityState==="visible")sync()};
    const interval=window.setInterval(sync,30_000);
    sync();
    window.addEventListener("online",wake);
    window.addEventListener("focus",wake);
    window.addEventListener(KIUBO_SYNC_QUEUED_EVENT,wake);
    document.addEventListener("visibilitychange",visible);
    return()=>{
      disposed=true;
      if(timer)window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("online",wake);
      window.removeEventListener("focus",wake);
      window.removeEventListener(KIUBO_SYNC_QUEUED_EVENT,wake);
      document.removeEventListener("visibilitychange",visible);
      void client.removeChannel(channel);
    };
  },[]);
  return null;
}
