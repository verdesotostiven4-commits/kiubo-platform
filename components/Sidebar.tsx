"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { usePathname,useRouter } from "next/navigation";
import { KiuboMark } from "./Logo";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SyncStatus } from "./SyncStatus";
import { TenantRecord,UserRecord,clearLocalSession,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { Permission,canAccess } from "@/lib/permissions";
import { ProductFeature,hasFeature } from "@/lib/entitlements";

type NavItem={href:string;label:string;permission:Permission;platformOnly?:boolean;feature?:ProductFeature};
const items:NavItem[]=[
  {href:"/control",label:"KIUBO Control",permission:"control",platformOnly:true},
  {href:"/leads",label:"Prospectos",permission:"leads",platformOnly:true},
  {href:"/app",label:"Inicio",permission:"dashboard",feature:"dashboard"},
  {href:"/onboarding",label:"Configurar negocio",permission:"onboarding",feature:"dashboard"},
  {href:"/pos",label:"Ventas / POS",permission:"pos",feature:"pos"},
  {href:"/catalog",label:"Productos",permission:"catalog",feature:"products"},
  {href:"/inventory",label:"Inventario",permission:"inventory",feature:"inventory"},
  {href:"/purchases",label:"Compras",permission:"purchases",feature:"purchases"},
  {href:"/customers",label:"Clientes",permission:"customers",feature:"customers"},
  {href:"/invoices",label:"Factura",permission:"invoices",feature:"invoices"},
  {href:"/reports",label:"Reportes",permission:"reports",feature:"reports"},
  {href:"/branding",label:"Marca",permission:"branding",feature:"branding"},
  {href:"/operations",label:"Caja y equipo",permission:"operations",feature:"operations"},
  {href:"/upgrade",label:"Plan y módulos",permission:"upgrade"}
];
const roleLabel={owner:"Propietario",admin:"Administrador",cashier:"Cajero",inventory:"Inventario",viewer:"Consulta"} as const;
export function Sidebar(){
  const router=useRouter(),pathname=usePathname();
  const[user,setUser]=useState<UserRecord|null>(null),[tenant,setTenant]=useState<TenantRecord|undefined>();
  useEffect(()=>{const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);setUser(ctx.user??null);setTenant(ctx.tenant)},[]);
  const logout=()=>{clearLocalSession();router.replace("/login")};
  const visible=items.filter(item=>!user||canAccess(user.role,item.permission)).filter(item=>!item.platformOnly||user?.platformAdmin).filter(item=>user?.platformAdmin||!item.feature||hasFeature(tenant,item.feature));
  return <aside className="sidebar"><div className="sidebar-top"><KiuboMark/></div><WorkspaceSwitcher/><nav className="sidebar-nav">{visible.map(item=><Link key={item.href} href={item.href} className={`nav-item ${pathname===item.href?"active":""}`}>{item.label}</Link>)}</nav><div className="sidebar-bottom"><SyncStatus/>{user&&<div className="session-card"><strong>{user.name}</strong><span>{roleLabel[user.role]}{user.platformAdmin?" · KIUBO Admin":tenant?` · ${tenant.plan}`:""}</span><button onClick={logout}>Cerrar sesión</button></div>}<div className="tiny-card"><strong>KIUBO Preview</strong><span>Foundation cloud-ready</span></div></div></aside>
}
