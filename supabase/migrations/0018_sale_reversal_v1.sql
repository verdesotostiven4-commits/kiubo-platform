-- KIUBO Cloud v2 · atomic sale reversal for cash/transfer sales.
-- Restores product stock, marks the original sale voided and records any cash refund in one transaction.

create or replace function public.apply_sale_reversals_v1(p_operations jsonb)
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
  v_sale_id text;
  v_sale jsonb;
  v_items jsonb;
  v_item jsonb;
  v_payment text;
  v_total numeric;
  v_product_id text;
  v_product jsonb;
  v_product_branch uuid;
  v_qty numeric;
  v_stock numeric;
  v_new_stock numeric;
  v_movement_id text;
  v_movement jsonb;
  v_reason text;
  v_reversed_at text;
  v_cash jsonb;
  v_cash_id text;
  v_session_id text;
  v_session jsonb;
  v_cash_amount numeric;
  v_cash_payload jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 sale reversals per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId','');
      v_sale_id:=nullif(op->>'entityId','');
      if coalesce(op->>'entityType','')<>'saleReversalTransactions' then raise exception 'invalid sale reversal entity'; end if;
      if coalesce(op->>'action','upsert')<>'upsert' then raise exception 'sale reversals only support upsert'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_sale_id is null then raise exception 'invalid sale reversal identifiers'; end if;
      if length(v_operation)>160 or length(v_sale_id)>200 then raise exception 'sale reversal identifier too long'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,'sales') or not public.can_sync_entity(v_tenant,'stockMovements') then raise exception 'role denied for sale reversal'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_sale_id||':reversal',0));
      select payload into v_sale
      from public.sync_entities
      where tenant_id=v_tenant and branch_id=v_branch and entity_type='sales' and entity_id=v_sale_id and not deleted
      for update;
      if not found then raise exception 'sale not found'; end if;
      if lower(coalesce(v_sale->>'status','completed'))='voided' then
        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'saleReversal',v_sale_id)
        on conflict do nothing;
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateVoid',true));
        continue;
      end if;

      v_payment:=lower(coalesce(v_sale->>'payment','cash'));
      if v_payment not in('cash','transfer') then raise exception 'sale cannot be reversed with this payment method'; end if;
      v_total:=coalesce(nullif(v_sale->>'total','')::numeric,0);
      if v_total<0 then raise exception 'invalid sale total'; end if;
      v_items:=v_sale->'items';
      if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'sale reversal has no items'; end if;
      if jsonb_typeof(op->'payload'->'stockMovements')<>'array' or jsonb_array_length(op->'payload'->'stockMovements')<>jsonb_array_length(v_items) then raise exception 'sale reversal stock movement count mismatch'; end if;
      if exists(
        select 1 from (
          select movement->>'productId' product_id,count(*)
          from jsonb_array_elements(op->'payload'->'stockMovements') movement
          group by movement->>'productId' having count(*)>1
        ) duplicated
      ) then raise exception 'duplicate sale reversal product'; end if;

      v_reason:=left(regexp_replace(coalesce(op->'payload'->>'reason',''),'\s+',' ','g'),240);
      if length(trim(v_reason))<3 then raise exception 'sale reversal reason required'; end if;
      v_reversed_at:=coalesce(nullif(op->'payload'->>'reversedAt',''),now()::text);

      if v_payment='cash' then
        if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for cash refund'; end if;
        v_cash:=op->'payload'->'cashMovement';
        if jsonb_typeof(v_cash)<>'object' then raise exception 'cash sale reversal requires refund movement'; end if;
        v_cash_id:=nullif(v_cash->>'id','');
        v_session_id:=nullif(v_cash->>'sessionId','');
        if v_cash_id is null or v_session_id is null or length(v_cash_id)>200 or length(v_session_id)>200 then raise exception 'invalid cash refund identifiers'; end if;
        if lower(coalesce(v_cash->>'type','out'))<>'out' then raise exception 'cash refund must be an outflow'; end if;
        v_cash_amount:=coalesce(nullif(v_cash->>'amount','')::numeric,0);
        if abs(v_cash_amount-v_total)>0.001 then raise exception 'cash refund must equal sale total'; end if;
        select payload into v_session
        from public.sync_entities
        where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted
        for update;
        if not found or lower(coalesce(v_session->>'status',''))<>'open' then raise exception 'cash session is not open'; end if;
      elsif jsonb_typeof(op->'payload'->'cashMovement')='object' then
        raise exception 'transfer reversal cannot create cash refund';
      end if;

      for v_item in select value from jsonb_array_elements(v_items) loop
        v_product_id:=nullif(v_item->>'productId','');
        v_qty:=coalesce(nullif(v_item->>'qty','')::numeric,0);
        if v_product_id is null or length(v_product_id)>200 then raise exception 'invalid reversal product id'; end if;
        if v_qty<=0 or v_qty<>trunc(v_qty) then raise exception 'invalid reversal quantity'; end if;
        select payload,branch_id into v_product,v_product_branch
        from public.sync_entities
        where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted
        for update;
        if not found then raise exception 'product not found for sale reversal: %',v_product_id; end if;
        if v_product_branch is distinct from v_branch then raise exception 'reversal product belongs to another branch'; end if;
        v_stock:=coalesce(nullif(v_product->>'stock','')::numeric,0);
        v_new_stock:=v_stock+v_qty;
        update public.sync_entities
        set payload=jsonb_set(v_product,'{stock}',to_jsonb(v_new_stock),true)
        where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;

        select nullif(movement->>'id','') into v_movement_id
        from jsonb_array_elements(op->'payload'->'stockMovements') movement
        where movement->>'productId'=v_product_id limit 1;
        if v_movement_id is null or length(v_movement_id)>200 then raise exception 'sale reversal movement id missing'; end if;
        v_movement=jsonb_build_object(
          'id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'productId',v_product_id,
          'type','adjustment_in','quantity',v_qty,'previousStock',v_stock,'newStock',v_new_stock,
          'reference','VOID:'||v_sale_id,'clientOperationId',v_movement_id,'createdAt',v_reversed_at
        );
        v_movement:=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end loop;

      v_sale:=v_sale||jsonb_build_object('status','voided','voidedAt',v_reversed_at,'voidReason',trim(v_reason));
      v_sale:=public.normalize_sync_payload(v_tenant,v_branch,'sales',v_sale_id,v_sale);
      update public.sync_entities set payload=v_sale,updated_at=now()
      where tenant_id=v_tenant and entity_type='sales' and entity_id=v_sale_id;

      if v_payment='cash' then
        v_cash_payload:=jsonb_build_object(
          'id',v_cash_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'sessionId',v_session_id,
          'type','out','amount',round(v_total,2),'reason',left('Anulación venta · '||trim(v_reason),240),
          'clientOperationId',coalesce(nullif(v_cash->>'clientOperationId',''),v_cash_id),'createdAt',v_reversed_at
        );
        v_cash_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end if;

      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
      values(v_tenant,v_operation,'saleReversal',v_sale_id);
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'saleId',v_sale_id,'status','voided'));
    exception when others then
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;

revoke all on function public.apply_sale_reversals_v1(jsonb) from public;
revoke all on function public.apply_sale_reversals_v1(jsonb) from anon;
grant execute on function public.apply_sale_reversals_v1(jsonb) to authenticated;
