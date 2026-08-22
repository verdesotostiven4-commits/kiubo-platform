import process from "node:process";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.KIUBO_SUPABASE_DB_URL?.trim();
if (!connectionString) throw new Error("[KIUBO] Missing KIUBO_SUPABASE_DB_URL");

const sql = await readFile(new URL("../supabase/migrations/0006_email_owner_provisioning.sql", import.meta.url), "utf8");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  const verify = await client.query("select to_regprocedure('public.platform_provision_tenant_by_email(text,text,text,text)') is not null as ok");
  if (!verify.rows[0]?.ok) throw new Error("[KIUBO] migration 0006 verification failed");
  await client.query("commit");
  console.log("[KIUBO] MIGRATION_0006_SUCCESS");
} catch (error) {
  try { await client.query("rollback"); } catch {}
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
