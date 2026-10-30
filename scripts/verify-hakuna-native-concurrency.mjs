import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const url=process.env.HAKUNA_TEST_DATABASE_URL;
assert.ok(url&&['localhost','127.0.0.1'].includes(new URL(url).hostname)&&new URL(url).pathname.startsWith('/hakuna_test'));
const pool=new pg.Pool({connectionString:url,max:6});
const account=randomUUID(),product=randomUUID();
const scalar=async(sql,args=[])=>Object.values((await pool.query(sql,args)).rows[0])[0];
try{
  await pool.query("insert into public.catalog_accounts(id,slug,name,provider_pin_hash,inventory_policy,payment_methods) values($1,'hakuna-race','Race fixture','test-only','delivered',array['cash'])",[account]);
  await pool.query("insert into public.catalog_products(id,account_id,name,price,stock_quantity,stock_tracking,stock_initialized) values($1,$2,'Race fixture',2,5,true,true)",[product,account]);
  const create=()=>scalar('select public.catalog_create_order($1,$2,$3::jsonb,$4::jsonb)',[
    'hakuna-race',randomUUID(),JSON.stringify({customer_business:'Fixture',customer_phone:'593999999999',delivery_method:'pickup',payment_method:'cash'}),JSON.stringify([{product_id:product,quantity:4}])]);
  const results=await Promise.allSettled([create(),create()]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1,'Only one simultaneous order can reserve the last units');
  assert.match(results.find(x=>x.status==='rejected').reason.message,/insufficient_stock/);
  const order=results.find(x=>x.status==='fulfilled').value;
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[product]),5);
  const change=(status,rev,op)=>scalar('select public.catalog_change_order_status($1,$2,$3,$4,$5,$6,$7::jsonb)',[account,order.id,status,rev,op,'Synthetic concurrency test',JSON.stringify({type:'provider'})]);
  await change('confirmed',0,randomUUID());
  const delivery=randomUUID();
  const delivered=await Promise.all([change('delivered',1,delivery),change('delivered',1,delivery)]);
  assert.ok(delivered.some(x=>x.duplicate));
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[product]),1,'Concurrent retries debit once');
  const cancel=randomUUID();await Promise.all([change('cancelled',2,cancel),change('cancelled',2,cancel)]);
  assert.equal(await scalar('select stock_quantity from public.catalog_products where id=$1',[product]),5,'Concurrent cancellation restores once');
  console.log('✓ Native PostgreSQL, multiple connections: no overselling, delivery/cancellation idempotent under concurrent retries.');
}finally{await pool.end()}
