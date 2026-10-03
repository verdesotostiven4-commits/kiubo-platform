import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addBusinessDays,businessDateKey } from "../lib/business-time.ts";

const read=path=>readFileSync(join(process.cwd(),path),"utf8");
const reports=read("components/ReportsClientPro.tsx"),inventory=read("lib/report-inventory.ts"),pos=read("components/PosClientPro.tsx"),dashboard=read("components/DashboardClient.tsx"),daily=read("components/OperationalSalesInsights.tsx"),settings=read("lib/local-store.ts"),migration=read("supabase/migrations/20261002073000_yuki_business_timezone_galapagos.sql");

assert.equal(businessDateKey("2026-10-02T05:30:00Z","Pacific/Galapagos"),"2026-10-01","Galápagos must keep 23:30 in the previous business day");
assert.equal(businessDateKey("2026-10-02T06:00:00Z","Pacific/Galapagos"),"2026-10-02","Galápagos business day must roll over at 00:00 local");
assert.equal(addBusinessDays("2026-10-01",-6),"2026-09-25");

for(const needle of ["ingredientConsumptionRows(sales,db.tenantProducts,db.stockMovements)","businessDateKey(iso,timeZone)","businessTodayKey(timeZone)"])assert.ok(reports.includes(needle),`reports guard missing: ${needle}`);
for(const needle of ['movement.reference','movement.type!=="sale"','movement.quantity>=0','if(recorded.length)','resolveInventoryImpact'])assert.ok(inventory.includes(needle),`inventory ledger/fallback guard missing: ${needle}`);
for(const needle of ['groupKey=`${line.cartKey}::${lineMode}`','optionSelections:group.optionSelections.length?group.optionSelections:undefined'])assert.ok(pos.includes(needle),`structured sale option guard missing: ${needle}`);
assert.ok(dashboard.includes("businessDateKey(s.createdAt,timeZone)"),"dashboard must use the business timezone");
assert.ok(daily.includes("businessDateKey(sale.createdAt,timeZone)"),"daily summaries must use the business timezone");
assert.ok(settings.includes('timeZone?:string'),"tenant settings must carry an explicit timezone");
assert.ok(migration.includes("'timeZone','Pacific/Galapagos'"),"YUKI must be configured for Galápagos");
assert.ok(migration.includes("from public.tenants"),"migration must resolve YUKI from the canonical tenants table");
assert.ok(migration.includes("update public.tenant_settings"),"canonical settings and synced settings must agree");
assert.ok(!migration.includes("8e2d0299-5680-4eec-8c57-e37fe29086aa"),"migration must resolve YUKI by stable identity, not a generated id");

console.log("✓ YUKI report integrity passed: ledger-based ingredients, structured flavors and Galápagos business dates are guarded.");
