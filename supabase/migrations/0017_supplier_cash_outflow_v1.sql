-- KIUBO Cloud v2 · purchase cash outflow integrity.
-- Wraps Purchase Transaction V2 so cash supplier payments and their register outflow commit or rollback together.

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

      -- V2 performs purchase/payable locking and canonical stock/cost updates. Calling it inside this
      -- exception block keeps those writes in the same subtransaction as the cash outflow below.
      v_base:=public.apply_purchase_transactions_v2(jsonb_build_array(op));
      v_base_result:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_base_result is null then raise exception 'purchase engine returned no result'; end if;
      if not coalesce((v_base_result->>'ok')::boolean,false) then
        v_results:=v_results||jsonb_build_array(v_base_result);
        continue;
      end if;

      if v_method='cash' then
        v_created_at:=coalesce(nullif(v_cash->>'createdAt',''),nullif(v_payment->>'createdAt',''),now()::text);
        v_reason:=left(coalesce(nullif(trim(v_cash->>'reason'),''),
          case when v_type='purchaseTransactions' then 'Pago inicial a proveedor' else 'Abono a proveedor' end),240);
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
