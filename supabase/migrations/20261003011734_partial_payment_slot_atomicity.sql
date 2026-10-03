-- Keep restaurant partial payments attached to their original service slot.
-- The protected sale/payment commands now persist the order in the same database
-- transaction and historical outstanding balances recover their commercial kind.

do $$
begin
  if to_regprocedure('public.apply_sale_transactions_v2_partial_slot_legacy(jsonb)') is null then
    if to_regprocedure('public.apply_sale_transactions_v2(jsonb)') is null then
      raise exception 'apply_sale_transactions_v2 must exist before partial slot hardening';
    end if;
    alter function public.apply_sale_transactions_v2(jsonb) rename to apply_sale_transactions_v2_partial_slot_legacy;
  end if;

  if to_regprocedure('public.apply_finance_transactions_v2_partial_slot_legacy(jsonb)') is null then
    if to_regprocedure('public.apply_finance_transactions_v2(jsonb)') is null then
      raise exception 'apply_finance_transactions_v2 must exist before partial slot hardening';
    end if;
    alter function public.apply_finance_transactions_v2(jsonb) rename to apply_finance_transactions_v2_partial_slot_legacy;
  end if;
end
$$;

revoke all on function public.apply_sale_transactions_v2_partial_slot_legacy(jsonb) from public;
revoke all on function public.apply_sale_transactions_v2_partial_slot_legacy(jsonb) from anon;
revoke all on function public.apply_sale_transactions_v2_partial_slot_legacy(jsonb) from authenticated;
revoke all on function public.apply_finance_transactions_v2_partial_slot_legacy(jsonb) from public;
revoke all on function public.apply_finance_transactions_v2_partial_slot_legacy(jsonb) from anon;
revoke all on function public.apply_finance_transactions_v2_partial_slot_legacy(jsonb) from authenticated;

create or replace function public.kiubo_upsert_transaction_order_v1(
  p_tenant uuid,
  p_branch uuid,
  p_sale_id text,
  p_order jsonb
)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_sale jsonb;
  v_credit jsonb;
  v_order_id text;
  v_sale_order_id text;
  v_payment text;
  v_payment_status text;
  v_order_payload jsonb;
begin
  if p_order is null or jsonb_typeof(p_order)<>'object' then return; end if;
  if not public.can_sync_entity(p_tenant,'orders') then raise exception 'role denied for orders'; end if;

  select payload into v_sale
  from public.sync_entities
  where tenant_id=p_tenant and branch_id=p_branch and entity_type='sales' and entity_id=p_sale_id and not deleted;
  if not found then raise exception 'sale missing while persisting order'; end if;

  v_order_id:=nullif(p_order->>'id','');
  v_sale_order_id:=nullif(v_sale->>'orderId','');
  if v_order_id is null or length(v_order_id)>200 then raise exception 'invalid transaction order id'; end if;
  if v_sale_order_id is null or v_sale_order_id<>v_order_id then raise exception 'sale and order mismatch'; end if;

  v_payment:=lower(coalesce(v_sale->>'payment','cash'));
  if v_payment in('partial','credit') then
    select payload into v_credit
    from public.sync_entities
    where tenant_id=p_tenant and branch_id=p_branch and entity_type='credits' and not deleted
      and payload->>'saleId'=p_sale_id
    order by updated_at desc
    limit 1;
    if not found then raise exception 'outstanding balance missing while persisting order'; end if;
    v_payment_status:=case
      when coalesce(nullif(v_credit->>'balance','')::numeric,0)<=0.001
        or lower(coalesce(v_credit->>'status',''))='paid' then 'paid'
      else 'partial'
    end;
  else
    v_payment_status:='paid';
  end if;

  v_order_payload:=p_order||jsonb_build_object(
    'id',v_order_id,
    'tenantId',p_tenant::text,
    'branchId',p_branch::text,
    'saleId',p_sale_id,
    'paymentStatus',v_payment_status,
    'updatedAt',coalesce(nullif(p_order->>'updatedAt',''),now()::text)
  );
  v_order_payload:=public.normalize_sync_payload(p_tenant,p_branch,'orders',v_order_id,v_order_payload);
  insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
  values(p_tenant,p_branch,'orders',v_order_id,v_order_payload,false,now())
  on conflict(tenant_id,entity_type,entity_id) do update
    set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
end
$$;

