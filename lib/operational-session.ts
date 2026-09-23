import { getSupabaseBrowserClient } from "./supabase-browser";

export type OperationalSessionState={
  granted:boolean;
  bypassed?:boolean;
  conflict?:boolean;
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
    activeDeviceLabel:typeof row.activeDeviceLabel==="string"?row.activeDeviceLabel:undefined,
    claimedAt:typeof row.claimedAt==="string"?row.claimedAt:undefined,
    lastSeenAt:typeof row.lastSeenAt==="string"?row.lastSeenAt:undefined,
  };
}

async function rpc(name:string,args:Record<string,unknown>){
  const client=getSupabaseBrowserClient();
  if(!client)return{granted:true,bypassed:true} satisfies OperationalSessionState;
  const result=await client.rpc(name,args);
  if(result.error)throw new Error(result.error.message);
  return normalize(result.data);
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
  return rpc("claim_operational_session_v1",{p_tenant:tenantId,p_device_id:deviceId,p_device_label:operationalDeviceLabel()});
}

export async function transferOperationalSession(tenantId:string,deviceId:string){
  return rpc("transfer_operational_session_v1",{p_tenant:tenantId,p_device_id:deviceId,p_device_label:operationalDeviceLabel()});
}

export async function heartbeatOperationalSession(tenantId:string,deviceId:string){
  return rpc("heartbeat_operational_session_v1",{p_tenant:tenantId,p_device_id:deviceId});
}

export async function releaseOperationalSession(tenantId:string,deviceId:string){
  return rpc("release_operational_session_v1",{p_tenant:tenantId,p_device_id:deviceId});
}
