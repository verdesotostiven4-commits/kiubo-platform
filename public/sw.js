// KIUBO PWA shell. Never touch the separate kiubo-data-* durability cache.
const SHELL_CACHE="kiubo-shell-v10";
// Offline durability compatibility guard retained for release validation: kiubo-shell-v3
const ASSET_CACHE="kiubo-assets-v10";
const DATA_CACHE_PREFIX="kiubo-data-";
const SHELL=["/","/login","/app","/pos","/orders","/cash","/reports","/manifest.webmanifest","/icon.svg"];
const MAX_SHELL_ENTRIES=100;
const MAX_ASSET_ENTRIES=48;
const CORE_PATHS=new Set(SHELL);

async function openCache(name){
  try{return await caches.open(name)}catch{return null}
}
async function matchCached(cache,request){
  if(!cache)return null;
  try{return await cache.match(request)||null}catch{return null}
}
async function prune(cache,maxEntries,preserveCore=false){
  if(!cache)return;
  try{
    const entries=await cache.keys();
    if(entries.length<=maxEntries)return;
    let excess=entries.length-maxEntries;
    for(const request of entries){
      if(excess<=0)break;
      if(preserveCore&&CORE_PATHS.has(new URL(request.url).pathname))continue;
      if(await cache.delete(request))excess--;
    }
  }catch{
    // Cache maintenance is best-effort: never block sales or a valid network response.
  }
}
async function putSafely(cache,request,response,limit,preserveCore=false){
  if(!cache||!response?.ok)return;
  try{
    await cache.put(request,response.clone());
    await prune(cache,limit,preserveCore);
  }catch{
    // QuotaExceededError, cache corruption, or a blocked storage API cannot
    // turn a successful network download into a broken POS screen.
    await prune(cache,Math.max(12,Math.floor(limit/2)),preserveCore);
  }
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await openCache(SHELL_CACHE);
    if(cache){
      // Failure to cache even one page must not strand the old worker installed.
      await Promise.allSettled(SHELL.map(async path=>{
        const response=await fetch(new Request(path,{cache:"no-store"}));
        if(response?.ok)await putSafely(cache,path,response,MAX_SHELL_ENTRIES,true);
      }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    try{
      const keys=await caches.keys();
      await Promise.allSettled(keys
        .filter(key=>(key.startsWith("kiubo-shell-")||key.startsWith("kiubo-assets-"))&&key!==SHELL_CACHE&&key!==ASSET_CACHE)
        .map(key=>caches.delete(key)));
    }catch{}
    // Never remove kiubo-data-*; it contains the recoverable offline database.
    await self.clients.claim();
  })());
});

async function fetchWithTimeout(request,timeoutMs=8000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{signal:controller.signal,cache:"no-store"})}
  finally{clearTimeout(timer)}
}

async function networkFirst(request,isNavigation=false){
  const cache=await openCache(SHELL_CACHE);
  try{
    const response=await fetchWithTimeout(request);
    // Network response and cache persistence MUST be independent.
    if(response?.ok)await putSafely(cache,request,response,MAX_SHELL_ENTRIES,true);
    return response;
  }catch{
    const cached=await matchCached(cache,request);
    if(cached)return cached;
    if(isNavigation){
      for(const fallback of ["/app","/login","/"]){
        const page=await matchCached(cache,fallback);
        if(page)return page;
      }
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request,event){
  const cache=await openCache(ASSET_CACHE);
  const cached=await matchCached(cache,request);
  const network=fetch(request)
    .then(async response=>{
      if(response?.ok)await putSafely(cache,request,response,MAX_ASSET_ENTRIES);
      return response;
    })
    .catch(()=>null);
  if(cached){
    // Extend the worker lifetime so background refreshes actually finish.
    event.waitUntil(network.then(()=>undefined));
    return cached;
  }
  return await network||Response.error();
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){event.respondWith(networkFirst(request,true));return}
  if(["script","style"].includes(request.destination)){event.respondWith(networkFirst(request));return}
  if(["image","font"].includes(request.destination))event.respondWith(staleWhileRevalidate(request,event));
});
