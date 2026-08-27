"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  getTenantSettings,
  getWorkspaceContext,
  loadLocalDatabase,
  makeId,
  saveLocalDatabase,
  type TenantProduct,
} from "@/lib/local-store";
import { getProductOptionConfig,type ProductOptionConfig } from "@/lib/product-options";
import { mediaSavings, uploadOptimizedMedia } from "@/lib/media-storage";
import styles from "./SafeCatalogClient.module.css";

type EditorState = { kind: "new" } | { kind: "edit"; id: string } | null;
type Draft = {
  name: string;
  category: string;
  barcode: string;
  cost: string;
  price: string;
  stock: string;
  imageUrl: string;
  optionEnabled:boolean;
  optionLabel:string;
  optionCount:string;
  optionSource:"category"|"custom";
  optionSourceCategory:string;
  optionValues:string;
  optionAllowRepeat:boolean;
};
type TextDraftField="name"|"category"|"barcode"|"cost"|"price"|"stock"|"imageUrl"|"optionLabel"|"optionCount"|"optionSourceCategory"|"optionValues";
type ConfigurableProduct=TenantProduct&{optionConfig?:ProductOptionConfig};

const blankDraft = (): Draft => ({
  name: "",
  category: "General",
  barcode: "",
  cost: "0",
  price: "0",
  stock: "0",
  imageUrl: "",
  optionEnabled:false,
  optionLabel:"Sabor",
  optionCount:"1",
  optionSource:"category",
  optionSourceCategory:"",
  optionValues:"",
  optionAllowRepeat:true,
});

const money = (value: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value || 0);

const cleanSingleLine = (value: string) =>
  value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

const parseOptions=(value:string)=>{
  const seen=new Set<string>();
  return value.split(/[\n,;]+/).map(cleanSingleLine).filter(option=>{const key=option.toLocaleLowerCase("es");if(!option||seen.has(key))return false;seen.add(key);return true});
};

