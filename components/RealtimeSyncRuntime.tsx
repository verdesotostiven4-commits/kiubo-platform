"use client";

import { useEffect } from "react";
import { KIUBO_SYNC_QUEUED_EVENT,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type TenantProduct } from "@/lib/local-store";
import { runSyncCycle } from "@/lib/sync-engine";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const KIUBO_DATA_REFRESHED="kiubo:data-refreshed";

function pendingProductIds(tenantId:string){
  const ids=new Set<string>();
  for(const item of loadLocalDatabase().syncQueue){
    if(item.tenantId!==tenantId||item.status==="synced")continue;
    if(item.entityType==="tenantProducts"){ids.add(item.entityId);continue}
    const payload=item.payload&&typeof item.payload==="object"?item.payload as Record<string,unknown>:{};
    const add=(value:unknown)=>{if(typeof value==="string"&&value)ids.add(value)};
    add(payload.productId);
    for(const key of ["stockMovements","productSnapshots","productAfterSnapshots"]){
      const rows=Array.isArray(payload[key])?payload[key] as Record<string,unknown>[]:[];
      for(const row of rows)add(row.productId||row.id);
    }
    add((payload.productAfter as Record<string,unknown>|undefined)?.id);
    add((payload.productBefore as Record<string,unknown>|undefined)?.id);
  }
  return ids;
}

function isSyntheticYukiProductId(id:string){
  return id==="yuki-service-packaging"||/^yuki-menu-[a-z0-9-]+$/i.test(id);
}

async function reconcileProductSnapshot(tenantId:string,branchId:string){
  const client=getSupabaseBrowserClient();
  if(!client)return 0;
  // Read the complete canonical product snapshot, including tombstones. The
  // revision cursor is intentionally not used here: an old device can have a
  // cursor ahead of the changes it missed, so it still needs a full product
  // reconciliation when it returns to the business.
  const result=await client.from("sync_entities").select("entity_id,branch_id,payload,deleted").eq("tenant_id",tenantId).eq("entity_type","tenantProducts");
  if(result.error||!Array.isArray(result.data))return 0;
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
  const protectedIds=pendingProductIds(tenantId);
  const remoteIds=new Set<string>();
  let changed=0;
  for(const row of result.data as Array<{entity_id?:string;branch_id?:string;payload?:unknown;deleted?:boolean}>){
    const id=String(row.entity_id||"");
    if(!id||row.branch_id!==branchId)continue;
    if(row.deleted){
      if(!protectedIds.has(id)){
        const before=next.tenantProducts.length;
        next.tenantProducts=next.tenantProducts.filter(product=>!(product.id===id&&product.tenantId===tenantId&&product.branchId===branchId));
        if(next.tenantProducts.length!==before)changed++;
      }
      continue;
    }
    remoteIds.add(id);
    const payload=row.payload&&typeof row.payload==="object"?row.payload as TenantProduct:null;
    if(!payload||protectedIds.has(id))continue;
    const index=next.tenantProducts.findIndex(product=>product.id===id&&product.tenantId===tenantId&&product.branchId===branchId);
    if(index<0){next.tenantProducts.push(payload);changed++;continue}
    if(JSON.stringify(next.tenantProducts[index])!==JSON.stringify(payload)){next.tenantProducts[index]=payload;changed++}
  }
  // A product removed or archived in Cloud must not remain sellable on a
  // stale installation. Preserve any product with a pending local operation
  // until that operation is resolved.
  const before=next.tenantProducts.length;
  next.tenantProducts=next.tenantProducts.filter(product=>{
    if(product.tenantId!==tenantId||product.branchId!==branchId||protectedIds.has(product.id))return true;
    return remoteIds.has(product.id);
  });
  if(next.tenantProducts.length!==before)changed++;
  if(!changed&&!queueChanged)return 0;
  // A second queue check closes the race where a local sale/adjustment is
  // created while the read-only Cloud snapshot is in flight.
  if(pendingProductIds(tenantId).size>0){
    if(queueChanged)saveLocalDatabase(next,{trackChanges:false});
    return 0;
  }
  saveLocalDatabase(next,{trackChanges:false});
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
        void reconcileProductSnapshot(ctx.tenantId,ctx.branchId).catch(()=>0).then(productChanges=>runSyncCycle().then(result=>({result,productChanges}))).then(async ({result,productChanges})=>{
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
