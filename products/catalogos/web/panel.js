import { $, $$, api, uploadApi, money, escapeHTML, initials, productColor, slugFromLocation, toast, vibrate, debounce, phoneDigits, formatDate, config } from "./core.js";

const isMaster = location.pathname === "/master" || new URLSearchParams(location.search).get("mode") === "master";
document.documentElement.classList.toggle("provider-mode", !isMaster);
const slug = slugFromLocation();
const providerSessionKey = `kiubo-provider-session:${slug}`;
const masterSessionKey = "kiubo-master-session";

const state = {
  mode: isMaster ? "master" : "provider",
  providerToken: sessionStorage.getItem(providerSessionKey) || "",
  masterSession: readMasterSession(),
  account: null,
  accounts: [],
  categories: [],
  products: [],
  orders: [],
  customers: [],
  productFilter: "all",
  orderFilter: "open",
  editingProduct: null,
  editingCategory: null,
  activeOrder: null,
  busy: false,
  refreshing: false,
  pollTimer: null
};

const viewTitles = {
  home: ["PANEL DE CONTROL", "Resumen", "Inicio"],
  products: ["CATÁLOGO", "Productos", "Productos"],
  orders: ["OPERACIÓN", "Pedidos", "Pedidos"],
  customers: ["RELACIONES", "Clientes", "Clientes"],
  business: ["CONFIGURACIÓN", "Mi negocio", "Negocio"]
};

const orderStatuses = [
  ["new", "Nuevo"], ["confirmed", "Confirmado"], ["preparing", "Preparando"],
  ["dispatched", "Despachado"], ["delivered", "Entregado"], ["cancelled", "Cancelado"]
];

function readMasterSession() {
  try { return JSON.parse(sessionStorage.getItem(masterSessionKey) || "null"); } catch { return null; }
}

function saveMasterSession(session) {
  state.masterSession = session;
  if (session) sessionStorage.setItem(masterSessionKey, JSON.stringify(session)); else sessionStorage.removeItem(masterSessionKey);
}

async function authRequest(endpoint, body, accessToken = "") {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.publishableKey, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error_description || result.msg || "auth_failed");
  return result;
}

async function freshMasterToken() {
  const session = state.masterSession;
  if (!session) return "";
  const expiresAt = Number(session.expires_at || 0) * 1000;
  if (expiresAt > Date.now() + 90000) return session.access_token;
  if (!session.refresh_token) return "";
  try {
    const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
    saveMasterSession(refreshed);
    return refreshed.access_token;
  } catch { saveMasterSession(null); return ""; }
}

async function callApi(action, payload = {}) {
  if (state.mode === "master") {
    const accessToken = await freshMasterToken();
    if (!accessToken) throw Object.assign(new Error("session_expired"), { code: "session_expired" });
    return api(action, payload, { accessToken });
  }
  return api(action, payload, { providerToken: state.providerToken });
}

async function uploadFile(file, kind, oldPath = "") {
  if (file.size > 5 * 1024 * 1024) throw new Error("file_too_large");
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("invalid_file_type");
  const fields = { kind, slug: state.account.slug, old_path: oldPath || "" };
  if (state.mode === "master") return uploadApi("upload_asset", file, fields, { accessToken: await freshMasterToken() });
  return uploadApi("upload_asset", file, fields, { providerToken: state.providerToken });
}

function setGate(gate) {
  ["#pinGate", "#masterGate", "#panelLoading", "#adminApp"].forEach(selector => { $(selector).hidden = true; });
  $(gate).hidden = false;
}

function renderPinDots(error = false) {
  const length = $("#pinInput").value.length;
  $$("#pinDots i").forEach((dot, index) => dot.classList.toggle("filled", index < length));
  $("#pinDots").classList.toggle("error", error);
  $("#pinSubmit").disabled = length !== 4 || state.busy;
}

function appendPin(value) {
  if (state.busy || $("#pinInput").value.length >= 4) return;
  $("#pinInput").value += value;
  renderPinDots();
  vibrate(8);
  if ($("#pinInput").value.length === 4) setTimeout(providerLogin, 120);
}

function clearPin(withError = false) {
  $("#pinInput").value = "";
  renderPinDots(withError);
  if (withError) setTimeout(() => renderPinDots(false), 420);
}

async function providerLogin() {
  const pin = $("#pinInput").value;
  if (!/^\d{4}$/.test(pin) || state.busy) return;
  state.busy = true;
  renderPinDots();
  $("#pinSubmit").innerHTML = "Verificando…";
  try {
    const result = await api("provider_login", { slug, pin, device_id: deviceFingerprint() });
    state.providerToken = result.session_token;
    sessionStorage.setItem(providerSessionKey, state.providerToken);
    setGate("#panelLoading");
    await bootstrap();
  } catch (error) {
    clearPin(true);
    if (error.code === "too_many_attempts") toast("Acceso bloqueado temporalmente. Intenta más tarde.", "error", 4500);
    else toast("El PIN no es correcto", "error");
  } finally {
    state.busy = false;
    $("#pinSubmit").innerHTML = `Entrar al panel <svg class="icon"><use href="#i-arrow"/></svg>`;
    renderPinDots();
  }
}

