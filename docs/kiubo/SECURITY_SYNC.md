# KIUBO — Security & Sync Foundation

> Diseño de desarrollo. No aplicar sobre Barrio MAX ni tratar el PIN/localStorage como seguridad de producción.

## Objetivo
KIUBO debe poder vender aun sin internet y sincronizar al volver la conexión sin duplicar operaciones ni mezclar negocios/sucursales.

## Flujo local
1. La acción se confirma localmente primero.
2. `saveLocalDatabase` detecta cambios y crea operaciones en `syncQueue`.
3. Cada operación recibe `operationId` estable.
4. Se registra auditoría local con usuario, tenant, sucursal y dispositivo.
5. La UI sigue funcionando aunque backend o internet no estén disponibles.

## Flujo cloud futuro
1. `SyncStatus` detecta conexión.
2. `runSyncCycle` envía lotes mediante `KiuboDataProvider`.
3. Backend procesa cada `operationId` una sola vez y transaccionalmente.
4. Solo después de confirmación pasa a `synced`.
5. No se aplica pull remoto encima de cambios locales sin confirmar.
6. Con cola limpia se descargan cambios desde cursor incremental.

## Idempotencia
`SCHEMA_V2_SECURITY_SYNC.sql` prepara `sync_receipts` y `client_operation_id`. Receipt + mutación de dominio deben estar en la misma transacción.

## Seguridad cloud
- Auth real;
- RLS tenant-scoped;
- `tenant_members` y `tenant_member_branches`;
- `platform_admins` separado;
- funciones security definer pequeñas con `search_path` fijo;
- auditoría append-only desde backend confiable;
- secretos SRI fuera del navegador;
- service role jamás en `NEXT_PUBLIC_*`.

## Autenticación local actual
El PIN sirve solo para validar UX/roles/sesiones durante Foundation. La UI consume `KiuboAuthProvider` para poder sustituirlo por Auth cloud.

## Conflictos y recuperación
Foundation no aplica pull remoto mientras haya cambios locales pendientes/fallidos. El backup local incluye cola/auditoría; un restore no debe reenviarse automáticamente a cloud.

## Pendiente al obtener backend independiente
1. `SupabaseDataProvider`.
2. `SupabaseAuthProvider`.
3. aplicar schemas en proyecto vacío dedicado a KIUBO;
4. handlers transaccionales;
5. pruebas de corte de internet;
6. pruebas RLS entre tenants/sucursales;
7. revocación/recuperación de sesiones.
