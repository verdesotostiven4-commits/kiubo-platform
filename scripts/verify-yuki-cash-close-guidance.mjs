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
for(const needle of ["KIUBO_DATA_REFRESHED","pendingTurnFinancialOperations(next","Revisar ingreso manual","Transferencias recibidas en el banco","NO suma dinero a caja","Cuadre fácil · 3 pasos","No cierres aún","manualCashReviewed","Diferencia bancaria","Transferencias registradas (verificar banco)"]){
  assert.ok(cash.includes(needle),"Missing guided-close safeguard: "+needle);
}
for(const needle of [".guidedClose",".simpleSplit",".reviewCheck",".bankCheck","@media(max-width:700px)"])assert.ok(css.includes(needle));
assert.ok(cash.includes("Las transferencias no se cuentan en el cajón."));
assert.ok(cash.includes("reconcileCashSession(next,session)"));
console.log("✓ YUKI cierre claro: efectivo vs banco, cambios de denominación, sincronización pendiente y diferencias reales.");
