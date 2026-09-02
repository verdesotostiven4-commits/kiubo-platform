(() => {
  const config = window.KIUBO_CATALOG_CONFIG;
  if (!config?.apiUrl) return;

  const slugFromPage = () => {
    const querySlug = new URLSearchParams(location.search).get("slug");
    const pathMatch = location.pathname.match(/^\/c\/([^/]+)/);
    return (querySlug || pathMatch?.[1] || config.defaultSlug || "hakuna-matata")
      .toLowerCase().replace(/[^a-z0-9-]/g, "");
  };

  const slug = slugFromPage();
  const isPanel = /^\/(panel|master)(?:\/|$)/.test(location.pathname);
  const nativeFetch = window.fetch.bind(window);
  const state = { products: [], activeProductId: "", frame: 0, modalHydratedFor: null };

  const productsById = () => new Map(state.products.map(product => [String(product.id), product]));
  const productById = id => productsById().get(String(id || ""));
  const productByName = name => state.products.find(product => String(product.name || "").trim() === String(name || "").trim());

  const toast = (message, type = "info") => {
    let stack = document.querySelector("#inventoryToastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "inventoryToastStack";
      stack.className = "inventory-toast-stack";
      document.body.append(stack);
    }
    const item = document.createElement("div");
    item.className = `inventory-toast ${type}`;
    item.textContent = message;
    stack.append(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3200);
  };

  const parseRequest = init => {
    if (typeof init?.body !== "string") return null;
    try { return JSON.parse(init.body); } catch { return null; }
  };

  const requestHeaders = init => {
    const headers = new Headers(init?.headers || {});
    headers.set("Content-Type", "application/json");
    return headers;
  };

  const mergeProducts = products => {
    if (!Array.isArray(products)) return;
    const current = new Map(state.products.map(product => [String(product.id), product]));
    for (const product of products) current.set(String(product.id), { ...(current.get(String(product.id)) || {}), ...product });
    state.products = [...current.values()];
    scheduleEnhance();
  };

  const stockFormValues = () => {
    const tracking = document.querySelector("#productStockTracking");
    const quantity = document.querySelector("#productStockQuantity");
    const threshold = document.querySelector("#productLowThreshold");
    if (!tracking || !quantity || !threshold) return null;
    return {
      stock_tracking: tracking.checked,
      stock_quantity: Math.max(0, Math.trunc(Number(quantity.value || 0))),
      low_stock_threshold: Math.max(0, Math.trunc(Number(threshold.value || 0)))
    };
  };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const body = url === config.apiUrl ? parseRequest(init) : null;
    const pendingStock = body?.action === "save_product" ? stockFormValues() : null;
    const response = await nativeFetch(input, init);

    if (url === config.apiUrl && body) {
      try {
        const payload = await response.clone().json();
        if (response.ok && ["catalog_bootstrap", "provider_bootstrap", "master_bootstrap"].includes(body.action)) {
          mergeProducts(payload.products);
        }

        if (response.ok && body.action === "save_product" && pendingStock && payload.id) {
          const stockResponse = await nativeFetch(config.apiUrl, {
            method: "POST",
            headers: requestHeaders(init),
            body: JSON.stringify({ action: "save_stock", slug, product_id: payload.id, ...pendingStock })
          });
          const stockPayload = await stockResponse.json().catch(() => ({}));
          if (stockResponse.ok && stockPayload.product) {
            mergeProducts([{ id: payload.id, ...stockPayload.product, name: body.product?.name }]);
          } else {
            toast("El producto se guardó, pero no pudimos actualizar su stock.", "error");
          }
        }
      } catch { /* never alter the original response */ }
    }

    return response;
  };

  const publicBootstrap = async () => {
    if (isPanel) return;
    try {
      const response = await nativeFetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-version": config.version || "4.6.0" },
        body: JSON.stringify({ action: "catalog_bootstrap", slug })
      });
      if (!response.ok) return;
      const payload = await response.json();
      mergeProducts(payload.products);
    } catch { /* catalog.js keeps its own normal error handling */ }
  };

  const currentCartQuantity = productId => {
    try {
      const cart = JSON.parse(localStorage.getItem(`kiubo-catalog-cart:${slug}`) || "{}");
      return Math.max(0, Number(cart?.[productId] || 0));
    } catch { return 0; }
  };

  const stockForTrigger = trigger => {
    const id = trigger.dataset.add || trigger.dataset.increase || trigger.dataset.cartPlus || trigger.dataset.openProduct || trigger.dataset.searchProduct || state.activeProductId;
    return productById(id);
  };

  const guardStockClick = event => {
    const trigger = event.target.closest?.("[data-add],[data-increase],[data-cart-plus],[data-detail-plus]");
    if (!trigger) return;
    const product = stockForTrigger(trigger);
    if (!product?.stock_tracking) return;
    const available = Math.max(0, Number(product.stock_quantity || 0));
    const current = currentCartQuantity(product.id);
    if (current < available) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    toast(available ? `Solo hay ${available} unidad${available === 1 ? "" : "es"} disponibles.` : "Este producto está agotado.", "error");
  };

  const ensureStockFields = () => {
    if (!isPanel) return;
    const form = document.querySelector("#productForm");
    const statusField = document.querySelector("#productStatus")?.closest(".field");
    if (!form || !statusField || document.querySelector("#productStockTracking")) return;

    const box = document.createElement("section");
    box.className = "inventory-editor full";
    box.innerHTML = `
      <div class="inventory-editor__head">
        <div><b>Control de stock</b><small>Lleva existencias reales y actualiza la disponibilidad automáticamente.</small></div>
        <label class="inventory-switch"><input id="productStockTracking" type="checkbox"><i></i></label>
      </div>
      <div class="inventory-editor__fields">
        <label class="field"><span>Unidades disponibles</span><input id="productStockQuantity" type="number" min="0" step="1" inputmode="numeric" value="0"></label>
        <label class="field"><span>Avisar como “Pocas” desde</span><input id="productLowThreshold" type="number" min="0" step="1" inputmode="numeric" value="5"></label>
      </div>
      <p class="inventory-editor__help">Cuando está activo: 0 = agotado · hasta el límite = pocas unidades · por encima = disponible.</p>`;
    form.insertBefore(box, statusField);

    const tracking = box.querySelector("#productStockTracking");
    const quantity = box.querySelector("#productStockQuantity");
    const threshold = box.querySelector("#productLowThreshold");
    const status = document.querySelector("#productStatus");

    const sync = () => {
      quantity.disabled = threshold.disabled = !tracking.checked;
      if (status) {
        status.disabled = tracking.checked;
        status.closest(".field")?.classList.toggle("inventory-status-auto", tracking.checked);
      }
    };
    tracking.addEventListener("change", sync);
    sync();
  };

  const hydrateStockFields = () => {
    if (!isPanel) return;
    const modal = document.querySelector("#productModal");
    const tracking = document.querySelector("#productStockTracking");
    if (!modal || modal.hidden || !tracking) return;
    const key = state.activeProductId || "__new__";
    if (state.modalHydratedFor === key) return;
    state.modalHydratedFor = key;

    const product = productById(state.activeProductId);
    tracking.checked = Boolean(product?.stock_tracking);
    document.querySelector("#productStockQuantity").value = String(Math.max(0, Number(product?.stock_quantity || 0)));
    document.querySelector("#productLowThreshold").value = String(Math.max(0, Number(product?.low_stock_threshold ?? 5)));
    tracking.dispatchEvent(new Event("change"));
  };

  const decorateAdminProducts = () => {
    if (!isPanel) return;
    document.querySelectorAll("#adminProductList .admin-product").forEach(row => {
      if (row.querySelector(".inventory-admin-badge")) return;
      const name = row.querySelector(".admin-product__copy h3")?.textContent;
      const product = productByName(name);
      if (!product) return;

      const badge = document.createElement("span");
      badge.className = `inventory-admin-badge ${product.stock_tracking ? "tracked" : "manual"}`;
      badge.textContent = product.stock_tracking ? `Stock: ${Math.max(0, Number(product.stock_quantity || 0))}` : "Stock manual";
      row.querySelector(".admin-product__copy")?.append(badge);

      if (product.stock_tracking) {
        const selector = row.querySelector(".stock-selector");
        if (selector) {
          selector.classList.add("inventory-auto-selector");
          selector.title = "La disponibilidad se calcula automáticamente según el stock.";
        }
      }
    });
  };

  const decorateProductSheet = () => {
    if (isPanel) return;
    const sheet = document.querySelector("#productSheet");
    if (!sheet || sheet.hidden || sheet.querySelector(".inventory-client-note")) return;
    const product = productById(state.activeProductId) || productByName(document.querySelector("#productSheetTitle")?.textContent);
    if (!product?.stock_tracking) return;
    const buy = sheet.querySelector(".detail-buy");
    if (!buy) return;
    const note = document.createElement("div");
    note.className = "inventory-client-note";
    const quantity = Math.max(0, Number(product.stock_quantity || 0));
    note.textContent = quantity === 0 ? "Agotado temporalmente" : quantity <= Number(product.low_stock_threshold || 0) ? `Quedan ${quantity} unidad${quantity === 1 ? "" : "es"}` : "Stock disponible";
    buy.parentElement?.insertBefore(note, buy);
  };

  const enhance = () => {
    state.frame = 0;
    ensureStockFields();
    hydrateStockFields();
    decorateAdminProducts();
    decorateProductSheet();
  };

  const scheduleEnhance = () => {
    if (state.frame) return;
    state.frame = requestAnimationFrame(enhance);
  };

  document.addEventListener("click", event => {
    const open = event.target.closest?.("[data-edit-product],[data-open-product],[data-search-product],#newProductBtn,#mobileCreateBtn");
    if (open) {
      state.activeProductId = open.dataset?.editProduct || open.dataset?.openProduct || open.dataset?.searchProduct || "";
      state.modalHydratedFor = null;
    }
    scheduleEnhance();
  }, true);
  document.addEventListener("click", guardStockClick, true);

  const observer = new MutationObserver(scheduleEnhance);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    enhance();
    publicBootstrap();
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
