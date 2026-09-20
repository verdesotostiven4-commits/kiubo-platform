import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root=process.cwd();
const read=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};
const has=(source,needle,message)=>assert.ok(source.includes(needle),message||`Missing: ${needle}`);

const catalog=read("products/catalogos/web/catalog-v10.2.js");
has(catalog,"function presentationPrice(","catalog must use server-fed promo metadata");
has(catalog,"function cartItemAllowsNote(","cart note permission must be resolved from live product data");
has(catalog,"function reconcileCart(","cached carts must reconcile against live bootstrap");
has(catalog,"if(selected&&canAdd(product,selected,1))","default presentation must not bypass stock");
has(catalog,"requestedUnits=selectedUnits()","detail submit must re-check combined stock");
has(catalog,"item_note:cartItemAllowsNote(x)?","checkout must enforce note permission");
has(catalog,"function cartStockIssue(","cart must block known stock shortages before checkout");
has(catalog,"if(!product){delete state.cart[k]","stale cart products must be removed after bootstrap");
has(catalog,"if(!presentation&&!legacy){delete state.cart[k]","stale real presentation ids must be removed");
has(catalog,"function openLocationPicker(","checkout must expose a delivery map picker");
has(catalog,"leaflet@1.9.4","map picker must pin its map dependency");
has(catalog,"Escribe una referencia o selecciona la ubicación en el mapa","delivery must have a reference or a map pin");
has(catalog,"v10-map-centerpin","map must keep the delivery pin fixed in the visual center");
has(catalog,"map.on('movestart',lift)","map pin must lift while the map is moving");
has(catalog,"map.on('moveend',drop)","map pin must settle when the map stops");
assert.ok(!catalog.includes("draggable:true"),"delivery point must come from map center, not dragging the pin");
has(catalog,"basemaps.cartocdn.com","map must use the polished delivery tile layer");
has(catalog,"navigator.geolocation.watchPosition","delivery map must keep a live device location while open");
has(catalog,"v10-user-location-host","delivery map must render the customer's live blue location dot");
has(catalog,"L.circle(userPoint","delivery map must render the geolocation accuracy halo");
has(catalog,"Azul: tu ubicación","delivery map must explain the blue device marker separately from the delivery pin");

const api=read("supabase/functions/catalog-api/index.ts");
for(const needle of ["catalog_replace_presentations",'action === "save_presentations"','action === "save_payment_settings"','action === "save_product_image"','action === "save_presentation_image"','action === "save_presentation_settings"','action === "save_stock"','action === "product_snapshot"',"presentation_name,item_note","payment_method","delivery_lat,delivery_lng,delivery_location_label",'action: "notify_provider"','action: "notify_customer"',"EdgeRuntime.waitUntil"]) has(api,needle,`catalog-api missing runtime contract: ${needle}`);
const notify=read("supabase/functions/catalog-notify/index.ts");
for(const needle of ['action==="subscribe"','action==="bind_order"','action==="notify_provider"','action==="notify_customer"',"web-push@3.6.7","kiubo-catalogos-master"]) has(notify,needle,`catalog-notify missing runtime contract: ${needle}`);

const router=read("supabase/functions/catalog-router/index.ts");
for(const needle of ["presentation_name?:","presentation_name,item_note"]) has(router,needle,`catalog-router missing compatibility field: ${needle}`);

const migration=read("supabase/migrations/20260920004500_hakuna_catalog_integrity_hardening.sql");
const locationMigration=read("supabase/migrations/20260920073000_hakuna_delivery_map_location.sql");
const pushMigration=read("supabase/migrations/20260920093000_hakuna_push_notifications_baseline.sql");
for(const needle of ["catalog_push_config","catalog_push_subscriptions","catalog_push_events","enable row level security"]) has(pushMigration,needle,`push migration missing invariant: ${needle}`);
for(const needle of ["delivery_lat","delivery_lng","delivery_location_label","catalog_orders_delivery_location_pair"]) has(locationMigration,needle,`delivery location migration missing invariant: ${needle}`);
for(const needle of ["catalog_replace_presentations","catalog_update_presentation_settings","Re-check now before validating stock","for share","invalid_presentation","invalid_quantity","allow_item_note","promo_active","payment_method"]) has(migration,needle,`hardening migration missing invariant: ${needle}`);

const config=read("products/catalogos/web/config.js");
const panel=read("products/catalogos/web/panel.js");
const panelHtml=read("products/catalogos/web/panel.html");
has(panel,"dailyNewOrders","provider home must surface new orders clearly");
has(panel,"dailyInProcess","provider home must surface in-process orders clearly");
has(panel,"dailyStock","provider home must surface inventory attention clearly");
has(panelHtml,'id="dailyFocus"',"provider home focus block must be part of the canonical panel");
assert.ok(!panelHtml.includes("data-order-filter"),"provider orders must not expose the legacy four-way status filter");
has(panel,"Pedidos que necesitan respuesta","provider orders must make confirm/cancel the primary workflow");
has(panel,"Seguimiento opcional","advanced delivery progression must remain optional");
const catalog1051=read("products/catalogos/web/catalog-v10.5.1.js");
has(catalog1051,"hm1051-order-moment","customer app must surface a transient confirmed/cancelled status moment");
has(sw,"BRAND_NOTIFICATION_ICON","background notifications must use the real Hakuna logo");
has(sw,"view=orders&order=","provider notification clicks must open the matching order");
assert.ok(!panel.split("\n").some(line=>line.startsWith("  $('[data-quick]').forEach")||line.startsWith("  $('[data-daily]').forEach")),"provider panel repeated controls must use the querySelectorAll helper");
has(panelHtml,'/panel.js?v=10.18.0',"provider panel module must use the current release cache-bust");
has(config,"version:'10.18.0'","config version must match hardened release");
const index=read("products/catalogos/web/index.html");
assert.ok(!index.includes("?v=10.9.1"),"index.html must not pin stale 10.9.1 asset query strings");
const sw=read("products/catalogos/web/sw.js");
has(sw,"kiubo-catalog-v10-18-0-20260920","service-worker cache must roll for hardened release");

