import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=(name)=>fs.readFileSync(name,"utf8");
const expect=(name,expression)=>assert.match(source(name),expression,name);
const reject=(name,expression)=>assert.doesNotMatch(source(name),expression,name);
const components=[
"components/SafeCatalogClient.tsx","components/InventoryClient.tsx",
"components/FoodOrdersClientPro.tsx","components/CashClient.tsx",
"components/PurchasesClient.tsx","components/PageLoadingSkeleton.tsx"
];
for(const file of components){
 const text=source(file);
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0,`${file}: TSX parsing failed`);
 const result=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
 assert.equal((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,`${file}: JSX transpilation failed`);
}
const orders="components/FoodOrdersClientPro.tsx",cash="components/CashClient.tsx",inv="components/InventoryClient.tsx",product="components/SafeCatalogClient.tsx";
reject(orders,/Modo rápido:|Flujo rápido activo:/);
reject(cash,/Cuadre fácil|Ver cómo se calcula el efectivo esperado|Cuenta solo el efectivo físico:/);
expect(cash,/reconcileCashSession\(next,session\)/);
expect(cash,/pendingTurnFinancialOperations\(next/);
expect(cash,/unverifiedDenominationMovements\(next/);
expect(cash,/ambiguousMovements\.length>0&&!manualCashReviewed/);
expect(cash,/closeDifference=cashSummary/);
expect(cash,/openFiados=fiadoCredits\.filter\(c=>c\.status==="open"\)/);
expect(cash,/visibleFiados=showPaidCredits\?fiadoCredits:openFiados/);
expect(inv,/available=availability\.get\(p\.id\)\?\.available\?\?p\.stock/);
expect(inv,/reserved=availability\.get\(p\.id\)\?\.reserved\|\|0/);
expect(inv,/reservedKinds=\[\.\.\.availability\.values\(\)\]\.filter/);
expect(orders,/styles\.historyIdentity/);
expect("components/FoodOrdersClient.module.css",/\.historyRow\{grid-template-columns:minmax\(0,1\.25fr\)/);
expect("components/SafeCatalogClient.module.css",/height:calc\(100dvh - 28px\)/);
expect("app/experience-v8.css",/overflow-x:clip/);
for(const [file,variant] of [[product,"products"],[inv,"inventory"],[orders,"orders"],[cash,"cash"],["components/PurchasesClient.tsx","purchases"]]){
 expect(file,new RegExp('PageLoadingSkeleton view="'+variant+'"'));
 expect(file,/useLayoutEffect\(/);
 reject(file,/className="loading-card"/);
}
expect("components/PageLoadingSkeleton.module.css",/prefers-reduced-motion:reduce/);
console.log("OK: YUKI operational UI clarity, finance guards, responsive stock/history and loading skeletons.");
