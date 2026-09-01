# KIUBO Catálogos

Producto KIUBO para catálogos digitales, pedidos, seguimiento y operación de proveedores.

## Estructura

- `web/`: snapshot estático/PWA del catálogo, checkout, tracking y panel proveedor.
- `supabase/functions/catalog-api/`: core de negocio compatible.
- `supabase/functions/catalog-router/`: routing multi-tenant, CORS por cuenta y normalización de URLs.
- `supabase/migrations/`: esquema, seguridad y hardening versionados.

## Modelo

Hakuna Matata es el primer catálogo operativo, no una copia del producto. Nuevos clientes se crean como cuentas `catalog_accounts`; pueden funcionar de forma independiente o vincularse a un tenant KIUBO.

Productos, categorías, clientes, pedidos, identidad y disponibilidad viven en Supabase. Cambiar esos datos no reconstruye la aplicación.

## Snapshot 4.2

La configuración canónica apunta a `catalog-router`. El router usa `public_base_url` y `allowed_origins` por cuenta, por lo que un segundo cliente no requiere editar el backend para cambiar dominio o seguimiento.

El deployment vigente de Hakuna puede continuar temporalmente con `catalog-api` 4.1 hasta su siguiente lote visual. Ambos caminos usan el mismo core y la misma base; la transición no exige migración de datos.

## Deploy

El `vercel.json` del producto desactiva deployments automáticos por Git. Un lote aprobado se publica una sola vez. Cambios de contenido del proveedor no consumen Vercel.

## Seguridad

Nunca poner service role, PIN real, contraseña o token de sesión dentro de `web/config.js`, Git o documentación pública. El navegador usa únicamente publishable key; las operaciones privilegiadas viven en Edge Functions/RPCs protegidos.
