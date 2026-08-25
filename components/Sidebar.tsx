"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { usePathname,useRouter } from "next/navigation";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SyncStatus } from "./SyncStatus";
import { BusinessBrandMark } from "./BusinessBrandMark";
import { BusinessType,TenantRecord,UserRecord,getTenantSettings,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { getAuthProvider } from "@/lib/auth-provider";
import { Permission,canAccess } from "@/lib/permissions";
import { ProductFeature,hasFeature } from "@/lib/entitlements";

type Group="platform"|"daily"|"management"|"account";
type NavItem={href:string;label:string;glyph:string;group:Group;permission:Permission;platformOnly?:boolean;feature?:ProductFeature;businessTypes?:BusinessType[]};
const groupLabel:Record<Group,string>={platform:"PLATAFORMA",daily:"DÍA A DÍA",management:"GESTIÓN",account:"NEGOCIO"};
const items:NavItem[]=[
  {href:"/control",label:"KIUBO Control",glyph:"K",group:"platform",permission:"control",platformOnly:true},
  {href:"/control/launch",label:"Preparar negocio",glyph:"＋",group:"platform",permission:"control",platformOnly:true},
  {href:"/leads",label:"Prospectos",glyph:"✦",group:"platform",permission:"leads",platformOnly:true},
  {href:"/app",label:"Inicio",glyph:"⌂",group:"daily",permission:"dashboard",feature:"dashboard"},
  {href:"/pos",label:"Ventas / POS",glyph:"$",group:"daily",permission:"pos",feature:"pos"},
  {href:"/orders",label:"Pedidos",glyph:"≡",group:"daily",permission:"pos",feature:"pos",businessTypes:["food_service"]},
  {href:"/cash",label:"Caja y fiados",glyph:"◫",group:"daily",permission:"cash",feature:"operations"},
  {href:"/customers",label:"Clientes",glyph:"◎",group:"daily",permission:"customers",feature:"customers"},
  {href:"/catalog",label:"Productos",glyph:"▦",group:"management",permission:"catalog",feature:"products"},
  {href:"/inventory",label:"Inventario",glyph:"▣",group:"management",permission:"inventory",feature:"inventory"},
  {href:"/purchases",label:"Compras",glyph:"↓",group:"management",permission:"purchases",feature:"purchases"},
  {href:"/reports",label:"Reportes",glyph:"↗",group:"management",permission:"reports",feature:"reports"},
  {href:"/invoices",label:"Factura",glyph:"◇",group:"management",permission:"invoices",feature:"invoices"},
  {href:"/operations",label:"Administración",glyph:"⚙",group:"account",permission:"operations",feature:"operations"},
  {href:"/branding",label:"Marca",glyph:"✎",group:"account",permission:"branding",feature:"branding"},
  {href:"/onboarding",label:"Configurar negocio",glyph:"✓",group:"account",permission:"onboarding",feature:"dashboard"},
  {href:"/upgrade",label:"Plan y módulos",glyph:"✧",group:"account",permission:"upgrade"}
];
const roleLabel={owner:"Propietario",admin:"Administrador",cashier:"Cajero",inventory:"Inventario",viewer:"Consulta"} as const;
export function Sidebar(){
  const router=useRouter(),pathname=usePathname(),platformPath=pathname.startsWith("/control")||pathname.startsWith("/leads");
  const[user,setUser]=useState<UserRecord|null>(null),[tenant,setTenant]=useState<TenantRecord|undefined>(),[businessType,setBusinessType]=useState<BusinessType>("general");
  useEffect(()=>{const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);setUser(ctx.user??null);setTenant(ctx.tenant);setBusinessType(getTenantSettings(db,ctx.tenantId).businessType)},[pathname]);
  const logout=async()=>{await getAuthProvider().signOut();router.replace("/login")};
  const visible=useMemo(()=>items
    .filter(item=>!user||canAccess(user.role,item.permission,Boolean(user.platformAdmin)))
    .filter(item=>!item.platformOnly||user?.platformAdmin)
    .filter(item=>!platformPath||item.group==="platform")
    .filter(item=>user?.platformAdmin||!item.feature||hasFeature(tenant,item.feature))
    .filter(item=>!item.businessTypes||item.businessTypes.includes(businessType)),[businessType,platformPath,tenant,user]);
  const groups=(["platform","daily","management","account"] as Group[]).map(group=>({group,items:visible.filter(item=>item.group===group)})).filter(section=>section.items.length);
  return <aside className="sidebar" style={{overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain"}}><div className="sidebar-top"><BusinessBrandMark/></div>{!platformPath&&<WorkspaceSwitcher/>}<nav className="sidebar-nav" aria-label="Navegación principal">{groups.map(section=><div className="nav-group" key={section.group}><div className="nav-group-label">{groupLabel[section.group]}</div>{section.items.map(item=><Link key={item.href} href={item.href} className={`nav-item ${pathname===item.href?"active":""}`}><span className="nav-glyph" aria-hidden="true">{item.glyph}</span><span className="nav-label">{item.label}</span></Link>)}</div>)}</nav><div className="sidebar-bottom">{!platformPath&&<SyncStatus/>}{user&&<div className="session-card"><strong>{user.name}</strong><span>{roleLabel[user.role]}{user.platformAdmin?" · KIUBO Admin":tenant?` · ${tenant.plan}`:""}</span><button onClick={()=>void logout()}>Cerrar sesión</button></div>}<div className="tiny-card"><strong>{platformPath?"KIUBO Plataforma":"Powered by KIUBO"}</strong><span>{platformPath?"Administración separada de los negocios":"Operación protegida y sincronizada"}</span></div></div></aside>
}
