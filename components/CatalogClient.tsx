"use client";

import { FormEvent,useEffect,useMemo,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase,makeId,saveLocalDatabase,type MasterProduct,type TenantProduct } from "@/lib/local-store";
import styles from "./CatalogClient.module.css";

type ViewMode="mine"|"catalog";
type StockFilter="all"|"low";
type EditorState=
  |{kind:"new"}
  |{kind:"edit";product:TenantProduct}
  |{kind:"catalog";master:MasterProduct}
  |null;

const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const compactNumber=(value:number)=>new Intl.NumberFormat("es-EC",{maximumFractionDigits:3}).format(value||0);

export function CatalogClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[query,setQuery]=useState("");
  const[mode,setMode]=useState<ViewMode>("mine");
  const[stockFilter,setStockFilter]=useState<StockFilter>("all");
  const[editor,setEditor]=useState<EditorState>(null);
  const[message,setMessage]=useState("");
  const[error,setError]=useState("");

  useEffect(()=>setDb(loadLocalDatabase()),[]);
  if(!db)return <div className="loading-card">Preparando tus productos…</div>;

  const ctx=getWorkspaceContext(db);
  const products=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&product.active);
  const activeIds=new Set(products.map(product=>product.masterProductId));
  const normalizedQuery=query.trim().toLowerCase();
  const lowStock=products.filter(product=>product.stock<=5);
  const totalUnits=products.reduce((sum,product)=>sum+Number(product.stock||0),0);
  const inventoryValue=products.reduce((sum,product)=>sum+(Number(product.stock||0)*Number(product.cost||0)),0);

  const visibleProducts=products
    .filter(product=>stockFilter==="all"||product.stock<=5)
    .filter(product=>!normalizedQuery||`${product.name} ${product.barcode}`.toLowerCase().includes(normalizedQuery));
  const visibleMasters=db.masterProducts.filter(product=>!normalizedQuery||`${product.barcode} ${product.name} ${product.brand} ${product.presentation} ${product.category}`.toLowerCase().includes(normalizedQuery));

  const openNew=()=>{setEditor({kind:"new"});setError("");setMessage("")};
  const openCatalog=(master:MasterProduct)=>{setEditor({kind:"catalog",master});setError("");setMessage("")};
  const openEdit=(product:TenantProduct)=>{setEditor({kind:"edit",product});setError("");setMessage("")};
  const closeEditor=()=>{setEditor(null);setError("")};

  const editorValues=useMemo(()=>{
    if(!editor)return null;
    if(editor.kind==="edit")return{barcode:editor.product.barcode,name:editor.product.name,cost:editor.product.cost,price:editor.product.price,stock:editor.product.stock};
    if(editor.kind==="catalog")return{barcode:editor.master.barcode,name:`${editor.master.name} ${editor.master.presentation}`.trim(),cost:0,price:0,stock:0};
    return{barcode:"",name:"",cost:0,price:0,stock:0};
  },[editor]);

  const saveProduct=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!ctx.branchId||!editor)return;
    const form=new FormData(event.currentTarget);
    const name=String(form.get("name")||"").trim();
    const rawBarcode=String(form.get("barcode")||"").trim();
    const cost=Number(form.get("cost")||0);
    const price=Number(form.get("price")||0);
    const stock=Number(form.get("stock")||0);
    if(!name){setError("Ponle un nombre al producto para poder guardarlo.");return}
    if(!Number.isFinite(cost)||!Number.isFinite(price)||!Number.isFinite(stock)||cost<0||price<0||stock<0){setError("Costo, precio y stock deben ser valores válidos y no negativos.");return}

    const next=loadLocalDatabase();
    const editingId=editor.kind==="edit"?editor.product.id:"";
    const generatedCode=`SKU-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const barcode=rawBarcode||generatedCode;
    const duplicate=next.tenantProducts.find(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&product.id!==editingId&&product.barcode.toLowerCase()===barcode.toLowerCase());
    if(duplicate){setError(`Ya existe un producto con el código ${barcode} en esta sucursal.`);return}

    if(editor.kind==="edit"){
      const index=next.tenantProducts.findIndex(product=>product.id===editor.product.id);
      if(index<0){setError("No pudimos encontrar ese producto. Recarga KIUBO e inténtalo otra vez.");return}
      next.tenantProducts[index]={...next.tenantProducts[index],barcode,name,cost,price,stock,active:true};
    }else{
      const id=makeId("tp");
      const masterProductId=editor.kind==="catalog"?editor.master.id:`custom-${id}`;
      next.tenantProducts.push({id,tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId,barcode,name,cost,price,stock,active:true});
    }

    saveLocalDatabase(next);
    setDb(next);
    setMode("mine");
    setStockFilter("all");
    setQuery("");
    setEditor(null);
    setError("");
    setMessage(editor.kind==="edit"?`${name} quedó actualizado.`:`${name} ya está listo en ${ctx.branch?.name??"esta sucursal"}.`);
  };

  const archiveProduct=()=>{
    if(!editor||editor.kind!=="edit")return;
    if(typeof window!=="undefined"&&!window.confirm(`¿Archivar ${editor.product.name}? Dejará de aparecer para vender.`))return;
    const next=loadLocalDatabase();
    const index=next.tenantProducts.findIndex(product=>product.id===editor.product.id);
    if(index<0)return;
    next.tenantProducts[index]={...next.tenantProducts[index],active:false};
    saveLocalDatabase(next);
    setDb(next);
    setEditor(null);
    setMessage(`${editor.product.name} fue archivado.`);
  };

  const stockBadge=(stock:number)=>{
    const className=stock<=0?`${styles.stock} ${styles.stockOut}`:stock<=5?`${styles.stock} ${styles.stockLow}`:styles.stock;
    const label=stock<=0?"Sin stock":stock<=5?`${compactNumber(stock)} · bajo`:`${compactNumber(stock)} en stock`;
    return <span className={className}>{label}</span>;
  };

  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.kicker}>KIUBO PRODUCTOS</span>
        <h1>Tus productos, sin complicaciones.</h1>
        <p>Crea un producto en segundos o encuéntralo en el catálogo KIUBO. Precio, costo y stock quedan separados por sucursal.</p>
      </div>
      <button className={styles.primaryAction} type="button" onClick={openNew}>＋ Nuevo producto</button>
    </section>

    <section className={styles.workspace}>
      <div className={styles.workspaceMain}><div className={styles.workspaceIcon}>▦</div><div className={styles.workspaceText}><span>ESTÁS TRABAJANDO EN</span><strong>{ctx.tenant?.name??"Negocio"} · {ctx.branch?.code??"001"} {ctx.branch?.name??"Matriz"}</strong></div></div>
      <span className={styles.workspaceBadge}>Cambios de esta sucursal</span>
    </section>

    <section className={styles.summary}>
      <div className={styles.summaryCard}><span>Productos activos</span><strong>{products.length}</strong></div>
      <div className={styles.summaryCard}><span>Unidades en stock</span><strong>{compactNumber(totalUnits)}</strong></div>
      <div className={styles.summaryCard}><span>Valor a costo</span><strong>{money(inventoryValue)}</strong></div>
    </section>

    <section className={styles.toolbar}>
      <div className={styles.toolbarTop}>
        <div className={styles.searchWrap}><span className={styles.searchIcon}>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={mode==="mine"?"Buscar por nombre o código…":"Buscar en catálogo KIUBO…"}/></div>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${mode==="mine"?styles.tabActive:""}`} onClick={()=>{setMode("mine");setQuery("");setEditor(null)}}>Mis productos · {products.length}</button>
          <button type="button" className={`${styles.tab} ${mode==="catalog"?styles.tabActive:""}`} onClick={()=>{setMode("catalog");setQuery("");setEditor(null)}}>Catálogo KIUBO</button>
        </div>
      </div>
      {mode==="mine"&&<div className={styles.filters}><button type="button" className={`${styles.filter} ${stockFilter==="all"?styles.filterActive:""}`} onClick={()=>setStockFilter("all")}>Todos</button><button type="button" className={`${styles.filter} ${stockFilter==="low"?styles.filterActive:""}`} onClick={()=>setStockFilter("low")}>Stock bajo · {lowStock.length}</button></div>}
    </section>

    {message&&<div className={styles.notice}>✓ {message} Se sincronizará con KIUBO Cloud automáticamente.</div>}

    <section className={styles.layout}>
      <div className={styles.listPanel}>
        <div className={styles.panelHead}><div><span>{mode==="mine"?"INVENTARIO DE SUCURSAL":"CATÁLOGO ASISTIDO"}</span><h2>{mode==="mine"?"Mis productos":"Encuentra y agrega más rápido"}</h2></div><span className={styles.count}>{mode==="mine"?visibleProducts.length:visibleMasters.length}</span></div>
        {mode==="mine"?<div className={styles.productList}>
          {visibleProducts.map(product=><button key={product.id} type="button" className={styles.productRow} onClick={()=>openEdit(product)}><span className={styles.avatar}>{product.name.charAt(0).toUpperCase()}</span><span className={styles.productMain}><strong>{product.name}</strong><span>{product.barcode} · costo {money(product.cost)}</span></span><span className={styles.price}><strong>{money(product.price)}</strong><span>precio de venta</span></span>{stockBadge(product.stock)}</button>)}
          {!visibleProducts.length&&<div className={styles.empty}><div className={styles.emptyIcon}>＋</div><h3>{products.length?"No encontramos productos":"Crea tu primer producto"}</h3><p>{products.length?"Prueba con otro nombre, código o cambia el filtro.":"Solo necesitamos nombre, precio y stock. En menos de un minuto ya podrás venderlo."}</p>{!products.length&&<button className={styles.primaryAction} type="button" onClick={openNew}>Crear primer producto</button>}</div>}
        </div>:<div className={styles.catalogList}>
          {visibleMasters.map(master=><button key={master.id} type="button" className={styles.catalogRow} disabled={activeIds.has(master.id)} onClick={()=>openCatalog(master)}><span className={styles.avatar}>{master.name.charAt(0).toUpperCase()}</span><span className={styles.catalogInfo}><strong>{master.name}</strong><span>{master.brand} · {master.presentation} · {master.category}</span><small>{master.barcode}</small></span><span className={styles.addTag}>{activeIds.has(master.id)?"Ya activo":"＋ Agregar"}</span></button>)}
          {!visibleMasters.length&&<div className={styles.empty}><div className={styles.emptyIcon}>⌕</div><h3>No está en el catálogo</h3><p>No pasa nada. Puedes crear el producto tú mismo y KIUBO lo guardará para tu negocio.</p><button className={styles.primaryAction} type="button" onClick={openNew}>Crear manualmente</button></div>}
        </div>}
      </div>

      {editor&&editorValues?<aside className={styles.editor}>
        <div className={styles.editorTop}><div><span className={styles.kicker}>{editor.kind==="edit"?"EDITAR PRODUCTO":editor.kind==="catalog"?"AGREGAR DEL CATÁLOGO":"NUEVO PRODUCTO"}</span><h2>{editor.kind==="edit"?"Ajusta lo necesario":editor.kind==="catalog"?editor.master.name:"Vamos a crearlo"}</h2><p>{editor.kind==="edit"?"Los cambios quedarán en esta sucursal.":"Pide solo lo esencial. Después podrás cambiarlo cuando quieras."}</p></div><button className={styles.close} type="button" onClick={closeEditor} aria-label="Cerrar">×</button></div>
        {error&&<div className={`${styles.notice} ${styles.noticeError}`}>{error}</div>}
        <form className={styles.form} onSubmit={saveProduct} key={`${editor.kind}-${editor.kind==="edit"?editor.product.id:editor.kind==="catalog"?editor.master.id:"new"}`}>
          <label>Nombre del producto<input name="name" defaultValue={editorValues.name} autoFocus placeholder="Ej. Coca-Cola 500 ml"/><span className={styles.fieldHint}>Es lo que verás al vender.</span></label>
          <label>Código de barras / código interno<input name="barcode" defaultValue={editorValues.barcode} placeholder="Escanea o déjalo vacío"/><span className={styles.fieldHint}>Si lo dejas vacío, KIUBO crea uno interno.</span></label>
          <div className={styles.formGrid}><label>Costo<input name="cost" type="number" min="0" step="0.0001" defaultValue={editorValues.cost}/></label><label>Precio de venta<input name="price" type="number" min="0" step="0.01" defaultValue={editorValues.price}/></label></div>
          <label>Stock inicial<input name="stock" type="number" min="0" step="0.001" defaultValue={editorValues.stock}/><span className={styles.fieldHint}>También puedes empezar en 0 y recibir mercadería después.</span></label>
          <button className={styles.save} type="submit">{editor.kind==="edit"?"Guardar cambios":"Guardar producto"}</button>
          <button className={styles.secondary} type="button" onClick={closeEditor}>Cancelar</button>
          {editor.kind==="edit"&&<button className={styles.danger} type="button" onClick={archiveProduct}>Archivar producto</button>}
        </form>
      </aside>:<aside className={styles.editor}>
        <div className={styles.editorTop}><div><span className={styles.kicker}>RUTA RÁPIDA</span><h2>De producto a venta</h2><p>KIUBO está pensado para que alguien nuevo entienda el flujo sin capacitación larga.</p></div></div>
        <div className={styles.steps}><div className={styles.step}><b>1</b><strong>Crea o encuentra</strong><span>Nombre o código. Nada más para empezar.</span></div><div className={styles.step}><b>2</b><strong>Pon precio y stock</strong><span>Quedan guardados por sucursal.</span></div><div className={styles.step}><b>3</b><strong>Vende</strong><span>El producto aparecerá en Ventas / POS.</span></div></div>
        <button className={styles.save} type="button" onClick={openNew}>＋ Crear producto ahora</button>
      </aside>}
    </section>
  </div>;
}
