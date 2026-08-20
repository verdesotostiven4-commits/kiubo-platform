"use client";

import { FormEvent,useEffect,useState } from "react";
import { SaleRecord,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import {
  SRI_INVOICE_XSD_VERSION,
  SRI_TAX_OPTIONS,
  SRI_TECHNICAL_BASELINE,
  SriTaxProfile,
  buildInvoiceAccessKey,
  buyerIdType,
  numericCodeFromSeed,
  round2,
  runSriEngineSelfCheck,
  taxTotalsFromGross
} from "@/lib/sri-engine";
import {
  SriConfig,
  SriInvoiceRecord,
  getSriConfig,
  loadSriStore,
  persistInvoice,
  saveProductTax,
  saveSriConfig,
  sriSnapshot
} from "@/lib/sri-store";

const statusLabel:Record<SriInvoiceRecord["status"],string>={
  draft:"Borrador",
  ready_to_sign:"Lista para firmar",
  signed:"Firmada",
  sent:"Enviada",
  authorized:"Autorizada",
  rejected:"Rechazada",
  error:"Error"
};
const money=(n:number)=>`$${n.toFixed(2)}`;
const profileFromCode=(code:string)=>SRI_TAX_OPTIONS.find(option=>option.percentageCode===code);

function configErrors(config:SriConfig){
  const errors:string[]=[];
  if(!/^\d{13}$/.test(config.ruc))errors.push("RUC de 13 dígitos");
  if(!config.legalName.trim())errors.push("razón social");
  if(!config.matrixAddress.trim())errors.push("dirección matriz");
  if(!/^\d{3}$/.test(config.establishmentCode))errors.push("establecimiento de 3 dígitos");
  if(!/^\d{3}$/.test(config.emissionPointCode))errors.push("punto de emisión de 3 dígitos");
  return errors;
}

export function InvoicesClient(){
  const[config,setConfig]=useState<SriConfig|null>(null);
  const[refreshToken,setRefreshToken]=useState(0);
  const[message,setMessage]=useState("Factura lista para configurar");

  useEffect(()=>{
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
    setConfig(getSriConfig(ctx.tenantId,ctx.branchId));
  },[refreshToken]);

  if(!config)return <div className="loading-card">Preparando KIUBO Factura…</div>;

  const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),sri=sriSnapshot(ctx.tenantId,ctx.branchId),allSri=loadSriStore();
  const productsByKey=new Map<string,{key:string;name:string;barcode:string}>();
  for(const product of db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId&&p.active)){
    const key=product.masterProductId||product.id;
    if(!productsByKey.has(key))productsByKey.set(key,{key,name:product.name,barcode:product.barcode});
  }
  const productRows=[...productsByKey.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const taxMap=new Map(sri.taxes.map(t=>[t.productKey,t]));
  const invoices=[...sri.invoices].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const invoiceSaleIds=new Set(allSri.invoices.filter(i=>i.tenantId===ctx.tenantId).map(i=>i.saleId));
  const sales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId&&!invoiceSaleIds.has(s.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const customers=db.customers.filter(c=>c.tenantId===ctx.tenantId);
  const errors=configErrors(config),selfCheck=runSriEngineSelfCheck(),moduleEnabled=Boolean(ctx.tenant?.invoice);

  const updateConfig=<K extends keyof SriConfig>(key:K,value:SriConfig[K])=>setConfig(current=>current?{...current,[key]:value}:current);
  const saveConfig=(event:FormEvent)=>{
    event.preventDefault();
    const next={...config,tenantId:ctx.tenantId,branchId:ctx.branchId,certificateStatus:config.certificateLabel.trim()?"metadata_only" as const:"unconfigured" as const};
    setConfig(saveSriConfig(next));
    setMessage("Configuración fiscal guardada para esta sucursal. La clave de la firma NO se guarda en el navegador.");
  };
  const setTax=(productKey:string,code:string)=>{
    const option=profileFromCode(code);if(!option)return;
    saveProductTax({tenantId:ctx.tenantId,productKey,kind:option.kind,rate:option.rate,percentageCode:option.percentageCode,label:option.label,verified:true});
    setRefreshToken(v=>v+1);setMessage(`IVA actualizado: ${option.label}`);
  };
  const customerFor=(sale:SaleRecord)=>customers.find(c=>c.id===sale.customerId);
  const missingTaxes=(sale:SaleRecord)=>sale.items.flatMap(item=>{
    const product=db.tenantProducts.find(p=>p.id===item.productId),key=product?.masterProductId||product?.id||item.productId;
    return taxMap.has(key)?[]:[item.name];
  });

  const createDraft=(sale:SaleRecord)=>{
    try{
      if(!moduleEnabled)throw new Error("Activa el módulo Factura para este negocio desde KIUBO Control");
      const currentConfig=getSriConfig(ctx.tenantId,ctx.branchId),preflight=configErrors(currentConfig);
      if(preflight.length)throw new Error(`Falta configurar: ${preflight.join(", ")}`);
      const missing=missingTaxes(sale);if(missing.length)throw new Error(`Clasifica el IVA de: ${missing.join(", ")}`);
      if(!selfCheck)throw new Error("Falló la autoverificación del algoritmo SRI");

      const issueDate=new Date(sale.createdAt).toISOString().slice(0,10),sequence=currentConfig.nextSequential;
      const numericCode=numericCodeFromSeed(`${ctx.tenantId}:${ctx.branchId}:${sale.id}:${sequence}`);
      const accessKey=buildInvoiceAccessKey({issueDate,ruc:currentConfig.ruc,environment:currentConfig.environment,establishment:currentConfig.establishmentCode,emissionPoint:currentConfig.emissionPointCode,sequential:sequence,numericCode});
      const customer=customerFor(sale),buyerBase=buyerIdType(customer?.identification);
      const buyer={typeCode:buyerBase.code,identification:buyerBase.identification,name:customer?.name||buyerBase.name||"CONSUMIDOR FINAL",email:customer?.email||undefined,address:customer?.address||undefined};
      const taxLines=sale.items.map(item=>{
        const product=db.tenantProducts.find(p=>p.id===item.productId),productKey=product?.masterProductId||product?.id||item.productId,tax=taxMap.get(productKey)!;
        return{item,productKey,tax,gross:round2(item.qty*item.unitPrice)};
      });
      const groups=taxTotalsFromGross(taxLines.map(line=>({gross:line.gross,profile:{kind:line.tax.kind,rate:line.tax.rate,percentageCode:line.tax.percentageCode,label:line.tax.label} as SriTaxProfile})));
      const totalWithoutTax=round2(groups.reduce((n,g)=>n+g.base,0)),taxAmount=round2(groups.reduce((n,g)=>n+g.tax,0)),total=round2(totalWithoutTax+taxAmount);
      if(Math.abs(total-sale.total)>.02)throw new Error(`El total fiscal ${money(total)} no coincide con la venta ${money(sale.total)}; revisa IVA/precios`);

      const now=new Date().toISOString();
      const invoice:SriInvoiceRecord={
        id:`invoice-${accessKey}`,tenantId:ctx.tenantId,branchId:ctx.branchId,saleId:sale.id,customerId:sale.customerId,
        environment:currentConfig.environment,invoiceVersion:currentConfig.invoiceVersion,establishmentCode:currentConfig.establishmentCode,
        emissionPointCode:currentConfig.emissionPointCode,sequential:String(sequence).padStart(9,"0"),accessKey,numericCode,status:"draft",buyer,
        issuer:{ruc:currentConfig.ruc,legalName:currentConfig.legalName,tradeName:currentConfig.tradeName,matrixAddress:currentConfig.matrixAddress,establishmentAddress:currentConfig.establishmentAddress||currentConfig.matrixAddress,accountingRequired:currentConfig.accountingRequired,rimpe:currentConfig.rimpe},
        items:taxLines.map(line=>({productId:line.item.productId,productKey:line.productKey,name:line.item.name,qty:line.item.qty,gross:line.gross,taxKind:line.tax.kind,taxRate:line.tax.rate,percentageCode:line.tax.percentageCode})),
        taxes:groups.map(g=>({kind:g.profile.kind,rate:g.profile.rate,percentageCode:g.profile.percentageCode,base:g.base,tax:g.tax})),
        totalWithoutTax,taxAmount,total:sale.total,payment:sale.payment,
        preflightVersion:`SRI Off-line ${SRI_TECHNICAL_BASELINE} · Factura XSD ${SRI_INVOICE_XSD_VERSION}`,createdAt:now,updatedAt:now
      };
      persistInvoice(invoice,sequence+1);
      setConfig(getSriConfig(ctx.tenantId,ctx.branchId));setRefreshToken(v=>v+1);
      setMessage(`Borrador fiscal ${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential} creado`);
    }catch(error){setMessage(error instanceof Error?error.message:"No se pudo crear el borrador");}
  };

  return <>
    <div className="workspace-banner"><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>SUCURSAL</span><strong>{ctx.branch?.code} · {ctx.branch?.name}</strong></div><div><span>SRI</span><strong>{config.environment==="test"?"PRUEBAS":"PRODUCCIÓN"}</strong></div></div>
    <header className="topbar"><div><span className="eyebrow">KIUBO FACTURA</span><h1>Facturación electrónica</h1></div><span className={moduleEnabled?"status status-active":"status status-suspended"}>{moduleEnabled?"MÓDULO ACTIVO":"MÓDULO INACTIVO"}</span></header>
    <div className="sri-message">{message}</div>
    <section className="sri-status-grid">
      <article className="metric-card"><span>Esquema técnico</span><strong>Off-line {SRI_TECHNICAL_BASELINE}</strong><small>Baseline oficial · julio 2026</small></article>
      <article className="metric-card"><span>Factura XSD</span><strong>{SRI_INVOICE_XSD_VERSION}</strong><small>Versión preparada</small></article>
      <article className="metric-card"><span>Secuencial siguiente</span><strong>{String(config.nextSequential).padStart(9,"0")}</strong><small>{config.establishmentCode}-{config.emissionPointCode} · por sucursal</small></article>
      <article className="metric-card"><span>Preflight</span><strong>{selfCheck&&errors.length===0?"OK":"REVISAR"}</strong><small>{errors.length?errors.join(" · "):"Clave de acceso verificada"}</small></article>
    </section>
    <section className="sri-grid">
      <form className="panel sri-config" onSubmit={saveConfig}>
        <div className="panel-head"><div><span className="eyebrow">EMISOR · {ctx.branch?.name}</span><h3>Configuración fiscal</h3></div><span className={config.environment==="production"?"pill warning":"pill"}>{config.environment==="production"?"Producción seleccionada":"Pruebas"}</span></div>
        <div className="sri-form-grid">
          <label>Ambiente<select value={config.environment} onChange={e=>updateConfig("environment",e.target.value as SriConfig["environment"])}><option value="test">Pruebas / certificación</option><option value="production">Producción</option></select></label>
          <label>RUC<input value={config.ruc} inputMode="numeric" maxLength={13} onChange={e=>updateConfig("ruc",e.target.value.replace(/\D/g,""))}/></label>
          <label>Razón social<input value={config.legalName} onChange={e=>updateConfig("legalName",e.target.value)}/></label>
          <label>Nombre comercial<input value={config.tradeName} onChange={e=>updateConfig("tradeName",e.target.value)}/></label>
          <label className="span-two">Dirección matriz<input value={config.matrixAddress} onChange={e=>updateConfig("matrixAddress",e.target.value)}/></label>
          <label className="span-two">Dirección establecimiento<input value={config.establishmentAddress} onChange={e=>updateConfig("establishmentAddress",e.target.value)}/></label>
          <label>Establecimiento<input value={config.establishmentCode} maxLength={3} onChange={e=>updateConfig("establishmentCode",e.target.value.replace(/\D/g,""))}/></label>
          <label>Punto emisión<input value={config.emissionPointCode} maxLength={3} onChange={e=>updateConfig("emissionPointCode",e.target.value.replace(/\D/g,""))}/></label>
          <label>Régimen<select value={config.rimpe} onChange={e=>updateConfig("rimpe",e.target.value as SriConfig["rimpe"])}><option value="none">General / otro</option><option value="entrepreneur">RIMPE Emprendedor</option><option value="popular">RIMPE Negocio Popular</option></select></label>
          <label className="switch-row"><input type="checkbox" checked={config.accountingRequired} onChange={e=>updateConfig("accountingRequired",e.target.checked)}/>Obligado a llevar contabilidad</label>
        </div>
        <div className="sri-signature-box"><strong>Firma electrónica</strong><span>Solo guardamos metadatos aquí. El archivo P12/PFX y su contraseña deberán vivir en el backend seguro, nunca en localStorage.</span><div className="sri-form-grid"><label>Etiqueta / titular<input value={config.certificateLabel} onChange={e=>updateConfig("certificateLabel",e.target.value)} placeholder="Firma del negocio"/></label><label>Caduca<input type="date" value={config.certificateExpiresAt} onChange={e=>updateConfig("certificateExpiresAt",e.target.value)}/></label></div></div>
        <button className="button primary" type="submit">Guardar configuración SRI</button>
      </form>
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">IVA POR PRODUCTO</span><h3>Clasificación fiscal</h3></div><span className="pill">{sri.taxes.length}/{productRows.length}</span></div>
        <p className="sri-help">KIUBO no adivina el IVA. Un producto debe quedar clasificado antes de generar su borrador fiscal.</p>
        <div className="tax-profile-list">{productRows.map(product=>{const tax=taxMap.get(product.key);return <div className="tax-profile-row" key={product.key}><div><strong>{product.name}</strong><span>{product.barcode||"Sin código"}</span></div><select value={tax?.percentageCode??""} onChange={e=>setTax(product.key,e.target.value)}><option value="" disabled>Sin clasificar</option>{SRI_TAX_OPTIONS.map(option=><option key={option.percentageCode} value={option.percentageCode}>{option.label}</option>)}</select><b className={tax?.verified?"tax-ok":"tax-pending"}>{tax?.verified?"VERIFICADO":"PENDIENTE"}</b></div>})}</div>
      </article>
    </section>
    <section className="sri-grid">
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">POR FACTURAR</span><h3>Ventas de la sucursal</h3></div><span className="pill">{sales.length}</span></div><div className="invoice-sales-list">{sales.length?sales.slice(0,50).map(sale=>{const customer=customerFor(sale),missing=missingTaxes(sale);return <div className="invoice-sale-row" key={sale.id}><div><strong>{money(sale.total)}</strong><span>{customer?.name||"CONSUMIDOR FINAL"} · {new Date(sale.createdAt).toLocaleString("es-EC")}</span><small>{missing.length?`IVA pendiente: ${missing.join(", ")}`:`${sale.items.length} líneas listas`}</small></div><button className="button secondary compact" disabled={!moduleEnabled||Boolean(missing.length)||Boolean(errors.length)} onClick={()=>createDraft(sale)}>Crear borrador</button></div>}):<p className="empty-cart">No hay ventas pendientes de borrador fiscal en esta sucursal.</p>}</div></article>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">DOCUMENTOS</span><h3>Borradores y estados</h3></div><span className="pill">{invoices.length}</span></div><div className="invoice-history">{invoices.length?invoices.slice(0,40).map(invoice=><div className="invoice-history-row" key={invoice.id}><div><strong>{invoice.establishmentCode}-{invoice.emissionPointCode}-{invoice.sequential}</strong><span>{invoice.buyer.name} · {money(invoice.total)}</span><small>{invoice.accessKey}</small></div><span className={`invoice-state state-${invoice.status}`}>{statusLabel[invoice.status]}</span></div>):<p className="empty-cart">Los borradores fiscales aparecerán aquí. Firma, XML, envío y autorización todavía requieren el backend seguro.</p>}</div></article>
    </section>
    <section className="sri-safety-note"><strong>Estado profesional del módulo</strong><span>Ya genera secuencial por sucursal y clave de acceso de 49 dígitos, congela emisor/comprador/IVA/venta y evita duplicar una venta. Todavía NO firma ni transmite al SRI desde el navegador: esas operaciones se implementarán únicamente del lado servidor con la firma protegida.</span></section>
  </>;
}
