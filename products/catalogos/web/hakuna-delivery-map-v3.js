/* Hakuna Matata: lightweight on-demand MapLibre + OpenFreeMap Positron.
   Blue = customer GPS; orange center pin = delivery point. */
const MAPLIBRE_JS="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const MAPLIBRE_CSS="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css";
const POSITRON_STYLE="https://tiles.openfreemap.org/styles/positron";
const TYPES=["Casa","Trabajo","Local","Otro"];
const ICONS={
 Casa:'<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
 Trabajo:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
 Local:'<path d="M3 10 5 4h14l2 6v2H3zM5 12v8h14v-8M9 20v-6h6v6"/>',
 Otro:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>'
};
const icon=t=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[t]+'</svg>';
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const point=v=>{
 if(!v||v.lat==null||v.lng==null||v.lat===""||v.lng==="")return null;
 const lat=Number(v.lat),lng=Number(v.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180||(lat===0&&lng===0))return null;
 return{lat:+lat.toFixed(6),lng:+lng.toFixed(6),label:String(v.label||"Punto de entrega").slice(0,160)};
};
const savedAddresses=key=>{try{let data=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(data)?data.filter(v=>point(v)&&TYPES.includes(v.type)).slice(0,5):[]}catch{return[]}};
let loaderPromise,stylePromise;
const loadMapLibreStyle=()=>{
 if(stylePromise)return stylePromise;
 stylePromise=new Promise((resolve,reject)=>{
  let link=document.querySelector('link[data-hakuna-maplibre]');
  if(link?.sheet)return resolve();
  if(!link){link=document.createElement("link");link.rel="stylesheet";link.href=MAPLIBRE_CSS;link.dataset.hakunaMaplibre="1";document.head.append(link)}
  const timeout=setTimeout(()=>{link.remove();reject(new Error("MapLibre stylesheet timed out"))},10000);
  link.addEventListener("load",()=>{clearTimeout(timeout);resolve()},{once:true});
  link.addEventListener("error",()=>{clearTimeout(timeout);link.remove();reject(new Error("MapLibre stylesheet unavailable"))},{once:true});
 }).catch(error=>{stylePromise=null;throw error});
 return stylePromise;
};
const loadMapLibre=()=>{
 if(loaderPromise)return loaderPromise;
 const scriptPromise=window.maplibregl?Promise.resolve(window.maplibregl):new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src=MAPLIBRE_JS;script.async=true;script.crossOrigin="anonymous";
  const fail=()=>{script.remove();reject(new Error("MapLibre could not load"))};
  const timeout=setTimeout(fail,11000);
  script.onload=()=>{clearTimeout(timeout);window.maplibregl?resolve(window.maplibregl):fail()};
  script.onerror=()=>{clearTimeout(timeout);fail()};
  document.head.append(script);
 });
 loaderPromise=Promise.all([scriptPromise,loadMapLibreStyle()]).then(([lib])=>lib).catch(error=>{loaderPromise=null;throw error});
 return loaderPromise;
};
const fallback=async options=>{
 const module=await import("./hakuna-delivery-map-v2.js");
 return module.openDeliveryMap(options);
};
export async function openDeliveryMap(options){
 let lib;
 try{if(window.maplibregl&&typeof window.maplibregl.supported==="function"&&!window.maplibregl.supported())throw Error("WebGL unsupported");lib=await loadMapLibre();if(typeof lib.supported==="function"&&!lib.supported())throw Error("WebGL unsupported")}
 catch{return fallback(options)}
 const {openSheet,closeSheet,current,onSelect,onClear,toast,storageKey,customer}=options;
 const original=point(current),saved=savedAddresses(storageKey);
 const oldType=TYPES.find(t=>original?.label?.startsWith(t+" ·"))||"Casa";
 const html=[
 '<div class="hm-loc-v2 hm-map-v3" role="region" aria-label="Dirección de entrega">',
 '<header class="hm-loc-head"><span>CONFIRMAR DIRECCIÓN</span><h2>Marca tu punto exacto</h2></header>',
 '<div class="hm-loc-stage"><div id="hmLocMap" class="hm-loc-map" role="application" aria-label="Mapa interactivo para indicar la entrega"></div>',
 '<div class="hm-loc-pin" aria-hidden="true"><svg viewBox="0 0 24 24" width="32" height="32" fill="white"><path d="M12 2a7 7 0 0 0-7 7c0 4.8 7 12.8 7 12.8S19 13.8 19 9a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/></svg></div>',
 '<button type="button" class="hm-loc-gps" id="hmLocGPS" aria-label="Ver mi ubicación actual"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="7"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg></button>',
 '<p id="hmLocStatus" class="hm-loc-status" aria-live="polite">Toca o mueve el mapa</p>',
 '<div class="hm-loc-loading" id="hmLocLoading" role="status">Cargando mapa minimalista…</div></div>',
 '<div class="hm-loc-controls"><div class="hm-loc-handle" aria-hidden="true"></div>',
 saved.length?'<label class="hm-loc-label">Direcciones guardadas<select id="hmLocSaved"><option value="">Selecciona una dirección</option></select></label>':'',
 '<fieldset class="hm-loc-types"><legend>GUARDAR COMO</legend><div>',
 TYPES.map(t=>'<button type="button" data-hm-type="'+t+'" aria-pressed="'+(t===oldType)+'" class="'+(t===oldType?'active':'')+'">'+icon(t)+'<span>'+t+'</span></button>').join(''),
 '</div></fieldset>',
 '<button type="button" class="hm-map-alternative" id="hmLocAlternative">¿No ves el mapa? Usar mapa alternativo</button>',
 '<label class="hm-loc-label">REFERENCIA <small>(opcional)</small><input id="hmLocRef" maxlength="160" autocomplete="street-address" placeholder="Ej. Casa blanca, junto a la farmacia…" value="'+escape(customer?.address||"")+'"></label>',
 '<label class="hm-loc-remember"><input type="checkbox" id="hmLocRemember"> Recordar dirección en este dispositivo</label>',
 '<div class="hm-loc-actions">',original?'<button type="button" id="hmLocClear">Quitar</button>':'',
 '<button type="button" id="hmLocConfirm" disabled>Confirmar punto →</button></div></div></div>'
 ].join("");
 openSheet(html,sheet=>{
  const root=sheet.querySelector(".hm-map-v3");if(!root)return;
  const $=selector=>root.querySelector(selector),confirm=$("#hmLocConfirm"),status=$("#hmLocStatus"),
        gps=$("#hmLocGPS"),ref=$("#hmLocRef"),loading=$("#hmLocLoading");
  const back=sheet.querySelector(".v10-sheet-close");if(back){back.textContent="‹";back.setAttribute("aria-label","Volver al pedido");back.title="Volver al pedido"}
  let map=null,gpsMarker=null,gpsCircle=null,observer=null,sizeObserver=null,watchId=null,disposed=false,tilesReady=false,tileErrors=0;
  const timers=[];
  const schedule=(fn,ms)=>{const timer=setTimeout(fn,ms);timers.push(timer);return timer};
  let draft=original,chosen=Boolean(original),type=oldType,position=null,firstGps=!original;
  const refresh=()=>{
   const valid=Boolean(chosen&&point(draft));confirm.disabled=!valid;
   status.classList.toggle("is-ready",valid);
   status.textContent=valid?draft.lat.toFixed(5)+", "+draft.lng.toFixed(5):"Toca o mueve el mapa";
  };
  const moveCamera=(where,zoom,select)=>{
   if(!map||disposed)return;
   if(select)chosen=true;
   map.jumpTo({center:[where.lng,where.lat],zoom});
   if(select){draft=point(where);refresh()}
  };
  const stop=()=>{
   if(disposed)return;disposed=true;
   if(watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(watchId);watchId=null;}
   timers.forEach(clearTimeout);
   observer?.disconnect();sizeObserver?.disconnect();if(map){map.remove();map=null}
  };
  const useFallback=()=>{if(disposed||!root.isConnected)return;const savedOptions={...options,current:chosen?draft:original,customer:{...customer,address:ref.value}};stop();closeSheet(true);fallback(savedOptions).catch(()=>toast("No se pudo abrir el mapa. Escribe la dirección manualmente.","error"))};
  $("#hmLocAlternative").onclick=useFallback;
  root.querySelectorAll("[data-hm-type]").forEach(btn=>btn.onclick=()=>{
   type=btn.dataset.hmType;
   root.querySelectorAll("[data-hm-type]").forEach(b=>{let active=b===btn;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))})
  });
  const updateGps=geo=>{
   if(disposed||!map||!root.isConnected)return;
   const p=point({lat:geo.coords.latitude,lng:geo.coords.longitude});
   if(!p)return;position=p;gps.classList.add("located");
   const circleMeters=Math.max(8,Math.min(Number(geo.coords.accuracy)||25,1000));
   const mpp=156543.03392*Math.cos(p.lat*Math.PI/180)/Math.pow(2,map.getZoom());
   const radiusPixels=Math.min(220,Math.max(18,circleMeters/Math.max(.1,mpp)));
   if(!gpsMarker){
    const element=document.createElement("div");element.className="hmv3-gps-location";
    element.innerHTML='<div class="hmv3-gps-radius"></div><div class="hmv3-gps-pulse"></div><div class="hmv3-gps-center"></div>';
    gpsCircle=element.querySelector(".hmv3-gps-radius");
    gpsMarker=new lib.Marker({element,anchor:"center"}).setLngLat([p.lng,p.lat]).addTo(map);
   }else gpsMarker.setLngLat([p.lng,p.lat]);
   if(gpsCircle){gpsCircle.dataset.meters=String(circleMeters);gpsCircle.style.width=radiusPixels*2+"px";gpsCircle.style.height=radiusPixels*2+"px"}
   if(firstGps&&!chosen){
    firstGps=false;moveCamera(p,17,false);
    // Blue dot remains at true GPS coordinate; orange pin remains at map center.
    map.panBy([0,-55],{duration:0});
   }
  };
  const locate=showError=>{
   if(!navigator.geolocation){if(showError)toast("GPS no disponible. Marca el destino en el mapa.","error");return}
   if(position){chosen=false;draft=null;refresh();moveCamera(position,Math.max(16,map.getZoom()),false);return}
   if(watchId!==null)return;
   gps.classList.add("locating");
   watchId=navigator.geolocation.watchPosition(geo=>{gps.classList.remove("locating");updateGps(geo)},err=>{
    gps.classList.remove("locating");
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}
    if(showError&&!disposed)toast(err?.code===1?"Activa el permiso de ubicación.":"No se pudo localizar el GPS.","error");
   },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  };
  gps.onclick=()=>locate(true);
  const sel=$("#hmLocSaved");
  if(sel){
   saved.forEach((entry,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=entry.type+" · "+(entry.reference||entry.lat.toFixed(4)+", "+entry.lng.toFixed(4));sel.append(option)});
   sel.onchange=()=>{
    if(sel.value==="")return;
    const entry=saved[Number(sel.value)],p=point(entry);if(!p||!map)return;
    type=entry.type;ref.value=entry.reference||"";
    root.querySelectorAll("[data-hm-type]").forEach(btn=>{const on=btn.dataset.hmType===type;btn.classList.toggle("active",on);btn.setAttribute("aria-pressed",String(on))});
    moveCamera(p,17,true);
   };
  }
  $("#hmLocClear")?.addEventListener("click",()=>{stop();onClear();closeSheet(true)});
  confirm.onclick=()=>{
   const p=point(draft);if(!chosen||!p)return toast("Primero selecciona el lugar de entrega.","error");
   const reference=ref.value.trim().slice(0,160);
   if($("#hmLocRemember").checked){
    try{
     const before=savedAddresses(storageKey);
     const rest=before.filter(x=>x.type!==type||Math.abs(x.lat-p.lat)>.0001||Math.abs(x.lng-p.lng)>.0001);
     localStorage.setItem(storageKey,JSON.stringify([{...p,type,reference},...rest].slice(0,5)));
    }catch{}
   }
   stop();onSelect({...p,label:type+" · Ubicación marcada",reference});closeSheet(true);
  };
  refresh();
  try{
   const start=original||{lat:-1.55,lng:-78.5};
   map=new lib.Map({
    container:$("#hmLocMap"),style:POSITRON_STYLE,center:[start.lng,start.lat],
    zoom:original?17:6,minZoom:3,maxZoom:19,attributionControl:true,
    dragRotate:false,touchPitch:false,pitchWithRotate:false,bearing:0,cooperativeGestures:false,
    renderWorldCopies:false,fadeDuration:0
   });
   map.addControl(new lib.NavigationControl({showCompass:false,visualizePitch:false}),"bottom-left");
   const removePois=()=>{
    // Positron is already minimal. Hide dense incidental POIs, but retain roads and street names.
    for(const layer of map.getStyle()?.layers||[]){
     if(layer.type==="symbol"&&/(^|[-_])(poi|housenumber|house-number)([-_]|$)/i.test(layer.id)){
      try{map.setLayoutProperty(layer.id,"visibility","none")}catch{}
     }
    }
   };
   const resizeMap=()=>{if(!disposed&&map&&root.isConnected)map.resize()};
   // The sheet opens with a transform and can change height after the first
   // render (notably on desktop). Keep the canvas aligned with its container.
   if(typeof ResizeObserver!=="undefined"){
    sizeObserver=new ResizeObserver(resizeMap);sizeObserver.observe($("#hmLocMap"));
   }
   sheet.addEventListener("transitionend",resizeMap);
   const markTilesReady=()=>{
    if(disposed)return;
    // An empty/failed style can also become idle: do not dismiss the loader
    // until there is at least one real map source to render.
    const sources=map?.getStyle?.()?.sources;
    if(!sources||!Object.keys(sources).length)return;
    tilesReady=true;loading?.remove();
   };
   map.on("load",()=>{if(disposed)return;removePois();resizeMap();if(map?.areTilesLoaded?.())markTilesReady()});
   // MapLibre signals `idle` only after all requested visible tiles have loaded.
   // Some versions do not expose a `tile.state` in sourcedata events. Relying
   // solely on it showed a gray loading mask even when the map had rendered.
   map.on("idle",markTilesReady);
   map.on("sourcedata",event=>{
    if(disposed)return;
    if((event?.isSourceLoaded||event?.tile?.state==="loaded")&&
        (!map?.areTilesLoaded||map.areTilesLoaded()))markTilesReady();
   });
   map.on("dragstart",()=>root.classList.add("dragging"));
   map.on("dragend",()=>{
    root.classList.remove("dragging");
    if(disposed)return;
    chosen=true;const c=map.getCenter();draft=point({lat:c.lat,lng:c.lng});refresh();
   });
   map.on("click",evt=>{
    if(disposed)return;moveCamera({lat:evt.lngLat.lat,lng:evt.lngLat.lng},map.getZoom(),true)
   });
   map.on("zoomend",()=>{if(position&&gpsCircle){
    const mpp=156543.03392*Math.cos(position.lat*Math.PI/180)/Math.pow(2,map.getZoom());
    // Keep accuracy indication approximately proportional to zoom.
    const currentMeters=Math.max(10,Number(gpsCircle.dataset.meters)||25);
    const radius=Math.min(220,Math.max(18,currentMeters/Math.max(.1,mpp)));
    gpsCircle.style.width=radius*2+"px";gpsCircle.style.height=radius*2+"px";
   }});
   map.on("error",()=>{if(disposed||tilesReady)return;if(++tileErrors>=4)return useFallback();if(loading)loading.textContent="Estamos buscando un mapa disponible…"});
   schedule(()=>{if(!disposed&&!tilesReady)useFallback()},12000);
   requestAnimationFrame(resizeMap);schedule(resizeMap,220);schedule(resizeMap,600);
   locate(false);
   observer=new MutationObserver(()=>{if(!root.isConnected)stop()});
   observer.observe(document.body,{childList:true,subtree:true});
  }catch(error){
   stop();closeSheet(true);
   fallback(options).catch(()=>toast("No se pudo abrir el mapa. Escribe la dirección manualmente.","error"));
  }
 });
}
