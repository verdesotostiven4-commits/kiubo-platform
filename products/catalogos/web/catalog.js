import { $, $$, api, money, escapeHTML, initials, productColor, slugFromLocation, toast, vibrate, debounce, uid, phoneDigits, safeStorage, saveStorage } from "./core.js";

const slug = slugFromLocation();
const cartKey = `kiubo-catalog-cart:${slug}`;
const favoritesKey = `kiubo-catalog-favorites:${slug}`;
const searchesKey = `kiubo-catalog-searches:${slug}`;
const draftKey = `kiubo-catalog-order-draft:${slug}`;

const state = {
  account: null,
  categories: [],
  products: [],
  filtered: [],
  activeCategory: "all",
  query: "",
  listView: false,
  cart: new Map(Object.entries(safeStorage(localStorage, cartKey, {})).map(([id, quantity]) => [id, Number(quantity)])),
  favorites: new Set(safeStorage(localStorage, favoritesKey, [])),
  checkoutStep: 0,
  activeProduct: null,
  submitting: false,
  lastOrder: null,
  idempotencyKey: sessionStorage.getItem(draftKey) || uid(),
  refreshing: false
};

sessionStorage.setItem(draftKey, state.idempotencyKey);

const statusMeta = {
  available: { label: "Disponible", className: "" },
  low: { label: "Pocas unidades", className: "low" },
  out: { label: "Agotado", className: "out" }
};

function price(value) {
  return money(value, state.account?.currency || "USD");
}

function pricesVisible() {
  return state.account?.show_prices !== false;
}

function productPriceMarkup(product) {
  if (!pricesVisible()) return `<strong class="price-on-request">Consultar</strong>`;
  const compare = Number(product.compare_at_price || 0) > Number(product.price || 0) ? `<del>${price(product.compare_at_price)}</del>` : "";
  return `${compare}<strong>${price(product.price)}</strong>`;
}

function persistCart() {
  saveStorage(localStorage, cartKey, Object.fromEntries(state.cart));
}

function cartEntries() {
  return [...state.cart.entries()].map(([id, quantity]) => ({ product: state.products.find(item => item.id === id), quantity })).filter(item => item.product && item.quantity > 0);
}

function cartTotals() {
  const entries = cartEntries();
  const units = entries.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = entries.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const minimum = Number(state.account?.minimum_order || 0);
  return { entries, units, subtotal, minimum, remaining: Math.max(0, minimum - subtotal) };
}

function renderBrand() {
  const account = state.account;
  document.title = `${account.name} · Catálogo`;
  document.documentElement.style.setProperty("--brand", account.accent || "#f06a3a");
  document.documentElement.style.setProperty("--brand-deep", account.accent_deep || "#db4d22");
  $("#brandName").textContent = account.name;
  $("#brandTagline").textContent = account.tagline || "Catálogo mayorista · pedidos fáciles";
  $("#heroTitle").innerHTML = escapeHTML(account.hero_title || "Tu negocio se abastece más fácil.").replace(/(más fácil\.?|en minutos\.?|sin complicaciones\.?)/i, "<em>$1</em>");
  $("#heroSubtitle").textContent = account.hero_subtitle || "Encuentra productos, elige cantidades y prepara tu pedido sin perder tiempo entre mensajes.";
  $("#catalogStateText").textContent = account.is_open === false ? "Pedidos pausados temporalmente" : "Catálogo actualizado";
  if (account.logo_url) $("#brandAvatar").innerHTML = `<img src="${escapeHTML(account.logo_url)}" alt="Logo de ${escapeHTML(account.name)}">`;
  else $("#brandAvatar").textContent = initials(account.name);
}

