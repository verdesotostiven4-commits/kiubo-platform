"use client";

import { useEffect,useState } from "react";

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};

type StandaloneNavigator=Navigator&{standalone?:boolean};

export function PwaInstallButton(){
  const[prompt,setPrompt]=useState<InstallPromptEvent|null>(null);
  const[installed,setInstalled]=useState(false);

  useEffect(()=>{
    const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as StandaloneNavigator).standalone===true;
    if(standalone){setInstalled(true);return}
    const beforeInstall=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};
    const appInstalled=()=>{setInstalled(true);setPrompt(null)};
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",appInstalled);
    return()=>{
      window.removeEventListener("beforeinstallprompt",beforeInstall);
      window.removeEventListener("appinstalled",appInstalled);
    };
  },[]);

  const install=async()=>{
    if(!prompt)return;
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice.outcome==="accepted")setInstalled(true);
    setPrompt(null);
  };

  if(installed)return <div className="pwa-install-state"><span>✓</span><span>KIUBO instalado</span></div>;
  if(!prompt)return null;
  return <button className="pwa-install-button" type="button" onClick={()=>void install()}><span>↧</span><span>Instalar KIUBO</span></button>;
}