console.log("✓ Hakuna catalog runtime guard passed.");


const fastSave=read("products/catalogos/web/panel-fast-save-v7.4.js");
assert.ok(!fastSave.includes("/functions/v1/catalog-v6"),"active fast-save layer must not bypass the versioned API through legacy catalog-v6");
assert.ok(!fastSave.includes("deferred:true"),"stock saves must not return fake success before persistence");

const panel75=read("products/catalogos/web/panel-v7.5.js");
assert.ok(!panel75.includes("stopImmediatePropagation();const j=job()"),"panel 7.5 must not hijack the canonical product-save click path");
assert.ok(!panel75.includes("/functions/v1/catalog-v6"),"panel 7.5 must not depend on legacy catalog-v6");
has(api,"payment_methods: account.payment_methods","public bootstrap must expose configured payment methods");
has(migration,"cost_total","presentation cost must be represented in the versioned schema");


for (const file of [
  "products/catalogos/web/catalog-v10.2.js",
  "products/catalogos/web/catalog-v10.5.1.js",
  "products/catalogos/web/panel-v10.15.js",
  "products/catalogos/web/panel-fast-save-v7.4.js",
  "products/catalogos/web/panel-v5.js",
  "products/catalogos/web/panel-v7.5.js",
  "products/catalogos/web/panel-v10.15.js",
  "products/catalogos/web/panel.js",
  "products/catalogos/web/pedido.js",
  "products/catalogos/web/config.js",
  "products/catalogos/web/sw.js"
]) {
  execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "pipe" });
}
console.log("✓ Active Hakuna JavaScript syntax checks passed.");


const webDir=join(root,"products/catalogos/web");
for(const name of readdirSync(webDir).filter(name=>name.endsWith(".js"))){
  const source=readFileSync(join(webDir,name),"utf8");
  assert.ok(!source.includes("/functions/v1/catalog-v6"),`${name} must not call legacy catalog-v6 directly`);
}
for(const html of ["products/catalogos/web/panel.html","products/catalogos/web/pedido.html"]){
  const source=read(html);
  assert.ok(source.includes("/config.js?v=10.18.0"),`${html} must cache-bust config.js`);
}
const vercelConfig=read("products/catalogos/web/vercel.json");
has(vercelConfig,'"source": "/config.js"',"Vercel config must disable stale config.js caching");
has(vercelConfig,'"source": "/sw.js"',"Vercel config must disable stale service-worker caching");
console.log("✓ Hakuna cache and legacy-endpoint guards passed.");


const configSource=read("products/catalogos/web/config.js");
has(configSource,"/functions/v1/catalog-router","Hakuna clients must use the versioned catalog-router entrypoint");
assert.ok(!configSource.includes("/functions/v1/catalog-v9"),"Hakuna must not depend on the unversioned remote catalog-v9 shim");

const routerSource=read("supabase/functions/catalog-router/index.ts");
has(routerSource,'const CORE_URL = `${SUPABASE_URL}/functions/v1/catalog-api`',"catalog-router must forward to versioned catalog-api");
has(routerSource,'"https://hakuna-matata-catalogo.vercel.app"',"catalog-router must allow the production Hakuna origin");
has(routerSource,"kiubo-catalogos-master","catalog-router must allow the actual Vercel project preview origin");
console.log("✓ Hakuna uses the version-controlled catalog-router instead of catalog-v9.");


assert.ok(!routerSource.includes('if (body.action === "save_stock")'),"catalog-router must not maintain a second stock-write implementation");
assert.ok(!routerSource.includes("async function saveStock("),"catalog-router must remain a gateway, not a stock persistence service");
has(api,'action === "save_stock"',"catalog-api must own authenticated inventory persistence");
console.log("✓ Inventory writes have one canonical backend implementation.");


has(api,"function validUuid(","catalog-api must use strict UUID validation before database casts");
assert.ok(!api.includes("/^[0-9a-f-]{36}$/i"),"catalog-api must not use permissive pseudo-UUID validation");
has(migration,"^[1-9][0-9]{0,2}$","checkout quantity syntax must be bounded to 1..999 before integer casts");
console.log("✓ Request UUID and quantity validation is bounded before database casts.");

assert.ok(/kiubo-catalogos-master/.test(routerSource),"catalog-router must support previews generated by the kiubo-catalogos-master Vercel project");


has(catalog,"if(configured.length)return[]","configured-but-hidden presentations must not fall back to a purchasable legacy unit");
has(migration,"where product_id=p_product_id and account_id=p_account_id and visible=true","presentation replacement must retain at least one visible option");
has(migration,"raise exception 'product_unavailable'","checkout must reject a product whose configured presentations are all hidden");
console.log("✓ Hidden presentations cannot be bypassed through the legacy unit fallback.");

// Hakuna first-paint regression guard
const legacyCatalog=read("products/catalogos/web/catalog-v10.16.4.js");
assert.ok(legacyCatalog.includes("function releaseBootShell()")&&legacyCatalog.includes("if(!released)releaseBootShell()"),"catalog first paint must fail open instead of leaving the splash screen forever");
