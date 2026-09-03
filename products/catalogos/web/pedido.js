import { $, api, money, escapeHTML, formatDate, initials } from "./core.js";

const labels = [["new","Recibido"],["confirmed","Confirmado"],["preparing","Preparando"],["dispatched","Despachado"],["delivered","Entregado"]];
const statusCopy = {
  new: ["Pedido recibido", "Ya recibimos tu pedido y quedó registrado. El proveedor lo revisará enseguida."],
  confirmed: ["Pedido confirmado", "Tu pedido ya fue revisado y confirmado."],
  preparing: ["Estamos preparando tu pedido", "Tu pedido está en preparación."],
  dispatched: ["Tu pedido fue despachado", "Ya salió para entrega o quedó listo para la coordinación acordada."],
  delivered: ["Pedido entregado", "Tu pedido figura como entregado. ¡Gracias por tu compra!"],
  cancelled: ["Pedido cancelado", "Este pedido fue cancelado. Contacta al proveedor si necesitas ayuda."]
};

async function load(){
  const ref=new URLSearchParams(location.search).get("ref")||"";
  if(!/^[0-9a-f-]{36}$/i.test(ref)) return showError();
  try{
    const {order,account}=await api("order_status",{public_token:ref});
    if(account){
      document.title=`Pedido ${order.order_number} · ${account.name}`;
      document.documentElement.style.setProperty("--brand",account.accent||"#f06a3a");
      document.documentElement.style.setProperty("--brand-deep",account.accent_deep||"#db4d22");
      $("#trackingBrandName").textContent=account.name;
      $("#trackingBrandLogo").innerHTML=account.logo_url?`<img src="${escapeHTML(account.logo_url)}" alt="Logo de ${escapeHTML(account.name)}">`:escapeHTML(initials(account.name));
      const catalogUrl=account.slug===window.KIUBO_CATALOG_CONFIG.defaultSlug?"/":`/c/${account.slug}`;
      $("#trackingBrand").href=$("#trackingBack").href=catalogUrl;
    }
    const active=Math.max(0,labels.findIndex(([value])=>value===order.status));
    const cancelled=order.status==="cancelled";
    const [headline,copy]=statusCopy[order.status]||["Tu pedido está en proceso","Aquí puedes revisar su avance."];
    $("#trackingCard").innerHTML=`<div class="tracking-head"><span><svg class="icon"><use href="#i-check"/></svg></span><h1>${escapeHTML(headline)}</h1><p>${escapeHTML(copy)}</p><b class="tracking-number">${escapeHTML(order.order_number)}</b></div><div class="tracking-timeline">${labels.map(([value,label],index)=>`<div class="tracking-stage ${!cancelled&&index<=active?"done":""}"><i></i><span>${label}</span></div>`).join("")}</div><div class="tracking-items">${order.items.map(item=>`<div class="tracking-item"><b>${item.quantity}×</b><span>${escapeHTML(item.product_name)}</span><strong>${money(item.line_total,account?.currency||"USD")}</strong></div>`).join("")}</div><div class="tracking-total"><span>Total estimado</span><strong>${money(order.total,account?.currency||"USD")}</strong></div><p class="tracking-updated">Última actualización: ${formatDate(order.updated_at)}</p>`;
  }catch{showError();}
}
function showError(){ $("#trackingCard").innerHTML=`<div class="tracking-error"><h1>No encontramos el pedido</h1><p>Revisa que hayas abierto el enlace completo enviado al registrar el pedido.</p></div>`; }
load();
setInterval(()=>{if(!document.hidden&&navigator.onLine)load();},30000);
