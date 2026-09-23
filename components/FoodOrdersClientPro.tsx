"use client";

import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { CashMovementRecord,CreditPaymentRecord,FoodOrderRecord,FoodOrderStatus,getOpenCashSession,getTenantSettings,getWorkspaceContext,loadLocalDatabase,makeId,saveLocalDatabase } from "@/lib/local-store";
import { enqueueCreditPaymentTransaction } from "@/lib/finance-transaction";
import { creditPaymentCashMovementReason,orderPaymentSummary } from "@/lib/order-payments";
import { orderVisibleAfterHistoryReset } from "@/lib/sale-adjustments";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./FoodOrdersClient.module.css";
import paymentStyles from "./FoodOrderPayments.module.css";

const CHECKOUT_KEY="kiubo.food.checkout.order.v1";
const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const activeMeta:{key:FoodOrderStatus;label:string;hint:string;next:FoodOrderStatus;action:string}[]=[
  {key:"new",label:"Por preparar",hint:"Pedidos que acaba de recibir cocina",next:"preparing",action:"Empezar preparación"},
  {key:"preparing",label:"En preparación",hint:"Lo que se está preparando ahora",next:"ready",action:"Marcar listo"},
  {key:"ready",label:"Listos",hint:"Esperando entrega al cliente",next:"delivered",action:"Entregar"},
];
const modeLabel:Record<FoodOrderRecord["serviceMode"],string>={counter:"Mostrador",table:"Mesa",takeaway:"Para llevar",delivery:"Domicilio"};
type OrdersView="pending"|"kitchen"|"history";
type FoodOrderWorkflow="simple"|"kitchen";

