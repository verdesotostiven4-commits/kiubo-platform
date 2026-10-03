-- ============================================================================
-- Harmony OS / Planificador ESPOCH — Esquema de base de datos
-- ----------------------------------------------------------------------------
-- Cómo ejecutar: Supabase Dashboard → tu proyecto → SQL Editor → New query
--                → pega todo este archivo → Run.
-- Seguro: solo crea tablas en `public`, activa RLS y define políticas por
-- usuario. No toca auth.users salvo el trigger de bienvenida.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PROFILES — extiende auth.users con datos de la persona
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Mónica',
  avatar_url  text,
  role        text not null default 'estudiante'
              check (role in ('estudiante','pareja','admin')),
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 2. SUBJECTS — materias ESPOCH (sembradas por RPC al registrar usuario)
-- ============================================================================
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  is_practice boolean not null default false,   -- Prácticas Laborales Autónomas
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ============================================================================
-- 3. CLASS_SESSIONS — horario semanal recurrente (plantilla oficial ESPOCH)
--    day_of_week: 1=Lun .. 5=Vie
-- ============================================================================
create table if not exists public.class_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5),
  start_time  time not null,
  end_time    time not null,
  room        text,
  created_at  timestamptz not null default now(),
  unique (user_id, day_of_week, start_time)
);

-- ============================================================================
-- 4. ATTENDANCE — asistencia real por sesión + fecha concreta
--    De aquí se calcula el 75% reglamentario (NO hardcodeado).
-- ============================================================================
create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid not null references public.class_sessions(id) on delete cascade,
  session_date  date not null,
  status        text not null check (status in ('asisti','falta','no_hubo')),
  note          text not null default '',
  created_at    timestamptz not null default now(),
  unique (user_id, session_id, session_date)
);

-- ============================================================================
-- 5. PRACTICE_LOGS — lunes: prácticas laborales autónomas / campo
-- ============================================================================
create table if not exists public.practice_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  practice_date date not null,
  description text not null,
  hours       numeric(4,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 6. TASKS — tareas con prioridad Likert 1-5
-- ============================================================================
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  category    text not null check (category in ('estudio','personal','deseos')),
  subject_id  uuid references public.subjects(id) on delete set null,
  priority    smallint not null default 3 check (priority between 1 and 5),
  due_date    date,
  completed   boolean not null default false,
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tasks_user_due on public.tasks (user_id, due_date);
create index if not exists idx_tasks_user_category on public.tasks (user_id, category);

-- ============================================================================
-- 7. WATER_LOGS — hidratación (8 vasos × 250ml) por fecha
-- ============================================================================
create table if not exists public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  log_date    date not null,
  cups        smallint not null default 0 check (cups between 0 and 8),
  updated_at  timestamptz not null default now(),
  unique (user_id, log_date)
);

-- ============================================================================
-- 8. WORKOUT_LOGS — gimnasio / movimiento
-- ============================================================================
create table if not exists public.workout_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  minutes      integer not null default 0,
  muscle_group text not null check (muscle_group in
    ('Glúteos & Piernas','Espalda & Brazos','Abdomen & Core','Cardio & Caminata','Cuerpo Completo')),
  note         text not null default '',
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 9. PANTRY — despensa y compras
-- ============================================================================
create table if not exists public.pantry_budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  weeks      smallint not null default 3 check (weeks between 1 and 4),
  budget     numeric(10,2) not null default 50.00,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  budget_id  uuid references public.pantry_budgets(id) on delete cascade,
  name       text not null,
  category   text not null check (category in
    ('Frutas','Verduras','Proteína','Granos secos','Lácteos')),
  checked    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pantry_category_expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  budget_id  uuid references public.pantry_budgets(id) on delete cascade,
  category   text not null check (category in
    ('Frutas','Verduras','Proteína','Granos secos','Lácteos')),
  amount     numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, budget_id, category)
);

create table if not exists public.extra_expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  budget_id    uuid references public.pantry_budgets(id) on delete cascade,
  name         text not null,
  cost         numeric(10,2) not null,
  expense_date date not null,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 10. FINANCE — cuentas, transacciones, deudas
-- ============================================================================
create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('banco','efectivo','ahorros')),
  balance    numeric(12,2) not null default 0,
  note       text not null default '',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  type           text not null check (type in ('ingreso','gasto','retiro')),
  account_id     uuid not null references public.accounts(id) on delete restrict,
  to_account_id  uuid references public.accounts(id) on delete set null,  -- retiro: destino
  amount         numeric(12,2) not null check (amount > 0),
  main_category  text check (main_category in
    ('Fotografía & Video','Sistemas / Programación','Ingresos Extras')),
  sub_category   text,
  description    text not null,
  savings_pct    smallint not null default 0 check (savings_pct between 0 and 100),
  savings_amount numeric(12,2) not null default 0,
  net_amount     numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tx_user_created on public.transactions (user_id, created_at desc);

