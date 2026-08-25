-- KIUBO · YUKI Pilot Cloud Activator V1
-- ONE-RUN SAFE ACTIVATION PACKAGE
-- Run only against the KIUBO Supabase project hysrlckmnzlmscwwbibn.
-- This script intentionally performs a prerequisite check BEFORE any changes.

DO $$
BEGIN
  IF to_regprocedure('public.apply_purchase_transactions_v2(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'PRECHECK: apply_purchase_transactions_v2(jsonb) is missing. Stop; do not continue.';
  END IF;
  IF to_regprocedure('public.apply_finance_transactions_v2(jsonb)') IS NULL
     AND to_regprocedure('public.apply_finance_transactions_v2_legacy(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'PRECHECK: apply_finance_transactions_v2(jsonb) is missing. Stop; do not continue.';
  END IF;
  IF to_regprocedure('public.normalize_sync_payload(uuid,uuid,text,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'PRECHECK: normalize_sync_payload(...) is missing. Stop; do not continue.';
  END IF;
  IF to_regprocedure('public.can_sync_entity(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PRECHECK: can_sync_entity(uuid,text) is missing. Stop; do not continue.';
  END IF;
  IF to_regprocedure('public.tenant_can_operate(uuid)') IS NULL THEN
    RAISE EXCEPTION 'PRECHECK: tenant_can_operate(uuid) is missing. Stop; do not continue.';
  END IF;
END
$$;

-- ============================================================
-- 0017_supplier_cash_outflow_v1.sql
-- ============================================================

create or replace function public.apply_purchase_transactions_v3(p_operations jsonb)
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
  v_payment jsonb;
  v_method text;
  v_cash jsonb;
  v_cash_id text;
  v_session_id text;
  v_session jsonb;
  v_amount numeric;
  v_created_at text;
  v_reason text;
  v_cash_payload jsonb;
  v_base jsonb;
  v_base_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 purchase transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_type:=coalesce(op->>'entityType','');
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=coalesce(op->>'operationId','');
      if v_type='purchaseTransactions' then
        v_payment:=op->'payload'->'initialPayment';
        v_cash:=op->'payload'->'initialCashMovement';
      elsif v_type='supplierPaymentTransactions' then
        v_payment:=op->'payload'->'payment';
        v_cash:=op->'payload'->'cashMovement';
      else
        raise exception 'invalid purchase transaction entity';
      end if;

      v_method:=case when jsonb_typeof(v_payment)='object' then lower(coalesce(v_payment->>'method','transfer')) else null end;
      if v_method='cash' then
        if v_tenant is null or v_branch is null then raise exception 'invalid purchase cash scope'; end if;
        if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for supplier cash payment'; end if;
        if jsonb_typeof(v_cash)<>'object' then raise exception 'cash supplier payment requires register movement'; end if;
        v_cash_id:=nullif(v_cash->>'id','');
        v_session_id:=nullif(v_cash->>'sessionId','');
        if v_cash_id is null or v_session_id is null or length(v_cash_id)>200 or length(v_session_id)>200 then raise exception 'invalid supplier cash movement identifiers'; end if;
        if nullif(v_cash->>'tenantId','') is not null and v_cash->>'tenantId'<>v_tenant::text then raise exception 'supplier cash tenant mismatch'; end if;
        if nullif(v_cash->>'branchId','') is not null and v_cash->>'branchId'<>v_branch::text then raise exception 'supplier cash branch mismatch'; end if;
        if lower(coalesce(v_cash->>'type','out'))<>'out' then raise exception 'supplier cash movement must be an outflow'; end if;
        v_amount:=coalesce(nullif(v_payment->>'amount','')::numeric,0);
        if v_amount<=0 then raise exception 'supplier cash payment must be positive'; end if;

        select payload into v_session
        from public.sync_entities
        where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted
        for update;
        if not found or lower(coalesce(v_session->>'status',''))<>'open' then raise exception 'cash session is not open'; end if;
      elsif jsonb_typeof(v_cash)='object' then
        raise exception 'cash movement provided for non-cash supplier payment';
      end if;

      v_base:=public.apply_purchase_transactions_v2(jsonb_build_array(op));
      v_base_result:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_base_result is null then raise exception 'purchase engine returned no result'; end if;
      if not coalesce((v_base_result->>'ok')::boolean,false) then
        v_results:=v_results||jsonb_build_array(v_base_result);
        continue;
      end if;

      if v_method='cash' then
        v_created_at:=coalesce(nullif(v_cash->>'createdAt',''),nullif(v_payment->>'createdAt',''),now()::text);
        v_reason:=left(coalesce(nullif(trim(v_cash->>'reason'),''),case when v_type='purchaseTransactions' then 'Pago inicial a proveedor' else 'Abono a proveedor' end),240);
        v_cash_payload:=jsonb_build_object(
          'id',v_cash_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'sessionId',v_session_id,
          'type','out','amount',round(v_amount,2),'reason',v_reason,
          'clientOperationId',coalesce(nullif(v_cash->>'clientOperationId',''),v_cash_id),'createdAt',v_created_at
        );
        v_cash_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update
          set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end if;

      v_results:=v_results||jsonb_build_array(v_base_result);
    exception when others then
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_purchase_transactions_v3(jsonb) from public;
revoke all on function public.apply_purchase_transactions_v3(jsonb) from anon;
grant execute on function public.apply_purchase_transactions_v3(jsonb) to authenticated;

-- ============================================================
-- 0018_sale_reversal_v1.sql
-- ============================================================

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
  v_sale_created timestamptz;
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
      if not (public.is_platform_admin() or public.has_tenant_role(v_tenant,array['owner','admin'])) then raise exception 'role denied for sale reversal'; end if;
      if not public.can_sync_entity(v_tenant,'sales') or not public.can_sync_entity(v_tenant,'stockMovements') then raise exception 'role denied for sale reversal entities'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_sale_id||':reversal',0));
      select payload into v_sale from public.sync_entities
      where tenant_id=v_tenant and branch_id=v_branch and entity_type='sales' and entity_id=v_sale_id and not deleted for update;
      if not found then raise exception 'sale not found'; end if;
      if lower(coalesce(v_sale->>'status','completed'))='voided' then
        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'saleReversal',v_sale_id) on conflict do nothing;
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateVoid',true));
        continue;
      end if;

      v_payment:=lower(coalesce(v_sale->>'payment','cash'));
      if v_payment not in('cash','transfer') then raise exception 'sale cannot be reversed with this payment method'; end if;
      v_total:=coalesce(nullif(v_sale->>'total','')::numeric,0);
      if v_total<0 then raise exception 'invalid sale total'; end if;
      v_sale_created:=coalesce(nullif(v_sale->>'createdAt','')::timestamptz,now());
      if v_sale_created>now()+interval '5 minutes' or now()-v_sale_created>interval '24 hours' then raise exception 'sale reversal window expired; use return or credit note flow'; end if;
      v_items:=v_sale->'items';
      if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception 'sale reversal has no items'; end if;
      if jsonb_typeof(op->'payload'->'stockMovements')<>'array' or jsonb_array_length(op->'payload'->'stockMovements')<>jsonb_array_length(v_items) then raise exception 'sale reversal stock movement count mismatch'; end if;
      if exists(select 1 from (select movement->>'productId' product_id,count(*) from jsonb_array_elements(op->'payload'->'stockMovements') movement group by movement->>'productId' having count(*)>1) duplicated) then raise exception 'duplicate sale reversal product'; end if;
      if exists(select 1 from (select movement->>'id' movement_id,count(*) from jsonb_array_elements(op->'payload'->'stockMovements') movement group by movement->>'id' having count(*)>1) duplicated_ids) then raise exception 'duplicate sale reversal movement id'; end if;

      v_reason:=left(regexp_replace(coalesce(op->'payload'->>'reason',''),'\s+',' ','g'),240);
      if length(trim(v_reason))<3 then raise exception 'sale reversal reason required'; end if;
      v_reversed_at:=coalesce(nullif(op->'payload'->>'reversedAt',''),now()::text);

      if v_payment='cash' then
        if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for cash refund'; end if;
        v_cash:=op->'payload'->'cashMovement';
        if jsonb_typeof(v_cash)<>'object' then raise exception 'cash sale reversal requires refund movement'; end if;
        v_cash_id:=nullif(v_cash->>'id',''); v_session_id:=nullif(v_cash->>'sessionId','');
        if v_cash_id is null or v_session_id is null or length(v_cash_id)>200 or length(v_session_id)>200 then raise exception 'invalid cash refund identifiers'; end if;
        if lower(coalesce(v_cash->>'type','out'))<>'out' then raise exception 'cash refund must be an outflow'; end if;
        v_cash_amount:=coalesce(nullif(v_cash->>'amount','')::numeric,0);
        if abs(v_cash_amount-v_total)>0.001 then raise exception 'cash refund must equal sale total'; end if;
        select payload into v_session from public.sync_entities
        where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted for update;
        if not found or lower(coalesce(v_session->>'status',''))<>'open' then raise exception 'cash session is not open'; end if;
      elsif jsonb_typeof(op->'payload'->'cashMovement')='object' then raise exception 'transfer reversal cannot create cash refund'; end if;

      for v_item in select value from jsonb_array_elements(v_items) loop
        v_product_id:=nullif(v_item->>'productId',''); v_qty:=coalesce(nullif(v_item->>'qty','')::numeric,0);
        if v_product_id is null or length(v_product_id)>200 then raise exception 'invalid reversal product id'; end if;
        if v_qty<=0 or v_qty<>trunc(v_qty) then raise exception 'invalid reversal quantity'; end if;
        select payload,branch_id into v_product,v_product_branch from public.sync_entities
        where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id and not deleted for update;
        if not found then raise exception 'product not found for sale reversal: %',v_product_id; end if;
        if v_product_branch is distinct from v_branch then raise exception 'reversal product belongs to another branch'; end if;
        v_stock:=coalesce(nullif(v_product->>'stock','')::numeric,0); v_new_stock:=v_stock+v_qty;
        update public.sync_entities set payload=jsonb_set(v_product,'{stock}',to_jsonb(v_new_stock),true)
        where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_product_id;
        select nullif(movement->>'id','') into v_movement_id from jsonb_array_elements(op->'payload'->'stockMovements') movement where movement->>'productId'=v_product_id limit 1;
        if v_movement_id is null or length(v_movement_id)>200 then raise exception 'sale reversal movement id missing'; end if;
        v_movement=jsonb_build_object('id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'productId',v_product_id,'type','adjustment_in','quantity',v_qty,'previousStock',v_stock,'newStock',v_new_stock,'reference','VOID:'||v_sale_id,'clientOperationId',v_movement_id,'createdAt',v_reversed_at);
        v_movement:=public.normalize_sync_payload(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'stockMovements',v_movement_id,v_movement,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end loop;

      v_sale:=v_sale||jsonb_build_object('status','voided','voidedAt',v_reversed_at,'voidReason',trim(v_reason));
      v_sale:=public.normalize_sync_payload(v_tenant,v_branch,'sales',v_sale_id,v_sale);
      update public.sync_entities set payload=v_sale,updated_at=now() where tenant_id=v_tenant and entity_type='sales' and entity_id=v_sale_id;

      if v_payment='cash' then
        v_cash_payload:=jsonb_build_object('id',v_cash_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'sessionId',v_session_id,'type','out','amount',round(v_total,2),'reason',left('Anulación venta · '||trim(v_reason),240),'clientOperationId',coalesce(nullif(v_cash->>'clientOperationId',''),v_cash_id),'createdAt',v_reversed_at);
        v_cash_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'cashMovements',v_cash_id,v_cash_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
      end if;

      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'saleReversal',v_sale_id);
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

-- ============================================================
-- 0019_payment_idempotency_v1.sql
-- ============================================================

do $$
begin
  if to_regprocedure('public.apply_finance_transactions_v2_legacy(jsonb)') is null then
    if to_regprocedure('public.apply_finance_transactions_v2(jsonb)') is null then raise exception 'apply_finance_transactions_v2 must exist before payment idempotency hardening'; end if;
    execute 'alter function public.apply_finance_transactions_v2(jsonb) rename to apply_finance_transactions_v2_legacy';
  end if;
  if to_regprocedure('public.apply_purchase_transactions_v3_legacy(jsonb)') is null then
    if to_regprocedure('public.apply_purchase_transactions_v3(jsonb)') is null then raise exception 'apply_purchase_transactions_v3 must exist before payment idempotency hardening'; end if;
    execute 'alter function public.apply_purchase_transactions_v3(jsonb) rename to apply_purchase_transactions_v3_legacy';
  end if;
end
$$;
revoke all on function public.apply_finance_transactions_v2_legacy(jsonb) from public;
revoke all on function public.apply_finance_transactions_v2_legacy(jsonb) from anon;
revoke all on function public.apply_finance_transactions_v2_legacy(jsonb) from authenticated;
revoke all on function public.apply_purchase_transactions_v3_legacy(jsonb) from public;
revoke all on function public.apply_purchase_transactions_v3_legacy(jsonb) from anon;
revoke all on function public.apply_purchase_transactions_v3_legacy(jsonb) from authenticated;

create or replace function public.apply_finance_transactions_v2(p_operations jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  op jsonb; v_results jsonb:='[]'::jsonb; v_base jsonb; v_row jsonb; v_type text; v_tenant uuid; v_branch uuid; v_operation text; v_entity_id text; v_payload jsonb; v_payment jsonb; v_existing jsonb; v_existing_branch uuid; v_existing_deleted boolean; v_kind text; v_session jsonb; v_movement jsonb; v_target_id text; v_credit_id text; v_method text; v_amount numeric; v_existing_amount numeric; v_client_id text; v_existing_client_id text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 finance transactions per batch'; end if;
  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      if jsonb_typeof(op)<>'object' then raise exception 'finance transaction must be an object'; end if;
      v_type:=coalesce(op->>'entityType',''); v_tenant:=nullif(op->>'tenantId','')::uuid; v_branch:=nullif(op->>'branchId','')::uuid; v_operation:=nullif(op->>'operationId',''); v_entity_id:=nullif(op->>'entityId',''); v_payload:=op->'payload';
      if v_type not in('cashTransactions','creditPaymentTransactions') then raise exception 'invalid finance transaction entity'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then raise exception 'invalid finance transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_entity_id)>220 then raise exception 'finance transaction identifier too long'; end if;
      if not public.branch_can_operate(v_tenant,v_branch) then raise exception 'branch denied'; end if;
      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true)); continue; end if;
      if v_type='creditPaymentTransactions' then
        if not public.can_sync_entity(v_tenant,'creditPayments') then raise exception 'role denied for credit payments'; end if;
        v_payment:=v_payload->'payment'; if jsonb_typeof(v_payment)<>'object' then raise exception 'credit payment payload missing'; end if;
        v_target_id:=nullif(v_payment->>'id',''); v_credit_id:=nullif(v_payment->>'creditId','');
        if v_target_id is null or v_target_id<>v_entity_id or v_credit_id is null then raise exception 'invalid credit payment identifiers'; end if;
        v_amount:=round(coalesce(nullif(v_payment->>'amount','')::numeric,0),2); v_method:=lower(coalesce(v_payment->>'method','cash')); v_client_id:=coalesce(nullif(v_payment->>'clientOperationId',''),v_target_id);
        if v_amount<=0 or v_method not in('cash','transfer') then raise exception 'invalid credit payment'; end if;
        select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted from public.sync_entities where tenant_id=v_tenant and entity_type='creditPayments' and entity_id=v_target_id;
        if found then
          if v_existing_deleted then raise exception 'credit payment id was already used'; end if;
          v_existing_amount:=round(coalesce(nullif(v_existing->>'amount','')::numeric,0),2); v_existing_client_id:=coalesce(nullif(v_existing->>'clientOperationId',''),v_target_id);
          if v_existing_branch is distinct from v_branch or coalesce(v_existing->>'creditId','')<>v_credit_id or v_existing_amount<>v_amount or lower(coalesce(v_existing->>'method','cash'))<>v_method or v_existing_client_id<>v_client_id then raise exception 'credit payment id reused with different payload'; end if;
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'creditPaymentTransaction',v_target_id) on conflict do nothing;
          v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicatePayment',true)); continue;
        end if;
      else
        v_kind:=lower(coalesce(v_payload->>'kind','')); if v_kind not in('open','movement','close') then raise exception 'invalid cash transaction kind'; end if;
        if v_kind in('open','close') then
          if not public.can_sync_entity(v_tenant,'cashSessions') then raise exception 'role denied for cash'; end if;
          v_session:=v_payload->'session'; if jsonb_typeof(v_session)<>'object' then raise exception 'cash session payload missing'; end if;
          v_target_id:=nullif(v_session->>'id',''); if v_target_id is null then raise exception 'invalid cash session id'; end if;
          select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted from public.sync_entities where tenant_id=v_tenant and entity_type='cashSessions' and entity_id=v_target_id;
          if found and not v_existing_deleted then
            if v_existing_branch is distinct from v_branch then raise exception 'cash session branch mismatch'; end if;
            if v_kind='open' then
              if lower(coalesce(v_existing->>'status',''))='open' and round(coalesce(nullif(v_existing->>'openingAmount','')::numeric,0),2)=round(coalesce(nullif(v_session->>'openingAmount','')::numeric,0),2) then
                insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'cashTransaction',v_target_id) on conflict do nothing; v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateOpen',true)); continue;
              elsif lower(coalesce(v_existing->>'status',''))<>'open' then raise exception 'cash session id reused after close'; else raise exception 'cash session id reused with different opening amount'; end if;
            else
              if lower(coalesce(v_existing->>'status',''))='closed' then
                if round(coalesce(nullif(v_existing->>'closingAmount','')::numeric,0),2)<>round(coalesce(nullif(v_session->>'closingAmount','')::numeric,0),2) then raise exception 'cash close retried with different counted amount'; end if;
                insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'cashTransaction',v_target_id) on conflict do nothing; v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateClose',true)); continue;
              end if;
            end if;
          end if;
        else
          if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for cash movements'; end if;
          v_movement:=v_payload->'movement'; if jsonb_typeof(v_movement)<>'object' then raise exception 'cash movement payload missing'; end if;
          v_target_id:=nullif(v_movement->>'id',''); if v_target_id is null then raise exception 'invalid cash movement id'; end if;
          select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted from public.sync_entities where tenant_id=v_tenant and entity_type='cashMovements' and entity_id=v_target_id;
          if found then
            if v_existing_deleted then raise exception 'cash movement id was already used'; end if;
            if v_existing_branch is distinct from v_branch or coalesce(v_existing->>'sessionId','')<>coalesce(v_movement->>'sessionId','') or lower(coalesce(v_existing->>'type',''))<>lower(coalesce(v_movement->>'type','')) or round(coalesce(nullif(v_existing->>'amount','')::numeric,0),2)<>round(coalesce(nullif(v_movement->>'amount','')::numeric,0),2) then raise exception 'cash movement id reused with different payload'; end if;
            insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'cashTransaction',v_target_id) on conflict do nothing; v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateMovement',true)); continue;
          end if;
        end if;
      end if;
      v_base:=public.apply_finance_transactions_v2_legacy(jsonb_build_array(op)); v_row:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_row is null then raise exception 'finance engine returned no result'; end if;
      v_results:=v_results||jsonb_build_array(v_row);
    exception when others then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm)); end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_finance_transactions_v2(jsonb) from public;
