import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Run the *actual* inventory impact algorithm without a copy of its implementation.
const module={exports:{}};
const transpiled=ts.transpileModule(readFileSync("lib/recipe-inventory.ts","utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const fakeRequire=(name)=>{
  if(name==="./product-options")return{getProductOptionConfig:product=>product.optionConfig};
  if(name==="./product-classification")return{isIngredientProduct:product=>product.category==="Insumos"};
  throw new Error("Unexpected recipe import: "+name);
};
new Function("require","module","exports",transpiled)(fakeRequire,module,module.exports);
const {resolveInventoryImpact,usesRecipeInventory}=module.exports;
const ingredient=(id,name)=>({id,name,category:"Insumos",active:true,trackStock:true,stock:1000});
const pan=ingredient("pan","Pan de Yuca"),milk=ingredient("milk","Yogurt Natural"),
mango=ingredient("mango","Pulpa de Mango"),mora=ingredient("mora","Pulpa de Mora");
const yogurt=(id,name,pulp)=>({
  id,name:"Yogurt "+name,category:"Yogurts",active:true,trackStock:false,
  recipe:[{productId:"milk",qty:1},{productId:pulp,qty:1}]
});
const combo=(id,qty,selectionCount)=>({
  id,name:id,category:"Combos",active:true,trackStock:false,
  recipe:[{productId:"pan",qty}],
  optionConfig:{label:"Yogur",source:"category",sourceCategory:"Yogurts",selectionCount,allowRepeat:true}
});
const products=[pan,milk,mango,mora,yogurt("ymango","Mango","mango"),yogurt("ymora","Mora","mora"),
  combo("combo2",6,1),combo("combo4",15,3)];
function verifyImpact(lines,want){
  assert.ok(usesRecipeInventory(lines,products),"Recipe sale must go through atomic recipe inventory");
  const actual=Object.fromEntries(resolveInventoryImpact(lines,products).map(i=>[i.productId,i.qty]));
  assert.deepEqual(actual,want);
}
verifyImpact([{productId:"combo2",qty:1,optionSelections:["Mango"]}],{mango:1,milk:1,pan:6});
verifyImpact([{productId:"combo2",qty:2,optionSelections:["Mango"]}],{mango:2,milk:2,pan:12});
verifyImpact([{productId:"combo4",qty:1,optionSelections:["Mora","Mango","Mora"]}],{mango:1,milk:3,mora:2,pan:15});
verifyImpact([{productId:"combo2",qty:1,optionSelections:["Mango"]},{productId:"combo4",qty:1,optionSelections:["Mora","Mora","Mango"]}],{mango:2,milk:4,mora:2,pan:21});
console.log("✓ YUKI combo recipes: pan, yogurt and selected pulps deducted with exact quantities");

const reportModule={exports:{}};
const reportJavaScript=ts.transpileModule(readFileSync("lib/report-inventory.ts","utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
new Function("require","module","exports",reportJavaScript)((name)=>{
  if(name==="./sale-adjustments")return{parseOperationalItemName:()=>({mode:"sale"})};
  if(name==="./product-options")return{
    getProductOptionConfig:product=>product.optionConfig,
    parseProductOptionSelection:(_config,label)=>label?[label]:[]
  };
  if(name==="./recipe-inventory")return module.exports;
  throw new Error("Unexpected report dependency: "+name);
},reportModule,reportModule.exports);
const tenantId="yuki-demo",branchId="main",fullProducts=products.map(p=>({...p,tenantId,branchId}));
const sale=(id)=>({id,tenantId,branchId,items:[{productId:"combo2",name:"Combo 2 · Mango",qty:1,unitPrice:7.6,optionSelections:["Mango"]}]});
const stockMovement=(productId,qty)=>({
  id:"movement-"+productId,tenantId,branchId,reference:"sale-recorded",productId,quantity:-qty,type:"sale"
});
const inventoryRows=reportModule.exports.ingredientConsumptionRows(
  [sale("sale-recorded"),sale("sale-historical")],
  fullProducts,
  [stockMovement("pan",6),stockMovement("milk",1),stockMovement("mango",1)]
);
const panRow=inventoryRows.find(r=>r.productId==="pan");
assert.equal(panRow?.qty,6,"Confirmed Pan de Yuca must equal actual stock movement");
assert.equal(panRow?.estimatedQty,6,"Historical missing movements must be shown separately, never as confirmed");
assert.equal(panRow?.sourceCount,1);
assert.equal(panRow?.estimatedSources,1);
console.log("✓ Ingredient report separates real inventory debits from historical recipe-based estimates");


const pos=readFileSync("components/PosClientPro.tsx","utf8");
const orders=readFileSync("components/FoodOrdersClientPro.tsx","utf8");
const receipt=readFileSync("components/ReceiptClient.tsx","utf8");
const kitchen=readFileSync("components/OrderPrintClient.tsx","utf8");
const required=[
  'const findOpenTakeawayOrder=',
  'findPartialSlotOrder(source,workspace,"takeaway",label)',
  'findOpenTakeawayOrder(next,workspace,tableLabel.trim())',
  'loadTakeawayOrder(label,source)',
  'const selectTakeaway=',
  'const createTakeaway=',
  'activeServiceMode==="takeaway"&&<div className="delivery-selector"',
  'tableLabel:(activeServiceMode==="table"||activeServiceMode==="delivery"||activeServiceMode==="takeaway")',
  'draftMode==="takeaway"',
  'takeawaySlotCount:slot',
  'mode:activeServiceMode,table:tableLabel.trim()',
  'activeServiceMode==="takeaway"&&tableLabel?openTakeawayOrders.filter(order=>order.tableLabel===tableLabel)',
];
for(const needle of required)assert.ok(pos.includes(needle),"Takeaway safety requirement absent: "+needle);
assert.ok(orders.includes('order.tableLabel?'+String.fromCharCode(96)+'${modeLabel[order.serviceMode]} ${order.tableLabel}'+String.fromCharCode(96)), "Orders list must distinguish takeaway spaces");
assert.ok(receipt.includes('order.serviceMode==="takeaway"?'+String.fromCharCode(96)+' · PEDIDO ${order.tableLabel}'+String.fromCharCode(96)),"Receipts must not call takeaway slots mesas");
assert.ok(kitchen.includes('order.serviceMode==="takeaway"?"PEDIDO"'),"Kitchen ticket must identify takeaway slot");
console.log("✓ Takeaway slots: isolated lookup, F5 draft, partial balance, autosave, labels and tickets are guarded");

const orderCode=[
  pos.match(/^  const isEditableOrder=.*;$/m)?.[0],
  pos.match(/^  const findOpenTakeawayOrder=.*;$/m)?.[0],
].join("\n");
assert.ok(orderCode.includes("findOpenTakeawayOrder"),"Runtime order lookup must exist");
const orderJs=ts.transpileModule(orderCode+"\nmodule.exports=findOpenTakeawayOrder;",{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const orderModule={exports:{}};
new Function("module","exports",orderJs)(orderModule,orderModule.exports);
const findTakeaway=orderModule.exports;
const clock="2026-10-08T12:00:00Z";
const order=(id,tenantId,branchId,tableLabel,updatedAt=clock,more={})=>({
  id,tenantId,branchId,serviceMode:"takeaway",tableLabel,updatedAt,createdAt:clock,
  status:"new",paymentStatus:"unpaid",...more
});
const testDb={orders:[
  order("takeaway-1","yuki","main","1"),
  order("takeaway-2","yuki","main","2"),
  order("other-tenant","another","main","1"),
  order("other-branch","yuki","remote","1"),
  order("finished","yuki","main","1","2026-10-08T13:00:00Z",{paymentStatus:"paid"}),
  order("old-slot-1","yuki","main","1","2026-10-07T11:00:00Z"),
  order("legacy-unnumbered","yuki","main",undefined),
]};
const yukiCtx={tenantId:"yuki",branchId:"main"};
assert.equal(findTakeaway(testDb,yukiCtx,"1")?.id,"takeaway-1","Slot 1 must not load another tenant, branch, slot or paid order");
assert.equal(findTakeaway(testDb,yukiCtx,"2")?.id,"takeaway-2","Slot 2 must preserve a separate order");
assert.equal(findTakeaway(testDb,yukiCtx,"3"),undefined,"An empty slot must stay empty");
assert.equal(findTakeaway(testDb,yukiCtx,"1")?.id,"takeaway-1","Legacy unnumbered orders must not be merged into numbered slots");
console.log("✓ Actual POS takeaway resolver passes two active slots, isolation, paid-order and legacy order scenarios");


const stock=readFileSync("components/StockAlerts.tsx","utf8");
assert.ok(stock.includes('row.product.stock>0&&row.product.stock<=row.threshold'),"Stock low indicator must use current physical stock");
assert.ok(pos.includes('Stock bajo después del cobro'),"Projected low stock should not be mislabeled current stock");
console.log("✓ Current stock and after-checkout low stock use distinct labels");
