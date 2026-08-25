"use client";

import { useEffect,useMemo,useState } from "react";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};
type StandaloneNavigator=Navigator&{standalone?:boolean};

export function PwaInstallButton(){
  const[prompt,setPrompt]=useState<InstallPromptEvent|null>(null);
  const[installed,setInstalled]=useState(false);
  const[help,setHelp]=useState(false);
  const browser=useMemo(()=>{
    if(typeof navigator==="undefined")return"navegador";
    const ua=navigator.userAgent;
    if(/Edg\//.test(ua))return"Edge";
    if(/Brave/i.test(ua)||(navigator as Navigator&{brave?:unknown}).brave)return"Brave";
    if(/Chrome\//.test(ua))return"Chrome";
    return"navegador";
  },[]);

  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: window-controls-overlay)").matches||(navigator as StandaloneNavigator).standalone===true;
    if(standalone){setInstalled(true);return}
    const beforeInstall=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};
    const appInstalled=()=>{setInstalled(true);setPrompt(null);setHelp(false)};
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",appInstalled);
    return()=>{window.removeEventListener("beforeinstallprompt",beforeInstall);window.removeEventListener("appinstalled",appInstalled)};
  },[]);

  const install=async()=>{
    if(!prompt){setHelp(true);return}
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice.outcome==="accepted")setInstalled(true);
    setPrompt(null);
  };

  return <>
    {installed?<div className="pwa-install-state"><span>✓</span><span>KIUBO instalado</span></div>:<button className="pwa-install-button" type="button" onClick={()=>void install()}><span>↧</span><span>Instalar KIUBO</span></button>}
    {help&&<div className="install-help-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setHelp(false)}}><section className="install-help" role="dialog" aria-modal="true" aria-label="Instalar KIUBO"><button className="install-help-close" onClick={()=>setHelp(false)} aria-label="Cerrar">×</button><span className="install-help-icon">K</span><h3>Instalar KIUBO en esta computadora</h3><p>El instalador automático todavía no fue ofrecido por {browser}. Puedes instalarlo desde el menú del navegador sin perder ningún dato.</p><ol><li>Abre el menú de {browser}.</li><li>Busca <b>Instalar KIUBO</b>, <b>Instalar aplicación</b> o <b>Guardar y compartir → Instalar página como aplicación</b>.</li><li>Confirma <b>Instalar</b> y luego ancla KIUBO a la barra de tareas si deseas.</li></ol><small>Después de instalarlo, abre KIUBO desde su icono; ya no necesitas usar F11 ni trabajar como una pestaña del navegador.</small><button className="install-help-ok" onClick={()=>setHelp(false)}>Entendido</button></section></div>}
  </>;
}