function deviceFingerprint() {
  const key = "kiubo-device-id";
  let value = localStorage.getItem(key);
  if (!value) { value = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; localStorage.setItem(key, value); }
  return value;
}

async function masterLogin(event) {
  event.preventDefault();
  if (state.busy) return;
  const email = $("#masterEmail").value.trim();
  const password = $("#masterPassword").value;
  if (!email || !password) return toast("Completa correo y contraseña", "error");
  state.busy = true;
  $("#masterSubmit").disabled = true;
  $("#masterSubmit").textContent = "Verificando acceso…";
  try {
    const session = await authRequest("token?grant_type=password", { email, password });
    saveMasterSession(session);
    setGate("#panelLoading");
    await bootstrap();
  } catch {
    saveMasterSession(null);
    toast("No pudimos validar este acceso Master", "error");
  } finally {
    state.busy = false;
    $("#masterSubmit").disabled = false;
    $("#masterSubmit").innerHTML = `Ingresar a KIUBO Master <svg class="icon"><use href="#i-arrow"/></svg>`;
  }
}

async function bootstrap(accountSlug = "") {
  try {
    const result = await callApi(state.mode === "master" ? "master_bootstrap" : "provider_bootstrap", accountSlug ? { slug: accountSlug } : {});
    applyBootstrap(result);
    setGate("#adminApp");
    renderAll();
    if (state.mode === "master") renderMasterSwitcher();
    startPolling();
  } catch (error) {
    if (error.code === "session_expired" || error.status === 401) {
      if (state.mode === "master") { saveMasterSession(null); setGate("#masterGate"); }
      else { state.providerToken = ""; sessionStorage.removeItem(providerSessionKey); setGate("#pinGate"); }
      toast("Tu sesión terminó. Ingresa nuevamente.");
    } else {
      toast("No pudimos preparar el panel", "error");
      state.mode === "master" ? setGate("#masterGate") : setGate("#pinGate");
    }
  }
}

function applyBootstrap(result) {
  state.account = result.account;
  state.accounts = result.accounts || state.accounts;
  state.categories = result.categories || [];
  state.products = result.products || [];
  state.orders = result.orders || [];
  state.customers = result.customers || [];
  document.documentElement.style.setProperty("--brand", state.account.accent || "#f06a3a");
  document.documentElement.style.setProperty("--brand-deep", state.account.accent_deep || "#db4d22");
  document.title = `${state.mode === "master" ? "KIUBO Master" : "Panel"} · ${state.account.name}`;
}

function logoMarkup(size = "") {
  return state.account.logo_url ? `<img src="${escapeHTML(state.account.logo_url)}" alt="">` : escapeHTML(initials(state.account.name));
}

function renderShell() {
  ["#sideLogo", "#mobileLogo"].forEach(selector => { $(selector).innerHTML = logoMarkup(); });
  $("#sideBusiness").textContent = state.account.name;
  $("#mobileBusiness").textContent = state.account.name;
  $("#sideRole").textContent = state.mode === "master" ? "KIUBO Master · soporte" : "Panel del proveedor";
  $("#profileBtn").textContent = initials(state.account.name);
}

function renderMasterSwitcher() {
  let select = $("#masterAccountSelect");
  if (!select) {
    select = document.createElement("select");
    select.id = "masterAccountSelect";
    select.className = "master-account-select";
    $(".topbar-actions").prepend(select);
  }
  select.innerHTML = state.accounts.map(account => `<option value="${escapeHTML(account.slug)}" ${account.id === state.account.id ? "selected" : ""}>${escapeHTML(account.name)}</option>`).join("");
  select.onchange = () => bootstrap(select.value);
}

function renderStats() {
  const visible = state.products.filter(product => product.visible && !product.archived_at).length;
  const stock = state.products.filter(product => !product.archived_at && ["low", "out"].includes(product.status)).length;
  const newOrders = state.orders.filter(order => order.status === "new").length;
  const openOrders = state.orders.filter(order => !["delivered", "cancelled"].includes(order.status));
  const inProcess = state.orders.filter(order => ["confirmed", "preparing", "dispatched"].includes(order.status)).length;
  const openValue = openOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  $("#statProducts").textContent = visible;
  $("#statStock").textContent = stock;
  $("#statNewOrders").textContent = newOrders;
  $("#statOpenValue").textContent = money(openValue);
  if ($("#dailyNewOrders")) $("#dailyNewOrders").textContent = newOrders;
  if ($("#dailyInProcess")) $("#dailyInProcess").textContent = inProcess;
  if ($("#dailyStock")) $("#dailyStock").textContent = stock;
  $("#orderBadge").textContent = $("#mobileOrderBadge").textContent = newOrders;
  $("#orderBadge").hidden = $("#mobileOrderBadge").hidden = newOrders === 0;
  $("#welcomeTitle").textContent = newOrders ? `${newOrders} pedido${newOrders === 1 ? " necesita" : "s necesitan"} tu revisión.` : "Todo está al día.";
  $("#welcomeCopy").textContent = newOrders ? "El stock ya está reservado. Abre el pedido, revisa los datos y confirma o cancela." : "Aquí verás primero lo que realmente necesita tu atención.";
}

