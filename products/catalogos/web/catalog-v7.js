import { api, money, escapeHTML, slugFromLocation, initials, uid, phoneDigits, formatDate } from './core.js';

const slug = slugFromLocation();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const LS = {
  cart: `kiubo-v7-cart:${slug}`,
  fav: `kiubo-v7-favorites:${slug}`,
  history: `kiubo-v7-orders:${slug}`,
  customer: `kiubo-v7-customer:${slug}`,
  cache: `kiubo-v7-bootstrap:${slug}`
};

const icons = {
  home: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>'
};
const icon = n => icons[n] || '';

const state = {
  account: null,
  categories: [],
  products: [],
  presentations: [],
  popularIds: [],
  cart: read(LS.cart, {}),
  favorites: new Set(read(LS.fav, [])),
  history: read(LS.history, []),
  view: 'home',
  category: 'all',
  brand: '',
  query: '',
  checkoutStep: 0,
  delivery: 'delivery',
  paymentMethod: 'cash',
  location: null,
  sheetOpen: false,
  lastScrollY: 0,
  compactCatalog: false
};

function normalize(v = '') { return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function visibleProducts() { return state.products.filter(p => p.visible !== false && !p.archived_at); }
function categoryName(p) { return state.categories.find(c => String(c.id) === String(p.category_id))?.name || 'Otros'; }
function productPresentations(id) {
  const rows = state.presentations.filter(p => String(p.product_id) === String(id) && p.visible !== false).sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0));
  if (rows.length) return rows;
  const p = state.products.find(x => String(x.id) === String(id));
  return p ? [{ id:`legacy-${p.id}`, product_id:p.id, name:p.unit||'Unidad', unit_label:p.base_unit||'unidad', units_per_presentation:1, price:Number(p.price||0), visible:true, is_default:true }] : [];
}
function defaultPresentation(product) { return productPresentations(product.id).find(p => p.is_default) || productPresentations(product.id)[0]; }
function brands() { return [...new Set(visibleProducts().map(p => String(p.brand||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')); }
function filteredProducts() {
  const q = normalize(state.query);
  return visibleProducts().filter(p => {
    if (state.category !== 'all' && String(p.category_id) !== String(state.category)) return false;
    if (state.brand && normalize(p.brand) !== normalize(state.brand)) return false;
    if (!q) return true;
    return [p.name,p.brand,p.description,p.sku,p.unit,categoryName(p)].some(v => normalize(v).includes(q));
  });
}
function stockState(p) {
  if (p.status === 'out' || (p.stock_tracking && Number(p.stock_quantity||0) <= 0)) return ['Agotado','out'];
  if (p.status === 'low' || (p.stock_tracking && Number(p.stock_quantity||0) <= Number(p.low_stock_threshold||0))) return ['Pocas','low'];
  return ['Disponible','ok'];
}
function key(productId,presentationId) { return `${productId}:${presentationId}`; }
function cartEntries() { return Object.entries(state.cart).map(([k,v])=>({key:k,...v})).filter(x=>Number(x.quantity)>0); }
function cartCount() { return cartEntries().reduce((s,x)=>s+Number(x.quantity||0),0); }
function cartTotal() { return cartEntries().reduce((s,x)=>s+Number(x.quantity||0)*Number(x.price||0),0); }
function reservedBaseUnits(productId) { return cartEntries().filter(x=>String(x.product_id)===String(productId)).reduce((s,x)=>s+Number(x.quantity||0)*Number(x.units_per_presentation||1),0); }
function canAdd(product,presentation,qty=1) {
  if (!product?.stock_tracking) return true;
  return reservedBaseUnits(product.id) + qty*Number(presentation?.units_per_presentation||1) <= Number(product.stock_quantity||0);
}
function defaultQty(product) {
  const p = defaultPresentation(product); if (!p) return 0;
  return Number(state.cart[key(product.id,p.id)]?.quantity||0);
}
function paymentLabel(id) { return ({cash:'Efectivo',transfer:'Transferencia',card:'Tarjeta',credit:'Crédito / fiado',other:'Otro'})[id] || 'Por coordinar'; }
function localPhone(v='') { const d=String(v).replace(/\D/g,''); return d.startsWith('593')?`0${d.slice(3,12)}`:d.length===9?`0${d}`:d.slice(0,10); }
function toast(message,type='') {
  const el=document.createElement('div'); el.className=`v7-toast ${type}`; el.textContent=message; document.body.append(el);
  requestAnimationFrame(()=>el.classList.add('show')); setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)},2200);
}
function persistCart(){ write(LS.cart,state.cart); updateNavigation(); }
function persistFav(){ write(LS.fav,[...state.favorites]); updateNavigation(); }

function shell() {
  document.body.innerHTML = `<div class="v7-app">
    <header class="v7-topbar"><div class="v7-shell v7-topbar-row">
      <button class="v7-brand" data-view="home"><span class="v7-logo" id="brandLogo">HM</span><span><b id="brandName">Hakuna Matata</b><small id="brandTagline">Catálogo mayorista</small></span></button>
      <button class="v7-round" id="shareBtn" aria-label="Compartir">${icon('share')}</button>
    </div></header>
    <main class="v7-main">
      <section class="v7-view active" data-panel="home" id="homeView"></section>
      <section class="v7-view" data-panel="catalog" id="catalogView"></section>
      <section class="v7-view" data-panel="favorites" id="favoritesView"></section>
      <section class="v7-view" data-panel="orders" id="ordersView"></section>
      <section class="v7-view" data-panel="cart" id="cartView"></section>
    </main>
    <nav class="v7-nav" aria-label="Navegación principal">
      <button class="active" data-view="home">${icon('home')}<span>Inicio</span></button>
      <button data-view="catalog">${icon('grid')}<span>Catálogo</span></button>
      <button data-view="favorites">${icon('heart')}<span>Favoritos</span><i id="favBadge" hidden></i></button>
      <button data-view="orders">${icon('receipt')}<span>Pedidos</span><i id="orderBadge" hidden></i></button>
      <button data-view="cart">${icon('cart')}<span>Carrito</span><i id="cartBadge" hidden></i></button>
    </nav>
    <div id="sheetHost"></div>
  </div>`;
  bindShell();
}

function applyBrand() {
  const a=state.account||{};
  $('#brandName').textContent=a.name||'Hakuna Matata'; $('#brandTagline').textContent=a.tagline||'Catálogo mayorista';
  const logo=$('#brandLogo'); logo.innerHTML=a.logo_url?`<img src="${escapeHTML(a.logo_url)}" alt="${escapeHTML(a.name||'Logo')}">`:escapeHTML(initials(a.name||'Hakuna Matata'));
  document.documentElement.style.setProperty('--brand',a.accent||'#ef7048'); document.documentElement.style.setProperty('--brand-deep',a.accent_deep||'#d95731');
  document.title=`${a.name||'Hakuna Matata'} · Catálogo`;
}

function productVisual(product) {
  if (product.image_url) return `<img loading="lazy" decoding="async" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">`;
  return `<div class="v7-photo-empty"><span>${escapeHTML(initials(product.name))}</span><small>Foto pendiente</small></div>`;
}

function qtyControl(product) {
  const p=defaultPresentation(product); const qty=defaultQty(product); const [label,status]=stockState(product);
  if (!p || status==='out') return `<button class="v7-add disabled" disabled>${label}</button>`;
  if (qty<=0) return `<button class="v7-add" data-add="${product.id}" aria-label="Agregar ${escapeHTML(product.name)}">${icon('plus')}<span>Agregar</span></button>`;
  return `<div class="v7-stepper" data-stepper="${product.id}"><button data-minus="${product.id}" aria-label="Quitar uno">${icon('minus')}</button><b>${qty}</b><button data-add="${product.id}" aria-label="Agregar uno">${icon('plus')}</button></div>`;
}

function productCard(product,{compact=false}={}) {
  const p=defaultPresentation(product); const [stock,stockClass]=stockState(product); const fav=state.favorites.has(String(product.id));
  return `<article class="v7-product ${compact?'compact':''}" data-product="${product.id}">
    <div class="v7-product-media" data-open="${product.id}">${productVisual(product)}<span class="v7-stock ${stockClass}">${stock}</span><button class="v7-heart ${fav?'active':''}" data-favorite="${product.id}" aria-label="Favorito">${icon('heart')}</button></div>
    <div class="v7-product-copy"><button class="v7-product-title" data-open="${product.id}"><small>${escapeHTML(product.brand||categoryName(product))}</small><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(p?.name||product.unit||'Unidad')}${productPresentations(product.id).length>1?' · más opciones':''}</p></button><div class="v7-product-bottom"><strong>${state.account?.show_prices===false?'Consultar':money(p?.price??product.price,state.account?.currency||'USD')}</strong>${qtyControl(product)}</div></div>
  </article>`;
}

function renderHome() {
  const a=state.account||{}; const products=visibleProducts();
  const popular=(state.popularIds.length?state.popularIds.map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean):products).slice(0,8);
  const cats=state.categories.filter(c=>c.visible!==false).slice(0,8);
  $('#homeView').innerHTML=`<div class="v7-shell v7-home">
    <section class="v7-hero"><div class="v7-hero-art"><div class="v7-hero-mark">${a.logo_url?`<img src="${escapeHTML(a.logo_url)}" alt="">`:escapeHTML(initials(a.name||'Hakuna Matata'))}</div></div><div class="v7-hero-copy"><span>${a.is_open===false?'Catálogo temporalmente pausado':'Pedidos abiertos'}</span><h1>${escapeHTML(a.hero_title||'Abastece tu negocio sin vueltas.')}</h1><p>${escapeHTML(a.hero_subtitle||'Encuentra productos, elige cantidades y arma tu pedido en minutos.')}</p><button data-view="catalog">Comprar ahora ${icon('chevron')}</button></div></section>
    <button class="v7-home-search" data-view="catalog" data-focus-search>${icon('search')}<span>¿Qué necesitas hoy?</span></button>
    <section class="v7-block"><div class="v7-heading"><div><small>EXPLORA RÁPIDO</small><h2>Categorías</h2></div><button data-view="catalog">Ver todas</button></div><div class="v7-categories">${cats.map(c=>`<button data-category-jump="${c.id}"><span>${escapeHTML((c.name||'?').slice(0,1).toUpperCase())}</span><b>${escapeHTML(c.name)}</b></button>`).join('')}</div></section>
    <section class="v7-block"><div class="v7-heading"><div><small>PARA TU NEGOCIO</small><h2>${state.popularIds.length?'Más pedidos':'Productos destacados'}</h2></div><button data-view="catalog">Ver catálogo</button></div><div class="v7-product-strip">${popular.map(p=>productCard(p,{compact:true})).join('')}</div></section>
    <section class="v7-home-points"><article>${icon('bag')}<div><b>Pedido rápido</b><span>Agrega desde el catálogo sin abrir ventanas innecesarias.</span></div></article><article>${icon('receipt')}<div><b>Seguimiento claro</b><span>Revisa recibido, confirmado, preparación y entrega.</span></div></article></section>
  </div>`;
}

function renderCatalog({keepScroll=false}={}) {
  const items=filteredProducts(); const cats=state.categories.filter(c=>c.visible!==false);
  const oldY=window.scrollY;
  $('#catalogView').innerHTML=`<div class="v7-catalog-head ${state.compactCatalog?'compact':''}" id="catalogHead"><div class="v7-shell">
      <div class="v7-catalog-title"><div><small>CATÁLOGO</small><h1>¿Qué necesitas?</h1></div><span>${items.length}</span></div>
      <div class="v7-search-row"><label class="v7-search">${icon('search')}<input id="catalogSearch" value="${escapeHTML(state.query)}" placeholder="Buscar producto, marca o categoría"><button type="button" id="clearSearch" ${state.query?'':'hidden'}>×</button></label><button class="v7-filter" id="filterBtn">${icon('filter')}<span>Filtros</span>${state.brand?'<i>1</i>':''}</button></div>
      <div class="v7-category-rail" id="categoryRail"><button class="${state.category==='all'?'active':''}" data-category="all">Todos</button>${cats.map(c=>`<button class="${String(state.category)===String(c.id)?'active':''}" data-category="${c.id}">${escapeHTML(c.name)}</button>`).join('')}</div>
      ${state.brand?`<div class="v7-active-filter"><span>Marca: <b>${escapeHTML(state.brand)}</b></span><button id="clearBrand">Quitar</button></div>`:''}
    </div></div>
    <div class="v7-shell v7-catalog-body"><div class="v7-product-grid">${items.map(p=>productCard(p)).join('')}</div>${!items.length?`<div class="v7-empty"><b>No encontramos productos</b><span>Prueba otra categoría, marca o búsqueda.</span><button id="resetCatalog">Mostrar todo</button></div>`:''}<p class="v7-swipe-help">Desliza horizontalmente sobre los productos para cambiar de categoría</p></div>`;
  bindCatalog(); if(keepScroll) window.scrollTo(0,oldY);
}

function renderFavorites() {
  const items=visibleProducts().filter(p=>state.favorites.has(String(p.id)));
  $('#favoritesView').innerHTML=`<div class="v7-shell v7-page"><div class="v7-page-head"><div><small>GUARDADOS</small><h1>Favoritos</h1></div>${items.length?`<span>${items.length}</span>`:''}</div>${items.length?`<div class="v7-product-grid">${items.map(p=>productCard(p)).join('')}</div>`:`<div class="v7-empty big">${icon('heart')}<b>Aún no guardaste productos</b><span>Toca el corazón de un producto y aparecerá aquí.</span><button data-view="catalog">Explorar catálogo</button></div>`}</div>`;
}

function statusLabel(s){return({new:'Recibido',confirmed:'Confirmado',preparing:'Preparando',dispatched:'Despachado',delivered:'Entregado',cancelled:'Cancelado'})[s]||'En proceso'}
function renderOrders() {
  const items=state.history;
  $('#ordersView').innerHTML=`<div class="v7-shell v7-page"><div class="v7-page-head"><div><small>SEGUIMIENTO</small><h1>Mis pedidos</h1></div>${items.length?'<button class="v7-refresh" id="refreshOrders">Actualizar</button>':''}</div>${items.length?`<div class="v7-order-list">${items.map(o=>`<article class="v7-order"><div><small>${formatDate(o.created_at||o.updated_at)}</small><h3>${escapeHTML(o.order_number||'Pedido')}</h3><span class="status-${escapeHTML(o.status||'new')}">${escapeHTML(statusLabel(o.status))}</span></div><div><strong>${money(o.total||0,state.account?.currency||'USD')}</strong><a href="/pedido?ref=${encodeURIComponent(o.public_token)}">Ver seguimiento ${icon('chevron')}</a></div></article>`).join('')}</div>`:`<div class="v7-empty big">${icon('receipt')}<b>Todavía no hiciste pedidos</b><span>Cuando confirmes uno, su seguimiento aparecerá aquí.</span><button data-view="catalog">Ir al catálogo</button></div>`}</div>`;
  $('#refreshOrders')?.addEventListener('click',refreshOrders);
}
async function refreshOrders(){
  const updates=await Promise.all(state.history.slice(0,15).map(async o=>{try{const {order}=await api('order_status',{slug,public_token:o.public_token},{timeout:8000});return {...o,...order}}catch{return o}}));
  state.history=[...updates,...state.history.slice(15)]; write(LS.history,state.history); renderOrders(); updateNavigation(); toast('Pedidos actualizados');
}

function renderCart() {
  const items=cartEntries(); const c=read(LS.customer,{}); const methods=(state.account?.payment_methods||['cash','transfer']).filter(Boolean); if(!methods.includes(state.paymentMethod))state.paymentMethod=methods[0]||'cash';
  const page=$('#cartView');
  if(state.checkoutStep===0){
    page.innerHTML=`<div class="v7-shell v7-page"><div class="v7-page-head v7-cart-title"><div><small>TU SELECCIÓN</small><h1>Carrito</h1></div>${items.length?`<span>${cartCount()}</span>`:''}</div>${items.length?`<div class="v7-cart-layout"><div class="v7-cart-lines">${items.map(x=>`<article class="v7-cart-line"><div class="v7-cart-photo">${x.image_url?`<img src="${escapeHTML(x.image_url)}" alt="">`:`<span>${escapeHTML(initials(x.product_name))}</span>`}</div><div><h3>${escapeHTML(x.product_name)}</h3><p>${escapeHTML(x.presentation_name)}</p>${x.item_note?`<small>${escapeHTML(x.item_note)}</small>`:''}</div><div class="v7-cart-side"><strong>${money(Number(x.quantity)*Number(x.price),state.account?.currency||'USD')}</strong><div class="v7-mini-step"><button data-cart-minus="${escapeHTML(x.key)}">${icon('minus')}</button><b>${x.quantity}</b><button data-cart-plus="${escapeHTML(x.key)}">${icon('plus')}</button></div></div></article>`).join('')}</div><aside class="v7-summary"><div><span>Productos</span><b>${cartCount()}</b></div><div class="total"><span>Total estimado</span><strong>${money(cartTotal(),state.account?.currency||'USD')}</strong></div><button class="v7-primary" id="checkoutStart">Continuar</button></aside></div>`:`<div class="v7-empty big">${icon('cart')}<b>Tu carrito está vacío</b><span>Agrega productos desde el catálogo. Aquí aparecerán listos para confirmar.</span><button data-view="catalog">Explorar catálogo</button></div>`}</div>`;
    $$('[data-cart-minus]').forEach(b=>b.onclick=()=>changeCartByKey(b.dataset.cartMinus,-1)); $$('[data-cart-plus]').forEach(b=>b.onclick=()=>changeCartByKey(b.dataset.cartPlus,1)); $('#checkoutStart')?.addEventListener('click',()=>{state.checkoutStep=1;renderCart();window.scrollTo(0,0)}); return;
  }
  if(state.checkoutStep===1){
    page.innerHTML=`<div class="v7-shell v7-page v7-checkout"><div class="v7-back-head"><button id="checkoutBack">${icon('back')}</button><div><small>PASO 1 DE 2</small><h1>Datos del pedido</h1></div></div><form class="v7-form" id="checkoutForm">
      <label><span>Negocio o cliente *</span><input id="cBusiness" maxlength="80" value="${escapeHTML(c.business||'')}" placeholder="Ej. Barrio Max"></label>
      <label><span>Persona de contacto</span><input id="cName" maxlength="80" value="${escapeHTML(c.name||'')}" placeholder="¿Con quién coordinamos?"></label>
      <label><span>WhatsApp *</span><input id="cPhone" inputmode="numeric" maxlength="10" value="${escapeHTML(localPhone(c.phone||''))}" placeholder="099 123 4567"></label>
      <fieldset><legend>¿Cómo lo recibes?</legend><div class="v7-choice"><button type="button" data-delivery="delivery" class="${state.delivery==='delivery'?'active':''}">Entrega</button><button type="button" data-delivery="pickup" class="${state.delivery==='pickup'?'active':''}">Retiro</button></div></fieldset>
      <div id="deliveryBox" ${state.delivery==='pickup'?'hidden':''}><label><span>Dirección o referencia</span><input id="cAddress" maxlength="160" value="${escapeHTML(c.address||'')}" placeholder="Sector, calle o referencia"></label><button type="button" class="v7-location ${state.location?'done':''}" id="locationBtn">${icon('pin')}<span>${state.location?'Ubicación agregada':'Agregar ubicación actual'}</span></button></div>
      <fieldset><legend>Forma de pago</legend><div class="v7-payment-options">${methods.map(m=>`<button type="button" data-payment="${m}" class="${state.paymentMethod===m?'active':''}">${paymentLabel(m)}</button>`).join('')}</div>${state.paymentMethod==='transfer'?bankInfo():''}</fieldset>
      <label><span>Observación general</span><textarea id="cNotes" maxlength="400" rows="3" placeholder="Horario, referencia u otra indicación…">${escapeHTML(c.notes||'')}</textarea></label>
      <button type="button" class="v7-primary" id="reviewOrder">Revisar pedido</button>
    </form></div>`; bindCheckout(); return;
  }
  renderReview();
}
function bankInfo(){const d=state.account?.payment_details||{};const rows=[[d.bank_name,'Banco'],[d.account_type,'Tipo'],[d.account_number,'Cuenta'],[d.account_holder,'Titular']].filter(x=>x[0]);return rows.length?`<div class="v7-bank">${rows.map(([v,l])=>`<div><span>${l}</span><b>${escapeHTML(v)}</b></div>`).join('')}</div>`:''}
function collectCustomer(){return{business:$('#cBusiness')?.value.trim()||'',name:$('#cName')?.value.trim()||'',phone:$('#cPhone')?.value.trim()||'',address:$('#cAddress')?.value.trim()||'',notes:$('#cNotes')?.value.trim()||''}}
function bindCheckout(){
  $('#checkoutBack').onclick=()=>{state.checkoutStep=0;renderCart()};
  $$('[data-delivery]').forEach(b=>b.onclick=()=>{state.delivery=b.dataset.delivery;$$('[data-delivery]').forEach(x=>x.classList.toggle('active',x===b));$('#deliveryBox').hidden=state.delivery==='pickup'});
  $$('[data-payment]').forEach(b=>b.onclick=()=>{state.paymentMethod=b.dataset.payment;renderCart()});
  $('#locationBtn')?.addEventListener('click',()=>{if(!navigator.geolocation)return toast('Ubicación no disponible','error');const btn=$('#locationBtn');btn.disabled=true;btn.querySelector('span').textContent='Obteniendo ubicación…';navigator.geolocation.getCurrentPosition(pos=>{state.location={lat:Number(pos.coords.latitude.toFixed(6)),lng:Number(pos.coords.longitude.toFixed(6)),label:'Ubicación compartida por el cliente'};btn.disabled=false;btn.classList.add('done');btn.querySelector('span').textContent='Ubicación agregada';toast('Ubicación guardada')},()=>{btn.disabled=false;btn.querySelector('span').textContent='Agregar ubicación actual';toast('No pudimos obtener la ubicación','error')},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})});
  $('#reviewOrder').onclick=()=>{const c=collectCustomer();if(!c.business||phoneDigits(c.phone).length<11)return toast('Completa negocio y WhatsApp','error');write(LS.customer,c);state.checkoutStep=2;renderCart();window.scrollTo(0,0)};
}
function renderReview(){const c=read(LS.customer,{}),items=cartEntries();$('#cartView').innerHTML=`<div class="v7-shell v7-page"><div class="v7-back-head"><button id="reviewBack">${icon('back')}</button><div><small>PASO 2 DE 2</small><h1>Revisa tu pedido</h1></div></div><div class="v7-review-layout"><section><div class="v7-customer-card"><h2>${escapeHTML(c.business||'Cliente')}</h2><p>${escapeHTML(c.name||'')}</p><p>${escapeHTML(localPhone(c.phone||''))}</p><p>${state.delivery==='delivery'?`Entrega · ${escapeHTML(c.address||'Por coordinar')}`:'Retiro'}</p><div><span>${paymentLabel(state.paymentMethod)}</span>${state.location?'<span>Ubicación agregada</span>':''}</div></div><div class="v7-review-items">${items.map(x=>`<div><span><b>${x.quantity}×</b> ${escapeHTML(x.product_name)}<small>${escapeHTML(x.presentation_name)}${x.item_note?` · ${escapeHTML(x.item_note)}`:''}</small></span><strong>${money(x.quantity*x.price,state.account?.currency||'USD')}</strong></div>`).join('')}</div></section><aside class="v7-summary"><div><span>Productos</span><b>${cartCount()}</b></div><div class="total"><span>Total estimado</span><strong>${money(cartTotal(),state.account?.currency||'USD')}</strong></div><button class="v7-primary" id="submitOrder">Confirmar pedido</button></aside></div></div>`;$('#reviewBack').onclick=()=>{state.checkoutStep=1;renderCart()};$('#submitOrder').onclick=submitOrder}
async function submitOrder(){const btn=$('#submitOrder');if(btn.disabled)return;btn.disabled=true;btn.textContent='Registrando…';const c=read(LS.customer,{}),entries=cartEntries();try{const payload=await api('create_order',{slug,idempotency_key:uid(),payment_method:state.paymentMethod,customer:{customer_business:c.business,customer_name:c.name,customer_phone:phoneDigits(c.phone),delivery_method:state.delivery,delivery_address:state.delivery==='delivery'?c.address:null,delivery_lat:state.location?.lat??null,delivery_lng:state.location?.lng??null,delivery_location_label:state.location?.label??null,notes:c.notes},items:entries.map(x=>({product_id:x.product_id,presentation_id:String(x.presentation_id).startsWith('legacy-')?null:x.presentation_id,quantity:x.quantity,item_note:x.item_note||null}))},{timeout:18000});const o=payload.order||{};const record={order_number:o.order_number,public_token:o.public_token,total:o.total||cartTotal(),created_at:o.created_at||new Date().toISOString(),status:o.status||'new',payment_method:state.paymentMethod};state.history=[record,...state.history.filter(x=>x.public_token!==record.public_token)].slice(0,40);write(LS.history,state.history);state.cart={};persistCart();state.checkoutStep=0;renderSuccess(record,payload.whatsapp_url)}catch(err){btn.disabled=false;btn.textContent='Confirmar pedido';toast(err.code==='product_unavailable'?'Un producto ya no está disponible':'No pudimos registrar el pedido','error')}}
function renderSuccess(order,whatsapp){$('#cartView').innerHTML=`<div class="v7-shell v7-page"><div class="v7-success"><span>${icon('check')}</span><small>PEDIDO REGISTRADO</small><h1>Listo. Ya lo recibimos.</h1><p>Tu pedido <b>${escapeHTML(order.order_number||'')}</b> quedó guardado. Puedes revisar su avance desde “Pedidos”.</p><div><a href="/pedido?ref=${encodeURIComponent(order.public_token)}">Ver seguimiento</a>${whatsapp?`<a href="${escapeHTML(whatsapp)}" target="_blank" rel="noopener">Coordinar por WhatsApp</a>`:''}<button data-view="orders">Mis pedidos</button></div></div></div>`;updateNavigation()}

