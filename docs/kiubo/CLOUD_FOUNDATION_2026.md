# KIUBO Cloud Foundation — 2026-08-20

## Estado
La aplicación pública continúa en modo local por defecto. La rama `cloud-foundation-v1` introduce el adaptador real para Supabase sin activar cloud en producción hasta completar migraciones, usuarios de prueba y validaciones RLS.

## Variables
- `NEXT_PUBLIC_KIUBO_AUTH_MODE=supabase`
- `NEXT_PUBLIC_KIUBO_DATA_MODE=supabase`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Nunca colocar `service_role` en una variable `NEXT_PUBLIC_*` ni en el navegador.

## Auth
Cloud usa Supabase Auth email+contraseña. Al iniciar sesión se resuelve membresía, tenant, sucursal, suscripción y rol; luego se hidrata el cache local para conservar la UI/offline existente.

## Aislamiento
RLS se apoya en `tenant_members`, `tenant_member_branches`, `has_tenant_access`, `has_tenant_role` y `has_branch_access`. `platform_admins` no tiene lectura directa para usuarios normales; se consulta mediante función controlada.

## Sync
El primer sustrato cloud usa `sync_entities` + `sync_receipts`. `apply_sync_operations` aplica cada `operationId` una sola vez y `pull_sync_changes` devuelve cambios incrementales por cursor. Esto permite probar continuidad entre dispositivos sin exponer una service role.

## Límite consciente
Este sustrato NO reemplaza las transacciones de dominio finales. Antes del piloto, venta+stock, compra+stock/costo, caja y facturación deben pasar por RPC/handlers transaccionales específicos para evitar conflictos entre dispositivos concurrentes.

## Orden de activación
1. aplicar migraciones 0001 y 0002 en Supabase KIUBO vacío;
2. crear usuario técnico de prueba mediante Auth;
3. bootstrap tenant de prueba;
4. ejecutar pruebas RLS tenant A/B;
5. configurar publishable URL/key en Preview Vercel, no Production todavía;
6. probar login y sync desde dos navegadores;
7. construir transacciones de dominio;
8. recién entonces activar cloud en producción/piloto.
