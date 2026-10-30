import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

// Exercise the actual API branch separately from the browser wrappers.
const api=readFileSync('supabase/functions/catalog-api/index.ts','utf8');
const from=api.indexOf('  if (action === "save_product")'),to=api.indexOf('  if (action === "save_presentations")',from);assert.ok(from>0&&to>from);
const js=ts.transpile(`async function save(body,account,accountId){const action='save_product';${api.slice(from,to)}}`,{target:ts.ScriptTarget.ES2022});
let rpcCall=null;
const apiDb={rpc:async(name,args)=>{rpcCall={name,args};return {data:{id:'p2',atomic:true,duplicate:false,presentations:args.p_presentations},error:null}},from(){throw Error('Atomic create must not use separate product writes')}};
const save=vm.runInNewContext(js+'\nsave',{db:apiDb,actor:{type:'provider'},validUuid:v=>typeof v==='string'&&v.length===36,cleanText:v=>v??null,validatePresentationsInput:()=>{},imageUrl:(_path,url)=>url,logActivity:async()=>{},Number,Math,Object});
const initial={stock_tracking:true,stock_initialized:true,stock_quantity:25,low_stock_threshold:1,base_unit:'botella',allow_item_note:true};
const apiBody={product:{name:'Cola',price:2},presentations:[{name:'Unidad',units_per_presentation:1,price:2}],product_operation_id:'33333333-3333-4333-8333-333333333333',initial_stock:initial};
const savedViaApi=await save(apiBody,{inventory_policy:'delivered'},'account-1');
assert.equal(savedViaApi.atomic,true);assert.equal(rpcCall.name,'catalog_save_product_atomic');assert.equal(rpcCall.args.p_stock.stock_quantity,25);
await assert.rejects(()=>save({...apiBody,product_operation_id:null},{inventory_policy:'delivered'},'account-1'),/client_update_required/);
await save({...apiBody,product:{...apiBody.product,id:'11111111-1111-4111-8111-111111111111'},expected_stock_quantity:30},{inventory_policy:'delivered'},'account-1');
assert.equal(rpcCall.args.p_expected_stock,30);

