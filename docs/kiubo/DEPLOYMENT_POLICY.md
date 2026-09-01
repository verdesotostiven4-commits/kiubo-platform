# KIUBO — Política de commits y deployments

## Objetivo

Proteger cuota de Vercel, mantener historial útil y evitar una secuencia de publicaciones por cambios pequeños.

## Regla principal

**Una solicitud/lote de trabajo → validación completa → un único deployment de producción por producto, cuando sea técnicamente posible.**

No se publica después de cada ajuste visual, texto o línea de código. Se agrupan los cambios, se revisan juntos y recién entonces se publica el checkpoint.

## Git

Los commits deben representar hitos coherentes, no cada microcambio. Crear blobs/trees internos o revisar localmente no equivale a publicar. Cuando sea posible, se prepara un checkpoint atómico y se mueve `main` una sola vez.

## Vercel

KIUBO Catálogos mantiene `git.deploymentEnabled=false` en su `vercel.json` para evitar que cada push del repositorio principal consuma un deployment del catálogo. La publicación del catálogo se realiza manualmente al cerrar un lote aprobado.

La aplicación principal puede conservar su integración Git; si el repositorio se formaliza como monorepo con varios proyectos Vercel, cada proyecto deberá tener Root Directory/Ignore Build Step correctamente configurado para ignorar cambios ajenos.

## Lo que NO requiere deploy

Crear/editar/archivar productos, cargar fotografías, cambiar precio, stock/estado, categorías, textos de portada, logo, color, pedido mínimo, visibilidad de precios o estado abierto/cerrado son cambios de datos en Supabase. Deben reflejarse en el catálogo sin rebuild.

## Emergencias

Un hotfix crítico puede romper la regla de un deployment por lote si evita pérdida de datos, caída de pedidos o una vulnerabilidad. Se documenta el motivo y se vuelve al flujo normal después.
