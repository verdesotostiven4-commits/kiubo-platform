-- KIUBO Cloud v2 phase 3 · atomic cash sessions, cash movements and credit payments.
-- Also prevents negative product stock at the cloud boundary.

create or replace function public.sync_nonnegative_number(p_payload jsonb,p_key text)
returns boolean
language plpgsql
immutable
set search_path=public
as $$
declare
  v numeric;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then return false; end if;
  v:=coalesce(nullif(p_payload->>p_key,'')::numeric,0);
  return v>=0;
exception when others then
  return false;
end
$$;

revoke all on function public.sync_nonnegative_number(jsonb,text) from public;
revoke all on function public.sync_nonnegative_number(jsonb,text) from anon;
revoke all on function public.sync_nonnegative_number(jsonb,text) from authenticated;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='sync_tenant_products_stock_nonnegative'
      and conrelid='public.sync_entities'::regclass
  ) then
    alter table public.sync_entities
      add constraint sync_tenant_products_stock_nonnegative
      check (
        entity_type<>'tenantProducts'
        or deleted
        or public.sync_nonnegative_number(payload,'stock')
      ) not valid;
  end if;
end
$$;

create or replace function public.apply_finance_transactions_v2(p_operations jsonb)
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
  v_entity_type text;
  v_entity_id text;
  v_kind text;
  v_payload jsonb;
  v_session jsonb;
  v_session_id text;
  v_session_payload jsonb;
  v_movement jsonb;
  v_movement_id text;
  v_movement_payload jsonb;
  v_payment jsonb;
  v_payment_id text;
  v_payment_payload jsonb;
  v_credit_id text;
  v_credit_payload jsonb;
  v_credit_balance numeric;
  v_amount numeric;
  v_applied numeric;
  v_opening numeric;
  v_closing numeric;
  v_method text;
  v_type text;
  v_reason text;
  v_created_at text;
  v_closed_at text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>50 then raise exception 'maximum 50 finance transactions per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant:=null;
      v_branch:=null;
      v_operation:=null;
      v_entity_type:=null;
      v_entity_id:=null;
      v_kind:=null;
      v_payload:=null;
      v_session:=null;
      v_session_id:=null;
      v_session_payload:=null;
      v_movement:=null;
      v_movement_id:=null;
      v_movement_payload:=null;
      v_payment:=null;
      v_payment_id:=null;
      v_payment_payload:=null;
      v_credit_id:=null;
      v_credit_payload:=null;

      if jsonb_typeof(op)<>'object' then raise exception 'finance transaction must be an object'; end if;
      if coalesce(op->>'action','upsert')<>'upsert' then raise exception 'finance transactions only support upsert'; end if;

      v_tenant:=nullif(op->>'tenantId','')::uuid;
      v_branch:=nullif(op->>'branchId','')::uuid;
      v_operation:=nullif(op->>'operationId','');
      v_entity_type:=nullif(op->>'entityType','');
      v_entity_id:=nullif(op->>'entityId','');
      v_payload:=op->'payload';

      if v_tenant is null or v_branch is null or v_operation is null or v_entity_id is null then
        raise exception 'invalid finance transaction identifiers';
      end if;
      if length(v_operation)>160 or length(v_entity_id)>220 then raise exception 'finance transaction identifier too long'; end if;
      if v_entity_type not in('cashTransactions','creditPaymentTransactions') then raise exception 'invalid finance transaction entity'; end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_branch::text||':finance',0));

      if v_entity_type='cashTransactions' then
        if not public.can_sync_entity(v_tenant,'cashSessions') then raise exception 'role denied for cash'; end if;
        v_kind:=lower(coalesce(v_payload->>'kind',''));
        if v_kind not in('open','movement','close') then raise exception 'invalid cash transaction kind'; end if;

        if v_kind='open' then
          v_session:=v_payload->'session';
          if jsonb_typeof(v_session)<>'object' then raise exception 'cash session payload missing'; end if;
          v_session_id:=nullif(v_session->>'id','');
          if v_session_id is null or length(v_session_id)>200 then raise exception 'invalid cash session id'; end if;
          if nullif(v_session->>'tenantId','') is not null and v_session->>'tenantId'<>v_tenant::text then raise exception 'cash tenant mismatch'; end if;
          if nullif(v_session->>'branchId','') is not null and v_session->>'branchId'<>v_branch::text then raise exception 'cash branch mismatch'; end if;
          v_opening:=coalesce(nullif(v_session->>'openingAmount','')::numeric,0);
          if v_opening<0 then raise exception 'opening amount cannot be negative'; end if;
          if exists(
            select 1 from public.sync_entities
            where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and not deleted
              and lower(coalesce(payload->>'status',''))='open'
          ) then raise exception 'cash session already open'; end if;
          v_created_at:=coalesce(nullif(v_session->>'openedAt',''),now()::text);
          v_session_payload:=jsonb_build_object(
            'id',v_session_id,'tenantId',v_tenant::text,'branchId',v_branch::text,
            'openingAmount',round(v_opening,2),'status','open','openedAt',v_created_at,
            'openedBy',left(coalesce(nullif(v_session->>'openedBy',''),'Usuario'),160)
          );
          v_session_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashSessions',v_session_id,v_session_payload);
          insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
          values(v_tenant,v_branch,'cashSessions',v_session_id,v_session_payload,false,now())
          on conflict(tenant_id,entity_type,entity_id) do update
            set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

        elsif v_kind='movement' then
          if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for cash movements'; end if;
          v_movement:=v_payload->'movement';
          if jsonb_typeof(v_movement)<>'object' then raise exception 'cash movement payload missing'; end if;
          v_movement_id:=nullif(v_movement->>'id','');
          v_session_id:=nullif(v_movement->>'sessionId','');
          if v_movement_id is null or v_session_id is null or length(v_movement_id)>200 or length(v_session_id)>200 then raise exception 'invalid cash movement identifiers'; end if;
          select payload into v_session_payload
          from public.sync_entities
          where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted
          for update;
          if not found or lower(coalesce(v_session_payload->>'status',''))<>'open' then raise exception 'cash session is not open'; end if;
          v_type:=lower(coalesce(v_movement->>'type',''));
          if v_type not in('in','out') then raise exception 'invalid cash movement type'; end if;
          v_amount:=coalesce(nullif(v_movement->>'amount','')::numeric,0);
          if v_amount<=0 then raise exception 'cash movement amount must be positive'; end if;
          v_reason:=left(coalesce(nullif(v_movement->>'reason',''),'Movimiento'),240);
          v_created_at:=coalesce(nullif(v_movement->>'createdAt',''),now()::text);
          v_movement_payload:=jsonb_build_object(
            'id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,
            'sessionId',v_session_id,'type',v_type,'amount',round(v_amount,2),'reason',v_reason,
            'clientOperationId',coalesce(nullif(v_movement->>'clientOperationId',''),v_movement_id),'createdAt',v_created_at
          );
          v_movement_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashMovements',v_movement_id,v_movement_payload);
          insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
          values(v_tenant,v_branch,'cashMovements',v_movement_id,v_movement_payload,false,now())
          on conflict(tenant_id,entity_type,entity_id) do update
            set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

        else
          v_session:=v_payload->'session';
          if jsonb_typeof(v_session)<>'object' then raise exception 'closed cash session payload missing'; end if;
          v_session_id:=nullif(v_session->>'id','');
          if v_session_id is null or length(v_session_id)>200 then raise exception 'invalid cash session id'; end if;
          select payload into v_session_payload
          from public.sync_entities
          where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted
          for update;
          if not found then raise exception 'cash session not found'; end if;
          if lower(coalesce(v_session_payload->>'status',''))<>'open' then raise exception 'cash session already closed'; end if;
          v_closing:=coalesce(nullif(v_session->>'closingAmount','')::numeric,0);
          if v_closing<0 then raise exception 'closing amount cannot be negative'; end if;
          v_closed_at:=coalesce(nullif(v_session->>'closedAt',''),now()::text);
          v_session_payload:=v_session_payload||jsonb_build_object('status','closed','closingAmount',round(v_closing,2),'closedAt',v_closed_at);
          v_session_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashSessions',v_session_id,v_session_payload);
          update public.sync_entities
          set payload=v_session_payload,updated_at=now()
          where tenant_id=v_tenant and entity_type='cashSessions' and entity_id=v_session_id;
        end if;

        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'cashTransaction',v_entity_id);
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'kind',v_kind));

      else
        if not public.can_sync_entity(v_tenant,'creditPayments') then raise exception 'role denied for credit payments'; end if;
        v_payment:=v_payload->'payment';
        if jsonb_typeof(v_payment)<>'object' then raise exception 'credit payment payload missing'; end if;
        v_payment_id:=nullif(v_payment->>'id','');
        v_credit_id:=nullif(v_payment->>'creditId','');
        if v_payment_id is null or v_credit_id is null or length(v_payment_id)>200 or length(v_credit_id)>200 then raise exception 'invalid credit payment identifiers'; end if;
        if v_payment_id<>v_entity_id then raise exception 'credit payment id mismatch'; end if;
        v_amount:=coalesce(nullif(v_payment->>'amount','')::numeric,0);
        if v_amount<=0 then raise exception 'credit payment amount must be positive'; end if;
        v_method:=lower(coalesce(v_payment->>'method','cash'));
        if v_method not in('cash','transfer') then raise exception 'invalid credit payment method'; end if;

        select payload into v_credit_payload
        from public.sync_entities
        where tenant_id=v_tenant and branch_id=v_branch and entity_type='credits' and entity_id=v_credit_id and not deleted
        for update;
        if not found then raise exception 'credit not found'; end if;
        v_credit_balance:=coalesce(nullif(v_credit_payload->>'balance','')::numeric,0);
        if v_credit_balance<=0 or lower(coalesce(v_credit_payload->>'status',''))='paid' then raise exception 'credit already paid'; end if;
        v_applied:=least(v_amount,v_credit_balance);
        v_created_at:=coalesce(nullif(v_payment->>'createdAt',''),now()::text);

        v_payment_payload:=jsonb_build_object(
          'id',v_payment_id,'tenantId',v_tenant::text,'branchId',v_branch::text,
          'creditId',v_credit_id,'amount',round(v_applied,2),'method',v_method,
          'clientOperationId',coalesce(nullif(v_payment->>'clientOperationId',''),v_payment_id),'createdAt',v_created_at
        );
        v_payment_payload:=public.normalize_sync_payload(v_tenant,v_branch,'creditPayments',v_payment_id,v_payment_payload);
        insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
        values(v_tenant,v_branch,'creditPayments',v_payment_id,v_payment_payload,false,now())
        on conflict(tenant_id,entity_type,entity_id) do update
          set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;

        v_credit_balance:=round(v_credit_balance-v_applied,2);
        v_credit_payload:=v_credit_payload||jsonb_build_object(
          'balance',v_credit_balance,
          'status',case when v_credit_balance<=0.001 then 'paid' else 'open' end
        );
        v_credit_payload:=public.normalize_sync_payload(v_tenant,v_branch,'credits',v_credit_id,v_credit_payload);
        update public.sync_entities
        set payload=v_credit_payload,updated_at=now()
        where tenant_id=v_tenant and entity_type='credits' and entity_id=v_credit_id;

        if v_method='cash' and jsonb_typeof(v_payload->'cashMovement')='object' then
          if not public.can_sync_entity(v_tenant,'cashMovements') then raise exception 'role denied for cash movements'; end if;
          v_movement:=v_payload->'cashMovement';
          v_movement_id:=nullif(v_movement->>'id','');
          v_session_id:=nullif(v_movement->>'sessionId','');
          if v_movement_id is null or v_session_id is null then raise exception 'cash movement for credit payment is invalid'; end if;
          select payload into v_session_payload
          from public.sync_entities
          where tenant_id=v_tenant and branch_id=v_branch and entity_type='cashSessions' and entity_id=v_session_id and not deleted
          for update;
          if not found or lower(coalesce(v_session_payload->>'status',''))<>'open' then raise exception 'cash session is not open'; end if;
          v_movement_payload:=jsonb_build_object(
            'id',v_movement_id,'tenantId',v_tenant::text,'branchId',v_branch::text,
            'sessionId',v_session_id,'type','in','amount',round(v_applied,2),
            'reason',left(coalesce(nullif(v_movement->>'reason',''),'Abono de fiado'),240),
            'clientOperationId',coalesce(nullif(v_movement->>'clientOperationId',''),v_movement_id),'createdAt',v_created_at
          );
          v_movement_payload:=public.normalize_sync_payload(v_tenant,v_branch,'cashMovements',v_movement_id,v_movement_payload);
          insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
          values(v_tenant,v_branch,'cashMovements',v_movement_id,v_movement_payload,false,now())
          on conflict(tenant_id,entity_type,entity_id) do update
            set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
        end if;

        insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
        values(v_tenant,v_operation,'creditPaymentTransaction',v_payment_id);
        v_results:=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'applied',round(v_applied,2),'balance',v_credit_balance));
      end if;

    exception when others then
      v_results:=v_results||jsonb_build_array(jsonb_build_object(
        'operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm
      ));
    end;
  end loop;

  return v_results;
end
$$;

revoke all on function public.apply_finance_transactions_v2(jsonb) from public;
revoke all on function public.apply_finance_transactions_v2(jsonb) from anon;
grant execute on function public.apply_finance_transactions_v2(jsonb) to authenticated;
