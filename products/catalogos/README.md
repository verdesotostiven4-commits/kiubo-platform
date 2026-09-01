# KIUBO Catálogos

Producto de KIUBO para catálogos digitales, pedidos y operación de proveedores.

## Estado

La carpeta `web/` conserva el snapshot recuperable de la versión de producción validada el 1 de septiembre de 2026. Corresponde al demo/tenant Hakuna Matata y contiene catálogo público, panel de proveedor, seguimiento de pedidos, PWA y configuración de despliegue.

El backend está versionado en:

- `supabase/functions/catalog-api/`
- `supabase/migrations/20260901160609_kiubo_catalogos_v4_initial.sql`
- `supabase/migrations/20260901161954_kiubo_catalogos_v4_order_rate_limit.sql`
- `supabase/migrations/20260901162412_kiubo_catalogos_v4_fk_indexes.sql`
- `supabase/migrations/20260901170712_kiubo_catalogos_v4_pin_global_throttle.sql`

## Separación correcta

Hakuna Matata no es una copia independiente del producto. Es un tenant de KIUBO Catálogos. Productos, categorías, clientes, pedidos, identidad y disponibilidad viven en Supabase y cambian sin reconstruir la aplicación.

## Deploy

`web/vercel.json` desactiva deployments automáticos por Git para este producto. La política actual es revisar y agrupar cambios y hacer un deployment manual de producción únicamente cuando el lote esté listo.

Antes de incorporar un segundo tenant público se debe generalizar la lista de orígenes CORS y la URL de seguimiento de WhatsApp que el snapshot v4.1 aún fija a la URL actual de Hakuna Matata. Esto no bloquea la operación actual, pero sí es requisito de escalado multi-tenant.
