/* Hakuna Panel 10.11 UI — easy sale modes, independent prices, stock helper and presentation promos. */
(() => {
  "use strict";
  if (window.__hm111Ui) return;
  window.__hm111Ui = true;
  if (!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname)) return;
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)],
    money = (n) =>
      new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(Number(n || 0));
  let raf = 0;
  function saved(id) {
    return (
      (window.__hm111Presentations || []).find(
        (p) => String(p.id) === String(id),
      ) || null
    );
  }
  function rowInfo(r) {
    return {
      name: $("[data-p-name]", r)?.value.trim() || "Presentación",
      units: Math.max(1, Number($("[data-p-units]", r)?.value || 1)),
      price: Math.max(0, Number($("[data-p-price]", r)?.value || 0)),
    };
  }
  function hydrateTools(r) {
    const p = saved(r.dataset.id);
    if (!p) return;
    const v = $("[data-hm-visible]", r),
      pr = $("[data-hm-promo]", r),
      pp = $("[data-hm-promo-price]", r),
      pl = $("[data-hm-promo-label]", r),
      fields = $(".hm111-promo-fields", r);
    if (v) v.checked = p.visible !== false;
    if (pr) pr.checked = p.promo_active === true;
    if (pp) pp.value = p.promo_price ?? "";
    if (pl) pl.value = p.promo_label || "Oferta";
    if (fields) fields.hidden = !pr?.checked;
  }
  function enhanceRow(r) {
    if (r.dataset.hm111) return;
    r.dataset.hm111 = "1";
    r.classList.add("hm111-presentation-card");
    const tools = document.createElement("div");
    tools.className = "hm111-presentation-tools";
    tools.innerHTML =
      '<label class="hm111-toggle"><input data-hm-visible type="checkbox" checked><span></span><b>Vender</b></label><label class="hm111-toggle promo"><input data-hm-promo type="checkbox"><span></span><b>Oferta</b></label><div class="hm111-promo-fields" hidden><label>Precio oferta<input data-hm-promo-price type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></label><label>Etiqueta<input data-hm-promo-label maxlength="40" value="Oferta"></label></div><div class="hm111-price-summary"><span>Equivale a</span><b data-hm-unit-price>—</b><small>por unidad base</small></div>';
    r.append(tools);
    hydrateTools(r);
    const promo = $("[data-hm-promo]", r),
      fields = $(".hm111-promo-fields", r);
    promo.onchange = () => {
      fields.hidden = !promo.checked;
      if (promo.checked && !$("[data-hm-promo-price]", r).value) {
        const n = rowInfo(r).price;
        $("[data-hm-promo-price]", r).value = n
          ? String(Math.max(0, Math.round(n * 0.9 * 100) / 100))
          : "";
      }
    };
    const calc = () => {
      $("[data-hm-unit-price]", r).textContent =
        `${money(rowInfo(r).price / rowInfo(r).units)} × unidad`;
      syncStock();
    };
    ["[data-p-units]", "[data-p-price]"].forEach((s) =>
      $(s, r)?.addEventListener("input", calc),
    );
    calc();
  }
  function addRow() {
    const n = $$(".v5-presentation-row").length;
    $("#v5AddPresentation")?.click();
    const rows = $$(".v5-presentation-row");
    return rows.length > n ? rows.at(-1) : null;
  }
  function unitRow() {
    return $$(".v5-presentation-row").find((r) => rowInfo(r).units === 1);
  }
  function packRow() {
    return $$(".v5-presentation-row").find((r) => rowInfo(r).units > 1);
  }
  function setVisible(r, on) {
    const e = $("[data-hm-visible]", r);
    if (e) e.checked = on;
  }
  function ensureUnit() {
    let r = unitRow();
    if (!r) {
      r = addRow();
      if (r) {
        $("[data-p-name]", r).value = "Unidad";
        $("[data-p-units]", r).value = "1";
        $("[data-p-unit]", r).value = $("#v5BaseUnit")?.value || "unidad";
        const p = packRow();
        if (p)
          $("[data-p-price]", r).value = String(
            Math.round((rowInfo(p).price / rowInfo(p).units) * 100) / 100,
          );
      }
      schedule();
    }
    setVisible(r, true);
    return r;
  }
  function ensurePack() {
    let r = packRow();
    if (!r) {
      r = addRow();
      if (r) {
        $("[data-p-name]", r).value = "Caja x 12";
        $("[data-p-units]", r).value = "12";
        $("[data-p-unit]", r).value = $("#v5BaseUnit")?.value || "unidad";
      }
      schedule();
    }
    setVisible(r, true);
    return r;
  }
  function applyMode(m) {
    if (m === "unit") {
      const u = ensureUnit();
      $$(".v5-presentation-row").forEach((r) => setVisible(r, r === u));
    } else if (m === "pack") {
      const p = ensurePack();
      $$(".v5-presentation-row").forEach((r) =>
        setVisible(r, r === p || rowInfo(r).units > 1),
      );
    } else {
      ensureUnit();
      ensurePack();
      $$(".v5-presentation-row").forEach((r) => setVisible(r, true));
    }
  }
  function ensureMode() {
    const ed = $("#v5ProductEditor");
    if (!ed || $("#hm111SaleMode")) return;
    const b = document.createElement("section");
    b.id = "hm111SaleMode";
    b.className = "hm111-sale-mode";
    b.innerHTML =
      '<div><small>CÓMO LO VENDES</small><h3>Elige las presentaciones</h3><p>Unidad, caja o ambas. Cada presentación tiene su propio precio.</p></div><div class="hm111-mode-actions"><button data-m="unit" type="button">Solo unidad</button><button data-m="both" type="button">Unidad + caja</button><button data-m="pack" type="button">Solo caja / jaba</button></div>';
    ed.insertBefore(b, $(".v5-presentations", ed));
    b.onclick = (e) => {
      const x = e.target.closest("[data-m]");
      if (x) applyMode(x.dataset.m);
    };
  }
  function ensureQuick() {
    const h = $(".v5-presentations-head");
    if (!h || $("#hm111Quick")) return;
    const w = document.createElement("div");
    w.id = "hm111Quick";
    w.className = "hm111-quick";
    w.innerHTML =
      '<button data-add="unit" type="button">+ Unidad</button><button data-add="pack" type="button">+ Caja / jaba / pack</button>';
    h.append(w);
    w.onclick = (e) => {
      const x = e.target.closest("[data-add]");
      if (!x) return;
      x.dataset.add === "unit" ? ensureUnit() : ensurePack();
      schedule();
    };
  }
  function ensureStock() {
    const ed = $("#v5ProductEditor");
    if (!ed || $("#hm111Stock")) return;
    const g = $(".v5-stock-grid", ed);
    if (!g) return;
    const b = document.createElement("section");
    b.id = "hm111Stock";
    b.className = "hm111-stock-helper";
    b.innerHTML =
      '<div class="hm111-stock-title"><div><small>STOCK FÁCIL</small><b>¿Cuánto tienes?</b><p>Ejemplo: 200 jabas x9 = 1.800 unidades reales.</p></div></div><div class="hm111-stock-fields"><label>Lo cuento por<select id="hm111StockPresentation"></select></label><label>Cantidad<input id="hm111Packs" type="number" min="0" step="1" value="0"></label><label>Sueltas<input id="hm111Loose" type="number" min="0" step="1" value="0"></label></div><div class="hm111-stock-result"><span>Stock total</span><strong id="hm111Total">0</strong><small id="hm111StockLabel">unidades</small></div>';
    g.after(b);
    ["#hm111StockPresentation", "#hm111Packs", "#hm111Loose"].forEach((s) =>
      $(s, b).addEventListener("input", applyStock),
    );
  }
  function syncStock() {
    const b = $("#hm111Stock");
    if (!b) return;
    const sel = $("#hm111StockPresentation", b),
      prev = sel.value,
      rows = $$(".v5-presentation-row");
    const options = rows
      .map(
        (r, i) =>
          `<option value="${i}">${rowInfo(r).name} · ${rowInfo(r).units}</option>`,
      )
      .join("");
    if (sel.innerHTML !== options) sel.innerHTML = options;
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
    const i = Number(sel.value || 0),
      u = rowInfo(rows[i] || rows[0]).units,
      q = Math.max(0, Number($("#v5StockQuantity")?.value || 0));
    $("#hm111Packs", b).value = String(Math.floor(q / u));
    $("#hm111Loose", b).value = String(q % u);
    renderStock(q);
  }
  function applyStock() {
    const b = $("#hm111Stock");
    if (!b) return;
    const rows = $$(".v5-presentation-row"),
      i = Number($("#hm111StockPresentation", b).value || 0),
      u = rowInfo(rows[i] || rows[0]).units,
      p = Math.max(0, Math.trunc(Number($("#hm111Packs", b).value || 0))),
      l = Math.max(0, Math.trunc(Number($("#hm111Loose", b).value || 0))),
      q = p * u + l;
    if ($("#v5StockQuantity")) $("#v5StockQuantity").value = String(q);
    if ($("#v5StockTracking")) {
      $("#v5StockTracking").checked = true;
      $("#v5StockTracking").dispatchEvent(
        new Event("change", { bubbles: true }),
      );
    }
    renderStock(q);
  }
  function renderStock(q) {
    const total = $("#hm111Total"),
      totalText = Number(q || 0).toLocaleString("es-EC"),
      label = $("#hm111StockLabel"),
      labelText = $("#v5BaseUnit")?.value || "unidades";
    if (total && total.textContent !== totalText) total.textContent = totalText;
    if (label && label.textContent !== labelText) label.textContent = labelText;
  }
  function hideLegacy() {
    ["#productPrice", "#productComparePrice", "#productUnit"].forEach((s) =>
      $(s)?.closest(".field")?.classList.add("hm111-legacy-hidden"),
    );
    const note = $(".v5-presentation-note"),
      noteText =
        "Cada presentación tiene su propio precio. Puedes vender solo caja, solo unidad o ambas.";
    if (note && note.textContent !== noteText) note.textContent = noteText;
  }
  function enhance() {
    const m = $("#productModal");
    if (!m || m.hidden) return;
    m.classList.add("hm111-editor");
    ensureMode();
    ensureQuick();
    ensureStock();
    hideLegacy();
    $$(".v5-presentation-row").forEach(enhanceRow);
    syncStock();
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      enhance();
    });
  }
  document.addEventListener(
    "click",
    (e) => {
      if (
        e.target.closest?.(
          '[data-edit-product],#newProductBtn,#mobileCreateBtn,[data-quick="new-product"],#v5AddPresentation,.v5-remove-presentation',
        )
      )
        setTimeout(schedule, 25);
    },
    true,
  );
  window.addEventListener("hm111:presentations", schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
})();
