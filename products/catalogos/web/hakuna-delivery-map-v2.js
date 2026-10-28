/* Hakuna Matata: mapa móvil, inspirado en buenas prácticas de Pollazo, sin copiar su cobertura. */
const cleanPoint=v=>{if(!v||v.lat==null||v.lng==null||v.lat===""||v.lng==="")return null;const lat=Number(v.lat),lng=Number(v.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180||(lat===0&&lng===0))return null;return{lat:+lat.toFixed(6),lng:+lng.toFixed(6),label:String(v.label||"Punto de entrega").slice(0,160)}};
const types=["Casa","Trabajo","Local","Otro"];
const escape=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const readSaved=key=>{try{return JSON.parse(localStorage.getItem(key)||"[]").filter(x=>cleanPoint(x)&&types.includes(x.type)).slice(0,5)}catch{return []}};
export function openDeliveryMap({openSheet,closeSheet,ensureLeaflet,current,onSelect,onClear,toast,storageKey,customer}){
 const point=cleanPoint(current),saved=readSaved(storageKey);
 const html=['<div class="hm-loc-v2">',
  '<header class="hm-loc-head"><span>HAKUNA MATATA · ENTREGA</span><h2>¿Dónde recibes tu pedido?</h2><p>Coloca el pin verde exactamente donde quieres recibirlo.</p></header>',
  '<div class="hm-loc-stage"><div id="hmLocMap" class="hm-loc-map" aria-label="Mapa de entrega"></div><div class="hm-loc-pin" aria-hidden="true">📍</div><div id="hmLocLoading" class="hm-loc-loading" role="status">Cargando mapa…</div><button id="hmLocGPS" type="button" class="hm-loc-gps">◎ Mi ubicación</button></div>',
  '<div class="hm-loc-controls"><p id="hmLocStatus" class="hm-loc-status" aria-live="polite">Elige un punto moviendo el mapa o usando el GPS.</p>',
  saved.length?'<label class="hm-loc-label">Tus direcciones guardadas en este dispositivo<select id="hmLocSaved"><option value="">Elegir dirección guardada</option></select></label>':'',
  '<fieldset class="hm-loc-types"><legend>Guardar como</legend><div>',
  types.map((t,i)=>'<button type="button" data-hm-type="'+t+'" aria-pressed="'+(i===0)+'" class="'+(i===0?'active':'')+'">'+t+'</button>').join(''),
  '</div></fieldset><label class="hm-loc-label">Referencia para la entrega <small>(recomendada)</small><input id="hmLocRef" maxlength="160" placeholder="Ej. casa blanca, portón negro, cerca de..." value="'+escape(customer?.address||"")+'"></label>',
  '<label class="hm-loc-remember"><input type="checkbox" id="hmLocRemember"> Recordar esta dirección en este dispositivo</label>',
  '<div class="hm-loc-actions">',point?'<button id="hmLocClear" type="button">Quitar punto</button>':'',
  '<button id="hmLocConfirm" type="button" disabled>Confirmar ubicación →</button></div>',
  '<small class="hm-loc-note">Si prefieres no compartir GPS, también puedes escribir la dirección en el formulario.</small></div></div>'].join("");
 openSheet(html,async sheet=>{
  const root=sheet.querySelector(".hm-loc-v2");if(!root)return;
  const $=s=>root.querySelector(s),confirm=$("#hmLocConfirm"),message=$("#hmLocStatus"),loading=$("#hmLocLoading"),gps=$("#hmLocGPS"),reference=$("#hmLocRef");
  let draft=point,chosen=Boolean(point),type="Casa",map=null,disposed=false,ready=false;
  const refresh=()=>{const valid=chosen&&cleanPoint(draft);confirm.disabled=!valid;message.classList.toggle("is-ready",Boolean(valid));message.textContent=valid?"✓ Punto seleccionado · "+draft.lat.toFixed(5)+", "+draft.lng.toFixed(5):"Mueve el mapa o toca una calle para marcar el punto."};
  const center=()=>{if(!map)return;const c=map.getCenter();draft=cleanPoint({lat:c.lat,lng:c.lng});refresh()};
  const chooseType=t=>{type=t;root.querySelectorAll("[data-hm-type]").forEach(btn=>{const yes=btn.dataset.hmType===t;btn.classList.toggle("active",yes);btn.setAttribute("aria-pressed",String(yes))})};
  root.querySelectorAll("[data-hm-type]").forEach(btn=>btn.onclick=()=>chooseType(btn.dataset.hmType));
  const locate=silent=>{if(!navigator.geolocation){if(!silent)toast("GPS no disponible. Mueve el mapa manualmente.","error");return}gps.disabled=true;navigator.geolocation.getCurrentPosition(pos=>{gps.disabled=false;if(disposed||!map||!root.isConnected)return;chosen=true;map.setView([pos.coords.latitude,pos.coords.longitude],18,{animate:false});center()},()=>{gps.disabled=false;if(!silent)toast("No se pudo obtener tu ubicación. Usa el mapa manualmente.","error")},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})};
  gps.onclick=()=>locate(false);
  const savedSelect=$("#hmLocSaved");if(savedSelect){saved.forEach((x,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=x.type+" · "+(x.reference||x.lat.toFixed(4)+", "+x.lng.toFixed(4));savedSelect.append(opt)});savedSelect.onchange=()=>{const x=saved[Number(savedSelect.value)],p=cleanPoint(x);if(!p||!map)return;chosen=true;draft=p;chooseType(x.type);reference.value=x.reference||"";map.setView([p.lat,p.lng],17,{animate:false});refresh()}}
  $("#hmLocClear")?.addEventListener("click",()=>{onClear();if(map)map.remove();disposed=true;closeSheet(true)});
  confirm.onclick=()=>{const p=cleanPoint(draft);if(!chosen||!p)return toast("Primero elige un punto en el mapa.","error");const ref=reference.value.trim().slice(0,160);if($("#hmLocRemember").checked){try{const next=[{...p,type,reference:ref},...readSaved(storageKey).filter(x=>x.type!==type||Math.abs(x.lat-p.lat)>.0001||Math.abs(x.lng-p.lng)>.0001)].slice(0,5);localStorage.setItem(storageKey,JSON.stringify(next))}catch{}}onSelect({...p,label:type+" · Ubicación marcada",reference:ref});if(map)map.remove();disposed=true;closeSheet(true)};
  refresh();
  try{
   const L=await ensureLeaflet();if(disposed||!root.isConnected)return;
   // Centro neutro en Ecuador; NO se guarda hasta una selección explícita del cliente.
   const start=point||{lat:-1.55,lng:-78.5};
   map=L.map($("#hmLocMap"),{zoomControl:false,attributionControl:true,scrollWheelZoom:false}).setView([start.lat,start.lng],point?17:6,{animate:false});
   L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
   L.control.zoom({position:"bottomright"}).addTo(map);
   map.on("dragstart",()=>{chosen=true});
   map.on("click",e=>{chosen=true;map.panTo(e.latlng);center()});
   map.on("moveend",()=>{if(ready)center()});
   setTimeout(()=>{if(disposed||!root.isConnected)return;map.invalidateSize();ready=true},200);
   loading.remove();refresh();
   if(!point)locate(true);
   const obs=new MutationObserver(()=>{if(!root.isConnected){obs.disconnect();if(!disposed){disposed=true;map?.remove()}}});obs.observe(document.body,{childList:true,subtree:true});
  }catch{loading.textContent="No pudimos cargar el mapa. Puedes escribir tu dirección manualmente.";gps.disabled=true;confirm.disabled=true;toast("Mapa no disponible; escribe la dirección en el formulario.","error")}
 });
}