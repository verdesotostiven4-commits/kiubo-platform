import type { Metadata } from "next";
import "./globals.css";
import "./operations.css";
import "./inventory.css";
import "./workspace.css";
import "./security.css";
import "./commerce.css";
import "./sri.css";
import "./marketing.css";
import "./sales.css";
import "./product.css";
import "./premium.css";
import "./command.css";
import "./reference.css";
import "./control-reference.css";
import "./onboarding-reference.css";
import "./brand-reference.css";
import "./login-reference.css";
import "./reference-fixes.css";
import "./brand-refresh.css";
import "./delivery-polish.css";
import "./pos-native.css";
import "./native-shell-v3.css";
import "./product-media-v4.css";
import "./restaurant-ops-v5.css";
import "./yuki-live-polish.css";
import "./experience-v6.css";
import "./experience-v7.css";
import "./experience-v8.css";
import "./product-options-v9.css";
import "./experience-v10.css";
import "./experience-v11.css";
import "./experience-v12.css";
import "./experience-v13.css";
import "./experience-v14.css";
import "./experience-v15.css";
import { PwaRegister } from "@/components/PwaRegister";
import { SessionEnforcer } from "@/components/SessionEnforcer";
import { BrandingRuntime } from "@/components/BrandingRuntime";
import { AppChrome } from "@/components/AppChrome";
import { DurabilityRuntime } from "@/components/DurabilityRuntime";
import { NativeAppGuards } from "@/components/NativeAppGuards";
import { FullscreenRuntime } from "@/components/FullscreenRuntime";
import { KIUBO_ICON_URL } from "@/lib/kiubo-brand-assets";

export const metadata:Metadata={
  title:"KIUBO · Todo tu negocio, en orden",
  description:"Ventas, inventario, caja, clientes, compras, reportes y facturación para negocios que quieren control sin complicarse.",
  icons:{icon:[{url:KIUBO_ICON_URL}],apple:[{url:KIUBO_ICON_URL}]},
  appleWebApp:{capable:true,title:"KIUBO",statusBarStyle:"black-translucent"},
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="es"><body><DurabilityRuntime/><SessionEnforcer/><BrandingRuntime/><NativeAppGuards/><FullscreenRuntime/>{children}<AppChrome/><PwaRegister/></body></html>}
