"use client";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { RealtimeSyncRuntime } from "./RealtimeSyncRuntime";
import { WorkspaceSplash } from "./WorkspaceSplash";
import { YukiPilotCatalogBootstrap } from "./YukiPilotCatalogBootstrap";

const chromeFreePath=(path:string)=>path==="/"||path.startsWith("/login")||path.startsWith("/set-password")||path.startsWith("/auth/")||path.startsWith("/demo")||path.startsWith("/precios")||path.startsWith("/como-funciona")||path.startsWith("/receipt")||path.startsWith("/order-print");

export function AppChrome(){
  const path=usePathname();
  if(chromeFreePath(path))return null;
  return <><YukiPilotCatalogBootstrap/><RealtimeSyncRuntime/><WorkspaceSplash/><CommandPalette/><MobileNav/></>;
}
