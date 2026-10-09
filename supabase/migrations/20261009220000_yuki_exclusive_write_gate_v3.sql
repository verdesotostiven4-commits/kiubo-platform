-- YUKI exclusive Cloud write gate. This migration is deliberately staged:
-- deploy upgraded POS first, ensure its local queue is reconciled, then apply.
-- All original RPCs retain their signatures and other KIUBO tenants are unaffected.
-- The lock serializes a write batch against device transfer to eliminate the
-- gap between a client heartbeat and a Cloud transaction.
create or replace function public.kiubo_assert_yuki_device_batch_v3(p_operations jsonb)
returns void language plpgsql security definer set search_path=public as $body$
declare
  op jsonb;
  v_tenant uuid;
  v_device text;
  v_user uuid:=auth.uid();
  v_lease public.tenant_operational_leases_v2%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_operations)<>'array' then raise exception 'operations must be an array'; end if;
  for op in select value from jsonb_array_elements(p_operations) loop
    if jsonb_typeof(op)<>'object' then raise exception 'invalid operation'; end if;
    v_tenant:=nullif(op->>'tenantId','')::uuid;
    if v_tenant is distinct from '8e2d0299-5680-4eec-8c57-e37fe29086aa'::uuid then continue; end if;
    if public.is_platform_admin() then continue; end if;
    if not public.has_tenant_access(v_tenant) then raise exception 'tenant denied'; end if;
    v_device:=nullif(op->>'deviceId','');
    if v_device is null or length(v_device)<4 or length(v_device)>220 then
      raise exception 'El dispositivo debe actualizar KIUBO antes de sincronizar cobros pendientes';
    end if;
    -- FOR SHARE is held until the surrounding transaction commits/rolls back.
    -- Transfer/claim obtains a row UPDATE lock, so an old device cannot race
    -- with a new owner while its payment batch is being committed.
    select * into v_lease from public.tenant_operational_leases_v2
      where tenant_id=v_tenant for share;
    if not found or v_lease.user_id<>v_user or v_lease.device_id<>v_device
        or v_lease.last_seen_at<now()-interval '75 seconds' then
      raise exception 'Caja no autorizada en este dispositivo; operaciones protegidas sin enviar';
    end if;
  end loop;
end
$body$;
revoke all on function public.kiubo_assert_yuki_device_batch_v3(jsonb) from public,anon,authenticated;

-- Safely wrap each CURRENT public writer in-place: preserving its signature,
-- transaction logic, idempotency, exceptions and grants. The migration must
-- fail (rather than install a partial gate) if a function body changed shape.
do $gate$
declare
  v_name text;
  v_fn regprocedure;
  v_definition text;
  v_replaced text;
  v_targets text[]:=array[
    'apply_sync_operations',
    'apply_sale_transactions_v2',
    'apply_finance_transactions_v2',
    'apply_sale_reversals_v1',
    'apply_purchase_transactions_v3',
    'apply_inventory_adjustments_v2'
  ];
begin
  foreach v_name in array v_targets loop
    v_fn:=to_regprocedure('public.'||v_name||'(jsonb)');
    if v_fn is null then raise exception 'Missing expected Cloud writer: %',v_name; end if;
    select pg_get_functiondef(v_fn) into v_definition;
    if position('kiubo_assert_yuki_device_batch_v3' in v_definition)>0 then continue; end if;
    -- PostgreSQL plpgsql body has an outer BEGIN before any inner BEGIN.
    v_replaced:=regexp_replace(v_definition,E'\\mbegin\\M',
      E'begin\n  PERFORM public.kiubo_assert_yuki_device_batch_v3(p_operations);','i');
    if v_replaced=v_definition then
      raise exception 'Could not instrument writer %, aborting migration',v_name;
    end if;
    execute v_replaced;
  end loop;
end
$gate$;