function renderCategories() {
  const items = [{ id: "all", name: "Todos" }, ...state.categories.filter(item => item.visible !== false)];
  $("#categoryScroller").innerHTML = items.map(item => `<button class="category-chip ${state.activeCategory === item.id ? "active" : ""}" role="tab" aria-selected="${state.activeCategory === item.id}" data-category="${escapeHTML(item.id)}">${escapeHTML(item.name)}</button>`).join("");
  $$('[data-category]', $("#categoryScroller")).forEach(button => button.addEventListener("click", () => {
    state.activeCategory = button.dataset.category;
    renderCategories();
    applyFilters();
    $("#catalogProducts").scrollIntoView({ behavior: "smooth", block: "start" });
    vibrate();
  }));
}

function placeholder(product) {
  return `<span class="product-placeholder" style="--product-color:${productColor(product)}">${escapeHTML(initials(product.name))}</span>`;
}

function productImage(product, className = "") {
  return product.image_url
    ? `<img class="${className}" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">`
    : placeholder(product);
}

function quantityControl(product) {
  const quantity = state.cart.get(product.id) || 0;
  const unavailable = product.status === "out" || state.account?.is_open === false;
  if (!quantity) return `<button class="add-button" data-add="${product.id}" aria-label="Agregar ${escapeHTML(product.name)}" ${unavailable ? "disabled" : ""}><svg class="icon"><use href="#i-plus"/></svg></button>`;
  return `<div class="quantity-mini" aria-label="Cantidad de ${escapeHTML(product.name)}"><button data-decrease="${product.id}" aria-label="Quitar uno"><svg class="icon"><use href="#i-minus"/></svg></button><b>${quantity}</b><button data-increase="${product.id}" aria-label="Agregar uno"><svg class="icon"><use href="#i-plus"/></svg></button></div>`;
}

function productCard(product) {
  const category = state.categories.find(item => item.id === product.category_id)?.name || product.category_name || "Producto";
  const meta = statusMeta[product.status] || statusMeta.available;
  return `<article class="product-card ${state.listView ? "list" : ""}" style="--product-color:${productColor(product)}" data-product-card="${product.id}">
    <button class="product-card__hit" data-open-product="${product.id}" aria-label="Ver ${escapeHTML(product.name)}"></button>
    <div class="product-media">${productImage(product)}<span class="status-pill ${meta.className}">${meta.label}</span><button class="favorite-button ${state.favorites.has(product.id) ? "active" : ""}" data-favorite="${product.id}" aria-label="${state.favorites.has(product.id) ? "Quitar de favoritos" : "Guardar en favoritos"}"><svg class="icon"><use href="#i-heart"/></svg></button></div>
    <div class="product-card__body"><span class="product-category">${escapeHTML(category)}</span><h3>${escapeHTML(product.name)}</h3><span class="product-unit">${escapeHTML(product.unit || "Consulta la presentación")}</span><div class="product-card__foot"><span class="price-block">${productPriceMarkup(product)}</span>${quantityControl(product)}</div></div>
  </article>`;
}

function bindProductInteractions(root = document) {
  $$('[data-open-product]', root).forEach(button => button.addEventListener("click", () => openProduct(button.dataset.openProduct)));
  $$('[data-add]', root).forEach(button => button.addEventListener("click", event => { event.stopPropagation(); setQuantity(button.dataset.add, 1); }));
  $$('[data-increase]', root).forEach(button => button.addEventListener("click", event => { event.stopPropagation(); setQuantity(button.dataset.increase, (state.cart.get(button.dataset.increase) || 0) + 1); }));
  $$('[data-decrease]', root).forEach(button => button.addEventListener("click", event => { event.stopPropagation(); setQuantity(button.dataset.decrease, (state.cart.get(button.dataset.decrease) || 0) - 1); }));
  $$('[data-favorite]', root).forEach(button => button.addEventListener("click", event => { event.stopPropagation(); toggleFavorite(button.dataset.favorite); }));
}

