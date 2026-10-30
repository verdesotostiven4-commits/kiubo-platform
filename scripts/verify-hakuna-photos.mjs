import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';

// Execute the actual upload handler with isolated storage: a failed later save
// must never delete an image that is still referenced by the product.
const api=readFileSync('supabase/functions/catalog-api/index.ts','utf8');
const start=api.indexOf('async function handleUpload('),end=api.indexOf('\nDeno.serve(',start);
assert.ok(start>=0&&end>start);
const js=ts.transpile(api.slice(start,end),{target:ts.ScriptTarget.ES2022});
const account='11111111-1111-4111-8111-111111111111',oldPath=account+'/products/old.png';
let uploads=0,deletes=0;
const bucket={upload:async()=>{uploads++;return {error:null}},remove:async()=>{deletes++;return {error:null}},getPublicUrl:path=>({data:{publicUrl:'https://fixture.test/'+path}})};
const upload=vm.runInNewContext(js+'\nhandleUpload',{File,crypto,BUCKET:'fixture',db:{storage:{from:()=>bucket}},requireActor:async()=>({type:'provider'}),validSlug:x=>x,actorAccount:async()=>({id:account}),logActivity:async()=>{}});
const form=new FormData();form.set('slug','hakuna-matata');form.set('kind','product');form.set('old_path',oldPath);form.set('file',new File(['picture'],'test.png',{type:'image/png'}));
const result=await upload({},form);assert.equal(uploads,1);assert.equal(deletes,0,'The previous file must not be removed during upload');assert.notEqual(result.path,oldPath);

const photoStart=api.indexOf('  if (action === "save_presentation_image")'),photoEnd=api.indexOf('  if (action === "save_presentation_settings")',photoStart);assert.ok(photoStart>0&&photoEnd>photoStart);
const photoJs=ts.transpile(`async function save(body,accountId){const action='save_presentation_image';${api.slice(photoStart,photoEnd)}}`,{target:ts.ScriptTarget.ES2022});
let cover=null;
const photoDb={from(table){let changes={};const q={update(v){changes=v;return q},eq(){return q},is(){if(table==='catalog_products')cover=changes;return Promise.resolve({error:null})},select(){return q},async maybeSingle(){return {data:{...changes,id:'j1',product_id:'p1',is_default:true},error:null}}};return q}};
const savePresentation=vm.runInNewContext(photoJs+'\nsave',{db:photoDb,validUuid:()=>true,cleanText:x=>x,imageUrl:(_path,url)=>url,actor:{type:'provider'},logActivity:async()=>{}});
await savePresentation({presentation_id:'j1',image_url:'https://fixture.test/jaba.png',image_path:'jaba.png'},account);
assert.equal(cover.image_path,'jaba.png','The default presentation photo is persisted as the product cover too');

// Exercise the actual independent presentation-photo UI with a synthetic API.
const dom=new JSDOM('<!doctype html><body><button data-edit-product="p1">Editar</button><div id="productModal"><div class="product-image-upload"><div id="productImagePreview"></div><label><b></b><small></small><input id="productImage" type="file"></label></div><div id="v5PresentationRows"><div class="v5-presentation-row" data-id="u1"><input data-p-name value="Unidad"><input data-p-units value="1"></div><div class="v5-presentation-row" data-id="j1"><input data-p-name value="Jaba"><input data-p-units value="9"></div><div class="v5-presentation-row"><input data-p-name value="Nueva"><input data-p-units value="6"></div></div></div></body>',{url:'https://hakuna.test/panel',pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.KIUBO_CATALOG_CONFIG={defaultSlug:'hakuna-matata',apiUrl:'https://fixture.test/api',version:'test'};
w.sessionStorage.setItem('kiubo-provider-session:hakuna-matata','fixture-session');w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.Response=Response;
w.setInterval=()=>0;
const product={id:'p1',name:'Cola',image_url:'https://fixture.test/general-old.png',image_path:'old-product'};
const presentations=[{id:'u1',product_id:'p1',name:'Unidad',units_per_presentation:1,is_default:false,image_url:'https://fixture.test/old-unit.png',image_path:'old-unit'},{id:'j1',product_id:'p1',name:'Jaba',units_per_presentation:9,is_default:false}];
const calls=[];
w.fetch=async(_url,opts={})=>{
 let b;if(opts.body instanceof w.FormData)b={action:opts.body.get('action'),kind:opts.body.get('kind')};else b=JSON.parse(opts.body||'{}');calls.push(b);
 let data={ok:true};
 if(b.action==='provider_bootstrap')data={products:[product],presentations};
 if(b.action==='upload_asset')data={path:'new-photo',public_url:'https://fixture.test/new-photo.png'};
 if(b.action==='save_presentation_image'){const p=presentations.find(x=>x.id===b.presentation_id);p.image_url=b.image_url;p.image_path=b.image_path;data={presentation:p}}
 if(b.action==='save_product_image'){product.image_url=b.image_url;product.image_path=b.image_path;data={product}}
 return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};
w.eval(readFileSync('products/catalogos/web/panel-v7.7.js','utf8'));
w.eval(readFileSync('products/catalogos/web/panel-v10.9.js','utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
w.document.querySelector('[data-edit-product]').click();await new Promise(resolve=>setTimeout(resolve,160));
const rows=[...w.document.querySelectorAll('.v5-presentation-row')];
assert.ok(rows[0].querySelector('.v77-presentation-file'));assert.equal(rows[0].querySelector('input[type=file]').disabled,false);
assert.equal(rows[2].querySelector('input[type=file]').disabled,true,'An unsaved presentation must be saved before it can own a photo');
const choose=async(input)=>{Object.defineProperty(input,'files',{configurable:true,value:[new w.File(['photo'],'photo.png',{type:'image/png'})]});input.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,100))};
await choose(rows[0].querySelector('input[type=file]'));
assert.ok(calls.some(x=>x.action==='save_presentation_image'&&x.presentation_id==='u1'));assert.equal(presentations[0].image_url,'https://fixture.test/new-photo.png');assert.equal(presentations[1].image_url,undefined,'The jaba retains its own image');
await choose(rows[1].querySelector('input[type=file]'));
assert.ok(calls.some(x=>x.action==='save_presentation_image'&&x.presentation_id==='j1'),'Jaba photo is associated with its own presentation');
await choose(w.document.querySelector('#productImage'));
assert.ok(calls.some(x=>x.action==='save_product_image'&&x.product_id==='p1'),'General cover is independently saved');
console.log('✓ Hakuna photos: real upload handler preserves the old file; mocked UI saves unit, jaba and general photos separately.');
dom.window.close();
