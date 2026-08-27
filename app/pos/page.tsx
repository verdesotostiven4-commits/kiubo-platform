import Link from "next/link";
import { PosClientPro } from "@/components/PosClientPro";
import { PosVisualPolishRuntime } from "@/components/PosVisualPolishRuntime";
export default function PosPage(){return <main className="pos-shell"><PosVisualPolishRuntime/><header className="pos-topbar"><div className="pos-screen-title"><span>VENTAS</span><strong>Punto de venta</strong></div><div className="pos-topbar-actions"><Link className="button secondary compact" href="/orders">Pedidos</Link><Link className="button secondary compact" href="/reports">Reportes</Link></div></header><PosClientPro/></main>}
