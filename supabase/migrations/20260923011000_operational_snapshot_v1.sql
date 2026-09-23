-- KIUBO Cloud · authoritative operational snapshot for multi-device convergence.
-- Keeps existing incremental sync, but lets a device periodically rebuild the
-- order/payment/cash slice from one stable Cloud watermark.

create or replace function public.pull_operational_snapshot_v1(
  p_tenant uuid,
  p_after_revision bigint default 0,
  p_watermark bigint default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_after bigint:=greatest(coalesce(p_after_revision,0),0);
  v_limit integer:=least(greatest(coalesce(p_limit,1000),1),1000);
  v_watermark bigint;
  v_next bigint:=v_after;
  v_changes jsonb:='[]'::jsonb;
  v_has_more boolean:=false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_tenant_access(p_tenant) then raise exception 'tenant denied'; end if;

  if p_watermark is null then
    select coalesce(max(revision),0) into v_watermark
    from public.sync_entities
    where tenant_id=p_tenant
      and entity_type in('orders','sales','credits','creditPayments','cashSessions','cashMovements')
      and (branch_id is null or public.has_branch_access(tenant_id,branch_id));
  else
    v_watermark:=greatest(p_watermark,0);
  end if;

  with page as (
    select tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at,revision
    from public.sync_entities
    where tenant_id=p_tenant
      and entity_type in('orders','sales','credits','creditPayments','cashSessions','cashMovements')
      and revision>v_after
      and revision<=v_watermark
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
      and entity_type in('orders','sales','credits','creditPayments','cashSessions','cashMovements')
      and revision>v_next
      and revision<=v_watermark
      and (branch_id is null or public.has_branch_access(tenant_id,branch_id))
  ) into v_has_more;

  return jsonb_build_object(
    'watermark',v_watermark::text,
    'cursor',v_next::text,
    'hasMore',v_has_more,
    'changes',v_changes
  );
end
$$;

revoke all on function public.pull_operational_snapshot_v1(uuid,bigint,bigint,integer) from public;
revoke all on function public.pull_operational_snapshot_v1(uuid,bigint,bigint,integer) from anon;
grant execute on function public.pull_operational_snapshot_v1(uuid,bigint,bigint,integer) to authenticated;
