# KIUBO — Cloud activation checklist

## Estado
El código puede seguir en modo local mientras se prepara Supabase. Activar cloud solo después de aplicar migraciones y crear el primer administrador.

## Orden de activación
1. Aplicar `0001_core_multitenant.sql`.
2. Aplicar `0002_sync_substrate.sql`.
3. Aplicar `0003_platform_provisioning.sql`.
4. Ejecutar Security Advisor y corregir cualquier hallazgo crítico.
5. Crear una sola cuenta Auth inicial para el operador KIUBO.
6. Añadir ese `user_id` a `platform_admins` mediante una migración/operación administrativa auditada.
7. Desplegar Edge Functions `provision-tenant` y `provision-member` con JWT obligatorio.
8. Configurar `KIUBO_APP_URL` en las funciones con la URL oficial del app.
9. Configurar Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_KIUBO_AUTH_MODE=supabase`, `NEXT_PUBLIC_KIUBO_DATA_MODE=supabase`.
10. Probar login del administrador, alta de un tenant de prueba, invitación del owner y acceso desde otro navegador/dispositivo.
11. Probar RLS: Tenant A jamás puede leer Tenant B; usuario limitado a una sucursal no puede leer otra.
12. Probar venta offline → reconexión → mismo `operationId` procesado una sola vez.
13. Solo después de esas pruebas habilitar un piloto externo.

## Secretos
- `SUPABASE_SERVICE_ROLE_KEY` solo existe en Edge Functions/backend; nunca en Vercel `NEXT_PUBLIC_*`, navegador, localStorage, GitHub ni chat.
- El navegador usa exclusivamente URL + publishable key.
- Las invitaciones a owners/empleados pasan por funciones protegidas y permisos de plataforma/tenant.

## Primer administrador
La creación del primer Auth user es el único bootstrap manual deliberado. Después, el administrador KIUBO puede aprovisionar negocios y usuarios sin conocer ni almacenar contraseñas: Supabase envía invitaciones y cada persona define su acceso.
