import { Sidebar } from "@/components/Sidebar";
import { CashClient } from "@/components/CashClient";

export default function CashPage(){
  return <div className="app-shell"><Sidebar/><main className="content-shell"><CashClient/></main></div>;
}
