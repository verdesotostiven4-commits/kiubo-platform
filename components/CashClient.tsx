"use client";

import { FormEvent,useEffect,useState } from "react";
import {
  type CashMovementRecord,
  type CashSessionRecord,
  type CreditPaymentRecord,
  type KiuboLocalDatabase,
  getOpenCashSession,
  getTenantSettings,
  getWorkspaceContext,
  loadLocalDatabase,
  makeId,
  saveLocalDatabase,
} from "@/lib/local-store";
import { enqueueCashTransaction,enqueueCreditPaymentTransaction } from "@/lib/finance-transaction";

type CreditPaymentMethod="cash"|"transfer";

export function CashClient(){
  const[db,setDb]=useState<KiuboLocalDatabase|null>(null);
  const[closeAmount,setCloseAmount]=useState("");
  const[paymentDraft,setPaymentDraft]=useState<Record<string,string>>({});
  const[paymentMethodDraft,setPaymentMethodDraft]=useState<Record<string,CreditPaymentMethod>>({});
  const[message,setMessage]=useState("Caja lista");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(refresh,[]);
  if(!db)return <div className="loading-card">Preparando caja…</div>;

  const ctx=getWorkspaceContext(db);
  const customers=db.customers.filter(c=>c.tenantId===ctx.tenantId);
  const credits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&c.branchId===ctx.branchId);
  const openSession=getOpenCashSession(db,ctx.tenantId,ctx.branchId);
  const settings=getTenantSettings(db,ctx.tenantId);
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
    persistCommand(next);e.currentTarget.reset();setMessage("Caja abierta · KIUBO confirmará en Cloud automáticamente");
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
    persistCommand(next);e.currentTarget.reset();setMessage("Movimiento protegido para sincronización");
  };

  const closeCash=()=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),session=getOpenCashSession(next,workspace.tenantId,workspace.branchId),amount=Number(closeAmount);
    if(!session){setMessage("No hay una caja abierta");return}
    if(!Number.isFinite(amount)||amount<0){setMessage("Ingresa el efectivo contado");return}
    const closed:CashSessionRecord={...session,status:"closed",closingAmount:Number(amount.toFixed(2)),closedAt:new Date().toISOString()};
    next.cashSessions=next.cashSessions.map(s=>s.id===session.id?closed:s);
    enqueueCashTransaction(next,{kind:"close",session:closed});
    persistCommand(next);setCloseAmount("");setMessage("Caja cerrada · pendiente de confirmación Cloud");
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

  return <>
    <div className="workspace-banner"><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>SUCURSAL</span><strong>{ctx.branch?.code} · {ctx.branch?.name}</strong></div><div><span>ESTADO</span><strong>{message}</strong></div></div>
    <header className="topbar"><div><span className="eyebrow">KIUBO CAJA</span><h1>Caja y fiados, sin perder el control.</h1></div><div className={openSession?"status status-active":"status status-suspended"}>{openSession?"CAJA ABIERTA":"CAJA CERRADA"}</div></header>
    <section className="ops-grid">
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">CAJA · {ctx.branch?.name}</span><h3>{openSession?"Turno en curso":"Abrir turno"}</h3></div><span className={openSession?"status status-active":"status status-suspended"}>{openSession?"ABIERTA":"CERRADA"}</span></div>{!openSession?<form className="ops-form" onSubmit={openCash}><label>Fondo inicial<input name="opening" type="number" min="0" step="0.01" defaultValue="0"/></label><button className="button primary" type="submit">Abrir caja</button></form>:<><div className="cash-metrics"><div><span>Inicial</span><strong>${openSession.openingAmount.toFixed(2)}</strong></div><div><span>Ventas efectivo</span><strong>${cashSummary.sales.toFixed(2)}</strong></div><div><span>Esperado</span><strong>${cashSummary.expected.toFixed(2)}</strong></div></div><form className="ops-form ops-form-3" onSubmit={addMovement}><select name="type"><option value="in">Ingreso</option><option value="out">Egreso</option></select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required/><input name="reason" placeholder="Motivo" required/><button className="button secondary" type="submit">Registrar</button></form><div className="close-cash"><input value={closeAmount} onChange={e=>setCloseAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Efectivo contado"/><button className="button primary" onClick={closeCash}>Cerrar caja</button></div><small className="ops-note">Aperturas, movimientos y cierres quedan protegidos para no duplicarse al sincronizar.</small></>}</article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">FIADOS · {ctx.branch?.name}</span><h3>Cuentas por cobrar</h3></div><span className="pill">${credits.filter(c=>c.status==="open").reduce((n,c)=>n+c.balance,0).toFixed(2)} pendiente</span></div><div className="ops-list">{credits.length===0?<p className="empty-cart">Cuando cobres una venta como Fiado aparecerá aquí.</p>:credits.map(c=>{const customer=customers.find(x=>x.id===c.customerId);return <div className="credit-row" key={c.id}><div><strong>{customer?.name??"Cliente"}</strong><span>{c.description} · Original ${c.originalAmount.toFixed(2)}</span></div><b>${c.balance.toFixed(2)}</b>{c.status==="open"?<><input value={paymentDraft[c.id]??""} onChange={e=>setPaymentDraft(v=>({...v,[c.id]:e.target.value}))} type="number" min="0.01" step="0.01" placeholder="Abono"/><select value={paymentMethodDraft[c.id]??"cash"} onChange={e=>setPaymentMethodDraft(v=>({...v,[c.id]:e.target.value as CreditPaymentMethod}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select><button className="button secondary compact" onClick={()=>payCredit(c.id)}>Abonar</button></>:<span className="status status-active">PAGADO</span>}</div>})}</div></article>
    </section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">REGLAS DE CAJA</span><h3>Comportamiento del negocio</h3></div></div><div className="cash-metrics"><div><span>Efectivo</span><strong>{settings.requireCashSession?"Exige caja abierta":"Caja opcional"}</strong></div><div><span>Fiados</span><strong>{settings.allowCredit?"Permitidos":"Desactivados"}</strong></div><div><span>Cloud</span><strong>Sincronización automática</strong></div></div></section>
  </>;
}
