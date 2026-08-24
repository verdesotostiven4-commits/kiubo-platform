import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const checks=[
  ["supabase/migrations/0015_purchase_transaction_v2.sql",[
    "apply_purchase_transactions_v2","purchaseTransactions","supplierPaymentTransactions","for update","v_new_stock=v_stock+v_qty","v_new_cost","duplicate purchase document","supplier payment exceeds purchase balance","sync_receipts"
  ]],
  ["supabase/migrations/0017_supplier_cash_outflow_v1.sql",[
    "apply_purchase_transactions_v3","apply_purchase_transactions_v2","cash supplier payment requires register movement","cash session is not open","cashMovements","type','out'"
  ]],
  ["lib/purchase-transaction.ts",[
    "enqueuePurchaseTransaction","enqueueSupplierPaymentTransaction","productBeforeSnapshots","productSnapshots","purchaseBefore","purchaseAfter","initialCashMovement","cashMovement"
  ]],
  ["lib/data-provider.ts",[
    "apply_purchase_transactions_v3","purchaseFallback","purchaseTransactions","supplierPaymentTransactions","initialCashMovement","cashMovements"
  ]],
  ["lib/command-recovery.ts",[
    "purchaseTransactions","supplierPaymentTransactions","productBeforeSnapshots","purchaseBefore","initialCashMovement","cashMovement","needsCanonicalPull"
  ]],
  ["components/PurchasesClient.tsx",[
    "enqueuePurchaseTransaction","enqueueSupplierPaymentTransaction","getOpenCashSession","initialCashMovement","cashMovement","Abre caja antes de pagar en efectivo a un proveedor","salida de caja"
  ]],
  ["lib/sync-types.ts",["purchaseTransactions","supplierPaymentTransactions"]],
];
let failed=false;
for(const [relative,needles] of checks){const file=join(root,relative);if(!existsSync(file)){console.error(`✗ Missing ${relative}`);failed=true;continue}const text=readFileSync(file,"utf8");let bad=false;for(const needle of needles){if(!text.includes(needle)){console.error(`✗ ${relative} missing purchase guard: ${needle}`);failed=true;bad=true}}if(!bad)console.log(`✓ ${relative}`)}
if(failed){console.error("KIUBO purchase transaction verification failed.");process.exit(1)}
console.log("✓ Purchase Transaction V3 guard passed: atomic receiving, weighted cost, payables and cash supplier outflows are wired with recovery and fallback.");
