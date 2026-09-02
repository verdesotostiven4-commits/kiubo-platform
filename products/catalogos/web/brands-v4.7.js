(() => {
  const config = window.KIUBO_CATALOG_CONFIG;
  if (!config?.apiUrl) return;

  const isPanel = /^\/(panel|master)(?:\/|$)/.test(location.pathname);
  const slug = (new URLSearchParams(location.search).get("slug") || location.pathname.match(/^\/c\/([^/]+)/)?.[1] || config.defaultSlug || "hakuna-matata").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const nativeFetch = window.fetch.bind(window);
  const state = { products: [], categories: [], activeBrand: "all", mode: "category", frame: 0 };
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const visible = () => state.products.filter(p => p.visible !== false && !p.archived_at);
  const productById = id => state.products.find(p => String(p.id) === String(id));
  const categoryName = p => state.categories.find(c => String(c.id) === String(p?.category_id))?.name || p?.category_name || "Otros";
  const brands = () => {
    const map = new Map();
    visible().forEach(p => { const name = String(p.brand || "").trim(); if (!name) return; const key = norm(name); if (!map.has(key)) map.set(key,{key,name,count:0}); map.get(key).count++; });
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"es",{sensitivity:"base"}));
  };

  function capture(action,payload){
    if(!payload || !["catalog_bootstrap","provider_bootstrap","master_bootstrap"].includes(action)) return;
    if(Array.isArray(payload.products)) state.products=payload.products;
    if(Array.isArray(payload.categories)) state.categories=payload.categories;
    schedule();
  }

  window.fetch=async(input,init={})=>{
    const url=typeof input==="string"?input:input?.url||""; let action="";
    if(url===config.apiUrl && typeof init?.body==="string") try{action=JSON.parse(init.body)?.action||""}catch{}
    const response=await nativeFetch(input,init);
    if(url===config.apiUrl && action) try{capture(action,await response.clone().json())}catch{}
    return response;
  };

  async function hydrate(){
    if(state.products.length) return;
    try{
      const action=isPanel?"provider_bootstrap":"catalog_bootstrap";
      const headers={"Content-Type":"application/json","x-client-version":config.version||"4.7.0"};
      if(isPanel){const token=sessionStorage.getItem(`kiubo-provider-session:${slug}`);if(!token)return;headers["x-provider-session"]=token;}
      const r=await nativeFetch(config.apiUrl,{method:"POST",headers,body:JSON.stringify({action,slug})});
      if(r.ok) capture(action,await r.json());
    }catch{}
  }

  function ensureBrowseControls(){
    if(isPanel) return;
    const cats=document.querySelector("#categoryScroller");
    if(!cats || document.querySelector("#catalogBrowseModes")) return;
    const wrap=document.createElement("div"); wrap.id="catalogBrowseModes"; wrap.className="catalog-browse-modes";
    wrap.innerHTML=`<div><strong>Explorar catálogo</strong><small>Ordenado por secciones</small></div><div class="catalog-browse-modes__switch" role="tablist"><button type="button" class="active" data-mode="category" aria-selected="true">Categorías</button><button type="button" data-mode="brand" aria-selected="false">Marcas</button></div>`;
    const brand=document.createElement("div"); brand.id="brandScroller"; brand.className="category-scroller brand-scroller"; brand.hidden=true;
    cats.parentNode.insertBefore(wrap,cats); cats.parentNode.insertBefore(brand,cats.nextSibling);
    wrap.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  }

  function renderBrands(){
    if(isPanel) return;
    const host=document.querySelector("#brandScroller"); if(!host) return;
    const items=brands();
    host.innerHTML=`<button class="category-chip ${state.activeBrand==="all"?"active":""}" data-brand="all">Todas</button>`+items.map(x=>`<button class="category-chip ${state.activeBrand===x.key?"active":""}" data-brand="${esc(x.key)}">${esc(x.name)} <small>${x.count}</small></button>`).join("");
    host.querySelectorAll("[data-brand]").forEach(b=>b.onclick=()=>{state.activeBrand=b.dataset.brand;renderBrands();applyBrandFilter();});
  }

  function setMode(mode){
    state.mode=mode;
    const cats=document.querySelector("#categoryScroller"), brand=document.querySelector("#brandScroller"), controls=document.querySelector("#catalogBrowseModes"); if(!cats||!brand||!controls)return;
    controls.querySelectorAll("[data-mode]").forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));});
    if(mode==="brand"){
      const all=cats.querySelector('[data-category="all"]'); if(all&&!all.classList.contains("active")) all.click();
      cats.hidden=true;brand.hidden=false;renderBrands();applyBrandFilter();
    }else{state.activeBrand="all";cats.hidden=false;brand.hidden=true;restoreCards();groupByCategory();}
  }

  function restoreCards(){document.querySelectorAll("#productGrid .brand-filter-hidden").forEach(x=>{x.classList.remove("brand-filter-hidden");x.removeAttribute("aria-hidden")});}

  function applyBrandFilter(){
    if(isPanel||state.mode!=="brand")return;
    ungroup(); let count=0;
    document.querySelectorAll("#productGrid [data-product-card]").forEach(card=>{const p=productById(card.dataset.productCard);const show=state.activeBrand==="all"||norm(p?.brand)===state.activeBrand;card.classList.toggle("brand-filter-hidden",!show);card.setAttribute("aria-hidden",String(!show));if(show)count++;});
    const label=document.querySelector("#resultCount"); if(label&&state.activeBrand!=="all"){const name=brands().find(x=>x.key===state.activeBrand)?.name||"Marca";label.textContent=`${count} producto${count===1?"":"s"} · ${name}`;}
  }

  function ungroup(){
    const grid=document.querySelector("#productGrid"); if(!grid)return;
    grid.querySelectorAll(":scope > .catalog-category-section").forEach(section=>{[...section.querySelectorAll(":scope > .catalog-category-products > [data-product-card]")].forEach(card=>grid.insertBefore(card,section));section.remove();});
    grid.classList.remove("category-sections");
  }

  function groupByCategory(){
    if(isPanel||state.mode!=="category")return;
    const grid=document.querySelector("#productGrid"); if(!grid||grid.getAttribute("aria-busy")==="true")return;
    if(grid.querySelector(":scope > .catalog-category-section"))return;
    const cards=[...grid.querySelectorAll(":scope > [data-product-card]")]; if(!cards.length)return;
    const groups=new Map();
    cards.forEach(card=>{const p=productById(card.dataset.productCard);const name=categoryName(p);const key=String(p?.category_id||name);if(!groups.has(key))groups.set(key,{name,cards:[]});groups.get(key).cards.push(card);});
    grid.classList.add("category-sections");
    groups.forEach(group=>{
      const section=document.createElement("section"); section.className="catalog-category-section";
      section.innerHTML=`<header class="catalog-category-title"><div><span>SECCIÓN</span><h3>${esc(group.name)}</h3></div><small>${group.cards.length} producto${group.cards.length===1?"":"s"}</small></header><div class="catalog-category-products"></div>`;
      const host=section.querySelector(".catalog-category-products"); group.cards.forEach(card=>host.append(card)); grid.append(section);
    });
  }

  function decorateCards(){
    if(isPanel)return;
    document.querySelectorAll("#productGrid [data-product-card]").forEach(card=>{const p=productById(card.dataset.productCard);const brand=String(p?.brand||"").trim();const cat=card.querySelector(".product-category");if(!cat)return;let mark=card.querySelector(".product-brand-mark");if(!brand){mark?.remove();return;}if(!mark){mark=document.createElement("span");mark.className="product-brand-mark";cat.insertAdjacentElement("afterend",mark);}mark.textContent=brand;});
  }

  function panelTools(){
    if(!isPanel)return;
    const input=document.querySelector("#productBrand"); if(!input)return;
    let list=document.querySelector("#productBrandSuggestions");if(!list){list=document.createElement("datalist");list.id="productBrandSuggestions";document.body.append(list);input.setAttribute("list",list.id);input.placeholder="Ej. Toni, Nestlé, Coca-Cola";}
    list.innerHTML=brands().map(x=>`<option value="${esc(x.name)}"></option>`).join("");
    const field=input.closest(".field")||input.parentElement;if(field&&!field.querySelector(".brand-field-help")){const help=document.createElement("small");help.className="brand-field-help";help.textContent="La marca ayuda a encontrar y organizar productos más rápido.";field.append(help);}
  }

  function enhance(){state.frame=0;if(isPanel){panelTools();return;}ensureBrowseControls();renderBrands();decorateCards();if(state.mode==="category"){restoreCards();groupByCategory();}else applyBrandFilter();}
  function schedule(){if(!state.frame)state.frame=requestAnimationFrame(enhance);}
  const observer=new MutationObserver(schedule);
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});hydrate();schedule();};
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start,{once:true});
})();
