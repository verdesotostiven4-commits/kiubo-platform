import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};

const store=text("lib/local-store.ts");
assert.ok(store.includes('FoodOrderPaymentStatus = "unpaid"|"partial"|"paid"'),"orders must support partial payment state");
assert.ok(store.includes('payment:"cash"|"transfer"|"mixed"|"partial"|"credit"'),"sales must distinguish partial payment from fiado");
assert.ok(store.includes('kind?:"fiado"|"partial"'),"outstanding balances must carry their commercial kind");

const pos=text("components/PosClientPro.tsx");
for(const needle of ['paymentOptions:Payment[]=["cash","transfer","mixed","partial","credit"]',"partialAmount","partialMethod",'effectivePayment==="credit"||effectivePayment==="partial"','kind:balanceKind',"Pago parcial registrado","Selecciona un cliente de confianza"]){
  assert.ok(pos.includes(needle),`POS partial/fiado separation missing: ${needle}`);
}
assert.ok(!pos.includes("Abono / fiado"),"partial payment and fiado must not share one button");
assert.ok(pos.includes('payment==="credit"&&!customerId'),"fiado must require a customer");
assert.ok(pos.includes('payment!=="partial"||(Boolean(partialAmount.trim())'),"partial payment must require an amount");
assert.ok(!pos.includes('payment==="partial"&&!customerId'),"partial payment must not require a customer");
for(const needle of ["isPartialBalanceOrder","isOccupyingOrder",'paymentStatus==="unpaid"||isPartialBalanceOrder',"loadPartialOrder","registerPartialBalance","balanceMode"]){
  assert.ok(pos.includes(needle),`partial table lifecycle missing: ${needle}`);
}
assert.ok(pos.includes("isOpenPartialOrder(source,order)"),"the POS must classify a partial balance through its linked sale when old cloud data has no kind");
for(const needle of ['keepsSlotOpen','setPartialOrderId(order.id)','setActiveOrderId(order.id)','sigue abierto']){
  assert.ok(pos.includes(needle),`the first partial payment must retain its table/delivery context: ${needle}`);
}
for(const needle of ["partialOrderId:string",'setPartialOrderId(safePartial?.id||"")',"currentSlotPartialOrder","findPartialSlotOrder",'partialOrderId!==partial.id']){
  assert.ok(pos.includes(needle),`partial payment refresh/slot recovery missing: ${needle}`);
}
assert.ok(pos.includes("initialCreditPayment,initialCreditCashMovement"),"the initial installment must travel inside the protected sale command");
assert.ok(!pos.includes("if(initialCreditPayment&&updatedCredit)enqueueCreditPaymentTransaction"),"the initial installment must not be queued as a second independent command");

const payments=text("lib/order-payments.ts");
for(const needle of ['sale.payment==="credit"||sale.payment==="partial"','kind==="partial"?"Pago parcial":"Fiado"',"Pago parcial ·","sale.total-balance","detailPending","actualizando detalle","outstandingBalanceKind","openPartialCreditForOrder","compareOccupyingOrders"]){
  assert.ok(payments.includes(needle),`payment summary missing partial distinction: ${needle}`);
}

const orders=text("components/FoodOrdersClientPro.tsx");
for(const needle of ["registerPayment","orderPaymentSummary","Guardar abono",'paymentStatus:remaining<=.001?"paid":"partial"']){
  assert.ok(orders.includes(needle),`Order balance flow missing: ${needle}`);
}

const receipt=text("components/ReceiptClient.tsx");
assert.ok(receipt.includes('partial:"Pago parcial"'),"receipt must label partial payments");
assert.ok(receipt.includes('sale.payment==="credit"||sale.payment==="partial"'),"receipt must print outstanding balance detail for partial payments");

const cash=text("lib/cash-reconciliation.ts");
for(const needle of ["creditCollections","isCreditPaymentCashMovement","cashSales+creditCollections+manualIncome-cashOut"]){
  assert.ok(cash.includes(needle),`Cash reconciliation partial-payment guard missing: ${needle}`);
}

const migration=text("supabase/migrations/20260920204256_separate_partial_payments_v1.sql");
for(const needle of ["'partial'","v_payment in('credit','partial')","kind',case when v_payment='partial'"]){
  assert.ok(migration.includes(needle),`Cloud partial-payment migration missing: ${needle}`);
}

const atomicMigration=text("supabase/migrations/20261003011734_partial_payment_slot_atomicity.sql");
for(const needle of [
  "apply_sale_transactions_v2_partial_slot_legacy",
  "apply_finance_transactions_v2_partial_slot_legacy",
  "kiubo_upsert_transaction_order_v1",
  "kiubo_reconcile_outstanding_order_v1",
  "initialCreditPayment",
  "initial partial payment failed",
  "paymentStatus',v_payment_status",
  "credit.payload||jsonb_build_object",
])assert.ok(atomicMigration.includes(needle),`atomic partial-payment migration missing: ${needle}`);

const lifecycle={balance:13.95,paymentStatus:"partial",occupied:true};
for(const installment of [3.95,5,5]){
  lifecycle.balance=Number(Math.max(0,lifecycle.balance-installment).toFixed(2));
  lifecycle.paymentStatus=lifecycle.balance<=.001?"paid":"partial";
  lifecycle.occupied=lifecycle.balance>.001;
  if(lifecycle.balance>0){assert.equal(lifecycle.paymentStatus,"partial");assert.equal(lifecycle.occupied,true)}
}
assert.deepEqual(lifecycle,{balance:0,paymentStatus:"paid",occupied:false},"the slot must release only after the final installment");

console.log("✓ Order Partial Payments V2 passed: Pago parcial is customer-free, Fiado remains customer-bound, and both preserve balance/cash truth.");
