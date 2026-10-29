import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

function loadActual(file,deps={}){
  const js=ts.transpileModule(readFileSync(file,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const mod={exports:{}};
  new Function("require","module","exports",js)(name=>{
    if(!(name in deps))throw Error(file+": unexpected import "+name);
    return deps[name];
  },mod,mod.exports);
  return mod.exports;
}
const classification=loadActual("lib/product-classification.ts");
const options=loadActual("lib/product-options.ts",{"./product-classification":classification});
const inventory=loadActual("lib/recipe-inventory.ts",{
  "./product-options":options,"./product-classification":classification
});
const base={tenantId:"yuki",branchId:"matriz",active:true,stock:50};
const ingredient=(id,name)=>({...base,id,name,category:"Insumos",productKind:"ingredient",trackStock:true});
const yogurt=(id,name,pulp)=>({...base,id,name,category:"Yogurts",trackStock:false,
  recipe:[{productId:"natural",qty:1},{productId:pulp,qty:1}]});
const products=[
  ingredient("bread","Pan de Yuca"),ingredient("natural","Yogurt Natural"),
  ingredient("peach","Pulpa de Durazno"),ingredient("mango","Pulpa de Mango"),ingredient("mora","Pulpa de Mora"),
  {...base,id:"peach-unconfigured",name:"Yogurt Durazno",category:"Yogurts",trackStock:false},
  yogurt("peach-configured","Yogurt de Durazno","peach"),
  yogurt("yogurt-mango","Yogurt Mango","mango"),yogurt("yogurt-mora","Yogurt Mora","mora"),
  {...base,id:"plain-unconfigured",name:"Yogurt Natural",category:"Yogurts",trackStock:false,recipe:[]},
  {...base,id:"combo4",name:"Combo 4",category:"Combos",trackStock:false,
    recipe:[{productId:"bread",qty:15}],
    optionConfig:{label:"Yogur",selectionCount:3,source:"category",sourceCategory:"Yogurts",allowRepeat:true}}
];
const selection=[{productId:"combo4",qty:1,optionSelections:["Durazno","Mango","Mora"]}];
const quantities=(lines,source=products)=>Object.fromEntries(inventory.resolveInventoryImpact(lines,source).map(x=>[x.productId,x.qty]));
const before=JSON.stringify(products);
assert.deepEqual(quantities(selection),{bread:15,mango:1,mora:1,natural:3,peach:1},
  "Combo 4 with Durazno must debit all 3 yogurts and its peach pulp, even with an unconfigured duplicate");
assert.deepEqual(quantities(selection,[...products].reverse()),quantities(selection),"Sync order must not change the selected recipe");
const config=options.getProductOptionConfig(products.at(-1));
assert.deepEqual(options.getProductOptionChoices(config,products,"combo4").filter(x=>/Durazno/.test(x.label)).map(x=>x.label),["Durazno"],
  "Durazno and de Durazno must not be offered as two separate flavors");
assert.deepEqual(quantities([{productId:"combo4",qty:2,optionSelections:["de Durazno","Durazno","Durazno"]}]),
  {bread:30,natural:6,peach:6},"Legacy labels, repeat flavors and multiple combos retain exact quantities");
assert.equal(inventory.inventorySelectionError(selection,products),undefined);
assert.match(inventory.inventorySelectionError([{productId:"peach-unconfigured",qty:1}],products),/receta.*Durazno/i,
  "Selling the unconfigured duplicate directly must not silently skip inventory either");
assert.match(inventory.inventorySelectionError([{productId:"plain-unconfigured",qty:1}],products),/receta.*Natural/i);
assert.equal(inventory.inventorySelectionError([{productId:"peach-configured",qty:1}],products),undefined);
assert.match(inventory.inventorySelectionError([{...selection[0],optionSelections:["Natural","Mango","Mora"]}],products),/receta.*Natural/i,
  "A flavor without a recipe must be rejected instead of silently under-debiting");
assert.match(inventory.inventorySelectionError([{...selection[0],optionSelections:["Durazno"]}],products),/3/,
  "A restored draft cannot sell a combo with missing selections");
assert.match(inventory.inventorySelectionError([{...selection[0],optionSelections:["Desconocido","Mango","Mora"]}],products),/Desconocido/);
const ambiguous=[...products,yogurt("different-peach-recipe","Yogurt Durazno","mango")];
assert.match(inventory.inventorySelectionError(selection,ambiguous),/varias recetas/i,
  "Different recipes behind the same flavor require configuration instead of arbitrary selection");
const foreign={...yogurt("foreign-peach","Yogurt Durazno","mango"),tenantId:"another"};
assert.deepEqual(quantities(selection,[foreign,...products]),quantities(selection),"Other tenants cannot supply a flavor recipe");
assert.equal(JSON.stringify(products),before,"Resolving choices must never rename products or change recipes and stock");
console.log("✓ Flavor inventory: configured Durazno, legacy labels, repeats, missing/ambiguous recipes, tenant isolation and read-only resolution");

// Execute the actual POS handlers: a restored invalid cart must never reach a write.
const pos=ts.createSourceFile("PosClientPro.tsx",readFileSync("components/PosClientPro.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function handler(name,scope){
  let initializer;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name)initializer=node.initializer;
    ts.forEachChild(node,visit);
  }
  visit(pos);assert.ok(initializer,"Actual POS handler missing: "+name);
  const code=ts.transpileModule("const handler="+initializer.getText(pos)+";",{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  return new Function(...Object.keys(scope),code+"\nreturn handler;")(...Object.values(scope));
}
const invalidLine={...products.at(-1),qty:1,optionSelections:["Natural","Mango","Mora"]};
const handlerDb={tenantProducts:products,orders:[],sales:[],stockMovements:[],syncQueue:[]};
const handlerBefore=JSON.stringify(handlerDb),messages=[];
const scope={
  loadLocalDatabase:()=>handlerDb,getWorkspaceContext:()=>({tenantId:"yuki",branchId:"matriz"}),
  inventorySelectionError:inventory.inventorySelectionError,setMessage:message=>messages.push(message),
  ctx:{tenantId:"yuki"},foodService:true,validateOrderDetails:()=>true,cart:[invalidLine],
  balanceMode:false,canAdjustSale:true,appliedDiscount:0,internalConsumption:false,
  payment:"cash",total:21,cashReceived:"",inventoryLines:[{productId:"combo4",qty:1,optionSelections:invalidLine.optionSelections}],allProducts:products
};
handler("addDirect",scope)(products.at(-1),"Yogur Natural",invalidLine.optionSelections);
assert.match(messages.at(-1),/receta.*Natural/i);
assert.equal(handler("saveOrder",scope)(false),null);
assert.match(messages.at(-1),/receta.*Natural/i);
await handler("checkout",scope)();
assert.match(messages.at(-1),/receta.*Natural/i);
assert.equal(JSON.stringify(handlerDb),handlerBefore,"Rejected add/save/checkout must leave products, orders, sales and sync queue untouched");
console.log("✓ Actual POS add, order-save and checkout handlers reject unconfigured flavors before writing");