function renderProducts() {
  const grid = $("#productGrid");
  grid.setAttribute("aria-busy", "false");
  grid.classList.toggle("list-grid", state.listView);
  grid.innerHTML = state.filtered.map(productCard).join("");
  $("#emptyState").hidden = state.filtered.length > 0;
  grid.hidden = state.filtered.length === 0;
  const resultLabel = state.query ? `${state.filtered.length} resultado${state.filtered.length === 1 ? "" : "s"} para “${state.query}”` : `${state.filtered.length} producto${state.filtered.length === 1 ? "" : "s"}`;
  $("#resultCount").textContent = resultLabel;
  $("#clearFiltersBtn").hidden = state.activeCategory === "all" && !state.query;
  bindProductInteractions(grid);
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function applyFilters() {
  const query = normalize(state.query);
  state.filtered = state.products.filter(product => product.visible !== false && !product.archived_at)
    .filter(product => state.activeCategory === "all" || product.category_id === state.activeCategory)
    .filter(product => !query || normalize([product.name, product.brand, product.sku, product.description, product.unit, product.category_name].join(" ")).includes(query));
  renderProducts();
}

function setQuantity(id, value) {
  const product = state.products.find(item => item.id === id);
  if (!product || product.status === "out") return;
  if (state.account?.is_open === false) return toast("Los pedidos están pausados temporalmente.", "error");
  const quantity = Math.max(0, Math.min(999, Number(value) || 0));
  if (quantity) state.cart.set(id, quantity); else state.cart.delete(id);
  persistCart();
  applyFilters();
  renderCartDock();
  if (!$("#cartSheet").hidden) renderCart();
  if (state.activeProduct?.id === id) renderProductSheet(product);
  vibrate(quantity ? 8 : [8, 35, 8]);
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  saveStorage(localStorage, favoritesKey, [...state.favorites]);
  applyFilters();
  toast(state.favorites.has(id) ? "Guardado en favoritos" : "Quitado de favoritos");
}

function renderCartDock() {
  const totals = cartTotals();
  $("#cartDock").hidden = totals.units === 0;
  $("#cartDockCount").textContent = totals.units;
  $("#cartDockTotal").textContent = pricesVisible() ? price(totals.subtotal) : "Por cotizar";
}

function openProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  state.activeProduct = product;
  renderProductSheet(product);
  openSheet($("#productSheet"));
}

function renderProductSheet(product) {
  const category = state.categories.find(item => item.id === product.category_id)?.name || "Producto";
  const meta = statusMeta[product.status] || statusMeta.available;
  const quantity = state.cart.get(product.id) || 0;
  $("#productSheetContent").innerHTML = `<div class="product-detail-media" style="--product-color:${productColor(product)}">${productImage(product)}</div><div class="product-detail-body"><span class="status-pill ${meta.className}" style="position:static;display:inline-flex">${meta.label}</span><h2 id="productSheetTitle">${escapeHTML(product.name)}</h2><p>${escapeHTML(product.description || "Selecciona la cantidad que necesitas y agrégala a tu pedido.")}</p><div class="detail-meta"><span>${escapeHTML(category)}</span>${product.brand ? `<span>${escapeHTML(product.brand)}</span>` : ""}${product.unit ? `<span>${escapeHTML(product.unit)}</span>` : ""}</div><div class="detail-buy"><span class="price-block">${productPriceMarkup(product)}</span><div class="detail-quantity"><button data-detail-minus aria-label="Quitar" ${state.account?.is_open === false ? "disabled" : ""}><svg class="icon"><use href="#i-minus"/></svg></button><b>${quantity}</b><button data-detail-plus aria-label="Agregar" ${product.status === "out" || state.account?.is_open === false ? "disabled" : ""}><svg class="icon"><use href="#i-plus"/></svg></button></div></div></div>`;
  $("[data-detail-minus]").onclick = () => setQuantity(product.id, quantity - 1);
  $("[data-detail-plus]").onclick = () => setQuantity(product.id, quantity + 1);
}

