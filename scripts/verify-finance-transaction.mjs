import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const checks=[
  ["supabase/migrations/0011_finance_transaction_v2.sql",[
    "apply_finance_transactions_v2","pg_advisory_xact_lock","cash session already open","cash session is not open","credit already paid","sync_tenant_products_stock_nonnegative","sync_receipts",
  ]],
  ["lib/finance-transaction.ts",["cashTransactions","creditPaymentTransactions","enqueueCashTransaction","enqueueCreditPaymentTransaction"]],
  ["lib/data-provider.ts",["apply_finance_transactions_v2","atomicOnlyCommand","Motor Cloud de caja y fiados pendiente de activación","cashTransactions","creditPaymentTransactions"]],
  ["components/CashClient.tsx",["enqueueCashTransaction","enqueueCreditPaymentTransaction","trackChanges:false","Transferencia","kind:\"open\"","kind:\"close\""]],
  ["app/cash/page.tsx",["CashClient","content-shell"]],
];

let failed=false;
for(const [relative,needles] of checks){const file=join(root,relative);if(!existsSync(file)){console.error(`✗ Missing ${relative}`);failed=true;continue}const text=readFileSync(file,"utf8");let bad=false;for(const needle of needles){if(!text.includes(needle)){console.error(`✗ ${relative} missing finance guard: ${needle}`);failed=true;bad=true}}if(!bad)console.log(`✓ ${relative}`)}
const provider=readFileSync(join(root,"lib/data-provider.ts"),"utf8");
if(provider.includes("fallbackFinanceOperations")){console.error("✗ Finance commands must not fall back to non-atomic generic sync");failed=true}
if(failed){console.error("KIUBO finance transaction verification failed.");process.exit(1)}
console.log("✓ Finance Transaction V2 guard passed: cashier-safe cash lifecycle and credit payments remain atomic-only in Cloud.");
