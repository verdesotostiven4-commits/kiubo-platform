"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import { usePathname,useRouter } from "next/navigation";
import { canAccess,type Permission } from "@/lib/permissions";
import { hasFeature,type ProductFeature } from "@/lib/entitlements";
import { getWorkspaceContext,loadLocalDatabase,type TenantRecord,type UserRecord } from "@/lib/local-store";

type Entry={href:string;label:string;description:string;glyph:string;permission:Permission;feature?:ProductFeature;platformOnly?:boolean;keywords:string};
const entries:Entry[]=[
  {href:"/control",label:"KIUBO Control",description:"Negocios, trials y módulos",glyph:"K",permission:"control",platformOnly:true,keywords:"control plataforma negocios trials"},
  {href:"/leads",label:"Prospectos",description:"Pipeline comercial y onboarding",glyph:"✦",permission:"leads",platformOnly:true,keywords:"prospectos leads clientes demo crm"},
  {href:"/app",label:"Inicio",description:"Resumen de tu negocio",glyph:"⌂",permission:"dashboard",feature:"dashboard",keywords:"inicio dashboard resumen"},
  {href:"/pos",label:"Nueva venta",description:"Abrir POS y cobrar",glyph:"$",permission:"pos",feature:"pos",keywords:"venta pos cobrar caja"},
  {href:"/catalog",label:"Productos",description:"Catálogo, precios y stock",glyph:"▦",permission:"catalog",feature:"products",keywords:"productos catalogo precios stock"},
  {href:"/inventory",label:"Inventario",description:"Kardex, ajustes y existencias",glyph:"▣",permission:"inventory",feature:"inventory",keywords:"inventario kardex stock ajuste"},
  {href:"/purchases",label:"Compras",description:"Proveedores y mercadería",glyph:"↓",permission:"purchases",feature:"purchases",keywords:"compras proveedores mercaderia cuentas pagar"},
  {href:"/customers",label:"Clientes",description:"Clientes, historial y fiados",glyph:"◎",permission:"customers",feature:"customers",keywords:"clientes fiados cuentas cobrar"},
  {href:"/reports",label:"Reportes",description:"Ventas y rendimiento",glyph:"↗",permission:"reports",feature:"reports",keywords:"reportes ventas utilidad rendimiento"},
  {href:"/invoices",label:"Factura",description:"Foundation de facturación electrónica",glyph:"◇",permission:"invoices",feature:"invoices",keywords:"factura sri xml ride"},
  {href:"/operations",label:"Caja y equipo",description:"Caja, usuarios y configuración",glyph:"◫",permission:"operations",feature:"operations",keywords:"caja equipo usuarios roles"},
  {href:"/branding",label:"Marca",description:"Logo, colores y branding",glyph:"✎",permission:"branding",feature:"branding",keywords:"marca branding logo colores custom"},
  {href:"/onboarding",label:"Configurar negocio",description:"Puesta en marcha guiada",glyph:"✓",permission:"onboarding",feature:"dashboard",keywords:"onboarding configurar negocio inicio"},
  {href:"/upgrade",label:"Plan y módulos",description:"Start, Pro, Custom y add-ons",glyph:"✧",permission:"upgrade",keywords:"plan modulos start pro custom upgrade"}
];
const publicPath=(path:string)=>path==="/"||path.startsWith("/login")||path.startsWith("/demo")||path.startsWith("/precios")||path.startsWith("/como-funciona");
export function CommandPalette(){
  const path=usePathname(),router=useRouter(),inputRef=useRef<HTMLInputElement>(null);
  const[open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0),[user,setUser]=useState<UserRecord|null>(null),[tenant,setTenant]=useState<TenantRecord|undefined>();
  useEffect(()=>{if(publicPath(path)){setUser(null);setTenant(undefined);return}const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);setUser(ctx.user??null);setTenant(ctx.tenant)},[path]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setOpen(value=>!value)}if(event.key==="Escape")setOpen(false)};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);
  useEffect(()=>{if(open){setQuery("");setActive(0);window.setTimeout(()=>inputRef.current?.focus(),30)}},[open]);
  const visible=useMemo(()=>{if(!user)return[];const base=entries.filter(item=>canAccess(user.role,item.permission)).filter(item=>!item.platformOnly||user.platformAdmin).filter(item=>user.platformAdmin||!item.feature||hasFeature(tenant,item.feature));const q=query.trim().toLowerCase();return q?base.filter(item=>`${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(q)):base},[query,tenant,user]);
  useEffect(()=>{if(active>=visible.length)setActive(Math.max(0,visible.length-1))},[active,visible.length]);
  if(!user||publicPath(path))return null;
  const go=(href:string)=>{setOpen(false);router.push(href)};
  const onInputKey=(event:React.KeyboardEvent<HTMLInputElement>)=>{if(event.key==="ArrowDown"){event.preventDefault();setActive(value=>Math.min(value+1,Math.max(0,visible.length-1)))}if(event.key==="ArrowUp"){event.preventDefault();setActive(value=>Math.max(0,value-1))}if(event.key==="Enter"&&visible[active]){event.preventDefault();go(visible[active].href)}};
  return <>{!open&&<button className="command-fab" onClick={()=>setOpen(true)} aria-label="Abrir búsqueda rápida"><span>⌕</span><b>Buscar</b><kbd>Ctrl K</kbd></button>}{open&&<div className="command-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Búsqueda rápida"><div className="command-search"><span>⌕</span><input ref={inputRef} value={query} onChange={event=>{setQuery(event.target.value);setActive(0)}} onKeyDown={onInputKey} placeholder="Busca una acción o módulo…"/><kbd>ESC</kbd></div><div className="command-results">{visible.length?visible.map((item,index)=><button key={item.href} className={index===active?"active":""} onMouseEnter={()=>setActive(index)} onClick={()=>go(item.href)}><span className="command-glyph">{item.glyph}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><b>↵</b></button>):<div className="command-empty"><strong>No encontramos esa acción.</strong><span>Prueba con “venta”, “stock”, “clientes” o “reportes”.</span></div>}</div><footer><span>↑↓ para moverte</span><span>Enter para abrir</span><span>KIUBO rápido, sin perderte</span></footer></section></div>}</>
}
