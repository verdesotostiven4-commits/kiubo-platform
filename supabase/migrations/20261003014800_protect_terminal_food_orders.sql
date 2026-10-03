-- A delayed browser autosave must never move a restaurant order backwards after
-- a protected sale/payment transaction has made its state authoritative.
create or replace function public.apply_sync_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_type text;
  v_id text;
  v_action text;
  v_payload jsonb;
  v_existing jsonb;
  v_existing_payment text;
  v_incoming_payment text;
  v_existing_status text;
  v_incoming_status text;
  v_existing_sale text;
  v_incoming_sale text;
  v_guarded boolean;
  v_results jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>100 then raise exception 'maximum 100 operations per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant=(op->>'tenantId')::uuid;
      v_branch=nullif(op->>'branchId','')::uuid;
      v_operation=op->>'operationId';
      v_type=op->>'entityType';
      v_id=op->>'entityId';
      v_action=coalesce(op->>'action','upsert');

      if v_operation is null or v_type is null or v_id is null then raise exception 'invalid sync operation'; end if;
      if length(v_operation)>160 or length(v_type)>64 or length(v_id)>200 then raise exception 'sync identifier too long'; end if;
      if v_action not in('upsert','delete') then raise exception 'invalid sync action'; end if;
      if v_type not in('tenantProducts','customers','sales','cashSessions','cashMovements','credits','creditPayments','settings','branding','suppliers','purchases','supplierPayments','stockMovements','orders') then
        raise exception 'unsupported entity type';
      end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,v_type) then raise exception 'role denied for entity'; end if;
      if v_branch is not null and not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if v_branch is not null and not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      v_payload=case
        when v_action='delete' then '{}'::jsonb
        else public.normalize_sync_payload(v_tenant,v_branch,v_type,v_id,op->'payload')
      end;

      if v_type='orders' then
        v_existing=null;
        select payload into v_existing
        from public.sync_entities
        where tenant_id=v_tenant and entity_type='orders' and entity_id=v_id and not deleted
        for update;

        if found then
          v_existing_payment=lower(coalesce(v_existing->>'paymentStatus','unpaid'));
          v_incoming_payment=lower(coalesce(v_payload->>'paymentStatus','unpaid'));
          v_existing_status=lower(coalesce(v_existing->>'status','new'));
          v_incoming_status=lower(coalesce(v_payload->>'status','new'));
          v_existing_sale=nullif(v_existing->>'saleId','');
          v_incoming_sale=nullif(v_payload->>'saleId','');
          v_guarded=(
            (v_action='delete' and (
              v_existing_sale is not null
              or v_existing_payment in('partial','paid')
              or v_existing_status in('cancelled','delivered')
            ))
            or
            (v_action='upsert' and (
              (v_existing_payment='paid' and v_incoming_payment<>'paid')
              or (v_existing_payment='partial' and v_incoming_payment='unpaid')
              or (v_existing_status in('cancelled','delivered') and v_incoming_status<>v_existing_status)
              or (v_existing_sale is not null and v_incoming_sale is distinct from v_existing_sale)
            ))
          );

          if v_guarded then
            insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
            values(v_tenant,v_operation,v_type,v_id);
            v_results=v_results||jsonb_build_array(jsonb_build_object(
              'operationId',v_operation,
              'ok',true,
              'ignored',true,
              'reason','terminal_order_is_authoritative'
            ));
            continue;
          end if;
        end if;
      end if;

      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
      values(v_tenant,v_branch,v_type,v_id,v_payload,v_action='delete',now())
      on conflict(tenant_id,entity_type,entity_id) do update
        set branch_id=excluded.branch_id,payload=excluded.payload,deleted=excluded.deleted,updated_at=excluded.updated_at;

      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
      values(v_tenant,v_operation,v_type,v_id);
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true));
    exception when others then
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;

revoke all on function public.apply_sync_operations(jsonb) from public;
revoke all on function public.apply_sync_operations(jsonb) from anon;
grant execute on function public.apply_sync_operations(jsonb) to authenticated;
