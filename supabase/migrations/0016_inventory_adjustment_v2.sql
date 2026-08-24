-- KIUBO Cloud v2 · atomic inventory adjustments.
-- Makes manual stock corrections row-locked, idempotent and auditable across concurrent devices.

create or replace function public.apply_inventory_adjustments_v2(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb;
  v_results jsonb:='[]'::jsonb;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_entity_id text;
  v_payload jsonb;
  v_product_id text;
  v_movement_id text;
  v_product_payload jsonb;
  v_product_branch uuid;
  v_delta numeric;
  v_stock numeric;
  v_new_stock numeric;
  v_reason text;
  v_created_at text;
  v_movement_payload jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>100 then raise exception 'maximum 100 inventory adjustments per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      if jsonb_typeof(op)<>'object' then raise exception 'inventory adjustment must be an object'; end if;
      if coalesce(op->>'entityType','')<>'inventoryAdjustmentTransactions' then raise exception 'invalid inventory adjustment entity'; end if;
      if coalesce(op->>'action','upsert')<>'upsert' then raise exception 'inventory adjustments only support upsert'; end if;

      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId','');
      v_entity_id:=nullif(op->>'entityId','');
      v_payload:=op->'payload';
      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then raise exception 'invalid inventory adjustment identifiers'; end if;
      if length(v_operation)>160 or length(v_entity_id)>200 then raise exception 'inventory adjustment identifier too long'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,'tenantProducts') then raise exception 'role denied for inventory adjustments'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      v_product_id=nullif(v_payload->>'productId','');
      v_movement_id=nullif(v_payload->>'movementId','');
      v_delta=coalesce(nullif(v_payload->>'delta','')::numeric,0);
      v_reason=left(trim(coalesce(v_payload->>'reason','Ajuste de inventario')),240);
      v_created_at=coalesce(nullif(v_payload->>'createdAt',''),now()::text);
      if v_product_id is null or v_movement_id is null or length(v_product_id)>200 or length(v_movement_id)>200 then raise exception 'invalid inventory adjustment reference'; end if;
      if v_delta=0 or v_delta<>trunc(v_delta) or abs(v_delta)>1000000 then raise exception 'invalid inventory adjustment quantity'; end if;
      if v_reason='' then raise exception 'inventory adjustment reason required'; end if;
      if length(v_created_at)>80 then raise exception 'invalid inventory adjustment timestamp'; end if;

      select payload,branch_id into v_product_payload,v_product_branch
      from public.sync_entities
      where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted
      for update;
      if not found then raise exception 'product not found: %',v_product_id; end if;
      if v_product_branch is distinct from v_branch then raise exception 'product belongs to another branch'; end if;
      if lower(coalesce(v_product_payload->>'active','true'))='false' then raise exception 'product is inactive'; end if;

      v_stock=coalesce(nullif(v_product_payload->>'stock','')::numeric,0);
      if v_stock<0 then raise exception 'invalid inventory state'; end if;
      v_new_stock=v_stock+v_delta;
      if v_new_stock<0 then raise exception 'insufficient stock for adjustment'; end if;

      update public.sync_entities
      set payload=jsonb_set(v_product_payload,'{stock}',to_jsonb(v_new_stock),true)
      where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;

      v_movement_payload=jsonb_build_object(
        'id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'productId',v_product_id,
        'type',case when v_delta>0 then 'adjustment_in' else 'adjustment_out' end,
        'quantity',v_delta,'previousStock',v_stock,'newStock',v_new_stock,'reference',v_reason,
        'clientOperationId',v_movement_id,'createdAt',v_created_at
      );
      v_movement_payload=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement_payload);
      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
      values(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement_payload,false,now())
      on conflict(tenant_id,entity_type,entity_id) do update
        set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
      values(v_tenant,v_operation,'inventoryAdjustmentTransaction',v_entity_id);

      v_results=v_results||jsonb_build_array(jsonb_build_object(
        'operationId',v_operation,'ok',true,'productId',v_product_id,'previousStock',v_stock,'newStock',v_new_stock
      ));
    exception when others then
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;

revoke all on function public.apply_inventory_adjustments_v2(jsonb) from public;
revoke all on function public.apply_inventory_adjustments_v2(jsonb) from anon;
grant execute on function public.apply_inventory_adjustments_v2(jsonb) to authenticated;