function renderDashboard() {
  const recent = state.orders.slice(0, 4);
  $("#recentOrders").innerHTML = recent.length ? recent.map(order => `<button class="recent-order" data-open-order="${order.id}"><span class="recent-order__icon"><svg class="icon"><use href="#i-receipt"/></svg></span><span class="recent-order__copy"><b>${escapeHTML(order.customer_business || order.customer_name)}</b><small>${escapeHTML(order.order_number)} · ${formatDate(order.created_at)}</small></span><strong>${money(order.total)}</strong></button>`).join("") : `<div class="empty-admin"><svg class="icon"><use href="#i-receipt"/></svg><b>Aún no hay pedidos</b><span>Los nuevos aparecerán aquí en tiempo real.</span></div>`;
  const attention = state.products.filter(product => !product.archived_at && ["low", "out"].includes(product.status)).slice(0, 4);
  $("#attentionProducts").innerHTML = attention.length ? attention.map(product => `<button class="attention-item" data-edit-product="${product.id}"><span class="attention-item__image">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="">` : escapeHTML(initials(product.name))}</span><span><b>${escapeHTML(product.name)}</b><small>${product.status === "out" ? "Agotado" : "Pocas unidades"}</small></span></button>`).join("") : `<div class="empty-admin" style="grid-column:1/-1"><svg class="icon"><use href="#i-check"/></svg><b>Todo al día</b><span>No hay productos que requieran atención.</span></div>`;
  bindOrderOpeners($("#recentOrders"));
  $$('[data-edit-product]', $("#attentionProducts")).forEach(button => button.onclick = () => openProductModal(button.dataset.editProduct));
}

function productCategoryName(product) {
  return state.categories.find(category => category.id === product.category_id)?.name || "Sin categoría";
}

function filteredProducts() {
  const query = $("#productSearch").value.trim().toLowerCase();
  return state.products.filter(product => {
    if (state.productFilter === "archived") return Boolean(product.archived_at);
    if (product.archived_at) return false;
    if (state.productFilter === "hidden") return !product.visible;
    if (state.productFilter === "attention") return ["low", "out"].includes(product.status);
    if (state.productFilter !== "all" && product.status !== state.productFilter) return false;
    return true;
  }).filter(product => !query || [product.name, product.brand, product.sku, product.unit].some(value => String(value || "").toLowerCase().includes(query)));
}

function renderProducts() {
  $("#countAll").textContent = state.products.filter(product => !product.archived_at).length;
  const items = filteredProducts();
  $("#adminProductList").innerHTML = items.length ? items.map(product => `<article class="admin-product"><span class="admin-product__image">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="">` : escapeHTML(initials(product.name))}</span><div class="admin-product__copy"><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(productCategoryName(product))} · ${escapeHTML(product.unit || "Sin presentación")}</p><div class="product-flags">${!product.visible ? `<span class="tiny-flag">Oculto</span>` : ""}${product.featured ? `<span class="tiny-flag">Destacado</span>` : ""}${product.archived_at ? `<span class="tiny-flag out">Archivado</span>` : ""}</div><strong>${money(product.price)}</strong></div><div class="stock-selector"><button class="${product.status === "available" ? "active" : ""}" data-status="available" data-product-id="${product.id}">Disponible</button><button class="${product.status === "low" ? "active" : ""}" data-status="low" data-product-id="${product.id}">Pocas</button><button class="${product.status === "out" ? "active" : ""}" data-status="out" data-product-id="${product.id}">Agotado</button></div><button class="edit-product-btn" data-edit-product="${product.id}" aria-label="Editar ${escapeHTML(product.name)}"><svg class="icon"><use href="#i-palette"/></svg></button></article>`).join("") : `<div class="empty-admin"><svg class="icon"><use href="#i-box"/></svg><b>No hay productos aquí</b><span>Prueba otro filtro o agrega uno nuevo.</span></div>`;
  $$('[data-edit-product]', $("#adminProductList")).forEach(button => button.onclick = () => openProductModal(button.dataset.editProduct));
  $$('[data-status]', $("#adminProductList")).forEach(button => button.onclick = () => quickStatus(button.dataset.productId, button.dataset.status));
}

