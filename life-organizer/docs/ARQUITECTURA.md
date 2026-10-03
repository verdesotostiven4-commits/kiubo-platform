# Arquitectura — Harmony OS / Planificador ESPOCH

> Documento de revisión. **No escribe código todavía** — se aprueba o se mueve antes de pasar a la Fase 1.
> Stack real verificado: Next.js 16.3.8 · React 19.2.8 · Tailwind v4 · Framer Motion 13 · Supabase JS 2.

---

## 1. Estado actual del proyecto

| Pieza | Estado |
|---|---|
| Scaffold Next.js 16 (App Router) | ✅ Limpio y moderno |
| Tailwind v4, Framer Motion, lucide, clsx, tailwind-merge | ✅ Instalados |
| `@supabase/supabase-js` | ✅ Instalado |
| `.env.local` (URL + anon key) | ✅ Correcto, gitignored |
| `src/app/supabase.ts` | ✅ Cliente mínimo correcto |
| `src/app/page.tsx` | ❌ Es el código de Gemini (1.463 líneas, `PlannerMaster`) — **se reemplaza** |
| `@supabase/ssr` (auth con cookies) | ❌ Falta — **se agrega** |
| UI primitives custom (Select, Modal, DatePicker) | ❌ Falta — **se construyen** |

> ⚠️ `AGENTS.md` (generado por Next 16) advierte de **breaking changes** en Next.js 16. Antes de escribir código Next-específico (layouts, route handlers, middleware, async params) se consultará `node_modules/next/dist/docs/`.

---

## 2. Principios de diseño

1. **Estructura feature-based**: cada módulo es autosuficiente (vista + subcomponentes + hook + queries + tipos). No se mezcla lógica de finanzas con la de hábitos.
2. **Persistencia real desde el día 1**: todo en Supabase con RLS. Cero `useState` decorativo. Si refrescas, no se pierde nada.
3. **Tipos de verdad**: interfaces TypeScript generados desde el esquema. Cero `any[]`.
4. **El 75% es real**: se calcula desde la tabla `attendance` (vía la vista `attendance_aggregate`), no hardcodeado.
5. **Sin UI nativa prohibida**: se construyen `Modal` (reemplaza `prompt()`), `Select` (reemplaza `<select>`), `DatePicker` (reemplaza `<input type="date">`).
6. **Single source of truth del horario ESPOCH**: la plantilla oficial vive en `class_sessions` (sembrada por RPC), y `attendance` la referencia por `session_id` + `session_date`.
7. **Integridad financiera atómica**: registrar un ingreso/gasto/retiro actualiza saldos en una sola operación vía el RPC `record_transaction` (no dos updates sueltos que pueden fallar a la mitad).

---

## 3. Estructura de carpetas

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts          # callback OAuth Supabase
│   ├── (app)/                         # rutas protegidas (auth-gated)
│   │   ├── layout.tsx                 # shell con sidebar
│   │   ├── page.tsx                   # dashboard → redirige a /schedule
│   │   ├── schedule/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── habits/page.tsx
│   │   ├── pantry/page.tsx
│   │   ├── finance/page.tsx
│   │   ├── templates/page.tsx
│   │   └── stats/page.tsx
│   ├── layout.tsx                     # root: fuentes + providers
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # cliente browser (env)
│   │   ├── server.ts                  # cliente server (cookies, @supabase/ssr)
│   │   └── middleware.ts             # refresco de sesión
│   ├── utils.ts                       # cn() = clsx + tailwind-merge
│   └── dates.ts                       # ISO, semana real, rango semestre ESPOCH
├── middleware.ts                       # session refresh global
├── types/
│   ├── database.ts                    # tipos generados desde schema (supabase gen)
│   └── domain.ts                      # enums: Priority, DayOfWeek, MuscleGroup, etc.
├── config/
│   ├── espoch.ts                      # materias + horario oficial (constante tipada)
│   └── finance.ts                     # cuentas + categorías de ingreso
├── components/
│   ├── ui/                            # primitives reutilizables
│   │   ├── Modal.tsx                  # ← reemplaza prompt()
│   │   ├── Select.tsx                 # ← reemplaza <select>
│   │   ├── DatePicker.tsx             # ← reemplaza <input type="date">
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── ProgressBar.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   └── shared/
│       ├── PriorityBadge.tsx
│       └── ConfettiButton.tsx
└── features/                          # módulos autosuficientes
    ├── schedule/   { ScheduleView, AttendanceControls, PracticeLogger, useAttendance, queries }
    ├── tasks/      { TasksView, TaskForm, TaskItem, useTasks, queries }
    ├── habits/     { HabitsView, WaterTracker, WorkoutLogger, useHabits, queries }
    ├── pantry/     { PantryView, ShoppingList, CategoryExpenses, ExtraExpenses, usePantry, queries }
    ├── finance/    { FinanceView, AccountsGrid, TransactionForm, IncomeHistory, DebtsList, useFinance, queries }
    ├── templates/  { TemplatesView }
    └── stats/      { StatsView, KpiCards, AttendanceChart, GradesTracker }