function openSheet(sheet) {
  $("#sheetBackdrop").hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => { $("#sheetBackdrop").classList.add("visible"); sheet.classList.add("visible"); });
  document.body.classList.add("modal-open");
  sheet.querySelector("button, input")?.focus({ preventScroll: true });
}

function closeSheets() {
  $$(".bottom-sheet.visible").forEach(sheet => sheet.classList.remove("visible"));
  $("#sheetBackdrop").classList.remove("visible");
  setTimeout(() => { $$(".bottom-sheet").forEach(sheet => { sheet.hidden = true; }); $("#sheetBackdrop").hidden = true; }, 280);
  document.body.classList.remove("modal-open");
  state.activeProduct = null;
}

function renderCart() {
  const totals = cartTotals();
  $("#cartLines").innerHTML = totals.entries.length ? totals.entries.map(({ product, quantity }) => `<article class="cart-line"><div class="cart-line__image" style="--product-color:${productColor(product)}">${productImage(product)}</div><div><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.unit || "")}</p><strong>${pricesVisible() ? price(Number(product.price) * quantity) : "Por cotizar"}</strong></div><div class="line-controls"><button data-cart-minus="${product.id}" aria-label="Quitar"><svg class="icon"><use href="#i-minus"/></svg></button><b>${quantity}</b><button data-cart-plus="${product.id}" aria-label="Agregar"><svg class="icon"><use href="#i-plus"/></svg></button></div></article>`).join("") : `<div class="empty-state"><span class="empty-illustration"><svg class="icon"><use href="#i-box"/></svg></span><h3>Tu pedido está vacío</h3><p>Agrega productos para continuar.</p></div>`;
  $("#cartSummary").innerHTML = pricesVisible() ? `<div class="summary-row"><span>Productos</span><b>${totals.units}</b></div><div class="summary-row"><span>Subtotal estimado</span><b>${price(totals.subtotal)}</b></div>${totals.minimum ? `<div class="summary-row"><span>Pedido mínimo</span><b>${price(totals.minimum)}</b></div>` : ""}<div class="summary-row total"><span>Total estimado</span><strong>${price(totals.subtotal)}</strong></div>${totals.remaining ? `<div class="minimum-note">Agrega ${price(totals.remaining)} más para completar el pedido mínimo.</div>` : ""}` : `<div class="summary-row"><span>Productos</span><b>${totals.units}</b></div><div class="summary-row total"><span>Precio</span><strong>Se confirmará por WhatsApp</strong></div>`;
  if (state.account?.is_open === false) $("#cartSummary").insertAdjacentHTML("beforeend", `<div class="minimum-note">El proveedor pausó temporalmente la recepción de pedidos.</div>`);
  $$('[data-cart-minus]').forEach(button => button.onclick = () => setQuantity(button.dataset.cartMinus, (state.cart.get(button.dataset.cartMinus) || 0) - 1));
  $$('[data-cart-plus]').forEach(button => button.onclick = () => setQuantity(button.dataset.cartPlus, (state.cart.get(button.dataset.cartPlus) || 0) + 1));
  $("#checkoutNextBtn").disabled = !totals.units || Boolean(totals.remaining) || state.account?.is_open === false;
}

function setCheckoutStep(step) {
  state.checkoutStep = Math.max(0, Math.min(2, step));
  $$(".cart-step").forEach((item, index) => item.classList.toggle("active", index === state.checkoutStep));
  $$("#checkoutProgress i").forEach((item, index) => item.classList.toggle("active", index <= state.checkoutStep));
  $("#checkoutBackBtn").hidden = state.checkoutStep === 0;
  $("#checkoutNextBtn").innerHTML = state.checkoutStep === 2 ? `Confirmar pedido <svg class="icon"><use href="#i-check"/></svg>` : `Continuar <svg class="icon"><use href="#i-arrow"/></svg>`;
  if (state.checkoutStep === 2) renderReview();
}

