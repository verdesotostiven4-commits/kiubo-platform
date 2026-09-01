create or replace function public.catalog_check_pin(p_slug text, p_pin text, p_attempt_key text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_account public.catalog_accounts%rowtype;
  v_attempt public.catalog_pin_attempts%rowtype;
  v_global public.catalog_pin_attempts%rowtype;
  v_attempts integer;
  v_global_attempts integer;
  v_blocked_until timestamptz;
  v_global_blocked_until timestamptz;
  v_key text := left(p_attempt_key, 160);
  v_global_key constant text := '__account_global__';
begin
  if p_pin !~ '^[0-9]{4}$' or char_length(p_attempt_key) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_account
  from public.catalog_accounts
  where slug = p_slug;

  if not found then
    perform pg_sleep(0.18);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Account-wide throttle prevents bypassing the per-client limit by rotating
  -- user-agent/device identifiers against a 4-digit provider PIN.
  insert into public.catalog_pin_attempts (account_id, attempt_key)
  values (v_account.id, v_global_key)
  on conflict (account_id, attempt_key) do nothing;

  select * into v_global
  from public.catalog_pin_attempts
  where account_id = v_account.id and attempt_key = v_global_key
  for update;

  if v_global.window_started_at < now() - interval '15 minutes' then
    update public.catalog_pin_attempts
    set attempts = 0, window_started_at = now(), blocked_until = null, updated_at = now()
    where account_id = v_account.id and attempt_key = v_global_key;
    v_global.attempts := 0;
    v_global.blocked_until := null;
  end if;

  if v_global.blocked_until is not null and v_global.blocked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'blocked',
      'retry_after', extract(epoch from (v_global.blocked_until - now()))::integer
    );
  end if;

  insert into public.catalog_pin_attempts (account_id, attempt_key)
  values (v_account.id, v_key)
  on conflict (account_id, attempt_key) do nothing;

  select * into v_attempt
  from public.catalog_pin_attempts
  where account_id = v_account.id and attempt_key = v_key
  for update;

  if v_attempt.blocked_until is not null and v_attempt.blocked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'blocked',
      'retry_after', extract(epoch from (v_attempt.blocked_until - now()))::integer
    );
  end if;

  if v_attempt.window_started_at < now() - interval '15 minutes' then
    update public.catalog_pin_attempts
    set attempts = 0, window_started_at = now(), blocked_until = null, updated_at = now()
    where account_id = v_account.id and attempt_key = v_key;
    v_attempt.attempts := 0;
  end if;

  if extensions.crypt(p_pin, v_account.provider_pin_hash) = v_account.provider_pin_hash then
    delete from public.catalog_pin_attempts
    where account_id = v_account.id and attempt_key in (v_key, v_global_key);

    return jsonb_build_object(
      'ok', true,
      'account_id', v_account.id,
      'session_version', v_account.session_version
    );
  end if;

  v_attempts := v_attempt.attempts + 1;
  v_blocked_until := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;

  update public.catalog_pin_attempts
  set attempts = v_attempts, blocked_until = v_blocked_until, updated_at = now()
  where account_id = v_account.id and attempt_key = v_key;

  v_global_attempts := v_global.attempts + 1;
  v_global_blocked_until := case when v_global_attempts >= 30 then now() + interval '15 minutes' else null end;

  update public.catalog_pin_attempts
  set attempts = v_global_attempts, blocked_until = v_global_blocked_until, updated_at = now()
  where account_id = v_account.id and attempt_key = v_global_key;

  perform pg_sleep(0.18);

  return jsonb_build_object(
    'ok', false,
    'reason', case when v_blocked_until is not null or v_global_blocked_until is not null then 'blocked' else 'invalid' end,
    'remaining', greatest(0, 5 - v_attempts)
  );
end;
$function$;
