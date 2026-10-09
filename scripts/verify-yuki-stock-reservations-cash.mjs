import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

function loadActual(path,mocks={}){
  const js=ts.transpileModule(readFileSync(path,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const mod={exports:{}};
  new Function("require","module","exports",js)((name)=>{
    if(!(name in mocks))throw new Error(path+": unexpected import "+name);
    return mocks[name];
  },mod,mod.exports);
  return mod.exports;
}
const options={
  getProductOptionConfig:p=>p.optionConfig,
  parseProductOptionSelection:(_config,label)=>label?label.split(" + ").map(x=>x.trim()):[]
};
const classification={isIngredientProduct:p=>p.category==="Insumos"};
const recipe=loadActual("lib/recipe-inventory.ts",{"./product-options":options,"./product-classification":classification});
const reservations=loadActual("lib/inventory-reservations.ts",{"./recipe-inventory":recipe,"./product-options":options});
const ingredient=(id,stock)=>({id,tenantId:"yuki",branchId:"main",name:id,stock,
  trackStock:true,active:true,category:"Insumos"});
const apple=ingredient("apple",2),pulp=ingredient("pulp",3);
const juice={id:"juice",tenantId:"yuki",branchId:"main",name:"Jugo de manzana",stock:0,
  trackStock:false,active:true,category:"Jugos",recipe:[{productId:"apple",qty:1}]};
const other={...apple,tenantId:"another",stock:0};
const order=(id,status="new",paymentStatus="unpaid",more={})=>({
  id,tenantId:"yuki",branchId:"main",status,paymentStatus,serviceMode:"table",tableLabel:id,
  createdAt:"2026-10-09T10:00:00Z",updatedAt:"2026-10-09T10:10:00Z",
  items:[{productId:"juice",name:"Jugo de manzana",qty:1,unitPrice:3}],...more
});
const db={tenantProducts:[apple,pulp,juice,other],orders:[],sales:[],credits:[],creditPayments:[],cashMovements:[]};
const {stockAvailability,inventoryDeficits,reservedInventory}=reservations;
const stock=()=>stockAvailability(db,"yuki","main").get("apple");
const selection=[{productId:"juice",qty:1}];
assert.equal(stock().physical,2); assert.equal(stock().available,2);
db.orders=[order("table-1")];
assert.equal(stock().reserved,1);assert.equal(stock().available,1,"one apple committed while unpaid");
assert.equal(inventoryDeficits(db,"yuki","main",[{productId:"juice",qty:2}]).length,1,"stop overselling available apple");
assert.equal(inventoryDeficits(db,"yuki","main",selection,"table-1").length,0,"editing own reserved order should not double reserve");
db.orders.push(order("table-2"));
assert.equal(stock().available,0,"second open table reserves the final apple");
assert.equal(inventoryDeficits(db,"yuki","main",selection).length,1,"third cashier cannot accept another apple juice");
db.orders[0].status="cancelled";
assert.equal(stock().available,1,"cancellation releases one apple without changing physical count");
assert.equal(apple.stock,2,"opening and cancelling orders never physically debit inventory");
db.orders[1].paymentStatus="paid";
db.orders[1].saleId="paid-sale-2"; apple.stock=1;
assert.equal(stock().reserved,0);
assert.equal(stock().available,1,"payment debits physical stock only once");
db.orders.push(order("partial","new","partial",{saleId:"paid-sale-3"}));
assert.equal(stock().reserved,0,"partial payments are already part of a sale; no duplicate reservation");
db.orders.push({...order("table-4"),tenantId:"another"});
db.orders.push({...order("table-5"),branchId:"remote"});
assert.equal(stock().reserved,0,"other tenants and branches never reserve YUKI inventory");
db.orders=[order("table-6"),order("table-6","new","unpaid",{updatedAt:"2026-10-09T10:15:00Z"})];
assert.equal(stock().reserved,1,"sync duplicates with same order ID are not counted twice");
console.log("✓ Stock reservations: pending, second table, shortage, cancellation, partial payment, sale, tenant isolation, sync duplicates");

const transferModule=loadActual("lib/transfer-events.ts");
const cashModule=loadActual("lib/cash-payment-events.ts",{
  "./sale-reversal":{saleLifecycle:s=>s.status==="voided"?"voided":"completed"},
  "./transfer-events":transferModule,
});
const sale=(id,payment,total,extra={})=>({id,tenantId:"yuki",branchId:"main",createdAt:"2026-10-09T11:00:00Z",payment,total,items:[],...extra});
const credit=(id,saleId,kind)=>({id,tenantId:"yuki",branchId:"main",saleId,kind,balance:5});
db.sales=[
  sale("cash","cash",12),sale("mixed","mixed",20,{paymentBreakdown:{cash:8,transfer:12}}),
  sale("partial","partial",30),sale("fiado","credit",15),
  sale("void","cash",4,{status:"voided"}),sale("cash","cash",12,{clientOperationId:"retry"}),
  {...sale("cash","cash",100),tenantId:"another"},
];
db.credits=[credit("c1","partial","partial"),credit("c2","fiado","fiado")];
db.creditPayments=[
  {id:"p1",tenantId:"yuki",branchId:"main",creditId:"c1",amount:5,method:"cash",createdAt:"2026-10-09T12:00:00Z"},
  {id:"p2",tenantId:"yuki",branchId:"main",creditId:"c2",amount:6,method:"cash",createdAt:"2026-10-09T12:01:00Z"},
  {id:"p3",tenantId:"yuki",branchId:"main",creditId:"c2",amount:3,method:"transfer",createdAt:"2026-10-09T12:02:00Z"},
];
const cashRows=cashModule.cashPaymentEvents(db,"yuki","main");
assert.equal(cashModule.totalValidCash(cashRows),31,"$12 cash + $8 mixed + $5 partial + $6 fiado; not counting duplicates or void");
assert.equal(cashRows.filter(x=>x.status==="anulada").length,1);
const transfers=transferModule.transferPaymentEvents(db,"yuki","main");
assert.equal(transferModule.totalValidTransfers(transfers),15,"$12 mixed transfer + $3 fiado transfer");
console.log("✓ Cash and transfer ledger: pure cash, mixed, partial, fiado, void, duplicate, tenant separation");

const pos=readFileSync("components/PosClientPro.tsx","utf8");
const inventory=readFileSync("components/InventoryClient.tsx","utf8");
const cash=readFileSync("components/CashClient.tsx","utf8");
for(const phrase of [
"stockAvailability(db,ctx.tenantId,ctx.branchId,activeOrderId||undefined)",
"inventoryDeficits(next,workspace.tenantId,workspace.branchId,cart.map",
"inventoryDeficits(latest,scope.tenantId,scope.branchId,candidate.map",
"disabled={blockedProduct}"
])assert.ok(pos.includes(phrase),"POS guard missing: "+phrase);
for(const phrase of ["Comprometido:","disponible</b>","stockAvailability(db,ctx.tenantId,ctx.branchId)"]){
 assert.ok(inventory.includes(phrase),"Inventory availability display missing: "+phrase);
}
for(const phrase of ["cashPaymentEvents(db,ctx.tenantId,ctx.branchId)","Efectivo y transferencias","Movimientos de efectivo"]){
 assert.ok(cash.includes(phrase),"Cash history display missing: "+phrase);
}
console.log("✓ POS, inventory and cash display guards PASS");