function validateCheckout() {
  const businessField = $("#customerBusiness").closest(".field");
  const phoneField = $("#customerPhone").closest(".field");
  const business = $("#customerBusiness").value.trim();
  const phone = phoneDigits($("#customerPhone").value);
  businessField.classList.toggle("invalid", business.length < 2);
  phoneField.classList.toggle("invalid", phone.length < 11 || phone.length > 15);
  businessField.querySelector(".field-error").textContent = "Escribe el nombre del negocio o cliente.";
  phoneField.querySelector(".field-error").textContent = "Escribe un número de WhatsApp válido.";
  const first = $(".field.invalid");
  first?.querySelector("input")?.focus();
  return !first;
}

function checkoutData() {
  const form = new FormData($("#checkoutForm"));
  return {
    customer_business: String(form.get("business") || "").trim(),
    customer_name: String(form.get("name") || "").trim(),
    customer_phone: phoneDigits(form.get("phone")),
    delivery_method: String(form.get("delivery") || "delivery"),
    delivery_address: String(form.get("address") || "").trim(),
    notes: String(form.get("notes") || "").trim()
  };
}

function renderReview() {
  const totals = cartTotals();
  const customer = checkoutData();
  $("#orderReview").innerHTML = `<div class="review-card"><h3>Resumen del pedido</h3>${totals.entries.map(({ product, quantity }) => `<div class="review-order-line"><b>${quantity}×</b><span>${escapeHTML(product.name)}</span><strong>${pricesVisible() ? price(Number(product.price) * quantity) : "Por cotizar"}</strong></div>`).join("")}<div class="summary-row total"><span>${pricesVisible() ? "Total estimado" : "Precio"}</span><strong>${pricesVisible() ? price(totals.subtotal) : "Se confirmará"}</strong></div></div><div class="review-card"><h3>Datos para coordinar</h3><div class="review-contact"><span><b>${escapeHTML(customer.customer_business)}</b>${customer.customer_name ? ` · ${escapeHTML(customer.customer_name)}` : ""}</span><span>WhatsApp: +${escapeHTML(customer.customer_phone)}</span><span>${customer.delivery_method === "pickup" ? "Retiro acordado" : `Entrega${customer.delivery_address ? ` · ${escapeHTML(customer.delivery_address)}` : ""}`}</span>${customer.notes ? `<span>Nota: ${escapeHTML(customer.notes)}</span>` : ""}</div></div>`;
}

async function submitOrder() {
  if (state.submitting) return;
  state.submitting = true;
  const button = $("#checkoutNextBtn");
  button.disabled = true;
  button.textContent = "Guardando pedido…";
  try {
    const customer = checkoutData();
    const items = cartEntries().map(({ product, quantity }) => ({ product_id: product.id, quantity }));
    const result = await api("create_order", { slug, idempotency_key: state.idempotencyKey, customer, items }, { timeout: 25000 });
    state.lastOrder = result.order;
    state.cart.clear();
    state.idempotencyKey = uid();
    sessionStorage.setItem(draftKey, state.idempotencyKey);
    persistCart();
    renderCartDock();
    $("#orderReview").innerHTML = `<div class="order-success"><span class="success-mark"><svg class="icon"><use href="#i-check"/></svg></span><h3>¡Pedido registrado!</h3><p>Tu pedido ya quedó guardado. Envíalo por WhatsApp para coordinar disponibilidad, entrega y total final.</p><span class="order-number">${escapeHTML(result.order.order_number)}</span><a class="tracking-link" href="/pedido?ref=${encodeURIComponent(result.order.public_token)}">Ver seguimiento del pedido</a></div>`;
    button.disabled = false;
    button.innerHTML = `Enviar por WhatsApp <svg class="icon"><use href="#i-message"/></svg>`;
    button.onclick = () => window.open(result.whatsapp_url, "_blank", "noopener");
    $("#checkoutBackBtn").hidden = true;
    toast("Pedido guardado correctamente", "success");
  } catch (error) {
    button.disabled = false;
    button.innerHTML = `Confirmar pedido <svg class="icon"><use href="#i-check"/></svg>`;
    if (error.code === "minimum_order") toast("Aún no alcanzas el pedido mínimo.", "error");
    else if (error.code === "product_unavailable") toast("Un producto cambió de disponibilidad. Actualizamos tu carrito.", "error", 3800);
    else if (error.code === "catalog_closed") toast("Los pedidos están pausados temporalmente.", "error", 3800);
    else if (error.code === "too_many_orders") toast("Hay demasiados pedidos desde esta conexión. Inténtalo en unos minutos.", "error", 4200);
    else toast("No pudimos guardar el pedido. Inténtalo nuevamente.", "error");
  } finally { state.submitting = false; }
}

