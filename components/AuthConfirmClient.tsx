"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { KiuboMark } from "./Logo";

const allowedTypes=new Set<EmailOtpType>(["signup","invite","magiclink","recovery","email_change","email"]);
const safeNext=(value:string|null)=>value&&value.startsWith("/")&&!value.startsWith("//")?value:"/set-password";

export function AuthConfirmClient(){
  const router=useRouter();
  const[error,setError]=useState("");
  useEffect(()=>{let active=true;void(async()=>{
    const params=new URLSearchParams(window.location.search);
    const tokenHash=params.get("token_hash");
    const rawType=params.get("type") as EmailOtpType|null;
    const next=safeNext(params.get("next"));
    if(!tokenHash||!rawType||!allowedTypes.has(rawType)){if(active)setError("Este enlace no es válido. Solicita uno nuevo desde KIUBO.");return}
    const client=getSupabaseBrowserClient();
    if(!client){if(active)setError("KIUBO Cloud no está disponible en este momento.");return}
    const result=await client.auth.verifyOtp({token_hash:tokenHash,type:rawType});
    if(!active)return;
    if(result.error){setError("Este enlace venció o ya fue utilizado. Solicita uno nuevo desde KIUBO.");return}
    router.replace(next);
  })();return()=>{active=false}},[router]);
  return <main className="ref-login-shell auth-setup-shell"><section className="ref-login-brand auth-brand-panel"><KiuboMark/><div className="ref-login-copy"><span className="public-kicker">ACCESO SEGURO</span><h1>Estamos abriendo<br/><em>tu espacio KIUBO.</em></h1><p>Validamos el acceso dentro de KIUBO antes de continuar. Tu contraseña y tu negocio siguen protegidos.</p></div></section><section className="ref-login-area auth-setup-area"><div className="auth-orb auth-orb-one"/><div className="auth-orb auth-orb-two"/><div className="ref-login-card auth-setup-card"><div className="auth-card-brand"><KiuboMark/><span className="auth-secure-pill">SEGURO</span></div>{error?<><div><span className="eyebrow">ENLACE NO DISPONIBLE</span><h2>No pudimos abrir este acceso</h2><p>{error}</p></div><button className="button ref-blue-button auth-primary" type="button" onClick={()=>router.replace("/login")}>Volver al inicio</button></>:<><div><span className="eyebrow">VERIFICANDO</span><h2>Un momento…</h2><p>Estamos validando tu enlace seguro y preparando tu acceso.</p></div><div className="auth-match">✓ Verificación protegida por KIUBO</div></>}<small className="auth-footnote">KIUBO · Todo tu negocio, en orden.</small></div></section></main>;
}
