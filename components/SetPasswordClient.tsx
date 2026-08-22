"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { KiuboMark } from "./Logo";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getAuthProvider } from "@/lib/auth-provider";
import { homeForRole } from "@/lib/permissions";

function passwordScore(value:string){
  let score=0;
  if(value.length>=8)score++;
  if(/[A-Z]/.test(value)&&/[a-z]/.test(value))score++;
  if(/\d/.test(value))score++;
  if(/[^A-Za-z0-9]/.test(value))score++;
  return score;
}

export function SetPasswordClient(){
  const router=useRouter();
  const[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[show,setShow]=useState(false);
  const score=useMemo(()=>passwordScore(password),[password]);
  const scoreLabel=score<=1?"Básica":score===2?"Buena":score===3?"Fuerte":"Muy fuerte";

  useEffect(()=>{let active=true;void(async()=>{
    const client=getSupabaseBrowserClient();
    if(!client){if(active)setError("KIUBO Cloud no está configurado");return}
    const result=await client.auth.getSession();
    if(!active)return;
    if(!result.data.session)setError("Este enlace ya no es válido o venció. Solicita uno nuevo desde el inicio de sesión.");
    else setReady(true)
  })();return()=>{active=false}},[]);

  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(busy)return;setBusy(true);setError("");
    if(password.length<8){setError("Usa al menos 8 caracteres para proteger tu cuenta.");setBusy(false);return}
    if(password!==confirm){setError("Las contraseñas no coinciden. Revísalas e intenta de nuevo.");setBusy(false);return}
    const client=getSupabaseBrowserClient();
    if(!client){setError("KIUBO Cloud no está configurado");setBusy(false);return}
    const update=await client.auth.updateUser({password});
    if(update.error){setError(update.error.message);setBusy(false);return}
    const auth=getAuthProvider();
    const session=await auth.getSession();
    if(!session){setBusy(false);setError("La contraseña se guardó, pero no pudimos abrir tu espacio. Inicia sesión con tu nueva contraseña.");return}
    const validation=await auth.validateSession(session);
    setBusy(false);
    if(!validation.ok||!validation.user){router.replace("/login");return}
    router.replace(validation.user.platformAdmin?"/control":homeForRole(validation.user.role));
  };

  return <main className="ref-login-shell auth-setup-shell">
    <section className="ref-login-brand auth-brand-panel">
      <KiuboMark/>
      <div className="ref-login-copy">
        <span className="public-kicker">TU ACCESO KIUBO</span>
        <h1>Una llave.<br/><em>Todo tu negocio.</em></h1>
        <p>Crea tu contraseña y deja listo un acceso seguro para trabajar desde cualquier dispositivo autorizado.</p>
      </div>
      <div className="auth-trust-row"><span>✓ Enlace de un solo uso</span><span>✓ Acceso cifrado</span><span>✓ Espacio aislado por negocio</span></div>
    </section>
    <section className="ref-login-area auth-setup-area">
      <div className="auth-orb auth-orb-one"/><div className="auth-orb auth-orb-two"/>
      <form className="ref-login-card auth-setup-card" onSubmit={submit}>
        <div className="auth-card-brand"><KiuboMark/><span className="auth-secure-pill">SEGURO</span></div>
        <div><span className="eyebrow">PRIMER ACCESO</span><h2>Crea tu contraseña</h2><p>Será tu acceso habitual a KIUBO. El correo solo se usa para activar o recuperar tu cuenta.</p></div>
        {error&&<div className="login-error">{error}</div>}
        <label>Nueva contraseña<div className="auth-input-wrap"><input name="password" type={show?"text":"password"} autoComplete="new-password" minLength={8} required disabled={!ready||busy} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/><button type="button" className="auth-eye" onClick={()=>setShow(v=>!v)} disabled={!ready}>{show?"Ocultar":"Ver"}</button></div></label>
        {password&&<div className="password-meter" aria-label={`Seguridad de contraseña: ${scoreLabel}`}><div className={`password-bars score-${score}`}><i/><i/><i/><i/></div><span>{scoreLabel}</span></div>}
        <label>Confirmar contraseña<div className="auth-input-wrap"><input name="confirm" type={show?"text":"password"} autoComplete="new-password" minLength={8} required disabled={!ready||busy} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repítela exactamente"/></div></label>
        {confirm&&password===confirm&&<div className="auth-match">✓ Las contraseñas coinciden</div>}
        <button className="button ref-blue-button auth-primary" type="submit" disabled={!ready||busy}>{busy?"Preparando tu espacio…":"Guardar y entrar"}</button>
        {!ready&&!error&&<small className="ref-login-demo">Validando tu enlace seguro…</small>}
        {error&&!ready&&<button className="auth-link-button" type="button" onClick={()=>router.replace("/login")}>Volver al inicio de sesión</button>}
        <small className="auth-footnote">KIUBO · Todo tu negocio, en orden.</small>
      </form>
    </section>
  </main>;
}
