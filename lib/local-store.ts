import type { AuditLogRecord, SyncEntity, SyncQueueRecord, SyncStatus } from "./sync-types";

export type Plan = "Start" | "Pro" | "Custom" | "Internal";
export type TenantStatus = "trial" | "active" | "grace" | "suspended";
export type UserRole = "owner"|"admin"|"cashier"|"inventory"|"viewer";
export type BusinessType = "general"|"retail"|"food_service"|"services";
export type ServiceMode = "counter"|"table"|"takeaway"|"delivery";
export type FoodOrderStatus = "new"|"preparing"|"ready"|"delivered"|"cancelled";
export type FoodOrderPaymentStatus = "unpaid"|"partial"|"paid";
export type PurchasePaymentMethod = "cash"|"transfer"|"card"|"other";
export type PurchasePaymentStatus = "pending"|"partial"|"paid";
export type PurchaseStatus = "received"|"cancelled";

export type TenantRecord = { id:string; name:string; plan:Plan; status:TenantStatus; users:number; branches:number; expiresAt:string; catalog:boolean; invoice:boolean; createdAt:string };
export type BranchRecord = { id:string; tenantId:string; name:string; code:string; active:boolean; createdAt:string };
export type MasterProduct = { id:string; barcode:string; name:string; brand:string; presentation:string; category:string; image?:string };
export type TenantProduct = { id:string; tenantId:string; branchId:string; masterProductId:string; barcode:string; name:string; price:number; cost:number; stock:number; active:boolean; category?:string; imageUrl?:string; trackStock?:boolean };
export type CustomerRecord = { id:string; tenantId:string; identification:string; name:string; email:string; phone:string; address:string; createdAt:string };
export type SaleRecord = { id:string; tenantId:string; branchId:string; customerId?:string; orderId?:string; total:number; payment:"cash"|"transfer"|"mixed"|"credit"; items:{productId:string;name:string;qty:number;unitPrice:number;unitCost?:number}[]; clientOperationId?:string; createdAt:string };
export type FoodOrderItem = { productId:string; name:string; qty:number; unitPrice:number; notes?:string; courtesy?:boolean };
export type FoodOrderRecord = { id:string; tenantId:string; branchId:string; number:number; serviceMode:ServiceMode; tableLabel?:string; customerId?:string; customerName?:string; phone?:string; address?:string; notes?:string; items:FoodOrderItem[]; total:number; status:FoodOrderStatus; paymentStatus:FoodOrderPaymentStatus; saleId?:string; createdBy?:string; discountPercent?:number; internalConsumption?:boolean; createdAt:string; updatedAt:string };
export type UserRecord = { id:string; tenantId:string; name:string; email:string; role:UserRole; active:boolean; pin:string; platformAdmin?:boolean; createdAt:string };
export type CashSessionRecord = { id:string; tenantId:string; branchId:string; openingAmount:number; closingAmount?:number; status:"open"|"closed"; openedAt:string; closedAt?:string; openedBy:string };
export type CashMovementRecord = { id:string; tenantId:string; branchId:string; sessionId:string; type:"in"|"out"; amount:number; reason:string; clientOperationId?:string; createdAt:string };
export type CreditRecord = { id:string; tenantId:string; branchId:string; customerId:string; saleId?:string; description:string; originalAmount:number; balance:number; status:"open"|"paid"; createdAt:string };
export type CreditPaymentRecord = { id:string; tenantId:string; branchId:string; creditId:string; amount:number; method:"cash"|"transfer"; clientOperationId?:string; createdAt:string };
export type TenantSettings = { tenantId:string; tradeName:string; legalName:string; ruc:string; establishment:string; emissionPoint:string; currency:"USD"; accent:string; receiptFooter:string; requireCashSession:boolean; allowCredit:boolean; address:string; phone:string; businessType:BusinessType; serviceModes:ServiceMode[]; tableCount:number; categoryOrder?:string[]; showProductImages:boolean; splashEnabled:boolean; receiptWidth:"58mm"|"80mm" };
export type TenantBrandingRecord = { tenantId:string; businessName:string; logoUrl:string; primaryColor:string; secondaryColor:string; accentColor:string; receiptTagline:string; updatedAt:string };
export type SupplierRecord = { id:string; tenantId:string; identification:string; name:string; email:string; phone:string; address:string; createdAt:string };
export type PurchaseRecord = { id:string; tenantId:string; branchId:string; supplierId:string; total:number; items:{productId:string;name:string;qty:number;unitCost:number}[]; documentType?:"invoice"|"note"|"receipt"|"other"; documentNumber?:string; documentDate?:string; dueDate?:string; notes?:string; status?:PurchaseStatus; paymentStatus?:PurchasePaymentStatus; paidAmount?:number; clientOperationId?:string; createdAt:string };
export type SupplierPaymentRecord = { id:string; tenantId:string; branchId:string; supplierId:string; purchaseId:string; amount:number; method:PurchasePaymentMethod; note:string; clientOperationId?:string; createdAt:string };
export type StockMovementType = "sale"|"purchase"|"adjustment_in"|"adjustment_out";
export type StockMovementRecord = { id:string; tenantId:string; branchId:string; productId:string; type:StockMovementType; quantity:number; previousStock:number; newStock:number; reference:string; clientOperationId?:string; createdAt:string };
export type LocalSession = { userId:string; tenantId:string; activeTenantId?:string; activeBranchId?:string; role:UserRole; startedAt:string };
export type KiuboLocalDatabase = {
  tenants:TenantRecord[]; branches:BranchRecord[]; masterProducts:MasterProduct[]; tenantProducts:TenantProduct[];
  customers:CustomerRecord[]; sales:SaleRecord[]; orders:FoodOrderRecord[]; users:UserRecord[]; cashSessions:CashSessionRecord[];
  cashMovements:CashMovementRecord[]; credits:CreditRecord[]; creditPayments:CreditPaymentRecord[]; settings:TenantSettings[];
  branding:TenantBrandingRecord[]; suppliers:SupplierRecord[]; purchases:PurchaseRecord[]; supplierPayments:SupplierPaymentRecord[]; stockMovements:StockMovementRecord[];
  syncQueue:SyncQueueRecord[]; auditLogs:AuditLogRecord[]; syncCursor?:string;
};

