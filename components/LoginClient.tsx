"use client";
import { FormEvent,useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { KiuboMark } from "./Logo";
import { getAuthProvider } from "@/lib/auth-provider";
import { homeForRole } from "@/lib/permissions";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { explainAuthEmailError,getAuthEmailCooldownSeconds,startAuthEmailCooldown } from "@/lib/auth-email";

const KIUBO_SET_PASSWORD_URL="https://kiubo-platform.vercel.app/set-password";

export function LoginClient(){
  const router=useRouter();
  const[error,setError]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[email,setEmail]=useState("");
  const[cooldown,setCooldown]=useState(0);
  const[showPassword,setShowPassword]=useState(false);
  const cloud=process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase";

  useEffect(()=>{
    if(!cloud){setCooldown(0);return}
    const update=()=>setCooldown(getAuthEmailCooldownSeconds(email));
    update();
    const timer=window.setInterval(update,1000);
    return()=>window.clearInterval(timer);
  },[cloud,email]);

  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setBusy(true);setError("");setMessage("");
    const f=new FormData(e.currentTarget),loginEmail=String(f.get("email")||"").trim();
    const result=await getAuthProvider().signIn(cloud?{email:loginEmail,password:String(f.get("password")||"")}:{email:loginEmail,pin:String(f.get("pin")||"")});
    setBusy(false);
    if(!result.ok||!result.user){setError(result.error||"No se pudo iniciar sesión");return}
    router.replace(result.user.platformAdmin?"/control":homeForRole(result.user.role));
  };

  const resendAccess=async()=>{
    const normalized=email.trim().toLowerCase();
    if(!normalized){setError("Escribe primero el correo de tu cuenta KIUBO.");return}
    const remaining=getAuthEmailCooldownSeconds(normalized);
    if(remaining>0){setCooldown(remaining);setError(`Espera ${remaining} s antes de pedir otro enlace.`);return}
    setBusy(true);setError("");setMessage("");
    try{
      const client=getSupabaseBrowserClient();
      if(!client)throw new Error("KIUBO Cloud no está configurado");
      const result=await client.auth.signInWithOtp({email:normalized,options:{shouldCreateUser:false,emailRedirectTo:KIUBO_SET_PASSWORD_URL}});
      if(result.error)throw result.error;
      startAuthEmailCooldown(normalized);
      setCooldown(getAuthEmailCooldownSeconds(normalized));
      setMessage("Listo. Te enviamos un enlace seguro para activar o recuperar tu acceso.");
    }catch(err){
      const raw=err instanceof Error?err.message:"No se pudo enviar el enlace";
      const friendly=explainAuthEmailError(raw);
      if(raw.toLowerCase().includes("rate limit")||raw.toLowerCase().includes("only request this after")){
        startAuthEmailCooldown(normalized);
        setCooldown(getAuthEmailCooldownSeconds(normalized));
      }
      setError(friendly);
    }finally{setBusy(false)}
  };

  return <main className="ref-login-shell auth-login-shell">
    <section className="ref-login-brand auth-brand-panel">
      <KiuboMark/>
      <div className="ref-login-copy"><span className="public-kicker">TODO TU NEGOCIO, EN ORDEN</span><h1>Menos vueltas.<br/><em>Más control.</em></h1><p>Ventas, inventario, clientes, caja y operación conectados en un solo espacio diseñado para trabajar rápido.</p></div>
      <div className="ref-login-benefits"><article><i className="blue">◎</i><div><b>Simple desde el primer día</b><span>Flujos claros para vender y administrar sin perder tiempo.</span></div></article><article><i className="orange">⌘</i><div><b>Todo conectado</b><span>Tu negocio y tu equipo trabajando sobre la misma información.</span></div></article><article><i className="coral">↗</i><div><b>Información al instante</b><span>Lo importante visible cuando lo necesitas.</span></div></article><article><i className="navy">◇</i><div><b>Seguro por diseño</b><span>{cloud?"Acceso protegido y datos aislados por negocio.":"Entorno de demostración local."}</span></div></article></div>
    </section>
    <section className="ref-login-area auth-login-area"><div className="auth-orb auth-orb-one"/><div className="auth-orb auth-orb-two"/>
      <form className="ref-login-card auth-login-card" onSubmit={submit}>
        <div className="auth-card-brand"><KiuboMark/><span className="auth-secure-pill">CLOUD</span></div>
        <div><span className="eyebrow">BIENVENIDO</span><h2>Entra a KIUBO</h2><p>Usa el acceso asignado a tu negocio.</p></div>
        {error&&<div className="login-error">{error}</div>}{message&&<div className="auth-success">✓ {message}</div>}
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@negocio.com" required autoFocus value={email} onChange={e=>setEmail(e.target.value)}/></label>
        {cloud?<label>Contraseña<div className="auth-input-wrap"><input name="password" type={showPassword?"text":"password"} autoComplete="current-password" minLength={8} placeholder="Tu contraseña" required/><button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Ocultar":"Ver"}</button></div></label>:<label>PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="current-password" placeholder="••••" required/></label>}
        <button className="button ref-blue-button auth-primary" type="submit" disabled={busy}>{busy?"Entrando…":"Iniciar sesión"}</button>
        {cloud&&<div className="auth-recovery"><span>¿Primera vez o perdiste tu contraseña?</span><button type="button" disabled={busy||cooldown>0} onClick={()=>void resendAccess()}>{cooldown>0?`Podrás reenviar en ${cooldown} s`:"Enviar enlace seguro"}</button></div>}
        {!cloud&&<small className="ref-login-demo">Preview: admin@kiubo.local / caja@kiubo.local · PIN 1234</small>}
        <small className="auth-footnote">KIUBO · Todo tu negocio, en orden.</small>
      </form>
    </section>
  </main>
}
