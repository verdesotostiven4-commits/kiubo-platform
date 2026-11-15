import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const text=readFileSync("lib/cash-close-review.ts","utf8");
const compiled=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("module","exports",compiled)(module,module.exports);
const {suspiciousCashExchangeNote,unverifiedDenominationMovements,pendingTurnFinancialOperations}=module.exports;
assert.equal(suspiciousCashExchangeNote("monedas"),true);
assert.equal(suspiciousCashExchangeNote("Cambio de billetes"),true);
assert.equal(suspiciousCashExchangeNote("suelto"),true);
assert.equal(suspiciousCashExchangeNote("Aporte externo para monedas"),false);
assert.equal(suspiciousCashExchangeNote("Dinero nuevo desde banco"),false);
assert.equal(suspiciousCashExchangeNote("venta transferencia"),false);
const movement=(id,reason,overrides={})=>({id,tenantId:"yuki",branchId:"main",sessionId:"current",type:"in",reason,amount:11.5,createdAt:"2026-11-07T14:00:00Z",...overrides});
const db={cashMovements:[
  movement("ambiguous","monedas"),
  movement("deposit","Aporte externo para monedas"),
  movement("other","Cambio de billetes",{branchId:"another"}),
  movement("out","monedas",{type:"out"}),
  movement("session","Cambio de billetes",{sessionId:"older"}),
],syncQueue:[
  {tenantId:"yuki",branchId:"main",entityType:"saleTransactions",status:"pending",createdAt:"2026-11-07T15:00:00Z"},
  {tenantId:"yuki",branchId:"main",entityType:"creditPaymentTransactions",status:"failed",createdAt:"2026-11-07T15:00:00Z"},
  {tenantId:"yuki",branchId:"main",entityType:"cashTransactions",status:"syncing",createdAt:"2026-11-07T15:00:00Z"},
  {tenantId:"yuki",branchId:"main",entityType:"saleTransactions",status:"synced",createdAt:"2026-11-07T15:00:00Z"},
  {tenantId:"yuki",branchId:"main",entityType:"orders",status:"pending",createdAt:"2026-11-07T15:00:00Z"},
  {tenantId:"other",branchId:"main",entityType:"saleTransactions",status:"pending",createdAt:"2026-11-07T15:00:00Z"},
  {tenantId:"yuki",branchId:"main",entityType:"cashTransactions",status:"pending",createdAt:"2026-11-06T00:00:00Z"}
]};
assert.deepEqual(unverifiedDenominationMovements(db,"yuki","main","current").map(x=>x.id),["ambiguous"]);
assert.equal(pendingTurnFinancialOperations(db,"yuki","main","2026-11-07T14:00:00Z"),3);
assert.equal(pendingTurnFinancialOperations(db,"yuki","main","2026-11-07T16:00:00Z"),0);
const cash=readFileSync("components/CashClient.tsx","utf8");
const css=readFileSync("components/CashClient.module.css","utf8");
for(const needle of [
  "KIUBO_DATA_REFRESHED","pendingTurnFinancialOperations(next",
  "Revisar ingreso manual","Banco recibido (opcional)",
  "NO suma dinero a caja","No cierres aún","manualCashReviewed",
  "Diferencia en banco","Transferencias registradas (verificar banco)",
  "reconcileCashSession(next,session)","closeDifference"
]){
  assert.ok(cash.includes(needle),"Missing YUKI cash safeguard: "+needle);
}
for(const needle of [".reconcilePanel",".simpleSplit",".reviewCheck",".bankCheck","@media(max-width:700px)"]){
  assert.ok(css.includes(needle),"Missing responsive cash layout: "+needle);
}
for(const obsolete of ["Cuadre fácil · 3 pasos","Ver cómo se calcula el efectivo esperado","Cuenta solo el efectivo físico:"]){
  assert.ok(!cash.includes(obsolete),"Obsolete instruction should be removed: "+obsolete);
}
console.log("✓ YUKI cierre claro: efectivo vs banco, cambios de denominación, sincronización pendiente y diferencias reales.");