const STORAGE_KEY="kiubo.foundation.v2";
const SESSION_KEY="kiubo.local.session.v1";
const DEVICE_KEY="kiubo.local.device.v1";
export const PILOT_TENANT_ID="tenant-pilot-001";
export const PILOT_BRANCH_ID="branch-pilot-main";
const epoch=new Date(0).toISOString();

const defaultSettings=(tenantId:string,tradeName:string):TenantSettings=>({
  tenantId,tradeName,legalName:"",ruc:"",establishment:"001",emissionPoint:"001",currency:"USD",accent:"#ff5b55",
  receiptFooter:"Gracias por tu compra",requireCashSession:false,allowCredit:true,address:"",phone:"",businessType:"general",
  serviceModes:["counter"],tableCount:0,showProductImages:true,splashEnabled:true,receiptWidth:"80mm"
});
const defaultBranding=(tenantId:string,businessName:string):TenantBrandingRecord=>({tenantId,businessName,logoUrl:"",primaryColor:"#ff5b55",secondaryColor:"#0d2b4d",accentColor:"#ff8a3d",receiptTagline:"Todo tu negocio, en orden.",updatedAt:epoch});
const defaultBranch=(tenantId:string,name="Matriz",code="001"):BranchRecord=>({id:`branch-${tenantId.replace(/[^a-z0-9]/gi,"").slice(-12)}-${code}`,tenantId,name,code,active:true,createdAt:epoch});

