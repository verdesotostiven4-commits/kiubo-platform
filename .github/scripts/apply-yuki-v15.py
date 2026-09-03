from pathlib import Path


def one(text, old, new, label):
    count = text.count(old)
    assert count == 1, f"{label}: expected 1, got {count}"
    return text.replace(old, new, 1)

# Dashboard correctness.
p = Path("components/DashboardClient.tsx")
t = p.read_text()
t = one(t, 'import { saleVisibleAfterHistoryReset } from "@/lib/sale-adjustments";', 'import { parseOperationalItemName,saleVisibleAfterHistoryReset } from "@/lib/sale-adjustments";\nimport { saleLifecycle } from "@/lib/sale-reversal";', "dashboard imports")
t = one(t, 'sales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId&&saleVisibleAfterHistoryReset(s,settings)),bounds=getPeriodBounds(range,customFrom,customTo),now=new Date(),today=startOfDay(now);', 'sales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId&&saleLifecycle(s)==="completed"&&saleVisibleAfterHistoryReset(s,settings)),bounds=getPeriodBounds(range,customFrom,customTo),now=new Date(),today=startOfDay(now);', "completed sales")
t = one(t, '    const sold=new Map<string,{name:string,qty:number}>();for(const sale of inPeriod)for(const item of sale.items){if(item.name==="Envase")continue;const current=sold.get(item.productId)||{name:item.name,qty:0};current.qty+=item.qty;sold.set(item.productId,current)}', '    const sold=new Map<string,{name:string,qty:number}>();for(const sale of inPeriod)for(const item of sale.items){const meta=parseOperationalItemName(item.name);if(meta.mode!=="sale"||meta.displayName==="Envase")continue;const current=sold.get(item.productId)||{name:meta.displayName,qty:0};current.qty+=item.qty;sold.set(item.productId,current)}', "clean top products")
t = one(t, '  const dominant=[...payments].sort((a,b)=>b.amount-a.amount)[0];', '  const dominant=dashboard.total>0?[...payments].sort((a,b)=>b.amount-a.amount)[0]:undefined;', "empty payments")
t = one(t, '<small>Todo el tablero usa estas mismas fechas.</small>', '<small>Ventas, pagos, más vendidos y el gráfico usan estas fechas.</small>', "range copy")
t = one(t, '  const periodShort=range==="custom"?"rango elegido":rangeCopy[range].short;', '  const periodShort=range==="custom"?"rango elegido":rangeCopy[range].short;\n  const canManagePlan=Boolean(ctx.user?.platformAdmin||ctx.user?.role==="owner"||ctx.user?.role==="admin");', "plan permission")
t = one(t, '<section className="ref-dashboard-bottom">', '<section className={`ref-dashboard-bottom ${canManagePlan?"":"dashboard-bottom-single"}`}>', "bottom layout")
plan = '<article className="ref-white-card ref-plan-summary dashboard-plan-mini"><span className="public-kicker">TU PLAN</span><h3>KIUBO {tenant.plan}</h3><p>{plan.tagline}</p><div className="dashboard-plan-feature-count"><strong>{plan.features.length}</strong><span>capacidades incluidas</span></div><Link href="/upgrade">Ver plan y módulos →</Link></article>'
t = one(t, plan, '{canManagePlan&&' + plan + '}', "plan visibility")
p.write_text(t)

# Authorization derives from the actual signed-in admin user, not a browser marker.
p = Path("components/AdminPinManager.tsx")
t = p.read_text()
t = one(t, 'import { adminAuthorizationConfigured,markAdminAuthorizationConfigured } from "@/lib/admin-authorization";\n', '', "pin marker import")
t = one(t, '  const configured=adminAuthorizationConfigured(ctx.tenantId,user?.id);', '  const configured=Boolean(user?.pin&&user.pin!=="1234");', "pin configured")
t = one(t, '    markAdminAuthorizationConfigured(workspace.tenantId,current.id);\n', '', "pin marker write")
t = one(t, 'Este código protege acciones sensibles de este equipo, como reiniciar el historial visible de ventas.', 'Este código protege acciones sensibles, como reiniciar el historial visible de ventas.', "pin copy")
p.write_text(t)

