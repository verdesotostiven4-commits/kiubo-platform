"use client";

import { FormEvent,useEffect,useState } from "react";
import { createLocalBackup,getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type KiuboLocalDatabase } from "@/lib/local-store";
import { runSyncCycle } from "@/lib/sync-engine";

export function BusinessAdminClient(){
  const[db,setDb]=useState<KiuboLocalDatabase|null>(null);
  const[message,setMessage]=useState("Configuración lista");
  const[resetting,setResetting]=useState(false);
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(refresh,[]);
  if(!db)return <div className="loading-card">Preparando administración…</div>;

  const ctx=getWorkspaceContext(db);
  const settings=getTenantSettings(db,ctx.tenantId);
  const canTemporaryReset=ctx.tenant?.name.trim().toUpperCase()==="YUKI"&&Boolean(ctx.user&&(ctx.user.role==="owner"||ctx.user.role==="admin"||ctx.user.platformAdmin));

  const saveSettings=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),current=getTenantSettings(next,workspace.tenantId),f=new FormData(e.currentTarget);
    const updated={
      ...current,
      tradeName:String(f.get("tradeName")||"").trim(),
      legalName:String(f.get("legalName")||"").trim(),
      ruc:String(f.get("ruc")||"").trim(),
      establishment:String(f.get("establishment")||"001").trim()||"001",
      emissionPoint:String(f.get("emissionPoint")||"001").trim()||"001",
      receiptFooter:String(f.get("receiptFooter")||"").trim(),
      accent:String(f.get("accent")||"#ff5b55"),
      requireCashSession:f.get("requireCashSession")==="on",
      allowCredit:f.get("allowCredit")==="on"
    };
    if(!updated.tradeName){setMessage("Escribe el nombre comercial");return}
    next.settings=next.settings.filter(s=>s.tenantId!==workspace.tenantId);
    next.settings.push(updated);
    saveLocalDatabase(next);
    refresh();
    setMessage("Configuración guardada · KIUBO la sincronizará automáticamente");
  };

  const downloadBackup=()=>{
    const blob=new Blob([createLocalBackup()],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=`kiubo-yuki-respaldo-antes-de-iniciar-${new Date().toISOString().slice(0,10)}.json`;a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  const resetYukiOperations=async()=>{
    if(!canTemporaryReset||resetting)return;
    const typed=window.prompt("REINICIO ÚNICO DE YUKI\n\nBorra ventas de prueba, pedidos, cajas y fiados. Conserva productos, imágenes, categorías, clientes, usuarios, marca y configuración.\n\nEscribe REINICIAR para confirmar:");
    if(typed!=="REINICIAR"){setMessage("Reinicio cancelado");return}
    setResetting(true);
    try{
      downloadBackup();
      const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),tid=workspace.tenantId,bid=workspace.branchId;
      const belongs=(item:{tenantId:string;branchId?:string})=>item.tenantId===tid&&(!item.branchId||item.branchId===bid);

      next.sales=next.sales.filter(item=>!belongs(item));
      next.orders=next.orders.filter(item=>!belongs(item));
      next.cashMovements=next.cashMovements.filter(item=>!belongs(item));
      next.cashSessions=next.cashSessions.filter(item=>!belongs(item));
      next.creditPayments=next.creditPayments.filter(item=>!belongs(item));
      next.credits=next.credits.filter(item=>!belongs(item));
      next.stockMovements=next.stockMovements.filter(item=>!(belongs(item)&&item.type==="sale"));

      const operationalQueueTypes=new Set(["saleTransactions","saleReversalTransactions","cashTransactions","creditPaymentTransactions"]);
      next.syncQueue=next.syncQueue.filter(item=>!(item.tenantId===tid&&operationalQueueTypes.has(item.entityType)));
      saveLocalDatabase(next);

      for(let i=window.localStorage.length-1;i>=0;i--){
        const key=window.localStorage.key(i)||"";
        if(key.startsWith("kiubo.pos.draft.")||key.startsWith("kiubo.food.checkout."))window.localStorage.removeItem(key);
      }
      window.sessionStorage.removeItem("kiubo.food.checkout.order.v1");

      setMessage("Reinicio local listo · sincronizando limpieza con Cloud…");
      const result=await runSyncCycle();
      refresh();
      setMessage(result.ok?"YUKI quedó listo para iniciar desde cero · catálogo conservado":"Reinicio aplicado localmente · Cloud reintentará la limpieza automáticamente");
    }catch(error){
      setMessage(error instanceof Error?`No se completó el reinicio: ${error.message}`:"No se completó el reinicio");
    }finally{setResetting(false)}
  };

  return <>
    <div className="workspace-banner"><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>SUCURSAL ACTIVA</span><strong>{ctx.branch?.code} · {ctx.branch?.name}</strong></div><div><span>ESTADO</span><strong>{message}</strong></div></div>
    <header className="topbar"><div><span className="eyebrow">KIUBO ADMINISTRACIÓN</span><h1>Reglas generales del negocio</h1><p>Configura el comportamiento que aplica a tu operación sin mezclarlo con el turno de caja.</p></div></header>
    <form className="panel ops-settings" onSubmit={saveSettings}>
      <div className="panel-head"><div><span className="eyebrow">NEGOCIO</span><h3>Identidad y operación</h3></div><span className="pill">Cloud</span></div>
      <div className="settings-grid">
        <label>Nombre comercial<input name="tradeName" defaultValue={settings.tradeName} required/></label>
        <label>Razón social<input name="legalName" defaultValue={settings.legalName}/></label>
        <label>RUC<input name="ruc" defaultValue={settings.ruc}/></label>
        <label>Establecimiento<input name="establishment" defaultValue={settings.establishment}/></label>
        <label>Punto de emisión<input name="emissionPoint" defaultValue={settings.emissionPoint}/></label>
        <label>Color de marca<input name="accent" type="color" defaultValue={settings.accent}/></label>
        <label className="settings-wide">Pie de comprobante<input name="receiptFooter" defaultValue={settings.receiptFooter}/></label>
        <label className="switch-row"><input name="requireCashSession" type="checkbox" defaultChecked={settings.requireCashSession}/>Exigir caja abierta para cobros en efectivo</label>
        <label className="switch-row"><input name="allowCredit" type="checkbox" defaultChecked={settings.allowCredit}/>Permitir ventas a crédito / fiado</label>
      </div>
      <button className="button primary" type="submit">Guardar configuración</button>
      <small className="ops-note">Los cambios quedan vinculados al negocio activo y se sincronizan con KIUBO Cloud.</small>
    </form>

    {canTemporaryReset&&<section className="panel" style={{marginTop:16,border:"1px solid #efc9c9",background:"#fffafa"}}>
      <div className="panel-head"><div><span className="eyebrow" style={{color:"#b42318"}}>SOLO PARA EL ARRANQUE DE YUKI</span><h3>Reiniciar operación de prueba</h3></div><span className="pill" style={{background:"#fde8e7",color:"#b42318"}}>Temporal</span></div>
      <p style={{maxWidth:760,color:"#6f5555"}}>Deja el negocio limpio antes de abrir oficialmente: elimina ventas y pedidos de prueba, sesiones y movimientos de caja, fiados/pagos de prueba y movimientos de stock generados por ventas. <b>No borra productos, imágenes, categorías, clientes, usuarios, marca, configuración, proveedores ni compras.</b> Antes de hacerlo KIUBO descarga un respaldo local automático.</p>
      <button className="button secondary" type="button" disabled={resetting} onClick={()=>void resetYukiOperations()} style={{borderColor:"#d92d20",color:"#b42318"}}>{resetting?"Reiniciando…":"Reiniciar pruebas y empezar en cero"}</button>
      <small className="ops-note">Cuando confirmes que YUKI ya inició oficialmente, esta opción se elimina del sistema.</small>
    </section>}
  </>;
}
