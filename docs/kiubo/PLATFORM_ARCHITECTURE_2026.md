# KIUBO — Arquitectura de plataforma 2026

## Principio

**KIUBO es la cabeza del ecosistema.** POS, Catálogos, Control, Sites, Apps y futuros productos pertenecen a KIUBO, pero no deben convertirse en un único programa difícil de mantener.

El repositorio `kiubo-platform` funciona como fuente privada de verdad. La separación se hace por producto, contratos de datos y despliegues, no creando una copia del código por cada cliente.

## Modelo de producto

```text
KIUBO
├─ KIUBO POS / Control       (aplicación principal Next.js)
├─ KIUBO Catálogos          (catálogo + pedidos + proveedor)
│  ├─ tenant: Hakuna Matata
│  └─ futuros tenants
├─ KIUBO Sites              (futuro)
├─ KIUBO Apps               (futuro)
└─ Soluciones personalizadas
```

## Estrategia de repositorio

La aplicación existente de POS/Control permanece en la raíz para evitar una migración destructiva. KIUBO Catálogos se incorpora en `products/catalogos/`. Cuando la escala justifique un monorepo formal con `apps/*` y `packages/*`, la migración se hará como hito propio con pruebas de regresión, no mezclada con trabajo comercial de clientes.

## Estrategia de despliegue

Un repositorio puede alimentar varios proyectos de Vercel. Cada producto puede tener su propio Root Directory, dominio y ciclo de publicación. Por tanto, compartir repositorio no obliga a desplegar POS al publicar Catálogos ni viceversa.

Para KIUBO Catálogos, la fuente se guarda en Git y la publicación se mantiene manual mientras exista una cuota diaria de deployments que conviene proteger.

## Datos

Supabase es la capa operativa. KIUBO Catálogos utiliza tablas y funciones `catalog_*` y una Edge Function dedicada. El `account_id`/`slug` separa tenants. Los proveedores administran contenido en tiempo real desde el panel; esa operación no modifica Git ni dispara Vercel.

## Seguridad

- El navegador solo recibe la clave publicable de Supabase.
- Claves de servicio quedan en variables seguras de la Edge Function.
- Tablas `catalog_*` tienen RLS y no se exponen directamente a `anon`/`authenticated`.
- Pedidos se recalculan en servidor.
- Pedidos tienen idempotencia y rate limit.
- PIN de proveedor se almacena como hash, tiene bloqueo por cliente y límite global por cuenta.
- Sesiones del proveedor son revocables y expiran.

## Escalado pendiente antes del segundo tenant público

El snapshot v4.1 fue construido primero para Hakuna Matata. La Edge Function aún contiene orígenes CORS y URL de seguimiento asociados a ese deployment. Antes de publicar un segundo proveedor se debe parametrizar el dominio/base URL por entorno/tenant y ampliar CORS de forma controlada.
