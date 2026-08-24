"use client";

import { FormEvent,useEffect,useMemo,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase,type BranchRecord,type UserRole } from "@/lib/local-store";
import { inviteCloudTeamMember,listCloudTeam,updateCloudTeamMember,type CloudTeamMember,type TeamRole } from "@/lib/team-cloud";

const roleLabel:Record<string,string>={owner:"Propietario",admin:"Administrador",cashier:"Cajero",inventory:"Inventario",viewer:"Consulta",accounting:"Contabilidad"};
const roleOptions:TeamRole[]=["owner","admin","cashier","inventory","viewer"];

function ScopePicker({branches,allBranches,branchIds,onAll,onToggle,disabled}:{branches:BranchRecord[];allBranches:boolean;branchIds:string[];onAll:(value:boolean)=>void;onToggle:(id:string)=>void;disabled?:boolean}){
  return <div style={{display:"grid",gap:8}}>
    <label className="switch-row"><input type="checkbox" checked={allBranches} onChange={e=>onAll(e.target.checked)} disabled={disabled}/>Todas las sucursales disponibles</label>
    {!allBranches&&<div style={{display:"grid",gap:6,paddingLeft:8}}>{branches.map(branch=><label key={branch.id} className="switch-row"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={()=>onToggle(branch.id)} disabled={disabled}/>{branch.code} · {branch.name}</label>)}</div>}
  </div>;
}

function MemberEditor({member,branches,managerRole,currentUserId,onSaved}:{member:CloudTeamMember;branches:BranchRecord[];managerRole:UserRole;currentUserId:string;onSaved:()=>Promise<void>}){
  const[name,setName]=useState(member.displayName),[role,setRole]=useState<TeamRole>((roleOptions.includes(member.role as TeamRole)?member.role:"viewer") as TeamRole);
  const[active,setActive]=useState(member.active),[allBranches,setAllBranches]=useState(member.allBranches),[branchIds,setBranchIds]=useState<string[]>(member.branchIds);
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const self=member.userId===currentUserId;
  const protectedFromAdmin=managerRole==="admin"&&(member.role==="owner"||member.role==="admin");
  const editable=!self&&!protectedFromAdmin;
  const allowedRoles=managerRole==="owner"?roleOptions:roleOptions.filter(value=>value!=="owner"&&value!=="admin");
  const toggleBranch=(id:string)=>setBranchIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const save=async()=>{
    if(!editable||busy)return;
    if(!name.trim()){setMessage("Escribe el nombre del usuario");return}
    if(!allBranches&&!branchIds.length&&active){setMessage("Selecciona una sucursal o activa Todas las sucursales");return}
    setBusy(true);setMessage("");
    try{
      await updateCloudTeamMember({tenantId:branches[0]?.tenantId||"",memberId:member.memberId,displayName:name,role,active,allBranches,branchIds});
      setMessage("Acceso actualizado");await onSaved();
    }catch(error){setMessage(error instanceof Error?error.message:"No se pudo actualizar")}
    finally{setBusy(false)}
  };
  return <div className="panel" style={{padding:16,display:"grid",gap:12}}>
    <div className="panel-head"><div><strong>{member.displayName}</strong><div style={{fontSize:13,opacity:.72}}>{member.email||"Correo no disponible"}</div></div><span className="pill">{member.active?(member.confirmed?"Activo":"Invitación pendiente"):"Desactivado"}</span></div>
    <div className="settings-grid">
      <label>Nombre<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} disabled={!editable||busy}/></label>
      <label>Rol<select value={role} onChange={e=>setRole(e.target.value as TeamRole)} disabled={!editable||busy}>{allowedRoles.includes(role)?null:<option value={role}>{roleLabel[role]||role}</option>}{allowedRoles.map(value=><option key={value} value={value}>{roleLabel[value]}</option>)}</select></label>
      <label className="switch-row"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} disabled={!editable||busy}/>Acceso activo</label>
    </div>
    <ScopePicker branches={branches} allBranches={allBranches} branchIds={branchIds} onAll={setAllBranches} onToggle={toggleBranch} disabled={!editable||busy||!active}/>
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button className="button primary" type="button" onClick={()=>void save()} disabled={!editable||busy}>{busy?"Guardando…":"Guardar acceso"}</button>{self&&<small>Tu propio acceso se protege para evitar que te bloquees accidentalmente.</small>}{protectedFromAdmin&&<small>Solo un propietario puede modificar propietarios o administradores.</small>}{message&&<small>{message}</small>}</div>
  </div>;
}

