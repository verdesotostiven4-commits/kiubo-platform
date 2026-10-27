/* Static DEMO shell only. Never cache actual money, credentials or API responses. */
const CACHE = "kiubo-panaderia-demo-v4";
const FILES = ["./","./index.html","./styles.css","./app.js","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith("kiubo-panaderia-demo-") && key !== CACHE)
      .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request)
    .then(response => response.ok ? response : Promise.reject(new Error("HTTP response invalid")))
    .catch(() => caches.match(event.request)));
});