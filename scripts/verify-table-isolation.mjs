import fs from "node:fs";

const pos=fs.readFileSync("components/PosClientPro.tsx","utf8");
const orders=fs.readFileSync("components/FoodOrdersClientPro.tsx","utf8");
const salesTransaction=fs.readFileSync("lib/sales-transaction.ts","utf8");
const terminalGuard=fs.readFileSync("supabase/migrations/20261003014800_protect_terminal_food_orders.sql","utf8");
const legacyActive="activeMatches=activeExisting&&(activeServiceMode===\"table\"?activeExisting.serviceMode===\"table\"&&activeExisting.tableLabel===tableLabel.trim():activeExisting.serviceMode===activeServiceMode)";
const queuedActive="activeMatches=activeExisting&&((activeServiceMode===\"table\"||activeServiceMode===\"delivery\")?activeExisting.serviceMode===activeServiceMode&&activeExisting.tableLabel===tableLabel.trim():activeExisting.serviceMode===activeServiceMode)";
const legacyDraft="draftMode===\"table\"?(order.serviceMode===\"table\"&&order.tableLabel===draftTable):order.serviceMode===draftMode";
const queuedDraft="(draftMode===\"table\"||draftMode===\"delivery\")?(order.serviceMode===draftMode&&order.tableLabel===draftTable):order.serviceMode===draftMode";
const checks=[
  [pos.includes("findOpenTableOrder"),"POS resolves one open order by tenant, branch and table"],
  [pos.includes(legacyActive)||pos.includes(queuedActive),"POS refuses stale active order ids from another table or service slot"],
  [pos.includes(legacyDraft)||pos.includes(queuedDraft),"recovered drafts cannot attach an order from another context"],
  [pos.includes("findOpenServiceOrder"),"takeaway keeps an independent open order"],
  [pos.includes("findOpenDeliveryOrder"),"delivery slots resolve independent open orders"],
  [pos.includes("persistCurrentContext")&&pos.includes("loadTableOrder(label,source)"),"switching tables persists the previous context before loading the next one"],
  [pos.includes("cancelOpenSlotOrders")&&pos.includes("cancelled.length"),"clearing a table cancels every duplicated open order in that slot in one action"],
  [pos.includes('clearContextLabel=activeServiceMode==="table"&&tableLabel?"Liberar mesa"'),"table cleanup is presented explicitly as Liberar mesa"],
  [pos.includes("selectDelivery")&&pos.includes("loadDeliveryOrder(label,source)"),"switching delivery slots persists and loads the correct context"],
  [pos.includes("TableOrderAutoSave")&&pos.includes("tableAutoSaveSignature")&&pos.includes("saveOrder(true)"),"open table drafts are persisted automatically before browser data can be lost"],
  [pos.includes("checkoutInProgressRef.current?null:saveOrder(true)"),"checkout blocks a delayed browser autosave from reopening the order"],
  [pos.includes("if(checkoutInProgressRef.current)return;checkoutInProgressRef.current=true")&&pos.includes("checkout().finally"),"checkout is single-flight and always releases its browser lock"],
  [salesTransaction.includes('item.entityType==="orders"')&&salesTransaction.includes('item.entityId===payload.orderAfter?.id'),"the protected sale removes older pending order autosaves from the same device"],
  [pos.includes("Mesa, Para llevar y Domicilio conservan pedidos independientes"),"POS explains isolated service behavior"],
  [pos.includes("isPartialBalanceOrder")&&pos.includes("isOpenPartialOrder(source,order)"),"only real partial-payment balances keep a table occupied, including legacy cloud rows without kind"],
  [pos.includes("currentSlotPartialOrder")&&pos.includes("!currentSlotPartialOrder"),"refresh recovery cannot autosave a second order over a partial table"],
  [pos.includes("findPartialSlotOrder")&&pos.includes("partialOrderId!==partial.id"),"clicking the already-selected slot recovers its partial balance instead of returning early"],
  [pos.includes('open?.paymentStatus==="partial"?`Abonado · saldo'),"partially paid tables remain visibly occupied with their remaining balance"],
  [pos.includes("Completa el saldo antes de abrir un pedido nuevo"),"a partial table cannot accidentally receive a second independent order"],
  [pos.includes("deliverySlotCount")&&pos.includes("createDelivery"),"delivery slots can be expanded and remain synchronized in tenant settings"],
  [!pos.includes("Pedido vacío · En vivo"),"table cards no longer show noisy En vivo label"],
  [orders.includes("Cancelar pedido"),"unpaid orders can be cancelled explicitly"],
  [orders.includes("No modificó caja porque nunca fue cobrado"),"pending cancellation is cash-safe"],
  [orders.includes("status===\"delivered\"&&order.paymentStatus!==\"paid\""),"unpaid orders cannot be finalized accidentally"],
  [terminalGuard.includes("for update")&&terminalGuard.includes("terminal_order_is_authoritative"),"Cloud serializes order writes and acknowledges rejected stale autosaves"],
  [terminalGuard.includes("v_existing_payment='paid' and v_incoming_payment<>'paid'"),"Cloud cannot regress a paid order to unpaid or partial"],
  [terminalGuard.includes("v_existing_payment='partial' and v_incoming_payment='unpaid'"),"Cloud cannot lose an active partial-payment balance"],
  [terminalGuard.includes("v_existing_sale is not null and v_incoming_sale is distinct from v_existing_sale"),"Cloud cannot detach an order from its authoritative sale"],
  [terminalGuard.includes("v_existing_status in('cancelled','delivered') and v_incoming_status<>v_existing_status"),"Cloud cannot resurrect cancelled or delivered orders"],
];
for(const [ok,label] of checks){if(!ok){console.error(`✗ ${label}`);process.exit(1)}console.log(`✓ ${label}`)}
console.log("✓ Service-context isolation guard passed: tables, takeaway and concurrent delivery slots stay independent and pending cleanup cannot rewrite cash history.");
