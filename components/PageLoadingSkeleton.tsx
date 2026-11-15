"use client";
import styles from "./PageLoadingSkeleton.module.css";

type LoadingView="products"|"inventory"|"orders"|"cash"|"purchases"|"generic";
const title:Record<LoadingView,string>={products:"Productos",inventory:"Inventario",orders:"Pedidos",cash:"Caja y fiados",purchases:"Compras",generic:"KIUBO"};

export function PageLoadingSkeleton({view="generic"}:{view?:LoadingView}){
  return <section className={styles.page} role="status" aria-label={`Cargando ${title[view]}`} aria-busy="true">
    <header className={styles.heading}><h1>{title[view]}</h1><span className={styles.pulse} /></header>
    <div className={styles.metrics} aria-hidden="true"><span/><span/><span/></div>
    <div className={styles.surface} aria-hidden="true">
      <div className={styles.toolbar}><span/><span/></div>
      <div className={styles.rows}>{Array.from({length:view==="products"?5:4},(_,i)=><div className={styles.row} key={i}><i/><div><span/><span/></div><b/></div>)}</div>
    </div>
  </section>;
}
