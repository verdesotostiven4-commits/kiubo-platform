"use client";
import { useEffect,useState } from "react";
import { BranchRecord,TenantRecord,UserRecord,getWorkspaceContext,loadLocalDatabase,switchWorkspace } from "@/lib/local-store";
import { effectivePlatformAdmin } from "@/lib/client-preview";

export function WorkspaceSwitcher(){
  const[tenants,setTenants]=useState<TenantRecord[]>([]);
  const[branches,setBranches]=useState<BranchRecord[]>([]);
  const[user,setUser]=useState<UserRecord|null>(null);
  const[tenantId,setTenantId]=useState("");
  const[branchId,setBranchId]=useState("");
  useEffect(()=>{const db=loadLocalDatabase();const ctx=getWorkspaceContext(db);setUser(ctx.user??null);setTenants(db.tenants.filter(t=>t.plan!=="Internal"));setBranches(db.branches);setTenantId(ctx.tenantId);setBranchId(ctx.branchId)},[]);
  if(!user)return null;
  const platformAdmin=effectivePlatformAdmin(user.platformAdmin);
  const branchOptions=branches.filter(b=>b.tenantId===tenantId&&b.active);
  const changeTenant=(next:string)=>{if(!platformAdmin)return;const first=branches.find(b=>b.tenantId===next&&b.active);switchWorkspace(next,first?.id);window.location.reload()};
  const changeBranch=(next:string)=>{switchWorkspace(tenantId,next);window.location.reload()};
  const tenant=tenants.find(t=>t.id===tenantId);
  if(!platformAdmin)return <div className="workspace-switcher workspace-switcher-branch"><span>SUCURSAL</span><select value={branchId} onChange={e=>changeBranch(e.target.value)}>{branchOptions.map(b=><option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select></div>;
  return <div className="workspace-switcher"><span>ESPACIO ACTIVO</span><select value={tenantId} onChange={e=>changeTenant(e.target.value)}>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select value={branchId} onChange={e=>changeBranch(e.target.value)}>{branchOptions.map(b=><option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select><small>{tenant?.plan}</small></div>
}
