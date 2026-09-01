# KIUBO Cloud Foundation — estado actualizado

> Documento histórico de la transición local → cloud. El cloud ya está activo en producción. Ver `CURRENT_STATUS.md` para la fuente vigente.

La Foundation introdujo Supabase Auth, RLS multi-tenant, sync por operaciones y cursor, y el contrato Data/Auth Provider. Desde entonces se añadieron transacciones de dominio atómicas para ventas, caja/finanzas, compras, reversos e inventario.

## Arquitectura vigente

- Auth: Supabase.
- Data: Supabase.
- Caché/offline: cliente local + cola sincronizable.
- Aislamiento: tenant + branch + roles/RLS.
- Operaciones críticas: RPCs server-side idempotentes.
- Administración: KIUBO Control + funciones de provisioning protegidas.

## Regla permanente

El sustrato genérico `apply_sync_operations` no debe sustituir una transacción de dominio cuando una operación cambia varias verdades de negocio (por ejemplo venta+stock, compra+stock/costo o cierre de caja). Esos flujos deben continuar usando su RPC atómico dedicado.
