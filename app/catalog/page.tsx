import { Sidebar } from "@/components/Sidebar";
import { SafeCatalogClient } from "@/components/SafeCatalogClient";

export default function CatalogPage(){
  return <div className="app-shell"><Sidebar/><main className="content-shell"><SafeCatalogClient/></main></div>;
}
