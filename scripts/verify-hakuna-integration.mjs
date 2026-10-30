import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {localEnvironment,waitForApi} from './hakuna-local-test-env.mjs';

const env=localEnvironment(process.argv[2]),sql=new pg.Client({connectionString:env.DB_URL});
await sql.connect();
const scalar=async(q,args=[])=>Object.values((await sql.query(q,args)).rows[0])[0];
const account=randomUUID(),other=randomUUID();let session='';
const api=env.API_URL+'/functions/v1/catalog-router';
async function request(body,authenticated=true,expected=200){
  const r=await fetch(api,{method:'POST',headers:{'content-type':'application/json',apikey:env.ANON_KEY,authorization:'Bearer '+env.ANON_KEY,
    ...(authenticated?{'x-provider-session':session}:{}),origin:'http://localhost:4173'},body:JSON.stringify({slug:'hakuna-matata',...body})});
  const data=await r.json();assert.equal(r.status,expected,body.action+': '+JSON.stringify(data));return data;
}
try{
  await sql.query("insert into public.catalog_accounts(id,slug,name,provider_pin_hash,inventory_policy,payment_methods,public_base_url) values($1,'hakuna-matata','Hakuna Matata · INTEGRACIÓN',extensions.crypt('1234',extensions.gen_salt('bf')),'delivered',array['cash','transfer','credit'],'http://localhost:4173'),($2,'other-fixture','Other fixture',extensions.crypt('4321',extensions.gen_salt('bf')),'created',array['cash'],'http://localhost:4173')",[account,other]);
  await sql.query("insert into storage.buckets(id,name,public) values('catalog-assets-v4','catalog-assets-v4',true) on conflict do nothing");
  await waitForApi(env.API_URL+'/functions/v1/catalog-api',env.ANON_KEY);
  const login=await request({action:'provider_login',pin:'1234',device_id:'isolated-ci'},false);session=login.session_token;assert.ok(session);
  const stock={stock_tracking:true,stock_initialized:true,stock_quantity:12,low_stock_threshold:1,base_unit:'botella',allow_item_note:true};
  const presentations=[{name:'Unidad',units_per_presentation:1,price:2,is_default:false},{name:'Jaba',units_per_presentation:9,price:18,is_default:true}];
  const body={action:'save_product',product_operation_id:randomUUID(),product:{name:'Cola integración',price:18,visible:true},initial_stock:stock,presentations};
  const product=await request(body);assert.equal(product.atomic,true);
  assert.equal((await request(body)).id,product.id,'Retry must reuse the same product');
  const second=await request({...body,product_operation_id:randomUUID(),product:{name:'Agua integración',price:3},initial_stock:{...stock,stock_quantity:8},presentations:[{name:'Unidad',units_per_presentation:1,price:3,is_default:true}]});
  const unit=product.presentations.find(p=>p.units_per_presentation===1),jaba=product.presentations.find(p=>p.units_per_presentation===9);
  const orderBody={action:'create_order',idempotency_key:randomUUID(),payment_method:'credit',customer:{customer_business:'Cliente ficticio',customer_phone:'593999999999',delivery_method:'pickup'},items:[{product_id:product.id,presentation_id:jaba.id,quantity:1},{product_id:product.id,presentation_id:unit.id,quantity:2}]};
  let order=(await request(orderBody,false)).order;
  assert.equal((await request(orderBody,false)).order.id,order.id);
  const snapshot=()=>request({action:'product_snapshot',product_id:product.id});
  assert.equal((await snapshot()).product.stock_quantity,12);
  const edit=await request({action:'amend_order',order_id:order.id,operation_id:randomUUID(),expected_revision:0,reason:'Quitar unidades y agregar agua',items:[{product_id:product.id,presentation_id:jaba.id,quantity:1},{product_id:second.id,presentation_id:second.presentations[0].id,quantity:3}]});order=edit.order;
  for(const [initial_stock,error] of [[{...stock,stock_quantity:8},'stock_below_reserved'],[{...stock,stock_tracking:false},'stock_tracking_required_for_pending_orders']]){
    const rejected=await request({...body,product_operation_id:randomUUID(),product:{name:'No guardar',price:18,id:product.id},expected_stock_quantity:12,initial_stock,presentations:product.presentations},true,409);
    assert.equal(rejected.error,error);assert.equal((await snapshot()).product.name,'Cola integración');
  }
  const status=async(next,op=randomUUID(),revision=order.revision)=>{const r=await request({action:'update_order_status',order_id:order.id,status:next,operation_id:op,expected_revision:revision,reason:'Prueba aislada'});order=r.order;return r;};
  await status('confirmed');assert.equal((await snapshot()).product.stock_quantity,12,'Confirmation must not debit physical stock');
  const delivery=randomUUID(),revision=order.revision;await status('delivered',delivery,revision);await status('delivered',delivery,revision);
  assert.equal((await snapshot()).product.stock_quantity,3);
  const currentItems=(await sql.query('select id,product_id,quantity from public.catalog_order_items where order_id=$1',[order.id])).rows;
  const returned=await request({action:'return_order',order_id:order.id,operation_id:randomUUID(),expected_revision:order.revision,reason:'Devuelve una unidad de agua',items:currentItems.map(i=>({id:i.id,quantity:i.product_id===second.id?2:1}))});order=returned.order;
  assert.equal(Number(await scalar('select stock_quantity from public.catalog_products where id=$1',[second.id])),6);
  await status('cancelled');assert.equal((await snapshot()).product.stock_quantity,12);
  assert.equal(Number(await scalar('select stock_quantity from public.catalog_products where id=$1',[second.id])),8);
  const png=readFileSync('products/catalogos/web/assets/hakuna-logo-192.png');
  const form=new FormData();form.append('slug','hakuna-matata');form.append('kind','product');form.append('file',new Blob([png],{type:'image/png'}),'fixture.png');
  const upload=await fetch(api,{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+env.ANON_KEY,'x-provider-session':session,origin:'http://localhost:4173'},body:form});
  const photo=await upload.json();assert.equal(upload.status,200,JSON.stringify(photo));
  await request({action:'save_presentation_image',presentation_id:jaba.id,image_path:photo.path,image_url:null});
  const secondUpload=await fetch(api,{method:'POST',headers:{apikey:env.ANON_KEY,authorization:'Bearer '+env.ANON_KEY,'x-provider-session':session,origin:'http://localhost:4173'},body:form});
  const unitPhoto=await secondUpload.json();assert.equal(secondUpload.status,200);
  await request({action:'save_presentation_image',presentation_id:unit.id,image_path:unitPhoto.path,image_url:null});
  let saved=await snapshot();assert.equal(saved.product.image_path,photo.path,'Default presentation photo is also the cover');
  assert.equal(saved.presentations.find(p=>p.id===unit.id).image_path,unitPhoto.path);assert.notEqual(unitPhoto.path,photo.path,'Unit and jaba retain independent photos');
  const publicPhoto=photo.public_url.replace('http://kong:8000',env.API_URL);
  assert.deepEqual(Buffer.from(await (await fetch(publicPhoto)).arrayBuffer()),png,'Storage must return original uploaded bytes');
  await request({...body,product_operation_id:randomUUID(),product:{name:'Cola editada',price:18,id:product.id},expected_stock_quantity:12,presentations:product.presentations});
  saved=await snapshot();assert.equal(saved.product.image_path,photo.path,'Editing other fields preserves the autosaved cover');
  assert.equal(saved.presentations.find(p=>p.id===unit.id).image_path,unitPhoto.path,'Atomic form saves preserve independent presentation photos');
  await request({...body,product_operation_id:randomUUID(),product:{name:'No guardar',price:18,id:product.id},expected_stock_quantity:99,presentations:product.presentations},true,409);
  assert.equal((await snapshot()).product.name,'Cola editada');
  for(const action of ['save_stock','save_presentations'])assert.equal((await request({action,product_id:product.id},true,409)).error,'client_update_required');
  await request({action:'product_snapshot',product_id:product.id},false,401);
  const otherProduct=randomUUID();await sql.query("insert into public.catalog_products(id,account_id,name,price) values($1,$2,'Private fixture',1)",[otherProduct,other]);
  await request({action:'product_snapshot',product_id:otherProduct},true,404);
  const anon=await fetch(env.API_URL+'/rest/v1/catalog_products?select=id',{headers:{apikey:env.ANON_KEY,authorization:'Bearer '+env.ANON_KEY}});
  assert.ok(anon.status===401||anon.status===403||(anon.ok&&(await anon.json()).length===0),'Anonymous clients cannot read private tables');
  const tracked=await request({action:'order_status',public_token:order.public_token},false);assert.equal(tracked.order.status,'cancelled');
  const native=new URL(env.DB_URL);native.pathname='/hakuna_test_native';await sql.query('create database hakuna_test_native');
  for(const script of ['scripts/verify-hakuna-orders.mjs','scripts/verify-hakuna-native-concurrency.mjs']){
    const r=spawnSync(process.execPath,[script],{env:{...process.env,HAKUNA_TEST_DATABASE_URL:native.href},stdio:'inherit'});assert.equal(r.status,0,script);
  }
  console.log('✓ Actual local Supabase/PostgreSQL17 + PostgREST + Edge Functions + Storage: login, credit, atomic product save, mixed cart, edit/add, confirmation, delivery retries, partial return, cancellation, photo bytes/persistence and tenant isolation.');
}finally{await sql.end()}