revoke all on function public.apply_finance_transactions_v2(jsonb) from anon;
grant execute on function public.apply_finance_transactions_v2(jsonb) to authenticated;

create or replace function public.apply_purchase_transactions_v3(p_operations jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  op jsonb; v_results jsonb:='[]'::jsonb; v_base jsonb; v_row jsonb; v_type text; v_tenant uuid; v_branch uuid; v_operation text; v_entity_id text; v_payload jsonb; v_payment jsonb; v_purchase jsonb; v_existing jsonb; v_existing_branch uuid; v_existing_deleted boolean; v_supplier_id text; v_purchase_id text; v_method text; v_amount numeric; v_existing_amount numeric; v_client_id text; v_existing_client_id text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 purchase transactions per batch'; end if;
  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      if jsonb_typeof(op)<>'object' then raise exception 'purchase transaction must be an object'; end if;
      v_type:=coalesce(op->>'entityType',''); v_tenant:=nullif(op->>'tenantId','')::uuid; v_branch:=nullif(op->>'branchId','')::uuid; v_operation:=nullif(op->>'operationId',''); v_entity_id:=nullif(op->>'entityId',''); v_payload:=op->'payload';
      if v_type not in('purchaseTransactions','supplierPaymentTransactions') then raise exception 'invalid purchase transaction entity'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then raise exception 'invalid purchase transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_entity_id)>220 then raise exception 'purchase transaction identifier too long'; end if;
      if not public.branch_can_operate(v_tenant,v_branch) then raise exception 'branch denied'; end if;
      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true)); continue; end if;
      if v_type='purchaseTransactions' then
        if not public.can_sync_entity(v_tenant,'purchases') then raise exception 'role denied for purchases'; end if;
        v_purchase:=v_payload->'purchase'; if jsonb_typeof(v_purchase)<>'object' then raise exception 'purchase payload must be an object'; end if;
        v_supplier_id:=nullif(v_purchase->>'supplierId',''); v_client_id:=coalesce(nullif(v_purchase->>'clientOperationId',''),v_entity_id);
        select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted from public.sync_entities where tenant_id=v_tenant and entity_type='purchases' and entity_id=v_entity_id;
        if found then
          if v_existing_deleted then raise exception 'purchase id was already used'; end if;
          v_existing_client_id:=coalesce(nullif(v_existing->>'clientOperationId',''),v_entity_id);
          if v_existing_branch is distinct from v_branch or coalesce(v_existing->>'supplierId','')<>coalesce(v_supplier_id,'') or v_existing_client_id<>v_client_id then raise exception 'purchase transaction id reused with different payload'; end if;
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'purchaseTransaction',v_entity_id) on conflict do nothing; v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicatePurchase',true)); continue;
        end if;
      else
        if not public.can_sync_entity(v_tenant,'supplierPayments') then raise exception 'role denied for supplier payments'; end if;
        v_payment:=v_payload->'payment'; if jsonb_typeof(v_payment)<>'object' then raise exception 'supplier payment payload must be an object'; end if;
        v_purchase_id:=nullif(v_payment->>'purchaseId',''); v_supplier_id:=nullif(v_payment->>'supplierId',''); v_amount:=round(coalesce(nullif(v_payment->>'amount','')::numeric,0),2); v_method:=lower(coalesce(v_payment->>'method','transfer')); v_client_id:=coalesce(nullif(v_payment->>'clientOperationId',''),v_entity_id);
        if v_purchase_id is null or v_supplier_id is null or v_amount<=0 then raise exception 'invalid supplier payment'; end if;
        select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted from public.sync_entities where tenant_id=v_tenant and entity_type='supplierPayments' and entity_id=v_entity_id;
        if found then
          if v_existing_deleted then raise exception 'supplier payment id was already used'; end if;
          v_existing_amount:=round(coalesce(nullif(v_existing->>'amount','')::numeric,0),2); v_existing_client_id:=coalesce(nullif(v_existing->>'clientOperationId',''),v_entity_id);
          if v_existing_branch is distinct from v_branch or coalesce(v_existing->>'purchaseId','')<>v_purchase_id or coalesce(v_existing->>'supplierId','')<>v_supplier_id or v_existing_amount<>v_amount or lower(coalesce(v_existing->>'method','transfer'))<>v_method or v_existing_client_id<>v_client_id then raise exception 'supplier payment id reused with different payload'; end if;
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,'supplierPaymentTransaction',v_entity_id) on conflict do nothing; v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateSupplierPayment',true)); continue;
        end if;
      end if;
      v_base:=public.apply_purchase_transactions_v3_legacy(jsonb_build_array(op)); v_row:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_row is null then raise exception 'purchase engine returned no result'; end if;
      v_results:=v_results||jsonb_build_array(v_row);
    exception when others then v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm)); end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_purchase_transactions_v3(jsonb) from public;
