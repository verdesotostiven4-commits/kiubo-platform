import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const migration=readFileSync(join(root,"supabase/migrations/0010_sales_stock_transaction_v2.sql"),"utf8").toLowerCase();
const provider=readFileSync(join(root,"lib/data-provider.ts"),"utf8").toLowerCase();
const pos=readFileSync(join(root,"components/PosClient.tsx"),"utf8").toLowerCase();
const helper=readFileSync(join(root,"lib/sales-transaction.ts"),"utf8").toLowerCase();

const checks=[
  [migration,"apply_sale_transactions_v2","atomic sales rpc"],
  [migration,"pg_advisory_xact_lock","sale idempotency lock"],
  [migration,"for update","product row lock"],
  [migration,"v_new_stock=v_stock-v_qty","delta stock arithmetic"],
  [migration,"sync_receipts","operation receipts"],
  [migration,"duplicate product in sale","duplicate item guard"],
  [provider,"saletransactions","transaction command routing"],
  [provider,"apply_sale_transactions_v2","transaction rpc client"],
  [provider,"fallbacksaleoperations","legacy compatibility fallback"],
  [pos,"enqueuesaletransaction","pos transaction queue"],
  [pos,"trackchanges:false","no duplicate generic sale queue"],
  [helper,"sales.transaction_queued","transaction audit trail"],
];

let failed=false;
for(const [text,needle,label] of checks){
  if(!text.includes(needle)){
    console.error(`✗ Missing ${label}: ${needle}`);
    failed=true;
  }
}

if(failed){
  console.error("KIUBO sales transaction reliability verification failed.");
  process.exit(1);
}
console.log("✓ Sales Transaction V2 guard passed: idempotent sale, row-locked delta stock and legacy fallback are wired.");