function openCart() {
  state.lastOrder = null;
  $("#checkoutNextBtn").onclick = nextCheckout;
  setCheckoutStep(0);
  renderCart();
  openSheet($("#cartSheet"));
}

function nextCheckout() {
  if (state.checkoutStep === 0) {
    const totals = cartTotals();
    if (!totals.units || totals.remaining) return;
    setCheckoutStep(1);
  } else if (state.checkoutStep === 1) {
    if (!validateCheckout()) return;
    setCheckoutStep(2);
  } else submitOrder();
}

function openSearch() {
  $("#searchOverlay").hidden = false;
  document.body.classList.add("modal-open");
  renderQuickSearches();
  renderSearchResults("");
  setTimeout(() => $("#searchInput").focus(), 80);
}

function closeSearch() {
  $("#searchOverlay").hidden = true;
  document.body.classList.remove("modal-open");
  $("#searchInput").value = "";
}

function renderQuickSearches() {
  const saved = safeStorage(localStorage, searchesKey, []);
  const fallback = state.categories.slice(0, 5).map(item => item.name);
  const items = [...new Set([...saved, ...fallback])].slice(0, 7);
  $("#quickSearches").innerHTML = items.map(value => `<button data-quick-search="${escapeHTML(value)}">${escapeHTML(value)}</button>`).join("");
  $$('[data-quick-search]').forEach(button => button.onclick = () => { $("#searchInput").value = button.dataset.quickSearch; renderSearchResults(button.dataset.quickSearch); });
}

function renderSearchResults(value) {
  const query = normalize(value);
  $("#searchClearBtn").hidden = !value;
  $("#searchSuggestions").hidden = Boolean(value);
  const results = query ? state.products.filter(product => product.visible !== false && normalize([product.name, product.brand, product.category_name, product.unit].join(" ")).includes(query)).slice(0, 12) : state.products.filter(product => product.featured && product.visible !== false).slice(0, 6);
  $("#searchResults").innerHTML = results.length ? results.map(product => `<button class="search-result" data-search-product="${product.id}"><span class="search-result__image" style="--product-color:${productColor(product)}">${productImage(product)}</span><span><b>${escapeHTML(product.name)}</b><small>${escapeHTML(product.unit || product.category_name || "Producto")}</small></span><strong>${pricesVisible() ? price(product.price) : "Consultar"}</strong></button>`).join("") : value ? `<div class="empty-state"><span class="empty-illustration"><svg class="icon"><use href="#i-search"/></svg></span><h3>Sin resultados</h3><p>Prueba con otra palabra.</p></div>` : "";
  $$('[data-search-product]').forEach(button => button.onclick = () => {
    const current = $("#searchInput").value.trim();
    if (current) saveStorage(localStorage, searchesKey, [current, ...safeStorage(localStorage, searchesKey, []).filter(item => item !== current)].slice(0, 5));
    closeSearch();
    openProduct(button.dataset.searchProduct);
  });
}

