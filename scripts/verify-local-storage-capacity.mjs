import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Execute the actual production local-store codec, without a second copy of its logic.
const source=readFileSync("lib/local-store.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const lib={exports:{}};
new Function("module","exports",js)(lib,lib.exports);
const {encodeDatabaseStorage,decodeDatabaseStorage}=lib.exports;

const samples=[
  "", "{}", "Hola Galápagos – ñ ü 🐢 漢字\n".repeat(4000),
  JSON.stringify({huge:"A".repeat(500000),quotes:'\\"\\\\',spaces:"\t\n"}),
  JSON.stringify({nested:Array.from({length:1600},(_,i)=>({id:"sale-"+i,total:i/100,items:[{name:"Yogur de piña y mora",qty:1,unitPrice:4.5}],notes:i%2?"mesa 1":"mesa 2"}))}),
];
for(const raw of samples){
  const packed=encodeDatabaseStorage(raw);
  assert.equal(decodeDatabaseStorage(packed),raw,"lossless Unicode and nested JSON roundtrip");
}
console.log("✓ Lossless codec: Unicode, nested objects, small and large payloads");

const records=Array.from({length:8000},(_,i)=>({
  id:"movement-"+i,tenantId:"tenant-yuki",branchId:"yuki-main",
  productId:"ingredient-"+(i%25),clientOperationId:"op-"+i,
  createdAt:new Date(1759000000000+i*30000).toISOString(),status:"synced",
  delta:i%2?-1:1,items:[{name:"Yogurt Banana",qty:1,unitPrice:4.5}],
}));
const full=JSON.stringify({tenants:[{id:"tenant-yuki"}],sales:records.slice(0,1100),orders:records.slice(1100,2700),stockMovements:records,syncQueue:records.slice(0,800),auditLogs:[]});
const packed=encodeDatabaseStorage(full);
assert.ok(packed.length<full.length*0.7,"large POS state did not compress enough");
assert.equal(decodeDatabaseStorage(packed),full,"all orders, sales and queues remain intact");
console.log("✓ Large offline dataset preserved:",full.length,"chars to",packed.length);

assert.throws(()=>decodeDatabaseStorage(packed.slice(0,-10)),"truncated snapshot rejected");
const altered=packed.slice(0,80)+(packed[80]==="A"?"B":"A")+packed.slice(81);
assert.throws(()=>decodeDatabaseStorage(altered),"tampered snapshot rejected");
console.log("✓ Corrupted snapshots are rejected; never substitute a blank database");

const store=readFileSync("lib/local-store.ts","utf8");
const durability=readFileSync("lib/offline-durability.ts","utf8");
const pos=readFileSync("components/PosClientPro.tsx","utf8");
assert.ok(store.includes("encodeDatabaseStorage(JSON.stringify(db))"));
assert.ok(store.includes("JSON.parse(decodeDatabaseStorage(stored))"));
const getter=store.slice(store.indexOf("export function loadLocalDatabase()"),store.indexOf("export function saveLocalDatabase("));
assert.ok(!getter.includes("writeDatabase(normalized)"),"loading cannot rewrite the database");
assert.ok(!getter.includes("catch{return cloneInitial()}"),"damaged data cannot fall back to blank state");
assert.ok(durability.includes("JSON.parse(decodeDatabaseStorage(raw))"),"recovery must understand compressed shadow copies");
assert.ok(pos.includes("persistCurrentContext()"),"table changes must preserve existing cart");
assert.ok(pos.includes("autoguardado de mesa falló"),"autosave failures must be visible");
assert.ok(!pos.includes("setDb(loadLocalDatabase())}};"),"error handler must not overwrite the active table");
console.log("✓ POS, data store and offline shadow integration guards passed");
