"use client";
import { useEffect } from "react";
import { usePathname,useRouter } from "next/navigation";
import { getAuthProvider } from "@/lib/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getPrimaryBranch,loadLocalDatabase,loadLocalSession,saveLocalSession } from "@/lib/local-store";
import { canAccess,homeForRole,permissionForPath } from "@/lib/permissions";
import { hasFeature,routeFeature } from "@/lib/entitlements";

const isPublicPath=(path:string)=>path==="/"||path.startsWith("/login")||path.startsWith("/set-password")||path.startsWith("/auth/")||path.startsWith("/precios")||path.startsWith("/demo")||path.startsWith("/como-funciona");

export function SessionEnforcer(){
  const path=usePathname();
  const router=useRouter();
  useEffect(()=>{
    let cancelled=false;
    if(isPublicPath(path))return;

    const enforce=async()=>{
      const permission=permissionForPath(path);
      if(!permission)return;
      const auth=getAuthProvider();
      const session=await auth.getSession();
      if(cancelled)return;
      if(!session){router.replace("/login");return}
      const validation=await auth.validateSession(session);
      if(cancelled)return;
      const user=validation.user;
      if(!validation.ok||!user){await auth.signOut();router.replace("/login");return}
      const db=loadLocalDatabase();
      if((path.startsWith("/control")||path.startsWith("/leads"))&&!user.platformAdmin){router.replace(homeForRole(user.role));return}
      let tenantId=user.platformAdmin?(session.activeTenantId||user.tenantId):user.tenantId;
      if(!db.tenants.some(t=>t.id===tenantId&&t.plan!=="Internal"))tenantId=user.tenantId;
      const branch=db.branches.find(b=>b.id===session.activeBranchId&&b.tenantId===tenantId&&b.active)??getPrimaryBranch(db,tenantId);
      if(session.activeTenantId!==tenantId||session.activeBranchId!==branch?.id||session.role!==user.role){saveLocalSession({...session,tenantId:user.tenantId,activeTenantId:tenantId,activeBranchId:branch?.id,role:user.role})}
      if(!canAccess(user.role,permission,Boolean(user.platformAdmin))){router.replace(homeForRole(user.role));return}
      const feature=routeFeature(path),tenant=db.tenants.find(t=>t.id===tenantId);
      if(feature&&!user.platformAdmin&&!hasFeature(tenant,feature)){router.replace(`/upgrade?feature=${feature}`)}
    };

    void enforce();

    const auth=getAuthProvider();
    if(auth.mode!=="supabase")return()=>{cancelled=true};
    const client=getSupabaseBrowserClient();
    if(!client)return()=>{cancelled=true};

    const reconcile=async()=>{
      const before=loadLocalSession()?.userId??"";
      const cloud=await client.auth.getSession();
      if(cancelled)return;
      const current=cloud.data.session?.user?.id??"";
      await enforce();
      if(cancelled)return;
      if(before&&current&&before!==current)window.location.reload();
    };

    const {data:{subscription}}=client.auth.onAuthStateChange(()=>{
      window.setTimeout(()=>{if(!cancelled)void reconcile()},0);
    });
    const onStorage=(event:StorageEvent)=>{
      if(event.key?.startsWith("sb-"))void reconcile();
    };
    window.addEventListener("storage",onStorage);
    return()=>{cancelled=true;subscription.unsubscribe();window.removeEventListener("storage",onStorage)};
  },[path,router]);
  return null;
}
