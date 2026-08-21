import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";

const modules=[
  {tone:"coral",icon:"▣",title:"Ventas ágiles",text:"POS rápido, carrito claro y cobros sin complicaciones."},
  {tone:"orange",icon:"▦",title:"Inventario inteligente",text:"Stock, alertas, kardex, compras y proveedores conectados."},
  {tone:"blue",icon:"◇",title:"Facturación",text:"Foundation fiscal preparada para completar el flujo SRI productivo."},
  {tone:"green",icon:"◎",title:"Clientes y fiados",text:"Historial, saldos y cuentas por cobrar en un solo lugar."},
  {tone:"purple",icon:"↗",title:"Reportes claros",text:"Ventas, caja, compras y rendimiento para decidir con datos."}
];

export default function HomePage(){return <main className="marketing-shell ref-marketing"><PublicHeader/>
  <section className="ref-home-hero">
    <div className="ref-hero-copy">
      <div className="ref-cloud-pill">☁ Software en la nube, hecho para crecer contigo</div>
      <h1>Todo tu negocio,<br/><em>en orden.</em></h1>
      <p>KIUBO es una plataforma todo en uno para vender, controlar inventario, organizar clientes y entender qué está pasando en tu negocio sin vivir entre hojas de cálculo.</p>
      <div className="ref-hero-actions"><Link href="/demo" className="button ref-blue-button">Prueba gratis 14 días</Link><Link href="/demo" className="button ref-outline-button">▷ Solicitar demo</Link></div>
      <div className="ref-hero-benefits"><span>▣ <b>Sin tarjeta</b><small>Prueba antes de decidir</small></span><span>⚡ <b>Implementación guiada</b><small>Te acompañamos al inicio</small></span><span>◌ <b>Soporte cercano</b><small>Atención en español</small></span><span>☁ <b>Actualizaciones</b><small>Mejoras constantes</small></span></div>
    </div>

    <div className="ref-dashboard-stage" aria-label="Vista conceptual del dashboard KIUBO">
      <div className="ref-stage-blob ref-stage-blob-a"/><div className="ref-stage-blob ref-stage-blob-b"/>
      <div className="ref-dashboard-window">
        <div className="ref-dashboard-top"><strong>KIUBO</strong><div className="ref-dashboard-search">⌕ Buscar</div><span>◔</span><span className="ref-avatar">LF</span></div>
        <div className="ref-dashboard-body">
          <aside className="ref-dashboard-side"><b>⌂</b><b>▣</b><b>▦</b><b>◎</b><b>◇</b><b>↗</b><b className="ref-side-bottom">⚙</b></aside>
          <div className="ref-dashboard-main"><div className="ref-dashboard-greeting"><span>¡Hola, Luis! 👋</span><small>Resumen de hoy</small></div>
            <div className="ref-mini-kpis"><article><small>Ventas de hoy</small><strong>$428.60</strong><i>+12.5%</i></article><article><small>Productos</small><strong>142</strong><i>+8.2%</i></article><article><small>Clientes</small><strong>63</strong><i>+6.1%</i></article><article><small>Órdenes</small><strong>18</strong><i>+5.3%</i></article></div>
            <div className="ref-dashboard-chart-row"><div className="ref-chart-card"><small>Ventas de la semana</small><div className="ref-line-chart"><svg viewBox="0 0 420 120" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,95 55,72 110,80 165,48 220,66 275,35 330,48 420,12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><polyline points="0,120 0,95 55,72 110,80 165,48 220,66 275,35 330,48 420,12 420,120" fill="url(#refFill)" opacity=".18"/><defs><linearGradient id="refFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs></svg></div><div className="ref-chart-days"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></div><div className="ref-top-products"><small>Productos más vendidos</small><div><b>Café Molido</b><i style={{width:"88%"}}/></div><div><b>Leche Entera</b><i style={{width:"66%"}}/></div><div><b>Azúcar</b><i style={{width:"48%"}}/></div><div><b>Pan Integral</b><i style={{width:"36%"}}/></div></div></div>
            <div className="ref-dashboard-shortcuts"><span className="coral">▣<small>Nueva venta</small></span><span className="orange">▦<small>Productos</small></span><span className="green">◎<small>Clientes</small></span><span className="blue">◇<small>Facturar</small></span><span className="purple">↗<small>Reportes</small></span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section className="ref-module-section" id="funciones"><h2>Todo lo que necesitas para gestionar tu negocio</h2><div className="ref-module-grid">{modules.map(item=><article key={item.title} className={`ref-module-card ${item.tone}`}><div className="ref-module-icon">{item.icon}</div><h3>{item.title}</h3><p>{item.text}</p><Link href="/como-funciona">Conocer más →</Link></article>)}</div></section>

  <section className="ref-business-types"><span>Diseñado para negocios reales</span><div><b>Minimarkets</b><b>Ferreterías</b><b>Farmacias</b><b>Ropa</b><b>Distribuidoras</b><b>Servicios</b></div></section>

  <section className="ref-home-story"><div><span className="public-kicker">DE INTERESADO A OPERANDO</span><h2>Te mostramos KIUBO, configuramos contigo y luego solo entras a trabajar.</h2><p>La experiencia comercial puede ser presencial o remota. El negocio recibe su acceso y usa la misma plataforma desde PC, tablet o móvil.</p><Link href="/como-funciona" className="button ref-blue-button">Ver cómo funciona</Link></div><div className="ref-story-steps"><article><b>01</b><strong>Demo</strong><span>Entendemos cómo trabaja tu negocio.</span></article><article><b>02</b><strong>Configuración</strong><span>Sucursal, usuarios, productos y caja.</span></article><article><b>03</b><strong>Acceso</strong><span>Entras a KIUBO y empiezas a operar.</span></article></div></section>

  <section className="ref-home-cta"><div><span>KIUBO</span><h2>Tu negocio, simple.<br/>Todo en orden.</h2><p>Conoce el producto antes de pagar y decide con tu operación real.</p></div><div><Link href="/demo" className="button ref-coral-button">Solicitar demo</Link><Link href="/precios" className="button ref-glass-button">Ver planes</Link></div></section>
</main>}
