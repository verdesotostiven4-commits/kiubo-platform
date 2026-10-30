import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Runs the shipped PL/pgSQL in an isolated Postgres engine. No production URL,
// credentials, customers, notifications or stock are used by this test.
const read=name=>readFileSync('supabase/migrations/'+name,'utf8');
const nativeUrl=process.env.HAKUNA_TEST_DATABASE_URL;
let db;
if(nativeUrl){
  const u=new URL(nativeUrl);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.pathname.startsWith('/hakuna_test'), 'Native tests require a dedicated local hakuna_test database');
  const {Client}=await import('pg');const client=new Client({connectionString:nativeUrl});await client.connect();
  db={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:()=>client.end()};
}else db=new PGlite();
const rows=async(sql,args=[])=> (await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const fail=async(fn,pattern)=>assert.rejects(fn,pattern);
try {
  if(nativeUrl){
    for(const role of ['anon','authenticated','service_role'])await db.exec(`do $$ begin create role ${role}; exception when duplicate_object then null; end $$;`);
  }else await db.exec('create role anon; create role authenticated; create role service_role;');
  if(nativeUrl){
    await db.exec(readFileSync('scripts/fixtures/hakuna-pre-v2-schema.sql','utf8'));
  }else{
  const baseline=read('20260901160609_kiubo_catalogos_v4_initial.sql');
  await db.exec(baseline.slice(0,baseline.indexOf('create or replace function public.catalog_check_pin')));
  await db.exec(read('20260902005600_kiubo_catalogos_v46_inventory.sql'));
  await db.exec('alter table public.catalog_order_items add column item_note text;');
  await db.exec(read('20260918160000_hakuna_presentation_shared_stock_atomic.sql'));
  await db.exec(read('20260920004500_hakuna_catalog_integrity_hardening.sql'));
  await db.exec(read('20260920073000_hakuna_delivery_map_location.sql'));
  await db.exec(read('20260911070000_hakuna_customer_stats_consistency.sql'));
  }
  const account=randomUUID(),other=randomUUID(),product=randomUUID(),untracked=randomUUID(),foreign=randomUUID();
  const unit=randomUUID(),jaba=randomUUID(),legacy=randomUUID(),legacyItem=randomUUID();
  await db.query("insert into public.catalog_accounts(id,slug,name,provider_pin_hash) values($1,'hakuna-matata','Hakuna Matata','test-only'),($2,'other-catalog','Other catalog','test-only')",[account,other]);
  await db.query("insert into public.catalog_products(id,account_id,name,price,stock_tracking,stock_quantity) values($1,$2,'Cola',2,true,42),($3,$2,'Sin control',2,false,0),($4,$5,'Otro negocio',3,true,5)",[product,account,untracked,foreign,other]);
  await db.query("insert into public.catalog_product_presentations(id,account_id,product_id,name,units_per_presentation,price,is_default) values($1,$2,$3,'Unidad',1,2,false),($4,$2,$3,'Jaba',9,18,true)",[unit,account,product,jaba]);
  await db.query("insert into public.catalog_orders(id,account_id,idempotency_key,order_number,customer_business,customer_phone,subtotal,total,status,inventory_committed) values($1,$2,$3,'OLD-1','Fixture','593999999999',6,6,'new',true)",[legacy,account,randomUUID()]);
  await db.query("insert into public.catalog_order_items(id,order_id,product_id,product_name,unit_price,quantity,line_total,presentation_id,presentation_name,units_per_presentation,base_units) values($1,$2,$3,'Cola',2,3,6,$4,'Unidad',1,3)",[legacyItem,legacy,product,unit]);
  const staged=read('20261030074358_hakuna_order_lifecycle_v2.sql');
  const activation=readFileSync('supabase/manual/hakuna_activate_delivery_inventory.sql','utf8');
  const migration=staged+'\n'+activation;
  await db.exec(staged);
  assert.equal(await scalar('select inventory_policy from public.catalog_accounts where id=$1',[account]),'created','Schema preparation cannot activate the new stock policy early');
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[product]),42);
  await db.exec(activation);
  const stock=()=>scalar('select stock_quantity from public.catalog_products where id=$1',[product]);
  const available=()=>scalar('select available_quantity from public.catalog_stock_availability($1) where product_id=$2',[account,product]);
  const order=id=>rows('select * from public.catalog_orders where id=$1',[id]).then(x=>x[0]);
  const items=id=>rows('select * from public.catalog_order_items where order_id=$1 order by created_at,id',[id]);
  const status=async(id,next,opts={})=>{
    const current=await order(id);
    return scalar('select public.catalog_change_order_status($1,$2,$3,$4,$5,$6,$7::jsonb)',[
      account,id,next,opts.revision??current.revision,opts.operation??randomUUID(),opts.reason??'Prueba de cambio',JSON.stringify({type:'provider'})]);
  };
  const create=async(lines,opts={})=>scalar('select public.catalog_create_order($1,$2,$3::jsonb,$4::jsonb)',[
    opts.slug??'hakuna-matata',opts.operation??randomUUID(),JSON.stringify({customer_business:'Fixture',customer_phone:'593999999999',delivery_method:'pickup',payment_method:opts.payment??'credit',...(opts.customer||{})}),JSON.stringify(lines)]);
  const amend=async(id,lines,kind='edit',opts={})=>scalar('select public.catalog_amend_order($1,$2,$3::jsonb,$4,$5,$6,$7,$8::jsonb)',[
    account,id,JSON.stringify(lines),opts.revision??(await order(id)).revision,opts.operation??randomUUID(),kind,'Pedido corregido por el cliente',JSON.stringify({type:'provider'})]);

  const productInput={name:'Producto de prueba',price:2,status:'available',visible:true,featured:false,sort_order:0};
  const stockInput={stock_tracking:true,stock_initialized:true,stock_quantity:10,low_stock_threshold:1,base_unit:'botella',allow_item_note:true};
  const rowsInput=[{name:'Unidad',units_per_presentation:1,price:2,is_default:true},{name:'Jaba',units_per_presentation:9,price:18,is_default:false}];
  const saveProduct=(op,id,expected,ps=rowsInput,prod=productInput,stk=stockInput)=>scalar('select public.catalog_save_product_atomic($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)',[account,op,id,expected,JSON.stringify(prod),JSON.stringify(ps),JSON.stringify(stk)]);
  const createProduct=(op,ps=rowsInput,prod=productInput,stk=stockInput)=>saveProduct(op,null,null,ps,prod,stk);
  const productOp=randomUUID(),createdProduct=await createProduct(productOp);
  assert.equal(createdProduct.atomic,true);assert.equal(createdProduct.presentations.length,2);
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[createdProduct.id]),10);
  const retriedProduct=await createProduct(productOp);assert.equal(retriedProduct.id,createdProduct.id);assert.equal(retriedProduct.duplicate,true);
  await fail(()=>createProduct(productOp,rowsInput,{...productInput,name:'Otro nombre'}),/operation_conflict/);
  await fail(()=>createProduct(randomUUID(),rowsInput,productInput,{...stockInput,stock_quantity:-1}),/invalid_stock/);
  const foreignCategory=randomUUID();await db.query("insert into public.catalog_categories(id,account_id,name) values($1,$2,'Categoría ajena')",[foreignCategory,other]);
  await fail(()=>createProduct(randomUUID(),rowsInput,{...productInput,category_id:foreignCategory}),/invalid_category/);
  const failedOp=randomUUID(),beforeBad=await scalar('select count(*)::integer from public.catalog_products');
  await fail(()=>createProduct(failedOp,[{name:'Inválida',units_per_presentation:0,price:2}]),/invalid_presentations/);
  assert.equal(await scalar('select count(*)::integer from public.catalog_products'),beforeBad,'An invalid presentation rolls the entire product back');
  assert.equal(await scalar('select count(*)::integer from public.catalog_product_save_operations where operation_id=$1',[failedOp]),0);
  const createdBox=createdProduct.presentations.find(x=>x.name==='Jaba'),createdUnit=createdProduct.presentations.find(x=>x.name==='Unidad');
  await fail(()=>create([{product_id:createdProduct.id,presentation_id:createdBox.id,quantity:1},{product_id:createdProduct.id,presentation_id:createdUnit.id,quantity:2}]),/insufficient_stock/);
  const validMixed=await create([{product_id:createdProduct.id,presentation_id:createdBox.id,quantity:1},{product_id:createdProduct.id,presentation_id:createdUnit.id,quantity:1}]);
  // A pending jaba and unit reserve ten base units. An otherwise valid product
  // edit must not reduce stock below that reservation or disable its tracking.
  const protectRows=createdProduct.presentations.map(p=>({id:p.id,name:p.name,units_per_presentation:p.units_per_presentation,price:p.price,visible:true,is_default:p.is_default}));
  await fail(()=>saveProduct(randomUUID(),createdProduct.id,10,protectRows,{...productInput,name:'No reducir'},
    {...stockInput,stock_quantity:9}),/stock_below_reserved/);
  await fail(()=>saveProduct(randomUUID(),createdProduct.id,10,protectRows,{...productInput,name:'No desactivar'},
    {...stockInput,stock_tracking:false,stock_initialized:false}),/stock_tracking_required_for_pending_orders/);
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[createdProduct.id]),10);
  assert.equal(await scalar('select name from public.catalog_products where id=$1',[createdProduct.id]),'Producto de prueba');
  await status(validMixed.id,'cancelled');
  await db.query("update public.catalog_products set image_path='photo-old',image_url='https://fixture.test/photo' where id=$1",[createdProduct.id]);
  const editRows=createdProduct.presentations.map(p=>({id:p.id,name:p.name,units_per_presentation:p.units_per_presentation,price:p.price,visible:true,is_default:p.is_default}));
  const editedInput={...productInput,name:'Producto corregido'},editedStock={...stockInput,stock_quantity:9};
  const editOp=randomUUID(),editedProduct=await saveProduct(editOp,createdProduct.id,10,editRows,editedInput,editedStock);
  assert.equal(editedProduct.atomic,true);assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[createdProduct.id]),9);
  assert.equal(await scalar('select image_path from public.catalog_products where id=$1',[createdProduct.id]),'photo-old','An omitted image cannot overwrite a separately saved photo');
  const editRetry=await saveProduct(editOp,createdProduct.id,10,editRows,editedInput,editedStock);assert.equal(editRetry.duplicate,true);
  await fail(()=>saveProduct(randomUUID(),createdProduct.id,10,editRows,{...productInput,name:'No guardar'},{...stockInput,stock_quantity:2}),/stock_conflict/);
  assert.equal(await scalar('select name from public.catalog_products where id=$1',[createdProduct.id]),'Producto corregido','A stale editor cannot partially save its name');
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[createdProduct.id]),9);
  await fail(()=>saveProduct(randomUUID(),createdProduct.id,9,[{name:'Inválida',units_per_presentation:0,price:2}],{...productInput,name:'No guardar'},{...stockInput,stock_quantity:2}),/invalid_presentations/);
  assert.equal(await scalar('select name from public.catalog_products where id=$1',[createdProduct.id]),'Producto corregido','Invalid presentations roll back all edits');
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[createdProduct.id]),9);
  const noStock=await createProduct(randomUUID(),rowsInput,{...productInput,name:'Sin existencias'},{...stockInput,stock_quantity:0});
  assert.equal(await scalar('select status from public.catalog_products where id=$1',[noStock.id]),'out');
  await fail(()=>create([{product_id:noStock.id,presentation_id:noStock.presentations[0].id,quantity:1}]),/product_unavailable|insufficient_stock/);
  const uncounted=await createProduct(randomUUID(),rowsInput,{...productInput,name:'Sin control'},{...stockInput,stock_tracking:false,stock_initialized:false,stock_quantity:0});
  const uncountedOrder=await create([{product_id:uncounted.id,presentation_id:uncounted.presentations[0].id,quantity:5}]);await status(uncountedOrder.id,'cancelled');
  assert.equal(await scalar("select relrowsecurity from pg_class where oid='public.catalog_product_save_operations'::regclass"),true);
  assert.equal(await scalar("select has_function_privilege('anon','public.catalog_save_product_atomic(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb)','execute')"),false);

  assert.equal(await stock(),45,'Migration restores legacy reservations into physical stock');
  assert.equal(Number(await available()),42,'Migration preserves old availability exactly');
  assert.equal((await order(legacy)).inventory_committed,false);
  assert.ok(await scalar("select 'credit'=any(payment_methods) from public.catalog_accounts where id=$1",[account]));
  await status(legacy,'cancelled');
  assert.equal(await stock(),45,'Cancelling a migrated pending order only releases its reservation');
  assert.equal(Number(await available()),45);
  await db.exec(migration);
  assert.equal(await stock(),45,'Applying the migration a second time cannot restore stock twice');

  const cart=[{product_id:product,presentation_id:jaba,quantity:2},{product_id:product,presentation_id:unit,quantity:3}];
  const idempotency=randomUUID(),first=await create(cart,{operation:idempotency});
  assert.equal(await stock(),45,'Placing the order cannot debit physical stock');
  assert.equal(Number(await available()),24,'Two jabas and three units reserve one shared pool of 21');
  const retry=await create(cart,{operation:idempotency});
  assert.equal(retry.id,first.id); assert.equal(retry.duplicate,true);
  assert.equal(Number(await available()),24,'A retry cannot reserve twice');
  await fail(()=>create([{product_id:product,presentation_id:jaba,quantity:3}]),/insufficient_stock/);
  const original=await items(first.id),boxes=original.find(x=>x.presentation_id===jaba);
  await amend(first.id,[{id:boxes.id,quantity:2,unit_price:0,units_per_presentation:1}]);
  assert.equal((await order(first.id)).total,'36.00','Existing price snapshots cannot be forged by an edit');
  assert.equal(Number(await available()),27); assert.equal(await stock(),45);
  const oldRevision=(await order(first.id)).revision;
  await fail(()=>amend(first.id,[{id:boxes.id,quantity:1}], 'edit',{revision:oldRevision-1}),/order_conflict/);
  await status(first.id,'confirmed');
  assert.equal(await stock(),45,'Confirmation only keeps the reservation');
  await fail(()=>amend(first.id,[{id:boxes.id,quantity:1}]),/order_not_editable/);
  const deliveryOperation=randomUUID(),beforeDelivery=await order(first.id);
  await status(first.id,'delivered',{operation:deliveryOperation});
  assert.equal(await stock(),27,'Delivery debits exactly 18 base units');
  await status(first.id,'delivered',{operation:deliveryOperation,revision:beforeDelivery.revision});
  assert.equal(await stock(),27,'A delivery retry cannot debit twice');
  const full=await create([{product_id:product,presentation_id:jaba,quantity:3}]);
  assert.equal(Number(await available()),0);
  await fail(()=>create([{product_id:product,presentation_id:unit,quantity:1}]),/insufficient_stock/);
  await status(full.id,'cancelled'); assert.equal(await stock(),27);
  const returnOp=randomUUID(),preReturn=await order(first.id);
  await amend(first.id,[{id:boxes.id,quantity:1}],'return',{operation:returnOp});
  assert.equal(await stock(),36,'Returning one of two jabas restores nine units');
  assert.equal((await order(first.id)).total,'18.00');
  await amend(first.id,[{id:boxes.id,quantity:1}],'return',{operation:returnOp,revision:preReturn.revision});
  assert.equal(await stock(),36,'A return retry cannot restore twice');
  await fail(()=>amend(first.id,[{id:boxes.id,quantity:2}],'return'),/return_quantity_exceeded/);
  await fail(()=>amend(first.id,[],'return'),/cancel_order_instead/);
  await fail(()=>amend(first.id,[{product_id:untracked,quantity:1}],'return'),/return_cannot_add_items/);
  await status(first.id,'cancelled'); assert.equal(await stock(),45,'Full cancellation after a partial return restores only the remaining jaba');
  const last=await order(first.id); await status(first.id,'cancelled',{revision:last.revision}); assert.equal(await stock(),45);
  const audit=await rows("select kind,before_state,after_state from public.catalog_order_revisions where order_id=$1 and kind='return'",[first.id]);
  assert.equal(audit.length,1); assert.equal(audit[0].before_state.items[0].quantity,2); assert.equal(audit[0].after_state.items[0].quantity,1);
  assert.equal(await scalar('select count(*)::integer from public.catalog_notification_jobs where order_id=$1',[first.id]),7,'Notifications are deduplicated per revision and audience');

  // Replace a presentation and add a different product in one pending edit.
  const amended=await create([{product_id:product,presentation_id:jaba,quantity:1}]);
  const oldBox=(await items(amended.id))[0];
  await amend(amended.id,[{id:oldBox.id,quantity:0},{product_id:product,presentation_id:unit,quantity:3},{product_id:untracked,quantity:2}]);
  assert.equal(Number((await order(amended.id)).total),10);
  assert.equal(Number(await available()),42,'Removing a jaba and adding units changes the shared reservation');
  assert.equal(await stock(),45,'Editing cannot debit physical stock');
  await status(amended.id,'confirmed');await status(amended.id,'delivered');assert.equal(await stock(),42);
  await status(amended.id,'cancelled');assert.equal(await stock(),45);

  await fail(()=>create([{product_id:foreign,quantity:1}]),/product_unavailable/);
  const unlimited=await create([{product_id:untracked,quantity:999}]);
  for(const next of ['confirmed','delivered','cancelled'])await status(unlimited.id,next);
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[untracked]),0,'Untracked products cannot gain fictitious stock on cancellation');
  const otherOrder=await create([{product_id:foreign,quantity:3}],{slug:'other-catalog',payment:'cash'});
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[foreign]),2,'Other catalogs retain their previous policy');
  assert.equal((await order(otherOrder.id)).inventory_policy,'created');
  await db.query("update public.catalog_orders set status='confirmed' where id=$1",[otherOrder.id]);
  await fail(()=>db.query("update public.catalog_orders set status='delivered' where id=$1",[otherOrder.id]),/invalid_status_transition/);
  const oldPreparing=await create([{product_id:untracked,quantity:1}]);
  await status(oldPreparing.id,'confirmed');await status(oldPreparing.id,'preparing');await status(oldPreparing.id,'delivered');
  assert.equal((await order(oldPreparing.id)).status,'delivered','Pre-existing preparing orders can finish directly');
  const paid=await create([{product_id:product,presentation_id:unit,quantity:3}]);
  await db.query("update public.catalog_orders set payment_status='paid' where id=$1",[paid.id]);
  for(const next of ['confirmed','delivered'])await status(paid.id,next);
  assert.equal(await stock(),42);
  // A later setting change cannot erase the debit ledger of a delivered order.
  await db.query('update public.catalog_products set stock_tracking=false where id=$1',[product]);
  const paidItem=(await items(paid.id))[0];
  await amend(paid.id,[{id:paidItem.id,quantity:1}],'return');
  assert.equal(await stock(),44);assert.equal(Number((await order(paid.id)).refund_due),4);
  await status(paid.id,'cancelled');assert.equal(await stock(),45);
  assert.equal(Number((await order(paid.id)).refund_due),6,'Only returned/cancelled paid amounts are marked for coordination');
  await fail(()=>status(paid.id,'new'),/refund_pending/);
  const refundOp=randomUUID(),refundRevision=(await order(paid.id)).revision;
  const refund=(amount,operation,revision)=>scalar('select public.catalog_record_refund($1,$2,$3,$4,$5,$6,$7::jsonb)',
    [account,paid.id,amount,revision,operation,'Efectivo entregado',JSON.stringify({type:'provider'})]);
  await refund(2,refundOp,refundRevision);assert.equal(Number((await order(paid.id)).refund_due),4);
  await refund(2,refundOp,refundRevision);assert.equal(Number((await order(paid.id)).refund_due),4,'Retry cannot record a refund twice');
  const pendingRevision=(await order(paid.id)).revision;
  await fail(()=>refund(5,randomUUID(),pendingRevision),/invalid_refund_amount/);
  await refund(4,randomUUID(),(await order(paid.id)).revision);assert.equal(Number((await order(paid.id)).refund_due),0);
  await status(paid.id,'new');assert.equal((await order(paid.id)).payment_status,'pending','A refunded and reopened order is not marked paid');
  await status(paid.id,'cancelled');assert.equal(await stock(),45);
  await db.query('update public.catalog_products set stock_tracking=true where id=$1',[product]);
  assert.equal(await scalar("select has_function_privilege('anon','public.catalog_amend_order(uuid,uuid,jsonb,bigint,uuid,text,text,jsonb)','execute')"),false);
  assert.equal(await scalar("select relrowsecurity from pg_class where oid='public.catalog_order_revisions'::regclass"),true);
  await db.exec(read('20261030080140_hakuna_push_multi_order_v2.sql'));
  const endpoint='https://fcm.googleapis.com/fcm/send/synthetic-test-only';
  const register=async(audience,version=null)=>scalar('select public.catalog_register_push_subscription($1,$2,$3,$4,$5,$6,$7)',
    ['hakuna-matata',audience,endpoint,'synthetic-public-key','synthetic-auth','test',version]);
  const customer=await register('customer');
  const version=await scalar('select session_version from public.catalog_accounts where id=$1',[account]);
  const provider=await register('provider',version);
  assert.equal(provider.subscription_id,customer.subscription_id,'One browser may receive both customer and provider notifications');
  assert.equal(provider.customer_enabled,true);assert.equal(provider.provider_enabled,true);
  await fail(()=>register('provider',version+1),/session_expired/);
  const firstToken=(await order(first.id)).public_token,fullToken=(await order(full.id)).public_token;
  const bind=(sub,ep,token)=>scalar('select public.catalog_bind_push_order($1,$2,$3,$4)',['hakuna-matata',sub,ep,token]);
  await bind(customer.subscription_id,endpoint,firstToken);
  await bind(customer.subscription_id,endpoint,fullToken);
  await bind(customer.subscription_id,endpoint,firstToken);
  assert.equal(await scalar('select count(*)::integer from public.catalog_push_order_bindings where subscription_id=$1',[customer.subscription_id]),2,'A subscription can follow two orders without duplicate bindings');
  await fail(()=>bind(customer.subscription_id,endpoint+'-wrong',firstToken),/push_subscription_missing/);
  await fail(()=>bind(customer.subscription_id,endpoint,randomUUID()),/order_not_found/);
  assert.equal(await scalar("select relrowsecurity from pg_class where oid='public.catalog_push_order_bindings'::regclass"),true);
  assert.equal(await scalar("select has_function_privilege('anon','public.catalog_bind_push_order(text,uuid,text,uuid)','execute')"),false);
  // Exercise the scheduler's SQL and secret wiring against isolated stubs;
  // this does not enable extensions or send network traffic in any project.
  await db.exec(`
    create schema vault; create table vault.test_secrets(id uuid primary key, decrypted_secret text);
    create view vault.decrypted_secrets as select * from vault.test_secrets;
    create function vault.create_secret(text,text,text) returns uuid language plpgsql as $$
      declare id uuid:=gen_random_uuid(); begin insert into vault.test_secrets values(id,$1); return id; end $$;
    create schema net; create table net.test_calls(url text,headers jsonb,body jsonb);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$
      begin insert into net.test_calls values(url,headers,body); return 1; end $$;
    create schema cron; create table cron.job(jobname text);
    create function cron.schedule(text,text,text) returns bigint language plpgsql as $$
      begin insert into cron.job values($1); return 1; end $$;
  `);
  const scheduler=readFileSync('supabase/manual/hakuna_notification_scheduler.sql','utf8').replace(/^create extension if not exists .*;$/gm,'');
  await db.exec(scheduler);
  await fail(()=>db.query("select public.catalog_install_notification_worker('hakuna-matata','https://evil.test')"),/invalid_supabase_url/);
  await db.query("select public.catalog_install_notification_worker('hakuna-matata','https://test.supabase.co')");
  await db.query("select public.catalog_install_notification_worker('hakuna-matata','https://test.supabase.co')");
  assert.equal(await scalar('select count(*)::integer from cron.job'),1,'Installing twice does not duplicate scheduled jobs');
  assert.equal(await scalar('select count(*)::integer from vault.test_secrets'),1,'Installing twice does not rotate or leak credentials');
  await db.query('select public.catalog_dispatch_due_notifications()');
  assert.equal(await scalar('select count(*)::integer from net.test_calls'),1);
  assert.equal(await scalar("select body->>'slug' from net.test_calls limit 1"),'hakuna-matata');
  console.log('✓ Actual Postgres: migration preserves availability; create/edit/confirm reserve; delivery debits; partial/full returns restore once; retry, stale edit, shared units, tenant isolation, untracked stock and audit guards pass.');
  console.log('✓ Push storage and scheduler SQL: shared roles, multiple orders, row security, retry scheduling and secret wiring pass using isolated stubs.');
} finally { await db.close(); }