p = Path("components/OperationalSalesInsights.tsx")
t = p.read_text()
t = one(t, 'import { adminAuthorizationConfigured } from "@/lib/admin-authorization";\n', '', "reset marker import")
t = one(t, '  const resetConfigured=canReset&&adminAuthorizationConfigured(data.ctx.tenantId,data.ctx.user?.id);', '  const resetConfigured=canReset&&Boolean(data.ctx.user?.pin&&data.ctx.user.pin!=="1234");', "reset configured")
t = one(t, 'No existe un código creado por ti en este equipo.', 'Aún no has configurado tu propio código de autorización.', "reset copy")
p.write_text(t)

# Inventory preserves metadata and stock together without double-applying stock.
p = Path("components/InventoryClient.tsx")
t = p.read_text()
start = t.index('  const updateIngredient=(e:FormEvent<HTMLFormElement>,productId:string)=>{')
end = t.index('  const addRecipeComponent=', start)
replacement = '''  const updateIngredient=(e:FormEvent<HTMLFormElement>,productId:string)=>{
    e.preventDefault();const f=new FormData(e.currentTarget),name=clean(String(f.get("name")||"")),unit=clean(String(f.get("unit")||"u"))||"u",cost=Number(f.get("cost")||0),threshold=Number(f.get("threshold")||0),stock=Number(f.get("stock")||0),stockReason=clean(String(f.get("stockReason")||""));
    if(!name||!Number.isFinite(cost)||cost<0||!Number.isFinite(threshold)||threshold<0||!Number.isFinite(stock)||stock<0){setMessage("Revisa los datos del ingrediente");return}
    if(isYuki&&(!Number.isInteger(threshold)||!Number.isInteger(stock))){setMessage("En YUKI el stock y el mínimo deben ser unidades completas");return}
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),product=next.tenantProducts.find(p=>p.id===productId&&p.tenantId===workspace.tenantId&&p.branchId===workspace.branchId&&inventoryOnly(p));if(!product){setMessage("Ingrediente no encontrado");return}
    const duplicate=next.tenantProducts.find(p=>p.id!==productId&&p.tenantId===workspace.tenantId&&p.branchId===workspace.branchId&&inventoryOnly(p)&&p.name.toLocaleLowerCase("es")===name.toLocaleLowerCase("es"));if(duplicate){setMessage(`${name} ya existe como ingrediente`);return}
    const stockChanged=Math.abs(stock-product.stock)>.000001;if(stockChanged&&!stockReason){setMessage("Escribe el motivo si vas a cambiar el stock");return}
    product.name=name;product.cost=cost;const editable=asInventoryProduct(product);editable.stockUnit=unit;editable.lowStockThreshold=threshold;
    if(!stockChanged){persist(next,`${name} actualizado`);setEditIngredientId("");return}
    saveLocalDatabase(next);
    const adjusted=loadLocalDatabase(),adjustedWorkspace=getWorkspaceContext(adjusted),adjustedProduct=adjusted.tenantProducts.find(p=>p.id===productId&&p.tenantId===adjustedWorkspace.tenantId&&p.branchId===adjustedWorkspace.branchId&&inventoryOnly(p));if(!adjustedProduct){setMessage("Ingrediente no encontrado después de guardar sus datos");return}
    const productBefore={...adjustedProduct},previousStock=adjustedProduct.stock,delta=Number((stock-previousStock).toFixed(4)),now=new Date().toISOString(),movementId=makeId("stock");adjustedProduct.stock=Number(stock.toFixed(4));const productAfter={...adjustedProduct},movement:StockMovementRecord={id:movementId,tenantId:adjustedWorkspace.tenantId,branchId:adjustedWorkspace.branchId,productId:adjustedProduct.id,type:delta>0?"adjustment_in":"adjustment_out",quantity:delta,previousStock,newStock:adjustedProduct.stock,reference:stockReason,clientOperationId:movementId,createdAt:now};
    adjusted.stockMovements.unshift(movement);enqueueInventoryAdjustment(adjusted,{productId:adjustedProduct.id,delta,reason:stockReason,movementId,createdAt:now,productBefore,productAfter,movement});saveLocalDatabase(adjusted,{trackChanges:false});setDb(loadLocalDatabase());setMessage(`${name} actualizado · stock ${formatStock(adjustedProduct.stock,unit)}`);window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"inventory-edit"}}));setEditIngredientId("");
  };
'''
t = t[:start] + replacement + t[end:]
p.write_text(t)

p = Path("app/experience-v15.css")
t = p.read_text()
rule = '.ref-dashboard-bottom.dashboard-bottom-single{grid-template-columns:1fr!important}'
if rule not in t:
    t += '\n' + rule + '\n'
p.write_text(t)
