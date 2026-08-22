import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const url = process.env.KIUBO_SUPABASE_DB_URL?.trim();
if (!url) throw new Error('[KIUBO] Missing KIUBO_SUPABASE_DB_URL');

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query('begin');
  const existing = await client.query('select user_id from public.platform_admins where active = true');
  if (existing.rowCount > 0) {
    console.log(`[KIUBO] Platform admin already exists (${existing.rowCount}). No changes needed.`);
    await client.query('rollback');
    process.exit(0);
  }
  const users = await client.query('select id from auth.users order by created_at asc');
  if (users.rowCount !== 1) throw new Error(`[KIUBO] Safety stop: expected exactly 1 auth user, found ${users.rowCount}.`);
  const userId = users.rows[0].id;
  await client.query('insert into public.platform_admins(user_id, active) values ($1, true) on conflict (user_id) do update set active = true', [userId]);
  const verify = await client.query('select count(*)::int as count from public.platform_admins where user_id = $1 and active = true', [userId]);
  if (verify.rows[0]?.count !== 1) throw new Error('[KIUBO] Platform admin verification failed.');
  await client.query('commit');
  console.log('[KIUBO] FIRST_PLATFORM_ADMIN_SUCCESS');
} catch (error) {
  try { await client.query('rollback'); } catch {}
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
