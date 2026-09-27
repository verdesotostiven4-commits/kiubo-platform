-- KIUBO maintenance: cover foreign keys used by operational/catalog writes
-- and remove an identical duplicate index. This changes indexes only; it
-- does not alter business data, tenant isolation or permissions.
create index if not exists operational_sessions_user_id_idx
  on public.operational_sessions(user_id);

create index if not exists catalog_push_events_account_id_idx
  on public.catalog_push_events(account_id);

drop index if exists public.catalog_product_presentations_one_default_idx;
