/* Solo cachea archivos estáticos de la app. Nunca cachea datos contables ni respuestas de la nube. */
const CACHE='deliscias-shell-1.0.0';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./assets/deliscias-logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('deliscias-shell-')&&x!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;let url=new URL(e.request.url);if(url.origin!==self.location.origin)return;
 e.respondWith(fetch(e.request).then(response=>response.ok?response:Promise.reject(new Error('not ok'))).catch(()=>caches.match(e.request)).then(r=>r||Response.error()))});