create or replace function public.kiubo_reconcile_outstanding_order_v1(
  p_tenant uuid,
  p_branch uuid,
  p_credit_id text
)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_credit jsonb;
  v_sale jsonb;
  v_order jsonb;
  v_sale_id text;
  v_order_id text;
  v_kind text;
  v_payment_status text;
begin
  select payload into v_credit
  from public.sync_entities
  where tenant_id=p_tenant and branch_id=p_branch and entity_type='credits' and entity_id=p_credit_id and not deleted
  for update;
  if not found then raise exception 'credit missing while reconciling order'; end if;

  v_sale_id:=nullif(v_credit->>'saleId','');
  if v_sale_id is null then return; end if;
  select payload into v_sale
  from public.sync_entities
  where tenant_id=p_tenant and branch_id=p_branch and entity_type='sales' and entity_id=v_sale_id and not deleted;
  if not found then return; end if;

  v_kind:=case when lower(coalesce(v_sale->>'payment',''))='partial' then 'partial' else 'fiado' end;
  if coalesce(v_credit->>'kind','')<>v_kind then
    v_credit:=public.normalize_sync_payload(
      p_tenant,p_branch,'credits',p_credit_id,v_credit||jsonb_build_object('kind',v_kind)
    );
    update public.sync_entities
    set payload=v_credit,updated_at=now()
    where tenant_id=p_tenant and entity_type='credits' and entity_id=p_credit_id;
  end if;

  v_order_id:=nullif(v_sale->>'orderId','');
  if v_order_id is null then return; end if;
  select payload into v_order
  from public.sync_entities
  where tenant_id=p_tenant and branch_id=p_branch and entity_type='orders' and entity_id=v_order_id and not deleted
  for update;
  if not found then return; end if;

  -- A historical order can have more than one linked sale. Only its currently selected
  -- sale is allowed to change the order, so an older balance never overwrites a newer one.
  if nullif(v_order->>'saleId','') is distinct from v_sale_id then return; end if;
  v_payment_status:=case
    when coalesce(nullif(v_credit->>'balance','')::numeric,0)<=0.001
      or lower(coalesce(v_credit->>'status',''))='paid' then 'paid'
    else 'partial'
  end;
  v_order:=public.normalize_sync_payload(
    p_tenant,p_branch,'orders',v_order_id,
    v_order||jsonb_build_object('paymentStatus',v_payment_status,'updatedAt',now()::text)
  );
  update public.sync_entities
  set payload=v_order,updated_at=now()
  where tenant_id=p_tenant and entity_type='orders' and entity_id=v_order_id;
end
$$;

revoke all on function public.kiubo_upsert_transaction_order_v1(uuid,uuid,text,jsonb) from public;
revoke all on function public.kiubo_upsert_transaction_order_v1(uuid,uuid,text,jsonb) from anon;
revoke all on function public.kiubo_upsert_transaction_order_v1(uuid,uuid,text,jsonb) from authenticated;
revoke all on function public.kiubo_reconcile_outstanding_order_v1(uuid,uuid,text) from public;
revoke all on function public.kiubo_reconcile_outstanding_order_v1(uuid,uuid,text) from anon;
revoke all on function public.kiubo_reconcile_outstanding_order_v1(uuid,uuid,text) from authenticated;

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
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_credit_id text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 finance transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_operation:=coalesce(op->>'operationId','');
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_base:=public.apply_finance_transactions_v2_partial_slot_legacy(jsonb_build_array(op));
      v_row:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_row is null then raise exception 'finance engine returned no result'; end if;
      if coalesce((v_row->>'ok')::boolean,false) and coalesce(op->>'entityType','')='creditPaymentTransactions' then
        v_credit_id:=nullif(op->'payload'->'payment'->>'creditId','');
        if v_credit_id is null then raise exception 'credit payment payload missing credit id'; end if;
        perform public.kiubo_reconcile_outstanding_order_v1(v_tenant,v_branch,v_credit_id);
        v_row:=v_row||jsonb_build_object('orderApplied',true);
      end if;
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

