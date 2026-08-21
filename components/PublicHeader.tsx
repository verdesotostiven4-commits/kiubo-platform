import Link from "next/link";
import { KiuboMark } from "./Logo";

export function PublicHeader(){return <header className="public-header"><Link href="/" className="public-brand"><KiuboMark/></Link><nav><Link href="/#funciones">Funciones</Link><Link href="/como-funciona">Cómo funciona</Link><Link href="/precios">Planes</Link><Link href="/demo">Demo</Link></nav><div className="public-header-actions"><Link href="/login" className="public-login">Ingresar</Link><Link href="/demo" className="button primary compact ref-blue-button">Probar 14 días</Link></div></header>}
