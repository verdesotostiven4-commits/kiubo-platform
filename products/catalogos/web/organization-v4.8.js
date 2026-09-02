(() => {
  if (/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname)) return;

  const boot = () => {
    const grid = document.querySelector("#productGrid");
    if (!grid) return;

    let scheduled = 0;

    const visibleCategoryOrder = () =>
      [...document.querySelectorAll("#categoryScroller [data-category]")]
        .filter(button => button.dataset.category !== "all")
        .map(button => button.textContent.trim())
        .filter(Boolean);

    const buildHeader = (name, count) => {
      const header = document.createElement("header");
      header.className = "catalog-section-heading";

      const copy = document.createElement("div");
      const eyebrow = document.createElement("span");
      eyebrow.className = "catalog-section-eyebrow";
      eyebrow.textContent = "Sección";
      const title = document.createElement("h3");
      title.textContent = name;
      copy.append(eyebrow, title);

      const badge = document.createElement("span");
      badge.className = "catalog-section-count";
      badge.textContent = `${count} producto${count === 1 ? "" : "s"}`;
      header.append(copy, badge);
      return header;
    };

    const organize = () => {
      scheduled = 0;
      const cards = [...grid.children].filter(node => node.classList?.contains("product-card"));
      if (!cards.length) return;

      const groups = new Map();
      for (const card of cards) {
        const category = card.querySelector(".product-category")?.textContent?.trim() || "Otros";
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(card);
      }

      const categoryOrder = visibleCategoryOrder();
      const ordered = [
        ...categoryOrder.filter(name => groups.has(name)),
        ...[...groups.keys()].filter(name => !categoryOrder.includes(name))
      ];
      const isList = grid.classList.contains("list-grid");
      const fragment = document.createDocumentFragment();

      for (const name of ordered) {
        const products = groups.get(name) || [];
        if (!products.length) continue;
        const section = document.createElement("section");
        section.className = "catalog-section";
        section.dataset.catalogSection = name;
        section.append(buildHeader(name, products.length));

        const productsGrid = document.createElement("div");
        productsGrid.className = `catalog-section-grid${isList ? " list-grid" : ""}`;
        for (const card of products) productsGrid.append(card);
        section.append(productsGrid);
        fragment.append(section);
      }

      grid.replaceChildren(fragment);
      grid.classList.add("catalog-sections");
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(organize);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(grid, { childList: true, attributes: true, attributeFilter: ["class"] });

    const style = document.createElement("style");
    style.dataset.kiuboCatalogSections = "4.8";
    style.textContent = `
      #productGrid.catalog-sections{display:block!important}
      .catalog-section{display:grid;gap:13px;margin:0 0 30px;scroll-margin-top:120px}
      .catalog-section:last-child{margin-bottom:0}
      .catalog-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:2px 2px 0}
      .catalog-section-heading>div{display:grid;gap:2px;min-width:0}
      .catalog-section-eyebrow{font-size:9px;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:var(--brand-deep)}
      .catalog-section-heading h3{margin:0;color:var(--ink);font-size:clamp(21px,5vw,28px);line-height:1.05;letter-spacing:-.045em}
      .catalog-section-count{flex:0 0 auto;padding:6px 9px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.7);color:var(--muted);font-size:10px;font-weight:750}
      .catalog-section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .catalog-section-grid.list-grid{grid-template-columns:1fr}
      @media(min-width:760px){.catalog-section{margin-bottom:38px}.catalog-section-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.catalog-section-grid.list-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(min-width:1080px){.catalog-section-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    `;
    document.head.append(style);

    const improveSearchCopy = () => {
      const input = document.querySelector("#searchInput");
      if (input) input.placeholder = "Buscar producto, marca o categoría";
    };
    improveSearchCopy();
    schedule();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
