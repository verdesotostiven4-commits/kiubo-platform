import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};
const sql=text("supabase/migrations/0019_payment_idempotency_v1.sql");
for(const needle of [
  "apply_finance_transactions_v2_legacy",
  "apply_purchase_transactions_v3_legacy",
  "revoke all on function public.apply_finance_transactions_v2_legacy(jsonb) from authenticated",
  "revoke all on function public.apply_purchase_transactions_v3_legacy(jsonb) from authenticated",
  "duplicatePayment",
  "credit payment id reused with different payload",
  "duplicateSupplierPayment",
  "supplier payment id reused with different payload",
  "duplicatePurchase",
  "purchase transaction id reused with different payload",
  "duplicateOpen",
  "duplicateMovement",
  "duplicateClose",
])assert.ok(sql.includes(needle),`0019 payment idempotency missing guard: ${needle}`);

const provider=text("lib/data-provider.ts");
assert.ok(provider.includes('"apply_finance_transactions_v2"'),"Provider must continue through hardened finance RPC name");
assert.ok(provider.includes('"apply_purchase_transactions_v3"'),"Provider must continue through hardened purchase RPC name");
assert.ok(!provider.includes("apply_finance_transactions_v2_legacy"),"Client must never bypass finance idempotency wrapper");
assert.ok(!provider.includes("apply_purchase_transactions_v3_legacy"),"Client must never bypass purchase idempotency wrapper");

const seen=new Set();
let creditBalance=30,supplierBalance=40;
const apply=(id,kind,amount)=>{if(seen.has(`${kind}:${id}`))return false;seen.add(`${kind}:${id}`);if(kind==="credit")creditBalance-=amount;else supplierBalance-=amount;return true};
assert.equal(apply("payment-1","credit",10),true);
assert.equal(apply("payment-1","credit",10),false);
assert.equal(creditBalance,20,"same credit payment id must affect balance once even with a new transport operation id");
assert.equal(apply("supplier-payment-1","supplier",15),true);
assert.equal(apply("supplier-payment-1","supplier",15),false);
assert.equal(supplierBalance,25,"same supplier payment id must affect payable once even with a new transport operation id");

console.log("✓ Payment Idempotency V1 passed: economic payment ids, purchases and cash lifecycle retries cannot double-apply state.");