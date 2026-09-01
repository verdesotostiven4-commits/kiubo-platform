# KIUBO Catálogos — Checkpoint de producción

Fecha del checkpoint: 2026-09-01.

## Producción revisada

- Proyecto Vercel: `hakuna-matata-catalogo`.
- Catálogo público, panel de proveedor y seguimiento responden en producción.
- Edge Function `catalog-api` activa.
- Migraciones `kiubo_catalogos_v4_*` presentes en Supabase.
- Bucket `catalog-assets-v4`: público para lectura de imágenes, 5 MB máximo, PNG/JPEG/WebP.
- Demo Hakuna Matata con 12 productos y 6 categorías al momento del checkpoint; son datos de prueba y no constituyen catálogo definitivo.

## Pruebas efectuadas

Se verificó carga pública, código desplegado, configuración, panel, API y logs. Se validó el PIN contra el hash sin guardar el PIN en Git. Se ejecutó una creación de pedido dentro de una transacción con `ROLLBACK`; el flujo de servidor pasó y no dejó pedidos de prueba persistidos. Se confirmó que el cálculo de precios se realiza con productos del servidor y que existe idempotencia.

También se revisaron RLS/permisos de objetos `catalog_*`, rate limit de pedidos, sesiones de proveedor, almacenamiento de imágenes y protección de intentos de PIN. El 2026-09-01 se añadió un throttle global por cuenta además del bloqueo por cliente.

## Operación del proveedor

El proveedor puede administrar productos, imágenes, disponibilidad, categorías, pedidos, clientes, identidad, textos y ajustes desde el panel. Esos cambios son datos y no consumen deployments de Vercel. El catálogo refresca datos periódicamente y el panel consulta pedidos nuevos de forma automática.

## Estado de respaldo

El frontend desplegado se conserva en `products/catalogos/web/`; la Edge Function en `supabase/functions/catalog-api/`; y las cuatro migraciones de producción en `supabase/migrations/`. Este checkpoint permite reconstruir el producto sin depender únicamente del artefacto alojado en Vercel.

## Pendientes deliberados

Branding definitivo de Hakuna Matata, logo, fotografías y catálogo real pertenecen a la siguiente fase comercial. Antes de un segundo tenant público se debe convertir el origen CORS y la URL de seguimiento hardcodeados en configuración multi-tenant.
