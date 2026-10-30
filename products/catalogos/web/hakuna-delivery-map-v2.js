/* Hakuna Matata delivery map v3. Blue = user's live GPS, orange = delivery destination. */
const types=["Casa","Trabajo","Local","Otro"];
const svg={
 Casa:'<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>',
 Trabajo:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
 Local:'<path d="M3 10 5 4h14l2 6v2H3zM5 12v8h14v-8M9 20v-6h6v6"/>',
 Otro:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>'
};
const typeIcon=type=>'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+svg[type]+'</svg>';
const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cleanPoint=value=>{
 if(!value||value.lat==null||value.lng==null||value.lat===""||value.lng==="")return null;
 const lat=Number(value.lat),lng=Number(value.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180||(lat===0&&lng===0))return null;
 return{lat:+lat.toFixed(6),lng:+lng.toFixed(6),label:String(value.label||"Punto de entrega").slice(0,160)};
};
const savedAddresses=key=>{
 try{const arr=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(arr)?arr.filter(x=>cleanPoint(x)&&types.includes(x.type)).slice(0,5):[]}
 catch{return[]}
};
export function openDeliveryMap({openSheet,closeSheet,ensureLeaflet,current,onSelect,onClear,toast,storageKey,customer}){
 const original=cleanPoint(current),saved=savedAddresses(storageKey);
 const previousType=types.find(x=>original?.label?.startsWith(x+" ·"))||"Casa";
 const html=[
  '<div class="hm-loc-v2" role="region" aria-label="Selecciona el destino de tu pedido">',
  '<header class="hm-loc-head"><span>CONFIRMAR DIRECCIÓN</span><h2>Marca tu punto exacto</h2></header>',
  '<div class="hm-loc-stage"><div id="hmLocMap" class="hm-loc-map" aria-label="Mapa de entrega"></div>',
  '<div class="hm-loc-pin" aria-hidden="true"><svg viewBox="0 0 24 24" width="32" height="32" fill="white"><path d="M12 2a7 7 0 0 0-7 7c0 4.8 7 12.8 7 12.8S19 13.8 19 9a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/></svg></div>',
  '',
  '<div class="hm-loc-loading" id="hmLocLoading" role="status">Preparando mapa…</div>',
  '<button type="button" class="hm-loc-gps" id="hmLocGPS" aria-label="Centrar en mi ubicación"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="7"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg></button>',
  '<p id="hmLocStatus" class="hm-loc-status" aria-live="polite">Elige un punto en el mapa</p></div><div class="hm-loc-controls"><div class="hm-loc-handle" aria-hidden="true"></div>',
  '',
  '',
  saved.length?'<label class="hm-loc-label">Tus direcciones guardadas<select id="hmLocSaved"><option value="">Elegir dirección guardada</option></select></label>':'',
  '<fieldset class="hm-loc-types"><legend>GUARDAR COMO</legend><div>',
  types.map(t=>'<button type="button" data-hm-type="'+t+'" aria-pressed="'+(t===previousType)+'" class="'+(t===previousType?'active':'')+'">'+typeIcon(t)+'<span>'+t+'</span></button>').join(''),
  '</div></fieldset>',
  '<label class="hm-loc-label">REFERENCIA <small>(opcional)</small><input id="hmLocRef" maxlength="160" autocomplete="street-address" placeholder="Ej. Casa blanca, junto a la farmacia…" value="'+escape(customer?.address||"")+'"></label>',
  '<label class="hm-loc-remember"><input type="checkbox" id="hmLocRemember"> Recordar dirección en este dispositivo</label>',
  '<div class="hm-loc-actions">',original?'<button type="button" id="hmLocClear">Quitar</button>':'',
  '<button type="button" id="hmLocConfirm" disabled>Confirmar punto →</button></div>',
  '</div></div>'
 ].join("");
 openSheet(html,async sheet=>{
  const root=sheet.querySelector(".hm-loc-v2");if(!root)return;
  const $=selector=>root.querySelector(selector),confirm=$("#hmLocConfirm"),status=$("#hmLocStatus"),gps=$("#hmLocGPS"),ref=$("#hmLocRef"),loading=$("#hmLocLoading");
  const back=sheet.querySelector(".v10-sheet-close");if(back){back.textContent="‹";back.title="Volver";back.setAttribute("aria-label","Volver al pedido");}
  let map=null,draft=original,chosen=Boolean(original),type=previousType,position=null,blueMarker=null,accuracyCircle=null;
  let watchId=null,observer=null,disposed=false,ready=false,programmatic=false,firstGpsView=!original;
  const refresh=()=>{
    const valid=Boolean(chosen&&cleanPoint(draft));confirm.disabled=!valid;
    status.classList.toggle("is-ready",valid);
    status.textContent=valid?draft.lat.toFixed(5)+", "+draft.lng.toFixed(5):"Desliza o toca el mapa para elegir";
  };
  const fromCenter=selected=>{
    if(!map||disposed)return;
    if(selected)chosen=true;
    if(!chosen)return refresh();
    const p=map.getCenter();draft=cleanPoint({lat:p.lat,lng:p.lng});refresh();
  };
  const pan=(point,zoom,selected=false)=>{
    if(!map||disposed)return;
    programmatic=true;
    if(selected)chosen=true;
    map.setView([point.lat,point.lng],zoom,{animate:false});
    programmatic=false;
    if(selected)fromCenter(false);
  };
  const stop=()=>{
    if(disposed)return;disposed=true;
    if(watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(watchId);watchId=null;}
    observer?.disconnect();if(map){map.remove();map=null;}
  };
  const chooseType=t=>{
    type=t;
    root.querySelectorAll("[data-hm-type]").forEach(button=>{
      const active=button.dataset.hmType===t;button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
  };
  root.querySelectorAll("[data-hm-type]").forEach(button=>button.onclick=()=>chooseType(button.dataset.hmType));
  const gpsUpdate=geo=>{
    if(disposed||!map||!root.isConnected)return;
    const p=cleanPoint({lat:geo.coords.latitude,lng:geo.coords.longitude});if(!p)return;
    position=p;
    const xy=[p.lat,p.lng],radius=Math.max(8,Math.min(Number(geo.coords.accuracy)||25,1200));
    if(!accuracyCircle)accuracyCircle=window.L.circle(xy,{radius,interactive:false,color:"#2784e9",weight:1,opacity:.27,fillColor:"#76bcff",fillOpacity:.1}).addTo(map);
    else accuracyCircle.setLatLng(xy).setRadius(radius);
    if(!blueMarker){
      const dot=window.L.divIcon({className:"hm-gps-blue",html:'<span class="hm-gps-blue-halo"></span><span class="hm-gps-blue-core"></span>',iconSize:[32,32],iconAnchor:[16,16]});
      blueMarker=window.L.marker(xy,{icon:dot,keyboard:false,interactive:false,zIndexOffset:450}).addTo(map);
    }else blueMarker.setLatLng(xy);
    gps.classList.add("located");
    if(firstGpsView&&!chosen){
      firstGpsView=false;pan(p,17);
      programmatic=true;map.panBy([0,-60],{animate:false});programmatic=false;
    }
    refresh();
  };
  const locate=silent=>{
    if(!navigator.geolocation){if(!silent)toast("El GPS no está disponible; mueve el mapa.","error");return}
    if(position){pan(position,Math.max(16,map?.getZoom()||16));programmatic=true;map.panBy([0,-60],{animate:false});programmatic=false;return}
    if(watchId!==null)return;
    gps.classList.add("locating");
    watchId=navigator.geolocation.watchPosition(geo=>{gps.classList.remove("locating");gpsUpdate(geo)},error=>{
      gps.classList.remove("locating");
      if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}
      if(!silent&&!disposed)toast(error?.code===1?"Activa el permiso de ubicación en el navegador.":"No se encontró tu GPS. Mueve el mapa manualmente.","error");
    },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  };
  gps.onclick=()=>locate(false);
    const savedSelect=$("#hmLocSaved");
  if(savedSelect){
    saved.forEach((entry,i)=>{
      const option=document.createElement("option");option.value=String(i);
      option.textContent=entry.type+" · "+(entry.reference||entry.lat.toFixed(4)+", "+entry.lng.toFixed(4));savedSelect.append(option);
    });
    savedSelect.onchange=()=>{
      if(savedSelect.value==="")return;
      const entry=saved[Number(savedSelect.value)],p=cleanPoint(entry);if(!p||!map)return;
      draft=p;chooseType(entry.type);ref.value=entry.reference||"";pan(p,17,true);refresh();
    };
  }
  $("#hmLocClear")?.addEventListener("click",()=>{stop();onClear();closeSheet(true)});
  confirm.onclick=()=>{
    const p=cleanPoint(draft);if(!chosen||!p)return toast("Marca primero un destino.","error");
    const reference=ref.value.trim().slice(0,160);
    if($("#hmLocRemember").checked){
      try{
        const old=savedAddresses(storageKey);
        const others=old.filter(x=>x.type!==type||Math.abs(x.lat-p.lat)>.0001||Math.abs(x.lng-p.lng)>.0001);
        localStorage.setItem(storageKey,JSON.stringify([{...p,type,reference},...others].slice(0,5)));
      }catch{/* Optional; never block order creation. */}
    }
    stop();onSelect({...p,label:type+" · Ubicación marcada",reference});closeSheet(true);
  };
  refresh();
  try{
    const L=await ensureLeaflet();if(disposed||!root.isConnected)return;
    const start=original||{lat:-1.55,lng:-78.5}; // Neutral Ecuador view, not a delivery coverage limit.
    map=L.map($("#hmLocMap"),{zoomControl:false,attributionControl:true,scrollWheelZoom:false,preferCanvas:true}).setView([start.lat,start.lng],original?17:6,{animate:false});
    // Standard OSM raster tiles: no provider API key required.
    // Browser cache + visible attribution are preserved by Leaflet.
    const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    });
    let tilesLoaded=false,tileErrors=0;
    const showMapUnavailable=()=>{
      if(disposed||tilesLoaded||!loading)return;
      loading.textContent="El mapa no está disponible. Puedes escribir la dirección en el pedido.";
      loading.classList.add("is-error");
    };
    // A layer can finish loading even when every individual tile failed.
    tiles.on("tileload",()=>{tilesLoaded=true;loading?.remove()});
    tiles.on("tileerror",()=>{if(++tileErrors>=4&&!tilesLoaded)showMapUnavailable()});
    tiles.addTo(map);
    setTimeout(showMapUnavailable,9500);
    L.control.zoom({position:"bottomleft"}).addTo(map);
    map.on("dragstart",()=>root.classList.add("dragging"));
    map.on("dragend",()=>{root.classList.remove("dragging");fromCenter(true)});
    map.on("click",event=>pan(event.latlng,map.getZoom(),true));
    map.on("moveend",()=>{if(ready&&!programmatic&&chosen)fromCenter(false)});
    setTimeout(()=>{if(disposed||!root.isConnected)return;map.invalidateSize();ready=true},200);
    setTimeout(()=>{if(!disposed&&root.isConnected)map.invalidateSize()},700);
    locate(true);
    observer=new MutationObserver(()=>{if(!root.isConnected)stop()});
    observer.observe(document.body,{childList:true,subtree:true});
  }catch{
    if(loading)loading.textContent="El mapa no está disponible. Escribe tu dirección en el formulario.";
    gps.disabled=true;confirm.disabled=true;stop();
    toast("No se pudo cargar el mapa. Puedes continuar con una dirección escrita.","error");
  }
 });
}
