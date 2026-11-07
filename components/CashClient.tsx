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
import { pendingTurnFinancialOperations,unverifiedDenominationMovements } from "@/lib/cash-close-review";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import { enqueueCashTransaction,enqueueCreditPaymentTransaction } from "@/lib/finance-transaction";
import { creditPaymentCashMovementReason,outstandingBalanceKind } from "@/lib/order-payments";
import { saleLifecycle } from "@/lib/sale-reversal";
import { transferPaymentEvents,totalValidTransfers } from "@/lib/transfer-events";
import { cashPaymentEvents,totalValidCash } from "@/lib/cash-payment-events";
import { businessDateKey,businessTimeZone,businessTodayKey,addBusinessDays,businessDateLabel } from "@/lib/business-time";
import styles from "./CashClient.module.css";

type CreditPaymentMethod="cash"|"transfer";

export function CashClient(){
  const[db,setDb]=useState<KiuboLocalDatabase|null>(null);
  const[closeAmount,setCloseAmount]=useState("");
  const[paymentDraft,setPaymentDraft]=useState<Record<string,string>>({});
  const[paymentMethodDraft,setPaymentMethodDraft]=useState<Record<string,CreditPaymentMethod>>({});
  const[message,setMessage]=useState("Caja lista");
  const[cashDetailOpen,setCashDetailOpen]=useState(false);
  const[transferDate,setTransferDate]=useState("");
  const[transferDetailOpen,setTransferDetailOpen]=useState(true);
  const[bankVerified,setBankVerified]=useState("");
  const[manualCashReviewed,setManualCashReviewed]=useState(false);
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{
    refresh();
    const onStorage=()=>refresh();
    window.addEventListener(KIUBO_DATA_REFRESHED,onStorage);
    window.addEventListener("storage",onStorage);
    return()=>{window.removeEventListener(KIUBO_DATA_REFRESHED,onStorage);window.removeEventListener("storage",onStorage)};
  },[]);
  if(!db)return <div className="loading-card">Preparando caja…</div>;

  const ctx=getWorkspaceContext(db);
  const customers=db.customers.filter(c=>c.tenantId===ctx.tenantId);
  const credits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&c.branchId===ctx.branchId);
  const fiadoCredits=credits.filter(c=>outstandingBalanceKind(db,c)!=="partial");
  const openSession=getOpenCashSession(db,ctx.tenantId,ctx.branchId);
  const settings=getTenantSettings(db,ctx.tenantId);
  const persistCommand=(next:KiuboLocalDatabase)=>{saveLocalDatabase(next,{trackChanges:false});refresh()};
  const cashSummary=openSession?reconcileCashSession(db,openSession):null;
  const cashEntries=openSession?cashReconciliationEntries(db,openSession):[];
  const ambiguousMovements=openSession?unverifiedDenominationMovements(db,ctx.tenantId,ctx.branchId,openSession.id):[];
  const ambiguousTotal=ambiguousMovements.reduce((sum,m)=>sum+m.amount,0);
  const bankValue=bankVerified.trim()?Number(bankVerified):NaN;
  const bankDifference=Number.isFinite(bankValue)?Number((bankValue-(openSession?totalValidTransfers(transferPaymentEvents(db,ctx.tenantId,ctx.branchId).filter(row=>Date.parse(row.at)>=Date.parse(openSession.openedAt))):0)).toFixed(2)):undefined;
  const unsyncedTurnOperations=openSession?pendingTurnFinancialOperations(db,ctx.tenantId,ctx.branchId,openSession.openedAt):0;
  const closeValue=closeAmount.trim()?Number(closeAmount):NaN;
  const closeDifference=cashSummary&&Number.isFinite(closeValue)?Number((closeValue-cashSummary.expected).toFixed(2)):undefined;
  const sessionStarted=openSession?Date.parse(openSession.openedAt):0;
  const sessionAgeHours=openSession?Math.max(0,(Date.now()-sessionStarted)/(60*60*1000)):0;
  const staleSession=Boolean(openSession&&sessionAgeHours>24);
  const turnSales=openSession?db.sales.filter(sale=>sale.tenantId===ctx.tenantId&&sale.branchId===ctx.branchId&&Date.parse(sale.createdAt)>=sessionStarted):[];
  const completedTurnSales=turnSales.filter(sale=>saleLifecycle(sale)==="completed");
  const timeZone=businessTimeZone(settings.timeZone);
  const transfers=transferPaymentEvents(db,ctx.tenantId,ctx.branchId);
  const sessionTransfers=openSession?transfers.filter(row=>Date.parse(row.at)>=sessionStarted):[];
  const transferTurn=totalValidTransfers(sessionTransfers);
  const selectedTransferDate=transferDate||businessTodayKey(timeZone);
  const visibleTransfers=transfers.filter(row=>selectedTransferDate==="all"||businessDateKey(row.at,timeZone)===selectedTransferDate);
  const selectedTransferTotal=totalValidTransfers(visibleTransfers);
  const cashPayments=cashPaymentEvents(db,ctx.tenantId,ctx.branchId);
  const visibleCashPayments=cashPayments.filter(row=>selectedTransferDate==="all"||businessDateKey(row.at,timeZone)===selectedTransferDate);
  const selectedCashTotal=totalValidCash(visibleCashPayments);
  const cashToReview=visibleCashPayments.filter(row=>row.status==="revisar").length;
  const transferToReview=visibleTransfers.filter(row=>row.status==="revisar").length;
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
    if(getWorkspaceContext(loadLocalDatabase()).user?.role==="cashier"){setMessage("Solo el administrador puede registrar movimientos manuales de caja.");return}
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),session=getOpenCashSession(next,workspace.tenantId,workspace.branchId);
    if(!session){setMessage("Primero abre caja");return}
    const f=new FormData(e.currentTarget),amount=Number(f.get("amount")||0),type=String(f.get("type")) as "in"|"out",reason=String(f.get("reason")||"").trim();
    if(!Number.isFinite(amount)||amount<=0||!reason||!["in","out"].includes(type)){setMessage("Completa un monto, tipo y motivo válidos");return}
    if(type==="in"&&unverifiedDenominationMovements({...next,cashMovements:[{tenantId:workspace.tenantId,branchId:workspace.branchId,sessionId:session.id,type,amount,reason,createdAt:new Date().toISOString(),id:"new"} as CashMovementRecord]},workspace.tenantId,workspace.branchId,session.id).length){
      setMessage("Cambiar billetes por monedas NO es un ingreso nuevo. Registra un ingreso únicamente si agregaste dinero desde fuera de la caja.");
      return;
    }
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
    const pending=pendingTurnFinancialOperations(next,workspace.tenantId,workspace.branchId,session.openedAt);
    if(pending>0){setMessage(`No cierres aún: hay ${pending} cobro(s) o movimiento(s) por sincronizar con Cloud. Confirma la conexión y vuelve a intentar.`);return}
    const suspect=unverifiedDenominationMovements(next,workspace.tenantId,workspace.branchId,session.id);
    if(suspect.length&&!manualCashReviewed){setMessage("Revisa los ingresos manuales marcados (monedas o cambio de billetes) antes de cerrar.");return}
    const reconciliation=reconcileCashSession(next,session),difference=Number((amount-reconciliation.expected).toFixed(2));
    if(Math.abs(difference)>.005&&!window.confirm(`El efectivo contado ${difference>0?"SOBRA":"FALTA"} $ ${Math.abs(difference).toFixed(2)}. ¿Ya revisaste el cajón y quieres cerrar con esta diferencia real registrada?`))return;
    const closed:CashSessionRecord={...session,status:"closed",closingAmount:Number(amount.toFixed(2)),closedAt:new Date().toISOString()};
    next.cashSessions=next.cashSessions.map(s=>s.id===session.id?closed:s);
    enqueueCashTransaction(next,{kind:"close",session:closed});
    persistCommand(next);setCloseAmount("");setManualCashReviewed(false);setBankVerified("");
    setMessage(Math.abs(difference)<=.005?"Caja cerrada y cuadrada · pendiente de confirmación Cloud":`Caja cerrada · ${difference>0?"sobrante":"faltante"} $${Math.abs(difference).toFixed(2)}`);
  };

  const payCredit=(creditId:string)=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),credit=next.credits.find(c=>c.id===creditId);
    const amount=Number(paymentDraft[creditId]),method=paymentMethodDraft[creditId]??"cash";
    if(!credit||outstandingBalanceKind(next,credit)==="partial"||credit.status!=="open"){setMessage("Ese fiado ya no está pendiente");return}
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
        amount:Number(applied.toFixed(2)),reason:creditPaymentCashMovementReason(payment.id,credit.description,"fiado"),createdAt:now
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
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">CAJA · {ctx.branch?.name}</span><h3>{openSession?"Turno en curso":"Abrir turno"}</h3></div><span className={openSession?"status status-active":"status status-suspended"}>{openSession?"ABIERTA":"CERRADA"}</span></div>{!openSession?<form className="ops-form" onSubmit={openCash}><label>Fondo inicial<input name="opening" type="number" min="0" step="0.01" defaultValue="0"/></label><button className="button primary" type="submit">Abrir caja</button></form>:<><div className="cash-metrics"><div><span>Inicial</span><strong>${cashSummary?.opening.toFixed(2)}</strong></div><div><span>Ventas efectivo</span><strong>${cashSummary?.cashSales.toFixed(2)}</strong></div><div><span>Abonos efectivo</span><strong>${cashSummary?.creditCollections.toFixed(2)}</strong></div><div><span>Otros ingresos</span><strong>${cashSummary?.manualIncome.toFixed(2)}</strong></div><div><span>Egresos</span><strong>${cashSummary?.cashOut.toFixed(2)}</strong></div><div><span>Esperado</span><strong>${cashSummary?.expected.toFixed(2)}</strong></div></div>{ctx.user?.role!=="cashier"&&<form className="ops-form ops-form-3" onSubmit={addMovement}><select name="type" aria-label="Movimiento del dinero físico"><option value="in">Dinero nuevo que entra</option><option value="out">Gasto o retiro de caja</option></select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required/><input name="reason" placeholder="Motivo" required/><button className="button secondary" type="submit">Registrar</button><p className={styles.manualHint}>Cambiar billetes por monedas NO suma dinero a caja. No registres ese cambio como ingreso o egreso.</p></form>}<section className={styles.closeBox}><div className={styles.closeHead}><div><span>CIERRE DE TURNO</span><strong>Compara y cierra</strong></div><small>Abierta desde {new Date(openSession.openedAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</small></div><div className={styles.turnSummary}><div><span>Efectivo esperado en el cajón</span><b>${cashSummary?.expected.toFixed(2)}</b></div><div><span>Transferencias registradas (verificar banco)</span><b>${transferTurn.toFixed(2)}</b></div><div><span>Fiados del turno</span><b>${creditTurn.toFixed(2)}</b></div><div><span>Anulaciones</span><b>{voidedTurn}</b></div></div><section className={styles.guidedClose} aria-label="Pasos para cuadrar caja">
  <h4>Cuadre fácil · 3 pasos</h4>
  <p><b>1. Cuenta el efectivo físico.</b> Incluye fondo inicial, billetes y monedas; NO sumes las transferencias.</p>
  <p><b>2. Revisa el banco.</b> Compara las transferencias de este turno con lo recibido en la cuenta bancaria.</p>
  <p><b>3. Revisa los movimientos manuales</b> y registra el efectivo contado. Solo después confirma el cierre.</p>
  <div className={styles.simpleSplit}>
    <div><span>Efectivo puro de ventas</span><b>${((cashSummary?.cashSales||0)-(cashSummary?.mixedCashSales||0)).toFixed(2)}</b></div>
    <div><span>Efectivo de pagos mixtos</span><b>${(cashSummary?.mixedCashSales||0).toFixed(2)}</b></div>
    <div><span>Transferencias del turno</span><b>${transferTurn.toFixed(2)}</b><small>En el banco, NO en el cajón</small></div>
  </div>
  {unsyncedTurnOperations>0&&<p className={styles.warning}><strong>Falta sincronizar:</strong> {unsyncedTurnOperations} cobro(s) o movimiento(s). No cierres hasta que Cloud los confirme.</p>}
  {ambiguousMovements.length>0&&<div className={styles.warning}>
    <strong>Revisar ingreso manual: ${ambiguousTotal.toFixed(2)}</strong>
    {ambiguousMovements.map(m=><span key={m.id}>{m.reason}: ${m.amount.toFixed(2)}</span>)}
    <small>Si solo cambiaste billetes por monedas, ese dinero ya estaba en el cajón y NO debe contarse dos veces. No corregimos automáticamente los registros: el administrador debe comprobar qué ocurrió.</small>
    <label className={styles.reviewCheck}><input type="checkbox" checked={manualCashReviewed} onChange={e=>setManualCashReviewed(e.target.checked)}/> Ya comprobé que este ingreso corresponde a dinero realmente añadido desde fuera de la caja, o que el cierre registrará conscientemente la diferencia.</label>
  </div>}
  <label className={styles.bankCheck}>Transferencias recibidas en el banco (opcional)
    <input value={bankVerified} onChange={e=>setBankVerified(e.target.value)} type="number" min="0" step="0.01" placeholder="Total verificado en el banco" />
  </label>
  {bankDifference!==undefined&&<p className={Math.abs(bankDifference)<=.005?styles.bankMatch:styles.warning}>
    {Math.abs(bankDifference)<=.005?"Transferencias coinciden con el banco.":`Diferencia bancaria: ${bankDifference>0?"$"+bankDifference.toFixed(2)+" más en banco":"$"+Math.abs(bankDifference).toFixed(2)+" por verificar"}.`}
  </p>}
