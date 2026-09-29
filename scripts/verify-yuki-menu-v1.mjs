import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read=path=>readFileSync(join(process.cwd(),path),"utf8");
const menu=read("lib/yuki-menu.ts");
const catalog=read("components/SafeCatalogClient.tsx");
const inventory=read("components/InventoryClient.tsx");
const bootstrap=read("components/YukiPilotCatalogBootstrap.tsx");
const migration=read("supabase/migrations/20260929003428_yuki_menu_catalog_v1.sql");
const duplicateCleanup=read("supabase/migrations/20260929024500_yuki_menu_exact_duplicate_cleanup_v1.sql");
const rollback=read("supabase/manual/restore_yuki_menu_catalog_v1.sql");

for(const needle of [
  'yogurt("pina","Piña","pulpa-pina")',
  'menu("combo-1","Combo 1","Combos",5.80',
  'menu("combo-2","Combo 2","Combos",7.60',
  'menu("combo-3","Combo 3","Combos",13.95',
  'menu("combo-4","Combo 4","Combos",21',
  'menu("cappuccino","Capuccino","Bebidas",3.75',
  'menu("jugo-frutas","Jugo de frutas","Bebidas",3.50',
  'sourceCategory:"Jugos"',
])assert.ok(menu.includes(needle),`official YUKI menu definition missing: ${needle}`);

assert.ok(catalog.includes("isSellableProduct(product)"),"Products must exclude ingredients, options and charges");
assert.ok(catalog.includes("Menú actual"),"Products must identify customer-menu items");
assert.ok(inventory.includes('const quantityStep="0.001",quantityMin="0.001"'),"Inventory must support decimal units");
assert.ok(!inventory.includes("Number.isInteger"),"YUKI inventory must not force whole units");
assert.ok(inventory.includes("Descontar existencias"),"Ingredients need a safe stock-control switch");
assert.ok(bootstrap.includes("YUKI_MENU_VERSION"),"Local/demo bootstrap must use the canonical menu module");
assert.ok(!bootstrap.includes("price:5.75"),"Stale Combo 1 price must not remain in bootstrap");

for(const needle of [
  "private.tenant_catalog_backups",
  "yuki-menu-catalog-v1-before",
  '"id":"yuki-menu-yogurt-pina"',
  '"id":"yuki-menu-cappuccino"',
  '"price":3.75',
  '"ingredientKey":"pan-yuca","qty":15',
  "Duplicado conciliado por menú YUKI 2026-09",
])assert.ok(migration.includes(needle),`production migration guard missing: ${needle}`);

assert.ok(migration.includes("where slug='yuki-irwf' and display_name='YUKI'"),"Migration must resolve YUKI by stable business identity");
assert.ok(migration.includes("v_ingredient_ids"),"Migration must preserve existing ingredient ids through a runtime map");
assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(migration),"Migration must not hardcode generated ids");
assert.ok(rollback.includes("select tenant_id,branch_id,snapshot into v_tenant,v_branch,v_snapshot"),"Rollback must resolve its target from the backup");
assert.ok(duplicateCleanup.includes("Duplicado exacto conciliado por menú YUKI 2026-09"),"Concurrent exact duplicates must be archived without deletion");
assert.ok(duplicateCleanup.includes("canonical.payload->>'menuVersion'='2026-09'"),"Duplicate cleanup must only trust the canonical menu version");
assert.ok(!duplicateCleanup.includes("delete from"),"Duplicate cleanup must preserve historical rows");

for(const complementary of ["yuki-menu-corviche-manaba","yuki-menu-muchines-queso","tp-e344be1e-ae64-43a9-9502-17be9e7bd1bc"]){
  const archiveBlock=migration.slice(migration.indexOf("Archive only confirmed duplicates"),migration.indexOf("Keep internal charges"));
  assert.ok(!archiveBlock.includes(complementary),`complementary product must be preserved: ${complementary}`);
}

console.log("✓ YUKI Menu V1 passed: official menu, preserved complements, separated ingredients, decimal stock and reversible migration are guarded.");
