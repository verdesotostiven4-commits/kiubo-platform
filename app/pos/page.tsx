import Link from "next/link";
import { PosClient } from "@/components/PosClient";
export default function PosPage(){return <main className="pos-shell"><header className="pos-topbar"><Link className="button secondary compact pos-back-link" href="/app">← Inicio</Link><div className="pos-screen-title"><span>VENTAS</span><strong>Punto de venta</strong></div><div className="pos-topbar-actions"><Link className="button secondary compact" href="/orders">Pedidos</Link><Link className="button secondary compact" href="/reports">Reportes</Link></div></header><PosClient/></main>}
