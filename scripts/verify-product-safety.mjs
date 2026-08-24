import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const localStorePath = join(root, "lib/local-store.ts");
const catalogPath = join(root, "components/CatalogClient.tsx");
const migrationPath = join(root, "supabase/migrations/0008_product_payload_validation.sql");

const source = readFileSync(localStorePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: localStorePath,
}).outputText;

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
};
const module = { exports: {} };
const context = vm.createContext({
  module,
  exports: module.exports,
  require,
  console,
  window: { localStorage },
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
  Date,
  JSON,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Map,
  Set,
  Math,
});
new vm.Script(compiled, { filename: "local-store.compiled.cjs" }).runInContext(context);

const api = module.exports;
assert.equal(typeof api.loadLocalDatabase, "function", "loadLocalDatabase must remain executable");
assert.ok(api.PILOT_TENANT_ID, "pilot tenant id must exist");
assert.ok(api.PILOT_BRANCH_ID, "pilot branch id must exist");

const maliciousBarcode = "begin;\ncreate table hacked(x text);\n" + "select * from public.users; ".repeat(20);
const maliciousName = "  Producto\ncon\ttexto   roto  ".repeat(20);
localStorage.setItem("kiubo.foundation.v2", JSON.stringify({
  tenantProducts: [
    {
      id: "tp-bad-payload",
      tenantId: api.PILOT_TENANT_ID,
      branchId: api.PILOT_BRANCH_ID,
      masterProductId: "custom-bad",
      barcode: maliciousBarcode,
      name: maliciousName,
      price: -5,
      cost: "NaN",
      stock: -10,
      active: true
    },
    {
      id: "tp-good-payload",
      tenantId: api.PILOT_TENANT_ID,
      branchId: api.PILOT_BRANCH_ID,
      masterProductId: "custom-good",
      barcode: "7861234567890",
      name: "Agua 500 ml",
      price: 1.5,
      cost: 1,
      stock: 10,
      active: true
    }
  ]
}));

const db = api.loadLocalDatabase();
const bad = db.tenantProducts.find((product) => product.id === "tp-bad-payload");
const good = db.tenantProducts.find((product) => product.id === "tp-good-payload");

assert.ok(bad, "malformed product must still load safely instead of crashing the workspace");
assert.ok(good, "valid product must still load");
assert.match(bad.barcode, /^SKU-/, "malformed barcode must be replaced with a safe internal code");
assert.ok(bad.barcode.length <= 96, "sanitized barcode must respect the UI/server limit");
assert.ok(!/[\r\n]/.test(bad.barcode), "sanitized barcode must remain a single line");
assert.ok(bad.name.length <= 160, "sanitized name must respect the product limit");
assert.ok(!/[\r\n\t]/.test(bad.name), "sanitized name must remain a single line");
assert.equal(bad.price, 0, "negative prices must not survive normalization");
assert.equal(bad.cost, 0, "non numeric costs must not survive normalization");
assert.equal(bad.stock, 0, "negative stock must not survive normalization");
assert.equal(good.barcode, "7861234567890", "valid barcodes must remain unchanged");
assert.equal(good.name, "Agua 500 ml", "valid names must remain unchanged");
assert.equal(good.price, 1.5, "valid prices must remain unchanged");
assert.equal(good.stock, 10, "valid stock must remain unchanged");

const catalog = readFileSync(catalogPath, "utf8");
for (const needle of ["maxLength={160}", "maxLength={96}", "rawBarcode.length>96", "setDb(loadLocalDatabase())"]) {
  assert.ok(catalog.includes(needle), `Catalog product guard missing: ${needle}`);
}

const migration = readFileSync(migrationPath, "utf8").toLowerCase();
for (const needle of ["sync_tenant_products_payload_sane", "between 1 and 160", "between 1 and 96", "payload->>'barcode'"]) {
  assert.ok(migration.includes(needle), `Cloud product guard missing: ${needle}`);
}

console.log("✓ Product safety regression passed: malformed synced data is contained automatically.");
