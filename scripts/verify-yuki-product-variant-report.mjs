import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const load=(file,deps={})=>{
 const js=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 new Function("require","module","exports",js)(n=>{if(!(n in deps))throw Error("Unexpected import "+n);return deps[n]},mod,mod.exports);
 return mod.exports;
};
const adjustments=load("lib/sale-adjustments.ts");
const classification=load("lib/product-classification.ts");
const {soldProductReport,yukiYogurtFlavorReport}=load("lib/report-sold-products.ts",{
 "./sale-adjustments":adjustments,
 "./product-classification":classification
});
const tenant="yuki",branch="branch-a";
const p=(id,name,category="Bebidas",productKind)=>({id,name,category,productKind,tenantId:tenant,branchId:branch});
const products=[p("combo1","Combo 1"),p("combo2","Combo 2"),p("combo3","Combo 3"),p("combo4","Combo 4"),p("fresa","Yogurt Fresa"),p("delivery","Domicilio","Cargos","charge")];
const item=(productId,qty,optionLabel="",name)=>({productId,name:name||products.find(x=>x.id===productId)?.name+(optionLabel?" · "+optionLabel:""),qty,unitPrice:10,...(optionLabel?{optionLabel}:{})});
const sale=(id,items)=>({id,tenantId:tenant,branchId:branch,items,payment:"cash",total:items.reduce((sum,it)=>sum+it.qty*it.unitPrice,0),createdAt:"2026-10-15T20:00:00Z"});
const sales=[
 sale("1",[item("combo1",3,"Yogur Fresa")]),
 sale("2",[item("combo1",1,"Yogur Fresa","Combo 1 · Yogur Fresa · Desc. 100%")]),
 sale("3",[item("combo1",6,"Yogur Mora")]),
 sale("4",[item("combo1",4,"Yogur Mango")]),
 sale("5",[item("combo2",1,"Yogur Fresa")]),
 sale("6",[item("combo2",5,"Yogur Mora")]),
 sale("7",[item("combo2",6,"Yogur Coco")]),
 sale("8",[item("combo3",1,"Yogur 1: Mora · Yogur 2: Fresa")]),
 sale("9",[item("combo3",1,"Yogur 1: Fresa · Yogur 2: Banana")]),
 sale("10",[item("combo3",1,"Yogur 1: Coco · Yogur 2: Fresa")]),
 sale("11",[item("combo3",5,"Yogur 1: Mora · Yogur 2: Mango")]),
 sale("12",[item("combo4",2,"Yogur 1: Mora · Yogur 2: Fresa · Yogur 3: Mango")]),
 sale("13",[item("combo4",2,"Yogur 1: Mora · Yogur 2: Mango · Yogur 3: Piña")]),
 sale("14",[item("fresa",1)]),
 sale("15",[item("delivery",6)]),
 sale("16",[item("combo1",2,"Yogurt Fresa","Combo 1 · Yogurt Fresa · Cortesía")])
];
const result=soldProductReport([...sales,sales[0]],products);
const find=id=>result.summary.find(r=>r.id===branch+":"+id);
assert.equal(find("combo1").name,"Combo 1","Never label all 14 combos as fresa");
assert.equal(find("combo1").qty,14,"Commercial totals preserve their original quantities");
assert.equal(find("combo2").qty,12);
assert.equal(find("combo3").qty,8);
assert.equal(find("combo4").qty,4);
assert.equal(find("combo1").variants.find(x=>x.label==="Yogur Fresa").qty,4,"100% price discount still counted as commercial unit");
assert.equal(find("combo2").variants.find(x=>x.label==="Yogur Fresa").qty,1);
assert.equal(find("fresa").qty,1);
assert.equal(result.excluded.courtesy,2);
assert.equal(result.excluded.charge,6);
assert.equal(result.totalUnits,39,"Product totals must exclude charges and courtesy without double counting sale retries");
const fresaCombos=result.summary.filter(x=>x.id.includes("combo")).reduce((sum,r)=>sum+r.variants.reduce((sum,v)=>sum+(v.label.match(/Fresa/gi)||[]).length*v.qty,0),0);
assert.equal(fresaCombos+find("fresa").qty,11,"YUKI strawberry pulp example must explain 11 units");
for(const r of result.summary){
 if(r.variants.length)assert.equal(r.variants.reduce((sum,v)=>sum+v.qty,0),r.qty,"Flavour split must sum to product total");
}
const ui=readFileSync("components/ReportsClientPro.tsx","utf8");
assert.ok(ui.includes("soldProductReport(sales,db.tenantProducts"),"Report must call tested canonical grouping helper");
assert.ok(ui.includes("item.variants.map"),"Show real option counts below the associated combo");
assert.ok(ui.includes("rowsByProduct.set(key"),"Every active sellable catalog item must appear, even when sales are zero");
assert.ok(ui.includes("Solo vendidos")&&ui.includes("Toda la carta"),"Richard must be able to choose full or sold-only product lists");
assert.ok(ui.includes("yukiYogurtFlavorReport(sales)"),"YUKI should display separately the real yogurt portions, including combos");
const flavors=yukiYogurtFlavorReport([...sales,sales[0]]);
const flavor=name=>flavors.find(row=>row.name.toLocaleLowerCase("es")===name.toLocaleLowerCase("es"))?.qty||0;
assert.equal(flavor("Fresa"),11,"Yogurt fresa portions include the ten combo servings plus one standalone");
assert.equal(flavor("Mora"),21,"Two-yogurt and three-yogurt combos must count each selected portion");
assert.equal(flavor("Mango"),13,"Combo quantities must multiply flavor portions");
assert.equal(flavor("Coco"),7,"Flavors from combo options are included");
assert.equal(flavor("Piña"),2,"All flavors are listed, not only the six favorites");
console.log("✓ Combo 1 = 14, Combo 2 = 12, fresa combinations = 10 plus 1 standalone, actual historical sales stay untouched");
