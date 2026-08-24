import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};
const requireText=(path,needles)=>{const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing payment truth guard: ${needle}`);console.log(`✓ ${path}`)};

const pos=text("components/PosClient.tsx");
assert.ok(pos.includes('const paymentOptions:Payment[]=["cash","transfer","credit"]'),"POS must expose only cash, transfer and credit until mixed split amounts are persisted");
assert.ok(!pos.includes('paymentOptions:Payment[]=["cash","transfer","mixed"'),"POS must not expose mixed payment until split amounts are persisted");
requireText("components/PurchasesClient.tsx",[
  "cashMovement",
  "Abre caja antes de pagar en efectivo a un proveedor",
  "salida de caja",
  "initialCashMovement",
]);
requireText("lib/purchase-transaction.ts",[
  "initialCashMovement",
  "cashMovement",
]);
requireText("lib/data-provider.ts",[
  "apply_purchase_transactions_v3",
  "initialCashMovement",
  "cashMovement",
]);
requireText("lib/command-recovery.ts",[
  "cashMovement",
  "initialCashMovement",
]);
requireText("supabase/migrations/0017_supplier_cash_outflow_v1.sql",[
  "apply_purchase_transactions_v3",
  "cash session is not open",
  "cash supplier payment requires register movement",
]);

console.log("✓ Payment truthfulness V1 passed: unsupported mixed payments are hidden and supplier cash payments flow through an open cash session.");
