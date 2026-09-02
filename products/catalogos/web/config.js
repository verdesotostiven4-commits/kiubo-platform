window.KIUBO_CATALOG_CONFIG = Object.freeze({
  supabaseUrl: "https://hysrlckmnzlmscwwbibn.supabase.co",
  publishableKey: "sb_publishable_hnsAgTsI1c_wErMMwAYwMQ_crWdOBpT",
  apiUrl: "https://hysrlckmnzlmscwwbibn.supabase.co/functions/v1/catalog-router",
  defaultSlug: "hakuna-matata",
  version: "4.6.0"
});

(() => {
  const config = window.KIUBO_CATALOG_CONFIG;
  const addStyle = (href, marker) => {
    if (document.querySelector(`link[data-kiubo-layer="${marker}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.kiuboLayer = marker;
    document.head.append(link);
  };
  const addScript = (src, marker) => {
    if (document.querySelector(`script[data-kiubo-layer="${marker}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.kiuboLayer = marker;
    document.head.append(script);
  };

  addStyle("/hakuna.theme.css?v=4.6.0", "hakuna-theme");
  addStyle("/ux-v4.5.css?v=4.6.0", "catalog-ux");
  addStyle("/inventory-v4.6.css?v=4.6.0", "catalog-inventory");
  addScript("/inventory-v4.6.js?v=4.6.0", "catalog-inventory-runtime");

  const slugFromPage = () => {
    const querySlug = new URLSearchParams(location.search).get("slug");
    const pathMatch = location.pathname.match(/^\/c\/([^/]+)/);
    return (querySlug || pathMatch?.[1] || config.defaultSlug)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
  };

  const slug = slugFromPage();
  const noteKey = `kiubo-catalog-item-notes:${slug}`;
  const runtime = {
    products: [],
    orders: [],
    activeProductId: "",
    sheetGestureReady: new WeakSet(),
    frame: 0
  };

  const readNotes = () => {
    try { return JSON.parse(localStorage.getItem(noteKey) || "{}"); }
    catch { return {}; }
  };

  const writeNotes = notes => {
    try { localStorage.setItem(noteKey, JSON.stringify(notes)); }
    catch { }
  };

  const itemNote = productId => String(readNotes()[productId] || "");

  const saveItemNote = (productId, value) => {
    if (!productId) return;
    const notes = readNotes();
    const clean = String(value || "").replace(/\s+/g, " ").trimStart().slice(0, 180);
    if (clean.trim()) notes[productId] = clean;
    else delete notes[productId];
    writeNotes(notes);
  };

  const clearSubmittedNotes = items => {
    const notes = readNotes();
    let changed = false;
    for (const item of items || []) {
      if (item?.product_id && item.product_id in notes) {
        delete notes[item.product_id];
        changed = true;
      }
    }
    if (changed) writeNotes(notes);
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let nextInit = init;
    let requestBody = null;
    const url = typeof input === "string" ? input : input?.url || "";

    if (url === config.apiUrl && typeof init?.body === "string") {
      try {
        requestBody = JSON.parse(init.body);
        if (requestBody?.action === "create_order" && Array.isArray(requestBody.items)) {
          const notes = readNotes();
          const items = requestBody.items.map(item => ({
            ...item,
            ...(notes[item.product_id]
              ? { item_note: String(notes[item.product_id]).trim().slice(0, 180) }
              : {})
          }));
          requestBody = { ...requestBody, items };
          nextInit = { ...init, body: JSON.stringify(requestBody) };
        }
      } catch { }
    }

    const response = await originalFetch(input, nextInit);

    if (url === config.apiUrl && requestBody) {
      try {
        const payload = await response.clone().json();
        if (response.ok && requestBody.action === "catalog_bootstrap") {
          runtime.products = Array.isArray(payload.products) ? payload.products : [];
        }
        if (response.ok && ["provider_bootstrap", "master_bootstrap"].includes(requestBody.action)) {
          runtime.products = Array.isArray(payload.products) ? payload.products : runtime.products;
          runtime.orders = Array.isArray(payload.orders) ? payload.orders : [];
        }
        if (response.ok && requestBody.action === "create_order") {
          clearSubmittedNotes(requestBody.items);
        }
      } catch { }
    }

    return response;
  };

  const productByName = name =>
    runtime.products.find(product => String(product.name || "").trim() === String(name || "").trim());

  const productForDetail = () => {
    const fromId = runtime.products.find(product => product.id === runtime.activeProductId);
    if (fromId) return fromId;
    return productByName(document.querySelector("#productSheetTitle")?.textContent);
  };

  const noteField = (product, compact = false) => {
    const wrap = document.createElement("label");
    wrap.className = compact ? "item-note item-note--cart" : "item-note";
    wrap.dataset.noteProduct = product.id;
    wrap.innerHTML = `
      <span class="item-note__title">
        Observación para este producto
        <small>Opcional</small>
      </span>
      <textarea maxlength="180" rows="${compact ? 2 : 3}" placeholder="Ej. sabor, color, modelo o variedad que prefieres"></textarea>
      <span class="item-note__foot"><span>Se enviará junto con este ítem.</span><b>0/180</b></span>
    `;
    const textarea = wrap.querySelector("textarea");
    textarea.value = itemNote(product.id);
    const counter = wrap.querySelector(".item-note__foot b");
    counter.textContent = `${textarea.value.length}/180`;
    textarea.addEventListener("input", () => {
      const value = textarea.value.slice(0, 180);
      if (textarea.value !== value) textarea.value = value;
      saveItemNote(product.id, textarea.value);
      counter.textContent = `${textarea.value.length}/180`;
    });
    return wrap;
  };

  const enhanceProductSheet = () => {
    const sheet = document.querySelector("#productSheet");
    const body = sheet?.querySelector(".product-detail-body");
    if (!sheet || sheet.hidden || !body || body.querySelector(".item-note")) return;
    const product = productForDetail();
    if (!product) return;
    const buy = body.querySelector(".detail-buy");
    if (buy) body.insertBefore(noteField(product), buy);
  };

  const enhanceCartLines = () => {
    document.querySelectorAll("#cartLines .cart-line").forEach(line => {
      if (line.querySelector(".item-note--cart")) return;
      const product = productByName(line.querySelector("h3")?.textContent);
      if (!product) return;
      line.append(noteField(product, true));
    });
  };

  const localPhone = value => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("593")) return `0${digits.slice(3, 12)}`;
    if (digits.length === 9 && !digits.startsWith("0")) return `0${digits}`;
    return digits.slice(0, 10);
  };

  const enhanceReview = () => {
    document.querySelectorAll("#orderReview .review-order-line").forEach(line => {
      const nameNode = line.querySelector("span");
      if (!nameNode || nameNode.querySelector(".item-note-review")) return;
      const product = productByName(nameNode.childNodes[0]?.textContent || nameNode.textContent);
      const note = product ? itemNote(product.id).trim() : "";
      if (!note) return;
      const detail = document.createElement("small");
      detail.className = "item-note-review";
      detail.textContent = `Observación: ${note}`;
      nameNode.append(detail);
    });

    const whatsapp = [...document.querySelectorAll("#orderReview .review-contact span")].find(node => node.textContent.trim().startsWith("WhatsApp:"));
    if (whatsapp) {
      const digits = whatsapp.textContent.replace(/\D/g, "");
      whatsapp.textContent = `WhatsApp: ${localPhone(digits)}`;
    }
  };

  const enhanceCheckout = () => {
    const phone = document.querySelector("#customerPhone");
    if (phone && !phone.dataset.localPhoneReady) {
      phone.dataset.localPhoneReady = "1";
      phone.placeholder = "099 123 4567";
      phone.maxLength = 10;
      phone.setAttribute("inputmode", "numeric");
      phone.addEventListener("input", () => {
        const local = localPhone(phone.value);
        if (phone.value !== local) phone.value = local;
      });
    }

    document.querySelectorAll("#checkoutForm input, #checkoutForm textarea").forEach(field => {
      if (field.dataset.focusComfortReady) return;
      field.dataset.focusComfortReady = "1";
      field.addEventListener("focus", () => {
        setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 220);
      });
    });
  };

  const injectProviderNotes = () => {
    const title = document.querySelector("#orderModalTitle")?.textContent?.trim();
    const content = document.querySelector("#orderModalContent");
    if (!title || !content) return;
    const order = runtime.orders.find(item => String(item.order_number || "") === title);
    if (!order || !Array.isArray(order.items)) return;
    content.querySelectorAll(".order-detail-item").forEach((row, index) => {
      if (row.querySelector(".item-note-provider")) return;
      const note = String(order.items[index]?.item_note || "").trim();
      if (!note) return;
      const copy = row.querySelector("span");
      if (!copy) return;
      const detail = document.createElement("small");
      detail.className = "item-note-provider";
      detail.textContent = `Observación del cliente: ${note}`;
      copy.append(detail);
    });
  };

  const enhanceUploadGuidance = () => {
    const input = document.querySelector("#productImage");
    const label = input?.closest("label");
    const helper = label?.querySelector("small");
    if (!helper || helper.dataset.photoGuideReady) return;
    helper.dataset.photoGuideReady = "1";
    helper.textContent = "Ideal: foto cuadrada 1:1, mínimo 1200×1200 · JPG, PNG o WebP · máximo 5 MB";
  };

  const setupSwipe = sheet => {
    if (!sheet || runtime.sheetGestureReady.has(sheet)) return;
    const handle = sheet.querySelector(".sheet-handle");
    if (!handle) return;
    runtime.sheetGestureReady.add(sheet);

    let startY = 0;
    let delta = 0;
    let tracking = false;

    const reset = () => {
      tracking = false;
      delta = 0;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
    };

    handle.addEventListener("touchstart", event => {
      if (!matchMedia("(max-width: 759px)").matches || !sheet.classList.contains("visible")) return;
      startY = event.touches[0].clientY;
      delta = 0;
      tracking = true;
      sheet.classList.add("is-dragging");
    }, { passive: true });

    handle.addEventListener("touchmove", event => {
      if (!tracking) return;
      delta = Math.max(0, event.touches[0].clientY - startY);
      sheet.style.transform = `translateY(${Math.min(delta, 360)}px)`;
      if (delta > 2) event.preventDefault();
    }, { passive: false });

    handle.addEventListener("touchend", () => {
      if (!tracking) return;
      if (delta >= 88) {
        sheet.style.removeProperty("transform");
        sheet.classList.remove("is-dragging");
        sheet.querySelector("[data-close-sheet]")?.click();
        tracking = false;
        delta = 0;
      } else reset();
    }, { passive: true });

    handle.addEventListener("touchcancel", reset, { passive: true });
  };

  const enhanceSheets = () => {
    document.querySelectorAll(".bottom-sheet").forEach(setupSwipe);
  };

  const enhance = () => {
    runtime.frame = 0;
    enhanceProductSheet();
    enhanceCartLines();
    enhanceReview();
    enhanceCheckout();
    injectProviderNotes();
    enhanceUploadGuidance();
    enhanceSheets();
  };

  const scheduleEnhance = () => {
    if (runtime.frame) return;
    runtime.frame = requestAnimationFrame(enhance);
  };

  document.addEventListener("click", event => {
    const trigger = event.target.closest?.("[data-open-product],[data-search-product]");
    if (trigger) runtime.activeProductId = trigger.dataset.openProduct || trigger.dataset.searchProduct || "";
    scheduleEnhance();
  }, true);

  document.addEventListener("focusin", event => {
    if (event.target.matches?.("#checkoutForm input, #checkoutForm textarea")) {
      setTimeout(() => event.target.scrollIntoView({ block: "center", behavior: "smooth" }), 220);
    }
  });

  const observer = new MutationObserver(scheduleEnhance);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    enhance();
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