export const initialDatabase:KiuboLocalDatabase={
  tenants:[
    {id:"tenant-internal-reference",name:"Barrio MAX · referencia",plan:"Internal",status:"active",users:1,branches:1,expiresAt:"Sin vencimiento",catalog:true,invoice:true,createdAt:epoch},
    {id:PILOT_TENANT_ID,name:"Piloto 001 · Jairo",plan:"Pro",status:"trial",users:2,branches:1,expiresAt:"90 días desde activación",catalog:true,invoice:false,createdAt:epoch}
  ],
  branches:[
    {id:"branch-reference-main",tenantId:"tenant-internal-reference",name:"Matriz",code:"001",active:true,createdAt:epoch},
    {id:PILOT_BRANCH_ID,tenantId:PILOT_TENANT_ID,name:"Matriz",code:"001",active:true,createdAt:epoch}
  ],
  masterProducts:[
    {id:"m-1",barcode:"786000000001",name:"Leche Entera",brand:"Demo",presentation:"1 L",category:"Lácteos"},
    {id:"m-2",barcode:"786000000002",name:"Café Buen Día",brand:"Buen Día",presentation:"Unidad",category:"Café"},
    {id:"m-3",barcode:"786000000003",name:"Agua",brand:"Demo",presentation:"600 ml",category:"Bebidas"},
    {id:"m-4",barcode:"786000000004",name:"Galletas",brand:"Demo",presentation:"Paquete",category:"Snacks"},
    {id:"m-5",barcode:"786000000005",name:"Arroz",brand:"Demo",presentation:"1 kg",category:"Abarrotes"},
    {id:"m-6",barcode:"786000000006",name:"Atún",brand:"Demo",presentation:"Lata",category:"Conservas"}
  ],
  tenantProducts:[
    {id:"tp-1",tenantId:PILOT_TENANT_ID,branchId:PILOT_BRANCH_ID,masterProductId:"m-1",barcode:"786000000001",name:"Leche Entera 1L",price:1.25,cost:.92,stock:18,active:true,category:"Lácteos",trackStock:true},
    {id:"tp-2",tenantId:PILOT_TENANT_ID,branchId:PILOT_BRANCH_ID,masterProductId:"m-2",barcode:"786000000002",name:"Café Buen Día",price:.15,cost:.10,stock:42,active:true,category:"Café",trackStock:true},
    {id:"tp-3",tenantId:PILOT_TENANT_ID,branchId:PILOT_BRANCH_ID,masterProductId:"m-3",barcode:"786000000003",name:"Agua 600ml",price:.75,cost:.50,stock:30,active:true,category:"Bebidas",trackStock:true},
    {id:"tp-4",tenantId:PILOT_TENANT_ID,branchId:PILOT_BRANCH_ID,masterProductId:"m-4",barcode:"786000000004",name:"Galletas",price:.50,cost:.32,stock:25,active:true,category:"Snacks",trackStock:true}
  ],
  customers:[{id:"c-1",tenantId:PILOT_TENANT_ID,identification:"9999999999",name:"Cliente Demo",email:"cliente@demo.ec",phone:"0990000000",address:"",createdAt:epoch}],
  sales:[],orders:[],
  users:[
    {id:"u-owner",tenantId:PILOT_TENANT_ID,name:"Administrador KIUBO",email:"admin@kiubo.local",role:"owner",active:true,pin:"1234",platformAdmin:true,createdAt:epoch},
    {id:"u-cashier",tenantId:PILOT_TENANT_ID,name:"Caja 01",email:"caja@kiubo.local",role:"cashier",active:true,pin:"1234",platformAdmin:false,createdAt:epoch}
  ],
  cashSessions:[],cashMovements:[],credits:[],creditPayments:[],suppliers:[],purchases:[],supplierPayments:[],stockMovements:[],
  settings:[defaultSettings(PILOT_TENANT_ID,"Piloto 001"),defaultSettings("tenant-internal-reference","Barrio MAX · referencia")],
  branding:[defaultBranding(PILOT_TENANT_ID,"Piloto 001"),defaultBranding("tenant-internal-reference","Barrio MAX · referencia")],
  syncQueue:[],auditLogs:[]
};

const TRACKED_COLLECTIONS:SyncEntity[]=["tenants","branches","tenantProducts","customers","sales","orders","users","cashSessions","cashMovements","credits","creditPayments","settings","branding","suppliers","purchases","supplierPayments","stockMovements"];