function filteredOrders() {
  const query = $("#orderSearch").value.trim().toLowerCase();
  return state.orders.filter(order => {
    if (state.orderFilter === "open") return !["delivered", "cancelled"].includes(order.status);
    if (state.orderFilter === "new") return order.status === "new";
    if (state.orderFilter === "done") return ["delivered", "cancelled"].includes(order.status);
    return true;
  }).filter(order => !query || [order.order_number, order.customer_business, order.customer_name, order.customer_phone].some(value => String(value || "").toLowerCase().includes(query)));
}

function orderItemSummary(order) {
  return (order.items || []).slice(0, 3).map(item => `${item.quantity}× ${item.product_name}`).join(" · ") + ((order.items || []).length > 3 ? ` · +${order.items.length - 3} más` : "");
}

function statusOptions(active) {
  return orderStatuses.map(([value, label]) => `<option value="${value}" ${value === active ? "selected" : ""}>${label}</option>`).join("");
}

function renderOrders() {
  const items = filteredOrders();
  $("#adminOrderList").innerHTML = items.length ? items.map(order => `<article class="order-card"><div class="order-card__top"><div><span class="order-card__number">${escapeHTML(order.order_number)}</span><h3>${escapeHTML(order.customer_business || order.customer_name)}</h3></div><strong class="order-card__amount">${money(order.total)}</strong></div><div class="order-card__meta"><span>${formatDate(order.created_at)}</span><span>·</span><span>${(order.items || []).reduce((sum, item) => sum + Number(item.quantity), 0)} unidades</span></div><div class="order-card__items">${escapeHTML(orderItemSummary(order) || "Sin detalle")}</div><div class="order-card__foot"><select class="status-select" data-order-status="${order.id}">${statusOptions(order.status)}</select><button class="order-open-btn" data-open-order="${order.id}">Ver detalle</button></div></article>`).join("") : `<div class="empty-admin" style="grid-column:1/-1"><svg class="icon"><use href="#i-receipt"/></svg><b>No hay pedidos en esta vista</b><span>Los pedidos nuevos aparecerán automáticamente.</span></div>`;
  $$('[data-order-status]').forEach(select => select.onchange = () => updateOrderStatus(select.dataset.orderStatus, select.value));
  bindOrderOpeners($("#adminOrderList"));
}

function bindOrderOpeners(root) {
  $$('[data-open-order]', root).forEach(button => button.onclick = () => openOrder(button.dataset.openOrder));
}

function renderCustomers() {
  const query = $("#customerSearch").value.trim().toLowerCase();
  const items = state.customers.filter(customer => !query || [customer.business, customer.name, customer.phone].some(value => String(value || "").toLowerCase().includes(query)));
  $("#customerList").innerHTML = items.length ? items.map(customer => `<article class="customer-card"><span class="customer-avatar">${escapeHTML(initials(customer.business || customer.name))}</span><h3>${escapeHTML(customer.business || customer.name)}</h3><p>${escapeHTML(customer.name || "Contacto")}${customer.phone ? ` · +${escapeHTML(customer.phone)}` : ""}</p><div class="customer-stats"><span><b>${Number(customer.order_count || 0)}</b><small>Pedidos</small></span><span><b>${money(customer.total_spent || 0)}</b><small>Valor total</small></span></div></article>`).join("") : `<div class="empty-admin" style="grid-column:1/-1"><svg class="icon"><use href="#i-users"/></svg><b>Aún no hay clientes</b><span>Se crearán automáticamente con cada pedido.</span></div>`;
}

function renderBusiness() {
  $("#businessName").value = state.account.name || "";
  $("#businessTagline").value = state.account.tagline || "";
  $("#businessWhatsapp").value = state.account.whatsapp || "";
  $("#businessAccent").value = state.account.accent || "#f06a3a";
  $("#accentOutput").textContent = state.account.accent || "#f06a3a";
  $("#heroTitleInput").value = state.account.hero_title || "";
  $("#heroSubtitleInput").value = state.account.hero_subtitle || "";
  $("#minimumOrder").value = Number(state.account.minimum_order || 0);
  $("#catalogOpen").checked = state.account.is_open !== false;
  $("#showPrices").checked = state.account.show_prices !== false;
  $("#logoPreview").innerHTML = logoMarkup();
  renderCategoriesAdmin();
}

function renderCategoriesAdmin() {
  $("#categoryAdminList").innerHTML = state.categories.length ? state.categories.map(category => `<article class="category-admin"><span class="category-admin__icon"><svg class="icon"><use href="#i-box"/></svg></span><span><b>${escapeHTML(category.name)}</b><small>${state.products.filter(product => product.category_id === category.id && !product.archived_at).length} productos</small></span><button data-edit-category="${category.id}">Editar</button><button data-delete-category="${category.id}">Eliminar</button></article>`).join("") : `<div class="empty-admin"><svg class="icon"><use href="#i-box"/></svg><b>Sin categorías</b><span>Agrega la primera para organizar tu catálogo.</span></div>`;
  $$('[data-edit-category]').forEach(button => button.onclick = () => openCategoryModal(button.dataset.editCategory));
  $$('[data-delete-category]').forEach(button => button.onclick = () => deleteCategory(button.dataset.deleteCategory));
}