revoke all on function public.apply_purchase_transactions_v3(jsonb) from anon;
grant execute on function public.apply_purchase_transactions_v3(jsonb) to authenticated;

-- ============================================================
-- 0020_food_service_platform_v1.sql
-- ============================================================

create or replace function public.can_sync_entity(target_tenant uuid,target_type text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or case
    when target_type in('settings','branding') then public.has_tenant_role(target_tenant,array['owner','admin'])
    when target_type in('tenantProducts','suppliers','purchases','supplierPayments') then public.has_tenant_role(target_tenant,array['owner','admin','inventory'])
    when target_type in('customers','sales','cashSessions','cashMovements','credits','creditPayments','orders') then public.has_tenant_role(target_tenant,array['owner','admin','cashier'])
    when target_type='stockMovements' then public.has_tenant_role(target_tenant,array['owner','admin','inventory','cashier'])
    else false end
$$;
revoke all on function public.can_sync_entity(uuid,text) from public;
revoke all on function public.can_sync_entity(uuid,text) from anon;
grant execute on function public.can_sync_entity(uuid,text) to authenticated;

create or replace function public.normalize_sync_payload(p_tenant uuid,p_branch uuid,p_type text,p_id text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_payload jsonb:=coalesce(p_payload,'{}'::jsonb); v_payload_tenant text; v_payload_branch text; v_payload_id text;
begin
  if jsonb_typeof(v_payload)<>'object' then raise exception 'sync payload must be an object'; end if;
  if pg_column_size(v_payload)>262144 then raise exception 'sync payload too large'; end if;
  if p_type in('tenantProducts','sales','cashSessions','cashMovements','credits','creditPayments','purchases','supplierPayments','stockMovements','orders') and p_branch is null then raise exception 'branch is required for entity'; end if;
  v_payload_tenant=nullif(v_payload->>'tenantId',''); if v_payload_tenant is not null and v_payload_tenant<>p_tenant::text then raise exception 'payload tenant mismatch'; end if;
  v_payload=jsonb_set(v_payload,'{tenantId}',to_jsonb(p_tenant::text),true);
  if p_branch is not null then
    if not public.branch_belongs_to_tenant(p_tenant,p_branch) then raise exception 'branch does not belong to tenant'; end if;
    v_payload_branch=nullif(v_payload->>'branchId',''); if v_payload_branch is not null and v_payload_branch<>p_branch::text then raise exception 'payload branch mismatch'; end if;
    v_payload=jsonb_set(v_payload,'{branchId}',to_jsonb(p_branch::text),true);
  else v_payload=v_payload-'branchId'; end if;
  if p_type in('settings','branding') then v_payload=v_payload-'id'; else
    v_payload_id=nullif(v_payload->>'id',''); if v_payload_id is not null and v_payload_id<>p_id then raise exception 'payload id mismatch'; end if;
    v_payload=jsonb_set(v_payload,'{id}',to_jsonb(p_id),true);
  end if;
  v_payload=v_payload-'pin'-'password'-'service_role'-'serviceRole'-'platformAdmin'-'platform_admin'; return v_payload;
end
$$;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from public;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from anon;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from authenticated;

create or replace function public.apply_sync_operations(p_operations jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare op jsonb; v_tenant uuid; v_branch uuid; v_operation text; v_type text; v_id text; v_action text; v_payload jsonb; v_results jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>100 then raise exception 'maximum 100 operations per batch'; end if;
  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant=(op->>'tenantId')::uuid; v_branch=nullif(op->>'branchId','')::uuid; v_operation=op->>'operationId'; v_type=op->>'entityType'; v_id=op->>'entityId'; v_action=coalesce(op->>'action','upsert');
      if v_operation is null or v_type is null or v_id is null then raise exception 'invalid sync operation'; end if;
      if length(v_operation)>160 or length(v_type)>64 or length(v_id)>200 then raise exception 'sync identifier too long'; end if;
      if v_action not in('upsert','delete') then raise exception 'invalid sync action'; end if;
      if v_type not in('tenantProducts','customers','sales','cashSessions','cashMovements','credits','creditPayments','settings','branding','suppliers','purchases','supplierPayments','stockMovements','orders') then raise exception 'unsupported entity type'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,v_type) then raise exception 'role denied for entity'; end if;
      if v_branch is not null and not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if v_branch is not null and not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;
      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true)); continue; end if;
      v_payload=case when v_action='delete' then '{}'::jsonb else public.normalize_sync_payload(v_tenant,v_branch,v_type,v_id,op->'payload') end;
      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
      values(v_tenant,v_branch,v_type,v_id,v_payload,v_action='delete',now())
      on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=excluded.deleted,updated_at=excluded.updated_at;
      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,v_type,v_id);
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true));
    exception when others then v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm)); end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_sync_operations(jsonb) from public;
