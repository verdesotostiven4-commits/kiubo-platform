-- ============================================================================
-- Reset parcial del esquema Harmony OS.
-- Úsalo solo si la primera ejecución de schema.sql falló a medio camino
-- y quedaron tablas incompletas (por ejemplo, falta la columna user_id).
--
-- ⚠️ ATENCIÓN: esto borra TODAS las tablas del esquema. Si ya tienes datos,
--    NO ejecutes esto; avísame y arreglamos solo lo que falta.
-- ============================================================================

drop view if exists public.attendance_aggregate cascade;

drop table if exists public.exam_grades cascade;
drop table if exists public.debts cascade;
drop table if exists public.transactions cascade;
drop table if exists public.accounts cascade;
drop table if exists public.extra_expenses cascade;
drop table if exists public.pantry_category_expenses cascade;
drop table if exists public.shopping_items cascade;
drop table if exists public.pantry_budgets cascade;
drop table if exists public.workout_logs cascade;
drop table if exists public.water_logs cascade;
drop table if exists public.tasks cascade;
drop table if exists public.practice_logs cascade;
drop table if exists public.attendance cascade;
drop table if exists public.class_sessions cascade;
drop table if exists public.subjects cascade;
drop table if exists public.profiles cascade;