function cloneInitial():KiuboLocalDatabase{return JSON.parse(JSON.stringify(initialDatabase)) as KiuboLocalDatabase}
function ensureBranches(tenants:TenantRecord[],source:BranchRecord[]){const branches=[...source];for(const tenant of tenants){if(!branches.some(b=>b.tenantId===tenant.id))branches.push(defaultBranch(tenant.id))}return branches}
function primaryBranchId(branches:BranchRecord[],tenantId:string){return branches.find(b=>b.tenantId===tenantId&&b.active)?.id??branches.find(b=>b.tenantId===tenantId)?.id??""}
function safeSingleLine(value:unknown,max:number){return String(value??"").replace(/[\r\n\t]+/g," ").replace(/\s{2,}/g," ").trim().slice(0,max)}
function fallbackProductCode(id:string){const suffix=id.replace(/[^a-z0-9]/gi,"").slice(-8).toUpperCase();return`SKU-${suffix||"PRODUCTO"}`}
function safeProductNumber(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:0}
function normalizeBusinessType(value:unknown):BusinessType{return value==="retail"||value==="food_service"||value==="services"?value:"general"}
function normalizeServiceModes(value:unknown):ServiceMode[]{
  if(!Array.isArray(value))return["counter"];
  const modes=value.filter((mode):mode is ServiceMode=>mode==="counter"||mode==="table"||mode==="takeaway"||mode==="delivery");
  return modes.length?[...new Set(modes)]:["counter"];
}
function normalizeTenantProduct(product:TenantProduct,branchOf:(tenantId:string)=>string):TenantProduct{
  const id=String(product.id||"").trim();
  const rawBarcode=String(product.barcode??"").trim();
  const barcodeValid=rawBarcode.length>0&&rawBarcode.length<=96&&!/[\r\n]/.test(rawBarcode);
  const name=safeSingleLine(product.name,160)||"Producto sin nombre";
  return{
    ...product,
    id,
    tenantId:String(product.tenantId||""),
    branchId:String(product.branchId||branchOf(product.tenantId)),
    masterProductId:safeSingleLine(product.masterProductId,160)||`custom-${id}`,
    barcode:barcodeValid?rawBarcode:fallbackProductCode(id),
    name,
    category:safeSingleLine(product.category,80)||"General",
    imageUrl:safeSingleLine(product.imageUrl,1200)||undefined,
    price:safeProductNumber(product.price),
    cost:safeProductNumber(product.cost),
    stock:safeProductNumber(product.stock),
    trackStock:product.trackStock!==false,
    active:product.active!==false
  };
}
function normalizeSettings(item:TenantSettings):TenantSettings{
  const receiptWidth=item.receiptWidth==="58mm"?"58mm":"80mm";
  return{
    ...defaultSettings(String(item.tenantId||""),String(item.tradeName||"Negocio")),
    ...item,
    tenantId:String(item.tenantId||""),
    tradeName:safeSingleLine(item.tradeName,120)||"Negocio",
    address:safeSingleLine(item.address,240),
    phone:safeSingleLine(item.phone,40),
    businessType:normalizeBusinessType(item.businessType),
    serviceModes:normalizeServiceModes(item.serviceModes),
    tableCount:Math.max(0,Math.min(500,Math.floor(Number(item.tableCount)||0))),
    categoryOrder:Array.isArray(item.categoryOrder)?[...new Set(item.categoryOrder.map(value=>safeSingleLine(value,80)).filter(Boolean))].slice(0,100):undefined,
    showProductImages:item.showProductImages!==false,
    splashEnabled:item.splashEnabled!==false,
    receiptWidth
  };
}
function normalizeOrder(order:FoodOrderRecord,branchOf:(tenantId:string)=>string):FoodOrderRecord{
  const status:FoodOrderStatus=order.status==="preparing"||order.status==="ready"||order.status==="delivered"||order.status==="cancelled"?order.status:"new";
  const paymentStatus:FoodOrderPaymentStatus=order.paymentStatus==="paid"?"paid":order.paymentStatus==="partial"?"partial":"unpaid";
  const serviceMode:ServiceMode=order.serviceMode==="table"||order.serviceMode==="takeaway"||order.serviceMode==="delivery"?order.serviceMode:"counter";
  return{
    ...order,
    id:String(order.id||""),tenantId:String(order.tenantId||""),branchId:String(order.branchId||branchOf(order.tenantId)),
    number:Math.max(1,Math.floor(Number(order.number)||1)),serviceMode,status,paymentStatus,
    tableLabel:safeSingleLine(order.tableLabel,40)||undefined,customerId:safeSingleLine(order.customerId,200)||undefined,
    customerName:safeSingleLine(order.customerName,120)||undefined,phone:safeSingleLine(order.phone,40)||undefined,address:safeSingleLine(order.address,240)||undefined,
    notes:safeSingleLine(order.notes,500)||undefined,total:safeProductNumber(order.total),
    discountPercent:Math.max(0,Math.min(100,Number(order.discountPercent)||0))||undefined,internalConsumption:Boolean(order.internalConsumption)||undefined,
    items:Array.isArray(order.items)?order.items.map(item=>({productId:String(item.productId||""),name:safeSingleLine(item.name,160)||"Producto",qty:Math.max(1,Math.floor(Number(item.qty)||1)),unitPrice:safeProductNumber(item.unitPrice),notes:safeSingleLine(item.notes,240)||undefined,courtesy:Boolean(item.courtesy)||undefined})):[],
    createdAt:String(order.createdAt||new Date().toISOString()),updatedAt:String(order.updatedAt||order.createdAt||new Date().toISOString())
  };
}
function normalize(raw:Partial<KiuboLocalDatabase>|null|undefined):KiuboLocalDatabase{
  const base=cloneInitial();
  const tenants=Array.isArray(raw?.tenants)?raw.tenants:base.tenants;
  const branches=ensureBranches(tenants,Array.isArray(raw?.branches)?raw.branches:[]);
  const branchOf=(tenantId:string)=>primaryBranchId(branches,tenantId);
  const sourceUsers=Array.isArray(raw?.users)?raw.users:base.users;
  const users=sourceUsers.map(user=>({...user,pin:String((user as UserRecord).pin||"1234"),platformAdmin:Boolean((user as UserRecord).platformAdmin||(user.id==="u-owner"&&user.email.toLowerCase()==="admin@kiubo.local"))}));
  const settings=(Array.isArray(raw?.settings)?raw.settings:[]).map(item=>normalizeSettings(item as TenantSettings));
  const branding=Array.isArray(raw?.branding)?[...raw.branding]:[];
  for(const tenant of tenants){
    if(!settings.some(s=>s.tenantId===tenant.id))settings.push(defaultSettings(tenant.id,tenant.name));
    if(!branding.some(b=>b.tenantId===tenant.id))branding.push(defaultBranding(tenant.id,tenant.name));
  }
  const tenantProducts=(Array.isArray(raw?.tenantProducts)?raw.tenantProducts:base.tenantProducts).map(p=>normalizeTenantProduct(p as TenantProduct,branchOf));
  const sales=(Array.isArray(raw?.sales)?raw.sales:[]).map(s=>({...s,branchId:(s as SaleRecord).branchId||branchOf(s.tenantId),clientOperationId:(s as SaleRecord).clientOperationId||s.id}));
  const orders=(Array.isArray(raw?.orders)?raw.orders:[]).map(order=>normalizeOrder(order as FoodOrderRecord,branchOf));
  const cashSessions=(Array.isArray(raw?.cashSessions)?raw.cashSessions:[]).map(s=>({...s,branchId:(s as CashSessionRecord).branchId||branchOf(s.tenantId)}));
  const cashMovements=(Array.isArray(raw?.cashMovements)?raw.cashMovements:[]).map(m=>({...m,branchId:(m as CashMovementRecord).branchId||branchOf(m.tenantId),clientOperationId:(m as CashMovementRecord).clientOperationId||m.id}));
  const credits=(Array.isArray(raw?.credits)?raw.credits:[]).map(c=>({...c,branchId:(c as CreditRecord).branchId||branchOf(c.tenantId)}));
  const creditPayments=(Array.isArray(raw?.creditPayments)?raw.creditPayments:[]).map(p=>({...p,branchId:(p as CreditPaymentRecord).branchId||branchOf(p.tenantId),clientOperationId:(p as CreditPaymentRecord).clientOperationId||p.id}));
  const purchases=(Array.isArray(raw?.purchases)?raw.purchases:[]).map(p=>({
    ...p,
    branchId:(p as PurchaseRecord).branchId||branchOf(p.tenantId),
    documentType:(p as PurchaseRecord).documentType||"other",
    documentNumber:(p as PurchaseRecord).documentNumber||"",
    documentDate:(p as PurchaseRecord).documentDate||String(p.createdAt||epoch).slice(0,10),
    notes:(p as PurchaseRecord).notes||"",
    status:(p as PurchaseRecord).status||"received",
    paidAmount:Number.isFinite(Number((p as PurchaseRecord).paidAmount))?Number((p as PurchaseRecord).paidAmount):Number(p.total||0),
    paymentStatus:(p as PurchaseRecord).paymentStatus||"paid",
    clientOperationId:(p as PurchaseRecord).clientOperationId||p.id
  }));
  const supplierPayments=(Array.isArray(raw?.supplierPayments)?raw.supplierPayments:[]).map(p=>({...p,branchId:(p as SupplierPaymentRecord).branchId||branchOf(p.tenantId),clientOperationId:(p as SupplierPaymentRecord).clientOperationId||p.id}));
  const stockMovements=(Array.isArray(raw?.stockMovements)?raw.stockMovements:[]).map(m=>({...m,branchId:(m as StockMovementRecord).branchId||branchOf(m.tenantId),clientOperationId:(m as StockMovementRecord).clientOperationId||m.id}));
  return{
    tenants,branches,
    masterProducts:Array.isArray(raw?.masterProducts)?raw.masterProducts:base.masterProducts,
    tenantProducts,
    customers:Array.isArray(raw?.customers)?raw.customers:base.customers,
    sales,orders,users,cashSessions,cashMovements,credits,creditPayments,settings,branding,
    suppliers:Array.isArray(raw?.suppliers)?raw.suppliers:[],
    purchases,supplierPayments,stockMovements,
    syncQueue:Array.isArray(raw?.syncQueue)?raw.syncQueue:[],
    auditLogs:Array.isArray(raw?.auditLogs)?raw.auditLogs:[],
    syncCursor:typeof raw?.syncCursor==="string"?raw.syncCursor:undefined
  };
}

