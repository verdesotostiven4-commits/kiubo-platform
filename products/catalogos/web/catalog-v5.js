import { api, money, escapeHTML, slugFromLocation, initials, uid, phoneDigits, formatDate } from './core.js';

const slug = slugFromLocation();
const LS = {
  cart: `kiubo-v5-cart:${slug}`,
  fav: `kiubo-v5-favorites:${slug}`,
  history: `kiubo-v5-orders:${slug}`,
  customer: `kiubo-v5-customer:${slug}`,
  cache: `kiubo-v5-bootstrap:${slug}`
};
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const read = (key, fallback) => { try { const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const icon = name => ({
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  receipt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>'
}[name]||'');

const state = {
  account:null,categories:[],products:[],presentations:[],
  cart:read(LS.cart,{}),favorites:new Set(read(LS.fav,[])),history:read(LS.history,[]),
  activeCategory:'all',activeBrand:'',query:'',activeProduct:null,activePresentation:null,
  delivery:'delivery',location:null,loaded:false
};

function saveCart(){ write(LS.cart,state.cart); updateCartFab(); }
function saveFav(){ write(LS.fav,[...state.favorites]); }
function productPresentations(id){
  const rows=state.presentations.filter(p=>String(p.product_id)===String(id)&&p.visible!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  if(rows.length) return rows;
  const p=state.products.find(x=>String(x.id)===String(id));
  return p?[{id:`legacy-${p.id}`,product_id:p.id,name:p.unit||'Unidad',unit_label:p.base_unit||'unidad',units_per_presentation:1,price:Number(p.price||0),compare_at_price:p.compare_at_price||null,is_default:true,visible:true}]:[];
}
function defaultPresentation(product){ return productPresentations(product.id).find(p=>p.is_default)||productPresentations(product.id)[0]; }
function cartKey(productId,presentationId){ return `${productId}:${presentationId}`; }
function cartEntries(){ return Object.entries(state.cart).map(([key,item])=>({key,...item})).filter(x=>x.quantity>0); }
function cartCount(){ return cartEntries().reduce((s,x)=>s+Number(x.quantity||0),0); }
function cartTotal(){ return cartEntries().reduce((s,x)=>s+Number(x.quantity||0)*Number(x.price||0),0); }
function productReservedBaseUnits(productId){ return cartEntries().filter(x=>String(x.product_id)===String(productId)).reduce((s,x)=>s+Number(x.quantity||0)*Number(x.units_per_presentation||1),0); }
function canAdd(product,presentation,qty=1){
  if(!product.stock_tracking) return true;
  const current=productReservedBaseUnits(product.id);
  return current + qty*Number(presentation.units_per_presentation||1) <= Number(product.stock_quantity||0);
}
function stockLabel(product){
  if(product.status==='out'||(product.stock_tracking&&Number(product.stock_quantity||0)<=0)) return ['Agotado','out'];
  if(product.status==='low'||(product.stock_tracking&&Number(product.stock_quantity||0)<=Number(product.low_stock_threshold||0))) return ['Pocas unidades','low'];
  return ['Disponible',''];
}
function normalize(str=''){ return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function matches(product){
  const q=normalize(state.query);
  const category=state.categories.find(c=>String(c.id)===String(product.category_id));
  if(state.activeCategory!=='all'&&String(product.category_id)!==String(state.activeCategory)) return false;
  if(state.activeBrand&&normalize(product.brand)!==normalize(state.activeBrand)) return false;
  if(!q) return true;
  return [product.name,product.brand,product.description,product.unit,category?.name].some(v=>normalize(v).includes(q));
}
function filteredProducts(){ return state.products.filter(p=>p.visible!==false&&!p.archived_at&&matches(p)); }
function brands(){ return [...new Set(state.products.map(p=>String(p.brand||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')); }
function toast(message,type=''){ const el=document.createElement('div'); el.className=`hm-toast ${type}`; el.textContent=message; document.body.append(el); setTimeout(()=>el.remove(),2600); }

function appShell(){
  document.body.innerHTML=`<div class="hm-app">
    <header class="hm-topbar"><div class="hm-shell hm-topbar__row">
      <div class="hm-brand"><span class="hm-brand__logo" id="brandLogo"></span><span class="hm-brand__copy"><strong id="brandName">Hakuna Matata</strong><small id="brandTagline">Catálogo mayorista</small></span></div>
      <button class="hm-icon-btn" id="shareBtn" aria-label="Compartir">${icon('share')}</button>
    </div></header>
    <main>
      <section class="hm-hero"><div class="hm-shell"><div class="hm-hero__card">
        <span class="hm-eyebrow"><i></i><span id="catalogState">Catálogo disponible</span></span>
        <h1 id="heroTitle">Encuentra lo que necesitas, rápido.</h1><p id="heroSubtitle">Productos, presentaciones y pedidos en un solo lugar.</p>
        <label class="hm-searchbar">${icon('search')}<input id="searchInput" autocomplete="off" placeholder="Buscar producto, marca o categoría…"><button class="hm-search-clear" id="searchClear" hidden aria-label="Limpiar">×</button></label>
        <div class="hm-meta"><span><b id="productCount">0</b> productos</span><span>Pedido directo</span><span>Seguimiento incluido</span></div>
      </div></div></section>
      <section class="hm-browse"><div class="hm-shell">
        <div class="hm-section-head"><div><small>Explorar</small><h2>Encuentra sin perder tiempo</h2></div><button class="hm-text-btn" id="resetFilters" hidden>Ver todo</button></div>
        <div class="hm-scroll" id="categoryChips"></div>
        <div class="hm-section-head" style="margin-top:8px"><div><small>Marcas</small></div></div>
        <div class="hm-scroll" id="brandChips"></div>
        <div class="hm-toolbar"><div class="hm-toolbar__copy"><b id="resultTitle">Todo el catálogo</b><small id="resultMeta">Cargando…</small></div></div>
        <div id="catalogContent"><div class="hm-loader"><div class="hm-skeleton"></div><div class="hm-skeleton"></div><div class="hm-skeleton"></div><div class="hm-skeleton"></div></div></div>
      </div></section>
    </main>
    <button class="hm-cart-fab" id="cartFab" hidden><span class="hm-cart-count" id="cartCount">0</span><span><b>Mi pedido</b><small id="cartTotal">$0,00</small></span>${icon('cart')}</button>
    <nav class="hm-bottomnav">
      <button class="hm-navbtn active" data-nav="home">${icon('home')}<span>Inicio</span></button>
      <button class="hm-navbtn" data-nav="categories">${icon('grid')}<span>Categorías</span></button>
      <button class="hm-navbtn" data-nav="favorites">${icon('heart')}<span>Favoritos</span><i class="hm-navbadge" id="favBadge" hidden>0</i></button>
      <button class="hm-navbtn" data-nav="orders">${icon('receipt')}<span>Pedidos</span><i class="hm-navbadge" id="orderBadge" hidden>0</i></button>
    </nav>
    <div id="overlayHost"></div>
  </div>`;
  bindBaseEvents(); updateBadges();
}

function brandMarkup(){
  const a=state.account||{}; $('#brandName').textContent=a.name||'Hakuna Matata'; $('#brandTagline').textContent=a.tagline||'Catálogo mayorista';
  $('#heroTitle').textContent=a.hero_title||'Encuentra lo que necesitas, rápido.'; $('#heroSubtitle').textContent=a.hero_subtitle||'Productos, presentaciones y pedidos en un solo lugar.';
  $('#catalogState').textContent=a.is_open===false?'Catálogo temporalmente cerrado':'Catálogo disponible';
  const logo=$('#brandLogo'); logo.innerHTML=a.logo_url?`<img src="${escapeHTML(a.logo_url)}" alt="">`:escapeHTML(initials(a.name||'Hakuna Matata'));
  document.documentElement.style.setProperty('--brand',a.accent||'#ef7048'); document.documentElement.style.setProperty('--brand-deep',a.accent_deep||'#d95731');
  document.title=`${a.name||'Hakuna Matata'} · Catálogo`;
}
function renderFilters(){
  $('#categoryChips').innerHTML=`<button class="hm-chip ${state.activeCategory==='all'?'active':''}" data-category="all">Todos</button>`+state.categories.filter(c=>c.visible!==false).map(c=>`<button class="hm-chip ${String(state.activeCategory)===String(c.id)?'active':''}" data-category="${c.id}">${escapeHTML(c.name)}</button>`).join('');
  $('#brandChips').innerHTML=brands().length?brands().map(b=>`<button class="hm-chip hm-brand-chip ${state.activeBrand===b?'active':''}" data-brand="${escapeHTML(b)}"><i></i>${escapeHTML(b)}</button>`).join(''):`<span style="color:#7e8781;font-size:12px;padding:8px 2px">Las marcas aparecerán aquí cuando Mayra las agregue a los productos.</span>`;
  $('#resetFilters').hidden=state.activeCategory==='all'&&!state.activeBrand&&!state.query;
}
function productCard(product){
  const p=defaultPresentation(product); const [label,klass]=stockLabel(product); const fav=state.favorites.has(String(product.id)); const out=klass==='out';
  const image=product.image_url?`<img loading="lazy" decoding="async" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">`:`<span class="hm-card__placeholder">${escapeHTML(initials(product.name))}</span>`;
  return `<article class="hm-card" data-product-card="${product.id}"><div class="hm-card__media" data-open-product="${product.id}">${image}<span class="hm-stock ${klass}">${label}</span><button class="hm-heart ${fav?'active':''}" data-favorite="${product.id}" aria-label="Favorito">${fav?'♥':'♡'}</button></div><div class="hm-card__body" data-open-product="${product.id}"><span class="hm-card__brand">${escapeHTML(product.brand||'Producto')}</span><h4>${escapeHTML(product.name)}</h4><div class="hm-card__presentation">${escapeHTML(p?.name||product.unit||'Unidad')}${productPresentations(product.id).length>1?` · ${productPresentations(product.id).length} opciones`:''}</div><div class="hm-card__foot"><span class="hm-price">${state.account?.show_prices===false?'Consultar':money(p?.price??product.price,state.account?.currency||'USD')}</span><button class="hm-add" ${out?'disabled':''} data-quick-add="${product.id}" aria-label="Agregar">+</button></div></div></article>`;
}
function renderCatalog(){
  renderFilters(); const items=filteredProducts(); $('#productCount').textContent=state.products.length; $('#resultMeta').textContent=`${items.length} producto${items.length===1?'':'s'}`;
  if(state.query) $('#resultTitle').textContent=`Resultados para “${state.query}”`;
  else if(state.activeBrand) $('#resultTitle').textContent=`Marca: ${state.activeBrand}`;
  else if(state.activeCategory!=='all') $('#resultTitle').textContent=state.categories.find(c=>String(c.id)===String(state.activeCategory))?.name||'Categoría';
  else $('#resultTitle').textContent='Todo el catálogo';
  if(!items.length){ $('#catalogContent').innerHTML=`<div class="hm-empty"><b>No encontramos productos</b><span>Prueba otra categoría, marca o búsqueda.</span></div>`; return; }
  if(state.activeCategory!=='all'||state.activeBrand||state.query){ $('#catalogContent').innerHTML=`<div class="hm-grid">${items.map(productCard).join('')}</div>`; return; }
  const groups=state.categories.filter(c=>c.visible!==false).map(c=>({c,items:items.filter(p=>String(p.category_id)===String(c.id))})).filter(g=>g.items.length);
  const uncategorized=items.filter(p=>!p.category_id||!state.categories.some(c=>String(c.id)===String(p.category_id)));
  $('#catalogContent').innerHTML=groups.map(({c,items:g})=>`<section class="hm-category-section"><div class="hm-category-title"><h3>${escapeHTML(c.name)}</h3><button data-category="${c.id}">Ver ${g.length}</button></div><div class="hm-grid">${g.map(productCard).join('')}</div></section>`).join('')+(uncategorized.length?`<section class="hm-category-section"><div class="hm-category-title"><h3>Otros</h3></div><div class="hm-grid">${uncategorized.map(productCard).join('')}</div></section>`:'');
}
function updateBadges(){ const f=state.favorites.size,h=state.history.length; $('#favBadge').textContent=f; $('#favBadge').hidden=!f; $('#orderBadge').textContent=h; $('#orderBadge').hidden=!h; updateCartFab(); }
function updateCartFab(){ const count=cartCount(),fab=$('#cartFab'); if(!fab)return; fab.hidden=!count; $('#cartCount').textContent=count; $('#cartTotal').textContent=money(cartTotal(),state.account?.currency||'USD'); }

function openLayer(title,body,{wide=false,onMount=null}={}){
  closeLayer(); const host=$('#overlayHost'); host.innerHTML=`<div class="hm-overlay"></div><section class="hm-sheet ${wide?'wide':''}"><div class="hm-sheet__grab"></div><div class="hm-sheet__head"><h2>${escapeHTML(title)}</h2><button class="hm-sheet__close" data-close-layer>×</button></div><div class="hm-sheet__scroll">${body}</div></section>`;
  requestAnimationFrame(()=>{$('.hm-overlay',host).classList.add('visible');$('.hm-sheet',host).classList.add('visible')}); setupSheetGesture($('.hm-sheet',host)); $('[data-close-layer]',host).onclick=closeLayer; $('.hm-overlay',host).onclick=closeLayer; onMount?.($('.hm-sheet',host));
}
function closeLayer(){ const host=$('#overlayHost'); if(!host?.children.length)return; const sheet=$('.hm-sheet',host),ov=$('.hm-overlay',host); sheet?.classList.remove('visible');ov?.classList.remove('visible');setTimeout(()=>host.innerHTML='',180); }
function setupSheetGesture(sheet){
  const grab=$('.hm-sheet__grab',sheet); let start=0,dy=0,drag=false;
  grab.addEventListener('pointerdown',e=>{drag=true;start=e.clientY;dy=0;sheet.classList.add('dragging');grab.setPointerCapture?.(e.pointerId)});
  grab.addEventListener('pointermove',e=>{if(!drag)return;dy=Math.max(0,e.clientY-start);sheet.style.transform=`translate3d(-50%,${dy}px,0)`});
  const end=()=>{if(!drag)return;drag=false;sheet.classList.remove('dragging');if(dy>80)closeLayer();else sheet.style.transform='';};grab.addEventListener('pointerup',end);grab.addEventListener('pointercancel',end);
}
function productSheet(product){
  state.activeProduct=product; state.activePresentation=defaultPresentation(product); const [label,klass]=stockLabel(product); const ps=productPresentations(product.id); const photo=product.image_url?`<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">`:`<span class="hm-card__placeholder">${escapeHTML(initials(product.name))}</span>`;
  const body=`<div class="hm-product-top"><div class="hm-product-photo">${photo}</div><div class="hm-product-info"><span class="hm-stock ${klass}">${label}</span><h2>${escapeHTML(product.name)}</h2><div class="hm-card__brand">${escapeHTML(product.brand||'')}</div><p class="hm-product-desc">${escapeHTML(product.description||'Selecciona la presentación y cantidad que necesitas.')}</p></div></div><div class="hm-presentations"><div class="hm-label">Presentación</div><div class="hm-presentation-list">${ps.map(p=>`<button class="hm-presentation-option ${p.id===state.activePresentation?.id?'active':''}" data-presentation="${p.id}"><span><b>${escapeHTML(p.name)}</b><small>${Number(p.units_per_presentation||1)} ${escapeHTML(product.base_unit||p.unit_label||'unidad')}${Number(p.units_per_presentation||1)===1?'':'es'}</small></span><strong>${state.account?.show_prices===false?'Consultar':money(p.price,state.account?.currency||'USD')}</strong></button>`).join('')}</div></div>${product.allow_item_note!==false?`<button class="hm-note-toggle" id="noteToggle">+ Añadir detalle para este producto</button><div class="hm-note-box" id="noteBox" hidden><textarea id="itemNote" maxlength="180" placeholder="Ej. sabor, color, modelo o variedad…"></textarea></div>`:''}<div class="hm-buybar"><div><div class="hm-label" style="margin:0">Cantidad</div><div class="hm-stepper"><button id="qtyMinus">−</button><b id="qtyValue">1</b><button id="qtyPlus">+</button></div></div><button class="hm-buybtn" id="addSelected">Agregar · <span id="selectedPrice">${state.account?.show_prices===false?'Consultar':money(state.activePresentation?.price||product.price,state.account?.currency||'USD')}</span></button></div>`;
  openLayer(product.name,body,{onMount:sheet=>{let qty=1; const refresh=()=>{$('#qtyValue',sheet).textContent=qty;$('#selectedPrice',sheet).textContent=state.account?.show_prices===false?'Consultar':money(Number(state.activePresentation?.price||0)*qty,state.account?.currency||'USD')};$$('[data-presentation]',sheet).forEach(btn=>btn.onclick=()=>{state.activePresentation=ps.find(p=>String(p.id)===String(btn.dataset.presentation))||ps[0];$$('[data-presentation]',sheet).forEach(x=>x.classList.toggle('active',x===btn));qty=1;refresh()});$('#qtyMinus',sheet).onclick=()=>{qty=Math.max(1,qty-1);refresh()};$('#qtyPlus',sheet).onclick=()=>{if(canAdd(product,state.activePresentation,qty+1-productReservedBaseUnits(product.id)))qty++;else toast('No hay más stock disponible','error');refresh()};const toggle=$('#noteToggle',sheet);if(toggle)toggle.onclick=()=>{const box=$('#noteBox',sheet);box.hidden=!box.hidden;toggle.textContent=box.hidden?'+ Añadir detalle para este producto':'− Ocultar detalle'};$('#addSelected',sheet).onclick=()=>{addToCart(product,state.activePresentation,qty,$('#itemNote',sheet)?.value||'');closeLayer()};}});
}
function addToCart(product,presentation,qty=1,note=''){
  if(stockLabel(product)[1]==='out')return toast('Este producto está agotado','error');
  if(!canAdd(product,presentation,qty))return toast('La cantidad supera el stock disponible','error');
  const key=cartKey(product.id,presentation.id); const current=state.cart[key]||{};
  state.cart[key]={product_id:product.id,presentation_id:presentation.id,product_name:product.name,presentation_name:presentation.name,units_per_presentation:Number(presentation.units_per_presentation||1),price:Number(presentation.price||0),quantity:Number(current.quantity||0)+qty,item_note:note.trim().slice(0,180),image_url:product.image_url||''}; saveCart(); toast('Agregado al pedido');
}
function quickAdd(product){ const p=defaultPresentation(product); if(productPresentations(product.id).length>1)return productSheet(product); addToCart(product,p,1,''); }
function changeCart(key,delta){const item=state.cart[key];if(!item)return;const product=state.products.find(p=>String(p.id)===String(item.product_id));const pres=productPresentations(item.product_id).find(p=>String(p.id)===String(item.presentation_id))||item;if(delta>0&&!canAdd(product,pres,1))return toast('No hay más stock disponible','error');item.quantity=Math.max(0,Number(item.quantity||0)+delta);if(!item.quantity)delete state.cart[key];saveCart();renderCart();}
function renderCart(){
  const items=cartEntries(); if(!items.length){closeLayer();return toast('Tu pedido está vacío');}
  const body=`<div id="cartBody">${items.map(x=>`<div class="hm-cartline"><div class="hm-cartline__img">${x.image_url?`<img src="${escapeHTML(x.image_url)}" alt="">`:escapeHTML(initials(x.product_name))}</div><div><h4>${escapeHTML(x.product_name)}</h4><p>${escapeHTML(x.presentation_name)}</p>${x.item_note?`<small class="hm-cartline__note">“${escapeHTML(x.item_note)}”</small>`:''}</div><div class="hm-cartline__right"><strong>${money(x.quantity*x.price,state.account?.currency||'USD')}</strong><div class="hm-mini-step"><button data-cart-minus="${escapeHTML(x.key)}">−</button><b>${x.quantity}</b><button data-cart-plus="${escapeHTML(x.key)}">+</button></div></div></div>`).join('')}<div class="hm-summary"><div><span>Total estimado</span><strong>${money(cartTotal(),state.account?.currency||'USD')}</strong></div></div><div class="hm-actions"><button class="hm-primary" id="startCheckout">Continuar con el pedido</button></div></div>`;
  openLayer('Mi pedido',body,{onMount:sheet=>{$$('[data-cart-minus]',sheet).forEach(b=>b.onclick=()=>changeCart(b.dataset.cartMinus,-1));$$('[data-cart-plus]',sheet).forEach(b=>b.onclick=()=>changeCart(b.dataset.cartPlus,1));$('#startCheckout',sheet).onclick=()=>checkoutForm();}});
}
function customerDefaults(){return {...{business:'',name:'',phone:'',address:'',notes:''},...read(LS.customer,{})};}
function checkoutForm(){ const c=customerDefaults(); const body=`<form class="hm-form" id="checkoutForm"><div class="hm-field"><label>Negocio o nombre del cliente *</label><input id="cBusiness" maxlength="80" value="${escapeHTML(c.business||'')}" placeholder="Ej. Tienda Barrio Max"></div><div class="hm-field"><label>Persona de contacto</label><input id="cName" maxlength="80" value="${escapeHTML(c.name||'')}" placeholder="¿Con quién coordinamos?"></div><div class="hm-field"><label>WhatsApp *</label><input id="cPhone" inputmode="numeric" maxlength="10" value="${escapeHTML(localPhone(c.phone||''))}" placeholder="099 123 4567"></div><div class="hm-field"><label>¿Cómo recibes el pedido?</label><div class="hm-choice"><button type="button" data-delivery="delivery" class="active">Entrega</button><button type="button" data-delivery="pickup">Retiro</button></div></div><div id="deliveryFields"><div class="hm-field"><label>Dirección o referencia</label><input id="cAddress" maxlength="160" value="${escapeHTML(c.address||'')}" placeholder="Sector, calle o referencia"></div><div class="hm-location"><span><b id="locationTitle">Ubicación opcional</b><small id="locationText">Adjunta el punto exacto si facilita la entrega.</small></span><button type="button" id="locationBtn">Usar mi ubicación</button></div></div><div class="hm-field"><label>Observaciones generales</label><textarea id="cNotes" maxlength="400" placeholder="Horario u otra indicación…">${escapeHTML(c.notes||'')}</textarea></div><div class="hm-actions"><button type="button" class="hm-primary" id="reviewOrder">Revisar pedido</button><button type="button" class="hm-secondary" id="backCart">Volver</button></div></form>`;
  openLayer('Datos del pedido',body,{onMount:sheet=>{state.delivery='delivery';$$('[data-delivery]',sheet).forEach(b=>b.onclick=()=>{state.delivery=b.dataset.delivery;$$('[data-delivery]',sheet).forEach(x=>x.classList.toggle('active',x===b));$('#deliveryFields',sheet).hidden=state.delivery==='pickup'});$('#locationBtn',sheet).onclick=()=>captureLocation(sheet);$('#backCart',sheet).onclick=renderCart;$('#reviewOrder',sheet).onclick=()=>reviewOrder(sheet);}});
}
function localPhone(v=''){const d=String(v).replace(/\D/g,'');if(d.startsWith('593'))return `0${d.slice(3,12)}`;if(d.length===9&&!d.startsWith('0'))return `0${d}`;return d.slice(0,10);}
function captureLocation(sheet){
  if(!navigator.geolocation)return toast('Tu navegador no permite compartir ubicación','error'); const btn=$('#locationBtn',sheet);btn.textContent='Ubicando…';
  navigator.geolocation.getCurrentPosition(pos=>{state.location={lat:pos.coords.latitude,lng:pos.coords.longitude,label:'Ubicación compartida por el cliente'};$('#locationTitle',sheet).textContent='Ubicación adjunta';$('#locationText',sheet).textContent=`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;btn.textContent='Actualizar';},()=>{btn.textContent='Usar mi ubicación';toast('No pudimos obtener la ubicación','error')},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}
function collectCustomer(sheet){return {business:$('#cBusiness',sheet).value.trim(),name:$('#cName',sheet).value.trim(),phone:localPhone($('#cPhone',sheet).value),address:$('#cAddress',sheet)?.value.trim()||'',notes:$('#cNotes',sheet).value.trim()};}
function reviewOrder(sheet){
  const c=collectCustomer(sheet); if(c.business.length<2)return toast('Escribe el negocio o nombre del cliente','error'); if(!/^09\d{8}$/.test(c.phone))return toast('Escribe un WhatsApp válido, por ejemplo 0991234567','error'); write(LS.customer,c);
  const entries=cartEntries(); const body=`<div class="hm-review"><div class="hm-review-card"><h4>Productos</h4>${entries.map(x=>`<div class="hm-review-line"><span>${x.quantity}× ${escapeHTML(x.product_name)} · ${escapeHTML(x.presentation_name)}${x.item_note?`<br><small>↳ ${escapeHTML(x.item_note)}</small>`:''}</span><strong>${money(x.quantity*x.price,state.account?.currency||'USD')}</strong></div>`).join('')}<div class="hm-review-line" style="border-top:1px solid #eee9e0;margin-top:6px;padding-top:10px"><b>Total estimado</b><strong>${money(cartTotal(),state.account?.currency||'USD')}</strong></div></div><div class="hm-review-card"><h4>Coordinación</h4><div class="hm-review-line"><span>${escapeHTML(c.business)}</span><span>${escapeHTML(c.name||'')}</span></div><div class="hm-review-line"><span>WhatsApp</span><strong>${escapeHTML(c.phone)}</strong></div><div class="hm-review-line"><span>Entrega</span><strong>${state.delivery==='pickup'?'Retiro':escapeHTML(c.address||'Por coordinar')}</strong></div>${state.location?`<div class="hm-review-line"><span>Ubicación</span><strong>Adjunta</strong></div>`:''}</div><div class="hm-actions"><button class="hm-primary" id="submitOrder">Confirmar pedido</button><button class="hm-secondary" id="editCustomer">Editar datos</button></div></div>`;
  openLayer('Revisa antes de enviar',body,{onMount:next=>{$('#editCustomer',next).onclick=checkoutForm;$('#submitOrder',next).onclick=()=>submitOrder(c,next);}});
}
async function submitOrder(c,sheet){
  const btn=$('#submitOrder',sheet);btn.disabled=true;btn.textContent='Registrando…'; const entries=cartEntries();
  try{
    const payload=await api('create_order',{slug,idempotency_key:uid(),customer:{customer_business:c.business,customer_name:c.name,customer_phone:phoneDigits(c.phone),delivery_method:state.delivery,delivery_address:state.delivery==='delivery'?c.address:null,delivery_lat:state.location?.lat??null,delivery_lng:state.location?.lng??null,delivery_location_label:state.location?.label??null,notes:c.notes},items:entries.map(x=>({product_id:x.product_id,presentation_id:String(x.presentation_id).startsWith('legacy-')?null:x.presentation_id,quantity:x.quantity,item_note:x.item_note||null}))});
    const order=payload.order||{}; const record={order_number:order.order_number,public_token:order.public_token,total:order.total||cartTotal(),created_at:new Date().toISOString(),status:'new'}; state.history=[record,...state.history.filter(x=>x.public_token!==record.public_token)].slice(0,20);write(LS.history,state.history);state.cart={};saveCart();updateBadges();successOrder(record,payload.whatsapp_url);
  }catch(err){btn.disabled=false;btn.textContent='Confirmar pedido';toast(err.code==='product_unavailable'?'Un producto ya no está disponible':'No pudimos registrar el pedido','error');}
}
function successOrder(order,whatsapp){
  const track=`/pedido?ref=${encodeURIComponent(order.public_token)}`; const body=`<div class="hm-success"><div class="hm-success__icon">✓</div><h2>Pedido recibido</h2><p>Guardamos tu pedido <b>${escapeHTML(order.order_number||'')}</b>. Puedes revisar su avance en cualquier momento.</p><div class="hm-actions"><a class="hm-primary" style="text-decoration:none;display:block" href="${track}">Ver seguimiento</a>${whatsapp?`<a class="hm-secondary" style="text-decoration:none;display:block" href="${escapeHTML(whatsapp)}" target="_blank" rel="noopener">Abrir WhatsApp</a>`:''}<button class="hm-secondary" id="successClose">Volver al catálogo</button></div></div>`;
  openLayer('Pedido registrado',body,{onMount:sheet=>$('#successClose',sheet).onclick=closeLayer});
}
function favoritesSheet(){ const items=state.products.filter(p=>state.favorites.has(String(p.id))); const body=items.length?items.map(p=>`<div class="hm-favorite-row" data-open-favorite="${p.id}">${p.image_url?`<img src="${escapeHTML(p.image_url)}" alt="">`:`<span class="hm-cartline__img">${escapeHTML(initials(p.name))}</span>`}<div><h4>${escapeHTML(p.name)}</h4><small>${escapeHTML(p.brand||'')}</small></div><strong>${money(defaultPresentation(p)?.price||p.price,state.account?.currency||'USD')}</strong></div>`).join(''):`<div class="hm-empty"><b>Aún no tienes favoritos</b><span>Toca el corazón de un producto para guardarlo.</span></div>`; openLayer('Favoritos',body,{onMount:sheet=>$$('[data-open-favorite]',sheet).forEach(x=>x.onclick=()=>productSheet(state.products.find(p=>String(p.id)===String(x.dataset.openFavorite))))}); }
function statusText(s){return ({new:'Recibido',confirmed:'Confirmado',preparing:'Preparando',dispatched:'Despachado',delivered:'Entregado',cancelled:'Cancelado'})[s]||'Recibido';}
async function ordersSheet(){
  let body=state.history.length?state.history.map(o=>`<a class="hm-order-card" href="/pedido?ref=${encodeURIComponent(o.public_token)}"><div class="hm-order-card__top"><strong>${escapeHTML(o.order_number||'Pedido')}</strong><b>${money(o.total,state.account?.currency||'USD')}</b></div><small>${formatDate(o.created_at)}</small><span class="hm-status-pill">${statusText(o.status)}</span></a>`).join(''):`<div class="hm-empty"><b>No hay pedidos guardados</b><span>Cuando hagas uno, aparecerá aquí con su seguimiento.</span></div>`; openLayer('Mis pedidos',body); if(!state.history.length)return;
  const updates=await Promise.all(state.history.slice(0,10).map(async o=>{try{const r=await api('order_status',{slug,public_token:o.public_token});return {token:o.public_token,status:r.order?.status||o.status,total:r.order?.total||o.total}}catch{return null}}));
  let changed=false;updates.filter(Boolean).forEach(u=>{const o=state.history.find(x=>x.public_token===u.token);if(o&&(o.status!==u.status||o.total!==u.total)){o.status=u.status;o.total=u.total;changed=true}});if(changed){write(LS.history,state.history);setTimeout(ordersSheet,20)};
}
function categoriesNav(){ state.activeCategory='all';state.activeBrand='';state.query='';$('#searchInput').value='';renderCatalog();document.querySelector('.hm-browse')?.scrollIntoView({block:'start'}); }
function shareCatalog(){const data={title:`${state.account?.name||'Hakuna Matata'} · Catálogo`,text:'Revisa el catálogo y prepara tu pedido.',url:location.href};if(navigator.share)navigator.share(data).catch(()=>{});else navigator.clipboard?.writeText(location.href).then(()=>toast('Enlace copiado'));}
function bindBaseEvents(){
  $('#searchInput').addEventListener('input',e=>{state.query=e.target.value.trim();$('#searchClear').hidden=!state.query;renderCatalog()});$('#searchClear').onclick=()=>{state.query='';$('#searchInput').value='';$('#searchClear').hidden=true;renderCatalog()};$('#shareBtn').onclick=shareCatalog;$('#resetFilters').onclick=()=>{state.activeCategory='all';state.activeBrand='';state.query='';$('#searchInput').value='';renderCatalog()};$('#cartFab').onclick=renderCart;
  document.addEventListener('click',e=>{const cat=e.target.closest('[data-category]');if(cat){state.activeCategory=cat.dataset.category;state.activeBrand='';renderCatalog();document.querySelector('.hm-toolbar')?.scrollIntoView({block:'start'});return}const brand=e.target.closest('[data-brand]');if(brand){state.activeBrand=state.activeBrand===brand.dataset.brand?'':brand.dataset.brand;state.activeCategory='all';renderCatalog();document.querySelector('.hm-toolbar')?.scrollIntoView({block:'start'});return}const fav=e.target.closest('[data-favorite]');if(fav){e.stopPropagation();const id=String(fav.dataset.favorite);state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveFav();updateBadges();renderCatalog();return}const add=e.target.closest('[data-quick-add]');if(add){e.stopPropagation();const p=state.products.find(x=>String(x.id)===String(add.dataset.quickAdd));if(p)quickAdd(p);return}const open=e.target.closest('[data-open-product]');if(open){const p=state.products.find(x=>String(x.id)===String(open.dataset.openProduct));if(p)productSheet(p);return}const nav=e.target.closest('[data-nav]');if(nav){$$('.hm-navbtn').forEach(x=>x.classList.toggle('active',x===nav));if(nav.dataset.nav==='home')window.scrollTo({top:0});if(nav.dataset.nav==='categories')categoriesNav();if(nav.dataset.nav==='favorites')favoritesSheet();if(nav.dataset.nav==='orders')ordersSheet();}});
}
async function bootstrap(){
  appShell(); const cached=read(LS.cache,null); if(cached?.ts&&Date.now()-cached.ts<10*60*1000){Object.assign(state,{account:cached.account,categories:cached.categories||[],products:cached.products||[],presentations:cached.presentations||[]});brandMarkup();renderCatalog();state.loaded=true;}
  try{const data=await api('catalog_bootstrap',{slug},{timeout:12000});state.account=data.account;state.categories=data.categories||[];state.products=data.products||[];state.presentations=data.presentations||[];write(LS.cache,{ts:Date.now(),account:state.account,categories:state.categories,products:state.products,presentations:state.presentations});brandMarkup();renderCatalog();state.loaded=true;}catch{if(!state.loaded)$('#catalogContent').innerHTML=`<div class="hm-empty"><b>No pudimos cargar el catálogo</b><span>Revisa tu conexión e intenta de nuevo.</span><div class="hm-actions" style="max-width:280px;margin:16px auto 0"><button class="hm-primary" onclick="location.reload()">Reintentar</button></div></div>`;}
  updateBadges(); if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
bootstrap();