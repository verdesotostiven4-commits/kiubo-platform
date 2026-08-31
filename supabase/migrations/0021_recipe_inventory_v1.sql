-- KIUBO Cloud v2 · shared ingredient / recipe inventory.
-- Sale items describe what was sold. stockMovements describe the exact physical inventory impact.
-- This keeps prepared products, combos and selected flavors atomic across multiple devices.

create or replace function public.kiubo_recipe_inventory_capability()
returns boolean
language sql
stable
security definer
set search_path=public
as $$ select true $$;
revoke all on function public.kiubo_recipe_inventory_capability() from public;
revoke all on function public.kiubo_recipe_inventory_capability() from anon;
grant execute on function public.kiubo_recipe_inventory_capability() to authenticated;

create or replace function public.apply_sale_transactions_v2(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb; v_results jsonb:='[]'::jsonb;
  v_tenant uuid; v_branch uuid; v_operation text; v_sale_id text; v_sale jsonb; v_items jsonb; v_item jsonb;
  v_payment text; v_customer_id text; v_created_at text; v_product_id text; v_product jsonb; v_product_branch uuid;
  v_qty numeric; v_price numeric; v_cost numeric; v_total numeric; v_canonical_items jsonb; v_sale_payload jsonb;
  v_movements jsonb; v_move jsonb; v_movement_id text; v_stock numeric; v_new_stock numeric; v_move_qty numeric; v_move_payload jsonb;
  v_credit jsonb; v_credit_id text; v_credit_payload jsonb; v_name text; v_option text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 sale transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant:=nullif(op->>'tenantId','')::uuid; v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId',''); v_sale_id:=nullif(op->>'entityId','');
      v_sale:=op->'payload'->'sale'; v_credit:=op->'payload'->'credit'; v_movements:=coalesce(op->'payload'->'stockMovements','[]'::jsonb);
      v_total:=0; v_canonical_items:='[]'::jsonb;
      if coalesce(op->>'entityType','')<>'saleTransactions' or coalesce(op->>'action','upsert')<>'upsert' then raise exception 'invalid sale transaction'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_sale_id is null then raise exception 'invalid sale transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_sale_id)>200 then raise exception 'sale transaction identifier too long'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,'sales') or not public.can_sync_entity(v_tenant,'stockMovements') then raise exception 'role denied for sale transaction'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) or not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;
      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true)); continue; end if;
      perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_sale_id,0));
      if exists(select 1 from public.sync_entities where tenant_id=v_tenant and entity_type='sales' and entity_id=v_sale_id and not deleted) then
        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'saleTransaction',v_sale_id) on conflict do nothing;
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateSale',true)); continue;
      end if;
      if jsonb_typeof(v_sale)<>'object' then raise exception 'sale payload must be an object'; end if;
      if nullif(v_sale->>'id','') is not null and v_sale->>'id'<>v_sale_id then raise exception 'sale id mismatch'; end if;
      v_items:=v_sale->'items';
      if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 or jsonb_array_length(v_items)>200 then raise exception 'invalid sale items'; end if;
      if jsonb_typeof(v_movements)<>'array' or jsonb_array_length(v_movements)>300 then raise exception 'invalid stock movements'; end if;
      if exists(select 1 from (select value->>'id' id,count(*) from jsonb_array_elements(v_movements) group by value->>'id' having count(*)>1) x) then raise exception 'duplicate stock movement id'; end if;
      if exists(select 1 from (select value->>'productId' id,count(*) from jsonb_array_elements(v_movements) group by value->>'productId' having count(*)>1) x) then raise exception 'duplicate stock movement product'; end if;

      v_payment:=lower(coalesce(v_sale->>'payment','cash'));
      if v_payment not in('cash','transfer','mixed','credit') then raise exception 'invalid payment method'; end if;
      v_customer_id:=nullif(v_sale->>'customerId','');
      if v_payment='credit' and v_customer_id is null then raise exception 'credit sale requires customer'; end if;
      if v_customer_id is not null and not exists(select 1 from public.sync_entities where tenant_id=v_tenant and entity_type='customers' and entity_id=v_customer_id and not deleted) then raise exception 'customer not found'; end if;
      v_created_at:=coalesce(nullif(v_sale->>'createdAt',''),now()::text);

      -- Validate what was sold and preserve the option/flavor description for analytics and receipts.
      for v_item in select value from jsonb_array_elements(v_items) loop
        v_product_id:=nullif(v_item->>'productId',''); v_qty:=coalesce(nullif(v_item->>'qty','')::numeric,0);
        if v_product_id is null or length(v_product_id)>200 or v_qty<=0 or v_qty<>trunc(v_qty) then raise exception 'invalid sale item'; end if;
        select payload,branch_id into v_product,v_product_branch from public.sync_entities where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted;
        if not found or v_product_branch is distinct from v_branch then raise exception 'sale product not found in branch: %',v_product_id; end if;
        if lower(coalesce(v_product->>'active','true'))='false' then raise exception 'product is inactive'; end if;
        v_price:=coalesce(nullif(v_item->>'unitPrice','')::numeric,nullif(v_product->>'price','')::numeric,0); v_cost:=coalesce(nullif(v_product->>'cost','')::numeric,nullif(v_item->>'unitCost','')::numeric,0);
        if v_price<0 or v_cost<0 then raise exception 'negative price or cost is not allowed'; end if;
        v_name:=left(coalesce(nullif(regexp_replace(v_item->>'name','\s+',' ','g'),''),nullif(v_product->>'name',''),'Producto'),240);
        v_option:=left(coalesce(nullif(regexp_replace(v_item->>'optionLabel','\s+',' ','g'),''),''),300);
        v_item:=jsonb_build_object('productId',v_product_id,'name',v_name,'qty',v_qty,'unitPrice',v_price,'unitCost',v_cost);
        if v_option<>'' then v_item:=v_item||jsonb_build_object('optionLabel',v_option); end if;
        v_canonical_items:=v_canonical_items||jsonb_build_array(v_item); v_total:=v_total+round(v_price*v_qty,2);
      end loop;

      -- Apply exact shared-inventory impact supplied by the trusted KIUBO client. Each product is aggregated once.
      for v_move in select value from jsonb_array_elements(v_movements) loop
        v_movement_id:=nullif(v_move->>'id',''); v_product_id:=nullif(v_move->>'productId',''); v_move_qty:=coalesce(nullif(v_move->>'quantity','')::numeric,0);
        if v_movement_id is null or v_product_id is null or length(v_movement_id)>200 or length(v_product_id)>200 then raise exception 'invalid stock movement identifiers'; end if;
        if v_move_qty>=0 or abs(v_move_qty)>1000000000 then raise exception 'sale stock movement must be negative'; end if;
        select payload,branch_id into v_product,v_product_branch from public.sync_entities where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted for update;
        if not found or v_product_branch is distinct from v_branch then raise exception 'inventory item not found in branch: %',v_product_id; end if;
        if lower(coalesce(v_product->>'trackStock','true'))='false' then raise exception 'untracked item cannot receive sale stock movement'; end if;
        v_stock:=coalesce(nullif(v_product->>'stock','')::numeric,0); v_new_stock:=v_stock+v_move_qty;
        if v_new_stock<0 then raise exception 'insufficient stock for %',coalesce(v_product->>'name',v_product_id); end if;
        update public.sync_entities set payload=jsonb_set(v_product,'{stock}',to_jsonb(v_new_stock),true),updated_at=now() where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;
        v_move_payload=jsonb_build_object('id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'productId',v_product_id,'type','sale','quantity',v_move_qty,'previousStock',v_stock,'newStock',v_new_stock,'reference',v_sale_id,'clientOperationId',coalesce(nullif(v_move->>'clientOperationId',''),v_movement_id),'createdAt',v_created_at);
        v_move_payload:=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_move_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(v_tenant,v_branch,'stockMovements',v_movement_id,v_move_payload,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end loop;

      v_total:=round(v_total,2);
      v_sale_payload:=jsonb_build_object('id',v_sale_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'total',v_total,'payment',v_payment,'items',v_canonical_items,'clientOperationId',coalesce(nullif(v_sale->>'clientOperationId',''),v_sale_id),'createdAt',v_created_at);
      if v_customer_id is not null then v_sale_payload:=v_sale_payload||jsonb_build_object('customerId',v_customer_id); end if;
      if nullif(v_sale->>'orderId','') is not null then v_sale_payload:=v_sale_payload||jsonb_build_object('orderId',v_sale->>'orderId'); end if;
      v_sale_payload:=public.normalize_sync_payload(v_tenant,v_branch,'sales',v_sale_id,v_sale_payload);
      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(v_tenant,v_branch,'sales',v_sale_id,v_sale_payload,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

      if v_payment='credit' then
        if jsonb_typeof(v_credit)<>'object' then raise exception 'credit payload missing'; end if;
        v_credit_id:=nullif(v_credit->>'id',''); if v_credit_id is null or length(v_credit_id)>200 then raise exception 'invalid credit id'; end if;
        v_credit_payload:=jsonb_build_object('id',v_credit_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'customerId',v_customer_id,'saleId',v_sale_id,'description',coalesce(nullif(v_credit->>'description',''),'Venta '||right(v_sale_id,8)),'originalAmount',v_total,'balance',v_total,'status','open','createdAt',v_created_at);
        v_credit_payload:=public.normalize_sync_payload(v_tenant,v_branch,'credits',v_credit_id,v_credit_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(v_tenant,v_branch,'credits',v_credit_id,v_credit_payload,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end if;
      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'saleTransaction',v_sale_id);
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'saleId',v_sale_id,'total',v_total));
    exception when others then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm)); end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_sale_transactions_v2(jsonb) from public;