function addDefault(product,delta=1){const p=defaultPresentation(product);if(!p)return;if(delta>0&&!canAdd(product,p,1))return toast('No hay más stock disponible','error');const k=key(product.id,p.id);const current=state.cart[k]||{};const next=Math.max(0,Number(current.quantity||0)+delta);if(!next)delete state.cart[k];else state.cart[k]={product_id:product.id,presentation_id:p.id,product_name:product.name,presentation_name:p.name,units_per_presentation:Number(p.units_per_presentation||1),price:Number(p.price||0),quantity:next,item_note:current.item_note||'',image_url:product.image_url||''};persistCart();refreshProductControls(product.id)}
function changeCartByKey(k,delta){const item=state.cart[k];if(!item)return;const product=state.products.find(p=>String(p.id)===String(item.product_id));const presentation=productPresentations(item.product_id).find(p=>String(p.id)===String(item.presentation_id))||item;if(delta>0&&!canAdd(product,presentation,1))return toast('No hay más stock disponible','error');item.quantity=Math.max(0,Number(item.quantity||0)+delta);if(!item.quantity)delete state.cart[k];persistCart();renderCart();if(state.view!=='cart')refreshProductControls(item.product_id)}
function refreshProductControls(productId){const product=state.products.find(p=>String(p.id)===String(productId));if(!product)return;$$(`[data-product="${CSS.escape(String(productId))}"]`).forEach(card=>{const bottom=$('.v7-product-bottom',card);if(!bottom)return;const old=bottom.querySelector('.v7-add,.v7-stepper');old?.remove();bottom.insertAdjacentHTML('beforeend',qtyControl(product))})}

