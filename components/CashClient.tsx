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
import { cashReconciliationEntries,reconcileCashSession } from "@/lib/cash-reconciliation";
import { enqueueCashTransaction,enqueueCreditPaymentTransaction } from "@/lib/finance-transaction";
import { saleLifecycle } from "@/lib/sale-reversal";
import { creditPaymentCashMovementReason } from "@/lib/order-payments";
import { paymentBreakdownForSale } from "@/lib/mixed-payment";
import styles from "./CashClient.module.css";

type CreditPaymentMethod="cash"|"transfer";

export function CashClient(){
  const[db,setDb]=useState<KiuboLocalDatabase|null>(null);
  const[closeAmount,setCloseAmount]=useState("");
  const[paymentDraft,setPaymentDraft]=useState<Record<string,string>>({});
  const[paymentMethodDraft,setPaymentMethodDraft]=useState<Record<string,CreditPaymentMethod>>({});
  const[message,setMessage]=useState("Caja lista");
  const[cashDetailOpen,setCashDetailOpen]=useState(false);
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(refresh,[]);
  if(!db)return <div className="loading-card">Preparando caja…</div>;

  const ctx=getWorkspaceContext(db);
  const customers=db.customers.filter(c=>c.tenantId===ctx.tenantId);
  const credits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&c.branchId===ctx.branchId);\n  const fiadoCredits=credits.filter(c=>c.kind!=="partial");
  const openSession=getOpenCashSession(db,ctx.tenantId,ctx.branchId);
  const settings=getTenantSettings(db,ctx.tenantId);
  const persistCommand=(next:KiuboLocalDatabase)=>{saveLocalDatabase(next,{trackChanges:false});refresh()};
  const cashSummary=openSession?reconcileCashSession(db,openSession):null;
  const cashEntries=openSession?cashReconciliationEntries(db,openSession):[];
  const closeValue=closeAmount.trim()?Number(closeAmount):NaN;
  const closeDifference=cashSummary&&Number.isFinite(closeValue)?Number((closeValue-cashSummary.expected).toFixed(2)):undefined;
  const sessionStarted=openSession?Date.parse(openSession.openedAt):0;
  const sessionAgeHours=openSession?Math.max(0,(Date.now()-sessionStarted)/(60*60*1000)):0;
  const staleSession=Boolean(openSession&&sessionAgeHours>24);
  const turnSales=openSession?db.sales.filter(sale=>sale.tenantId===ctx.tenantId&&sale.branchId===ctx.branchId&&Date.parse(sale.createdAt)>=sessionStarted):[];
  const completedTurnSales=turnSales.filter(sale=>saleLifecycle(sale)==="completed");
  const transferSales=completedTurnSales.reduce((sum,sale)=>sum+paymentBreakdownForSale(db,sale).transfer,0);
  const transferCreditPayments=db.creditPayments.filter(payment=>payment.tenantId===ctx.tenantId&&payment.branchId===ctx.branchId&&payment.method==="transfer"&&Date.parse(payment.createdAt)>=sessionStarted).reduce((sum,payment)=>sum+payment.amount,0);
  const transferTurn=transferSales+transferCreditPayments;
  const creditTurn=completedTurnSales.filter(sale=>sale.payment==="credit").reduce((sum,sale)=>sum+sale.total,0);
  const voidedTurn=turnSales.filter(sale=>saleLifecycle(sale)==="voided").length;

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
    const reconciliation=reconcileCashSession(next,session),difference=Number((amount-reconciliation.expected).toFixed(2));
    const closed:CashSessionRecord={...session,status:"closed",closingAmount:Number(amount.toFixed(2)),closedAt:new Date().toISOString()};
    next.cashSessions=next.cashSessions.map(s=>s.id===session.id?closed:s);
    enqueueCashTransaction(next,{kind:"close",session:closed});
    persistCommand(next);setCloseAmount("");
    setMessage(Math.abs(difference)<=.005?"Caja cerrada y cuadrada · pendiente de confirmación Cloud":`Caja cerrada · ${difference>0?"sobrante":"faltante"} $${Math.abs(difference).toFixed(2)}`);
  };

  const payCredit=(creditId:string)=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),credit=next.credits.find(c=>c.id===creditId);
    const amount=Number(paymentDraft[creditId]),method=paymentMethodDraft[creditId]??"cash";
    if(!credit||credit.kind==="partial"||credit.status!=="open"){setMessage("Ese fiado ya no está pendiente");return}
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
    next.credits=next.fiadoCredits.map(c=>c.id===creditId?updatedCredit:c);

    let cashMovement:CashMovementRecord|undefined;
    if(method==="cash"&&session){
      cashMovement={
        id:makeId("movement"),tenantId:workspace.tenantId,branchId:workspace.branchId,sessionId:session.id,type:"in",
        amount:Number(applied.toFixed(2)),reason:creditPaymentCashMovementReason(payment.id,credit.description,credit.kind==="partial"?"partial":"fiado"),createdAt:now
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
    {staleSession&&<div className="report-note"><strong>⚠ Turno abierto hace {Math.floor(sessionAgeHours)} horas</strong><span>Cierra esta caja, cuenta el efectivo físico y abre un turno nuevo. Mantener una misma caja abierta varios días acumula ventas de fechas distintas y hace imposible un cierre diario confiable.</span></div>}
    <section className="ops-grid">
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">CAJA · {ctx.branch?.name}</span><h3>{openSession?"Turno en curso":"Abrir turno"}</h3></div><span className={openSession?"status status-active":"status status-suspended"}>{openSession?"ABIERTA":"CERRADA"}</span></div>{!openSession?<form className="ops-form" onSubmit={openCash}><label>Fondo inicial<input name="opening" type="number" min="0" step="0.01" defaultValue="0"/></label><button className="button primary" type="submit">Abrir caja</button></form>:<><div className="cash-metrics"><div><span>Inicial</span><strong>${cashSummary?.opening.toFixed(2)}</strong></div><div><span>Ventas efectivo</span><strong>${cashSummary?.cashSales.toFixed(2)}</strong></div><div><span>Abonos efectivo</span><strong>${cashSummary?.creditCollections.toFixed(2)}</strong></div><div><span>Otros ingresos</span><strong>${cashSummary?.manualIncome.toFixed(2)}</strong></div><div><span>Egresos</span><strong>${cashSummary?.cashOut.toFixed(2)}</strong></div><div><span>Esperado</span><strong>${cashSummary?.expected.toFixed(2)}</strong></div></div><form className="ops-form ops-form-3" onSubmit={addMovement}><select name="type"><option value="in">Ingreso</option><option value="out">Egreso</option></select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required/><input name="reason" placeholder="Motivo" required/><button className="button secondary" type="submit">Registrar</button></form><section className={styles.closeBox}><div className={styles.closeHead}><div><span>CIERRE DE TURNO</span><strong>Compara y cierra</strong></div><small>Abierta desde {new Date(openSession.openedAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</small></div><div className={styles.turnSummary}><div><span>Efectivo esperado</span><b>${cashSummary?.expected.toFixed(2)}</b></div><div><span>Transferencias</span><b>${transferTurn.toFixed(2)}</b></div><div><span>Fiados del turno</span><b>${creditTurn.toFixed(2)}</b></div><div><span>Anulaciones</span><b>{voidedTurn}</b></div></div><button className={styles.detailToggle} type="button" onClick={()=>setCashDetailOpen(value=>!value)}>{cashDetailOpen?"Ocultar detalle":"Ver cómo se calcula el efectivo esperado"}</button>{cashDetailOpen&&<div className={styles.cashDetail}>{cashEntries.map(entry=><div className={styles.cashDetailRow} key={entry.id}><div><strong>{entry.label}</strong><span>{new Date(entry.at).toLocaleString("es-EC")}{entry.detail?` · ${entry.detail}`:""}</span></div><b className={entry.amount<0?styles.negative:""}>{entry.amount<0?"−":"+"}${Math.abs(entry.amount).toFixed(2)}</b></div>)}<div className={styles.cashDetailTotal}><span>Efectivo esperado</span><strong>${cashSummary?.expected.toFixed(2)}</strong></div><small>Las transferencias no se suman al cajón. Solo aparecen aquí movimientos de efectivo físico.</small></div>}<div className={styles.countRow}><label><span>¿Cuánto efectivo hay realmente?</span><input value={closeAmount} onChange={e=>setCloseAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Efectivo contado"/></label>{closeDifference!==undefined&&<div className={`${styles.difference} ${Math.abs(closeDifference)>.005?styles.differenceBad:""}`}>{Math.abs(closeDifference)<=.005?"CUADRADA":`${closeDifference>0?"SOBRA":"FALTA"} $${Math.abs(closeDifference).toFixed(2)}`}</div>}</div><div className={styles.closeAction}><small>Cuenta solo el efectivo físico: fondo inicial + ventas en efectivo + abonos en efectivo + otros ingresos − egresos. Las transferencias no se cuentan en el cajón.</small><button className="button primary" disabled={!Number.isFinite(closeValue)||closeValue<0} onClick={closeCash}>Confirmar cierre</button></div></section></>}</article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">FIADOS · {ctx.branch?.name}</span><h3>Cuentas por cobrar</h3></div><span className="pill">${fiadoCredits.filter(c=>c.status==="open").reduce((n,c)=>n+c.balance,0).toFixed(2)} pendiente</span></div><div className="ops-list">{fiadoCredits.length===0?<p className="empty-cart">Cuando cobres una venta como Fiado aparecerá aquí.</p>:fiadoCredits.map(c=>{const customer=customers.find(x=>x.id===c.customerId);return <div className="credit-row" key={c.id}><div><strong>{customer?.name??"Cliente"}</strong><span>{c.description} · Original ${c.originalAmount.toFixed(2)}</span></div><b>${c.balance.toFixed(2)}</b>{c.status==="open"?<><input value={paymentDraft[c.id]??""} onChange={e=>setPaymentDraft(v=>({...v,[c.id]:e.target.value}))} type="number" min="0.01" step="0.01" placeholder="Abono"/><select value={paymentMethodDraft[c.id]??"cash"} onChange={e=>setPaymentMethodDraft(v=>({...v,[c.id]:e.target.value as CreditPaymentMethod}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select><button className="button secondary compact" onClick={()=>payCredit(c.id)}>Abonar</button></>:<span className="status status-active">PAGADO</span>}</div>})}</div></article>
    </section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">REGLAS DE CAJA</span><h3>Comportamiento del negocio</h3></div></div><div className="cash-metrics"><div><span>Efectivo</span><strong>{settings.requireCashSession?"Exige caja abierta":"Caja opcional"}</strong></div><div><span>Fiados</span><strong>{settings.allowCredit?"Permitidos":"Desactivados"}</strong></div><div><span>Cloud</span><strong>Sincronización automática</strong></div></div></section>
  </>;
}