export function FoodOrdersClientPro(){
  const router=useRouter();
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[filter,setFilter]=useState<"all"|FoodOrderRecord["serviceMode"]>("all");
  const[view,setView]=useState<OrdersView>("pending");
  const[message,setMessage]=useState("");
  const[cancelArmedId,setCancelArmedId]=useState("");
  const[paymentOrderId,setPaymentOrderId]=useState("");
  const[paymentDraft,setPaymentDraft]=useState("");
  const[paymentMethod,setPaymentMethod]=useState<"cash"|"transfer">("cash");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  useEffect(()=>{if(!cancelArmedId)return;const timer=window.setTimeout(()=>setCancelArmedId(""),3500);return()=>window.clearTimeout(timer)},[cancelArmedId]);
  if(!db)return <div className="loading-card">Preparando pedidos…</div>;

  const ctx=getWorkspaceContext(db),settings=getTenantSettings(db,ctx.tenantId);
  if(settings.businessType!=="food_service")return <div className="panel"><h2>Pedidos no está activado</h2><p>Este espacio no utiliza el perfil Food Service.</p></div>;

  const settingsWithWorkflow=settings as typeof settings&{foodOrderWorkflow?:FoodOrderWorkflow};
  const workflow:FoodOrderWorkflow=settingsWithWorkflow.foodOrderWorkflow==="kitchen"?"kitchen":"simple";
  const simpleFlow=workflow==="simple";
  const activeView:OrdersView=simpleFlow&&view==="kitchen"?"pending":view;
  const orders=db.orders.filter(order=>order.tenantId===ctx.tenantId&&order.branchId===ctx.branchId&&order.status!=="cancelled").sort((a,b)=>Date.parse(b.updatedAt||b.createdAt)-Date.parse(a.updatedAt||a.createdAt));
  const filteredOrders=filter==="all"?orders:orders.filter(order=>order.serviceMode===filter);
  const pendingOrders=filteredOrders.filter(order=>order.paymentStatus!=="paid"&&order.status!=="delivered");
  const kitchenOrders=filteredOrders.filter(order=>order.status!=="delivered");
  const historyOrders=filteredOrders.filter(order=>(order.status==="delivered"||(simpleFlow&&order.paymentStatus==="paid"))&&orderVisibleAfterHistoryReset(order,settings));
  const visibleActive=activeView==="pending"?pendingOrders:kitchenOrders;
  const grouped=new Map(activeMeta.map(meta=>[meta.key,visibleActive.filter(order=>order.status===meta.key)]));
  const paidInKitchen=kitchenOrders.filter(order=>order.paymentStatus==="paid").length;

  const registerPayment=(order:FoodOrderRecord)=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),current=next.orders.find(item=>item.id===order.id&&item.tenantId===workspace.tenantId&&item.branchId===workspace.branchId),credit=current?.saleId?next.credits.find(item=>item.saleId===current.saleId&&item.status==="open"):undefined,amount=Number(paymentDraft);
    if(!current||!credit){setMessage("No encontramos el saldo pendiente de este pedido. Actualiza y vuelve a intentar.");return}
    if(!Number.isFinite(amount)||amount<=0){setMessage("Ingresa un abono válido");return}
    const applied=Number(Math.min(amount,credit.balance).toFixed(2)),settingsNow=getTenantSettings(next,workspace.tenantId),cashSession=getOpenCashSession(next,workspace.tenantId,workspace.branchId);
    if(paymentMethod==="cash"&&cashSession&&Date.now()-Date.parse(cashSession.openedAt)>24*60*60*1000){setMessage("Esta caja lleva abierta más de 24 horas. Ciérrala y abre un turno nuevo antes de registrar otro abono en efectivo.");return}
    if(paymentMethod==="cash"&&settingsNow.requireCashSession&&!cashSession){setMessage("Abre caja antes de recibir un abono en efectivo");return}
    const now=new Date().toISOString(),payment:CreditPaymentRecord={id:makeId("credit-payment"),tenantId:workspace.tenantId,branchId:workspace.branchId,creditId:credit.id,amount:applied,method:paymentMethod,createdAt:now};payment.clientOperationId=payment.id;
    const remaining=Number((credit.balance-applied).toFixed(2)),updatedCredit={...credit,balance:remaining,status:(remaining<=.001?"paid":"open") as "open"|"paid"},orderBefore={...current,items:current.items.map(item=>({...item}))},orderAfter:FoodOrderRecord={...current,paymentStatus:remaining<=.001?"paid":"partial",updatedAt:now};
    next.creditPayments.unshift(payment);next.credits=next.credits.map(item=>item.id===credit.id?updatedCredit:item);next.orders=next.orders.map(item=>item.id===current.id?orderAfter:item);
    let cashMovement:CashMovementRecord|undefined;if(paymentMethod==="cash"&&cashSession){const movementId=makeId("movement");cashMovement={id:movementId,tenantId:workspace.tenantId,branchId:workspace.branchId,sessionId:cashSession.id,type:"in",amount:applied,reason:creditPaymentCashMovementReason(payment.id,credit.description,credit.kind==="partial"?"partial":"fiado"),clientOperationId:movementId,createdAt:now};next.cashMovements.unshift(cashMovement)}
    enqueueCreditPaymentTransaction(next,{payment,creditSnapshot:updatedCredit,cashMovement,orderBefore,orderAfter});saveLocalDatabase(next,{trackChanges:false});setDb(next);setPaymentDraft("");setPaymentOrderId(remaining<=.001?"":order.id);setMessage(remaining<=.001?`Pedido #${String(order.number).padStart(4,"0")} pagado por completo.`:`Abono ${money(applied)} registrado · saldo ${money(remaining)}.`);
  };

  const changeStatus=(order:FoodOrderRecord,status:FoodOrderStatus)=>{
    if(status==="delivered"&&order.paymentStatus!=="paid"){setMessage(`Pedido #${String(order.number).padStart(4,"0")} todavía está pendiente de cobro. Cóbalo antes de finalizarlo.`);setView("pending");return}
    const next=loadLocalDatabase(),index=next.orders.findIndex(item=>item.id===order.id&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId);if(index<0)return;
    next.orders[index]={...next.orders[index],status,updatedAt:new Date().toISOString()};
    saveLocalDatabase(next);refresh();setMessage(`Pedido #${String(order.number).padStart(4,"0")} · ${status==="preparing"?"en preparación":status==="ready"?"listo":status==="delivered"?"finalizado":"actualizado"}.`);
  };
  const cancelPending=(order:FoodOrderRecord)=>{
    if(order.paymentStatus!=="unpaid"){setMessage("Este pedido ya tiene cobros registrados. No se puede cancelar como si nunca hubiera sido cobrado.");return}
    if(cancelArmedId!==order.id){setCancelArmedId(order.id);setMessage(`Confirma la cancelación del pedido #${String(order.number).padStart(4,"0")}: toca “Cancelar pedido” otra vez.`);return}
    const next=loadLocalDatabase(),index=next.orders.findIndex(item=>item.id===order.id&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId&&item.paymentStatus==="unpaid");if(index<0)return;
    next.orders[index]={...next.orders[index],status:"cancelled",updatedAt:new Date().toISOString()};
    saveLocalDatabase(next);setCancelArmedId("");refresh();setMessage(`Pedido #${String(order.number).padStart(4,"0")} cancelado. No modificó caja porque nunca fue cobrado.`);
  };
  const checkout=(order:FoodOrderRecord)=>{window.sessionStorage.setItem(CHECKOUT_KEY,order.id);router.push("/pos")};
  const printUrl=(order:FoodOrderRecord)=>`/order-print?order=${encodeURIComponent(order.id)}`;
  const openPos=()=>{window.sessionStorage.removeItem(CHECKOUT_KEY);router.push("/pos")};

  const orderCard=(order:FoodOrderRecord,meta?:typeof activeMeta[number])=>{
    const payment=orderPaymentSummary(db,order),partial=order.paymentStatus==="partial",paymentOpen=paymentOrderId===order.id;
    return <article className={styles.card} key={order.id}>
      <div className={styles.cardTop}><strong>#{String(order.number).padStart(4,"0")}</strong><span className={styles.mode}>{order.serviceMode==="table"&&order.tableLabel?`Mesa ${order.tableLabel}`:modeLabel[order.serviceMode]}</span></div>
      <div className={styles.customer}><strong>{order.customerName||order.tableLabel&&`Mesa ${order.tableLabel}`||"Cliente en local"}</strong>{order.phone&&<span>{order.phone}</span>}{order.address&&<span>{order.address}</span>}</div>
      <div className={styles.items}>{order.items.slice(0,6).map((item,index)=><div className={styles.item} key={`${item.productId}-${index}`}><span><b>{item.qty}×</b> {item.name}</span><span>{money(item.qty*item.unitPrice)}</span></div>)}{order.items.length>6&&<div className={styles.item}><span>+ {order.items.length-6} productos</span></div>}</div>
      {order.notes&&<div className={styles.orderNote}>Nota: {order.notes}</div>}
      <div className={styles.total}><span className={order.paymentStatus==="paid"?styles.paid:styles.pending}>{order.paymentStatus==="paid"?"✓ Pagado":partial?`Abonado ${money(payment.paid)}`:"Pendiente de cobro"}</span><strong>{partial?`Saldo ${money(payment.balance)}`:money(order.total)}</strong></div>
      {partial&&<div className={paymentStyles.paymentDetail}><span>{payment.label}</span><b>Total {money(order.total)}</b></div>}
      {paymentOpen&&partial&&<div className={paymentStyles.paymentForm}><input value={paymentDraft} onChange={event=>setPaymentDraft(event.target.value)} type="number" min="0.01" max={payment.balance} step="0.01" inputMode="decimal" placeholder={`Máximo ${payment.balance.toFixed(2)}`}/><select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value as "cash"|"transfer")}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select><button onClick={()=>registerPayment(order)}>Guardar abono</button></div>}
      <div className={styles.actions}>
        {order.paymentStatus==="unpaid"&&<button className={styles.checkout} aria-label="Cobrar en POS" onClick={()=>checkout(order)}>Cobrar en POS</button>}
        {partial&&<button className={styles.checkout} onClick={()=>{setPaymentOrderId(value=>value===order.id?"":order.id);setPaymentDraft("")}}>{paymentOpen?"Cerrar abono":`Registrar abono · saldo ${money(payment.balance)}`}</button>}
        {!simpleFlow&&activeView==="kitchen"&&meta&&<button className={styles.action} onClick={()=>changeStatus(order,meta.next)}>{meta.action}</button>}
        {!simpleFlow&&order.paymentStatus==="paid"&&order.status!=="delivered"&&<button className={styles.checkout} onClick={()=>changeStatus(order,"delivered")}>Finalizar</button>}
        {order.paymentStatus==="unpaid"&&<button className={styles.print} onClick={()=>cancelPending(order)}>{cancelArmedId===order.id?"Confirmar cancelar":"Cancelar pedido"}</button>}
        <a className={styles.print} href={printUrl(order)} target="_blank" rel="noopener noreferrer">Imprimir</a>
      </div>
    </article>;
  };

  return <div className={styles.page}>
    <section className={styles.hero}><div><span className={styles.kicker}>FOOD SERVICE · {ctx.branch?.code} {ctx.branch?.name}</span><h1>Pedidos</h1><p>{simpleFlow?<><strong>Modo rápido:</strong> el pedido queda pendiente, se cobra y pasa al historial. Sin pasos extra de preparación.</>:<><strong>Pendientes</strong> muestra lo que todavía falta cobrar. <strong>Cocina</strong> conserva la preparación aunque el pedido ya esté pagado.</>}</p></div><button className={styles.primary} onClick={openPos}>＋ Nuevo pedido</button></section>
    {message&&<div className={styles.notice}>✓ {message}</div>}
    {activeView==="pending"&&<div className={styles.notice}>{simpleFlow?<><strong>Flujo rápido activo:</strong> Pedido → Cobrar → Historial. Los abonos quedan visibles hasta completar el saldo.</>:<>Un pedido sin cobros todavía no cuenta en caja. Si recibe un abono, KIUBO registra únicamente ese valor y mantiene visible el saldo pendiente.</>}</div>}
    <section className={styles.controlBar}><div className={styles.viewTabs}>
      <button className={activeView==="pending"?styles.viewActive:""} onClick={()=>{setView("pending");setCancelArmedId("")}}>Pendientes <b>{pendingOrders.length}</b></button>
      {!simpleFlow&&<button className={activeView==="kitchen"?styles.viewActive:""} onClick={()=>{setView("kitchen");setCancelArmedId("")}}>Cocina <b>{kitchenOrders.length}</b></button>}
      <button className={activeView==="history"?styles.viewActive:""} onClick={()=>{setView("history");setCancelArmedId("")}}>Historial <b>{historyOrders.length}</b></button>
    </div><div className={styles.filters}><button className={`${styles.filter} ${filter==="all"?styles.active:""}`} onClick={()=>setFilter("all")}>Todos</button>{settings.serviceModes.map(mode=><button key={mode} className={`${styles.filter} ${filter===mode?styles.active:""}`} onClick={()=>setFilter(mode)}>{modeLabel[mode]}</button>)}</div></section>
    {activeView!=="history"?<>
      {simpleFlow?<section className={styles.historyPanel}><div className={styles.historyHead}><div><span className={styles.kicker}>POR COBRAR</span><h2>Pedidos pendientes</h2></div><span>{pendingOrders.length} pedidos</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px"}}>{pendingOrders.map(order=>orderCard(order))}{!pendingOrders.length&&<div className={styles.emptyHistory}>Todo al día. No hay pedidos pendientes de cobro con este filtro.</div>}</div></section>:<>
        {activeView==="kitchen"&&paidInKitchen>0&&<div className={styles.notice}>{paidInKitchen} {paidInKitchen===1?"pedido pagado sigue":"pedidos pagados siguen"} en cocina hasta finalizar su preparación. Si ya fueron entregados, usa <strong>Finalizar</strong> para pasarlos al historial sin alterar la venta.</div>}
        <section className={styles.board}>{activeMeta.map(meta=>{const list=grouped.get(meta.key)??[];return <div className={styles.column} key={meta.key}><div className={styles.columnHead}><div><strong>{meta.label}</strong><small>{activeView==="pending"?"Solo pedidos que todavía faltan cobrar":meta.hint}</small></div><span className={styles.count}>{list.length}</span></div><div className={styles.columnBody}>{list.map(order=>orderCard(order,meta))}{!list.length&&<div className={styles.empty}><span>✓</span><strong>Todo al día</strong><small>{activeView==="pending"?"No hay pedidos pendientes de cobro en esta etapa.":"No hay pedidos en esta etapa."}</small></div>}</div></div>})}</section>
      </>}
    </>:<section className={styles.historyPanel}>
      <div className={styles.historyHead}><div><span className={styles.kicker}>HISTORIAL</span><h2>{simpleFlow?"Pedidos cobrados":"Pedidos finalizados"}</h2></div><span>{historyOrders.length} pedidos</span></div>
      <div className={styles.historyList}>{historyOrders.slice(0,80).map(order=>{const payment=orderPaymentSummary(db,order);return <article className={styles.historyRow} key={order.id}><div><strong>#{String(order.number).padStart(4,"0")}</strong><span>{order.serviceMode==="table"&&order.tableLabel?`Mesa ${order.tableLabel}`:modeLabel[order.serviceMode]} · {new Date(order.updatedAt||order.createdAt).toLocaleString("es-EC")}</span></div><div className={styles.historyCustomer}><strong>{order.customerName||"Cliente"}</strong><span>{order.items.reduce((sum,item)=>sum+item.qty,0)} productos · {payment.label}</span></div><div className={paymentStyles.historyPayment}><strong>{money(order.total)}</strong><span>{payment.cash>0?`Efectivo ${money(payment.cash)}`:""}{payment.cash>0&&payment.transfer>0?" · ":""}{payment.transfer>0?`Transferencia ${money(payment.transfer)}`:""}</span></div><a className={styles.print} href={printUrl(order)} target="_blank" rel="noopener noreferrer">Ver / imprimir</a></article>})}{!historyOrders.length&&<div className={styles.emptyHistory}>Todavía no hay pedidos en el historial con este filtro.</div>}</div>
    </section>}
  </div>;
}