function openProduct(product){const ps=productPresentations(product.id);const selected=defaultPresentation(product);const [stock,stockClass]=stockState(product);openSheet(`<div class="v7-detail"><div class="v7-detail-media">${productVisual(product)}<span class="v7-stock ${stockClass}">${stock}</span></div><div class="v7-detail-body"><small>${escapeHTML(product.brand||categoryName(product))}</small><h2>${escapeHTML(product.name)}</h2>${product.description?`<p>${escapeHTML(product.description)}</p>`:''}<label class="v7-detail-label">Presentación</label><div class="v7-presentation-list">${ps.map(p=>`<button data-presentation="${p.id}" class="${String(p.id)===String(selected?.id)?'active':''}"><span><b>${escapeHTML(p.name)}</b><small>${Number(p.units_per_presentation||1)} ${escapeHTML(product.base_unit||p.unit_label||'unidad')}${Number(p.units_per_presentation||1)===1?'':'es'}</small></span><strong>${state.account?.show_prices===false?'Consultar':money(p.price,state.account?.currency||'USD')}</strong></button>`).join('')}</div>${product.allow_item_note!==false?`<button class="v7-note-toggle" id="noteToggle">Añadir detalle opcional</button><div class="v7-note-box" id="noteBox" hidden><textarea id="itemNote" maxlength="180" placeholder="Sabor, color, modelo o variedad…"></textarea></div>`:''}<div class="v7-detail-action"><div class="v7-detail-step"><button id="detailMinus">${icon('minus')}</button><b id="detailQty">1</b><button id="detailPlus">${icon('plus')}</button></div><button class="v7-primary" id="detailAdd">Agregar</button></div></div></div>`,sheet=>{let qty=1;let presentation=selected;const refresh=()=>{$('#detailQty',sheet).textContent=qty;$('#detailAdd',sheet).textContent=state.account?.show_prices===false?`Agregar ${qty}`:`Agregar · ${money(Number(presentation?.price||0)*qty,state.account?.currency||'USD')}`};$$('[data-presentation]',sheet).forEach(b=>b.onclick=()=>{presentation=ps.find(p=>String(p.id)===String(b.dataset.presentation))||selected;$$('[data-presentation]',sheet).forEach(x=>x.classList.toggle('active',x===b));qty=1;refresh()});$('#detailMinus',sheet).onclick=()=>{qty=Math.max(1,qty-1);refresh()};$('#detailPlus',sheet).onclick=()=>{if(canAdd(product,presentation,qty+1))qty++;else toast('No hay más stock disponible','error');refresh()};$('#noteToggle',sheet)?.addEventListener('click',()=>{const box=$('#noteBox',sheet);box.hidden=!box.hidden;$('#noteToggle',sheet).textContent=box.hidden?'Añadir detalle opcional':'Ocultar detalle'});$('#detailAdd',sheet).onclick=()=>{const k=key(product.id,presentation.id);const current=state.cart[k]||{};if(!canAdd(product,presentation,qty))return toast('La cantidad supera el stock','error');state.cart[k]={product_id:product.id,presentation_id:presentation.id,product_name:product.name,presentation_name:presentation.name,units_per_presentation:Number(presentation.units_per_presentation||1),price:Number(presentation.price||0),quantity:Number(current.quantity||0)+qty,item_note:($('#itemNote',sheet)?.value||'').trim().slice(0,180),image_url:product.image_url||''};persistCart();closeSheet();refreshProductControls(product.id);toast('Agregado al carrito')};refresh()})}

