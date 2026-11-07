-- YUKI-only server-side consistency guard. No deletions, sales or credit mutations.
-- A confirmed paid sale supersedes older unpaid drafts on the same tenant,
-- branch, service mode and numbered slot. Newer genuine orders remain open.
-- Trigger runs on the authoritative Cloud order row, not browser state.
create or replace function public.kiubo_yuki_order_time_v1(p_text text)
returns timestamptz language plpgsql stable set search_path=public
as $$
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}T' then return null; end if;
  return p_text::timestamptz;
exception when others then return null;
end
$$;

create or replace function public.kiubo_yuki_slot_before_v1()
returns trigger language plpgsql security invoker set search_path=public
as $$
declare
  v_slot text;
  v_mode text;
  v_time timestamptz;
begin
  if new.tenant_id <> '8e2d0299-5680-4eec-8c57-e37fe29086aa'::uuid
     or new.entity_type <> 'orders' or new.deleted then return new; end if;
  v_mode:=new.payload->>'serviceMode';
  v_slot:=trim(coalesce(new.payload->>'tableLabel',''));
  v_time:=public.kiubo_yuki_order_time_v1(new.payload->>'createdAt');
  if v_mode not in('table','delivery','takeaway') or v_slot='' or v_time is null then return new; end if;
  if (new.payload->>'paymentStatus') not in('unpaid','paid') then return new; end if;
  -- Serialize writes for one actual slot without blocking unrelated branches.
  perform pg_advisory_xact_lock(hashtextextended(
    'kiubo:yuki:slot:'||new.tenant_id||':'||coalesce(new.branch_id::text,'')||':'||v_mode||':'||v_slot,0));
  if new.payload->>'paymentStatus'<>'unpaid'
     or new.payload->>'status' in('cancelled','delivered')
     or nullif(new.payload->>'saleId','') is not null then return new; end if;

  if exists(
    select 1 from public.sync_entities later
    where later.tenant_id=new.tenant_id and later.branch_id is not distinct from new.branch_id
      and later.entity_type='orders' and not later.deleted and later.entity_id<>new.entity_id
      and later.payload->>'serviceMode'=v_mode and trim(coalesce(later.payload->>'tableLabel',''))=v_slot
      and later.payload->>'paymentStatus'='paid'
      and later.payload->>'status'<>'cancelled'
      and public.kiubo_yuki_order_time_v1(later.payload->>'createdAt')>v_time
      and nullif(later.payload->>'saleId','') is not null
      and exists(
        select 1 from public.sync_entities sale
        where sale.tenant_id=later.tenant_id and sale.branch_id is not distinct from later.branch_id
          and sale.entity_type='sales' and not sale.deleted
          and sale.entity_id=later.payload->>'saleId'
          and sale.payload->>'orderId'=later.entity_id
      )
  ) then
    new.payload:=new.payload||jsonb_build_object(
      'status','cancelled',
      'updatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'reconciliationReason','superseded_by_newer_paid_slot_order',
      'reconciledAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;
  return new;
end
$$;

create or replace function public.kiubo_yuki_slot_after_v1()
returns trigger language plpgsql security invoker set search_path=public
as $$
declare
  v_slot text;
  v_mode text;
  v_time timestamptz;
begin
  if new.tenant_id <> '8e2d0299-5680-4eec-8c57-e37fe29086aa'::uuid
     or new.entity_type <> 'orders' or new.deleted
     or new.payload->>'paymentStatus'<>'paid'
     or new.payload->>'status'='cancelled'
     or nullif(new.payload->>'saleId','') is null then return new; end if;
  v_mode:=new.payload->>'serviceMode';
  v_slot:=trim(coalesce(new.payload->>'tableLabel',''));
  v_time:=public.kiubo_yuki_order_time_v1(new.payload->>'createdAt');
  if v_mode not in('table','delivery','takeaway') or v_slot='' or v_time is null then return new; end if;
  -- Only trust a paid order if the associated immutable sale is recorded.
  if not exists(
    select 1 from public.sync_entities sale
    where sale.tenant_id=new.tenant_id and sale.branch_id is not distinct from new.branch_id
      and sale.entity_type='sales' and not sale.deleted
      and sale.entity_id=new.payload->>'saleId'
      and sale.payload->>'orderId'=new.entity_id
  ) then return new; end if;
  update public.sync_entities stale
  set payload=stale.payload||jsonb_build_object(
    'status','cancelled',
    'updatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reconciliationReason','superseded_by_newer_paid_slot_order',
    'reconciledAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ),
  updated_at=now()
  where stale.tenant_id=new.tenant_id and stale.branch_id is not distinct from new.branch_id
    and stale.entity_type='orders' and not stale.deleted and stale.entity_id<>new.entity_id
    and stale.payload->>'serviceMode'=v_mode and trim(coalesce(stale.payload->>'tableLabel',''))=v_slot
    and stale.payload->>'paymentStatus'='unpaid'
    and stale.payload->>'status' not in('cancelled','delivered')
    and nullif(stale.payload->>'saleId','') is null
    and public.kiubo_yuki_order_time_v1(stale.payload->>'createdAt') < v_time
    and not exists(
      select 1 from public.sync_entities sale
      where sale.tenant_id=stale.tenant_id and sale.entity_type='sales' and not sale.deleted
        and sale.payload->>'orderId'=stale.entity_id
    );
  return new;
end
$$;

drop trigger if exists kiubo_yuki_order_slot_before on public.sync_entities;
create trigger kiubo_yuki_order_slot_before
before insert or update on public.sync_entities
for each row execute function public.kiubo_yuki_slot_before_v1();
drop trigger if exists kiubo_yuki_order_slot_after on public.sync_entities;
create trigger kiubo_yuki_order_slot_after
after insert or update on public.sync_entities
for each row execute function public.kiubo_yuki_slot_after_v1();

revoke all on function public.kiubo_yuki_order_time_v1(text) from public,anon,authenticated;
revoke all on function public.kiubo_yuki_slot_before_v1() from public,anon,authenticated;
revoke all on function public.kiubo_yuki_slot_after_v1() from public,anon,authenticated;
