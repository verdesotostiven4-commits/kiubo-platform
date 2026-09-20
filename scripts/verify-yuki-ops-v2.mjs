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
for(const needle of ["Abono / fiado","se descuenta del total del pedido","checkout-payment-title"]){
  assert.ok(pos.includes(needle),`POS partial payment UX missing: ${needle}`);
}

const orders=text("components/FoodOrdersClientPro.tsx");
assert.ok(orders.includes("orderVisibleAfterHistoryReset"),"order history must honor the protected history cutoff");

console.log("✓ YUKI Ops V2 passed: non-destructive reset, payment-rich history, explainable cash, and clearer partial-payment checkout are wired.");
