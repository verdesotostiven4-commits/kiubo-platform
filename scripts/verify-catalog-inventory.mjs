import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
function text(path) {
  const full = join(root, path);
  assert.ok(existsSync(full), `Missing ${path}`);
  return readFileSync(full, "utf8");
}
function requireText(path, needles) {
  const source = text(path);
  for (const needle of needles) assert.ok(source.includes(needle), `${path} missing catalog inventory guard: ${needle}`);
  console.log(`✓ ${path}`);
}

const MIGRATION = "supabase/migrations/20260918160000_hakuna_presentation_shared_stock_atomic.sql";

// Rule: presentations share one physical stock pool, resolved and locked
// server-side, never trusting client-sent units/price/quantity as authority.
requireText(MIGRATION, [
  "create table if not exists public.catalog_product_presentations",
  "units_per_presentation integer not null default 1 check (units_per_presentation between 1 and 100000)",
  "catalog_order_items_base_units_positive",
  "for update", // product rows are locked before any stock decision
  "v_needed_by_product", // aggregated base-unit demand per product across presentations
  "insufficient_stock:%",
  "v_product.stock_tracking and", // unlimited sale when stock_tracking is off
]);

// Rule: reservation is atomic at order-creation time, not at confirmation —
// every referenced product is locked, in a stable order, before validating.
const migration = text(MIGRATION);
assert.ok(migration.includes("order by (value->>'product_id')::uuid"), `${MIGRATION} must lock distinct product ids in a stable order to avoid deadlocks`);
assert.ok(migration.includes("perform 1 from public.catalog_products") && migration.includes("order by id\n  for update"), `${MIGRATION} must lock every referenced product row before validating stock`);
assert.ok(
  migration.includes("insert into public.catalog_orders(id,account_id,idempotency_key,order_number,customer_business,customer_name,customer_phone,delivery_method,delivery_address,notes,subtotal,total,inventory_committed)") &&
  migration.includes("v_business,v_name,v_phone,v_delivery,v_address,v_notes,v_subtotal,v_subtotal,true);"),
  `${MIGRATION} must reserve stock (inventory_committed=true) at order creation, not at confirmation`
);

// Rule: idempotency survives a race on the same idempotency_key — the loser
// of the unique-violation race returns the winner's order instead of erroring.
assert.ok(migration.includes("exception when unique_violation") && migration.includes("Two requests raced on the same idempotency key"), `${MIGRATION} must handle a concurrent idempotency_key race via unique_violation, not just an upfront select`);

// Rule: fulfillment transitions (confirm/prepare/dispatch/deliver) never touch
// stock again — only a transition into/out of cancelled does, via a real
// finite state machine, and re-opening a cancelled order re-validates/re-locks.
requireText(MIGRATION, [
  "catalog_valid_order_transition",
  "invalid_status_transition:%->%",
  "v_new_committed boolean := new.status <> 'cancelled'",
  "Re-opening a cancelled order: re-validate and re-reserve atomically",
]);

// Rule: never negative stock — DB-level CHECK constraint as the final backstop
// beyond the application-level validation.
requireText("supabase/migrations/20260902005600_kiubo_catalogos_v46_inventory.sql", [
  "catalog_products_stock_quantity_nonnegative",
  "check (stock_quantity >= 0)",
]);

// Rule: the pre-existing delete-restore trigger referenced a base_units column
// that never existed (coalesce(oi.base_units, oi.quantity, 0)) — it must now
// use the real, authoritative column with no fallback to raw quantity.
const deleteRestore = text("supabase/migrations/20260911111000_hakuna_restore_stock_when_deleting_orders.sql");
assert.ok(deleteRestore.includes("sum(coalesce(oi.base_units,oi.quantity,0))"), "baseline pre-fix migration should still show the historical bug for context");
assert.ok(migration.includes("sum(oi.base_units)::bigint as base_units") && migration.includes("catalog_restore_inventory_on_order_delete"), `${MIGRATION} must fix the delete-restore trigger to use the real base_units column`);

// Server-authoritative create_order: presentation_id/price/units must be
// resolved from catalog_product_presentations / catalog_products, not from
// the request body directly.
assert.ok(!/v_item->>'units_per_presentation'/.test(migration), `${MIGRATION} must never read units_per_presentation from the client payload`);
assert.ok(!/v_item->>'price'/.test(migration), `${MIGRATION} must never read price from the client payload`);

// catalog-api: create_order must delegate to the RPC (never compute
// price/stock itself), and save_product must persist presentations
// server-side with its own validation (never trust client is_default alone).
requireText("supabase/functions/catalog-api/index.ts", [
  'db.rpc("catalog_create_order"',
  "async function savePresentations(",
  "function validatePresentationsInput(",
  "insufficient_stock",
  "invalid_status_transition",
]);
const catalogApi = text("supabase/functions/catalog-api/index.ts");
assert.ok(!/const\s+data\s*=\s*{\s*[^}]*price:\s*Number\(body\.items/.test(catalogApi), "catalog-api create_order must not read price from client items");
const presentationsExposedCount = catalogApi.split("const presentations = (presentationsResult.data || []).map").length - 1;
assert.ok(presentationsExposedCount >= 2, "catalog-api must expose mapped real presentations in both publicBootstrap and adminBootstrap");

console.log("✓ supabase/functions/catalog-api/index.ts");
console.log("✓ KIUBO Catalog Inventory guard passed: shared physical stock across presentations, server-authoritative units/price, atomic per-order reservation with stable product-row locking, idempotent order creation, and a fulfillment state machine that reserves once and never double-decrements.");


const HARDENING = "supabase/migrations/20260920004500_hakuna_catalog_integrity_hardening.sql";
const hardening = text(HARDENING);
for (const needle of [
  "catalog_replace_presentations",
  "for update",
  "Re-check now before validating stock",
  "for share",
  "invalid_presentation",
  "v_product.allow_item_note",
  "v_presentation.promo_active",
  "inventory_committed,payment_method"
]) {
  assert.ok(hardening.includes(needle), `${HARDENING} missing hardening invariant: ${needle}`);
}
assert.ok(!hardening.includes("v_item->>'units_per_presentation'"), `${HARDENING} must never trust client-sent presentation units`);
assert.ok(!hardening.includes("v_item->>'price'"), `${HARDENING} must never trust client-sent item price`);
console.log("✓ Catalog hardening migration invariants passed.");
