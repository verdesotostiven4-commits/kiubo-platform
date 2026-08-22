"use client";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";

const chromeFreePath=(path:string)=>path==="/"||path.startsWith("/login")||path.startsWith("/set-password")||path.startsWith("/auth/")||path.startsWith("/demo")||path.startsWith("/precios")||path.startsWith("/como-funciona");

export function AppChrome(){
  const path=usePathname();
  if(chromeFreePath(path))return null;
  return <><CommandPalette/><MobileNav/></>;
}
