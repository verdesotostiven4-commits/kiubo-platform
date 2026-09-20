import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const text=path=>readFileSync(path,"utf8");

const admin=text("components/AdminPinManager.tsx");
for(const needle of ["salesHistoryResetAtByBranch","REINICIAR","Cierra la caja","No ocultaremos obligaciones reales"]){
  assert.ok(admin.includes(needle),`protected history reset missing: ${needle}`);
}
for(const forbidden of ["next.tenantProducts=","next.sales=[]","db.sales=[]"]){
  assert.ok(!admin.includes(forbidden),`history reset must stay non-destructive: ${forbidden}`);
}
const cloud=text("lib/cloud-auth.ts");
assert.ok(cloud.includes('pin:previousUser?.pin||""'),"cloud hydration must preserve the local authorization PIN");

const reports=text("components/ReportsClientPro.tsx");
for(const needle of ["salePaymentSummary","Pagado","Efectivo","Transferencia","Pendiente","/receipt?sale="]){
  assert.ok(reports.includes(needle),`reports payment history missing: ${needle}`);
}

const cash=text("components/CashClient.tsx");
for(const needle of ["cashReconciliationEntries","Ver cómo se calcula el efectivo esperado","Las transferencias no se suman al cajón"]){
  assert.ok(cash.includes(needle),`cash explanation missing: ${needle}`);
}

const pos=text("components/PosClientPro.tsx");
for(const needle of ["Pago parcial","Fiado","partial-checkout","five-payment-grid","checkout-total-card","checkout-payment-zone"]){
  assert.ok(pos.includes(needle),`POS partial payment UX missing: ${needle}`);
}

const orders=text("components/FoodOrdersClientPro.tsx");
assert.ok(orders.includes("orderVisibleAfterHistoryReset"),"order history must honor the protected history cutoff");

const v16=text("app/experience-v16.css");
for(const needle of [".checkout-total-card",".checkout-payment-zone","max-height:none!important","overflow:visible!important"]){
  assert.ok(v16.includes(needle),`POS v16 layout missing: ${needle}`);
}
assert.ok(text("app/layout.tsx").includes('import "./experience-v16.css";'),"POS v16 stylesheet must load last");
const v17=text("app/experience-v17.css");
for(const needle of [".category-toolbar-head",".category-order-toggle","grid-template-columns:minmax(0,1fr)!important"]){
  assert.ok(v17.includes(needle),`POS v17 category tools missing: ${needle}`);
}
assert.ok(pos.includes("Ordenar categorías"),"category ordering must be presented as a secondary tool");
assert.ok(text("app/layout.tsx").includes('import "./experience-v17.css";'),"POS v17 stylesheet must load after v16");
const v18=text("app/experience-v18.css");
for(const needle of [".five-payment-grid",".partial-checkout",".partial-summary"]){assert.ok(v18.includes(needle),`POS v18 payment separation missing: ${needle}`)}
assert.ok(!pos.includes("Abono / fiado"),"Pago parcial and Fiado must never be merged into one POS option");
assert.ok(pos.includes('paymentOptions:Payment[]=["cash","transfer","mixed","partial","credit"]'),"POS must expose separate Pago parcial and Fiado methods");
assert.ok(text("app/layout.tsx").includes('import "./experience-v18.css";'),"POS v18 stylesheet must load last");

console.log("✓ YUKI Ops V2 passed: non-destructive reset, payment-rich history, explainable cash, and single-scroll checkout V16 are wired.");
