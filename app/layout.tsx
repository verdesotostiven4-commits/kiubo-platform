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
import { PwaRegister } from "@/components/PwaRegister";
import { SessionEnforcer } from "@/components/SessionEnforcer";
import { BrandingRuntime } from "@/components/BrandingRuntime";
import { AppChrome } from "@/components/AppChrome";
import { DurabilityRuntime } from "@/components/DurabilityRuntime";
import { NativeAppGuards } from "@/components/NativeAppGuards";

const KIUBO_OFFICIAL_ICON="https://blogger.googleusercontent.com/img/a/AVvXsEhKMHanXsqFTA1HgWHkeQmCzsHpL_qqREfV7uY6U_97DnHM0Ito7RorUwZk8VY94alzkhDc4gjqWJx82xuxDo_mwHkdC_0PCL7xu2KDES5_gBMTEos4pJF8bkujdRn81sjcNZO7QNlrqTH5sX9kmCd4Wgh1XDq3XvKOE-m_ZVRBnC_pIUbG4ae7txFoLpA";

export const metadata:Metadata={
  title:"KIUBO · Todo tu negocio, en orden",
  description:"Ventas, inventario, caja, clientes, compras, reportes y facturación para negocios que quieren control sin complicarse.",
  icons:{icon:[{url:KIUBO_OFFICIAL_ICON}],apple:[{url:KIUBO_OFFICIAL_ICON}]},
  appleWebApp:{capable:true,title:"KIUBO",statusBarStyle:"black-translucent"},
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="es"><body><DurabilityRuntime/><SessionEnforcer/><BrandingRuntime/><NativeAppGuards/>{children}<AppChrome/><PwaRegister/></body></html>}