function openFilterSheet(){const bs=brands();openSheet(`<div class="v7-filter-sheet"><div><small>FILTROS</small><h2>Marca</h2><p>Elige una marca o vuelve a ver todas.</p></div><div class="v7-brand-options"><button data-brand-option="" class="${!state.brand?'active':''}">Todas las marcas</button>${bs.map(b=>`<button data-brand-option="${escapeHTML(b)}" class="${state.brand===b?'active':''}">${escapeHTML(b)}</button>`).join('')}</div></div>`,sheet=>{$$('[data-brand-option]',sheet).forEach(b=>b.onclick=()=>{state.brand=b.dataset.brandOption||'';closeSheet();renderCatalog({keepScroll:true})})})}
function openSheet(html,onMount){closeSheet(true);const host=$('#sheetHost');host.innerHTML=`<div class="v7-backdrop"></div><section class="v7-sheet"><div class="v7-grab"></div><button class="v7-sheet-close">×</button><div class="v7-sheet-scroll">${html}</div></section>`;state.sheetOpen=true;requestAnimationFrame(()=>{$('.v7-backdrop',host).classList.add('show');$('.v7-sheet',host).classList.add('show')});$('.v7-backdrop',host).onclick=()=>closeSheet();$('.v7-sheet-close',host).onclick=()=>closeSheet();setupSheetGesture($('.v7-sheet',host));onMount?.($('.v7-sheet',host))}
function closeSheet(immediate=false){const host=$('#sheetHost');if(!host?.children.length){state.sheetOpen=false;return}const done=()=>{host.innerHTML='';state.sheetOpen=false};if(immediate)return done();$('.v7-backdrop',host)?.classList.remove('show');$('.v7-sheet',host)?.classList.remove('show');setTimeout(done,170)}
function setupSheetGesture(sheet){let start=0,last=0,active=false;const grab=$('.v7-grab',sheet),scroll=$('.v7-sheet-scroll',sheet);const begin=e=>{active=true;start=last=e.clientY;sheet.classList.add('dragging');sheet.setPointerCapture?.(e.pointerId)};const move=e=>{if(!active)return;last=e.clientY;const dy=Math.max(0,last-start);sheet.style.transform=`translate3d(-50%,${dy}px,0)`};const end=()=>{if(!active)return;active=false;sheet.classList.remove('dragging');const dy=Math.max(0,last-start);if(dy>72)closeSheet();else sheet.style.transform=''};grab.addEventListener('pointerdown',begin);grab.addEventListener('pointermove',move);grab.addEventListener('pointerup',end);grab.addEventListener('pointercancel',end);let sy=0;scroll.addEventListener('touchstart',e=>{if(scroll.scrollTop<=0)sy=e.touches[0].clientY;else sy=0},{passive:true});scroll.addEventListener('touchend',e=>{if(!sy)return;const dy=e.changedTouches[0].clientY-sy;if(dy>105)closeSheet();sy=0},{passive:true})}

