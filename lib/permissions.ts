import type { UserRole } from "./local-store";
export type Permission="control"|"leads"|"dashboard"|"onboarding"|"upgrade"|"pos"|"cash"|"inventory"|"purchases"|"catalog"|"customers"|"invoices"|"reports"|"branding"|"operations";
const grants:Record<UserRole,Permission[]>={
  owner:["control","leads","dashboard","onboarding","upgrade","pos","cash","inventory","purchases","catalog","customers","invoices","reports","branding","operations"],
  admin:["dashboard","onboarding","upgrade","pos","cash","inventory","purchases","catalog","customers","invoices","reports","branding","operations"],
  cashier:["dashboard","pos","cash","customers","invoices","reports"],
  inventory:["dashboard","inventory","purchases","catalog","reports"],
  viewer:["dashboard","reports"]
};
export function canAccess(role:UserRole,permission:Permission,platformAdmin=false){
  if(permission==="control"||permission==="leads")return platformAdmin;
  return grants[role].includes(permission);
}
export function permissionForPath(path:string):Permission|null{
  if(path.startsWith("/control"))return"control";
  if(path.startsWith("/leads"))return"leads";
  if(path.startsWith("/app"))return"dashboard";
  if(path.startsWith("/onboarding"))return"onboarding";
  if(path.startsWith("/upgrade"))return"upgrade";
  if(path.startsWith("/orders")||path.startsWith("/order-print")||path.startsWith("/receipt"))return"pos";
  if(path.startsWith("/pos"))return"pos";
  if(path.startsWith("/cash"))return"cash";
  if(path.startsWith("/inventory"))return"inventory";
  if(path.startsWith("/purchases"))return"purchases";
  if(path.startsWith("/catalog"))return"catalog";
  if(path.startsWith("/customers"))return"customers";
  if(path.startsWith("/invoices"))return"invoices";
  if(path.startsWith("/reports"))return"reports";
  if(path.startsWith("/branding"))return"branding";
  if(path.startsWith("/operations"))return"operations";
  return null;
}
export function homeForRole(role:UserRole){if(role==="cashier")return"/pos";if(role==="inventory")return"/inventory";if(role==="viewer")return"/reports";return"/app"}
