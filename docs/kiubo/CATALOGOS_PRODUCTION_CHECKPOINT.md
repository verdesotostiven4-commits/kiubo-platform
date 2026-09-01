# KIUBO Catálogos — Checkpoint de producción

Fecha: 2026-09-01.

## Producción revisada

- Proyecto Vercel actual: `hakuna-matata-catalogo`.
- Catálogo público, panel de proveedor y seguimiento responden en producción.
- `catalog-api` continúa activo como core compatible.
- `catalog-router` v1 está ACTIVE como nueva capa multi-tenant de routing/CORS.
- Bucket `catalog-assets-v4`: lectura pública de imágenes, 5 MB máximo, PNG/JPEG/WebP.
- Hakuna Matata conserva 12 productos y 6 categorías demo mientras se valida la experiencia; no son catálogo definitivo.

## Production Gate 4.2

La base de datos ahora guarda `public_base_url`, `allowed_origins` y vínculo opcional `tenant_id` por cuenta de catálogo. Los platform admins disponen de RPCs protegidos para listar, crear, vincular y cambiar routing sin editar tablas manualmente.

El router valida el origen contra la cuenta, admite previews derivados del hostname configurado, conserva IP de cliente al reenviar al core y reemplaza el enlace de seguimiento de WhatsApp con el dominio propio del catálogo. Esto elimina la necesidad de hardcodear Hakuna para futuros clientes.

El snapshot canónico en `products/catalogos/web/` pasa a versión 4.2 y apunta a `catalog-router`. El deployment actual de Hakuna permanece deliberadamente en 4.1/core hasta el próximo lote visual de branding. Así no se consume un deployment adicional solo para un cambio invisible; el siguiente release de Hakuna incorporará routing 4.2 junto con su identidad final.

## Seguridad validada

- Pedidos recalculan precios en servidor.
- Idempotencia por pedido y rate limit público.
- PIN de proveedor hasheado con bloqueo individual y global.
- Sesiones expiran y son revocables.
- Tablas `catalog_*` no se exponen directamente a `anon`/`authenticated`; la Edge Function opera con service role en servidor.
- Uploads limitados a 5 MB y PNG/JPEG/WebP.
- Routing/CORS se configura por cuenta; no forma parte de los campos editables por el proveedor.

## Operación del proveedor

El proveedor puede administrar productos, fotografías, precios, disponibilidad, categorías, pedidos, clientes, identidad, portada y condiciones desde el panel. Estos son cambios de datos en Supabase y no generan deployments.

## Estado de respaldo

- Frontend: `products/catalogos/web/`.
- Core: `supabase/functions/catalog-api/`.
- Router: `supabase/functions/catalog-router/`.
- Esquema/hardening: migraciones versionadas en `supabase/migrations/`.
- GitHub es la fuente de verdad de código; los datos productivos requieren la política de backup/restore de Supabase descrita en `docs/kiubo/RECOVERY_RUNBOOK.md`.

## Siguiente fase

Branding definitivo de Hakuna Matata: logo, paleta, fotografías, textos, datos reales y revisión final cliente/proveedor. Ese lote será también el momento adecuado para publicar el snapshot 4.2 sin gastar un deployment separado hoy.