function bindCatalog(){
  $('#catalogSearch')?.addEventListener('input',e=>{state.query=e.target.value;const y=window.scrollY;renderCatalog();window.scrollTo(0,y);requestAnimationFrame(()=>{const input=$('#catalogSearch');input?.focus();input?.setSelectionRange(input.value.length,input.value.length)})});
  $('#clearSearch')?.addEventListener('click',()=>{state.query='';renderCatalog({keepScroll:true});$('#catalogSearch')?.focus()});
  $$('[data-category]',$('#catalogView')).forEach(b=>b.onclick=()=>{state.category=b.dataset.category;state.query='';renderCatalog({keepScroll:true})});
  $('#filterBtn')?.addEventListener('click',openFilterSheet);$('#clearBrand')?.addEventListener('click',()=>{state.brand='';renderCatalog({keepScroll:true})});$('#resetCatalog')?.addEventListener('click',()=>{state.category='all';state.brand='';state.query='';renderCatalog()});
  const body=$('.v7-catalog-body'); if(body){let sx=0,sy=0;body.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});body.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.4)return;const ids=['all',...state.categories.filter(c=>c.visible!==false).map(c=>String(c.id))];let i=Math.max(0,ids.indexOf(String(state.category)));i=dx<0?Math.min(ids.length-1,i+1):Math.max(0,i-1);if(ids[i]!==String(state.category)){state.category=ids[i];renderCatalog({keepScroll:true});toast(state.category==='all'?'Todos':categoryLabel(state.category))}},{passive:true})}
}
function categoryLabel(id){return state.categories.find(c=>String(c.id)===String(id))?.name||'Categoría'}

