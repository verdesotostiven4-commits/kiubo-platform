-- KIUBO Cloud v2 phase 1 · deterministic, crash-safe incremental sync cursors.
-- Keeps the v1 timestamp RPC for backward compatibility while adding revision-based paging.

create sequence if not exists public.sync_entity_revision_seq as bigint;

alter table public.sync_entities
  add column if not exists revision bigint;

update public.sync_entities
set revision=nextval('public.sync_entity_revision_seq')
where revision is null;

alter table public.sync_entities
  alter column revision set not null;

create index if not exists sync_entities_revision_pull_idx
  on public.sync_entities(tenant_id,revision);

create or replace function public.bump_sync_entity_revision()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.revision:=nextval('public.sync_entity_revision_seq');
  new.updated_at:=now();
  return new;
end
$$;

revoke all on function public.bump_sync_entity_revision() from public;
revoke all on function public.bump_sync_entity_revision() from anon;
revoke all on function public.bump_sync_entity_revision() from authenticated;

drop trigger if exists sync_entities_revision_trigger on public.sync_entities;
create trigger sync_entities_revision_trigger
before insert or update on public.sync_entities
for each row execute function public.bump_sync_entity_revision();

create or replace function public.pull_sync_changes_v2(
  p_tenant uuid,
  p_after_revision bigint default 0,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_after bigint:=greatest(coalesce(p_after_revision,0),0);
  v_limit integer:=least(greatest(coalesce(p_limit,500),1),1000);
  v_next bigint:=v_after;
  v_changes jsonb:='[]'::jsonb;
  v_has_more boolean:=false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_tenant_access(p_tenant) then raise exception 'tenant denied'; end if;

  with page as (
    select tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at,revision
    from public.sync_entities
    where tenant_id=p_tenant
      and revision>v_after
      and (branch_id is null or public.has_branch_access(tenant_id,branch_id))
    order by revision
    limit v_limit
  )
  select
    coalesce(max(revision),v_after),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'tenantId',tenant_id::text,
          'branchId',branch_id::text,
          'entityType',entity_type,
          'entityId',entity_id,
          'action',case when deleted then 'delete' else 'upsert' end,
          'payload',case when deleted then null else payload end,
          'updatedAt',updated_at,
          'revision',revision
        )
        order by revision
      ),
      '[]'::jsonb
    )
  into v_next,v_changes
  from page;

  select exists(
    select 1
    from public.sync_entities
    where tenant_id=p_tenant
      and revision>v_next
      and (branch_id is null or public.has_branch_access(tenant_id,branch_id))
  ) into v_has_more;

  return jsonb_build_object(
    'cursor',v_next::text,
    'hasMore',v_has_more,
    'changes',v_changes
  );
end
$$;

revoke all on function public.pull_sync_changes_v2(uuid,bigint,integer) from public;
grant execute on function public.pull_sync_changes_v2(uuid,bigint,integer) to authenticated;