</section>
<button className={styles.detailToggle} type="button" onClick={()=>setCashDetailOpen(value=>!value)}>{cashDetailOpen?"Ocultar detalle":"Ver cómo se calcula el efectivo esperado"}</button>{cashDetailOpen&&<div className={styles.cashDetail}>{cashEntries.map(entry=><div className={styles.cashDetailRow} key={entry.id}><div><strong>{entry.label}</strong><span>{new Date(entry.at).toLocaleString("es-EC")}{entry.detail?` · ${entry.detail}`:""}</span></div><b className={entry.amount<0?styles.negative:""}>{entry.amount<0?"−":"+"}${Math.abs(entry.amount).toFixed(2)}</b></div>)}<div className={styles.cashDetailTotal}><span>Efectivo esperado</span><strong>${cashSummary?.expected.toFixed(2)}</strong></div><small>Las transferencias no se suman al cajón. Solo aparecen aquí movimientos de efectivo físico.</small></div>}<div className={styles.countRow}><label><span>¿Cuánto efectivo hay realmente?</span><input value={closeAmount} onChange={e=>setCloseAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Efectivo contado"/></label>{closeDifference!==undefined&&<div className={`${styles.difference} ${Math.abs(closeDifference)>.005?styles.differenceBad:""}`}>{Math.abs(closeDifference)<=.005?"CUADRADA":`${closeDifference>0?"SOBRA":"FALTA"} $${Math.abs(closeDifference).toFixed(2)}`}</div>}</div><div className={styles.closeAction}><small>Cuenta solo el efectivo físico: fondo inicial + ventas en efectivo + abonos en efectivo + otros ingresos − egresos. Las transferencias no se cuentan en el cajón.</small><button className="button primary" disabled={!Number.isFinite(closeValue)||closeValue<0||unsyncedTurnOperations>0||(ambiguousMovements.length>0&&!manualCashReviewed)} onClick={closeCash}>Confirmar cierre</button></div></section></>}</article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">FIADOS · {ctx.branch?.name}</span><h3>Cuentas por cobrar</h3></div><span className="pill">${fiadoCredits.filter(c=>c.status==="open").reduce((n,c)=>n+c.balance,0).toFixed(2)} pendiente</span></div><div className="ops-list">{fiadoCredits.length===0?<p className="empty-cart">Cuando cobres una venta como Fiado aparecerá aquí.</p>:fiadoCredits.map(c=>{const customer=customers.find(x=>x.id===c.customerId);return <div className="credit-row" key={c.id}><div><strong>{customer?.name??"Cliente"}</strong><span>{c.description} · Original ${c.originalAmount.toFixed(2)}</span></div><b>${c.balance.toFixed(2)}</b>{c.status==="open"?<><input value={paymentDraft[c.id]??""} onChange={e=>setPaymentDraft(v=>({...v,[c.id]:e.target.value}))} type="number" min="0.01" step="0.01" placeholder="Abono"/><select value={paymentMethodDraft[c.id]??"cash"} onChange={e=>setPaymentMethodDraft(v=>({...v,[c.id]:e.target.value as CreditPaymentMethod}))}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select><button className="button secondary compact" onClick={()=>payCredit(c.id)}>Abonar</button></>:<span className="status status-active">PAGADO</span>}</div>})}</div></article>
    </section>
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">COBROS DEL PERÍODO · {ctx.branch?.name}</span><h3>Efectivo y transferencias</h3></div><strong>${(selectedCashTotal+selectedTransferTotal).toFixed(2)} recibido</strong></div>
      <div className={styles.turnSummary}><div><span>Efectivo recibido</span><b>${selectedCashTotal.toFixed(2)}</b></div><div><span>Transferencia recibida</span><b>${selectedTransferTotal.toFixed(2)}</b></div></div><p className={styles.transferFootnote}>Estos son cobros registrados del período seleccionado (Hoy, Ayer o una fecha). El cierre de turno puede abarcar otro horario. Las transferencias deben verificarse en el banco; no incluyen fondo inicial ni movimientos manuales.</p>
      <div className={styles.transferControls}>
        <button type="button" onClick={()=>setTransferDate("")}>Hoy</button>
        <button type="button" onClick={()=>setTransferDate(addBusinessDays(businessTodayKey(timeZone),-1))}>Ayer</button>
        <button type="button" onClick={()=>setTransferDate("all")}>Todo el historial</button>
        <label>Fecha <input type="date" value={selectedTransferDate==="all"?"":selectedTransferDate} onChange={event=>setTransferDate(event.target.value||"")} /></label>
        <button type="button" onClick={()=>setTransferDetailOpen(open=>!open)}>{transferDetailOpen?"Ocultar movimientos":"Ver movimientos"}</button>
      </div>
      <div className={styles.transferList}>
        <strong>Movimientos de efectivo</strong>
        {visibleCashPayments.length===0?<p className="empty-cart">Sin pagos en efectivo para este período.</p>:visibleCashPayments.map(row=><div className={styles.transferRow} key={row.id}><div><strong>{row.label}</strong><small>{businessDateLabel(row.at,timeZone,{dateStyle:"short",timeStyle:"short"})}{row.saleId?` · Venta ${row.saleId.slice(-8)}`:""}</small></div><div className={styles.transferAmount}><b>${row.amount.toFixed(2)}</b><span>{row.status==="registrada"?"Registrada":row.status==="anulada"?"Anulada":"Revisar"}</span></div></div>)}
        <div className={styles.cashDetailTotal}><span>Total efectivo válido</span><strong>${selectedCashTotal.toFixed(2)}</strong></div>
      </div>
      {cashToReview>0&&<p className={styles.transferWarning}>{cashToReview} cobro(s) en efectivo requieren revisión y no se incluyen en el total válido.</p>}
      <h3 style={{margin:"14px 17px 0"}}>Detalle de transacciones por transferencia</h3>
      {transferToReview>0&&<p className={styles.transferWarning}>{transferToReview} operación(es) requieren revisión del desglose y no se incluyen en el total confirmado.</p>}
      {transferDetailOpen&&<div className={styles.transferList}>
        {visibleTransfers.length===0?<p className="empty-cart">No existen transferencias registradas para este filtro.</p>:visibleTransfers.map(row=><div className={styles.transferRow} key={row.id}>
          <div><strong>{row.label} · {row.service||"Venta"}</strong><small>{businessDateLabel(row.at,timeZone,{dateStyle:"short",timeStyle:"short"})} · {row.saleId?`Venta ${row.saleId.slice(-8)}`:"Abono"}{row.customerName?` · ${row.customerName}`:""}{row.note?` · ${row.note}`:""}</small></div>
          <div className={styles.transferAmount}><b>${row.amount.toFixed(2)}</b><span>{row.status==="registrada"?"Registrada":row.status==="anulada"?"Anulada":"Revisar"}</span>{row.saleId&&<a href={`/receipt?sale=${encodeURIComponent(row.saleId)}`} target="_blank" rel="noreferrer">Ver venta</a>}</div>
        </div>)}
        <div className={styles.cashDetailTotal}><span>Total válido mostrado (sin anuladas ni incidencias)</span><strong>${selectedTransferTotal.toFixed(2)}</strong></div>
      </div>}
      <p className={styles.transferFootnote}>Las transferencias no forman parte del efectivo físico. Una venta anulada no confirma por sí sola una devolución bancaria.</p>
    </section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">REGLAS DE CAJA</span><h3>Comportamiento del negocio</h3></div></div><div className="cash-metrics"><div><span>Efectivo</span><strong>{settings.requireCashSession?"Exige caja abierta":"Caja opcional"}</strong></div><div><span>Fiados</span><strong>{settings.allowCredit?"Permitidos":"Desactivados"}</strong></div><div><span>Cloud</span><strong>Sincronización automática</strong></div></div></section>
  </>;
}
