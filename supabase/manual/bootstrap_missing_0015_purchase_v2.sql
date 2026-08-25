-- KIUBO Cloud bootstrap · missing 0015_purchase_transaction_v2.sql
-- Run only against KIUBO project hysrlckmnzlmscwwbibn.
-- This creates/replaces the missing atomic purchase engine. It does not insert or delete business data.

create or replace function public.apply_purchase_transactions_v2(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb;
  v_results jsonb:='[]'::jsonb;
  v_type text;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_entity_id text;
  v_purchase jsonb;
  v_purchase_id text;
  v_supplier_id text;
  v_items jsonb;
  v_item jsonb;
  v_product_id text;
  v_product_payload jsonb;
  v_product_branch uuid;
  v_qty numeric;
  v_unit_cost numeric;
  v_stock numeric;
  v_old_cost numeric;
  v_new_stock numeric;
  v_new_cost numeric;
  v_total numeric;
  v_canonical_items jsonb;
  v_movement_id text;
  v_movement_payload jsonb;
  v_purchase_payload jsonb;
  v_payment jsonb;
  v_payment_id text;
  v_payment_amount numeric;
  v_payment_method text;
  v_payment_payload jsonb;
  v_paid numeric;
  v_balance numeric;
  v_payment_status text;
  v_created_at text;
  v_document_number text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 purchase transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_type:=coalesce(op->>'entityType','');
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId','');
      v_entity_id:=nullif(op->>'entityId','');

      if jsonb_typeof(op)<>'object' then raise exception 'purchase transaction must be an object'; end if;
      if v_type not in('purchaseTransactions','supplierPaymentTransactions') then raise exception 'invalid purchase transaction entity'; end if;
      if coalesce(op->>'action','upsert')<>'upsert' then raise exception 'purchase transactions only support upsert'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then raise exception 'invalid purchase transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_entity_id)>200 then raise exception 'purchase transaction identifier too long'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      if v_type='purchaseTransactions' then
        if not public.can_sync_entity(v_tenant,'purchases') then raise exception 'role denied for purchases'; end if;
        perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':purchase:'||v_entity_id,0));

        if exists(select 1 from public.sync_entities where tenant_id=v_tenant and entity_type='purchases' and entity_id=v_entity_id and not deleted) then
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
          values(v_tenant,v_operation,'purchaseTransaction',v_entity_id) on conflict do nothing;
          v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicatePurchase',true));
          continue;
        end if;

        v_purchase=op->'payload'->'purchase';
        v_payment=op->'payload'->'initialPayment';
        if jsonb_typeof(v_purchase)<>'object' then raise exception 'purchase payload must be an object'; end if;
        v_purchase_id=v_entity_id;
        if nullif(v_purchase->>'id','') is not null and v_purchase->>'id'<>v_purchase_id then raise exception 'purchase id mismatch'; end if;
        if nullif(v_purchase->>'tenantId','') is not null and v_purchase->>'tenantId'<>v_tenant::text then raise exception 'purchase tenant mismatch'; end if;
        if nullif(v_purchase->>'branchId','') is not null and v_purchase->>'branchId'<>v_branch::text then raise exception 'purchase branch mismatch'; end if;

        v_supplier_id=nullif(v_purchase->>'supplierId','');
        if v_supplier_id is null or not exists(
          select 1 from public.sync_entities where tenant_id=v_tenant and entity_type='suppliers' and entity_id=v_supplier_id and not deleted
        ) then raise exception 'supplier not found'; end if;

        v_document_number=trim(coalesce(v_purchase->>'documentNumber',''));
        if length(v_document_number)>120 then raise exception 'purchase document number too long'; end if;
        if v_document_number<>'' and exists(
          select 1 from public.sync_entities
          where tenant_id=v_tenant and entity_type='purchases' and not deleted
            and entity_id<>v_purchase_id
            and payload->>'supplierId'=v_supplier_id
            and trim(coalesce(payload->>'documentNumber',''))=v_document_number
        ) then raise exception 'duplicate purchase document'; end if;

        v_items=v_purchase->'items';
        if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'purchase must contain at least one item'; end if;
        if jsonb_array_length(v_items)>200 then raise exception 'purchase has too many items'; end if;
        if exists(
          select 1 from (
            select elem->>'productId' as product_id,count(*)
            from jsonb_array_elements(v_items) elem
            group by elem->>'productId' having count(*)>1
          ) duplicated
        ) then raise exception 'duplicate product in purchase'; end if;

        if coalesce(jsonb_typeof(op->'payload'->'stockMovements'),'null')<>'array' then raise exception 'purchase stock movements must be an array'; end if;
        if jsonb_array_length(op->'payload'->'stockMovements')<>jsonb_array_length(v_items) then raise exception 'purchase stock movement count mismatch'; end if;

        v_total:=0;
        v_canonical_items:='[]'::jsonb;
        v_created_at=coalesce(nullif(v_purchase->>'createdAt',''),now()::text);
        if length(v_created_at)>80 then raise exception 'invalid purchase timestamp'; end if;

        for v_item in select value from jsonb_array_elements(v_items) loop
          v_product_id=nullif(v_item->>'productId','');
          if v_product_id is null or length(v_product_id)>200 then raise exception 'invalid purchase product id'; end if;
          v_qty=(v_item->>'qty')::numeric;
          v_unit_cost=(v_item->>'unitCost')::numeric;
          if v_qty<=0 or v_qty<>trunc(v_qty) or v_qty>1000000 then raise exception 'invalid purchase quantity'; end if;
          if v_unit_cost<0 or v_unit_cost>100000000 then raise exception 'invalid purchase cost'; end if;

          select payload,branch_id into v_product_payload,v_product_branch
          from public.sync_entities
          where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted
          for update;
          if not found then raise exception 'product not found: %',v_product_id; end if;
          if v_product_branch is distinct from v_branch then raise exception 'product belongs to another branch'; end if;
          if lower(coalesce(v_product_payload->>'active','true'))='false' then raise exception 'product is inactive'; end if;

          v_stock=coalesce(nullif(v_product_payload->>'stock','')::numeric,0);
          v_old_cost=coalesce(nullif(v_product_payload->>'cost','')::numeric,0);
          if v_stock<0 or v_old_cost<0 then raise exception 'invalid inventory state'; end if;
          v_new_stock=v_stock+v_qty;
          v_new_cost=case when v_new_stock>0 then ((v_stock*v_old_cost)+(v_qty*v_unit_cost))/v_new_stock else v_unit_cost end;
          v_new_cost=round(v_new_cost,4);

          update public.sync_entities
          set payload=jsonb_set(jsonb_set(v_product_payload,'{stock}',to_jsonb(v_new_stock),true),'{cost}',to_jsonb(v_new_cost),true)
          where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;

          select nullif(movement->>'id','') into v_movement_id
          from jsonb_array_elements(op->'payload'->'stockMovements') movement
          where movement->>'productId'=v_product_id
          limit 1;
          if v_movement_id is null or length(v_movement_id)>200 then raise exception 'purchase stock movement id missing'; end if;

          v_movement_payload=jsonb_build_object(
            'id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'productId',v_product_id,
            'type','purchase','quantity',v_qty,'previousStock',v_stock,'newStock',v_new_stock,
            'reference',v_purchase_id,'clientOperationId',v_movement_id,'createdAt',v_created_at
          );
          v_movement_payload=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement_payload);
          insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
          values(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement_payload,false,now())
          on conflict(tenant_id,entity_type,entity_id) do update
            set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

          v_canonical_items=v_canonical_items||jsonb_build_array(jsonb_build_object(
            'productId',v_product_id,
            'name',coalesce(nullif(v_product_payload->>'name',''),nullif(v_item->>'name',''),'Producto'),
            'qty',v_qty,'unitCost',v_unit_cost
          ));
          v_total=v_total+round(v_unit_cost*v_qty,2);
        end loop;

        v_total=round(v_total,2);
        v_paid:=0;
        v_payment_status:='pending';
        if jsonb_typeof(v_payment)='object' then
          v_payment_id=nullif(v_payment->>'id','');
          v_payment_amount=coalesce(nullif(v_payment->>'amount','')::numeric,0);
          v_payment_method=lower(coalesce(v_payment->>'method','transfer'));
          if v_payment_id is null or length(v_payment_id)>200 then raise exception 'invalid initial supplier payment id'; end if;
          if v_payment_amount<=0 or v_payment_amount>v_total+.001 then raise exception 'invalid initial supplier payment amount'; end if;
          if v_payment_method not in('cash','transfer','card','other') then raise exception 'invalid supplier payment method'; end if;
          v_paid=round(least(v_payment_amount,v_total),2);
          v_payment_status=case when v_paid>=v_total-.001 then 'paid' else 'partial' end;
        end if;

        v_purchase_payload=jsonb_build_object(
          'id',v_purchase_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'supplierId',v_supplier_id,
          'total',v_total,'items',v_canonical_items,
          'documentType',coalesce(nullif(v_purchase->>'documentType',''),'other'),
          'documentNumber',v_document_number,
          'documentDate',coalesce(nullif(v_purchase->>'documentDate',''),left(v_created_at,10)),
          'notes',coalesce(v_purchase->>'notes',''),
          'status','received','paymentStatus',v_payment_status,'paidAmount',v_paid,
          'clientOperationId',coalesce(nullif(v_purchase->>'clientOperationId',''),v_purchase_id),'createdAt',v_created_at
        );
        if nullif(v_purchase->>'dueDate','') is not null then v_purchase_payload=v_purchase_payload||jsonb_build_object('dueDate',v_purchase->>'dueDate'); end if;
        v_purchase_payload=public.normalize_sync_payload(v_tenant,v_branch,'purchases',v_purchase_id,v_purchase_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'purchases',v_purchase_id,v_purchase_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update
          set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

        if jsonb_typeof(v_payment)='object' then
          v_payment_payload=jsonb_build_object(
            'id',v_payment_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'supplierId',v_supplier_id,
            'purchaseId',v_purchase_id,'amount',v_paid,'method',v_payment_method,
            'note',coalesce(nullif(v_payment->>'note',''),'Pago inicial'),
            'clientOperationId',coalesce(nullif(v_payment->>'clientOperationId',''),v_payment_id),'createdAt',v_created_at
          );
          v_payment_payload=public.normalize_sync_payload(v_tenant,v_branch,'supplierPayments',v_payment_id,v_payment_payload);
          insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
          values(v_tenant,v_branch,'supplierPayments',v_payment_id,v_payment_payload,false,now())
          on conflict(tenant_id,entity_type,entity_id) do update
            set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
        end if;

        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'purchaseTransaction',v_purchase_id);
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'purchaseId',v_purchase_id,'total',v_total));

      else
        if not public.can_sync_entity(v_tenant,'supplierPayments') then raise exception 'role denied for supplier payments'; end if;
        v_payment=op->'payload'->'payment';
        if jsonb_typeof(v_payment)<>'object' then raise exception 'supplier payment payload must be an object'; end if;
        v_payment_id=v_entity_id;
        if nullif(v_payment->>'id','') is not null and v_payment->>'id'<>v_payment_id then raise exception 'supplier payment id mismatch'; end if;
        v_purchase_id=nullif(v_payment->>'purchaseId','');
        v_supplier_id=nullif(v_payment->>'supplierId','');
        v_payment_amount=coalesce(nullif(v_payment->>'amount','')::numeric,0);
        v_payment_method=lower(coalesce(v_payment->>'method','transfer'));
        if v_purchase_id is null or v_supplier_id is null then raise exception 'invalid supplier payment reference'; end if;
        if v_payment_amount<=0 then raise exception 'supplier payment must be positive'; end if;
        if v_payment_method not in('cash','transfer','card','other') then raise exception 'invalid supplier payment method'; end if;

        perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':purchase:'||v_purchase_id,0));
        select payload into v_purchase_payload
        from public.sync_entities
        where tenant_id=v_tenant and entity_type='purchases' and entity_id=v_purchase_id and not deleted
        for update;
        if not found then raise exception 'purchase not found'; end if;
        if v_purchase_payload->>'supplierId'<>v_supplier_id then raise exception 'supplier payment supplier mismatch'; end if;
        if v_purchase_payload->>'branchId'<>v_branch::text then raise exception 'supplier payment branch mismatch'; end if;

        v_total=coalesce(nullif(v_purchase_payload->>'total','')::numeric,0);
        v_paid=coalesce(nullif(v_purchase_payload->>'paidAmount','')::numeric,0);
        v_balance=greatest(0,v_total-v_paid);
        if v_balance<=.001 then raise exception 'purchase already paid'; end if;
        if v_payment_amount>v_balance+.001 then raise exception 'supplier payment exceeds purchase balance'; end if;
        v_payment_amount=round(v_payment_amount,2);
        v_paid=round(v_paid+v_payment_amount,2);
        v_payment_status=case when v_paid>=v_total-.001 then 'paid' else 'partial' end;

        v_purchase_payload=jsonb_set(jsonb_set(v_purchase_payload,'{paidAmount}',to_jsonb(v_paid),true),'{paymentStatus}',to_jsonb(v_payment_status),true);
        update public.sync_entities set payload=v_purchase_payload
        where tenant_id=v_tenant and entity_type='purchases' and entity_id=v_purchase_id;

        v_created_at=coalesce(nullif(v_payment->>'createdAt',''),now()::text);
        v_payment_payload=jsonb_build_object(
          'id',v_payment_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'supplierId',v_supplier_id,
          'purchaseId',v_purchase_id,'amount',v_payment_amount,'method',v_payment_method,
          'note',coalesce(v_payment->>'note',''),'clientOperationId',coalesce(nullif(v_payment->>'clientOperationId',''),v_payment_id),'createdAt',v_created_at
        );
        v_payment_payload=public.normalize_sync_payload(v_tenant,v_branch,'supplierPayments',v_payment_id,v_payment_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'supplierPayments',v_payment_id,v_payment_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update
          set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'supplierPaymentTransaction',v_payment_id);
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'paymentId',v_payment_id,'paidAmount',v_paid));
      end if;

    exception when others then
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;

  return v_results;
end
$$;

revoke all on function public.apply_purchase_transactions_v2(jsonb) from public;
revoke all on function public.apply_purchase_transactions_v2(jsonb) from anon;
grant execute on function public.apply_purchase_transactions_v2(jsonb) to authenticated;

select to_regprocedure('public.apply_purchase_transactions_v2(jsonb)') is not null as purchase_v2_ready;
