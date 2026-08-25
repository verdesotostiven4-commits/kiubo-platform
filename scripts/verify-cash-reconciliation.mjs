import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};
const helper=text("lib/cash-reconciliation.ts");
for(const needle of ["reconcileCashSession","session.openingAmount+cashSales+manualIncome-cashOut","sessionId===session.id","s.payment===\"cash\""]){assert.ok(helper.includes(needle),`cash reconciliation helper missing: ${needle}`)}
const cash=text("components/CashClient.tsx");
for(const needle of ["reconcileCashSession","Ventas efectivo","Otros ingresos","Egresos","Esperado","CUADRADA","sobrante","faltante"]){assert.ok(cash.includes(needle),`CashClient missing reconciliation guard: ${needle}`)}
const reports=text("components/ReportsClient.tsx");
for(const needle of ["closedReconciliations","cashDifferenceTotal","Cuadre esperado vs. contado","Diferencia de cierres","reconcileCashSession"]){assert.ok(reports.includes(needle),`ReportsClient missing cash reconciliation guard: ${needle}`)}
console.log("✓ Cash Reconciliation V1 passed: session-scoped expected cash, counted difference and historical close reporting are wired.");
