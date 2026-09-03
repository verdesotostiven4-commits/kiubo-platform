const PREFIX="kiubo.admin.authorization.configured.v1";

export function adminAuthorizationKey(tenantId:string,userId:string){return`${PREFIX}:${tenantId}:${userId}`}

export function adminAuthorizationConfigured(tenantId:string,userId?:string){
  if(typeof window==="undefined"||!tenantId||!userId)return false;
  return window.localStorage.getItem(adminAuthorizationKey(tenantId,userId))==="1";
}

export function markAdminAuthorizationConfigured(tenantId:string,userId:string){
  if(typeof window==="undefined"||!tenantId||!userId)return;
  window.localStorage.setItem(adminAuthorizationKey(tenantId,userId),"1");
}
