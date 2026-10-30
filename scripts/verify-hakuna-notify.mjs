import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
// Exercise the actual Edge Function with an isolated in-memory DB and push provider.
const account={id:'a',slug:'hakuna-matata',name:'Hakuna',session_version:1};
const order={id:'o',account_id:'a',public_token:'55555555-5555-4555-8555-555555555555',order_number:'TEST-1',status:'confirmed',revision:2};
const job={event_key:'o:1:status:customer',account_id:'a',order_id:'o',audience:'customer',kind:'status',revision:1,status:'pending',attempts:0};
const rows={catalog_accounts:[account],catalog_orders:[order],catalog_order_revisions:[{order_id:'o',revision:1,after_state:{order:{status:'confirmed'}}}],catalog_notification_jobs:[job],catalog_push_config:[{account_id:'a',vapid_public_key:'test',vapid_private_key:'test',subject:'mailto:test@example.com'}],catalog_push_order_bindings:[],catalog_push_subscriptions:[],catalog_notification_deliveries:[],catalog_notification_workers:[],catalog_provider_sessions:[]};
for(let n=1;n<=3;n++){rows.catalog_push_subscriptions.push({id:'s'+n,account_id:'a',active:true,customer_enabled:true,endpoint:'https://fcm.googleapis.com/fcm/send/test'+n,p256dh:'key',auth:'auth'});rows.catalog_push_order_bindings.push({account_id:'a',order_id:'o',subscription_id:'s'+n})}
class Query{
 constructor(table){this.table=table;this.filters=[];this.action='select';this.single=false}
 select(){return this} eq(k,v){this.filters.push(x=>x[k]===v);return this} in(k,v){this.filters.push(x=>v.includes(x[k]));return this}
 maybeSingle(){this.single=true;return this} update(value){this.action='update';this.value=value;return this} upsert(value){this.action='upsert';this.value=value;return this}
 then(resolve,reject){try{let list=rows[this.table].filter(x=>this.filters.every(f=>f(x)));if(this.action==='update')list.forEach(x=>Object.assign(x,this.value));if(this.action==='upsert'){if(!rows[this.table].some(x=>x.event_key===this.value.event_key&&x.subscription_id===this.value.subscription_id))rows[this.table].push({...this.value});list=[this.value]}return Promise.resolve({data:this.single?list[0]||null:list,error:null}).then(resolve,reject)}catch(err){return Promise.reject(err).then(resolve,reject)}}
}
const db={from:table=>new Query(table),rpc:async(name,args)=>{if(name==='catalog_claim_notification_jobs'){const found=rows.catalog_notification_jobs.filter(j=>j.account_id===args.p_account_id&&j.status==='pending');for(const j of found){j.status='processing';j.attempts++}return {data:found.map(j=>({...j})),error:null}}throw Error('Unexpected RPC '+name)}};
const sent=[],payloads=[];let temporaryFailure=true;
const webpush={sendNotification:async (sub,payload)=>{sent.push(sub.endpoint);payloads.push(JSON.parse(payload));if(sub.endpoint.endsWith('test2')&&temporaryFailure){temporaryFailure=false;throw {statusCode:503}}if(sub.endpoint.endsWith('test3'))throw {statusCode:410}}};
let handler;const Deno={env:{get:key=>({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-secret',SUPABASE_SECRET_KEYS:'{}'})[key]},serve:fn=>{handler=fn}};
const source=readFileSync('supabase/functions/catalog-notify/index.ts','utf8').replace(/^import .*;\s*$/gm,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
vm.runInNewContext(js,{Deno,createClient:()=>db,webpush,EdgeRuntime:{waitUntil:()=>{}},crypto:webcrypto,URL,Request,Response,Headers,TextEncoder,console,setTimeout,clearTimeout});
const call=()=>handler(new Request('https://fixture.supabase.co/functions/v1/catalog-notify',{method:'POST',headers:{authorization:'Bearer test-secret','content-type':'application/json'},body:JSON.stringify({slug:'hakuna-matata',action:'dispatch'})}));
let response=await call();assert.equal(response.status,200);assert.equal(job.status,'pending','A transient push error must be retried');
assert.equal(rows.catalog_notification_deliveries.length,1);assert.equal(rows.catalog_push_subscriptions.find(s=>s.id==='s3').active,false,'Expired endpoints are deactivated');
assert.match(payloads[0].body,/confirmado/);assert.equal(payloads[0].url,`/pedido?ref=${order.public_token}`,'A confirmation links to this order’s tracking page');
response=await call();assert.equal(response.status,200);assert.equal(job.status,'sent');
assert.equal(sent.filter(x=>x.endsWith('test1')).length,1,'A previously successful delivery is not resent');
assert.equal(sent.filter(x=>x.endsWith('test2')).length,2);assert.equal(rows.catalog_notification_deliveries.length,2);
// A later payment revision did not suppress confirmation; an actually newer
// delivery status must suppress an old confirmation.
const old={...job,event_key:'old-confirmation',status:'pending',attempts:0};rows.catalog_notification_jobs.push(old);order.status='delivered';order.revision=3;
await call();assert.equal(old.status,'sent');assert.equal(old.last_error,'superseded');assert.equal(sent.length,4);
// A device that never opts in must not produce an endless minute-by-minute
// stream of worker calls. A later subscription wakes the pending job directly.
order.status='new';order.revision=4;
const waiting={...job,event_key:'waiting-provider',audience:'provider',kind:'created',revision:4,status:'pending',attempts:5,created_at:new Date().toISOString()};
rows.catalog_notification_jobs.push(waiting);const before=Date.now();await call();
assert.equal(waiting.status,'pending');assert.equal(waiting.last_error,'no_subscribers');
assert.ok(Date.parse(waiting.available_at)-before>=31*60_000,'Repeated opt-in waits back off substantially');
waiting.created_at=new Date(Date.now()-25*60*60_000).toISOString();waiting.status='pending';await call();
assert.equal(waiting.status,'sent');assert.equal(waiting.last_error,'notification_expired','Old notification jobs stop retrying');
const forbidden=await handler(new Request('https://fixture.supabase.co/functions/v1/catalog-notify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:'hakuna-matata',action:'dispatch'})}));assert.equal(forbidden.status,403);
console.log('✓ Hakuna notifications: provider acceptance, transient retry, expired endpoint and internal authorization pass with synthetic services.');
