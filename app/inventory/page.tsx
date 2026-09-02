import { Sidebar } from "@/components/Sidebar";
import { InventoryClient } from "@/components/InventoryClient";
import { InventoryQuickRestock } from "@/components/InventoryQuickRestock";
export default function InventoryPage(){return <div className="app-shell"><Sidebar/><main className="content-shell"><InventoryClient/><InventoryQuickRestock floating/></main></div>}