revoke all on function public.apply_sale_transactions_v2(jsonb) from anon;
grant execute on function public.apply_sale_transactions_v2(jsonb) to authenticated;

create or replace function public.apply_sale_reversals_v1(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb; v_results jsonb:='[]'::jsonb; v_tenant uuid; v_branch uuid; v_operation text; v_sale_id text; v_sale jsonb;
  v_payment text; v_total numeric; v_sale_created timestamptz; v_reason text; v_reversed_at text;
  v_original jsonb; v_product_id text; v_product jsonb; v_product_branch uuid; v_restore numeric; v_stock numeric; v_new_stock numeric; v_movement_id text; v_movement jsonb;
  v_cash jsonb; v_cash_id text; v_session_id text; v_session jsonb; v_cash_amount numeric; v_cash_payload jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant:=nullif(op->>'tenantId','')::uuid; v_branch:=nullif(op->>'branchId','')::uuid; v_operation:=nullif(op->>'operationId',''); v_sale_id:=nullif(op->>'entityId','');
      if coalesce(op->>'entityType','')<>'saleReversalTransactions' or coalesce(op->>'action','upsert')<>'upsert' then raise exception 'invalid sale reversal'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_sale_id is null then raise exception 'invalid sale reversal identifiers'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not (public.is_platform_admin() or public.has_tenant_role(v_tenant,array['owner','admin'])) then raise exception 'role denied for sale reversal'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) or not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;
      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true)); continue; end if;
      perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_sale_id||':reversal',0));
      select payload into v_sale from public.sync_entities where tenant_id=v_tenant and branch_id=v_branch and entity_type='sales' and entity_id=v_sale_id and not deleted for update;
      if not found then raise exception 'sale not found'; end if;
      if lower(coalesce(v_sale->>'status','completed'))='voided' then insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'saleReversal',v_sale_id) on conflict do nothing; v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateVoid',true)); continue; end if;
      v_payment:=lower(coalesce(v_sale->>'payment','cash')); if v_payment not in('cash','transfer') then raise exception 'sale cannot be reversed with this payment method'; end if;
      v_total:=coalesce(nullif(v_sale->>'total','')::numeric,0); v_sale_created:=coalesce(nullif(v_sale->>'createdAt','')::timestamptz,now()); if now()-v_sale_created>interval '24 hours' then raise exception 'sale reversal window expired; use return or credit note flow'; end if;
      v_reason:=left(regexp_replace(coalesce(op->'payload'->>'reason',''),'\s+',' ','g'),240); if length(trim(v_reason))<3 then raise exception 'sale reversal reason required'; end if; v_reversed_at:=coalesce(nullif(op->'payload'->>'reversedAt',''),now()::text);

      if v_payment='cash' then
        v_cash:=op->'payload'->'cashMovement'; if jsonb_typeof(v_cash)<>'object' then raise exception 'cash sale reversal requires refund movement'; end if;
        v_cash_id:=nullif(v_cash->>'id',''); v_session_id:=nullif(v_cash->>'sessionId',''); v_cash_amount:=coalesce(nullif(v_cash->>'amount','')::numeric,0); if abs(v_cash_amount-v_total)>.001 then raise exception 'cash refund must equal sale total'; end if;
        select payload into v_session from public.sync_entities where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted for update; if not found or lower(coalesce(v_session->>'status',''))<>'open' then raise exception 'cash session is not open'; end if;
      end if;

      -- Restore exactly the physical inventory movements created by the original sale.
      for v_original in select payload from public.sync_entities where tenant_id=v_tenant and branch_id=v_branch and entity_type='stockMovements' and not deleted and payload->>'reference'=v_sale_id and lower(coalesce(payload->>'type',''))='sale' loop
        v_product_id:=nullif(v_original->>'productId',''); v_restore:=abs(coalesce(nullif(v_original->>'quantity','')::numeric,0)); if v_product_id is null or v_restore<=0 then continue; end if;
        select payload,branch_id into v_product,v_product_branch from public.sync_entities where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted for update; if not found or v_product_branch is distinct from v_branch then raise exception 'reversal inventory item missing'; end if;
        v_stock:=coalesce(nullif(v_product->>'stock','')::numeric,0); v_new_stock:=v_stock+v_restore;
        update public.sync_entities set payload=jsonb_set(v_product,'{stock}',to_jsonb(v_new_stock),true),updated_at=now() where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;
        select nullif(value->>'id','') into v_movement_id from jsonb_array_elements(coalesce(op->'payload'->'stockMovements','[]'::jsonb)) where value->>'productId'=v_product_id limit 1;
        if v_movement_id is null then raise exception 'sale reversal movement id missing for %',v_product_id; end if;
        v_movement:=jsonb_build_object('id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'productId',v_product_id,'type','adjustment_in','quantity',v_restore,'previousStock',v_stock,'newStock',v_new_stock,'reference','VOID:'||v_sale_id,'clientOperationId',v_movement_id,'createdAt',v_reversed_at);
        v_movement:=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end loop;

      v_sale:=v_sale||jsonb_build_object('status','voided','voidedAt',v_reversed_at,'voidReason',trim(v_reason)); v_sale:=public.normalize_sync_payload(v_tenant,v_branch,'sales',v_sale_id,v_sale); update public.sync_entities set payload=v_sale,updated_at=now() where tenant_id=v_tenant and entity_type='sales' and entity_id=v_sale_id;
      if v_payment='cash' then v_cash_payload:=jsonb_build_object('id',v_cash_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'sessionId',v_session_id,'type','out','amount',round(v_total,2),'reason',left('Anulación venta · '||trim(v_reason),240),'clientOperationId',coalesce(nullif(v_cash->>'clientOperationId',''),v_cash_id),'createdAt',v_reversed_at); v_cash_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload); insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at; end if;
      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'saleReversal',v_sale_id);
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'saleId',v_sale_id,'status','voided'));
    exception when others then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm)); end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_sale_reversals_v1(jsonb) from public;
revoke all on function public.apply_sale_reversals_v1(jsonb) from anon;
grant execute on function public.apply_sale_reversals_v1(jsonb) to authenticated;
