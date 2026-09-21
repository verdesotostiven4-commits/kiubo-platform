"use client";

import { useEffect } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { runSyncCycle } from "@/lib/sync-engine";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const KIUBO_DATA_REFRESHED="kiubo:data-refreshed";

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
        void runSyncCycle().then(result=>{
          continueSync=Boolean(result.hasMore);
          if(!disposed&&(result.pulled>0||result.pushed>0))window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:result}));
        }).finally(()=>{busy=false;if(!disposed&&continueSync){continueSync=false;sync()}});
      },350);
    };
    const channel=client.channel(`kiubo-live-${ctx.tenantId.slice(0,8)}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"sync_entities",filter:`tenant_id=eq.${ctx.tenantId}`},sync)
      .subscribe();
    const online=()=>sync();
    sync();
    window.addEventListener("online",online);
    return()=>{
      disposed=true;
      if(timer)window.clearTimeout(timer);
      window.removeEventListener("online",online);
      void client.removeChannel(channel);
    };
  },[]);
  return null;
}