revoke all on function public.apply_sync_operations(jsonb) from anon;
grant execute on function public.apply_sync_operations(jsonb) to authenticated;

create index if not exists sync_entities_food_orders_idx on public.sync_entities(tenant_id,branch_id,updated_at desc) where entity_type='orders' and not deleted;

create or replace function public.configure_business_profile_v1(
  p_tenant uuid,p_trade_name text,p_address text default '',p_phone text default '',p_business_type text default 'general',
  p_service_modes text[] default array['counter']::text[],p_table_count integer default 0,p_logo_url text default '',
  p_primary_color text default '#0b5a42',p_secondary_color text default '#17352c',p_accent_color text default '#f28b30',
  p_receipt_footer text default 'Gracias por tu compra')
returns boolean language plpgsql security definer set search_path=public as $$
declare v_trade_name text:=trim(coalesce(p_trade_name,'')); v_address text:=trim(coalesce(p_address,'')); v_phone text:=trim(coalesce(p_phone,'')); v_type text:=lower(trim(coalesce(p_business_type,'general'))); v_modes text[]:=coalesce(p_service_modes,array['counter']::text[]); v_settings jsonb; v_branding jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (public.is_platform_admin() or (public.has_tenant_access(p_tenant) and public.has_tenant_role(p_tenant,array['owner','admin']))) then raise exception 'business configuration denied'; end if;
  if v_trade_name='' or length(v_trade_name)>120 then raise exception 'invalid trade name'; end if;
  if length(v_address)>240 then raise exception 'address too long'; end if;
  if length(v_phone)>40 then raise exception 'phone too long'; end if;
  if v_type not in('general','retail','food_service','services') then raise exception 'invalid business type'; end if;
  if p_table_count<0 or p_table_count>500 then raise exception 'invalid table count'; end if;
  if exists(select 1 from unnest(v_modes) mode where mode not in('counter','table','takeaway','delivery')) then raise exception 'invalid service mode'; end if;
  insert into public.tenant_settings(tenant_id,trade_name,currency,require_cash_session,allow_credit,settings)
  values(p_tenant,v_trade_name,'USD',true,true,jsonb_build_object('address',v_address,'phone',v_phone,'businessType',v_type,'serviceModes',to_jsonb(v_modes),'tableCount',p_table_count,'showProductImages',true,'splashEnabled',true,'receiptWidth','80mm'))
  on conflict(tenant_id) do update set trade_name=excluded.trade_name,require_cash_session=excluded.require_cash_session,allow_credit=excluded.allow_credit,settings=coalesce(public.tenant_settings.settings,'{}'::jsonb)||excluded.settings,updated_at=now();
  insert into public.tenant_branding(tenant_id,business_name,logo_url,primary_color,secondary_color,accent_color,receipt_tagline,updated_at)
  values(p_tenant,v_trade_name,nullif(trim(coalesce(p_logo_url,'')),''),p_primary_color,p_secondary_color,p_accent_color,p_receipt_footer,now())
  on conflict(tenant_id) do update set business_name=excluded.business_name,logo_url=coalesce(excluded.logo_url,public.tenant_branding.logo_url),primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,receipt_tagline=excluded.receipt_tagline,updated_at=now();
  v_settings=jsonb_build_object('tenantId',p_tenant::text,'tradeName',v_trade_name,'legalName','', 'ruc','','establishment','001','emissionPoint','001','currency','USD','accent',p_primary_color,'receiptFooter',p_receipt_footer,'requireCashSession',true,'allowCredit',true,'address',v_address,'phone',v_phone,'businessType',v_type,'serviceModes',to_jsonb(v_modes),'tableCount',p_table_count,'showProductImages',true,'splashEnabled',true,'receiptWidth','80mm');
  v_branding=jsonb_build_object('tenantId',p_tenant::text,'businessName',v_trade_name,'logoUrl',coalesce(p_logo_url,''),'primaryColor',p_primary_color,'secondaryColor',p_secondary_color,'accentColor',p_accent_color,'receiptTagline',p_receipt_footer,'updatedAt',now()::text);
  insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(p_tenant,null,'settings',p_tenant::text,v_settings,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set payload=excluded.payload,deleted=false,updated_at=now();
  insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at) values(p_tenant,null,'branding',p_tenant::text,v_branding,false,now()) on conflict(tenant_id,entity_type,entity_id) do update set payload=excluded.payload,deleted=false,updated_at=now();
  return true;
