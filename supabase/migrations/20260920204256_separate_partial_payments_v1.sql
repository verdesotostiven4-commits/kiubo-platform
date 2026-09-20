do $do$
declare
  ddl text;
begin
  select pg_get_functiondef('public.apply_sale_transactions_v2(jsonb)'::regprocedure) into ddl;

  if position($needle$'partial'$needle$ in substring(ddl from position('if v_payment not in' in ddl) for 220)) = 0 then
    ddl := regexp_replace(
      ddl,
      $pat$(v_payment not in\(\s*'cash',\s*'transfer',\s*'mixed',\s*'credit')(\s*\))$pat$,
      E'\\1,\n        ''partial''\\2',
      'n'
    );
  end if;

  ddl := replace(
    ddl,
    $old$if v_payment='credit' then$old$,
    $new$if v_payment in('credit','partial') then$new$
  );

  if position($needle$'kind',case when v_payment='partial'$needle$ in ddl) = 0 then
    ddl := replace(
      ddl,
      $old$'customerId',v_customer_id,
            'saleId',v_sale_id,$old$,
      $new$'customerId',v_customer_id,
            'kind',case when v_payment='partial' then 'partial' else 'fiado' end,
            'saleId',v_sale_id,$new$
    );
  end if;

  execute ddl;
end
$do$;
