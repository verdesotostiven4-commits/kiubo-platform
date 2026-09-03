import { Sidebar } from "@/components/Sidebar";
import { ReportsClientPro } from "@/components/ReportsClientPro";
import { OperationalSalesInsights } from "@/components/OperationalSalesInsights";
export default function ReportsPage(){return <div className="app-shell"><Sidebar/><main className="content-shell"><div className="topbar"><div><span className="eyebrow">KIUBO INSIGHTS</span><h1>Reportes</h1></div></div><ReportsClientPro/><OperationalSalesInsights/></main></div>}