function renderAll() {
  renderShell(); renderStats(); renderDashboard(); renderProducts(); renderOrders(); renderCustomers(); renderBusiness(); fillCategorySelect();
}

function navigate(view) {
  $$(".admin-view").forEach(section => section.classList.toggle("active", section.dataset.view === view));
  $$('[data-nav]').forEach(button => button.classList.toggle("active", button.dataset.nav === view));
  const [kicker, title, mobile] = viewTitles[view];
  $("#viewKicker").textContent = kicker; $("#viewTitle").textContent = title; $("#mobileViewTitle").textContent = mobile;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(modal) {
  $("#modalBackdrop").hidden = false; modal.hidden = false; document.body.classList.add("modal-open");
  requestAnimationFrame(() => { $("#modalBackdrop").classList.add("visible"); modal.classList.add("visible"); });
}

function closeModals() {
  $$(".admin-modal.visible").forEach(modal => modal.classList.remove("visible")); $("#modalBackdrop").classList.remove("visible");
  setTimeout(() => { $$(".admin-modal").forEach(modal => { modal.hidden = true; }); $("#modalBackdrop").hidden = true; }, 220);
  document.body.classList.remove("modal-open"); state.editingProduct = null; state.editingCategory = null; state.activeOrder = null;
}

function fillCategorySelect() {
  $("#productCategory").innerHTML = `<option value="">Sin categoría</option>${state.categories.map(category => `<option value="${category.id}">${escapeHTML(category.name)}</option>`).join("")}`;
}

function openProductModal(id = "") {
  const product = id ? state.products.find(item => item.id === id) : null;
  state.editingProduct = product || null;
  $("#productModalTitle").textContent = product ? "Editar producto" : "Nuevo producto";
  $("#productName").value = product?.name || ""; $("#productCategory").value = product?.category_id || ""; $("#productBrand").value = product?.brand || ""; $("#productPrice").value = product?.price ?? ""; $("#productComparePrice").value = product?.compare_at_price ?? ""; $("#productUnit").value = product?.unit || ""; $("#productSku").value = product?.sku || ""; $("#productDescription").value = product?.description || ""; $("#productStatus").value = product?.status || "available"; $("#productSort").value = product?.sort_order || 0; $("#productVisible").checked = product?.visible !== false; $("#productFeatured").checked = Boolean(product?.featured); $("#productImage").value = "";
  $("#productImagePreview").innerHTML = product?.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="">` : `<svg class="icon"><use href="#i-image"/></svg>`;
  $("#archiveProductBtn").hidden = !product;
  $("#archiveProductBtn").textContent = product?.archived_at ? "Restaurar" : "Archivar";
  openModal($("#productModal"));
}

async function saveProduct() {
  if (state.busy) return;
  const name = $("#productName").value.trim(), price = Number($("#productPrice").value);
  if (name.length < 2 || !Number.isFinite(price) || price < 0) return toast("Completa nombre y precio correctamente", "error");
  state.busy = true; $("#saveProductBtn").disabled = true; $("#saveProductBtn").textContent = "Guardando…";
  try {
    let imagePath = state.editingProduct?.image_path || "";
    let imageUrl = state.editingProduct?.image_url || "";
    const file = $("#productImage").files[0];
    if (file) { const uploaded = await uploadFile(file, "product", imagePath); imagePath = uploaded.path; imageUrl = uploaded.public_url; }
    const product = { id: state.editingProduct?.id || null, name, category_id: $("#productCategory").value || null, brand: $("#productBrand").value.trim() || null, price, compare_at_price: $("#productComparePrice").value ? Number($("#productComparePrice").value) : null, unit: $("#productUnit").value.trim() || null, sku: $("#productSku").value.trim() || null, description: $("#productDescription").value.trim() || null, status: $("#productStatus").value, sort_order: Number($("#productSort").value || 0), visible: $("#productVisible").checked, featured: $("#productFeatured").checked, image_path: imagePath || null, image_url: imageUrl || null };
    await callApi("save_product", { slug: state.account.slug, product });
    closeModals(); toast("Producto guardado", "success"); await refreshData();
  } catch (error) { toast(error.message === "file_too_large" ? "La imagen supera 5 MB" : "No pudimos guardar el producto", "error"); }
  finally { state.busy = false; $("#saveProductBtn").disabled = false; $("#saveProductBtn").textContent = "Guardar producto"; }
}

async function quickStatus(id, status) {
  try { await callApi("set_product_status", { slug: state.account.slug, product_id: id, status }); const product = state.products.find(item => item.id === id); if (product) product.status = status; renderProducts(); renderStats(); renderDashboard(); vibrate(); toast("Disponibilidad actualizada", "success"); }
  catch { toast("No se pudo actualizar", "error"); }
}

async function archiveProduct() {
  if (!state.editingProduct) return;
  const restore = Boolean(state.editingProduct.archived_at);
  if (!restore && !confirm("¿Archivar este producto? Dejará de aparecer en el catálogo, pero conservarás su historial.")) return;
  try { await callApi("archive_product", { slug: state.account.slug, product_id: state.editingProduct.id, restore }); closeModals(); toast(restore ? "Producto restaurado" : "Producto archivado", "success"); await refreshData(); }
  catch { toast("No se pudo actualizar el producto", "error"); }
}

function openCategoryModal(id = "") {
  const category = id ? state.categories.find(item => item.id === id) : null; state.editingCategory = category || null;
  $("#categoryModalTitle").textContent = category ? "Editar categoría" : "Nueva categoría"; $("#categoryName").value = category?.name || ""; $("#categoryIcon").value = category?.icon || "box"; $("#categorySort").value = category?.sort_order || 0; openModal($("#categoryModal"));
}

async function saveCategory() {
  const name = $("#categoryName").value.trim(); if (name.length < 2) return toast("Escribe el nombre de la categoría", "error");
  try { await callApi("save_category", { slug: state.account.slug, category: { id: state.editingCategory?.id || null, name, icon: $("#categoryIcon").value, sort_order: Number($("#categorySort").value || 0), visible: true } }); closeModals(); toast("Categoría guardada", "success"); await refreshData(); }
  catch { toast("No se pudo guardar la categoría", "error"); }
}

async function deleteCategory(id) {
  const category = state.categories.find(item => item.id === id); if (!category || !confirm(`¿Eliminar “${category.name}”? Los productos quedarán sin categoría.`)) return;
  try { await callApi("delete_category", { slug: state.account.slug, category_id: id }); toast("Categoría eliminada", "success"); await refreshData(); }
  catch { toast("No se pudo eliminar la categoría", "error"); }
}

function openOrder(id) {
  const order = state.orders.find(item => item.id === id); if (!order) return; state.activeOrder = order;
  $("#orderModalTitle").textContent = order.order_number;
  const progressIndex = Math.max(0, orderStatuses.findIndex(([value]) => value === order.status));
  const phone = phoneDigits(order.customer_phone);
  const lat=Number(order.delivery_lat),lng=Number(order.delivery_lng),hasMap=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  const mapUrl=hasMap?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`:"";
  const deliveryCard=order.delivery_method==="pickup"
    ? `<div class="review-card" style="margin-top:12px"><h3>Entrega</h3><p style="margin:0;color:var(--muted);font-size:10px;line-height:1.5">Retiro acordado.</p></div>`
    : `<div class="review-card" style="margin-top:12px"><h3>Entrega</h3><p style="margin:0 0 ${hasMap?"10px":"0"};color:var(--muted);font-size:10px;line-height:1.5">${escapeHTML(order.delivery_address||(hasMap?"Ubicación marcada por el cliente.":"Dirección por coordinar."))}</p>${hasMap?`<a class="button button--secondary" href="${mapUrl}" target="_blank" rel="noopener">Abrir ubicación en mapa</a>`:""}</div>`;
  $("#orderModalContent").innerHTML = `<div class="order-detail-top"><h3>${escapeHTML(order.customer_business || order.customer_name)}</h3><p>${escapeHTML(order.customer_name || "Contacto")} · +${escapeHTML(phone)} · ${formatDate(order.created_at)}</p><div class="status-timeline">${orderStatuses.slice(0,5).map((_,index) => `<i class="${index <= progressIndex && order.status !== "cancelled" ? "done" : ""}"></i>`).join("")}</div></div><div class="order-detail-items">${(order.items || []).map(item => `<div class="order-detail-item"><b>${item.quantity}×</b><span>${escapeHTML(item.product_name)}<small style="display:block;color:var(--muted);margin-top:3px">${escapeHTML(item.unit || "")}</small></span><strong>${money(item.line_total)}</strong></div>`).join("")}</div><div class="order-detail-total"><span>Total estimado</span><strong>${money(order.total)}</strong></div>${deliveryCard}${order.notes ? `<div class="review-card" style="margin-top:12px"><h3>Observaciones</h3><p style="margin:0;color:var(--muted);font-size:10px;line-height:1.5">${escapeHTML(order.notes)}</p></div>` : ""}<div class="order-detail-actions"><select class="status-select" id="modalOrderStatus">${statusOptions(order.status)}</select><a class="button button--primary" href="https://wa.me/${phone}" target="_blank" rel="noopener"><svg class="icon"><use href="#i-message"/></svg>WhatsApp</a></div>`;
  $("#modalOrderStatus").onchange = async event => { await updateOrderStatus(order.id, event.target.value); closeModals(); };
  openModal($("#orderModal"));
}

async function updateOrderStatus(id, status) {
  try { await callApi("update_order_status", { slug: state.account.slug, order_id: id, status }); const order = state.orders.find(item => item.id === id); if (order) order.status = status; renderStats(); renderOrders(); renderDashboard(); toast("Pedido actualizado", "success"); }
  catch { toast("No se pudo actualizar el pedido", "error"); }
}

async function saveIdentity(event) {
  event.preventDefault(); const name = $("#businessName").value.trim(); if (name.length < 2) return toast("Escribe el nombre comercial", "error");
  try { let logoPath = state.account.logo_path || "", logoUrl = state.account.logo_url || ""; const file = $("#logoFile").files[0]; if (file) { const uploaded = await uploadFile(file, "logo", logoPath); logoPath = uploaded.path; logoUrl = uploaded.public_url; } const settings = { name, tagline: $("#businessTagline").value.trim(), whatsapp: phoneDigits($("#businessWhatsapp").value), accent: $("#businessAccent").value, logo_path: logoPath || null, logo_url: logoUrl || null }; await callApi("save_account", { slug: state.account.slug, settings }); toast("Identidad actualizada", "success"); await refreshData(); }
  catch { toast("No se pudieron guardar los cambios", "error"); }
}

async function saveCatalogSettings(event) {
  event.preventDefault();
  try { const settings = { hero_title: $("#heroTitleInput").value.trim(), hero_subtitle: $("#heroSubtitleInput").value.trim(), minimum_order: Number($("#minimumOrder").value || 0), is_open: $("#catalogOpen").checked, show_prices: $("#showPrices").checked }; await callApi("save_account", { slug: state.account.slug, settings }); toast("Catálogo actualizado", "success"); await refreshData(); }
  catch { toast("No se pudieron guardar los cambios", "error"); }
}

async function changePin(event) {
  event.preventDefault(); const pin = $("#newPin").value, confirmPin = $("#confirmPin").value;
  if (!/^\d{4}$/.test(pin)) return toast("El PIN debe tener exactamente 4 números", "error");
  if (pin !== confirmPin) return toast("Los PIN no coinciden", "error");
  if (!confirm("¿Actualizar el PIN? Las demás sesiones se cerrarán.")) return;
  try { await callApi("change_pin", { slug: state.account.slug, pin }); $("#newPin").value = $("#confirmPin").value = ""; toast("PIN actualizado correctamente", "success"); if (state.mode === "provider") { setTimeout(logout, 700); } }
  catch { toast("No se pudo actualizar el PIN", "error"); }
}

async function revokeSessions() {
  if (!confirm("¿Cerrar todas las demás sesiones del proveedor?")) return;
  try { await callApi("revoke_sessions", { slug: state.account.slug }); toast("Sesiones cerradas", "success"); }
  catch { toast("No se pudieron cerrar las sesiones", "error"); }
}

async function refreshData(options = {}) {
  const silent = options?.silent === true;
  if (state.refreshing || !state.account) return;
  state.refreshing = true;
  const previousNewIds = new Set(state.orders.filter(order => order.status === "new").map(order => order.id));
  if (!silent) $("#refreshBtn").classList.add("spinning");
  try {
    const result = await callApi(state.mode === "master" ? "master_bootstrap" : "provider_bootstrap", state.mode === "master" ? { slug: state.account.slug } : {});
    applyBootstrap(result);
    renderAll();
    if (state.mode === "master") renderMasterSwitcher();
    const freshOrders = state.orders.filter(order => order.status === "new" && !previousNewIds.has(order.id)).length;
    if (silent && freshOrders) toast(`${freshOrders} pedido${freshOrders === 1 ? " nuevo" : "s nuevos"}`, "success", 4200);
  } catch (error) {
    if (error.status === 401 || error.code === "session_expired") logout();
    else if (!silent) toast("No se pudo actualizar", "error");
  } finally {
    state.refreshing = false;
    $("#refreshBtn").classList.remove("spinning");
  }
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (!document.hidden && navigator.onLine && !state.busy) refreshData({ silent: true });
  }, 30000);
}

