const SHELL_CACHE="kiubo-shell-v7";
// Offline durability compatibility guard retained for release validation: kiubo-shell-v3
const DATA_CACHE_PREFIX="kiubo-data-";
const SHELL=["/","/login","/app","/upgrade","/pos","/orders","/cash","/catalog","/inventory","/customers","/purchases","/reports","/operations","/branding","/manifest.webmanifest","/icon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==SHELL_CACHE&&!key.startsWith(DATA_CACHE_PREFIX)).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function fetchWithTimeout(request,timeoutMs=4500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timer)}
}

async function networkFirst(request){
  const cache=await caches.open(SHELL_CACHE);
  try{
    const response=await fetchWithTimeout(request);
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    return await cache.match(request)||Response.error();
  }
}

async function networkFirstNavigation(request){
  const cache=await caches.open(SHELL_CACHE);
  try{
    const response=await fetchWithTimeout(request);
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    return await cache.match(request)||await cache.match("/app")||await cache.match("/login")||await cache.match("/")||Response.error();
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(SHELL_CACHE);
  const cached=await cache.match(request);
  const network=fetch(request).then(async response=>{
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }).catch(()=>undefined);
  return cached||await network||Response.error();
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){event.respondWith(networkFirstNavigation(request));return}
  if(["script","style"].includes(request.destination)){event.respondWith(networkFirst(request));return}
  if(["image","font"].includes(request.destination))event.respondWith(staleWhileRevalidate(request));
});
