import { readFileSync,existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
function text(path){const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")}
function requireText(path,needles){const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing inventory guard: ${needle}`);console.log(`✓ ${path}`)}

requireText("supabase/migrations/0016_inventory_adjustment_v2.sql",["apply_inventory_adjustments_v2","for update","v_new_stock=v_stock+v_delta","insufficient stock for adjustment","sync_receipts"]);
requireText("lib/inventory-transaction.ts",["enqueueInventoryAdjustment","inventoryAdjustmentTransactions","inventory.adjustment_queued"]);
requireText("lib/data-provider.ts",["apply_inventory_adjustments_v2","atomicOnlyCommand","Motor Cloud de ajustes de inventario pendiente de activación","inventoryAdjustmentTransactions"]);
requireText("lib/command-recovery.ts",["inventoryAdjustmentTransactions","p.productBefore","p.productAfter"]);
requireText("lib/sync-types.ts",["inventoryAdjustmentTransactions"]);
const provider=text("lib/data-provider.ts");
assert.ok(!provider.includes("fallbackInventoryAdjustmentOperations"),"Inventory adjustments must not fall back to non-atomic generic sync");
const client=text("components/InventoryClient.tsx");
for(const needle of ["enqueueInventoryAdjustment","trackChanges:false","Ir a Compras","AJUSTE CONTROLADO","un solo flujo oficial"])assert.ok(client.includes(needle),`components/InventoryClient.tsx missing inventory guard: ${needle}`);
assert.ok(!client.includes("COMPRA RÁPIDA"),"Inventory must not keep a second purchase receiving path");
assert.ok(!client.includes("const addPurchase="),"Inventory must not mutate purchase stock outside the purchase transaction engine");
console.log("✓ components/InventoryClient.tsx");
console.log("✓ Inventory Adjustment V2 guard passed: row-locked adjustments, kardex and recovery stay atomic-only with one purchase receiving path.");
