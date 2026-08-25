-- KIUBO Cloud v2 · payment idempotency hardening.
-- Prevents the same economic payment from being applied twice when a client retries with a new operation id.
-- Wraps the existing finance/purchase engines while preserving their public RPC names.

do $$
begin
  if to_regprocedure('public.apply_finance_transactions_v2_legacy(jsonb)') is null then
    if to_regprocedure('public.apply_finance_transactions_v2(jsonb)') is null then
      raise exception 'apply_finance_transactions_v2 must exist before payment idempotency hardening';
    end if;
    execute 'alter function public.apply_finance_transactions_v2(jsonb) rename to apply_finance_transactions_v2_legacy';
  end if;

  if to_regprocedure('public.apply_purchase_transactions_v3_legacy(jsonb)') is null then
    if to_regprocedure('public.apply_purchase_transactions_v3(jsonb)') is null then
      raise exception 'apply_purchase_transactions_v3 must exist before payment idempotency hardening';
    end if;
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
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb;
  v_results jsonb:='[]'::jsonb;
  v_base jsonb;
  v_row jsonb;
  v_type text;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_entity_id text;
  v_payload jsonb;
  v_payment jsonb;
  v_existing jsonb;
  v_existing_branch uuid;
  v_existing_deleted boolean;
  v_kind text;
  v_session jsonb;
  v_movement jsonb;
  v_target_id text;
  v_credit_id text;
  v_method text;
  v_amount numeric;
  v_existing_amount numeric;
  v_client_id text;
  v_existing_client_id text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 finance transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      if jsonb_typeof(op)<>'object' then raise exception 'finance transaction must be an object'; end if;
      v_type:=coalesce(op->>'entityType','');
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId','');
      v_entity_id:=nullif(op->>'entityId','');
      v_payload:=op->'payload';
      if v_type not in('cashTransactions','creditPaymentTransactions') then raise exception 'invalid finance transaction entity'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then raise exception 'invalid finance transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_entity_id)>220 then raise exception 'finance transaction identifier too long'; end if;
      if not public.branch_can_operate(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      if v_type='creditPaymentTransactions' then
        if not public.can_sync_entity(v_tenant,'creditPayments') then raise exception 'role denied for credit payments'; end if;
        v_payment:=v_payload->'payment';
        if jsonb_typeof(v_payment)<>'object' then raise exception 'credit payment payload missing'; end if;
        v_target_id:=nullif(v_payment->>'id','');
        v_credit_id:=nullif(v_payment->>'creditId','');
        if v_target_id is null or v_target_id<>v_entity_id or v_credit_id is null then raise exception 'invalid credit payment identifiers'; end if;
        v_amount:=round(coalesce(nullif(v_payment->>'amount','')::numeric,0),2);
        v_method:=lower(coalesce(v_payment->>'method','cash'));
        v_client_id:=coalesce(nullif(v_payment->>'clientOperationId',''),v_target_id);
        if v_amount<=0 or v_method not in('cash','transfer') then raise exception 'invalid credit payment'; end if;

        select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted
        from public.sync_entities
        where tenant_id=v_tenant and entity_type='creditPayments' and entity_id=v_target_id;
        if found then
          if v_existing_deleted then raise exception 'credit payment id was already used'; end if;
          v_existing_amount:=round(coalesce(nullif(v_existing->>'amount','')::numeric,0),2);
          v_existing_client_id:=coalesce(nullif(v_existing->>'clientOperationId',''),v_target_id);
          if v_existing_branch is distinct from v_branch
             or coalesce(v_existing->>'creditId','')<>v_credit_id
             or v_existing_amount<>v_amount
             or lower(coalesce(v_existing->>'method','cash'))<>v_method
             or v_existing_client_id<>v_client_id then
            raise exception 'credit payment id reused with different payload';
          end if;
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
          values(v_tenant,v_operation,'creditPaymentTransaction',v_target_id) on conflict do nothing;
          v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicatePayment',true));
          continue;
        end if;

      else
        v_kind:=lower(coalesce(v_payload->>'kind',''));
        if v_kind not in('open','movement','close') then raise exception 'invalid cash transaction kind'; end if;
        if v_kind in('open','close') then
          if not public.can_sync_entity(v_tenant,'cashSessions') then raise exception 'role denied for cash'; end if;
          v_session:=v_payload->'session';
          if jsonb_typeof(v_session)<>'object' then raise exception 'cash session payload missing'; end if;
          v_target_id:=nullif(v_session->>'id','');
          if v_target_id is null then raise exception 'invalid cash session id'; end if;
          select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted
          from public.sync_entities
          where tenant_id=v_tenant and entity_type='cashSessions' and entity_id=v_target_id;
          if found and not v_existing_deleted then
            if v_existing_branch is distinct from v_branch then raise exception 'cash session branch mismatch'; end if;
            if v_kind='open' then
              if lower(coalesce(v_existing->>'status',''))='open'
                 and round(coalesce(nullif(v_existing->>'openingAmount','')::numeric,0),2)=round(coalesce(nullif(v_session->>'openingAmount','')::numeric,0),2) then
                insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
                values(v_tenant,v_operation,'cashTransaction',v_target_id) on conflict do nothing;
                v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateOpen',true));
                continue;
              elsif lower(coalesce(v_existing->>'status',''))<>'open' then
                raise exception 'cash session id reused after close';
              else
                raise exception 'cash session id reused with different opening amount';
              end if;
            else
              if lower(coalesce(v_existing->>'status',''))='closed' then
                if round(coalesce(nullif(v_existing->>'closingAmount','')::numeric,0),2)<>round(coalesce(nullif(v_session->>'closingAmount','')::numeric,0),2) then
                  raise exception 'cash close retried with different counted amount';
                end if;
                insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
                values(v_tenant,v_operation,'cashTransaction',v_target_id) on conflict do nothing;
                v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateClose',true));
                continue;
              end if;
            end if;
          end if;
        else
          if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for cash movements'; end if;
          v_movement:=v_payload->'movement';
          if jsonb_typeof(v_movement)<>'object' then raise exception 'cash movement payload missing'; end if;
          v_target_id:=nullif(v_movement->>'id','');
          if v_target_id is null then raise exception 'invalid cash movement id'; end if;
          select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted
          from public.sync_entities
          where tenant_id=v_tenant and entity_type='cashMovements' and entity_id=v_target_id;
          if found then
            if v_existing_deleted then raise exception 'cash movement id was already used'; end if;
            if v_existing_branch is distinct from v_branch
               or coalesce(v_existing->>'sessionId','')<>coalesce(v_movement->>'sessionId','')
               or lower(coalesce(v_existing->>'type',''))<>lower(coalesce(v_movement->>'type',''))
               or round(coalesce(nullif(v_existing->>'amount','')::numeric,0),2)<>round(coalesce(nullif(v_movement->>'amount','')::numeric,0),2) then
              raise exception 'cash movement id reused with different payload';
            end if;
            insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
            values(v_tenant,v_operation,'cashTransaction',v_target_id) on conflict do nothing;
            v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateMovement',true));
            continue;
          end if;
        end if;
      end if;

      v_base:=public.apply_finance_transactions_v2_legacy(jsonb_build_array(op));
      v_row:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_row is null then raise exception 'finance engine returned no result'; end if;
      v_results:=v_results||jsonb_build_array(v_row);
    exception when others then
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;

revoke all on function public.apply_finance_transactions_v2(jsonb) from public;
revoke all on function public.apply_finance_transactions_v2(jsonb) from anon;
grant execute on function public.apply_finance_transactions_v2(jsonb) to authenticated;

create or replace function public.apply_purchase_transactions_v3(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb;
  v_results jsonb:='[]'::jsonb;
  v_base jsonb;
  v_row jsonb;
  v_type text;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_entity_id text;
  v_payload jsonb;
  v_payment jsonb;
  v_purchase jsonb;
  v_existing jsonb;
  v_existing_branch uuid;
  v_existing_deleted boolean;
  v_supplier_id text;
  v_purchase_id text;
  v_method text;
  v_amount numeric;
  v_existing_amount numeric;
  v_client_id text;
  v_existing_client_id text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 purchase transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      if jsonb_typeof(op)<>'object' then raise exception 'purchase transaction must be an object'; end if;
      v_type:=coalesce(op->>'entityType','');
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId','');
      v_entity_id:=nullif(op->>'entityId','');
      v_payload:=op->'payload';
      if v_type not in('purchaseTransactions','supplierPaymentTransactions') then raise exception 'invalid purchase transaction entity'; end if;
      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then raise exception 'invalid purchase transaction identifiers'; end if;
      if length(v_operation)>160 or length(v_entity_id)>220 then raise exception 'purchase transaction identifier too long'; end if;
      if not public.branch_can_operate(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      if v_type='purchaseTransactions' then
        if not public.can_sync_entity(v_tenant,'purchases') then raise exception 'role denied for purchases'; end if;
        v_purchase:=v_payload->'purchase';
        if jsonb_typeof(v_purchase)<>'object' then raise exception 'purchase payload must be an object'; end if;
        v_supplier_id:=nullif(v_purchase->>'supplierId','');
        v_client_id:=coalesce(nullif(v_purchase->>'clientOperationId',''),v_entity_id);
        select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted
        from public.sync_entities where tenant_id=v_tenant and entity_type='purchases' and entity_id=v_entity_id;
        if found then
          if v_existing_deleted then raise exception 'purchase id was already used'; end if;
          v_existing_client_id:=coalesce(nullif(v_existing->>'clientOperationId',''),v_entity_id);
          if v_existing_branch is distinct from v_branch
             or coalesce(v_existing->>'supplierId','')<>coalesce(v_supplier_id,'')
             or v_existing_client_id<>v_client_id then
            raise exception 'purchase transaction id reused with different payload';
          end if;
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
          values(v_tenant,v_operation,'purchaseTransaction',v_entity_id) on conflict do nothing;
          v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicatePurchase',true));
          continue;
        end if;
      else
        if not public.can_sync_entity(v_tenant,'supplierPayments') then raise exception 'role denied for supplier payments'; end if;
        v_payment:=v_payload->'payment';
        if jsonb_typeof(v_payment)<>'object' then raise exception 'supplier payment payload must be an object'; end if;
        v_purchase_id:=nullif(v_payment->>'purchaseId','');
        v_supplier_id:=nullif(v_payment->>'supplierId','');
        v_amount:=round(coalesce(nullif(v_payment->>'amount','')::numeric,0),2);
        v_method:=lower(coalesce(v_payment->>'method','transfer'));
        v_client_id:=coalesce(nullif(v_payment->>'clientOperationId',''),v_entity_id);
        if v_purchase_id is null or v_supplier_id is null or v_amount<=0 then raise exception 'invalid supplier payment'; end if;

        select payload,branch_id,deleted into v_existing,v_existing_branch,v_existing_deleted
        from public.sync_entities where tenant_id=v_tenant and entity_type='supplierPayments' and entity_id=v_entity_id;
        if found then
          if v_existing_deleted then raise exception 'supplier payment id was already used'; end if;
          v_existing_amount:=round(coalesce(nullif(v_existing->>'amount','')::numeric,0),2);
          v_existing_client_id:=coalesce(nullif(v_existing->>'clientOperationId',''),v_entity_id);
          if v_existing_branch is distinct from v_branch
             or coalesce(v_existing->>'purchaseId','')<>v_purchase_id
             or coalesce(v_existing->>'supplierId','')<>v_supplier_id
             or v_existing_amount<>v_amount
             or lower(coalesce(v_existing->>'method','transfer'))<>v_method
             or v_existing_client_id<>v_client_id then
            raise exception 'supplier payment id reused with different payload';
          end if;
          insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
          values(v_tenant,v_operation,'supplierPaymentTransaction',v_entity_id) on conflict do nothing;
          v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicateSupplierPayment',true));
          continue;
        end if;
      end if;

      v_base:=public.apply_purchase_transactions_v3_legacy(jsonb_build_array(op));
      v_row:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_row is null then raise exception 'purchase engine returned no result'; end if;
      v_results:=v_results||jsonb_build_array(v_row);
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