end
$$;
revoke all on function public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text) from public;
revoke all on function public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text) from anon;
grant execute on function public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sync_entities') then alter publication supabase_realtime add table public.sync_entities; end if;
end
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kiubo-media','kiubo-media',true,6291456,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists kiubo_media_read on storage.objects;
drop policy if exists kiubo_media_insert on storage.objects;
drop policy if exists kiubo_media_update on storage.objects;
drop policy if exists kiubo_media_delete on storage.objects;
create policy kiubo_media_read on storage.objects for select to public using(bucket_id='kiubo-media');
create policy kiubo_media_insert on storage.objects for insert to authenticated with check(bucket_id='kiubo-media' and (public.is_platform_admin() or exists(select 1 from public.tenant_members tm where tm.user_id=auth.uid() and tm.active and tm.tenant_id::text=split_part(name,'/',1) and tm.role in('owner','admin','inventory'))));
create policy kiubo_media_update on storage.objects for update to authenticated using(bucket_id='kiubo-media' and (public.is_platform_admin() or exists(select 1 from public.tenant_members tm where tm.user_id=auth.uid() and tm.active and tm.tenant_id::text=split_part(name,'/',1) and tm.role in('owner','admin','inventory')))) with check(bucket_id='kiubo-media' and (public.is_platform_admin() or exists(select 1 from public.tenant_members tm where tm.user_id=auth.uid() and tm.active and tm.tenant_id::text=split_part(name,'/',1) and tm.role in('owner','admin','inventory'))));
create policy kiubo_media_delete on storage.objects for delete to authenticated using(bucket_id='kiubo-media' and (public.is_platform_admin() or exists(select 1 from public.tenant_members tm where tm.user_id=auth.uid() and tm.active and tm.tenant_id::text=split_part(name,'/',1) and tm.role in('owner','admin','inventory'))));

