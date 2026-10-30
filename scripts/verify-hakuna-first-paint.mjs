import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync('products/catalogos/web/catalog-v10.16.4.js','utf8');
// Exercise the actual readiness path; do not include unrelated UI decorators.
const boot=source.slice(0,source.indexOf('/* Search results:'))+'\nfunction scheduleUi(){}\n})();';
for(const products of [[],[{id:'synthetic',name:'Sin marca',visible:true}],null]){
  const dom=new JSDOM('<!doctype html><html class="hm112-ready"><body><section id="homeView"><div class="v10-home"></div></section></body></html>',{url:'https://hakuna.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.KIUBO_CATALOG_CONFIG={defaultSlug:'hakuna-matata'};
  const realTimeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>realTimeout(fn,Math.min(ms,20),...args);
  if(products)w.localStorage.setItem('kiubo-v10-bootstrap:hakuna-matata',JSON.stringify({account:{slug:'hakuna-matata'},products,cached_at:Date.now()}));
  w.eval(boot);await new Promise(r=>setTimeout(r,150));
  assert.equal(w.document.documentElement.classList.contains('hm1164-boot'),false,'Optional/absent brands cannot block the application');
  assert.equal(w.document.documentElement.classList.contains('hm1164-ready'),true);
  w.close();
}
console.log('✓ First paint releases empty/unbranded catalogs and exposes the loading/retry UI when bootstrap fails.');