function bindShell(){
  document.addEventListener('click',e=>{
    const v=e.target.closest?.('[data-view]');if(v){e.preventDefault();showView(v.dataset.view,{focusSearch:v.hasAttribute('data-focus-search')});return}
    const j=e.target.closest?.('[data-category-jump]');if(j){state.category=j.dataset.categoryJump;state.brand='';state.query='';showView('catalog');return}
    const fav=e.target.closest?.('[data-favorite]');if(fav){e.preventDefault();e.stopPropagation();const id=String(fav.dataset.favorite);state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);persistFav();if(state.view==='favorites')renderFavorites();else fav.classList.toggle('active',state.favorites.has(id));return}
    const add=e.target.closest?.('[data-add]');if(add){e.preventDefault();e.stopPropagation();const p=state.products.find(x=>String(x.id)===String(add.dataset.add));if(p)addDefault(p,1);return}
    const minus=e.target.closest?.('[data-minus]');if(minus){e.preventDefault();e.stopPropagation();const p=state.products.find(x=>String(x.id)===String(minus.dataset.minus));if(p)addDefault(p,-1);return}
    const open=e.target.closest?.('[data-open]');if(open){const p=state.products.find(x=>String(x.id)===String(open.dataset.open));if(p)openProduct(p)}
  });
  $('#shareBtn').onclick=async()=>{const data={title:state.account?.name||'Catálogo',text:'Mira este catálogo',url:location.origin+location.pathname};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);toast('Enlace copiado')}}catch{}};
  history.replaceState({v7View:'home'},'',location.pathname);window.addEventListener('popstate',e=>{if(state.sheetOpen){closeSheet();return}showView(e.state?.v7View||'home',{push:false})});
  let ticking=false;window.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{ticking=false;if(state.view!=='catalog')return;const y=window.scrollY;const next=y>110;if(next!==state.compactCatalog){state.compactCatalog=next;$('#catalogHead')?.classList.toggle('compact',next)}state.lastScrollY=y})},{passive:true});
}
function showView(name,{push=true,focusSearch=false}={}){state.view=name;$$('[data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));$$('.v7-nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));if(name==='home')renderHome();if(name==='catalog')renderCatalog();if(name==='favorites')renderFavorites();if(name==='orders'){renderOrders();if(state.history.length)refreshOrders()}if(name==='cart')renderCart();if(push&&history.state?.v7View!==name)history.pushState({v7View:name},'',name==='home'?location.pathname:`${location.pathname}#${name}`);window.scrollTo(0,0);if(focusSearch&&name==='catalog')setTimeout(()=>$('#catalogSearch')?.focus(),80);updateNavigation()}
function updateNavigation(){const f=state.favorites.size,o=state.history.length,c=cartCount();const set=(id,n)=>{const el=$(id);if(!el)return;el.textContent=n>99?'99+':String(n);el.hidden=n<1};set('#favBadge',f);set('#orderBadge',o);set('#cartBadge',c)}

