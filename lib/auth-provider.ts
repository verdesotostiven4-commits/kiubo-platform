import { clearLocalSession, getPrimaryBranch, loadLocalDatabase, loadLocalSession, saveLocalSession, type LocalSession, type UserRecord } from "./local-store";
import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";
import { hydrateCloudIdentity } from "./cloud-auth";
import { runSyncCycle } from "./sync-engine";

export type AuthMode = "local" | "supabase";
export type SignInInput = { email:string; pin?:string; password?:string };
export type SignInResult = { ok:boolean; user?:UserRecord; session?:LocalSession; error?:string };

export type KiuboAuthProvider = {mode:AuthMode;configured:boolean;signIn(input:SignInInput):Promise<SignInResult>;signOut():Promise<void>;getSession():Promise<LocalSession|null>;validateSession(session:LocalSession):Promise<{ok:boolean;user?:UserRecord}>};

const localAuthProvider:KiuboAuthProvider={
  mode:"local",configured:true,
  async signIn(input){const email=input.email.trim().toLowerCase(),pin=String(input.pin||"").trim(),db=loadLocalDatabase();const user=db.users.find(item=>item.active&&item.email.toLowerCase()===email&&item.pin===pin);if(!user)return{ok:false,error:"Usuario, PIN o estado incorrecto"};const branch=getPrimaryBranch(db,user.tenantId);const session:LocalSession={userId:user.id,tenantId:user.tenantId,activeTenantId:user.tenantId,activeBranchId:branch?.id,role:user.role,startedAt:new Date().toISOString()};saveLocalSession(session);return{ok:true,user,session}},
  async signOut(){clearLocalSession()},
  async getSession(){return loadLocalSession()},
  async validateSession(session){const db=loadLocalDatabase(),user=db.users.find(item=>item.id===session.userId&&item.active);return{ok:Boolean(user),user}}
};

const cloudAuthProvider:KiuboAuthProvider={
  mode:"supabase",configured:isSupabaseConfigured(),
  async signIn(input){
    const client=getSupabaseBrowserClient();if(!client)return{ok:false,error:"Cloud KIUBO todavía no está configurado"};
    const password=String(input.password||"");if(!password)return{ok:false,error:"Ingresa tu contraseña"};
    const result=await client.auth.signInWithPassword({email:input.email.trim().toLowerCase(),password});
    if(result.error||!result.data.user)return{ok:false,error:result.error?.message||"No se pudo iniciar sesión"};
    try{const identity=await hydrateCloudIdentity(client,result.data.user);if(!identity.user.platformAdmin)await runSyncCycle().catch(()=>undefined);return{ok:true,...identity}}catch(error){await client.auth.signOut();clearLocalSession();return{ok:false,error:error instanceof Error?error.message:"No se pudo preparar tu espacio KIUBO"}}
  },
  async signOut(){const client=getSupabaseBrowserClient();if(client)await client.auth.signOut();clearLocalSession()},
  async getSession(){const client=getSupabaseBrowserClient();if(!client)return null;const result=await client.auth.getSession();const user=result.data.session?.user;if(!user)return null;try{return(await hydrateCloudIdentity(client,user)).session}catch{return null}},
  async validateSession(){const client=getSupabaseBrowserClient();if(!client)return{ok:false};const result=await client.auth.getUser();if(result.error||!result.data.user)return{ok:false};try{return{ok:true,user:(await hydrateCloudIdentity(client,result.data.user)).user}}catch{return{ok:false}}}
};

export function getAuthProvider():KiuboAuthProvider{return process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"?cloudAuthProvider:localAuthProvider}
