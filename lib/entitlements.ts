import type { Plan,TenantRecord } from "./local-store";

export type CommercialPlan=Exclude<Plan,"Internal">;
export type ProductFeature="dashboard"|"pos"|"products"|"inventory"|"customers"|"operations"|"reports"|"purchases"|"smartCatalog"|"branding"|"multiBranch"|"invoices";

export const PLAN_CATALOG:Record<CommercialPlan,{price:string;tagline:string;audience:string;features:string[]}>= {
  Start:{
    price:"$7.90",
    tagline:"Lo esencial para vender y tener control.",
    audience:"Tiendas y negocios que quieren dejar Excel, libretas o procesos desordenados.",
    features:["POS y productos","Inventario básico","Caja y clientes","Reportes esenciales","1 sucursal","Soporte estándar"]
  },
  Pro:{
    price:"$12.90",
    tagline:"Más control para un negocio que ya está creciendo.",
    audience:"Negocios que además necesitan compras, proveedores, fiados y análisis más completo.",
    features:["Todo Start","Compras y proveedores","Fiados y cuentas por cobrar","Cuentas por pagar","Catalog inteligente","Reportes avanzados","Más usuarios"]
  },
  Custom:{
    price:"Desde $19.90",
    tagline:"Una experiencia adaptada a operaciones más exigentes.",
    audience:"Negocios con varias sucursales, identidad propia, migraciones o configuraciones especiales.",
    features:["Todo Pro","Branding del negocio","Múltiples sucursales","Configuración avanzada","Migración asistida","Flujos especiales compatibles","Soporte prioritario"]
  }
};

const BASE:Record<CommercialPlan,ProductFeature[]>={
  Start:["dashboard","pos","products","inventory","customers","operations","reports"],
  Pro:["dashboard","pos","products","inventory","customers","operations","reports","purchases","smartCatalog"],
  Custom:["dashboard","pos","products","inventory","customers","operations","reports","purchases","smartCatalog","branding","multiBranch"]
};

export function hasFeature(tenant:TenantRecord|undefined,feature:ProductFeature){
  if(!tenant)return false;
  if(tenant.plan==="Internal")return true;
  if(feature==="invoices")return tenant.invoice;
  if(feature==="smartCatalog")return tenant.catalog&&BASE[tenant.plan].includes("smartCatalog");
  return BASE[tenant.plan].includes(feature);
}

export function routeFeature(path:string):ProductFeature|null{
  if(path.startsWith("/app"))return"dashboard";
  if(path.startsWith("/pos"))return"pos";
  if(path.startsWith("/cash"))return"operations";
  if(path.startsWith("/catalog"))return"products";
  if(path.startsWith("/inventory"))return"inventory";
  if(path.startsWith("/customers"))return"customers";
  if(path.startsWith("/operations"))return"operations";
  if(path.startsWith("/reports"))return"reports";
  if(path.startsWith("/purchases"))return"purchases";
  if(path.startsWith("/branding"))return"branding";
  if(path.startsWith("/invoices"))return"invoices";
  return null;
}

export const featureLabel:Record<ProductFeature,string>={
  dashboard:"Inicio",pos:"Ventas / POS",products:"Productos",inventory:"Inventario",customers:"Clientes",operations:"Caja y operación",reports:"Reportes",purchases:"Compras y proveedores",smartCatalog:"Catalog inteligente",branding:"Branding personalizado",multiBranch:"Múltiples sucursales",invoices:"Factura electrónica"
};
