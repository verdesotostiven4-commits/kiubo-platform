import Link from "next/link";
import { KiuboMark } from "@/components/Logo";
import { PosClient } from "@/components/PosClient";
export default function PosPage(){return <main className="pos-shell"><header className="pos-topbar"><KiuboMark/><div className="pos-business"><span>KIUBO POS</span><strong>Empresa + sucursal activa</strong></div><Link className="button secondary compact" href="/reports">Reportes</Link></header><PosClient/></main>}
