"use client";

import { FormEvent,useEffect,useState } from "react";
import {
  type CashMovementRecord,
  type CashSessionRecord,
  type CreditPaymentRecord,
  type KiuboLocalDatabase,
  type UserRole,
  createLocalBackup,
  getOpenCashSession,
  getTenantSettings,
  getWorkspaceContext,
  loadLocalDatabase,
  makeId,
  restoreLocalBackup,
  saveLocalDatabase,
} from "@/lib/local-store";
import { enqueueCashTransaction,enqueueCreditPaymentTransaction } from "@/lib/finance-transaction";

const roleLabel:Record<UserRole,string>={owner:"Propietario",admin:"Administrador",cashier:"Cajero",inventory:"Inventario",viewer:"Consulta"};
type CreditPaymentMethod="cash"|"transfer";

export function OperationsClient(){
  const[db,setDb]=useState<KiuboLocalDatabase|null>(null);
  const[closeAmount,setCloseAmount]=useState("");
  const[paymentDraft,setPaymentDraft]=useState<Record<string,string>>({});
  const[paymentMethodDraft,setPaymentMethodDraft]=useState<Record<string,CreditPaymentMethod>>({});
  const[message,setMessage]=useState("Operación lista");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(refresh,[]);
  if(!db)return <div className="loading-card">Preparando operación…</div>;

  const ctx=getWorkspaceContext(db);
  const users=db.users.filter(u=>u.tenantId===ctx.tenantId);
  const customers=db.customers.filter(c=>c.tenantId===ctx.tenantId);
  const credits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&c.branchId===ctx.branchId);
  const openSession=getOpenCashSession(db,ctx.tenantId,ctx.branchId);
  const settings=getTenantSettings(db,ctx.tenantId);

  const persistTracked=(next:KiuboLocalDatabase)=>{saveLocalDatabase(next);refresh()};
  const persistCommand=(next:KiuboLocalDatabase)=>{saveLocalDatabase(next,{trackChanges:false});refresh()};

  const cashSummary=(()=>{
    if(!openSession)return{sales:0,income:0,out:0,expected:0};
    const sales=db.sales
      .filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId&&s.payment==="cash"&&new Date(s.createdAt)>=new Date(openSession.openedAt))
      .reduce((n,s)=>n+s.total,0);
    const moves=db.cashMovements.filter(m=>m.sessionId===openSession.id);
    const income=moves.filter(m=>m.type==="in").reduce((n,m)=>n+m.amount,0);
    const out=moves.filter(m=>m.type==="out").reduce((n,m)=>n+m.amount,0);
    return{sales,income,out,expected:openSession.openingAmount+sales+income-out};
  })();

  const addUser=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),f=new FormData(e.currentTarget);
    const name=String(f.get("name")||"").trim(),email=String(f.get("email")||"").trim().toLowerCase(),pin=String(f.get("pin")||"").trim();
    if(!name||!email||!/^[0-9]{4}$/.test(pin)){setMessage("Completa usuario, correo y PIN de 4 dígitos");return}
    if(next.users.some(u=>u.email.toLowerCase()===email)){setMessage("Ese correo ya existe");return}
    next.users.unshift({id:makeId("user"),tenantId:workspace.tenantId,name,email,role:String(f.get("role")||"cashier") as UserRole,active:true,pin,platformAdmin:false,createdAt:new Date().toISOString()});
    next.tenants=next.tenants.map(t=>t.id===workspace.tenantId?{...t,users:next.users.filter(u=>u.tenantId===workspace.tenantId&&u.active).length}:t);
    persistTracked(next);e.currentTarget.reset();setMessage("Usuario creado");
  };

  const toggleUser=(id:string)=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next);
    next.users=next.users.map(u=>u.id===id?{...u,active:!u.active}:u);
    next.tenants=next.tenants.map(t=>t.id===workspace.tenantId?{...t,users:next.users.filter(u=>u.tenantId===workspace.tenantId&&u.active).length}:t);
    persistTracked(next);
  };

  const openCash=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next);
    if(getOpenCashSession(next,workspace.tenantId,workspace.branchId)){setMessage("Ya existe una caja abierta en esta sucursal");return}
    const f=new FormData(e.currentTarget),amount=Number(f.get("opening")||0);
    if(!Number.isFinite(amount)||amount<0){setMessage("El fondo inicial no es válido");return}
    const session:CashSessionRecord={
      id:makeId("cash"),tenantId:workspace.tenantId,branchId:workspace.branchId,
      openingAmount:Number(amount.toFixed(2)),status:"open",openedAt:new Date().toISOString(),openedBy:workspace.user?.name??"Usuario"
    };
    next.cashSessions.unshift(session);
    enqueueCashTransaction(next,{kind:"open",session});
    persistCommand(next);e.currentTarget.reset();setMessage("Caja abierta y pendiente de confirmación cloud");
  };

  const addMovement=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),session=getOpenCashSession(next,workspace.tenantId,workspace.branchId);
    if(!session){setMessage("Primero abre caja");return}
    const f=new FormData(e.currentTarget),amount=Number(f.get("amount")||0),type=String(f.get("type")) as "in"|"out",reason=String(f.get("reason")||"").trim();
    if(!Number.isFinite(amount)||amount<=0||!reason){setMessage("Completa un monto y motivo válidos");return}
    const movement:CashMovementRecord={
      id:makeId("movement"),tenantId:workspace.tenantId,branchId:workspace.branchId,sessionId:session.id,type,
      amount:Number(amount.toFixed(2)),reason,createdAt:new Date().toISOString()
    };
    movement.clientOperationId=movement.id;
    next.cashMovements.unshift(movement);
    enqueueCashTransaction(next,{kind:"movement",movement});
    persistCommand(next);e.currentTarget.reset();setMessage("Movimiento registrado y protegido para sincronización");
  };

  const closeCash=()=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),session=getOpenCashSession(next,workspace.tenantId,workspace.branchId),amount=Number(closeAmount);
    if(!session){setMessage("No hay una caja abierta");return}
    if(!Number.isFinite(amount)||amount<0){setMessage("Ingresa el efectivo contado");return}
    const closed:CashSessionRecord={...session,status:"closed",closingAmount:Number(amount.toFixed(2)),closedAt:new Date().toISOString()};
    next.cashSessions=next.cashSessions.map(s=>s.id===session.id?closed:s);
    enqueueCashTransaction(next,{kind:"close",session:closed});
    persistCommand(next);setCloseAmount("");setMessage("Caja cerrada y pendiente de confirmación cloud");
  };

  const payCredit=(creditId:string)=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),credit=next.credits.find(c=>c.id===creditId);
    const amount=Number(paymentDraft[creditId]),method=paymentMethodDraft[creditId]??"cash";
    if(!credit||credit.status!=="open"){setMessage("Ese fiado ya no está pendiente");return}
    if(!Number.isFinite(amount)||amount<=0){setMessage("Ingresa un abono válido");return}
    const localSettings=getTenantSettings(next,workspace.tenantId),session=getOpenCashSession(next,workspace.tenantId,workspace.branchId);
    if(method==="cash"&&localSettings.requireCashSession&&!session){setMessage("Debes abrir caja para recibir un abono en efectivo");return}
    const applied=Math.min(amount,credit.balance),now=new Date().toISOString();
    const payment:CreditPaymentRecord={
      id:makeId("credit-payment"),tenantId:workspace.tenantId,branchId:workspace.branchId,creditId,
      amount:Number(applied.toFixed(2)),method,createdAt:now
    };
    payment.clientOperationId=payment.id;
    const remaining=Number((credit.balance-applied).toFixed(2));
    const updatedCredit={...credit,balance:remaining,status:(remaining<=.001?"paid":"open") as "open"|"paid"};
    next.creditPayments.unshift(payment);
    next.credits=next.credits.map(c=>c.id===creditId?updatedCredit:c);

    let cashMovement:CashMovementRecord|undefined;
    if(method==="cash"&&session){
      cashMovement={
        id:makeId("movement"),tenantId:workspace.tenantId,branchId:workspace.branchId,sessionId:session.id,type:"in",
        amount:Number(applied.toFixed(2)),reason:`Abono · ${credit.description}`,createdAt:now
      };
      cashMovement.clientOperationId=cashMovement.id;
      next.cashMovements.unshift(cashMovement);
    }

    enqueueCreditPaymentTransaction(next,{payment,creditSnapshot:updatedCredit,cashMovement});
    persistCommand(next);
    setPaymentDraft(v=>({...v,[creditId]:""}));
    setMessage(`Abono registrado · ${method==="cash"?"Efectivo":"Transferencia"}`);
  };

  const saveSettings=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),current=getTenantSettings(next,workspace.tenantId),f=new FormData(e.currentTarget);
    const updated={...current,tradeName:String(f.get("tradeName")||""),legalName:String(f.get("legalName")||""),ruc:String(f.get("ruc")||""),establishment:String(f.get("establishment")||"001"),emissionPoint:String(f.get("emissionPoint")||"001"),receiptFooter:String(f.get("receiptFooter")||""),accent:String(f.get("accent")||"#ff5b55"),requireCashSession:f.get("requireCashSession")==="on",allowCredit:f.get("allowCredit")==="on"};
    next.settings=next.settings.filter(s=>s.tenantId!==workspace.tenantId);next.settings.push(updated);persistTracked(next);setMessage("Configuración guardada");
  };

  const downloadBackup=()=>{
    const blob=new Blob([createLocalBackup()],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=`kiubo-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  };
  const restore=(file?:File)=>{
    if(!file)return;const reader=new FileReader();
    reader.onload=()=>{try{restoreLocalBackup(String(reader.result||""));refresh();setMessage("Respaldo restaurado")}catch{alert("El archivo no es un respaldo válido de KIUBO")}};
    reader.readAsText(file);
  };

  return <>
    <div className="workspace-banner"><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>SUCURSAL</span><strong>{ctx.branch?.code} · {ctx.branch?.name}</strong></div><div><span>ESTADO</span><strong>{message}</strong></div></div>
    <header className="topbar"><div><span className="eyebrow">KIUBO OPERACIÓN</span><h1>Equipo, caja, fiados y configuración</h1></div><button className="button secondary" onClick={downloadBackup}>Descargar respaldo</button></header>
    <section className="ops-grid">
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">EQUIPO</span><h3>Usuarios del negocio</h3></div><span className="pill">{users.filter(u=>u.active).length} activos</span></div><form className="ops-form ops-form-3" onSubmit={addUser}><input name="name" placeholder="Nombre" required/><input name="email" type="email" placeholder="Correo" required/><select name="role" defaultValue="cashier">{Object.entries(roleLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><input name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="PIN" required/><button className="button primary" type="submit">Agregar usuario</button></form><div className="ops-list">{users.map(u=><div className="ops-row" key={u.id}><div><strong>{u.name}</strong><span>{u.email} · {roleLabel[u.role]}{u.platformAdmin?" · KIUBO Admin":""}</span></div>{!u.platformAdmin&&<button className={u.active?"mini-action danger":"mini-action resume"} onClick={()=>toggleUser(u.id)}>{u.active?"Desactivar":"Activar"}</button>}</div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">CAJA · {ctx.branch?.name}</span><h3>{openSession?"Caja abierta":"Caja cerrada"}</h3></div><span className={openSession?"status status-active":"status status-suspended"}>{openSession?"ABIERTA":"CERRADA"}</span></div>{!openSession?<form className="ops-form" onSubmit={openCash}><label>Fondo inicial<input name="opening" type="number" min="0" step="0.01" defaultValue="0"/></label><button className="button primary" type="submit">Abrir caja</button></form>:<><div className="cash-metrics"><div><span>Inicial</span><strong>${openSession.openingAmount.toFixed(2)}</strong></div><div><span>Ventas efectivo</span><strong>${cashSummary.sales.toFixed(2)}</strong></div><div><span>Esperado</span><strong>${cashSummary.expected.toFixed(2)}</strong></div></div><form className="ops-form ops-form-3" onSubmit={addMovement}><select name="type"><option value="in">Ingreso</option><option value="out">Egreso</option></select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required/><input name="reason" placeholder="Motivo" required/><button className="button secondary" type="submit">Registrar</button></form><div className="close-cash"><input value={closeAmount} onChange={e=>setCloseAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Efectivo contado"/><button className="button primary" onClick={closeCash}>Cerrar caja</button></div><small className="ops-note">La caja queda separada por sucursal y KIUBO Cloud procesa apertura, movimientos y cierre de forma idempotente.</small></>}</article>
    </section>
    <section className="ops-grid">
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">FIADOS · {ctx.branch?.name}</span><h3>Cuentas por cobrar</h3></div><span className="pill">${credits.filter(c=>c.status==="open").reduce((n,c)=>n+c.balance,0).toFixed(2)} pendiente</span></div><div className="ops-list">{credits.length===0?<p className="empty-cart">Cuando cobres una venta como Fiado aparecerá aquí.</p>:credits.map(c=>{const customer=customers.find(x=>x.id===c.customerId);return <div className="credit-row" key={c.id}><div><strong>{customer?.name??"Cliente"}</strong><span>{c.description} · Original ${c.originalAmount.toFixed(2)}</span></div><b>${c.balance.toFixed(2)}</b>{c.status==="open"?<><input value={paymentDraft[c.id]??""} onChange={e=>setPaymentDraft(v=>({...v,[c.id]:e.target.value}))} type="number" min="0.01" step="0.01" placeholder="Abono"/><select value={paymentMethodDraft[c.id]??"cash"} onChange={e=>setPaymentMethodDraft(v=>({...v,[c.id]:e.target.value as CreditPaymentMethod}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select><button className="button secondary compact" onClick={()=>payCredit(c.id)}>Abonar</button></>:<span className="status status-active">PAGADO</span>}</div>})}</div></article>
      <form className="panel ops-settings" onSubmit={saveSettings}><div className="panel-head"><div><span className="eyebrow">NEGOCIO</span><h3>Configuración general</h3></div></div><div className="settings-grid"><label>Nombre comercial<input name="tradeName" defaultValue={settings.tradeName}/></label><label>Razón social<input name="legalName" defaultValue={settings.legalName}/></label><label>RUC<input name="ruc" defaultValue={settings.ruc}/></label><label>Establecimiento<input name="establishment" defaultValue={settings.establishment}/></label><label>Punto de emisión<input name="emissionPoint" defaultValue={settings.emissionPoint}/></label><label>Color de marca<input name="accent" type="color" defaultValue={settings.accent}/></label><label className="settings-wide">Pie de comprobante<input name="receiptFooter" defaultValue={settings.receiptFooter}/></label><label className="switch-row"><input name="requireCashSession" type="checkbox" defaultChecked={settings.requireCashSession}/>Exigir caja abierta para efectivo</label><label className="switch-row"><input name="allowCredit" type="checkbox" defaultChecked={settings.allowCredit}/>Permitir fiado</label></div><button className="button primary" type="submit">Guardar configuración</button><div className="backup-restore"><span>Restaurar respaldo local</span><input type="file" accept="application/json" onChange={e=>restore(e.target.files?.[0])}/></div></form>
    </section>
  </>;
}