async function shareCatalog() {
  const shareData = { title: `${state.account?.name || "Catálogo"} · Catálogo`, text: "Revisa nuestros productos y prepara tu pedido:", url: location.href.split("?")[0] };
  try {
    if (navigator.share) await navigator.share(shareData);
    else { await navigator.clipboard.writeText(shareData.url); toast("Enlace copiado", "success"); }
  } catch (error) { if (error.name !== "AbortError") toast("No se pudo compartir", "error"); }
}

async function loadCatalog(options = {}) {
  const silent = options?.silent === true;
  if (state.refreshing) return;
  state.refreshing = true;
  if (!silent) {
    $("#catalogError").hidden = true;
    $("#productGrid").hidden = false;
  }
  try {
    const result = await api("catalog_bootstrap", { slug });
    state.account = result.account;
    state.categories = result.categories || [];
    state.products = result.products || [];
    const validIds = new Set(state.products.filter(item => item.status !== "out" && item.visible !== false).map(item => item.id));
    [...state.cart.keys()].forEach(id => { if (!validIds.has(id)) state.cart.delete(id); });
    persistCart();
    renderBrand();
    renderCategories();
    applyFilters();
    renderCartDock();
    $("#heroProductCount").textContent = state.products.filter(item => item.visible !== false).length;
  } catch {
    if (!silent) {
      $("#productGrid").hidden = true;
      $("#catalogError").hidden = false;
      $("#resultCount").textContent = "No disponible";
    }
  } finally { state.refreshing = false; }
}

function bindEvents() {
  $("#searchOpenBtn").onclick = openSearch;
  $("#heroSearchBtn").onclick = openSearch;
  $("#searchCloseBtn").onclick = closeSearch;
  $("#searchClearBtn").onclick = () => { $("#searchInput").value = ""; renderSearchResults(""); $("#searchInput").focus(); };
  $("#searchInput").addEventListener("input", debounce(event => renderSearchResults(event.target.value), 100));
  $("#shareBtn").onclick = shareCatalog;
  $("#cartDock").onclick = openCart;
  $("#sheetBackdrop").onclick = closeSheets;
  $$('[data-close-sheet]').forEach(button => button.onclick = closeSheets);
  $("#checkoutNextBtn").onclick = nextCheckout;
  $("#checkoutBackBtn").onclick = () => setCheckoutStep(state.checkoutStep - 1);
  $("#clearFiltersBtn").onclick = $("#emptyResetBtn").onclick = () => { state.query = ""; state.activeCategory = "all"; renderCategories(); applyFilters(); };
  $("#retryCatalogBtn").onclick = loadCatalog;
  $("#viewToggle").onclick = () => {
    state.listView = !state.listView;
    $("#viewToggle use").setAttribute("href", state.listView ? "#i-grid" : "#i-list");
    $("#viewToggle").setAttribute("aria-label", state.listView ? "Cambiar a vista de cuadrícula" : "Cambiar a vista de lista");
    applyFilters();
  };
  $("#customerNotes").addEventListener("input", event => { $("#notesCount").textContent = event.target.value.length; });
  $$('[name="delivery"]').forEach(input => input.onchange = () => { $("#addressField").hidden = $("[name=delivery]:checked").value === "pickup"; });
  window.addEventListener("scroll", () => $("#catalogHeader").classList.toggle("scrolled", scrollY > 12), { passive: true });
  window.addEventListener("online", () => { $("#networkBanner").hidden = true; toast("Conexión restaurada", "success"); });
  window.addEventListener("offline", () => { $("#networkBanner").hidden = false; });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { if (!$("#searchOverlay").hidden) closeSearch(); else closeSheets(); }
    if (event.key === "/" && $("#searchOverlay").hidden && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { event.preventDefault(); openSearch(); }
  });
}

bindEvents();
loadCatalog();
setInterval(() => { if (!document.hidden && navigator.onLine) loadCatalog({ silent: true }); }, 45000);
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
