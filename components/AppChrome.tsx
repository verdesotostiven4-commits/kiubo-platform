"use client";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { RealtimeSyncRuntime } from "./RealtimeSyncRuntime";
import { WorkspaceSplash } from "./WorkspaceSplash";
import { YukiPilotCatalogBootstrap } from "./YukiPilotCatalogBootstrap";
import { Sidebar } from "./Sidebar";

const chromeFreePath=(path:string)=>path==="/"||path.startsWith("/login")||path.startsWith("/set-password")||path.startsWith("/auth/")||path.startsWith("/demo")||path.startsWith("/precios")||path.startsWith("/como-funciona")||path.startsWith("/receipt")||path.startsWith("/order-print");
const persistentSidebarPath=(path:string)=>["/app","/orders","/cash","/customers","/catalog","/inventory","/purchases","/reports","/invoices","/operations","/branding","/upgrade"].some(base=>path===base||path.startsWith(`${base}/`));

export function AppChrome(){
  const path=usePathname();
  if(chromeFreePath(path))return null;
  const showPersistentSidebar=persistentSidebarPath(path);
  return <>
    {showPersistentSidebar&&<div className="persistent-workspace-sidebar" aria-hidden="false"><Sidebar/></div>}
    <YukiPilotCatalogBootstrap/>
    <RealtimeSyncRuntime/>
    <WorkspaceSplash/>
    <CommandPalette/>
    <MobileNav/>
  </>;
}
