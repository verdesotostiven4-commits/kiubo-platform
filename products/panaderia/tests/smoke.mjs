import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../demo/app.js", import.meta.url), "utf8");
const createNode = () => ({
  innerHTML: "", textContent: "", className: "", dataset: {},
  listeners: {},
  classList: { toggle(){} },
  addEventListener(event, fn) { this.listeners[event] = fn; }
});
const view = createNode();
const toast = createNode();
const modal = createNode();
const crumb = createNode();
const navs = ["resumen","ventas","productos","caja","reportes"].map(page => ({
  ...createNode(), dataset: { page }, classList: { toggle() {} }, listeners: {},
  addEventListener(event, fn) {this.listeners[event] = fn;}
}));
const fields = {
  received: {value:"1.00"},
  cashPart: {value:"0.20"},
  transferRef: {value:"DEMO-TRANSFER"}
};
const document = {
  querySelectorAll(selector) {return selector==="[data-page]" ? navs : []},
  getElementById(id) {
    return {"app-view":view,"toast":toast,"modal-root":modal,crumb}[id] ?? fields[id] ?? null;
  },
  addEventListener(){ }
};
class DemoFormData {
  constructor(form){this.values=form.values}
  get(k){return this.values[k]??null}
}
const sandbox={
  document,Intl,Date,crypto:{randomUUID(){return "test-"+Math.random().toString(16).slice(2)}},
  FormData:DemoFormData,
  prompt(){return "10"},
  setTimeout(){return 0},
  clearTimeout(){},
  window:{print(){}},
  console
};
vm.runInNewContext(source,sandbox,{timeout:3000,filename:"app.js"});

function navigate(page){
  const node=navs.find(x=>x.dataset.page===page);
  assert.ok(node,"Nav exists: "+page);
  node.listeners.click();
}
function click(action,id,extra={}){
  view.listeners.click({target:{
    closest(){return {dataset:{action,id,...extra}};}
  }});
}
function submit(id,values){
  view.listeners.submit({preventDefault(){},target:{id,values}});
}

assert.match(view.innerHTML,/Bienvenida a tu panadería/,"Dashboard renders");
assert.match(view.innerHTML,/demostración con datos inventados/,"Never imply real financial data");

navigate("ventas");
assert.match(view.innerHTML,/Aplanchados/);
assert.match(view.innerHTML,/Mini melvas/);
assert.match(view.innerHTML,/Torta de chocolate \(\$1\.50\)/);
click("add","p16");click("add","p16");
assert.match(view.innerHTML,/0[,.]50/,"Integer-cent cart math: two 25-cent aplanchados = 50 cents");
click("checkout");
assert.match(modal.innerHTML,/Venta #0001/,"Receipt generated");
assert.match(modal.innerHTML,/No válido como factura/,"Not a fiscal invoice");
assert.match(modal.innerHTML,/0[,.]50/,"Receipt total preserved");
click("checkout");
assert.match(toast.textContent,/Agrega productos/,"Double-click cannot duplicate a sale");

navigate("resumen");
assert.match(view.innerHTML,/1 comprobantes de muestra/,"One sale only");
navigate("productos");
assert.match(view.innerHTML,/Aplanchados<\/strong>.*?<td>48<\/td>/s,"Stock of aplanchados decreases exactly two units");

submit("new-product",{name:"<script>alert(1)</script>",price:"0.50",stock:"3",category:"Panes"});
assert.doesNotMatch(view.innerHTML,/<script>alert\(1\)<\/script>/,"Never render user HTML unescaped");
assert.match(view.innerHTML,/&lt;script&gt;/,"Sanitize demo product name");

navigate("caja");
submit("new-expense",{reason:"Servilletas",amount:"1.00"});
assert.match(view.innerHTML,/Servilletas/,"Expense recorded in demo");
submit("close-cash",{counted:"29.50"});
assert.match(view.innerHTML,/CERRADA/,"Cash close recorded");
navigate("ventas");click("add","p16");
assert.match(toast.textContent,/Primero abre la caja/,"Checkout from closed register blocked");

navigate("reportes");
assert.match(view.innerHTML,/Servilletas|Egresos anotados/,"Dynamic reports render");

// A second sale verifies that the unusual $0.34 price stays exact in cents.
navigate("caja");click("open-cash");
navigate("ventas");
click("add","p07");click("add","p07");click("add","p07");
assert.match(view.innerHTML,/1[,.]02/,"Three $0.34 mini melvas total exactly $1.02");
fields.received.value="1.02";
click("checkout");
assert.match(modal.innerHTML,/Venta #0002/,"Second transaction created");
assert.match(modal.innerHTML,/1[,.]02/,"Exact fractional cents preserved in receipt");

navigate("productos");
assert.match(view.innerHTML,/Mini melvas<\/strong>.*?<td>47<\/td>/s,"Stock of mini melvas decreases only for recorded sales");

assert.doesNotMatch(source,/localStorage\.setItem|indexedDB\.open|service_role|supabase\.from\(/i,
  "Demo never writes real customer money to the browser or cloud");
console.log("KIUBO Panadería: 15 simulation, HTML safety, financial-demo and isolation checks passed");
