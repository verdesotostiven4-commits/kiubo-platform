import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=fs.readFileSync(path.join(root,"lib/sri-engine.ts"),"utf8");
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{}};
const context={module,exports:module.exports,require,console};
vm.runInNewContext(`(function(module,exports,require){${output}\n})(module,exports,require);`,context);
const sri=module.exports;
function assert(condition,message){if(!condition)throw new Error(message)}
assert(sri.modulo11("41261533")===6,"Vector módulo 11 oficial falló");
const known="2103201601176001321000110010010000000061234567816";
assert(known.length===49,"Vector de clave debe tener 49 dígitos");
assert(sri.modulo11(known.slice(0,-1))===Number(known.at(-1)),"Dígito verificador de clave conocida falló");
const key=sri.buildInvoiceAccessKey({issueDate:"2016-03-21",ruc:"1760013210001",environment:"test",establishment:"001",emissionPoint:"001",sequential:6,numericCode:"12345678"});
assert(key.length===49&&/^\d{49}$/.test(key),"Generación de clave de acceso inválida");
assert(sri.runSriEngineSelfCheck()===true,"Autoverificación interna falló");
const totals=sri.taxTotalsFromGross([{gross:115,profile:{kind:"vat",rate:15,percentageCode:"4",label:"IVA 15%"}}]);
assert(totals[0].base===100&&totals[0].tax===15,"Cálculo IVA incluido 15% falló");
console.log("KIUBO SRI verification OK · módulo 11 · clave 49 dígitos · IVA incluido");
