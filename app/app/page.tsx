import { Sidebar } from "@/components/Sidebar";
import { DashboardClient } from "@/components/DashboardClient";
import { YukiFlavorAnalytics } from "@/components/YukiFlavorAnalytics";
export default function BusinessHomePage(){return <div className="app-shell"><Sidebar/><main className="content-shell"><DashboardClient/><YukiFlavorAnalytics/></main></div>}
