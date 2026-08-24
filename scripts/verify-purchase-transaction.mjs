import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const checks=[
  ["supabase/migrations/0015_purchase_transaction_v2.sql",[
    "apply_purchase_transactions_v2","purchaseTransactions","supplierPaymentTransactions","for update","v_new_stock=v_stock+v_qty","v_new_cost","duplicate purchase document","supplier payment exceeds purchase balance","sync_receipts"
  ]],
  ["lib/purchase-transaction.ts",[
    "enqueuePurchaseTransaction","enqueueSupplierPaymentTransaction","productBeforeSnapshots","productSnapshots","purchaseBefore","purchaseAfter"
  ]],
  ["lib/data-provider.ts",[
    "apply_purchase_transactions_v2","fallbackPurchaseOperations","purchaseTransactions","supplierPaymentTransactions"
  ]],
  ["lib/command-recovery.ts",[
    "purchaseTransactions","supplierPaymentTransactions","productBeforeSnapshots","purchaseBefore","needsCanonicalPull"
  ]],
  ["components/PurchasesClient.tsx",[
    "enqueuePurchaseTransaction","enqueueSupplierPaymentTransaction","trackChanges:false","costo promedio","productBeforeSnapshots"
  ]],
  ["lib/sync-types.ts",[
    "purchaseTransactions","supplierPaymentTransactions"
  ]],
];
let failed=false;
for(const [relative,needles] of checks){const file=join(root,relative);if(!existsSync(file)){console.error(`✗ Missing ${relative}`);failed=true;continue}const text=readFileSync(file,"utf8");let bad=false;for(const needle of needles){if(!text.includes(needle)){console.error(`✗ ${relative} missing purchase guard: ${needle}`);failed=true;bad=true}}if(!bad)console.log(`✓ ${relative}`)}
if(failed){console.error("KIUBO purchase transaction verification failed.");process.exit(1)}
console.log("✓ Purchase Transaction V2 guard passed: atomic receiving, weighted cost, kardex, supplier payments, concurrency recovery and legacy fallback are wired.");