export function SafeCatalogClient() {
  const [db, setDb] = useState<ReturnType<typeof loadLocalDatabase> | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => setDb(loadLocalDatabase()), []);

  if (!db) return <div className="loading-card">Preparando tus productos…</div>;

  const ctx = getWorkspaceContext(db);
  const settings = getTenantSettings(db, ctx.tenantId);
  const foodService = settings.businessType === "food_service";
  const products = db.tenantProducts.filter(
    (product) => product.tenantId === ctx.tenantId && product.branchId === ctx.branchId && product.active,
  );
  const categories = Array.from(
    new Set(products.map((product) => cleanSingleLine(product.category || "General")).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = products.filter(
    (product) =>
      !normalizedQuery ||
      `${product.name} ${product.barcode} ${product.category || ""}`.toLowerCase().includes(normalizedQuery),
  );
  const selectedProduct =
    editor?.kind === "edit" ? products.find((product) => product.id === editor.id) || null : null;
  const tracksStock = editor?.kind === "edit" ? selectedProduct?.trackStock !== false : !foodService;

  const change = (field: TextDraftField) => (event: ChangeEvent<HTMLInputElement>) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  const openNew = () => {
    setEditor({ kind: "new" });
    const base=blankDraft();
    setDraft({ ...base, category: categories[0] || "General",optionSourceCategory:categories[0]||"" });
    setError("");
    setMessage("");
    setFileInputKey((value) => value + 1);
  };

  const openEdit = (product: TenantProduct) => {
    const optionConfig=getProductOptionConfig(product);
    setEditor({ kind: "edit", id: product.id });
    setDraft({
      name: product.name || "",
      category: product.category || "General",
      barcode: product.barcode || "",
      cost: String(Number(product.cost || 0)),
      price: String(Number(product.price || 0)),
      stock: product.trackStock === false ? "0" : String(Number(product.stock || 0)),
      imageUrl: product.imageUrl || "",
      optionEnabled:Boolean(optionConfig),
      optionLabel:optionConfig?.label||"Sabor",
      optionCount:String(optionConfig?.selectionCount||1),
      optionSource:optionConfig?.source||"category",
      optionSourceCategory:optionConfig?.sourceCategory||categories[0]||"",
      optionValues:(optionConfig?.options||[]).join(", "),
      optionAllowRepeat:optionConfig?.allowRepeat!==false,
    });
    setError("");
    setMessage("");
    setFileInputKey((value) => value + 1);
  };

  const closeEditor = () => {
    setEditor(null);
    setDraft(blankDraft());
    setError("");
    setFileInputKey((value) => value + 1);
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !ctx.branchId || saving) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");

    try {
      const name = cleanSingleLine(draft.name);
      const category = cleanSingleLine(draft.category || "General") || "General";
      const rawBarcode = cleanSingleLine(draft.barcode);
      const cost = Number(draft.cost || 0);
      const price = Number(draft.price || 0);

      if (!name) throw new Error("Escribe el nombre del producto.");
      if (name.length > 160) throw new Error("El nombre puede tener máximo 160 caracteres.");
      if (rawBarcode.length > 96) throw new Error("El código puede tener máximo 96 caracteres.");
      if (!Number.isFinite(cost) || !Number.isFinite(price) || cost < 0 || price < 0)
        throw new Error("Costo y precio deben ser valores válidos y no negativos.");

      let optionConfig:ProductOptionConfig|undefined;
      if(draft.optionEnabled){
        const label=cleanSingleLine(draft.optionLabel)||"Opción",selectionCount=Math.max(1,Math.min(8,Math.floor(Number(draft.optionCount)||1)));
        if(draft.optionSource==="category"){
          const sourceCategory=cleanSingleLine(draft.optionSourceCategory);
          if(!sourceCategory)throw new Error("Elige la categoría de donde saldrán las opciones.");
          optionConfig={label,selectionCount,source:"category",sourceCategory,allowRepeat:draft.optionAllowRepeat};
        }else{
          const options=parseOptions(draft.optionValues);
          if(!options.length)throw new Error("Escribe al menos una opción disponible.");
          optionConfig={label,selectionCount,source:"custom",options,allowRepeat:draft.optionAllowRepeat};
        }
      }

      const next = loadLocalDatabase();
      const current =
        editor.kind === "edit" ? next.tenantProducts.find((product) => product.id === editor.id) : undefined;
      if (editor.kind === "edit" && !current)
        throw new Error("No encontramos ese producto. Recarga KIUBO e inténtalo otra vez.");

      const id = current?.id || makeId("tp");
      const barcode = rawBarcode || `SKU-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      const trackStock = current ? current.trackStock !== false : !foodService;
      const stock = trackStock ? Number(draft.stock || 0) : 1_000_000;
      if (!Number.isFinite(stock) || stock < 0) throw new Error("El stock debe ser un valor válido y no negativo.");

      const duplicate = next.tenantProducts.find(
        (product) =>
          product.tenantId === ctx.tenantId &&
          product.branchId === ctx.branchId &&
          product.id !== id &&
          (product.barcode || "").toLowerCase() === barcode.toLowerCase(),
      );
      if (duplicate) throw new Error(`Ya existe un producto con el código ${barcode}.`);

      let imageUrl = cleanSingleLine(draft.imageUrl);
      let imageMessage = "";
      const imageFile = form.get("imageFile");
      if (imageFile instanceof File && imageFile.size > 0) {
        const uploaded = await uploadOptimizedMedia({
          tenantId: ctx.tenantId,
          branchId: ctx.branchId,
          entityId: id,
          file: imageFile,
          kind: "product",
        });
        imageUrl = uploaded.url;
        imageMessage = ` Foto optimizada ${mediaSavings(uploaded.sourceBytes, uploaded.optimizedBytes)}% más liviana.`;
      }

      if (current) {
        const index = next.tenantProducts.findIndex((product) => product.id === current.id);
        next.tenantProducts[index] = {
          ...current,
          barcode,
          name,
          category,
          cost,
          price,
          stock,
          imageUrl: imageUrl || undefined,
          active: true,
          trackStock,
          optionConfig,
        } as ConfigurableProduct;
      } else {
        next.tenantProducts.push({
          id,
          tenantId: ctx.tenantId,
          branchId: ctx.branchId,
          masterProductId: `custom-${id}`,
          barcode,
          name,
          category,
          cost,
          price,
          stock,
          imageUrl: imageUrl || undefined,
          active: true,
          trackStock,
          optionConfig,
        } as ConfigurableProduct);
      }

      saveLocalDatabase(next);
      setDb(loadLocalDatabase());
      setEditor({ kind: "edit", id });
      setDraft({
        name,
        category,
        barcode,
        cost: String(cost),
        price: String(price),
        stock: trackStock ? String(stock) : "0",
        imageUrl,
        optionEnabled:Boolean(optionConfig),
        optionLabel:optionConfig?.label||"Sabor",
        optionCount:String(optionConfig?.selectionCount||1),
        optionSource:optionConfig?.source||"category",
        optionSourceCategory:optionConfig?.sourceCategory||categories[0]||"",
        optionValues:(optionConfig?.options||[]).join(", "),
        optionAllowRepeat:optionConfig?.allowRepeat!==false,
      });
      setFileInputKey((value) => value + 1);
      setMessage(`${name} quedó guardado.${imageMessage}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = () => {
    if (!selectedProduct) return;
    if (!window.confirm(`¿Archivar ${selectedProduct.name}? Dejará de aparecer para vender.`)) return;
    const next = loadLocalDatabase();
    const index = next.tenantProducts.findIndex((product) => product.id === selectedProduct.id);
    if (index < 0) return;
    next.tenantProducts[index] = { ...next.tenantProducts[index], active: false };
    saveLocalDatabase(next);
    setDb(loadLocalDatabase());
    setMessage(`${selectedProduct.name} fue archivado.`);
    closeEditor();
  };

  return (
    <div className={styles.page} data-allow-selection="true">
      <header className={styles.hero}>
        <div>
          <span className={styles.kicker}>PRODUCTOS</span>
          <h1>Tu catálogo, listo para vender.</h1>
          <p>Agrega, edita y sube fotografías sin ventanas flotantes ni bloqueos.</p>
        </div>
        <button className={styles.primary} type="button" onClick={openNew}>＋ Nuevo producto</button>
      </header>

      <section className={styles.workspaceBar}>
        <div>
          <span>ESTÁS TRABAJANDO EN</span>
          <strong>{ctx.tenant?.name ?? "Negocio"} · {ctx.branch?.code ?? "001"} {ctx.branch?.name ?? "Matriz"}</strong>
        </div>
        <span>{products.length} productos activos</span>
      </section>

      <section className={styles.toolbar}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, categoría o código…" />
      </section>

      {message && <div className={styles.success}>✓ {message} Se sincronizará automáticamente.</div>}
      {error && <div className={styles.error}>⚠ {error}</div>}

      <section className={styles.layout}>
        <div className={styles.listPanel}>
          <div className={styles.panelHead}><div><span>INVENTARIO DE SUCURSAL</span><h2>Mis productos</h2></div><b>{visibleProducts.length}</b></div>
          <div className={styles.productList}>
            {visibleProducts.map((product) => {const optionConfig=getProductOptionConfig(product);return (
              <button key={product.id} type="button" className={`${styles.productRow} ${editor?.kind === "edit" && editor.id === product.id ? styles.selected : ""}`} onClick={() => openEdit(product)}>
                <span className={styles.photo}>{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : product.name.charAt(0).toUpperCase()}</span>
                <span className={styles.productInfo}><strong>{product.name}</strong><small>{product.category || "General"} · {product.barcode}{optionConfig?` · pide ${optionConfig.selectionCount} ${optionConfig.label.toLowerCase()}${optionConfig.selectionCount>1?"s":""}`:""}</small></span>
                <span className={styles.productPrice}>{money(product.price)}</span>
                <span className={styles.stock}>{product.trackStock === false ? "Elaborado" : `${Number(product.stock || 0)} stock`}</span>
              </button>
            )})}
            {!visibleProducts.length && <div className={styles.empty}>No encontramos productos con esa búsqueda.</div>}
          </div>
        </div>

        <div className={styles.editorPanel} id="product-editor">
          <div className={styles.editorHead}>
            <div><span className={styles.kicker}>{editor?.kind === "edit" ? "EDITAR PRODUCTO" : "NUEVO PRODUCTO"}</span><h2>{editor ? (editor.kind === "edit" ? "Edita y guarda" : "Crea un producto") : "Editor de producto"}</h2><p>{editor ? "Todos los campos están aquí, incluida la foto." : "Pulsa “Nuevo producto” o selecciona uno de la lista."}</p></div>
            {editor && <button className={styles.close} type="button" onClick={closeEditor} aria-label="Cerrar editor">×</button>}
          </div>

          <form className={styles.form} onSubmit={saveProduct}>
            <label>Nombre del producto<input value={draft.name} onChange={change("name")} disabled={!editor || saving} maxLength={160} /></label>
            <label>Categoría<input value={draft.category} onChange={change("category")} disabled={!editor || saving} list="kiubo-product-categories" maxLength={80} placeholder="Ej. Yogurts"/><datalist id="kiubo-product-categories">{categories.map((category) => <option value={category} key={category} />)}</datalist></label>
            <label>Código de barras / código interno<input value={draft.barcode} onChange={change("barcode")} disabled={!editor || saving} maxLength={96} placeholder="Déjalo vacío para generar uno"/></label>
            <div className={styles.twoCols}><label>Costo<input type="number" min="0" step="0.0001" value={draft.cost} onChange={change("cost")} disabled={!editor || saving} /></label><label>Precio de venta<input type="number" min="0" step="0.01" value={draft.price} onChange={change("price")} disabled={!editor || saving} /></label></div>
            <label>{tracksStock ? "Stock" : "Stock · producto elaborado"}<input type="number" min="0" step="0.001" value={tracksStock ? draft.stock : "0"} onChange={change("stock")} disabled={!editor || saving || !tracksStock}/>{!tracksStock && <small className={styles.hint}>Se vende normalmente y no muestra un conteo unitario.</small>}</label>
            <label>Foto desde la laptop<input key={fileInputKey} name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" disabled={!editor || saving}/><small className={styles.hint}>Para YUKI: horizontal 4:3. KIUBO optimiza la imagen antes de subirla.</small></label>
            <label>O URL de imagen<input type="url" value={draft.imageUrl} onChange={change("imageUrl")} disabled={!editor || saving} placeholder="https://…"/></label>
            {editor && draft.imageUrl && <div className={styles.preview}><img src={draft.imageUrl} alt="Vista previa del producto" /></div>}

            <section style={{display:"grid",gap:10,padding:12,border:"1px solid #dfe8e3",borderRadius:16,background:"#f8fbf9"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><div><strong style={{display:"block",fontSize:11,color:"#264b3a"}}>Opciones al vender</strong><small className={styles.hint}>Para combos, sabores, tamaños o cualquier elección antes de agregar al carrito.</small></div><button className={styles.secondary} type="button" disabled={!editor||saving} onClick={()=>setDraft(current=>({...current,optionEnabled:!current.optionEnabled}))}>{draft.optionEnabled?"Desactivar":"Activar"}</button></div>
              {draft.optionEnabled&&<>
                <div className={styles.twoCols}><label>Nombre de la opción<input value={draft.optionLabel} onChange={change("optionLabel")} disabled={saving} placeholder="Ej. Yogur, sabor, tamaño"/></label><label>¿Cuántas debe elegir?<input type="number" min="1" max="8" step="1" value={draft.optionCount} onChange={change("optionCount")} disabled={saving}/></label></div>
                <label>De dónde salen las opciones<select value={draft.optionSource} onChange={event=>setDraft(current=>({...current,optionSource:event.target.value==="custom"?"custom":"category"}))} disabled={saving} style={{width:"100%",border:"1px solid #e0e6ed",borderRadius:12,padding:"11px 12px",background:"#fff"}}><option value="category">De una categoría de productos</option><option value="custom">Lista escrita aquí</option></select></label>
                {draft.optionSource==="category"?<label>Categoría de opciones<input value={draft.optionSourceCategory} onChange={change("optionSourceCategory")} disabled={saving} list="kiubo-option-categories" placeholder="Ej. Yogurts"/><datalist id="kiubo-option-categories">{categories.map(category=><option value={category} key={category}/>)}</datalist><small className={styles.hint}>Si agregas otro producto a esa categoría, aparecerá automáticamente como opción.</small></label>:<label>Opciones disponibles<input value={draft.optionValues} onChange={change("optionValues")} disabled={saving} placeholder="Mora, Fresa, Mango…"/><small className={styles.hint}>Sepáralas con comas. Cada negocio puede tener su propia lista.</small></label>}
                <label style={{display:"flex",gridTemplateColumns:"none",alignItems:"center",gap:8}}><input type="checkbox" checked={draft.optionAllowRepeat} onChange={event=>setDraft(current=>({...current,optionAllowRepeat:event.target.checked}))} disabled={saving} style={{width:16,height:16}}/>Permitir repetir la misma opción</label>
                <small className={styles.hint}>Ejemplo: un Combo 5 puede pedir 3 sabores. Solo cambia “3” aquí; no hace falta tocar código.</small>
              </>}
            </section>

            <button className={styles.save} type="submit" disabled={!editor || saving}>{saving ? "Guardando…" : editor?.kind === "edit" ? "Guardar cambios" : "Guardar producto"}</button>
            <button className={styles.secondary} type="button" onClick={closeEditor} disabled={!editor || saving}>Cancelar</button>
            <button className={styles.danger} type="button" onClick={archiveProduct} disabled={!selectedProduct || saving}>Archivar producto</button>
          </form>
        </div>
      </section>
    </div>
  );
}