function hydrate(payload){state.account=payload.account||state.account;state.categories=Array.isArray(payload.categories)?payload.categories:state.categories;state.products=Array.isArray(payload.products)?payload.products:state.products;state.presentations=Array.isArray(payload.presentations)?payload.presentations:state.presentations;state.popularIds=Array.isArray(payload.popular_product_ids)?payload.popular_product_ids:state.popularIds;if(state.account?.payment_methods?.length&&!state.account.payment_methods.includes(state.paymentMethod))state.paymentMethod=state.account.payment_methods[0];applyBrand()}
function renderAll(){renderHome();renderCatalog();renderFavorites();renderOrders();renderCart();updateNavigation()}
async function load(){shell();const cached=read(LS.cache,null);if(cached?.account){hydrate(cached);renderAll()}try{const payload=await api('catalog_bootstrap',{slug},{timeout:14000});hydrate(payload);write(LS.cache,{...payload,cached_at:Date.now()});renderAll()}catch{if(!cached){$('#homeView').innerHTML='<div class="v7-shell"><div class="v7-empty big"><b>No pudimos cargar el catálogo</b><span>Revisa tu conexión e inténtalo otra vez.</span><button id="retry">Reintentar</button></div></div>';$('#retry')?.addEventListener('click',()=>location.reload())}}}

if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
load();
