"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { getWorkspaceContext,loadLocalDatabase,type TenantRecord,type UserRecord } from "@/lib/local-store";
import { canAccess,type Permission } from "@/lib/permissions";
import { hasFeature,type ProductFeature } from "@/lib/entitlements";

type Item={href:string;label:string;glyph:string;permission:Permission;feature?:ProductFeature;platformOnly?:boolean};
const candidates:Item[]=[
  {href:"/control",label:"Control",glyph:"K",permission:"control",platformOnly:true},
  {href:"/app",label:"Inicio",glyph:"⌂",permission:"dashboard",feature:"dashboard"},
  {href:"/pos",label:"Venta",glyph:"$",permission:"pos",feature:"pos"},
  {href:"/inventory",label:"Stock",glyph:"□",permission:"inventory",feature:"inventory"},
  {href:"/customers",label:"Clientes",glyph:"○",permission:"customers",feature:"customers"},
  {href:"/reports",label:"Reportes",glyph:"↗",permission:"reports",feature:"reports"},
  {href:"/operations",label:"Más",glyph:"•••",permission:"operations",feature:"operations"}
];
export function MobileNav(){
  const path=usePathname(),platformPath=path.startsWith("/control")||path.startsWith("/leads");const[user,setUser]=useState<UserRecord|null>(null),[tenant,setTenant]=useState<TenantRecord|undefined>();
  useEffect(()=>{const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);setUser(ctx.user??null);setTenant(ctx.tenant)},[path]);
  if(!user||path==="/"||path.startsWith("/login")||path.startsWith("/set-password")||path.startsWith("/auth/")||path.startsWith("/demo")||path.startsWith("/precios")||path.startsWith("/como-funciona"))return null;
  const visible=candidates.filter(item=>canAccess(user.role,item.permission,Boolean(user.platformAdmin))).filter(item=>platformPath?item.platformOnly:(!item.platformOnly||user.platformAdmin)).filter(item=>user.platformAdmin||!item.feature||hasFeature(tenant,item.feature)).slice(0,5);
  return <nav className="mobile-nav" aria-label="Navegación móvil">{visible.map(item=><Link key={item.href} href={item.href} className={path===item.href?"active":""}><b>{item.glyph}</b><span>{item.label}</span></Link>)}</nav>
}
