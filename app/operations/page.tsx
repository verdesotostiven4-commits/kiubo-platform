import { Sidebar } from "@/components/Sidebar";
import { OperationsClient } from "@/components/OperationsClient";

export default function OperationsPage(){
  const cloud=process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase";
  return <div className="app-shell"><Sidebar/><main className="content-shell"><div className={cloud?"cloud-operations-v2":undefined}><OperationsClient/></div>{cloud&&<style>{`.cloud-operations-v2 > .ops-grid:first-of-type > .panel:first-child{display:none}.cloud-operations-v2 > .ops-grid:first-of-type{grid-template-columns:minmax(0,1fr)}`}</style>}</main></div>
}
