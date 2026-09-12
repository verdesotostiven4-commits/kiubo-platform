const CACHE='kiubo-catalog-v10-8-0-20260911';
const SHELL=[
'/','/index.html','/panel.html','/pedido.html',
'/catalog-v10.css','/catalog-v10.2.css','/catalog-v10.3.css','/catalog-v10.4.css','/catalog-v10.4.1.css','/catalog-v10.4.2.css','/catalog-v10.5.css','/catalog-v10.5.1.css','/catalog-v10.6.css','/catalog-v10.7.1.css','/catalog-v10.7.2.css','/catalog-v10.7.3.css','/catalog-v10.7.4.css','/catalog-v10.8.css',
'/catalog-v10.2.js','/catalog-v10.3.js','/catalog-v10.4.js','/catalog-v10.4.1.js','/catalog-v10.4.2.js','/catalog-v10.5.js','/catalog-v10.5.1.js','/catalog-v10.6.js','/catalog-v10.7.1.js','/catalog-v10.7.2.js','/catalog-v10.7.3.js','/catalog-v10.7.4.js','/catalog-v10.8.js','/push-v10.7.js','/brand-assets-v10.js','/brand-assets-v10.7.2.js',
'/panel-v5.css','/panel-v6.css','/panel-v7.css','/panel-v7.1.css','/panel-v7.2.1.css','/panel-v7.5.css','/panel-v7.6.css','/panel-v7.7.css','/panel-v10-stability.css','/panel-v10.4.2.css','/panel-v10.5.css','/panel-v10.5.1.css','/panel-v10.6.css','/panel-v10.8.css',
'/panel-fast-save-v7.4.js','/panel-v6.js','/panel-v5.js','/panel-extras-v5.js','/panel-orders-v6.js','/panel-v7.js','/panel-v7.5.js','/panel-v7.5.1.js','/panel-v7.6.js','/panel-v7.7.js','/panel-v10-stability.js','/panel-v10.5.js','/panel-v10.5.1.js','/panel-v10.6.js','/panel-v10.8.js',
'/panel.css','/styles.css','/pedido.css','/orders-v5.css','/core.js','/config.js','/manifest.webmanifest','/panel.webmanifest'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>{if(u.pathname.startsWith('/panel')||u.pathname.startsWith('/master'))return caches.match('/panel.html');if(u.pathname.startsWith('/pedido'))return caches.match('/pedido.html');return caches.match('/index.html')}));return}
 if(/\.(?:js|css|html|webmanifest)$/.test(u.pathname)){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));return}
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})))
});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}const title=data.title||'Hakuna Matata';const options={body:data.body||'Tienes una actualización.',tag:data.tag||'hakuna-update',renotify:true,icon:data.icon||'/assets/brand-mark.svg',badge:data.badge||'/assets/brand-mark.svg',data:{url:data.url||'/'}};event.waitUntil(self.registration.showNotification(title,options))});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=event.notification.data?.url||'/';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client){client.navigate?.(target);return client.focus()}}return clients.openWindow?clients.openWindow(target):undefined}))});