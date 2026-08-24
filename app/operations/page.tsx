import { Sidebar } from "@/components/Sidebar";
import { BusinessAdminClient } from "@/components/BusinessAdminClient";
import { OperationsClient } from "@/components/OperationsClient";

export default function OperationsPage(){
  const cloud=process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase";
  return <div className="app-shell"><Sidebar/><main className="content-shell">{cloud?<BusinessAdminClient/>:<OperationsClient/>}</main></div>;
}
