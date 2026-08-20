import { clearLocalSession, getPrimaryBranch, loadLocalDatabase, loadLocalSession, saveLocalSession, type LocalSession, type UserRecord } from "./local-store";

export type AuthMode = "local" | "supabase";
export type SignInInput = { email:string; pin?:string; password?:string };
export type SignInResult = { ok:boolean; user?:UserRecord; session?:LocalSession; error?:string };

export type KiuboAuthProvider = {
  mode: AuthMode;
  configured: boolean;
  signIn(input:SignInInput): Promise<SignInResult>;
  signOut(): Promise<void>;
  getSession(): Promise<LocalSession|null>;
  validateSession(session:LocalSession): Promise<{ok:boolean;user?:UserRecord}>;
};

const localAuthProvider:KiuboAuthProvider={
  mode:"local",
  configured:true,
  async signIn(input){
    const email=input.email.trim().toLowerCase(),pin=String(input.pin||"").trim(),db=loadLocalDatabase();
    const user=db.users.find(item=>item.active&&item.email.toLowerCase()===email&&item.pin===pin);
    if(!user)return{ok:false,error:"Usuario, PIN o estado incorrecto"};
    const branch=getPrimaryBranch(db,user.tenantId);
    const session:LocalSession={userId:user.id,tenantId:user.tenantId,activeTenantId:user.tenantId,activeBranchId:branch?.id,role:user.role,startedAt:new Date().toISOString()};
    saveLocalSession(session);
    return{ok:true,user,session};
  },
  async signOut(){clearLocalSession()},
  async getSession(){return loadLocalSession()},
  async validateSession(session){const db=loadLocalDatabase(),user=db.users.find(item=>item.id===session.userId&&item.active);return{ok:Boolean(user),user}}
};

/**
 * Punto de sustitución de autenticación. Cuando exista el proyecto cloud,
 * este contrato se implementará con Supabase Auth y el PIN local dejará de
 * ser una credencial de seguridad.
 */
export function getAuthProvider():KiuboAuthProvider{return localAuthProvider}