```

**Convención por módulo** (ej. `features/schedule/`):
- `queries.ts` — funciones que hablan con Supabase (select/insert/update).
- `use<Modulo>.ts` — hook React que carga datos, expone acciones y estado de carga.
- `*.tsx` — componentes de UI que consumen el hook.

---

## 4. Esquema de tablas

Archivo ejecutable: **`supabase/schema.sql`** (pegar en Supabase → SQL Editor → Run).

16 tablas + 2 RPC + 1 vista + 1 trigger + RLS completo.

| # | Tabla | Qué guarda | Llave |
|---|---|---|---|
| 1 | `profiles` | Datos de la persona (extiende auth.users) | `id = auth.users.id` |
| 2 | `subjects` | Materias ESPOCH (sembradas por RPC) | `user_id + name` |
| 3 | `class_sessions` | Horario semanal recurrente (plantilla oficial) | `user_id + day + start_time` |
| 4 | `attendance` | Asistencia real por sesión + fecha → **alimenta el 75%** | `user_id + session_id + date` |
| 5 | `practice_logs` | Lunes: prácticas autónomas / campo | — |
| 6 | `tasks` | Tareas Likert 1-5 (estudio/personal/deseos) | — |
| 7 | `water_logs` | Vasos de agua por fecha (0-8) | `user_id + log_date` |
| 8 | `workout_logs` | Gimnasio (grupo muscular, minutos, nota) | — |
| 9 | `pantry_budgets` | Presupuesto + nº semanas (activo) | — |
| 10 | `shopping_items` | Lista de compras por categoría | — |
| 11 | `pantry_category_expenses` | Gasto acumulado por categoría | `user+budget+cat` |
| 12 | `extra_expenses` | Gastos extra / tienda del vecino | — |
| 13 | `accounts` | 4 cuentas (Pichincha, Pacífico, Efectivo, Bóveda) | `user_id + name` |
| 14 | `transactions` | Ingreso/gasto/retiro con detalle de ahorro | — |
| 15 | `debts` | Deudas (debo / me deben) | — |
| 16 | `exam_grades` | Calificaciones /10 | — |

**RLS**: todas las tablas con `user_id` → política `using (user_id = auth.uid())`. Cada persona ve solo sus filas.

---

## 5. El 75% de asistencia (de verdad)

La vista **`attendance_aggregate`** calcula por materia:

```
attendance_pct = asistidas / (asistidas + faltas) × 100
```

- `no_hubo` (no se dictó clase) **no cuenta** ni a favor ni en contra — es justo, no deberías ser penada porque el profe tuvo conferencia.
- El semáforo pinta rojo si `attendance_pct < 75`.
- Los datos vienen de la tabla `attendance` real, no de un array hardcodeado.

---

## 6. Modelo de finanzas (atómico)

Registrar un ingreso hace **tres cosas a la vez**: insertar la transacción, sumar el neto a la cuenta y sumar el ahorro a la Bóveda. Si se hicieran por separado y algo fallara a la mitad, los saldos se descuadrarían. Por eso existe el RPC:

```
select record_transaction(
  'ingreso', $account_id, null, $monto,
  'Fotografía & Video', null,
  'Sesión de fotos Ambato - Sebastián', 20
);
```

El RPC corre en una sola transacción de Postgres: o todo entra, o nada entra. Lo mismo para `gasto` (resta) y `retiro` (resta banco + suma efectivo).

**Saldos**: `accounts.balance` es la fuente cacheada, actualizada por el RPC. El histórico completo de movimientos está en `transactions` (auditable).

---

## 7. UI primitives (cumplir "no nativo")

Se construyen a mano con Tailwind + Framer Motion (sin dependencias pesadas):

- **`Modal`**: overlay con backdrop blur, animación de entrada/salida, foco trapped, `Esc` cierra. Reemplaza los 3 usos de `prompt()` del código de Gemini.
- **`Select`**: botón que abre lista custom, keyboard navigable, estilo editorial. Reemplaza todos los `<select>`.
- **`DatePicker`**: popover con grilla mensual (reutiliza la lógica del calendario). Reemplaza los `<input type="date">`.

Accesibilidad mínima: roles ARIA, foco visible, `Esc` cierra overlays. Si más adelante se quiere robustez total, se puede migrar a Radix UI (compatible con React 19).

---

## 8. Dependencias a agregar

| Paquete | Para qué |
|---|---|
| `@supabase/ssr` | Auth con cookies (server + middleware). Imprescindible para rutas protegidas y SSR real. |

Eso es todo. UI primitives van a mano. No se agrega Headless UI ni Radix por ahora (mantenemos el bundle liviano).

---

## 9. Fases de implementación

| Fase | Qué se entrega | Módulos |
|---|---|---|
| **0** | Fundaciones | `@supabase/ssr`, `lib/supabase/{client,server,middleware}`, `middleware.ts`, tipos `database.ts`, `utils.ts`, UI primitives (Modal/Select/DatePicker) |
| **1** | Auth + horario | `(auth)/login`, `seed_initial_data()` al registrarse, `features/schedule` (vista + asistencia con 75% real + prácticas del lunes) |
| **2** | Tareas + calendario | `features/tasks` (Likert 1-5, categorías) + `features` calendar con navegación de meses (todo el semestre) |
| **3** | Hábitos | `features/habits` (agua por fecha + gimnasio) — bug del side-effect corregido: la fecha del ejercicio no muta el día global |
| **4** | Finanzas | `features/finance` con `record_transaction` atómico, historial, deudas |
| **5** | Despensa | `features/pantry` (presupuesto, lista, gastos por categoría, extras) |
| **6** | Plantillas + Stats | `features/templates` + `features/stats` (KPIs, gráfica de asistencia real, calificaciones) |
| **7** | Pulido PWA | manifest, service worker, offline, metadata, favicon |

---

## 10. Decisiones que necesito que confirmes

1. **Auth single-user en v1** (RLS por `user_id`): la app vive bajo la cuenta de Mónica. El aspecto "pareja" se modela como cuentas compartidas + ingresos con `main_category` (la fotografía/video viene del trabajo de la pareja). Si quieres **multi-usuario real** (Mónica + pareja con login separado y `household` compartido), dímelo ahora — el esquema cambia.

2. **¿Ejecuto `supabase/schema.sql` por ti o lo pegas tú en el SQL Editor?** Por seguridad, Supabase no permite crear tablas con la anon key desde el cliente; lo ideal es que lo corras tú en el Dashboard. Confirmame y te guío.

3. **Login method**: ¿email+contraseña, magic link, o Google OAuth? Supabase soporta los tres. Para una app personal, magic link suele ser lo más simple.

4. **Lenguaje/huso**: fechas en ISO `YYYY-MM-DD`, zona horaria de Ecuador (America/Guayaquil, UTC-5). ¿Confirmado?

---

*Aprobado el plano → arrancamos Fase 0.*
