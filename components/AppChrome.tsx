"use client";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { RealtimeSyncRuntime } from "./RealtimeSyncRuntime";
import { WorkspaceSplash } from "./WorkspaceSplash";
import { YukiPilotCatalogBootstrap } from "./YukiPilotCatalogBootstrap";
import { ProductCategoryAssist } from "./ProductCategoryAssist";
import { Sidebar } from "./Sidebar";
import { OperationalSessionGuard } from "./OperationalSessionGuard";

const chromeFreePath=(path:string)=>path==="/"||path.startsWith("/login")||path.startsWith("/set-password")||path.startsWith("/auth/")||path.startsWith("/demo")||path.startsWith("/precios")||path.startsWith("/como-funciona")||path.startsWith("/receipt")||path.startsWith("/order-print");
const persistentSidebarPath=(path:string)=>["/app","/pos","/orders","/cash","/customers","/catalog","/inventory","/purchases","/reports","/invoices","/operations","/branding","/upgrade"].some(base=>path===base||path.startsWith(`${base}/`));

export function AppChrome(){
  const path=usePathname();
  if(chromeFreePath(path))return null;
  const showPersistentSidebar=persistentSidebarPath(path);
  return <>
    <div className="window-controls-titlebar" aria-hidden="true"><span className="window-controls-mark">K</span><strong>KIUBO</strong><small>Todo tu negocio, en orden.</small></div>
    {showPersistentSidebar&&<div className="persistent-workspace-sidebar"><Sidebar/></div>}
    <OperationalSessionGuard/>
    <YukiPilotCatalogBootstrap/>
    <ProductCategoryAssist/>
    <RealtimeSyncRuntime/>
    <WorkspaceSplash/>
    <CommandPalette/>
    <MobileNav/>
  </>;
}
