import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;
const url = process.env.KIUBO_SUPABASE_DB_URL?.trim();

if (!url) {
  console.log('[KIUBO] KIUBO_SUPABASE_DB_URL is not configured; Supabase bootstrap skipped.');
  process.exit(0);
}

if (url.includes('[YOUR-PASSWORD]')) {
  throw new Error('[KIUBO] KIUBO_SUPABASE_DB_URL still contains the [YOUR-PASSWORD] placeholder.');
}

const expectedTables = [
  'platform_admins',
  'tenants',
  'tenant_members',
  'branches',
  'tenant_member_branches',
  'plans',
  'plan_features',
  'subscriptions',
  'tenant_feature_overrides',
  'tenant_settings',
  'tenant_branding',
  'sync_entities',
  'sync_receipts',
];

const expectedFunctions = [
  'is_platform_admin',
  'has_tenant_access',
  'has_tenant_role',
  'has_branch_access',
  'tenant_can_operate',
  'tenant_feature_enabled',
  'can_sync_entity',
  'apply_sync_operations',
  'pull_sync_changes',
  'platform_provision_tenant',
  'can_manage_tenant_users',
  'platform_set_tenant_plan',
  'platform_set_tenant_status',
  'can_assign_tenant_role',
  'branch_belongs_to_tenant',
  'normalize_sync_payload',
];

const quoted = (values) => values.map((value) => `'${value.replaceAll("'", "''")}'`).join(',');

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

try {
  await client.connect();
  console.log('[KIUBO] Supabase PostgreSQL connection OK.');

  const before = await client.query(`
    select count(*)::int as count
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (${quoted(expectedTables)});
  `);
  const tableCountBefore = before.rows[0].count;
  console.log(`[KIUBO] KIUBO tables before migration: ${tableCountBefore}/13`);

  if (tableCountBefore !== 0 && tableCountBefore !== expectedTables.length) {
    throw new Error(`[KIUBO] Partial KIUBO schema detected (${tableCountBefore}/13). Automatic migration refused.`);
  }

  if (tableCountBefore === 0) {
    const migrationFiles = [
      '0001_core_multitenant.sql',
      '0002_sync_substrate.sql',
      '0003_platform_provisioning.sql',
      '0004_security_guardrails.sql',
      '0005_sync_payload_guardrails.sql',
    ];

    const migrations = [];
    for (const file of migrationFiles) {
      migrations.push(await fs.readFile(path.join(process.cwd(), 'supabase', 'migrations', file), 'utf8'));
    }

    await client.query('begin');
    try {
      for (let index = 0; index < migrations.length; index += 1) {
        console.log(`[KIUBO] Applying ${migrationFiles[index]}...`);
        await client.query(migrations[index]);
      }
      await client.query('commit');
      console.log('[KIUBO] Migrations 0001-0005 applied.');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } else {
    console.log('[KIUBO] Complete schema already exists; migration skipped safely.');
  }

  const tables = await client.query(`
    select count(*)::int as count
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (${quoted(expectedTables)});
  `);

  const functions = await client.query(`
    select count(distinct p.proname)::int as count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (${quoted(expectedFunctions)});
  `);

  const rls = await client.query(`
    select count(*)::int as count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (${quoted(expectedTables)})
      and c.relrowsecurity;
  `);

  const finalTables = tables.rows[0].count;
  const finalFunctions = functions.rows[0].count;
  const finalRls = rls.rows[0].count;
  console.log(`[KIUBO] Verification: tables=${finalTables}/13 functions=${finalFunctions}/16 rls=${finalRls}/13`);

  if (finalTables !== expectedTables.length || finalFunctions !== expectedFunctions.length || finalRls !== expectedTables.length) {
    throw new Error('[KIUBO] Supabase bootstrap verification failed.');
  }

  console.log('[KIUBO] SUPABASE_BOOTSTRAP_SUCCESS');
} finally {
  await client.end().catch(() => undefined);
}