function writeDatabase(db:KiuboLocalDatabase){if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}
function recordKey(entity:SyncEntity,record:Record<string,unknown>){if(entity==="settings"||entity==="branding")return String(record.tenantId||"");return String(record.id||"")}
function tenantFor(entity:SyncEntity,record:Record<string,unknown>){return entity==="tenants"?String(record.id||""):String(record.tenantId||"")}
function trackingKey(entity:SyncEntity,record:Record<string,unknown>){return`${tenantFor(entity,record)}::${recordKey(entity,record)}`}
function branchFor(entity:SyncEntity,record:Record<string,unknown>){if(entity==="branches")return String(record.id||"");const value=record.branchId;return typeof value==="string"&&value?value:undefined}
function recordsOf(db:KiuboLocalDatabase,entity:SyncEntity){return (db[entity] as unknown as Record<string,unknown>[])||[]}
function sameRecord(a?:Record<string,unknown>,b?:Record<string,unknown>){return JSON.stringify(a)===JSON.stringify(b)}
function enqueueChange(next:KiuboLocalDatabase,entity:SyncEntity,before:Record<string,unknown>|undefined,after:Record<string,unknown>|undefined){
  if(sameRecord(before,after))return;
  const source=after??before;if(!source)return;
  const entityId=recordKey(entity,source),tenantId=tenantFor(entity,source);if(!entityId||!tenantId)return;
  const branchId=branchFor(entity,source),now=new Date().toISOString(),action=after?"upsert" as const:"delete" as const;
  const existing=next.syncQueue.find(item=>item.tenantId===tenantId&&item.entityType===entity&&item.entityId===entityId&&(item.status==="pending"||item.status==="failed"));
  if(existing){existing.action=action;existing.payload=after??{id:entityId};existing.branchId=branchId;existing.status="pending";existing.attempts=0;existing.updatedAt=now;delete existing.lastError}
  else next.syncQueue.push({id:makeId("queue"),operationId:makeId("op"),tenantId,branchId,entityType:entity,entityId,action,payload:after??{id:entityId},status:"pending",attempts:0,createdAt:now,updatedAt:now});
  const session=loadLocalSession();
  next.auditLogs.push({id:makeId("audit"),tenantId,branchId,actorUserId:session?.userId,action:`${entity}.${action}`,entityType:entity,entityId,metadata:{deviceId:getLocalDeviceId()},createdAt:now});
}
function trackChanges(previous:KiuboLocalDatabase,next:KiuboLocalDatabase){
  for(const entity of TRACKED_COLLECTIONS){
    const before=new Map(recordsOf(previous,entity).map(record=>[trackingKey(entity,record),record]));
    const after=new Map(recordsOf(next,entity).map(record=>[trackingKey(entity,record),record]));
    const keys=new Set([...before.keys(),...after.keys()]);
    for(const key of keys)enqueueChange(next,entity,before.get(key),after.get(key));
  }
  const synced=next.syncQueue.filter(item=>item.status==="synced").slice(-250);
  const active=next.syncQueue.filter(item=>item.status!=="synced");
  next.syncQueue=[...synced,...active].slice(-2000);
  next.auditLogs=next.auditLogs.slice(-1500);
}

