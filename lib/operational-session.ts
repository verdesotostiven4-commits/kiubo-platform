import { getSupabaseBrowserClient } from "./supabase-browser";

const OFFLINE_LEASE_PREFIX="kiubo.operational-lease.v1:";
const OFFLINE_LEASE_MAX_AGE_MS=12*60*60*1000;

export type OperationalSessionState={
  granted:boolean;
  bypassed?:boolean;
  conflict?:boolean;
  offline?:boolean;
  activeDeviceLabel?:string;
  claimedAt?:string;
  lastSeenAt?:string;
};

function normalize(value:unknown):OperationalSessionState{
  if(!value||typeof value!=="object")return{granted:false,conflict:true};
  const row=value as Record<string,unknown>;
  return{
    granted:Boolean(row.granted),
    bypassed:Boolean(row.bypassed)||undefined,
    conflict:Boolean(row.conflict)||undefined,
    offline:Boolean(row.offline)||undefined,
    activeDeviceLabel:typeof row.activeDeviceLabel==="string"?row.activeDeviceLabel:undefined,
    claimedAt:typeof row.claimedAt==="string"?row.claimedAt:undefined,
    lastSeenAt:typeof row.lastSeenAt==="string"?row.lastSeenAt:undefined,
  };
}

async function rpc(name:string,args:Record<string,unknown>){
  const client=getSupabaseBrowserClient();
  if(!client){
    if(args.p_tenant==="8e2d0299-5680-4eec-8c57-e37fe29086aa")throw new Error("KIUBO Cloud no está disponible para validar el dispositivo operativo.");
    return{granted:true,bypassed:true} satisfies OperationalSessionState;
  }
  const result=await client.rpc(name,args);
  if(result.error)throw new Error(result.error.message);
  return normalize(result.data);
}

function offlineLeaseKey(tenantId:string,deviceId:string){
  return `${OFFLINE_LEASE_PREFIX}${tenantId}:${deviceId}`;
}

/** Remember only that this browser successfully owned the lease recently.
 * This is not a second source of truth: it lets the same device continue an
 * already-started shift during a temporary outage. A new device still needs
 * Cloud validation before it can start operating.
 */
export function rememberOperationalLease(tenantId:string,deviceId:string){
  if(typeof window!=="undefined")window.localStorage.setItem(offlineLeaseKey(tenantId,deviceId),String(Date.now()));
}

export function hasRecentOfflineLease(tenantId:string,deviceId:string){
  if(typeof window==="undefined")return false;
  const value=Number(window.localStorage.getItem(offlineLeaseKey(tenantId,deviceId))||0);
  return Number.isFinite(value)&&value>0&&Date.now()-value<=OFFLINE_LEASE_MAX_AGE_MS;
}

export function forgetOperationalLease(tenantId:string,deviceId:string){
  if(typeof window!=="undefined")window.localStorage.removeItem(offlineLeaseKey(tenantId,deviceId));
}

export function operationalDeviceLabel(){
  if(typeof navigator==="undefined")return"Dispositivo";
  const ua=navigator.userAgent;
  if(/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1))return"iPad";
  if(/Android/i.test(ua))return"Tablet / Android";
  if(/Windows/i.test(ua))return"PC Windows";
  if(/Macintosh|Mac OS X/i.test(ua))return"Mac";
  return"Dispositivo";
}

export async function claimOperationalSession(tenantId:string,deviceId:string){
  return rpc("claim_tenant_operational_session_v2",{p_tenant:tenantId,p_device_id:deviceId,p_device_label:operationalDeviceLabel()});
}

export async function transferOperationalSession(tenantId:string,deviceId:string){
  return rpc("transfer_tenant_operational_session_v2",{p_tenant:tenantId,p_device_id:deviceId,p_device_label:operationalDeviceLabel()});
}

export async function heartbeatOperationalSession(tenantId:string,deviceId:string){
  return rpc("heartbeat_tenant_operational_session_v2",{p_tenant:tenantId,p_device_id:deviceId});
}

export async function releaseOperationalSession(tenantId:string,deviceId:string){
  return rpc("release_tenant_operational_session_v2",{p_tenant:tenantId,p_device_id:deviceId});
}
