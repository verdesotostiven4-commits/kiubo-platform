import { readFileSync,existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
function text(path){const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")}
function requireText(path,needles){const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing Food Service guard: ${needle}`);console.log(`✓ ${path}`)}

requireText("lib/local-store.ts",[
  'export type BusinessType = "general"|"retail"|"food_service"|"services"',
  'export type ServiceMode = "counter"|"table"|"takeaway"|"delivery"',
  "export type FoodOrderRecord",
  "orders:FoodOrderRecord[]",
  'TRACKED_COLLECTIONS:SyncEntity[]=["tenants","branches","tenantProducts","customers","sales","orders"',
  "nextOrderNumber"
]);
requireText("lib/sync-types.ts",['| "orders";']);
requireText("lib/order-sync.ts",['entityType==="orders"','action:"orders.upsert"']);
requireText("lib/permissions.ts",['path.startsWith("/orders")','path.startsWith("/order-print")','path.startsWith("/receipt")']);
requireText("lib/entitlements.ts",['path.startsWith("/orders")','path.startsWith("/order-print")','path.startsWith("/receipt")']);
requireText("components/RealtimeSyncRuntime.tsx",[
  'table:"sync_entities"',
  'filter:`tenant_id=eq.${ctx.tenantId}`',
  "runSyncCycle()",
  'KIUBO_DATA_REFRESHED="kiubo:data-refreshed"'
]);
requireText("components/PosClient.tsx",[
  'const paymentOptions:Payment[]=["cash","transfer","credit"]',
  'if(payment==="mixed")',
  'persistOrder(next,order,false)',
  'enqueueSaleTransaction(next,{sale,productSnapshots,stockMovements,credit,orderBefore,orderAfter:order})',
  'enabledModes.includes(serviceMode)?serviceMode',
  "Guardar pedido sin cobrar"
]);
requireText("lib/sales-transaction.ts",["orderBefore?: FoodOrderRecord","orderAfter?: FoodOrderRecord"]);
requireText("lib/sync-engine.ts",[
  "const completedOrders:{operationId:string;order:FoodOrderRecord}[]=", 
  'item.entityType==="saleTransactions"',
  "completedOrders.push({operationId:item.operationId,order})",
  "queueFoodOrder(orderDb,completed.order)",
  'updateSyncOperation(completed.operationId,"synced")',
  "paid Food Service order is published only after its protected sale command is confirmed"
]);
requireText("lib/command-recovery.ts",[
  "orderBefore?:FoodOrderRecord",
  "orderAfter?:FoodOrderRecord",
  'current.paymentStatus==="paid"',
  "p.orderBefore",
  "removeById(db.orders,p.orderAfter.id)"
]);
requireText("lib/cloud-auth.ts",["db.orders=db.orders.filter"]);
requireText("components/FoodOrdersClient.tsx",["En preparación","Marcar listo","Cobrar en POS","KIUBO_DATA_REFRESHED"]);
requireText("lib/media-storage.ts",["image/webp","MAX_SOURCE_BYTES=15*1024*1024","cacheControl:\"31536000\"","kiubo-media"]);
requireText("components/CatalogClient.tsx",["uploadOptimizedMedia","imageFile","imageUrl","category"]);
requireText("components/BusinessLaunchClient.tsx",["Crear, configurar e invitar","businessType:\"food_service\"","ownerEmail:\"\""]);
requireText("components/Sidebar.tsx",['href:"/orders"','businessTypes:["food_service"]','href:"/control/launch"']);
requireText("components/MobileNav.tsx",['href:"/orders"','businessTypes:["food_service"]','href:"/control/launch"']);
requireText("components/AppChrome.tsx",["RealtimeSyncRuntime","WorkspaceSplash",'path.startsWith("/receipt")','path.startsWith("/order-print")']);
requireText("supabase/migrations/0020_food_service_platform_v1.sql",[
  "target_type in('customers','sales','cashSessions','cashMovements','credits','creditPayments','orders')",
  "configure_business_profile_v1",
  "alter publication supabase_realtime add table public.sync_entities",
  "values('kiubo-media','kiubo-media',true",
  "kiubo_media_insert"
]);

console.log("✓ Food Service V2 guard passed: orders, protected private routes, branch-scope purge, delayed paid publication, crash-safe follow-up, recovery, realtime nudges, optimized media and guided launch remain wired.");
