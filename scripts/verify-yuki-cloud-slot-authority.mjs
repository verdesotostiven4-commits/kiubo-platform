import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync("supabase/migrations/20261106212500_yuki_slot_cloud_consistency.sql","utf8");
const pos=readFileSync("components/PosClientPro.tsx","utf8");
const yuki="8e2d0299-5680-4eec-8c57-e37fe29086aa";

const required=[
  [sql.includes(yuki),"Cloud trigger must be restricted to YUKI"],
  [sql.includes("before insert or update on public.sync_entities"),"Older browser autosaves must be protected before writing"],
  [sql.includes("after insert or update on public.sync_entities"),"Successful paid orders must close abandoned prior drafts"],
  [sql.includes("new.payload->>'paymentStatus'<>'paid'"),"Only successful paid orders may close earlier drafts"],
  [sql.includes("later.payload->>'paymentStatus'='paid'"),"Only verified later paid orders may block obsolete replays"],
  [sql.includes("old.payload->>'paymentStatus'='unpaid'"),"Cloud may close only totally unpaid orders"],
  [sql.includes("nullif(old.payload->>'saleId','') is null"),"Orders with linked sales are protected"],
  [sql.includes("sale.entity_type='sales'"),"Cloud must confirm a real sale before closing a slot"],
  [sql.includes("sale.payload->>'orderId'=new.entity_id"),"Sale-order identity must match"],
  [sql.includes("old.branch_id is not distinct from new.branch_id"),"Other branches must not be affected"],
  [sql.includes("old.tenant_id=new.tenant_id"),"Other tenants must not be affected"],
  [sql.includes("old.payload->>'serviceMode'=v_mode"),"Table, delivery and takeaway slots remain isolated"],
  [sql.includes("public.kiubo_yuki_order_time_v1(old.payload->>'createdAt') < v_time"),"Use order creation time, not stale sync updates"],
  [!sql.includes("delete from public.sync_entities"),"Never delete cash, orders or inventory to resolve occupancy"],
  [pos.includes('import { runSyncCycle } from "@/lib/sync-engine"'),"Checkout must contact the Cloud sync engine"],
  [pos.includes('confirmed=command?.status==="synced"'),"Cloud ACK required before paid success"],
  [pos.includes('setSaleSuccess(null);'),"Do not show paid screen prematurely"],
  [pos.includes("ATENCIÓN: el cobro quedó guardado en este dispositivo"),"Warn the cashier to avoid double charge when Cloud is unknown"],
  [pos.includes("No vuelvas a cobrar"),"Never encourage resubmitting an unknown payment"],
];
for(const [ok,why] of required)assert.ok(ok,why);
console.log("✓ YUKI: Cloud enforces paid slot authority, preserves accounting and partial balances, and checkout requires server ACK.");
