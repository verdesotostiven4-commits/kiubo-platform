import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const checks=[
  ["supabase/migrations/0011_finance_transaction_v2.sql",[
    "apply_finance_transactions_v2",
    "pg_advisory_xact_lock",
    "cash session already open",
    "cash session is not open",
    "credit already paid",
    "sync_tenant_products_stock_nonnegative",
    "sync_receipts",
  ]],
  ["lib/finance-transaction.ts",[
    "cashTransactions",
    "creditPaymentTransactions",
    "enqueueCashTransaction",
    "enqueueCreditPaymentTransaction",
  ]],
  ["lib/data-provider.ts",[
    "apply_finance_transactions_v2",
    "fallbackFinanceOperations",
    "cashTransactions",
    "creditPaymentTransactions",
  ]],
  ["components/OperationsClient.tsx",[
    "enqueueCashTransaction",
    "enqueueCreditPaymentTransaction",
    "trackChanges:false",
    "Transferencia",
  ]],
];

let failed=false;
for(const [relative,needles] of checks){
  const file=join(root,relative);
  if(!existsSync(file)){console.error(`✗ Missing ${relative}`);failed=true;continue}
  const text=readFileSync(file,"utf8");
  let bad=false;
  for(const needle of needles){
    if(!text.includes(needle)){console.error(`✗ ${relative} missing finance guard: ${needle}`);failed=true;bad=true}
  }
  if(!bad)console.log(`✓ ${relative}`);
}

if(failed){console.error("KIUBO finance transaction verification failed.");process.exit(1)}
console.log("✓ Finance Transaction V2 guard passed: cash lifecycle, credit payments and fallback are wired.");