async function shareCatalog() {
  const url = state.account.slug === config.defaultSlug ? `${location.origin}/` : `${location.origin}/c/${state.account.slug}`;
  try { if (navigator.share) await navigator.share({ title: `${state.account.name} · Catálogo`, text: "Revisa nuestros productos y prepara tu pedido:", url }); else { await navigator.clipboard.writeText(url); toast("Enlace copiado", "success"); } }
  catch (error) { if (error.name !== "AbortError") toast("No se pudo compartir", "error"); }
}

async function logout() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
  if (state.mode === "provider") {
    try { await callApi("provider_logout", { slug: state.account?.slug || slug }); } catch { /* session may already be gone */ }
    state.providerToken = ""; sessionStorage.removeItem(providerSessionKey); clearPin(); setGate("#pinGate");
  } else { saveMasterSession(null); setGate("#masterGate"); }
}

function bindEvents() {
  $$('[data-pin]').forEach(button => button.onclick = () => appendPin(button.dataset.pin));
  $("#pinClear").onclick = () => clearPin();
  $("#pinBack").onclick = () => { $("#pinInput").value = $("#pinInput").value.slice(0, -1); renderPinDots(); };
  $("#pinSubmit").onclick = providerLogin;
  $("#masterForm").onsubmit = masterLogin;
  $$('[data-nav]').forEach(button => button.onclick = () => navigate(button.dataset.nav));
  $$('[data-go]').forEach(button => button.onclick = () => navigate(button.dataset.go));
  $("#newProductBtn").onclick = $("#mobileCreateBtn").onclick = () => openProductModal();
  $("#saveProductBtn").onclick = saveProduct; $("#archiveProductBtn").onclick = archiveProduct;
  $("#productSearch").addEventListener("input", debounce(renderProducts, 120));
  $$('[data-product-filter]').forEach(button => button.onclick = () => { state.productFilter = button.dataset.productFilter; $$('[data-product-filter]').forEach(item => item.classList.toggle("active", item === button)); renderProducts(); });
  $("#orderSearch").addEventListener("input", debounce(renderOrders, 120));
  $$('[data-order-filter]').forEach(button => button.onclick = () => { state.orderFilter = button.dataset.orderFilter; $$('[data-order-filter]').forEach(item => item.classList.toggle("active", item === button)); renderOrders(); });
  $("#customerSearch").addEventListener("input", debounce(renderCustomers, 120));
  $$('[data-quick]').forEach(button => button.onclick = () => { const action = button.dataset.quick; if (action === "new-product") openProductModal(); else if (action === "stock") { state.productFilter = "attention"; navigate("products"); renderProducts(); } else navigate(action); });
  $$('[data-daily]').forEach(button => button.onclick = () => { const action = button.dataset.daily; if (action === "stock") { state.productFilter = "attention"; navigate("products"); renderProducts(); } else { state.orderFilter = action === "new-orders" ? "new" : "open"; navigate("orders"); renderOrders(); } });
  $$('[data-settings]').forEach(button => button.onclick = () => { $$('[data-settings]').forEach(item => item.classList.toggle("active", item === button)); $$('[data-settings-panel]').forEach(panel => panel.classList.toggle("active", panel.dataset.settingsPanel === button.dataset.settings)); });
  $("#newCategoryBtn").onclick = () => openCategoryModal(); $("#saveCategoryBtn").onclick = saveCategory;
  $("#identityForm").onsubmit = saveIdentity; $("#catalogSettingsForm").onsubmit = saveCatalogSettings; $("#pinChangeForm").onsubmit = changePin; $("#revokeSessionsBtn").onclick = revokeSessions;
  $("#businessAccent").oninput = event => { $("#accentOutput").textContent = event.target.value; document.documentElement.style.setProperty("--brand", event.target.value); };
  $("#productImage").onchange = event => { const file = event.target.files[0]; if (file) $("#productImagePreview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Vista previa">`; };
  $("#logoFile").onchange = event => { const file = event.target.files[0]; if (file) $("#logoPreview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Vista previa">`; };
  $$('[data-close-modal]').forEach(button => button.onclick = closeModals); $("#modalBackdrop").onclick = closeModals;
  $("#refreshBtn").onclick = refreshData; $("#logoutBtn").onclick = logout; $("#shareCatalogAdmin").onclick = shareCatalog; $("#openCatalogSide").onclick = () => window.open(state.account.slug === config.defaultSlug ? "/" : `/c/${state.account.slug}`, "_blank", "noopener");
  window.addEventListener("online", () => updateConnection(true)); window.addEventListener("offline", () => updateConnection(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden && navigator.onLine && state.account) refreshData({ silent: true }); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModals(); if (!isMaster && !$("#pinGate").hidden && /^\d$/.test(event.key)) appendPin(event.key); if (!isMaster && !$("#pinGate").hidden && event.key === "Backspace") { $("#pinInput").value = $("#pinInput").value.slice(0, -1); renderPinDots(); } });
}

function updateConnection(online) {
  $("#connectionChip").classList.toggle("offline", !online); $("#connectionChip span").textContent = online ? "En línea" : "Sin conexión";
}

async function init() {
  bindEvents(); updateConnection(navigator.onLine);
  if (state.mode === "master") {
    if (!state.masterSession) return setGate("#masterGate");
    setGate("#panelLoading"); await bootstrap();
  } else {
    if (!state.providerToken) { setGate("#pinGate"); try { const result = await api("catalog_identity", { slug }); $("#pinTitle").textContent = result.account.name; $("#gateLogo").innerHTML = result.account.logo_url ? `<img src="${escapeHTML(result.account.logo_url)}" alt="">` : escapeHTML(initials(result.account.name)); document.documentElement.style.setProperty("--brand", result.account.accent || "#f06a3a"); } catch { /* keep provisional identity */ } return; }
    setGate("#panelLoading"); await bootstrap();
  }
}

init();
