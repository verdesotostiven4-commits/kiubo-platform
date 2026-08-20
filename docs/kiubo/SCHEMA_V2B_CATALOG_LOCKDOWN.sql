-- KIUBO Foundation v2b — master catalog lockdown
-- Dedicated KIUBO backend only. Apply after SCHEMA_V2_SECURITY_SYNC.sql.

alter table public.master_products enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='master_products'
  loop execute format('drop policy if exists %I on public.master_products',r.policyname); end loop;
end $$;

-- Intentionally no direct authenticated SELECT policy.
-- Expose Catalog through a narrow backend/RPC search endpoint with entitlement checks,
-- exact/prefix search limits and rate limiting rather than unrestricted bulk access.