-- ============================================================
-- FINAL SELF-CHECK. A healthy activation returns all TRUE + 0 null revisions.
-- ============================================================
select
  to_regprocedure('public.apply_purchase_transactions_v3(jsonb)') is not null as purchase_v3,
  to_regprocedure('public.apply_sale_reversals_v1(jsonb)') is not null as sale_reversal_v1,
  to_regprocedure('public.apply_finance_transactions_v2(jsonb)') is not null as finance_v2,
  to_regprocedure('public.apply_finance_transactions_v2_legacy(jsonb)') is not null as finance_legacy_guarded,
  to_regprocedure('public.apply_purchase_transactions_v3_legacy(jsonb)') is not null as purchase_legacy_guarded,
  to_regprocedure('public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text)') is not null as food_profile_v1,
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='sync_entities') as realtime_sync_entities,
  exists(select 1 from storage.buckets where id='kiubo-media' and public) as media_bucket_ready,
  exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='kiubo_media_insert') as media_insert_policy,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='sync_entities' and column_name='revision') as revision_column,
  exists(select 1 from pg_constraint where conname='sync_tenant_products_stock_nonnegative' and conrelid='public.sync_entities'::regclass) as stock_floor,
  (select count(*) from public.sync_entities where revision is null) as null_revisions;
