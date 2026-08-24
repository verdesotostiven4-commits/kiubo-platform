import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { explainAuthEmailError,startAuthEmailCooldown } from "./auth-email";

export type TeamRole="owner"|"admin"|"cashier"|"inventory"|"viewer";
export type CloudTeamMember={
  memberId:string;
  userId:string;
  displayName:string;
  email:string;
  role:string;
  active:boolean;
  confirmed:boolean;
  allBranches:boolean;
  branchIds:string[];
  createdAt:string;
};

const KIUBO_SET_PASSWORD_URL="https://kiubo-platform.vercel.app/set-password";
function clientOrThrow(){const client=getSupabaseBrowserClient();if(!client)throw new Error("KIUBO Cloud no está configurado");return client}
function explainTeamError(message:string){
  const text=message.trim();
  const lower=text.toLowerCase();
  if(lower.includes("could not find")||lower.includes("schema cache")||lower.includes("list_tenant_team_v1"))return"El módulo Equipo Cloud todavía no está activado en la base de datos.";
  if(lower.includes("another active business"))return"Ese correo ya pertenece a otro negocio KIUBO activo.";
  if(lower.includes("role assignment denied"))return"Tu rol no puede asignar ese nivel de acceso.";
  if(lower.includes("branch"))return"Revisa las sucursales asignadas al usuario.";
  if(lower.includes("own access"))return"Por seguridad no puedes cambiar tu propio acceso desde esta pantalla.";
  if(lower.includes("team management denied"))return"Tu usuario no tiene permiso para administrar el equipo.";
  return text||"No se pudo actualizar el equipo.";
}
function branchArg(allBranches:boolean,branchIds:string[]){return allBranches?null:branchIds}

export async function listCloudTeam(tenantId:string):Promise<CloudTeamMember[]>{
  const client=clientOrThrow();
  const result=await client.rpc("list_tenant_team_v1",{p_tenant:tenantId});
  if(result.error)throw new Error(explainTeamError(result.error.message));
  const rows=Array.isArray(result.data)?result.data:[];
  return rows.map((row:any)=>({
    memberId:String(row.member_id||""),userId:String(row.user_id||""),displayName:String(row.display_name||"Usuario KIUBO"),
    email:String(row.email||""),role:String(row.role||"viewer"),active:Boolean(row.active),confirmed:Boolean(row.confirmed),
    allBranches:Boolean(row.all_branches),branchIds:Array.isArray(row.branch_ids)?row.branch_ids.map(String):[],createdAt:String(row.created_at||"")
  }));
}

export async function inviteCloudTeamMember(input:{tenantId:string;displayName:string;email:string;role:TeamRole;allBranches:boolean;branchIds:string[]}){
  const client=clientOrThrow(),email=input.email.trim().toLowerCase(),displayName=input.displayName.trim();
  const p_branch_ids=branchArg(input.allBranches,input.branchIds);
  const preflight=await client.rpc("tenant_invite_preflight_v1",{p_tenant:input.tenantId,p_email:email,p_role:input.role,p_branch_ids});
  if(preflight.error)throw new Error(explainTeamError(preflight.error.message));

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error("KIUBO Cloud no está configurado");
  const isolated=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const invite=await isolated.auth.signInWithOtp({email,options:{shouldCreateUser:true,data:{full_name:displayName},emailRedirectTo:KIUBO_SET_PASSWORD_URL}});
  if(invite.error)throw new Error(explainAuthEmailError(invite.error.message));
  startAuthEmailCooldown(email);

  const attach=await client.rpc("upsert_tenant_member_by_email_v1",{
    p_tenant:input.tenantId,p_email:email,p_display_name:displayName,p_role:input.role,p_branch_ids
  });
  if(attach.error)throw new Error(`El correo fue enviado, pero KIUBO no pudo asignar el acceso: ${explainTeamError(attach.error.message)}`);
  return{ok:true,memberId:String(attach.data||"")};
}

export async function updateCloudTeamMember(input:{tenantId:string;memberId:string;displayName:string;role:TeamRole;active:boolean;allBranches:boolean;branchIds:string[]}){
  const client=clientOrThrow();
  const result=await client.rpc("update_tenant_member_v1",{
    p_tenant:input.tenantId,p_member:input.memberId,p_display_name:input.displayName.trim(),p_role:input.role,p_active:input.active,
    p_branch_ids:branchArg(input.allBranches,input.branchIds)
  });
  if(result.error)throw new Error(explainTeamError(result.error.message));
  return{ok:true};
}
