# KIUBO — Cloud activation checklist

> Estado histórico. La activación cloud descrita originalmente aquí ya fue completada. Para el estado vigente ver `CURRENT_STATUS.md` y `PRODUCTION_GATE_2026_09_01.md`.

## Activado

- Supabase Auth real.
- Data Provider Supabase real.
- Multiempresa/sucursales/roles con RLS.
- Provisioning de tenants y propietarios.
- Sync cloud por revisión + idempotencia.
- RPCs atómicos para ventas, reversos, caja/finanzas, compras y ajustes de inventario.
- Health de producción.

## Regla que sigue vigente

`SUPABASE_SERVICE_ROLE_KEY` y cualquier clave secreta existen únicamente en backend/Edge Functions. El navegador usa URL + publishable key. No guardar secretos en `NEXT_PUBLIC_*`, localStorage, GitHub, documentación de cliente o chats.

## Validación continua

Antes de un release importante: probar login, aislamiento tenant/branch, operación crítica afectada, offline/reconexión cuando aplique, health y logs. El checklist completo de entrega vive en `CLIENT_DELIVERY_STANDARD.md`.
