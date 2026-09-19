// Pure-JS reference simulation of the catalog_create_order stock-aggregation
// algorithm (see supabase/migrations/20260918160000_hakuna_presentation_shared_stock_atomic.sql).
// This does not replace a real Postgres concurrency test (pending, needs
// Supabase Local / Docker) — it locks in the exact worked examples from the
// rule set so a regression in the aggregation logic is caught without Docker.
import assert from "node:assert/strict";

// Mirrors: for each cart item, base_units = quantity * units_per_presentation;
// aggregate by product_id; reject if stock_tracking and aggregated > stock_quantity.
function validateCart(product, cartLines) {
  if (!product.stock_tracking) return { ok: true, needed: null };
  const needed = cartLines.reduce((sum, line) => sum + line.quantity * line.units_per_presentation, 0);
  return { ok: needed <= product.stock_quantity, needed };
}

// Rule 1: no stock tracking => unlimited sale regardless of quantity.
{
  const product = { stock_tracking: false, stock_quantity: 0 };
  const result = validateCart(product, [{ quantity: 999, units_per_presentation: 1 }]);
  assert.equal(result.ok, true, "products without stock_tracking must allow unlimited sale");
}

// Rule 3 worked example #1: stock 5, unit presentation (units_per_presentation=1) => max 5.
{
  const product = { stock_tracking: true, stock_quantity: 5 };
  assert.equal(validateCart(product, [{ quantity: 5, units_per_presentation: 1 }]).ok, true, "stock 5 / unit=1 must allow exactly 5");
  assert.equal(validateCart(product, [{ quantity: 6, units_per_presentation: 1 }]).ok, false, "stock 5 / unit=1 must reject 6");
}

// Rule 3 worked example #2: stock 5, box of 12 => must NOT allow one box.
{
  const product = { stock_tracking: true, stock_quantity: 5 };
  assert.equal(validateCart(product, [{ quantity: 1, units_per_presentation: 12 }]).ok, false, "stock 5 / box=12 must reject a single box");
}

// Rule 3 worked example #3: stock 20 => 1 box of 12 + up to 8 loose units, but not 9.
{
  const product = { stock_tracking: true, stock_quantity: 20 };
  assert.equal(validateCart(product, [
    { quantity: 1, units_per_presentation: 12 },
    { quantity: 8, units_per_presentation: 1 },
  ]).ok, true, "stock 20 must allow 1 box of 12 plus 8 loose units");
  assert.equal(validateCart(product, [
    { quantity: 1, units_per_presentation: 12 },
    { quantity: 9, units_per_presentation: 1 },
  ]).ok, false, "stock 20 must reject 1 box of 12 plus 9 loose units (total 21 > 20)");
}

// Rule 3: presentations of the SAME product always share one pool — two
// different presentation lines for the same product must aggregate, not be
// validated independently (independent validation would let 12 + 12 through
// against a stock of 20, which must be rejected).
{
  const product = { stock_tracking: true, stock_quantity: 20 };
  assert.equal(validateCart(product, [
    { quantity: 1, units_per_presentation: 12 },
    { quantity: 1, units_per_presentation: 12 },
  ]).ok, false, "two boxes of 12 (24 base units) must be rejected against stock 20");
}

// Rule 4: units_per_presentation must never be sourced from the client. This
// simulates what happens if a malicious client sends units_per_presentation:1
// for what the server knows is actually a box of 12 — the aggregation
// function itself is authority-agnostic, so the guarantee has to come from
// the caller always passing the DB-resolved value. Assert the migration text
// enforces that (never reads it from the request body).
import { readFileSync } from "node:fs";
import { join } from "node:path";
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260918160000_hakuna_presentation_shared_stock_atomic.sql"), "utf8");
assert.ok(!migration.includes("v_item->>'units_per_presentation'"), "server must resolve units_per_presentation from catalog_product_presentations, never from the client payload");
assert.ok(migration.includes("v_units_per := v_presentation.units_per_presentation;"), "server must assign units_per_presentation from the locked presentation row");

console.log("✓ Rule 1: unlimited sale when stock_tracking is off");
console.log("✓ Rule 3: stock 5 / unit=1 -> max 5; stock 5 / box=12 -> rejected; stock 20 -> box of 12 + max 8 loose");
console.log("✓ Rule 3: multiple presentations of the same product aggregate against one shared pool");
console.log("✓ Rule 4: units_per_presentation is never read from the client payload in catalog_create_order");
console.log("✓ KIUBO Catalog Inventory worked-examples guard passed.");
