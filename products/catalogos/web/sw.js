const CACHE = "kiubo-catalog-hakuna-v4.7.0-20260902";
const SHELL = ["/","/index.html","/panel.html","/pedido.html","/styles.css","/catalog.css","/panel.css","/pedido.css","/hakuna.theme.css","/ux-v4.5.css","/inventory-v4.6.css","/brands-v4.7.css","/core.js","/catalog.js","/panel.js","/pedido.js","/config.js","/inventory-v4.6.js","/brands-v4.7.js","/assets/brand-mark.svg","/assets/brand-lockup.svg","/manifest.webmanifest"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    const fallback = url.pathname.startsWith("/panel") || url.pathname.startsWith("/master") ? "/panel.html" : url.pathname.startsWith("/pedido") ? "/pedido.html" : "/index.html";
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request) || caches.match(fallback)));
    return;
  }
  if (/\.(?:js|css|html|webmanifest)$/.test(url.pathname)) {
    event.respondWith(fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; })));
});
