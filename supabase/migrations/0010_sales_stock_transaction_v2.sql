-- KIUBO Cloud v2 phase 2 · atomic, idempotent sales + stock transaction engine.
-- Applies each real sale as one database transaction so concurrent devices cannot overwrite stock.
-- Requires 0009_sync_revision_cursor.sql to be applied first.

create or replace function public.apply_sale_transactions_v2(p_operations jsonb)
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
  v_customer_id text;
  v_product_id text;
  v_product_payload jsonb;
  v_product_branch uuid;
  v_qty numeric;
  v_stock numeric;
  v_new_stock numeric;
  v_price numeric;
  v_cost numeric;
  v_total numeric;
  v_canonical_items jsonb;
  v_movement_id text;
  v_movement_payload jsonb;
  v_sale_payload jsonb;
  v_credit jsonb;
  v_credit_id text;
  v_credit_payload jsonb;
  v_created_at text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 sale transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant:=null;
      v_branch:=null;
      v_operation:=null;
      v_sale_id:=null;
      v_sale:=null;
      v_items:=null;
      v_payment:=null;
      v_customer_id:=null;
      v_total:=0;
      v_canonical_items:='[]'::jsonb;
      v_credit:=null;

      if jsonb_typeof(op)<>'object' then raise exception 'sale transaction must be an object'; end if;
      if coalesce(op->>'entityType','')<>'saleTransactions' then raise exception 'invalid sale transaction entity'; end if;
      if coalesce(op->>'action','upsert')<>'upsert' then raise exception 'sale transactions only support upsert'; end if;

      v_tenant=nullif(op->>'tenantId','')::uuid;
      v_branch=nullif(op->>'branchId','')::uuid;
      v_operation=nullif(op->>'operationId','');
      v_sale_id=nullif(op->>'entityId','');
      v_sale=op->'payload'->'sale';
      v_credit=op->'payload'->'credit';

      if v_tenant is null or v_branch is null or v_operation is null or v_sale_id is null then raise exception 'invalid sale transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_sale_id)>200 then raise exception 'sale transaction identifier too long'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,'sales') then raise exception 'role denied for sales'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_sale_id,0));

      if exists(
        select 1 from public.sync_entities
        where tenant_id=v_tenant and entity_type='sales' and entity_id=v_sale_id and not deleted
      ) then
        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'saleTransaction',v_sale_id)
        on conflict do nothing;
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateSale',true));
        continue;
      end if;

      if jsonb_typeof(v_sale)<>'object' then raise exception 'sale payload must be an object'; end if;
      if nullif(v_sale->>'id','') is not null and v_sale->>'id'<>v_sale_id then raise exception 'sale id mismatch'; end if;
      if nullif(v_sale->>'tenantId','') is not null and v_sale->>'tenantId'<>v_tenant::text then raise exception 'sale tenant mismatch'; end if;
      if nullif(v_sale->>'branchId','') is not null and v_sale->>'branchId'<>v_branch::text then raise exception 'sale branch mismatch'; end if;

      v_items=v_sale->'items';
      if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'sale must contain at least one item'; end if;
      if jsonb_array_length(v_items)>200 then raise exception 'sale has too many items'; end if;
      if exists(
        select 1
        from (
          select elem->>'productId' as product_id,count(*)
          from jsonb_array_elements(v_items) elem
          group by elem->>'productId'
          having count(*)>1
        ) duplicated
      ) then raise exception 'duplicate product in sale'; end if;

      if coalesce(jsonb_typeof(op->'payload'->'stockMovements'),'null')<>'array' then raise exception 'stock movements must be an array'; end if;
      if jsonb_array_length(op->'payload'->'stockMovements')<>jsonb_array_length(v_items) then raise exception 'stock movement count mismatch'; end if;
      if exists(
        select 1
        from (
          select movement->>'productId' as product_id,count(*)
          from jsonb_array_elements(op->'payload'->'stockMovements') movement
          group by movement->>'productId'
          having count(*)>1
        ) duplicated_movements
      ) then raise exception 'duplicate stock movement product'; end if;
      if exists(
        select 1
        from (
          select movement->>'id' as movement_id,count(*)
          from jsonb_array_elements(op->'payload'->'stockMovements') movement
          group by movement->>'id'
          having count(*)>1
        ) duplicated_movement_ids
      ) then raise exception 'duplicate stock movement id'; end if;

      v_payment=lower(coalesce(v_sale->>'payment','cash'));
      if v_payment not in('cash','transfer','mixed','credit') then raise exception 'invalid payment method'; end if;
      v_customer_id=nullif(v_sale->>'customerId','');
      if v_payment='credit' and v_customer_id is null then raise exception 'credit sale requires customer'; end if;
      if v_customer_id is not null and not exists(
        select 1 from public.sync_entities
        where tenant_id=v_tenant and entity_type='customers' and entity_id=v_customer_id and not deleted
      ) then raise exception 'customer not found'; end if;

      v_created_at=coalesce(nullif(v_sale->>'createdAt',''),now()::text);
      if length(v_created_at)>80 then raise exception 'invalid sale timestamp'; end if;

      for v_item in select value from jsonb_array_elements(v_items) loop
        if jsonb_typeof(v_item)<>'object' then raise exception 'sale item must be an object'; end if;
        v_product_id=nullif(v_item->>'productId','');
        if v_product_id is null or length(v_product_id)>200 then raise exception 'invalid product id'; end if;

        v_qty=(v_item->>'qty')::numeric;
        if v_qty<=0 or v_qty<>trunc(v_qty) or v_qty>1000000 then raise exception 'invalid sale quantity'; end if;

        select payload,branch_id
        into v_product_payload,v_product_branch
        from public.sync_entities
        where tenant_id=v_tenant
          and entity_type='tenantProducts'
          and entity_id=v_product_id
          and not deleted
        for update;

        if not found then raise exception 'product not found: %',v_product_id; end if;
        if v_product_branch is distinct from v_branch then raise exception 'product belongs to another branch'; end if;
        if lower(coalesce(v_product_payload->>'active','true'))='false' then raise exception 'product is inactive'; end if;

        v_stock=coalesce(nullif(v_product_payload->>'stock','')::numeric,0);
        v_new_stock=v_stock-v_qty;
        v_price=coalesce(nullif(v_item->>'unitPrice','')::numeric,nullif(v_product_payload->>'price','')::numeric,0);
        v_cost=coalesce(nullif(v_product_payload->>'cost','')::numeric,nullif(v_item->>'unitCost','')::numeric,0);
        if v_price<0 or v_cost<0 then raise exception 'negative price or cost is not allowed'; end if;

        update public.sync_entities
        set payload=jsonb_set(v_product_payload,'{stock}',to_jsonb(v_new_stock),true)
        where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;

        select nullif(movement->>'id','')
        into v_movement_id
        from jsonb_array_elements(op->'payload'->'stockMovements') movement
        where movement->>'productId'=v_product_id
        limit 1;
        if v_movement_id is null then raise exception 'stock movement id missing'; end if;
        if length(v_movement_id)>200 then raise exception 'stock movement id too long'; end if;

        v_movement_payload=jsonb_build_object(
          'id',v_movement_id,
          'tenantId',v_tenant::text,
          'branchId',v_branch::text,
          'productId',v_product_id,
          'type','sale',
          'quantity',-v_qty,
          'previousStock',v_stock,
          'newStock',v_new_stock,
          'reference',v_sale_id,
          'clientOperationId',v_movement_id,
          'createdAt',v_created_at
        );
        v_movement_payload=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement_payload);

        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update
          set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

        v_canonical_items=v_canonical_items||jsonb_build_array(jsonb_build_object(
          'productId',v_product_id,
          'name',coalesce(nullif(v_product_payload->>'name',''),nullif(v_item->>'name',''),'Producto'),
          'qty',v_qty,
          'unitPrice',v_price,
          'unitCost',v_cost
        ));
        v_total=v_total+round(v_price*v_qty,2);
      end loop;

      v_total=round(v_total,2);
      v_sale_payload=jsonb_build_object(
        'id',v_sale_id,
        'tenantId',v_tenant::text,
        'branchId',v_branch::text,
        'customerId',v_customer_id,
        'total',v_total,
        'payment',v_payment,
        'items',v_canonical_items,
        'clientOperationId',coalesce(nullif(v_sale->>'clientOperationId',''),v_sale_id),
        'createdAt',v_created_at
      );
      if v_customer_id is null then v_sale_payload=v_sale_payload-'customerId'; end if;
      v_sale_payload=public.normalize_sync_payload(v_tenant,v_branch,'sales',v_sale_id,v_sale_payload);

      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
      values(v_tenant,v_branch,'sales',v_sale_id,v_sale_payload,false,now())
      on conflict(tenant_id,entity_type,entity_id) do update
        set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

      if v_payment='credit' then
        if jsonb_typeof(v_credit)<>'object' then raise exception 'credit payload missing'; end if;
        v_credit_id=nullif(v_credit->>'id','');
        if v_credit_id is null or length(v_credit_id)>200 then raise exception 'invalid credit id'; end if;
        v_credit_payload=jsonb_build_object(
          'id',v_credit_id,
          'tenantId',v_tenant::text,
          'branchId',v_branch::text,
          'customerId',v_customer_id,
          'saleId',v_sale_id,
          'description',coalesce(nullif(v_credit->>'description',''),'Venta '||right(v_sale_id,8)),
          'originalAmount',v_total,
          'balance',v_total,
          'status','open',
          'createdAt',v_created_at
        );
        v_credit_payload=public.normalize_sync_payload(v_tenant,v_branch,'credits',v_credit_id,v_credit_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'credits',v_credit_id,v_credit_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update
          set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end if;

      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
      values(v_tenant,v_operation,'saleTransaction',v_sale_id);

      v_results=v_results||jsonb_build_array(jsonb_build_object(
        'operationId',v_operation,
        'ok',true,
        'saleId',v_sale_id,
        'total',v_total
      ));
    exception when others then
      v_results=v_results||jsonb_build_array(jsonb_build_object(
        'operationId',coalesce(v_operation,''),
        'ok',false,
        'error',sqlerrm
      ));
    end;
  end loop;

  return v_results;
end
$$;

revoke all on function public.apply_sale_transactions_v2(jsonb) from public;
revoke all on function public.apply_sale_transactions_v2(jsonb) from anon;
grant execute on function public.apply_sale_transactions_v2(jsonb) to authenticated;