export function TeamAdminClient(){
  const[ready,setReady]=useState(false),[members,setMembers]=useState<CloudTeamMember[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const[name,setName]=useState(""),[email,setEmail]=useState(""),[role,setRole]=useState<TeamRole>("cashier"),[allBranches,setAllBranches]=useState(true),[branchIds,setBranchIds]=useState<string[]>([]);
  const db=useMemo(()=>ready?loadLocalDatabase():null,[ready,members.length]);
  const ctx=db?getWorkspaceContext(db):null;
  const branches=ctx?.branches||[];
  const managerRole=ctx?.user?.role||"viewer",currentUserId=ctx?.user?.id||"";
  const load=async()=>{
    const local=loadLocalDatabase(),workspace=getWorkspaceContext(local);
    if(!workspace.tenantId){setMessage("No hay un negocio activo");return}
    try{setMembers(await listCloudTeam(workspace.tenantId));setMessage("")}catch(error){setMessage(error instanceof Error?error.message:"No se pudo cargar el equipo")}
  };
  useEffect(()=>{setReady(true);void load()},[]);
  const toggleBranch=(id:string)=>setBranchIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const invite=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy||!ctx)return;
    if(!name.trim()||!email.trim()){setMessage("Completa nombre y correo");return}
    if(!allBranches&&!branchIds.length){setMessage("Selecciona al menos una sucursal");return}
    setBusy(true);setMessage("");
    try{
      await inviteCloudTeamMember({tenantId:ctx.tenantId,displayName:name,email,role,allBranches,branchIds});
      setName("");setEmail("");setRole("cashier");setAllBranches(true);setBranchIds([]);
      setMessage("Invitación enviada y permisos asignados");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"No se pudo invitar al usuario")}
    finally{setBusy(false)}
  };
  if(!ready||!ctx)return <div className="loading-card">Preparando equipo…</div>;
  const inviteRoles=managerRole==="owner"?roleOptions:roleOptions.filter(value=>value!=="owner"&&value!=="admin");
  return <section style={{display:"grid",gap:16,marginTop:18}}>
    <header className="topbar"><div><span className="eyebrow">EQUIPO CLOUD</span><h2>Usuarios, roles y sucursales</h2><p>Invita personas reales por correo y define exactamente qué pueden hacer y en qué sucursales.</p></div></header>
    <form className="panel ops-settings" onSubmit={invite}>
      <div className="panel-head"><div><span className="eyebrow">NUEVO ACCESO</span><h3>Invitar al equipo</h3></div><span className="pill">Supabase Auth</span></div>
      <div className="settings-grid">
        <label>Nombre<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="Ej. Ana Caja" required/></label>
        <label>Correo<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoCapitalize="off" autoCorrect="off" placeholder="ana@negocio.com" required/></label>
        <label>Rol<select value={role} onChange={e=>setRole(e.target.value as TeamRole)}>{inviteRoles.map(value=><option key={value} value={value}>{roleLabel[value]}</option>)}</select></label>
      </div>
      <ScopePicker branches={branches} allBranches={allBranches} branchIds={branchIds} onAll={setAllBranches} onToggle={toggleBranch}/>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button className="button primary" type="submit" disabled={busy}>{busy?"Enviando invitación…":"Invitar usuario"}</button><small>El usuario recibe un enlace de activación y crea su propia contraseña.</small></div>
    </form>
    {message&&<div className="panel" style={{padding:14}}>{message}</div>}
    <div style={{display:"grid",gap:12}}>{members.length?members.map(member=><MemberEditor key={member.memberId} member={member} branches={branches} managerRole={managerRole} currentUserId={currentUserId} onSaved={load}/>):<div className="panel" style={{padding:18}}>Todavía no hay usuarios visibles en este negocio.</div>}</div>
  </section>;
}
