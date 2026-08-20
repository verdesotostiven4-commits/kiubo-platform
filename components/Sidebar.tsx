"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { KiuboMark } from "./Logo";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SyncStatus } from "./SyncStatus";
import { UserRecord,clearLocalSession,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { Permission,canAccess } from "@/lib/permissions";
const items:{href:string;label:string;permission:Permission;platformOnly?:boolean}[]=[{href:"/control",label:"Control",permission:"control",platformOnly:true},{href:"/leads",label:"Prospectos",permission:"leads",platformOnly:true},{href:"/pos",label:"POS",permission:"pos"},{href:"/inventory",label:"Inventario",permission:"inventory"},{href:"/purchases",label:"Compras",permission:"purchases"},{href:"/catalog",label:"Catalog",permission:"catalog"},{href:"/customers",label:"Clientes",permission:"customers"},{href:"/invoices",label:"Factura",permission:"invoices"},{href:"/reports",label:"Reportes",permission:"reports"},{href:"/branding",label:"Marca",permission:"branding"},{href:"/operations",label:"Operación",permission:"operations"}];
const roleLabel={owner:"Propietario",admin:"Administrador",cashier:"Cajero",inventory:"Inventario",viewer:"Consulta"} as const;
export function Sidebar(){const router=useRouter();const[user,setUser]=useState<UserRecord|null>(null);useEffect(()=>{const db=loadLocalDatabase();setUser(getWorkspaceContext(db).user??null)},[]);const logout=()=>{clearLocalSession();router.replace("/login")};return <aside className="sidebar"><div className="sidebar-top"><KiuboMark/></div><WorkspaceSwitcher/><nav className="sidebar-nav">{items.filter(item=>!user||canAccess(user.role,item.permission)).filter(item=>!item.platformOnly||user?.platformAdmin).map(item=><Link key={item.href} href={item.href} className="nav-item">{item.label}</Link>)}</nav><div className="sidebar-bottom"><SyncStatus/>{user&&<div className="session-card"><strong>{user.name}</strong><span>{roleLabel[user.role]}{user.platformAdmin?" · KIUBO Admin":""}</span><button onClick={logout}>Cerrar sesión</button></div>}<div className="tiny-card"><strong>Foundation v8</strong><span>Producto · Factura · Ventas</span></div></div></aside>}
