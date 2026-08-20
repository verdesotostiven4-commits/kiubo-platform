"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getTenantBranding,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
export function BrandingRuntime(){const path=usePathname();useEffect(()=>{const root=document.documentElement,corporate=path==="/"||path.startsWith("/login")||path.startsWith("/precios")||path.startsWith("/demo")||path.startsWith("/control")||path.startsWith("/leads");if(corporate){root.style.removeProperty("--coral");root.style.removeProperty("--navy");root.style.removeProperty("--orange");return}const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),brand=getTenantBranding(db,ctx.tenantId);root.style.setProperty("--coral",brand.primaryColor);root.style.setProperty("--navy",brand.secondaryColor);root.style.setProperty("--orange",brand.accentColor);return()=>{root.style.removeProperty("--coral");root.style.removeProperty("--navy");root.style.removeProperty("--orange")}},[path]);return null}
