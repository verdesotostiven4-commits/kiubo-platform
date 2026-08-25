import { Sidebar } from "@/components/Sidebar";
import { CatalogClient } from "@/components/CatalogClient";
import "./catalog-hotfix.css";
export default function CatalogPage(){return <div className="app-shell"><Sidebar/><main className="content-shell catalog-page"><CatalogClient/></main></div>}
