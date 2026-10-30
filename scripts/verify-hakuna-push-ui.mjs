import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync('products/catalogos/web/push-v10.7.js','utf8');
async function run(decision){
 const dom=new JSDOM('<!doctype html><html><head></head><body><main>Catálogo accesible</main></body></html>',{url:'https://hakuna.test/',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window;let permissionCalls=0;class Notification{}Notification.permission='default';Notification.requestPermission=async()=>{permissionCalls++;Notification.permission=decision;return decision};w.Notification=Notification;w.PushManager=function(){};
 w.KIUBO_CATALOG_CONFIG={defaultSlug:'hakuna-matata',supabaseUrl:'https://fixture.test',apiUrl:'https://fixture.test/api',notifyUrl:'https://fixture.test/notify'};
 const token='55555555-5555-4555-8555-555555555555';w.localStorage.setItem('kiubo-v10-orders:hakuna-matata',JSON.stringify([{public_token:token}]));
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'testkey',auth:'testauth'}}}};
 const reg={pushManager:{getSubscription:async()=>subscription}};Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg)}});
 const posts=[];w.fetch=async(_url,opts)=>{const body=JSON.parse(opts.body);posts.push(body);return new Response(JSON.stringify(body.action==='subscribe'?{subscription_id:'66666666-6666-4666-8666-666666666666'}:{ok:true}),{status:200})};
 w.eval(source);w.dispatchEvent(new w.Event('pageshow'));assert.ok(w.document.querySelector('#hakunaPushPrompt'));assert.equal(permissionCalls,0,'The browser permission is requested only after a user action');
 w.document.querySelector('[data-push-activate]').click();await new Promise(resolve=>setTimeout(resolve,30));
 if(decision==='granted'){assert.equal(permissionCalls,1);assert.equal(posts.filter(x=>x.action==='subscribe').length,1);assert.equal(posts.find(x=>x.action==='bind_order').order_public_token,token);assert.ok(w.HakunaPush.current());assert.equal(w.document.querySelector('#hakunaPushPrompt'),null)}
 else{assert.equal(permissionCalls,1);assert.match(w.document.querySelector('#hakunaPushPrompt').textContent,/bloqueados/);w.document.querySelector('[data-push-dismiss]').click();assert.equal(w.document.querySelector('#hakunaPushPrompt'),null);assert.match(w.document.querySelector('main').textContent,/accesible/)}
 dom.window.close();
}
await run('granted');await run('denied');
{
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://hakuna.test/',runScripts:'outside-only'}),w=dom.window;
 let permissions=0;class Notification{}Notification.permission='granted';Notification.requestPermission=async()=>{permissions++;return 'granted'};
 w.Notification=Notification;w.PushManager=function(){};w.__hakunaSyntheticPreview=true;
 w.KIUBO_CATALOG_CONFIG={defaultSlug:'hakuna-matata',supabaseUrl:'https://fixture.invalid',apiUrl:'https://fixture.invalid/api'};
 Object.defineProperty(w.navigator,'serviceWorker',{value:{}});w.fetch=async()=>{throw Error('Demo must not register real push')};
 w.eval(source);w.dispatchEvent(new w.Event('pageshow'));
 assert.match(w.document.querySelector('#hakunaPushPrompt').textContent,/no se activan ni se envían avisos reales/i);
 assert.equal(w.document.querySelector('[data-push-activate]').hidden,true);assert.equal(permissions,0);
 dom.window.close();
}
console.log('✓ Hakuna opt-in: user gesture, registration, order binding and denied-permission fallback pass with simulated browser APIs.');