export function loadLocalDatabase():KiuboLocalDatabase{if(typeof window==="undefined")return cloneInitial();try{const stored=window.localStorage.getItem(STORAGE_KEY);if(!stored){const fresh=cloneInitial();writeDatabase(fresh);return fresh}const normalized=normalize(JSON.parse(stored) as Partial<KiuboLocalDatabase>);writeDatabase(normalized);return normalized}catch{return cloneInitial()}}
export function saveLocalDatabase(db:KiuboLocalDatabase,options?:{trackChanges?:boolean}){if(typeof window==="undefined")return;let previous:KiuboLocalDatabase;try{const raw=window.localStorage.getItem(STORAGE_KEY);previous=raw?normalize(JSON.parse(raw) as Partial<KiuboLocalDatabase>):cloneInitial()}catch{previous=cloneInitial()}const next=normalize(db);if(options?.trackChanges!==false)trackChanges(previous,next);writeDatabase(next)}
export function resetLocalDatabase(){const fresh=cloneInitial();writeDatabase(fresh);return fresh}
export function makeId(prefix:string){const uuid=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;return`${prefix}-${uuid}`}
export function getLocalDeviceId(){if(typeof window==="undefined")return"server";let id=window.localStorage.getItem(DEVICE_KEY);if(!id){id=makeId("device");window.localStorage.setItem(DEVICE_KEY,id)}return id}
export function loadLocalSession():LocalSession|null{if(typeof window==="undefined")return null;try{const raw=window.localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw) as LocalSession:null}catch{return null}}
export function saveLocalSession(session:LocalSession){if(typeof window!=="undefined")window.localStorage.setItem(SESSION_KEY,JSON.stringify(session))}
export function clearLocalSession(){if(typeof window!=="undefined")window.localStorage.removeItem(SESSION_KEY)}
export function getPrimaryBranch(db:KiuboLocalDatabase,tenantId:string){return db.branches.find(b=>b.tenantId===tenantId&&b.active)??db.branches.find(b=>b.tenantId===tenantId)}
export function getWorkspaceContext(db:KiuboLocalDatabase){
  const session=loadLocalSession();
  const user=session?db.users.find(u=>u.id===session.userId&&u.active):undefined;
  let tenantId=user?.platformAdmin?(session?.activeTenantId||user.tenantId):(user?.tenantId||session?.tenantId||PILOT_TENANT_ID);
  if(!db.tenants.some(t=>t.id===tenantId&&t.plan!=="Internal"))tenantId=user?.tenantId&&db.tenants.some(t=>t.id===user.tenantId)?user.tenantId:PILOT_TENANT_ID;
  const branches=db.branches.filter(b=>b.tenantId===tenantId&&b.active);
  let branchId=session?.activeBranchId||branches[0]?.id||"";
  if(!branches.some(b=>b.id===branchId))branchId=branches[0]?.id||"";
  return{session,user,tenantId,branchId,tenant:db.tenants.find(t=>t.id===tenantId),branch:db.branches.find(b=>b.id===branchId),branches};
}
export function switchWorkspace(tenantId:string,branchId?:string){
  const session=loadLocalSession();if(!session)return;
  const db=loadLocalDatabase();const user=db.users.find(u=>u.id===session.userId&&u.active);if(!user)return;
  const allowedTenant=user.platformAdmin?tenantId:user.tenantId;
  const branch=db.branches.find(b=>b.tenantId===allowedTenant&&b.id===branchId&&b.active)??getPrimaryBranch(db,allowedTenant);
  saveLocalSession({...session,activeTenantId:allowedTenant,activeBranchId:branch?.id||""});
}
export function getTenant(db:KiuboLocalDatabase,tenantId?:string){const id=tenantId??getWorkspaceContext(db).tenantId;return db.tenants.find(t=>t.id===id)}
export function getTenantSettings(db:KiuboLocalDatabase,tenantId?:string){const id=tenantId??getWorkspaceContext(db).tenantId;return db.settings.find(s=>s.tenantId===id)??defaultSettings(id,db.tenants.find(t=>t.id===id)?.name??"Negocio")}
export function getTenantBranding(db:KiuboLocalDatabase,tenantId?:string){const id=tenantId??getWorkspaceContext(db).tenantId;return db.branding.find(b=>b.tenantId===id)??defaultBranding(id,db.tenants.find(t=>t.id===id)?.name??"Negocio")}
export function getOpenCashSession(db:KiuboLocalDatabase,tenantId?:string,branchId?:string){const ctx=getWorkspaceContext(db);const tid=tenantId??ctx.tenantId;const bid=branchId??ctx.branchId;return db.cashSessions.find(s=>s.tenantId===tid&&s.branchId===bid&&s.status==="open")}
export function nextOrderNumber(db:KiuboLocalDatabase,tenantId:string,branchId:string){return db.orders.filter(order=>order.tenantId===tenantId&&order.branchId===branchId).reduce((max,order)=>Math.max(max,order.number),0)+1}
export function getSyncSummary(db=loadLocalDatabase()){return{pending:db.syncQueue.filter(item=>item.status==="pending").length,syncing:db.syncQueue.filter(item=>item.status==="syncing").length,failed:db.syncQueue.filter(item=>item.status==="failed").length,synced:db.syncQueue.filter(item=>item.status==="synced").length,total:db.syncQueue.length,cursor:db.syncCursor}}
export function updateSyncOperation(operationId:string,status:SyncStatus,error?:string){const db=loadLocalDatabase(),now=new Date().toISOString();db.syncQueue=db.syncQueue.map(item=>item.operationId===operationId?{...item,status,attempts:status==="syncing"?item.attempts+1:item.attempts,updatedAt:now,lastError:error}:item);saveLocalDatabase(db,{trackChanges:false});return db}
export function createLocalBackup(){return JSON.stringify({format:"kiubo-local-backup-v6",exportedAt:new Date().toISOString(),deviceId:getLocalDeviceId(),database:loadLocalDatabase()},null,2)}
export function restoreLocalBackup(raw:string){const parsed=JSON.parse(raw) as {database?:Partial<KiuboLocalDatabase>};const db=normalize(parsed.database??parsed as Partial<KiuboLocalDatabase>);writeDatabase(db);return db}
