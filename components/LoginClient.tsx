"use client";
import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
import { KiuboMark } from "./Logo";
import { getAuthProvider } from "@/lib/auth-provider";
import { homeForRole } from "@/lib/permissions";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const KIUBO_SET_PASSWORD_URL="https://kiubo-platform.vercel.app/set-password";

export function LoginClient(){
  const router=useRouter();
  const[error,setError]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);
  const[email,setEmail]=useState("");
  const cloud=process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase";

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
    if(!normalized){setError("Escribe primero el correo de acceso");return}
    setBusy(true);setError("");setMessage("");
    try{
      const client=getSupabaseBrowserClient();
      if(!client)throw new Error("KIUBO Cloud no está configurado");
      const result=await client.auth.signInWithOtp({email:normalized,options:{shouldCreateUser:false,emailRedirectTo:KIUBO_SET_PASSWORD_URL}});
      if(result.error)throw result.error;
      setMessage("Te enviamos un nuevo enlace de acceso. Revisa tu correo.");
    }catch(err){setError(err instanceof Error?err.message:"No se pudo enviar el enlace")}
    finally{setBusy(false)}
  };

  return <main className="ref-login-shell"><section className="ref-login-brand"><KiuboMark/><div className="ref-login-copy"><span className="public-kicker">TU NEGOCIO, SIMPLE</span><h1>Todo<br/><em>en orden.</em></h1><p>Ventas, inventario, clientes y control en una plataforma pensada para que tu equipo pueda empezar sin complicaciones.</p></div><div className="ref-login-benefits"><article><i className="blue">◎</i><div><b>Fácil de usar</b><span>Interfaz clara desde el primer día.</span></div></article><article><i className="orange">⌘</i><div><b>Todo en uno</b><span>Vende, controla y revisa tu negocio.</span></div></article><article><i className="coral">↗</i><div><b>Información al instante</b><span>Datos del negocio en un solo lugar.</span></div></article><article><i className="navy">◇</i><div><b>Seguro por diseño</b><span>{cloud?"Acceso protegido con Auth y aislamiento por negocio.":"La versión productiva usará Auth y RLS cloud."}</span></div></article></div></section><section className="ref-login-area"><div className="ref-login-shape s1"/><div className="ref-login-shape s2"/><form className="ref-login-card" onSubmit={submit}><KiuboMark/><div><span className="eyebrow">¡BIENVENIDO!</span><h2>Inicia sesión para continuar</h2><p>Entra con el acceso asignado a tu negocio.</p></div>{error&&<div className="login-error">{error}</div>}{message&&<div className="pos-message">{message}</div>}<label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@negocio.com" required autoFocus value={email} onChange={e=>setEmail(e.target.value)}/></label>{cloud?<label>Contraseña<input name="password" type="password" autoComplete="current-password" minLength={8} placeholder="Tu contraseña" required/></label>:<label>PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="current-password" placeholder="••••" required/></label>}<button className="button ref-blue-button" type="submit" disabled={busy}>{busy?"Procesando…":"Iniciar sesión"}</button>{cloud&&<button className="button" type="button" disabled={busy} onClick={()=>void resendAccess()}>Enviar enlace de acceso</button>}{!cloud&&<small className="ref-login-demo">Preview: admin@kiubo.local / caja@kiubo.local · PIN 1234</small>}{cloud&&<small className="ref-login-demo">Si todavía no tienes contraseña, usa “Enviar enlace de acceso”.</small>}</form></section></main>
}