const dom=new JSDOM(`<!doctype html><body>
<button data-edit-product="p1">Editar</button><button id="newProductBtn">Nuevo</button>
<section id="productModal" class="visible"><input id="v5StockTracking" type="checkbox" checked>
<input id="v5StockQuantity" value="45"><input id="v5LowThreshold" value="1"><input id="v5BaseUnit" value="botella"><input id="v5AllowNote" type="checkbox" checked>
<label id="hm114Track"><span><small></small></span><input type="checkbox"></label>
<div id="v5PresentationRows"><div class="v5-presentation-row" data-id="u1"><input data-p-name value="Unidad"><input data-p-units value="1"><input data-p-price value="2"><input data-p-default type="radio" checked></div></div>
</section></body>`,{url:'https://hakuna.test/panel',pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.KIUBO_CATALOG_CONFIG={defaultSlug:'hakuna-matata',apiUrl:'https://fixture.test/api',version:'test'};w.Response=Response;w.Headers=Headers;w.setInterval=()=>0;
const NativeObserver=w.MutationObserver,observers=[];w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};
const nativeTimeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>ms>=300000?0:nativeTimeout(fn,ms,...args);
w.document.documentElement.dataset.hmInventoryPolicy='delivered';
let product={id:'p1',name:'Cola',brand:null,sku:null,category_id:null,visible:true,featured:false,stock_quantity:45,stock_tracking:true,stock_initialized:true};
let presentation={id:'u1',product_id:'p1',name:'Unidad',price:2,units_per_presentation:1,visible:true,promo_active:false};
const calls=[];
w.fetch=async(_url,opts={})=>{
 const b=JSON.parse(opts.body||'{}');calls.push(b);
 if(b.action==='provider_bootstrap')return new Response(JSON.stringify({products:[product],presentations:[presentation],orders:[]}));
 if(b.action==='save_product'){
  assert.equal(b.presentations?.length,1,'The presentation data must survive every active save wrapper');
  if(!b.product.id){assert.ok(b.product_operation_id);assert.equal(b.initial_stock.stock_quantity,25);product={...b.product,id:'p2',...b.initial_stock};presentation={...presentation,id:'u2',product_id:'p2'};return new Response(JSON.stringify({id:'p2',presentations:[presentation],atomic:true}))}
  if(b.product_operation_id){if(b.expected_stock_quantity!==product.stock_quantity)return new Response(JSON.stringify({error:'stock_conflict'}),{status:409});product={...product,...b.product,...b.initial_stock};return new Response(JSON.stringify({id:product.id,presentations:[presentation],atomic:true}))}
  product={...product,...b.product};return new Response(JSON.stringify({id:product.id,presentations:[presentation]}));
 }
 if(b.action==='save_presentation_settings')return new Response(JSON.stringify({presentations:[presentation]}));
 if(b.action==='product_snapshot')return new Response(JSON.stringify({product,presentations:[presentation]}));
 if(b.action==='save_stock'){
  if(b.expected_stock_quantity!==product.stock_quantity)return new Response(JSON.stringify({error:'stock_conflict'}),{status:409});
  product={...product,...b};return new Response(JSON.stringify({product}));
 }
 throw Error('Unexpected '+b.action);
};
for(const file of ['panel-v6.js','panel-v5.js','panel-v10.11-core.js','panel-v10.14.js','panel-v10.15.js'])w.eval(readFileSync('products/catalogos/web/'+file,'utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
await w.fetch('https://fixture.test/api',{body:JSON.stringify({action:'provider_bootstrap'})});
w.document.querySelector('[data-edit-product]').click();const qty=w.document.querySelector('#v5StockQuantity');qty.value='40';qty.dispatchEvent(new w.Event('input',{bubbles:true}));
let r=await w.fetch('https://fixture.test/api',{body:JSON.stringify({action:'save_product',product:{id:'p1',name:'Cola',brand:null,sku:null,category_id:null,visible:true,featured:false}})});
assert.equal(r.status,200,'The inner verifier cannot reject stock before the outer save occurs');assert.equal(product.stock_quantity,40);
assert.equal(calls.filter(x=>x.action==='save_stock').length,1);
await w.fetch('https://fixture.test/api',{body:JSON.stringify({action:'provider_bootstrap'})});w.document.querySelector('[data-edit-product]').click();
qty.value='35';qty.dispatchEvent(new w.Event('input',{bubbles:true}));product.stock_quantity=36;
const atomicPayload={action:'save_product',product_operation_id:'44444444-4444-4444-8444-444444444444',product:{id:'p1',name:'No guardar',brand:null,sku:null,category_id:null,visible:true,featured:false}};
r=await w.fetch('https://fixture.test/api',{body:JSON.stringify(atomicPayload)});assert.equal(r.status,409);assert.equal(product.name,'Cola');assert.equal(product.stock_quantity,36);
await w.fetch('https://fixture.test/api',{body:JSON.stringify({action:'provider_bootstrap'})});w.document.querySelector('[data-edit-product]').click();
const beforeEdit=calls.length;r=await w.fetch('https://fixture.test/api',{body:JSON.stringify({...atomicPayload,product_operation_id:'55555555-5555-4555-8555-555555555555',product:{...atomicPayload.product,name:'Cola actualizada'}})});
assert.equal(r.status,200);assert.equal(product.name,'Cola actualizada');assert.equal(product.stock_quantity,35);
assert.equal(calls.slice(beforeEdit).filter(x=>x.action==='save_stock').length,0,'Atomic edits must not issue a second stock write');
assert.equal(calls.slice(beforeEdit).filter(x=>x.action==='save_presentation_settings').length,0,'Atomic edits must not issue a second presentation write');
w.document.querySelector('#newProductBtn').click();await new Promise(resolve=>setTimeout(resolve,40));
assert.equal(w.document.querySelector('#hm114Track input').checked,false,'Unconfigured stock control cannot appear active');
assert.match(w.document.querySelector('#hm114Track small').textContent,/Pendiente de configurar/);
qty.value='25';qty.dispatchEvent(new w.Event('input',{bubbles:true}));
const before=calls.length;
r=await w.fetch('https://fixture.test/api',{body:JSON.stringify({action:'save_product',product_operation_id:'33333333-3333-4333-8333-333333333333',product:{id:null,name:'Nueva',brand:null,sku:null,category_id:null,visible:true,featured:false}})});
assert.equal(r.status,200);assert.equal(product.stock_quantity,25);
assert.equal(calls.slice(before).filter(x=>x.action==='save_stock').length,0,'Atomic creation must not issue a second stock write');
assert.equal(calls.slice(before).filter(x=>x.action==='save_presentation_settings').length,0,'Atomic creation must not issue a second presentation write');
console.log('✓ Hakuna product wrappers: edited stock saves after verification; new product sends initial stock atomically without follow-up writes.');observers.forEach(observer=>observer.disconnect());dom.window.close();