create table if not exists public.debts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  person     text not null,
  amount     numeric(12,2) not null,
  reason     text not null default '',
  direction  text not null check (direction in ('debo','me_deben')),
  status     text not null default 'pendiente' check (status in ('pendiente','pagado')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 11. EXAM_GRADES — calificaciones /10
-- ============================================================================
create table if not exists public.exam_grades (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  exam_name  text not null,
  grade      numeric(4,1) not null check (grade >= 0),
  max_grade  numeric(4,1) not null default 10,
  exam_date  date not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- RLS — cada usuario solo ve/modifica sus filas
-- ============================================================================
alter table public.profiles                  enable row level security;
alter table public.subjects                  enable row level security;
alter table public.class_sessions            enable row level security;
alter table public.attendance                enable row level security;
alter table public.practice_logs             enable row level security;
alter table public.tasks                     enable row level security;
alter table public.water_logs                enable row level security;
alter table public.workout_logs              enable row level security;
alter table public.pantry_budgets            enable row level security;
alter table public.shopping_items            enable row level security;
alter table public.pantry_category_expenses  enable row level security;
alter table public.extra_expenses            enable row level security;
alter table public.accounts                  enable row level security;
alter table public.transactions              enable row level security;
alter table public.debts                     enable row level security;
alter table public.exam_grades               enable row level security;

-- Profiles: dueño de su propia fila
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Patrón para todas las tablas con user_id: dueño = auth.uid()
do $$
declare t text;
begin
  foreach t in array array[
    'subjects','class_sessions','attendance','practice_logs','tasks',
    'water_logs','workout_logs','pantry_budgets','shopping_items',
    'pantry_category_expenses','extra_expenses','accounts','transactions',
    'debts','exam_grades'
  ]
  loop
    execute format(
      $f$
        drop policy if exists %I_own on public.%I;
        create policy %I_own on public.%I
          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
      $f$,
      t, t, t, t
    );
  end loop;
end $$;

-- ============================================================================
-- TRIGGER — crear profile al registrarse
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Mónica'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RPC — seed_initial_data(): materias + cuentas + horario oficial ESPOCH
-- Llamar una vez tras el registro (desde el cliente al primer login).
-- ============================================================================
create or replace function public.seed_initial_data()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sub_orna uuid; v_sub_patri uuid; v_sub_esta uuid; v_sub_cont uuid;
  v_sub_serv uuid; v_sub_ingl uuid; v_sub_prac uuid;
  v_pichincha uuid; v_pacifico uuid; v_efectivo uuid; v_ahorros uuid;
begin
  -- Materias
  insert into public.subjects (user_id, name, is_practice, sort_order) values
    (auth.uid(), 'Ornitología y Aviturismo', false, 1),
    (auth.uid(), 'Patrimonio Cultural Material y Turismo (Prácticas Laborales)', false, 2),
    (auth.uid(), 'Estadística', false, 3),
    (auth.uid(), 'Contabilidad General y de Costos', false, 4),
    (auth.uid(), 'Servicios de Alimentación (Prácticas Laborales)', false, 5),
    (auth.uid(), 'Inglés IV', false, 6),
    (auth.uid(), 'Prácticas Laborales Autónomas', true, 7)
  on conflict (user_id, name) do nothing;

  select id into v_sub_orna  from public.subjects where user_id = auth.uid() and name = 'Ornitología y Aviturismo';
  select id into v_sub_patri from public.subjects where user_id = auth.uid() and name = 'Patrimonio Cultural Material y Turismo (Prácticas Laborales)';
  select id into v_sub_esta  from public.subjects where user_id = auth.uid() and name = 'Estadística';
  select id into v_sub_cont  from public.subjects where user_id = auth.uid() and name = 'Contabilidad General y de Costos';
  select id into v_sub_serv  from public.subjects where user_id = auth.uid() and name = 'Servicios de Alimentación (Prácticas Laborales)';
  select id into v_sub_ingl  from public.subjects where user_id = auth.uid() and name = 'Inglés IV';
  select id into v_sub_prac  from public.subjects where user_id = auth.uid() and name = 'Prácticas Laborales Autónomas';

  -- Horario oficial ESPOCH (Cuarto-1, Aula 5). Lunes=1..Viernes=5
  insert into public.class_sessions (user_id, subject_id, day_of_week, start_time, end_time, room) values
    -- Martes
    (auth.uid(), v_sub_orna, 2, '09:00','11:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_patri,2, '11:00','13:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_esta, 2, '15:00','17:00','Cuarto-1 Aula 5'),
    -- Miércoles
    (auth.uid(), v_sub_cont, 3, '08:00','11:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_serv, 3, '11:00','13:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_ingl, 3, '15:00','17:00','Cuarto-1 Aula 5'),
    -- Jueves
    (auth.uid(), v_sub_serv, 4, '07:00','09:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_esta, 4, '09:00','11:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_cont, 4, '11:00','13:00','Cuarto-1 Aula 5'),
    -- Viernes
    (auth.uid(), v_sub_esta, 5, '07:00','09:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_orna, 5, '09:00','11:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_patri,5, '11:00','13:00','Cuarto-1 Aula 5'),
    (auth.uid(), v_sub_ingl, 5, '15:00','17:00','Cuarto-1 Aula 5')
  on conflict (user_id, day_of_week, start_time) do nothing;

  -- Cuentas
  insert into public.accounts (user_id, name, kind, balance, note, sort_order) values
    (auth.uid(), 'Banco Pichincha',     'banco',    0, 'Banca Móvil Principal', 1),
    (auth.uid(), 'Banco del Pacífico',  'banco',    0, 'Banca Móvil Nómina',   2),
    (auth.uid(), 'Efectivo en Mano',    'efectivo', 0, 'Billetera física',      3),
    (auth.uid(), 'Bóveda de Ahorros',   'ahorros',  0, 'Fondo intocable',       4)
  on conflict (user_id, name) do nothing;

  -- Presupuesto de despensa por defecto
  insert into public.pantry_budgets (user_id, weeks, budget, is_active)
  values (auth.uid(), 3, 50.00, true)
  on conflict (user_id) do nothing;  -- (requiere unique(user_id) si se quiere garantizar)
end;
$$;

-- ============================================================================
-- RPC — record_transaction(): insert + ajuste atómico de saldos
-- Llamar desde el cliente en vez de hacer insert + updates sueltos.
-- ============================================================================
create or replace function public.record_transaction(
  p_type text,
  p_account_id uuid,
  p_amount numeric,
  p_description text,
  p_to_account_id uuid default null,
  p_main_category text default null,
  p_sub_category text default null,
  p_savings_pct smallint default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_save numeric;
  v_net numeric;
  v_savings_acct uuid;
begin
  if p_amount <= 0 then raise exception 'Monto inválido'; end if;

  if p_type = 'ingreso' then
    v_save := round(p_amount * coalesce(p_savings_pct,0) / 100.0, 2);
    v_net  := p_amount - v_save;
    insert into public.transactions
      (user_id, type, account_id, amount, main_category, sub_category, description, savings_pct, savings_amount, net_amount)
    values (auth.uid(), 'ingreso', p_account_id, p_amount, p_main_category, p_sub_category, p_description, coalesce(p_savings_pct,0), v_save, v_net)
    returning id into v_id;
    update public.accounts set balance = balance + v_net where id = p_account_id;
    select id into v_savings_acct from public.accounts where user_id = auth.uid() and kind = 'ahorros' limit 1;
    if v_savings_acct is not null and v_save > 0 then
      update public.accounts set balance = balance + v_save where id = v_savings_acct;
    end if;

  elsif p_type = 'gasto' then
    insert into public.transactions (user_id, type, account_id, amount, description, net_amount)
    values (auth.uid(), 'gasto', p_account_id, p_amount, p_description, p_amount)
    returning id into v_id;
    update public.accounts set balance = balance - p_amount where id = p_account_id;

  elsif p_type = 'retiro' then
    if p_to_account_id is null then raise exception 'Falta cuenta destino para retiro'; end if;
    insert into public.transactions (user_id, type, account_id, to_account_id, amount, description, net_amount)
    values (auth.uid(), 'retiro', p_account_id, p_to_account_id, p_amount, p_description, p_amount)
    returning id into v_id;
    update public.accounts set balance = balance - p_amount where id = p_account_id;
    update public.accounts set balance = balance + p_amount where id = p_to_account_id;

  else
    raise exception 'Tipo de transacción no soportado: %', p_type;
  end if;

  return v_id;
end;
$$;

-- ============================================================================
-- VIEW — asistencia_aggregate: % de asistencia por materia (para el 75% real)
-- "no_hubo" no cuenta ni a favor ni en contra (no se dictó la clase).
--    pct = asistidas / (asistidas + faltas) × 100
-- ============================================================================
create or replace view public.attendance_aggregate as
select
  s.user_id,
  s.subject_id,
  sub.name as subject_name,
  count(*) filter (where a.status = 'asisti') as attended,
  count(*) filter (where a.status = 'falta')  as missed,
  count(*) filter (where a.status = 'no_hubo') as cancelled,
  case
    when count(*) filter (where a.status in ('asisti','falta')) = 0 then null
    else round(
      count(*) filter (where a.status = 'asisti')::numeric /
      nullif(count(*) filter (where a.status in ('asisti','falta')), 0) * 100, 1)
  end as attendance_pct
from public.class_sessions s
join public.subjects sub on sub.id = s.subject_id
left join public.attendance a on a.session_id = s.id
group by s.user_id, s.subject_id, sub.name;

grant select on public.attendance_aggregate to authenticated;
