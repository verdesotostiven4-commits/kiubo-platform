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
  const state = {
    products: [],
    categories: [],
    mode: "category",
    activeBrand: "all",
    frame: 0,
    hydrated: false
  };

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const brandKey = value => normalize(value);
  const productById = id => state.products.find(product => String(product.id) === String(id));
  const productByName = name => state.products.find(product => normalize(product.name) === normalize(name));

  const visibleProducts = () => state.products.filter(product => product.visible !== false && !product.archived_at);
  const brands = () => {
    const map = new Map();
    for (const product of visibleProducts()) {
      const name = String(product.brand || "").trim();
      if (!name) continue;
      const key = brandKey(name);
      if (!map.has(key)) map.set(key, { key, name, count: 0 });
      map.get(key).count += 1;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  };

  const capturePayload = (action, payload) => {
    if (!payload || typeof payload !== "object") return;
    if (["catalog_bootstrap", "provider_bootstrap", "master_bootstrap"].includes(action)) {
      if (Array.isArray(payload.products)) state.products = payload.products;
      if (Array.isArray(payload.categories)) state.categories = payload.categories;
      state.hydrated = state.products.length > 0;
      schedule();
    }
  };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    let action = "";
    if (url === config.apiUrl && typeof init?.body === "string") {
      try { action = JSON.parse(init.body)?.action || ""; } catch { }
    }
    const response = await nativeFetch(input, init);
    if (url === config.apiUrl && action) {
      try { capturePayload(action, await response.clone().json()); } catch { }
    }
    return response;
  };

  async function hydrate() {
    if (state.hydrated) return;
    try {
      const body = isPanel ? { action: "provider_bootstrap", slug } : { action: "catalog_bootstrap", slug };
      const headers = { "Content-Type": "application/json", "x-client-version": config.version || "4.7.0" };
      if (isPanel) {
        const providerToken = sessionStorage.getItem(`kiubo-provider-session:${slug}`);
        if (!providerToken) return;
        headers["x-provider-session"] = providerToken;
      }
      const response = await nativeFetch(config.apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
      if (!response.ok) return;
      capturePayload(body.action, await response.json());
    } catch { }
  }

  function ensurePublicControls() {
    if (isPanel) return;
    const categoryScroller = document.querySelector("#categoryScroller");
    if (!categoryScroller || document.querySelector("#catalogBrowseModes")) return;

    const wrap = document.createElement("div");
    wrap.id = "catalogBrowseModes";
    wrap.className = "catalog-browse-modes";
    wrap.setAttribute("aria-label", "Organizar productos por");
    wrap.innerHTML = `
      <span class="catalog-browse-modes__label">Ver por</span>
      <div class="catalog-browse-modes__switch" role="tablist" aria-label="Forma de explorar el catálogo">
        <button type="button" class="active" data-browse-mode="category" role="tab" aria-selected="true">Categorías</button>
        <button type="button" data-browse-mode="brand" role="tab" aria-selected="false">Marcas</button>
      </div>`;

    const brandScroller = document.createElement("div");
    brandScroller.id = "brandScroller";
    brandScroller.className = "category-scroller brand-scroller";
    brandScroller.hidden = true;
    categoryScroller.parentNode.insertBefore(wrap, categoryScroller);
    categoryScroller.parentNode.insertBefore(brandScroller, categoryScroller.nextSibling);

    wrap.querySelectorAll("[data-browse-mode]").forEach(button => {
      button.addEventListener("click", () => setMode(button.dataset.browseMode));
    });
  }

  function renderBrandScroller() {
    if (isPanel) return;
    const scroller = document.querySelector("#brandScroller");
    if (!scroller) return;
    const items = brands();
    scroller.innerHTML = [
      `<button class="category-chip ${state.activeBrand === "all" ? "active" : ""}" type="button" data-brand-filter="all">Todas</button>`,
      ...items.map(item => `<button class="category-chip ${state.activeBrand === item.key ? "active" : ""}" type="button" data-brand-filter="${escapeAttr(item.key)}">${escapeText(item.name)}<small>${item.count}</small></button>`)
    ].join("");

    scroller.querySelectorAll("[data-brand-filter]").forEach(button => {
      button.addEventListener("click", () => {
        state.activeBrand = button.dataset.brandFilter || "all";
        renderBrandScroller();
        applyPublicBrandFilter();
        document.querySelector("#catalogProducts")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (navigator.vibrate) navigator.vibrate(8);
      });
    });
  }

  function setMode(mode) {
    if (isPanel || !["category", "brand"].includes(mode)) return;
    state.mode = mode;
    const categoryScroller = document.querySelector("#categoryScroller");
    const brandScroller = document.querySelector("#brandScroller");
    const controls = document.querySelector("#catalogBrowseModes");
    if (!categoryScroller || !brandScroller || !controls) return;

    controls.querySelectorAll("[data-browse-mode]").forEach(button => {
      const active = button.dataset.browseMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    if (mode === "brand") {
      const allCategory = categoryScroller.querySelector('[data-category="all"]');
      if (allCategory && !allCategory.classList.contains("active")) allCategory.click();
      categoryScroller.hidden = true;
      brandScroller.hidden = false;
      renderBrandScroller();
      applyPublicBrandFilter();
    } else {
      state.activeBrand = "all";
      categoryScroller.hidden = false;
      brandScroller.hidden = true;
      restorePublicCards();
    }
  }

  function decoratePublicCards() {
    if (isPanel) return;
    document.querySelectorAll("#productGrid [data-product-card]").forEach(card => {
      const product = productById(card.dataset.productCard);
      if (!product) return;
      const brand = String(product.brand || "").trim();
      const body = card.querySelector(".product-card__body");
      const category = body?.querySelector(".product-category");
      if (!body || !category) return;
      let mark = body.querySelector(".product-brand-mark");
      if (!brand) {
        mark?.remove();
        return;
      }
      if (!mark) {
        mark = document.createElement("span");
        mark.className = "product-brand-mark";
        category.insertAdjacentElement("afterend", mark);
      }
      mark.textContent = brand;
    });
  }

  function applyPublicBrandFilter() {
    if (isPanel || state.mode !== "brand") return;
    const cards = [...document.querySelectorAll("#productGrid [data-product-card]")];
    let visible = 0;
    for (const card of cards) {
      const product = productById(card.dataset.productCard);
      const matches = state.activeBrand === "all" || (product && brandKey(product.brand) === state.activeBrand);
      card.classList.toggle("brand-filter-hidden", !matches);
      card.setAttribute("aria-hidden", matches ? "false" : "true");
      if (matches) visible += 1;
    }

    const grid = document.querySelector("#productGrid");
    const empty = document.querySelector("#emptyState");
    if (grid && empty) {
      grid.hidden = visible === 0;
      empty.hidden = visible > 0;
    }
    const result = document.querySelector("#resultCount");
    if (result && state.activeBrand !== "all") {
      const selected = brands().find(item => item.key === state.activeBrand)?.name || "Marca";
      result.textContent = `${visible} producto${visible === 1 ? "" : "s"} · ${selected}`;
    }
  }

  function restorePublicCards() {
    if (isPanel) return;
    document.querySelectorAll("#productGrid .brand-filter-hidden").forEach(card => {
      card.classList.remove("brand-filter-hidden");
      card.removeAttribute("aria-hidden");
    });
  }

  function ensurePanelBrandTools() {
    if (!isPanel) return;
    const input = document.querySelector("#productBrand");
    if (!input) return;

    let list = document.querySelector("#productBrandSuggestions");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "productBrandSuggestions";
      document.body.append(list);
      input.setAttribute("list", list.id);
      input.setAttribute("autocomplete", "off");
      input.placeholder = "Ej. Toni, Nestlé, La Lechera";
    }
    list.innerHTML = brands().map(item => `<option value="${escapeAttr(item.name)}"></option>`).join("");

    const field = input.closest(".field") || input.parentElement;
    if (field && !field.querySelector(".brand-field-help")) {
      const help = document.createElement("small");
      help.className = "brand-field-help";
      help.textContent = "La marca permitirá que tus clientes también exploren el catálogo por fabricante.";
      field.append(help);
    }

    const search = document.querySelector("#productSearch");
    if (!search || document.querySelector("#adminBrandFilter")) return;
    const filter = document.createElement("label");
    filter.className = "admin-brand-filter";
    filter.innerHTML = `<span>Marca</span><select id="adminBrandFilter" aria-label="Filtrar productos por marca"><option value="all">Todas las marcas</option>${brands().map(item => `<option value="${escapeAttr(item.key)}">${escapeText(item.name)} (${item.count})</option>`).join("")}</select>`;
    const host = search.closest(".search-field")?.parentElement || search.parentElement;
    host?.append(filter);
    filter.querySelector("select").addEventListener("change", applyPanelBrandFilter);
  }

  function decoratePanelRows() {
    if (!isPanel) return;
    document.querySelectorAll("#adminProductList .admin-product").forEach(row => {
      const name = row.querySelector(".admin-product__copy h3")?.textContent || "";
      const product = productByName(name);
      const brand = String(product?.brand || "").trim();
      const copy = row.querySelector(".admin-product__copy");
      if (!copy) return;
      let badge = copy.querySelector(".admin-product-brand");
      if (!brand) { badge?.remove(); return; }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "admin-product-brand";
        const flags = copy.querySelector(".product-flags");
        if (flags) flags.insertAdjacentElement("beforebegin", badge); else copy.append(badge);
      }
      badge.textContent = brand;
    });
  }

  function applyPanelBrandFilter() {
    if (!isPanel) return;
    const select = document.querySelector("#adminBrandFilter");
    const selected = select?.value || "all";
    document.querySelectorAll("#adminProductList .admin-product").forEach(row => {
      const product = productByName(row.querySelector(".admin-product__copy h3")?.textContent || "");
      row.classList.toggle("brand-filter-hidden", selected !== "all" && brandKey(product?.brand) !== selected);
    });
  }

  function refreshPanelBrandFilterOptions() {
    if (!isPanel) return;
    const select = document.querySelector("#adminBrandFilter");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="all">Todas las marcas</option>${brands().map(item => `<option value="${escapeAttr(item.key)}">${escapeText(item.name)} (${item.count})</option>`).join("")}`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function escapeAttr(value) { return escapeText(value); }

  function enhance() {
    state.frame = 0;
    if (isPanel) {
      ensurePanelBrandTools();
      refreshPanelBrandFilterOptions();
      decoratePanelRows();
      applyPanelBrandFilter();
    } else {
      ensurePublicControls();
      renderBrandScroller();
      decoratePublicCards();
      applyPublicBrandFilter();
    }
  }

  function schedule() {
    if (state.frame) return;
    state.frame = requestAnimationFrame(enhance);
  }

  document.addEventListener("click", event => {
    if (!isPanel && event.target.closest?.("#clearFiltersBtn")) {
      state.activeBrand = "all";
      if (state.mode === "brand") setTimeout(() => { renderBrandScroller(); applyPublicBrandFilter(); }, 0);
    }
    schedule();
  }, true);

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    hydrate();
    schedule();
    if (isPanel) setInterval(hydrate, 30000);
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
