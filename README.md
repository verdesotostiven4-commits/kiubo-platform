# KIUBO Platform

KIUBO es la plataforma tecnológica principal. Este repositorio privado es la fuente de verdad del ecosistema y agrupa productos independientes sin convertirlos en un solo despliegue monolítico.

## Productos

- **KIUBO POS / Control** — aplicación principal Next.js del repositorio (raíz).
- **KIUBO Catálogos** — catálogos digitales B2B/B2C, pedidos, panel de proveedor y seguimiento. Su snapshot de producción está en `products/catalogos/`.
- **KIUBO Sites / Apps / soluciones personalizadas** — espacio de expansión del portafolio; se incorporan como módulos o productos aislados cuando exista un caso real.

Hakuna Matata es el primer tenant/demo operativo de KIUBO Catálogos. El negocio conserva su propia identidad, datos, productos y panel, mientras la tecnología pertenece al producto KIUBO Catálogos.

## Arquitectura actual

La raíz continúa siendo la aplicación Next.js de KIUBO POS/Control. No se hace una migración destructiva a `apps/*` mientras el producto está activo. Los productos nuevos se incorporan de forma aislada y cada proyecto de Vercel puede tener su propio directorio raíz y política de despliegue.

Backend compartido: Supabase con aislamiento por tenant y funciones/migraciones versionadas en `supabase/`. KIUBO Catálogos usa objetos `catalog_*`, el bucket `catalog-assets-v4` y la Edge Function `catalog-api`.

## Desarrollo de la aplicación principal

```bash
npm install
npm run dev
```

Verificación completa:

```bash
npm run verify
```

El `prebuild` ejecuta los guards de seguridad y consistencia existentes antes de construir la aplicación principal.

## Reglas operativas

1. No apuntar desarrollos de KIUBO a bases antiguas o equivocadas.
2. Cambios de código se agrupan y validan antes de publicar.
3. Un lote aprobado debe producir, en condiciones normales, un único deployment de producción por producto.
4. Cambios de contenido del proveedor (productos, fotos, precios, disponibilidad, identidad) ocurren en Supabase y no requieren deployment de Vercel.
5. Nunca guardar claves de servicio, contraseñas, PIN reales o sesiones en Git.

Más detalle: `docs/kiubo/PLATFORM_ARCHITECTURE_2026.md`, `docs/kiubo/DEPLOYMENT_POLICY.md` y `docs/kiubo/CATALOGOS_PRODUCTION_CHECKPOINT.md`.
