"use client";
import { useEffect,useState } from "react";
import {
  type CreditRecord,
  type CustomerRecord,
  type FoodOrderRecord,
  type SaleRecord,
  type ServiceMode,
  type StockMovementRecord,
  type TenantProduct,
  getOpenCashSession,
  getTenantSettings,
  getWorkspaceContext,
  loadLocalDatabase,
  makeId,
  nextOrderNumber,
  saveLocalDatabase,
} from "@/lib/local-store";
import { enqueueSaleTransaction } from "@/lib/sales-transaction";
import { queueFoodOrder } from "@/lib/order-sync";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

type CartLine=TenantProduct&{qty:number};
type Payment=SaleRecord["payment"];
type PosDraft={cart:Array<{productId:string;qty:number}>;query:string;payment:Payment;customerId:string;category:string;serviceMode:ServiceMode;tableLabel:string;customerName:string;phone:string;address:string;orderNotes:string;activeOrderId:string};
const paymentLabel:Record<Payment,string>={cash:"Efectivo",transfer:"Transferencia",mixed:"Mixto",credit:"Fiado"};
const paymentOptions:Payment[]=["cash","transfer","credit"];
const CHECKOUT_KEY="kiubo.food.checkout.order.v1";
const POS_DRAFT_PREFIX="kiubo.pos.draft.v2";
const serviceLabel:Record<ServiceMode,string>={counter:"Mostrador",table:"Local / mesa",takeaway:"Para llevar",delivery:"Domicilio"};
const posDraftKey=(tenantId:string,branchId:string)=>`${POS_DRAFT_PREFIX}:${tenantId}:${branchId}`;