create or replace function public.apply_sale_transactions_v2(p_operations jsonb)
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
  v_finance jsonb;
  v_finance_row jsonb;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_sale_id text;
  v_payment text;
  v_credit_id text;
  v_order jsonb;
  v_initial_payment jsonb;
  v_initial_cash jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 sale transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_operation:=coalesce(op->>'operationId','');
      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_sale_id:=nullif(op->>'entityId','');
      v_payment:=lower(coalesce(op->'payload'->'sale'->>'payment','cash'));
      v_order:=op->'payload'->'orderAfter';
      v_initial_payment:=op->'payload'->'initialCreditPayment';
      v_initial_cash:=op->'payload'->'initialCreditCashMovement';

      v_base:=public.apply_sale_transactions_v2_partial_slot_legacy(jsonb_build_array(op));
      v_row:=case when jsonb_typeof(v_base)='array' and jsonb_array_length(v_base)>0 then v_base->0 else null end;
      if v_row is null then raise exception 'sale engine returned no result'; end if;
      if coalesce((v_row->>'ok')::boolean,false) then
        if jsonb_typeof(v_order)='object' then
          perform public.kiubo_upsert_transaction_order_v1(v_tenant,v_branch,v_sale_id,v_order);
        end if;

        if v_payment in('partial','credit') then
          v_credit_id:=nullif(op->'payload'->'credit'->>'id','');
          if v_credit_id is null then raise exception 'outstanding sale payload missing credit id'; end if;
          perform public.kiubo_reconcile_outstanding_order_v1(v_tenant,v_branch,v_credit_id);
        end if;

        if jsonb_typeof(v_initial_payment)='object' then
          if v_payment<>'partial' then raise exception 'initial partial payment requires a partial sale'; end if;
          if nullif(v_initial_payment->>'creditId','') is distinct from v_credit_id then raise exception 'initial payment credit mismatch'; end if;
          v_finance:=public.apply_finance_transactions_v2(jsonb_build_array(jsonb_build_object(
            'operationId',left(v_operation||':initial-partial',160),
            'tenantId',v_tenant::text,
            'branchId',v_branch::text,
            'entityType','creditPaymentTransactions',
            'entityId',v_initial_payment->>'id',
            'action','upsert',
            'payload',jsonb_build_object(
              'payment',v_initial_payment,
              'creditSnapshot',op->'payload'->'credit',
              'cashMovement',case when jsonb_typeof(v_initial_cash)='object' then v_initial_cash else null end,
              'orderAfter',v_order
            )
          )));
          v_finance_row:=case when jsonb_typeof(v_finance)='array' and jsonb_array_length(v_finance)>0 then v_finance->0 else null end;
          if v_finance_row is null or not coalesce((v_finance_row->>'ok')::boolean,false) then
            raise exception 'initial partial payment failed: %',coalesce(v_finance_row->>'error','finance engine returned no result');
          end if;
        end if;
        v_row:=v_row||jsonb_build_object('orderApplied',jsonb_typeof(v_order)='object','initialPaymentApplied',jsonb_typeof(v_initial_payment)='object');
      end if;
      v_results:=v_results||jsonb_build_array(v_row);
    exception when others then
      v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;

revoke all on function public.apply_sale_transactions_v2(jsonb) from public;
revoke all on function public.apply_sale_transactions_v2(jsonb) from anon;
grant execute on function public.apply_sale_transactions_v2(jsonb) to authenticated;

-- Repair only the missing classification. Amounts, payments and order contents are preserved.
update public.sync_entities as credit
set payload=public.normalize_sync_payload(
      credit.tenant_id,
      credit.branch_id,
      'credits',
      credit.entity_id,
      credit.payload||jsonb_build_object(
        'kind',case when lower(coalesce(sale.payload->>'payment',''))='partial' then 'partial' else 'fiado' end
      )
    ),
    updated_at=now()
from public.sync_entities as sale
where credit.entity_type='credits' and not credit.deleted
  and sale.tenant_id=credit.tenant_id and sale.branch_id=credit.branch_id
  and sale.entity_type='sales' and not sale.deleted
  and sale.entity_id=credit.payload->>'saleId'
  and lower(coalesce(sale.payload->>'payment','')) in('partial','credit')
  and coalesce(credit.payload->>'kind','') not in('partial','fiado');

do $$
declare
  row record;
begin
  for row in
    select tenant_id,branch_id,entity_id
    from public.sync_entities
    where entity_type='credits' and not deleted and coalesce(payload->>'kind','') in('partial','fiado')
  loop
    perform public.kiubo_reconcile_outstanding_order_v1(row.tenant_id,row.branch_id,row.entity_id);
  end loop;
end
$$;
