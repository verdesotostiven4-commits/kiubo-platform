import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};
const requireText=(path,needles)=>{const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing sale reversal guard: ${needle}`);console.log(`✓ ${path}`)};
requireText("supabase/migrations/0018_sale_reversal_v1.sql",["apply_sale_reversals_v1","pg_advisory_xact_lock","for update","v_new_stock:=v_stock+v_qty","cash refund must equal sale total","status','voided'","sync_receipts"]);
requireText("lib/sale-reversal.ts",["reverseSaleLocally","saleReversalTransactions","adjustment_in","Abre caja antes de devolver efectivo","sales.reversal_queued"]);
requireText("lib/data-provider.ts",["saleReversalTransactions","apply_sale_reversals_v1","fallbackSaleReversalOperations"]);
requireText("lib/command-recovery.ts",["saleReversalTransactions","productBeforeSnapshots","productAfterSnapshots","removeById(db.cashMovements"]);
requireText("lib/sync-types.ts",["saleReversalTransactions"]);
requireText("components/ReportsClient.tsx",["reverseSaleLocally","saleLifecycle(s)==\"completed\"","ANULADA","Confirmar anulación","Ventas anuladas"]);
const cash=text("lib/cash-reconciliation.ts");
assert.ok(cash.includes('s.payment==="cash"'),"Cash reconciliation must preserve the original physical cash sale");
assert.ok(!cash.includes("saleVoided"),"Voided cash sales stay in historical cash flow because the refund is a separate cash outflow");
console.log("✓ Sale Reversal V1 passed: auditable cash/transfer voids, stock restoration, cash refunds, report exclusion and recovery are wired.");