export function PosClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[cart,setCart]=useState<CartLine[]>([]);
  const[query,setQuery]=useState("");
  const[payment,setPayment]=useState<Payment>("cash");
  const[customerId,setCustomerId]=useState("");
  const[message,setMessage]=useState("Listo para vender");
  const[category,setCategory]=useState("Todos");
  const[serviceMode,setServiceMode]=useState<ServiceMode>("counter");
  const[tableLabel,setTableLabel]=useState("");
  const[customerName,setCustomerName]=useState("");
  const[phone,setPhone]=useState("");
  const[address,setAddress]=useState("");
  const[orderNotes,setOrderNotes]=useState("");
  const[activeOrderId,setActiveOrderId]=useState("");
  const[lastSaleId,setLastSaleId]=useState("");
  const[draftReady,setDraftReady]=useState(false);
  const refresh=()=>setDb(loadLocalDatabase());

  useEffect(()=>{
    refresh();
    window.addEventListener(KIUBO_DATA_REFRESHED,refresh);
    return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh);
  },[]);

  useEffect(()=>{
    if(!db||draftReady)return;
    const workspace=getWorkspaceContext(db);
    if(!workspace.branchId)return;
    if(window.sessionStorage.getItem(CHECKOUT_KEY))return;
    const key=posDraftKey(workspace.tenantId,workspace.branchId),raw=window.localStorage.getItem(key);
    if(raw){
      try{
        const draft=JSON.parse(raw) as Partial<PosDraft>,lines:CartLine[]=[];
        for(const saved of draft.cart||[]){
          const product=db.tenantProducts.find(item=>item.id===saved.productId&&item.tenantId===workspace.tenantId&&item.branchId===workspace.branchId&&item.active);
          const qty=Math.max(1,Math.floor(Number(saved.qty)||1));
          if(product)lines.push({...product,qty:product.trackStock===false?qty:Math.min(qty,Math.max(1,product.stock))});
        }
        setCart(lines);
        setQuery(typeof draft.query==="string"?draft.query:"");
        if(draft.payment&&paymentOptions.includes(draft.payment))setPayment(draft.payment);
        setCustomerId(typeof draft.customerId==="string"?draft.customerId:"");
        setCategory(typeof draft.category==="string"&&draft.category?draft.category:"Todos");
        if(draft.serviceMode)setServiceMode(draft.serviceMode);
        setTableLabel(typeof draft.tableLabel==="string"?draft.tableLabel:"");
        setCustomerName(typeof draft.customerName==="string"?draft.customerName:"");
        setPhone(typeof draft.phone==="string"?draft.phone:"");
        setAddress(typeof draft.address==="string"?draft.address:"");
        setOrderNotes(typeof draft.orderNotes==="string"?draft.orderNotes:"");
        setActiveOrderId(typeof draft.activeOrderId==="string"?draft.activeOrderId:"");
        if(lines.length)setMessage(`Venta recuperada · ${lines.reduce((sum,line)=>sum+line.qty,0)} productos`);
      }catch{
        window.localStorage.removeItem(key);
      }
    }
    setDraftReady(true);
  },[db,draftReady]);

  useEffect(()=>{
    if(!db)return;
    const orderId=window.sessionStorage.getItem(CHECKOUT_KEY);
    if(!orderId)return;
    window.sessionStorage.removeItem(CHECKOUT_KEY);
    const ctx=getWorkspaceContext(db);
    const order=db.orders.find(item=>item.id===orderId&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId);
    if(!order){setDraftReady(true);return}
    const lines:CartLine[]=[];
    for(const item of order.items){
      const product=db.tenantProducts.find(p=>p.id===item.productId&&p.tenantId===ctx.tenantId&&p.branchId===ctx.branchId&&p.active);
      if(product)lines.push({...product,qty:item.qty});
    }
    setCart(lines);
    setActiveOrderId(order.id);
    setServiceMode(order.serviceMode);
    setTableLabel(order.tableLabel||"");
    setCustomerId(order.customerId||"");
    setCustomerName(order.customerName||"");
    setPhone(order.phone||"");
    setAddress(order.address||"");
    setOrderNotes(order.notes||"");
    setMessage(`Pedido #${String(order.number).padStart(4,"0")} cargado para cobrar`);
    setDraftReady(true);
  },[db?.orders.length]);

  useEffect(()=>{
    if(!db||!draftReady)return;
    const workspace=getWorkspaceContext(db);if(!workspace.branchId)return;
    const key=posDraftKey(workspace.tenantId,workspace.branchId);
    const empty=cart.length===0&&!query.trim()&&payment==="cash"&&!customerId&&category==="Todos"&&serviceMode==="counter"&&!tableLabel.trim()&&!customerName.trim()&&!phone.trim()&&!address.trim()&&!orderNotes.trim()&&!activeOrderId;
    if(empty){window.localStorage.removeItem(key);return}
    const draft:PosDraft={cart:cart.map(line=>({productId:line.id,qty:line.qty})),query,payment,customerId,category,serviceMode,tableLabel,customerName,phone,address,orderNotes,activeOrderId};
    window.localStorage.setItem(key,JSON.stringify(draft));
  },[db,draftReady,cart,query,payment,customerId,category,serviceMode,tableLabel,customerName,phone,address,orderNotes,activeOrderId]);

  if(!db)return <div className="loading-card">Preparando POS…</div>;

  const ctx=getWorkspaceContext(db),tenant=ctx.tenant,branch=ctx.branch,settings=getTenantSettings(db,ctx.tenantId),foodService=settings.businessType==="food_service";
  const products=db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId&&p.branchId===ctx.branchId&&p.active);
  const customers:CustomerRecord[]=db.customers.filter(c=>c.tenantId===ctx.tenantId);
  const categories=["Todos",...Array.from(new Set(products.map(product=>product.category||"General"))).sort((a,b)=>a.localeCompare(b,"es"))];
  const filtered=products.filter(p=>(category==="Todos"||(p.category||"General")===category)&&`${p.name} ${p.barcode} ${p.price}`.toLowerCase().includes(query.toLowerCase()));
  const total=cart.reduce((sum,line)=>sum+line.price*line.qty,0),blocked=tenant?.status==="suspended";
  const enabledModes:ServiceMode[]=foodService?(settings.serviceModes.length?settings.serviceModes:["table","takeaway","delivery"]):[];
  const activeServiceMode:ServiceMode=foodService?(enabledModes.includes(serviceMode)?serviceMode:(enabledModes[0]||"counter")):serviceMode;

  const add=(product:TenantProduct)=>{
    if(product.trackStock!==false&&product.stock<=0){setMessage(`${product.name} sin stock`);return}
    setCart(current=>{
      const found=current.find(line=>line.id===product.id);
      if(found){
        if(product.trackStock!==false&&found.qty>=product.stock){setMessage(`Stock máximo: ${product.stock}`);return current}
        return current.map(line=>line.id===product.id?{...line,qty:line.qty+1}:line);
      }
      return[...current,{...product,qty:1}];
    });
    setMessage(`${product.name} agregado`);
  };
  const changeQty=(id:string,delta:number)=>setCart(current=>current.map(line=>line.id===id?{...line,qty:line.trackStock===false?line.qty+delta:Math.min(line.stock,line.qty+delta)}:line).filter(line=>line.qty>0));

  const validateOrderDetails=()=>{
    if(!foodService)return true;
    if(activeServiceMode==="table"&&!tableLabel.trim()){setMessage("Escribe la mesa para el pedido local");return false}
    if(activeServiceMode==="delivery"&&(!customerName.trim()||!phone.trim()||!address.trim())){setMessage("Para domicilio necesitamos nombre, teléfono y dirección");return false}
    return true;
  };

  const buildOrder=(next:ReturnType<typeof loadLocalDatabase>,workspace:ReturnType<typeof getWorkspaceContext>,paymentStatus:"unpaid"|"paid",saleId?:string):FoodOrderRecord=>{
    const existing=activeOrderId?next.orders.find(order=>order.id===activeOrderId):undefined,now=new Date().toISOString();
    return{
      id:existing?.id||makeId("order"),
      tenantId:workspace.tenantId,
      branchId:workspace.branchId,
      number:existing?.number||nextOrderNumber(next,workspace.tenantId,workspace.branchId),
      serviceMode:activeServiceMode,
      tableLabel:tableLabel.trim()||undefined,
      customerId:customerId||undefined,
      customerName:customerName.trim()||customers.find(c=>c.id===customerId)?.name||undefined,
      phone:phone.trim()||undefined,
      address:address.trim()||undefined,
      notes:orderNotes.trim()||undefined,
      items:cart.map(line=>({productId:line.id,name:line.name,qty:line.qty,unitPrice:line.price})),
      total:Number(total.toFixed(2)),
      status:existing?.status||"new",
      paymentStatus,
      saleId:saleId||existing?.saleId,
      createdBy:existing?.createdBy||workspace.user?.id,
      createdAt:existing?.createdAt||now,
      updatedAt:now,
    };
  };

  const persistOrder=(next:ReturnType<typeof loadLocalDatabase>,order:FoodOrderRecord,queue=true)=>{
    const index=next.orders.findIndex(item=>item.id===order.id);
    if(index>=0)next.orders[index]=order;else next.orders.unshift(order);
    if(queue)queueFoodOrder(next,order);
  };

  const saveOrder=()=>{
    if(!foodService||!cart.length){setMessage(cart.length?"Este perfil no usa pedidos":"Agrega productos al pedido");return}
    if(!validateOrderDetails())return;
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),order=buildOrder(next,workspace,"unpaid");
    persistOrder(next,order,true);
    saveLocalDatabase(next,{trackChanges:false});
    setDb(next);
    setActiveOrderId(order.id);
    setMessage(`Pedido #${String(order.number).padStart(4,"0")} guardado · ${serviceLabel[order.serviceMode]}`);
  };

  const checkout=()=>{
    if(!cart.length){setMessage("Agrega al menos un producto");return}
    if(payment==="mixed"){setMessage("El pago mixto se habilitará cuando KIUBO pueda guardar el reparto exacto");return}
    if(!validateOrderDetails())return;
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),currentSettings=getTenantSettings(next,workspace.tenantId);
    if(workspace.tenant?.status==="suspended"){setMessage("La licencia está suspendida");return}
    if(!workspace.branchId){setMessage("Selecciona una sucursal");return}
    if(payment==="credit"&&!currentSettings.allowCredit){setMessage("El fiado está desactivado");return}
    if(payment==="credit"&&!customerId){setMessage("Selecciona un cliente para registrar el fiado");return}
    if(payment==="cash"&&currentSettings.requireCashSession&&!getOpenCashSession(next,workspace.tenantId,workspace.branchId)){setMessage("Debes abrir caja en esta sucursal antes de cobrar");return}
    for(const line of cart){
      const current=next.tenantProducts.find(p=>p.id===line.id&&p.tenantId===workspace.tenantId&&p.branchId===workspace.branchId);
      if(!current||(current.trackStock!==false&&current.stock<line.qty)){setMessage(`Revisa stock de ${line.name}`);refresh();return}
    }

    const now=new Date().toISOString();
    const sale:SaleRecord={id:makeId("sale"),tenantId:workspace.tenantId,branchId:workspace.branchId,customerId:customerId||undefined,total:Number(total.toFixed(2)),payment,items:cart.map(line=>({productId:line.id,name:line.name,qty:line.qty,unitPrice:line.price,unitCost:line.cost})),createdAt:now};
    sale.clientOperationId=sale.id;

    let orderBefore:FoodOrderRecord|undefined,order:FoodOrderRecord|undefined;
    if(foodService){
      const existing=activeOrderId?next.orders.find(item=>item.id===activeOrderId):undefined;
      if(existing)orderBefore={...existing,items:existing.items.map(item=>({...item}))};
      order=buildOrder(next,workspace,"paid",sale.id);
      sale.orderId=order.id;
      persistOrder(next,order,false);
    }

    next.sales.unshift(sale);
    let credit:CreditRecord|undefined;
    if(payment==="credit"&&customerId){
      credit={id:makeId("credit"),tenantId:workspace.tenantId,branchId:workspace.branchId,customerId,saleId:sale.id,description:`Venta ${sale.id.slice(-8)}`,originalAmount:sale.total,balance:sale.total,status:"open",createdAt:now};
      next.credits.unshift(credit);
    }

    const stockMovements:StockMovementRecord[]=[],productSnapshots:TenantProduct[]=[];
    for(const line of cart){
      const current=next.tenantProducts.find(p=>p.id===line.id)!;
      const previous=current.stock,newStock=previous-line.qty;
      const movement:StockMovementRecord={id:makeId("stock"),tenantId:workspace.tenantId,branchId:workspace.branchId,productId:current.id,type:"sale",quantity:-line.qty,previousStock:previous,newStock,reference:sale.id,createdAt:now};
      movement.clientOperationId=movement.id;
      stockMovements.push(movement);
      next.stockMovements.unshift(movement);
      current.stock=newStock;
      productSnapshots.push({...current});
    }

    enqueueSaleTransaction(next,{sale,productSnapshots,stockMovements,credit,orderBefore,orderAfter:order});
    saveLocalDatabase(next,{trackChanges:false});
    window.localStorage.removeItem(posDraftKey(workspace.tenantId,workspace.branchId));
    setDb(next);
    setCart([]);
    setQuery("");
    setPayment("cash");
    setCustomerId("");
    setCustomerName("");
    setPhone("");
    setAddress("");
    setOrderNotes("");
    setTableLabel("");
    setCategory("Todos");
    setServiceMode("counter");
    setActiveOrderId("");
    setLastSaleId(sale.id);
    setMessage(`Venta guardada · ${paymentLabel[payment]} · $${sale.total.toFixed(2)}${order?` · Pedido #${String(order.number).padStart(4,"0")}`:""}`);
  };

  if(blocked)return <div className="license-block"><div className="hero-mini">K</div><span className="eyebrow">LICENCIA SUSPENDIDA</span><h2>{tenant?.name??"Este negocio"} está en modo consulta.</h2><p>No se borra información ni se permiten nuevas ventas hasta reactivar la licencia desde KIUBO Control.</p></div>;

  return <>
    <div className="workspace-banner">
      <div><span>NEGOCIO</span><strong>{tenant?.name??"Negocio"}</strong></div>
      <div><span>SUCURSAL</span><strong>{branch?.code} · {branch?.name}</strong></div>
      <div><span>ESTADO</span><strong>{message}</strong></div>
    </div>
    <div className="pos-grid">
      <section className="pos-products">
        {foodService&&<>
          <div className="payment-grid" style={{marginBottom:10}}>{enabledModes.map(mode=><button key={mode} className={activeServiceMode===mode?"selected":""} onClick={()=>setServiceMode(mode)}>{serviceLabel[mode]}</button>)}</div>
          {activeServiceMode==="table"&&<input className="search-input" value={tableLabel} onChange={e=>setTableLabel(e.target.value)} placeholder={`Mesa (1–${settings.tableCount||"…"})`}/>} 
          <div className="payment-grid" style={{margin:"10px 0"}}>{categories.map(item=><button key={item} className={category===item?"selected":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        </>}
        <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto…"/>
        <div className="product-results" style={foodService?{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:10}:undefined}>
          {filtered.length?filtered.map(product=><button className="pos-product" style={foodService?{display:"grid",gridTemplateColumns:"64px 1fr",textAlign:"left",minHeight:86}:undefined} key={product.id} onClick={()=>add(product)}><div className="product-icon" style={{width:58,height:58,overflow:"hidden",borderRadius:10}}>{product.imageUrl?<img src={product.imageUrl} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:product.name.charAt(0)}</div><div><strong>{product.name}</strong><span>{product.trackStock===false?(product.category||"Elaborado"):`${product.category||product.barcode} · Stock ${product.stock}`}</span><b>${product.price.toFixed(2)}</b></div></button>):<p className="empty-cart">No encontramos productos en esta categoría.</p>}
        </div>
      </section>
      <aside className="cart-panel">
        <div className="cart-head"><span className="eyebrow">{foodService?activeOrderId?"PEDIDO CARGADO":"PEDIDO / VENTA":"VENTA ACTUAL"}</span><h2>{cart.reduce((n,l)=>n+l.qty,0)} productos</h2></div>
        <select className="pos-customer-select" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Cliente opcional</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.identification}</option>)}</select>
        {foodService&&<div style={{display:"grid",gap:8,marginBottom:12}}>{activeServiceMode!=="table"&&<input className="search-input" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Nombre del cliente (opcional)"/>}{activeServiceMode==="delivery"&&<><input className="search-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Teléfono"/><input className="search-input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección de entrega"/></>}<input className="search-input" value={orderNotes} onChange={e=>setOrderNotes(e.target.value)} placeholder="Nota del pedido (sin cebolla, etc.)"/></div>}
        <div className="cart-lines">{cart.length===0?<p className="empty-cart">Toca un producto para comenzar.</p>:cart.map(line=><div className="cart-line interactive" key={line.id}><div><strong>{line.name}</strong><span>${line.price.toFixed(2)} c/u</span></div><div className="qty"><button onClick={()=>changeQty(line.id,-1)}>−</button><b>{line.qty}</b><button onClick={()=>changeQty(line.id,1)}>+</button></div><strong>${(line.price*line.qty).toFixed(2)}</strong></div>)}</div>
        <div className="cart-total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
        {foodService&&<button className="button secondary checkout" onClick={saveOrder}>Guardar pedido sin cobrar</button>}
        <div className="payment-grid">{paymentOptions.map(method=><button key={method} className={payment===method?"selected":""} onClick={()=>setPayment(method)}>{paymentLabel[method]}</button>)}</div>
        <button className="button primary checkout" onClick={checkout}>Cobrar ${total.toFixed(2)}</button>
        {lastSaleId&&<a className="button secondary checkout" target="_blank" rel="noreferrer" href={`/receipt?sale=${encodeURIComponent(lastSaleId)}`}>Imprimir recibo</a>}
        <p className="cart-note">KIUBO guarda primero en este dispositivo y sincroniza operaciones protegidas con Cloud. Si internet falla, la cola queda pendiente sin perder el trabajo.</p>
      </aside>
    </div>
  </>;
}