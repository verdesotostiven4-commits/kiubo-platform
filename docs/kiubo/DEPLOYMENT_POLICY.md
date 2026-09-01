# KIUBO — Política de commits y deployments

## Objetivo

Proteger cuota de Vercel, mantener un historial útil y evitar una secuencia de publicaciones por microcambios.

## Regla principal

**Una solicitud/lote de trabajo → validación completa → un único deployment de producción por producto, cuando sea técnicamente posible.**

No se publica después de cada ajuste visual, texto o línea. Se agrupan los cambios, se revisan juntos y recién entonces se mueve producción.

## Git

Los commits representan hitos coherentes. Crear blobs/trees, trabajar en una rama con deploys desactivados o preparar una migración no equivale a publicar. Cuando el lote está listo se crea un checkpoint atómico y se actualiza `main` una sola vez.

## KIUBO Platform en Vercel

`main` es la única rama con Git deployment habilitado. Además, `vercel.json` usa `ignoreCommand` para saltar el build de la aplicación principal cuando el commit solo contiene cambios en:

- `products/catalogos/**`
- `supabase/**`
- `docs/**`

Así un cambio de Edge Function, SQL, documentación o snapshot de Catálogos no consume un deployment de KIUBO POS / Control.

## KIUBO Catálogos

El snapshot de Catálogos mantiene `git.deploymentEnabled=false` en su configuración propia. Su publicación es deliberada: se hace cuando el lote visual/funcional está aprobado. Hakuna Matata no se redeploya por cada cambio de backend o por subir datos.

Crear/editar/archivar productos, cargar fotografías, cambiar precios, disponibilidad, categorías, textos, logo, pedido mínimo, visibilidad de precios o estado abierto/cerrado son operaciones de Supabase y **no requieren deployment**.

## Backend

Migraciones de Supabase y Edge Functions se aplican como cambios versionados y auditables, pero no deben forzar un rebuild de la UI si ésta no cambió. El código desplegado en Supabase debe quedar reflejado en el mismo checkpoint de GitHub.

## Hotfix

Un hotfix crítico puede romper la regla de un deployment por lote si evita pérdida de datos, caída de pedidos, corrupción de stock/caja o una vulnerabilidad. Se documenta el motivo y después se vuelve al flujo normal.

## Antes de publicar

- Guards/typecheck/build cuando aplique.
- Health check.
- Revisión de logs/runtime errors.
- Verificación del flujo afectado.
- Confirmar que el commit no contiene secretos.
- Confirmar que el cambio realmente requiere deployment y no era solo un cambio de datos.
