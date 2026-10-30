import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';

// PRIVATE INPUT: never commit snapshots, customer/order data, or photo manifests.
// Only a scratch database is written. No network or production mutation occurs.
const root=process.env.HAKUNA_BACKUP_DIR;
assert.ok(root,'Set HAKUNA_BACKUP_DIR to a protected local backup directory');
const snapshot=JSON.parse(readFileSync(path.join(root,'snapshot.json'),'utf8'));
const manifest=JSON.parse(readFileSync(path.join(root,'photo-manifest.json'),'utf8'));
assert.equal(manifest.errors.length,0,'Every Storage object must have a verified copy');
for(const f of manifest.files){
  const p=path.resolve(root,'photos',f.name);
  assert.ok(p.startsWith(path.resolve(root,'photos')+path.sep));
  const bytes=readFileSync(p);assert.equal(bytes.length,f.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);
}
const db=new PGlite();
const mapping={accounts:'catalog_accounts',categories:'catalog_categories',products:'catalog_products',
  presentations:'catalog_product_presentations',customers:'catalog_customers',orders:'catalog_orders',
  items:'catalog_order_items',counters:'catalog_order_counters',activity:'catalog_activity_log',
  subscriptions:'catalog_push_subscriptions',push_events:'catalog_push_events'};
try{
  await db.exec('create role anon;create role authenticated;create role service_role;');
  // The WASM engine does not ship pgcrypto; recovery excludes authentication
  // secrets. Functions referencing pgcrypto remain unchanged but are not called.
  const schema=readFileSync('scripts/fixtures/hakuna-pre-v2-schema.sql','utf8')
    .replace('create extension if not exists pgcrypto with schema extensions;','');
  await db.exec(schema);
  for(const account of snapshot.accounts)if(account.tenant_id)
    await db.query('insert into public.tenants(id) values($1) on conflict do nothing',[account.tenant_id]);
  for(const table of Object.values(mapping))await db.exec(`alter table public.${table} disable trigger user`);
  for(const [key,table] of Object.entries(mapping)){
    const data=snapshot[key].map(row=>key==='accounts'?{...row,provider_pin_hash:'RECOVERY-TEST-ONLY-NOT-A-REAL-PIN'}:row);
    const columns=(await db.query('select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated=\'\' order by attnum',['public.'+table])).rows.map(x=>'"'+x.attname+'"').join(',');
    await db.query(`insert into public.${table}(${columns}) overriding system value select ${columns} from jsonb_populate_recordset(null::public.${table},$1::jsonb)`,[JSON.stringify(data)]);
    const restored=(await db.query(`select to_jsonb(t) as row from public.${table} t`)).rows.map(x=>x.row);
    const sort=arr=>JSON.stringify(arr.map(x=>Object.fromEntries(Object.entries(x).sort())).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    assert.equal(sort(restored),sort(data),`Restore must exactly preserve ${table}`);
  }
  for(const table of Object.values(mapping))await db.exec(`alter table public.${table} enable trigger user`);
  const before=new Map(snapshot.products.map(p=>[p.id,p.stock_quantity]));
  await db.exec(readFileSync('supabase/migrations/20261030074358_hakuna_order_lifecycle_v2.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261030080140_hakuna_push_multi_order_v2.sql','utf8'));
  const availability=(await db.query('select * from public.catalog_stock_availability($1)',[snapshot.account_id])).rows;
  for(const p of availability)assert.equal(Number(p.available_quantity),Number(before.get(p.product_id)),'Legacy availability must survive conversion');
  const report={restoredTables:Object.keys(mapping).length,products:snapshot.products.length,orders:snapshot.orders.length,
    photos:manifest.files.length,photoBytes:manifest.files.reduce((s,f)=>s+f.bytes,0),migrationsOnRestoredCopy:'passed',
    authenticationSecrets:'Excluded; production PIN and VAPID secrets are unchanged by this release',
    engine:'Isolated PostgreSQL WASM (PGlite); separate native integration is also required',capturedAt:snapshot.captured_at};
  writeFileSync(path.join(root,'restore-verification.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify(report));
}finally{await db.close()}
