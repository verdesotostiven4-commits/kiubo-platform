"use client";
import { useEffect } from "react";
import { usePathname,useRouter } from "next/navigation";
import { getAuthProvider } from "@/lib/auth-provider";
import { getPrimaryBranch,loadLocalDatabase,saveLocalSession } from "@/lib/local-store";
import { canAccess,homeForRole,permissionForPath } from "@/lib/permissions";
import { hasFeature,routeFeature } from "@/lib/entitlements";

export function SessionEnforcer(){
  const path=usePathname();
  const router=useRouter();
  useEffect(()=>{
    let cancelled=false;
    void(async()=>{
      if(path==="/"||path.startsWith("/login")||path.startsWith("/precios")||path.startsWith("/demo")||path.startsWith("/como-funciona"))return;
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
      if(session.activeTenantId!==tenantId||session.activeBranchId!==branch?.id){saveLocalSession({...session,tenantId:user.tenantId,activeTenantId:tenantId,activeBranchId:branch?.id})}
      if(!canAccess(user.role,permission)){router.replace(homeForRole(user.role));return}
      const feature=routeFeature(path),tenant=db.tenants.find(t=>t.id===tenantId);
      if(feature&&!user.platformAdmin&&!hasFeature(tenant,feature)){router.replace(`/upgrade?feature=${feature}`)}
    })();
    return()=>{cancelled=true};
  },[path,router]);
  return null;
}
