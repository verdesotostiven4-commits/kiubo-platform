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

const api=read("supabase/functions/catalog-api/index.ts");
for(const needle of ["catalog_replace_presentations",'action === "save_presentations"','action === "save_payment_settings"','action === "save_product_image"','action === "save_presentation_image"','action === "save_presentation_settings"','action === "product_snapshot"',"presentation_name,item_note","payment_method"]) has(api,needle,`catalog-api missing runtime contract: ${needle}`);

const router=read("supabase/functions/catalog-router/index.ts");
for(const needle of ["presentation_name?:","stock_initialized","presentation_name,item_note"]) has(router,needle,`catalog-router missing compatibility field: ${needle}`);

const migration=read("supabase/migrations/20260920004500_hakuna_catalog_integrity_hardening.sql");
for(const needle of ["catalog_replace_presentations","catalog_update_presentation_settings","Re-check now before validating stock","for share","invalid_presentation","invalid_quantity","allow_item_note","promo_active","payment_method"]) has(migration,needle,`hardening migration missing invariant: ${needle}`);

const config=read("products/catalogos/web/config.js");
has(config,"version:'10.16.12'","config version must match hardened release");
const index=read("products/catalogos/web/index.html");
assert.ok(!index.includes("?v=10.9.1"),"index.html must not pin stale 10.9.1 asset query strings");
const sw=read("products/catalogos/web/sw.js");
has(sw,"kiubo-catalog-v10-16-12-20260920","service-worker cache must roll for hardened release");

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
  "products/catalogos/web/panel-fast-save-v7.4.js",
  "products/catalogos/web/panel-v5.js",
  "products/catalogos/web/panel-v7.5.js",
  "products/catalogos/web/panel-v10.15.js",
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
for(const html of ["panel.html","pedido.html"]){
  const source=read(html);
  assert.ok(source.includes("/config.js?v=10.16.12"),`${html} must cache-bust config.js`);
}
const vercelConfig=read("products/catalogos/web/vercel.json");
has(vercelConfig,'"source": "/config.js"',"Vercel config must disable stale config.js caching");
has(vercelConfig,'"source": "/sw.js"',"Vercel config must disable stale service-worker caching");
console.log("✓ Hakuna cache and legacy-endpoint guards passed.");
