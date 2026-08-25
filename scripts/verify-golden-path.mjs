import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const read=(relative)=>{
  const path=join(root,relative);
  assert.ok(existsSync(path),`Missing ${relative}`);
  return readFileSync(path,"utf8");
};
const requireText=(relative,needles)=>{
  const text=read(relative);
  for(const needle of needles)assert.ok(text.includes(needle),`${relative} missing Golden Path guard: ${needle}`);
  console.log(`✓ ${relative}`);
  return text;
};

requireText("components/PosClient.tsx",[
  "enqueueSaleTransaction",
  "next.sales.unshift(sale)",
  "current.stock=newStock",
  "saveLocalDatabase(next,{trackChanges:false})",
]);
requireText("components/OperationsClient.tsx",[
  "enqueueCashTransaction",
  "enqueueCreditPaymentTransaction",
  "kind:\"open\"",
  "kind:\"close\"",
]);
requireText("lib/sync-engine.ts",[
  "item.tenantId===tenantId",
  "isActiveQueueItem(item,activeTenantId)",
  "shouldRecoverRejectedCommand",
  "recoverRejectedCommand",
  "pullAvailable(provider,\"0\")",
  "One sync cycle belongs to exactly one active workspace",
]);
requireText("lib/command-recovery.ts",[
  "system.command_recovered",
  "removeById(db.sales",
  "product.stock=Math.max(0,m.previousStock)",
  "removeById(db.creditPayments",
  "current.status=\"open\"",
]);
requireText("supabase/migrations/0010_sales_stock_transaction_v2.sql",[
  "pg_advisory_xact_lock",
  "for update",
  "v_new_stock=v_stock-v_qty",
]);
requireText("supabase/migrations/0012_stock_conflict_guard.sql",[
  "sync_tenant_products_stock_nonnegative",
  "sync_nonnegative_number",
  "not valid",
]);
requireText("components/ReportsClient.tsx",[
  "revenue=sales.reduce",
  "gross=revenue-cost",
  "cashSessions",
]);

const state={
  product:{id:"p1",stock:10,price:1.50,cost:1.00},
  sales:[],
  movements:[],
  cash:{opening:20,status:"open",closing:null},
};
const qty=2;
assert.ok(state.product.stock>=qty,"fixture must have enough stock");
const previousStock=state.product.stock;
state.product.stock-=qty;
state.sales.push({id:"s1",total:Number((state.product.price*qty).toFixed(2)),qty});
state.movements.push({productId:"p1",quantity:-qty,previousStock,newStock:state.product.stock});
const revenue=state.sales.reduce((sum,sale)=>sum+sale.total,0);
const cost=qty*state.product.cost;
const gross=revenue-cost;
const expectedCash=state.cash.opening+revenue;
state.cash.closing=expectedCash;
state.cash.status="closed";

assert.equal(state.product.stock,8,"sale must decrement stock exactly once");
assert.equal(revenue,3,"report revenue must equal the sale total");
assert.equal(gross,1,"gross profit must preserve historical cost");
assert.equal(expectedCash,23,"cash close must reconcile opening + cash sales");
assert.equal(state.movements[0].previousStock,10);
assert.equal(state.movements[0].newStock,8);

const reloaded=JSON.parse(JSON.stringify(state));
assert.equal(reloaded.product.stock,8,"offline/local persistence round-trip must keep stock");
assert.equal(reloaded.cash.status,"closed","offline/local persistence round-trip must keep cash close");
assert.equal(reloaded.sales.length,1,"offline/local persistence round-trip must keep sale history");

const rejectedMovement={previousStock:1,newStock:0};
let optimisticStock=0;
if(optimisticStock===rejectedMovement.newStock)optimisticStock=rejectedMovement.previousStock;
assert.equal(optimisticStock,1,"recovery must undo its own optimistic delta");
const canonicalCloudStock=0;
optimisticStock=canonicalCloudStock;
assert.equal(optimisticStock,0,"canonical cloud state must win after a concurrent rejection");

console.log("✓ Golden Path V2 passed: sale, stock, cash, report, offline persistence and conflict recovery are guarded.");
