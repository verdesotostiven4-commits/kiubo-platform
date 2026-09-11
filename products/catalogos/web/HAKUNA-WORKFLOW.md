# HAKUNA MATATA — WORKFLOW DE ENTREGA

Objetivo: trabajar por lotes completos y evitar quemar el límite de Vercel con micro-deploys.

## Regla principal

- Una tanda de cambios = un commit consolidado = un preview.
- No mover una rama remota por cada ajuste pequeño.
- Preparar primero el árbol/commit completo y publicar la rama solo cuando la tanda esté lista para revisión.
- El usuario revisa un único preview y reporta diferencias visuales/funcionales en conjunto.
- Los ajustes de esa revisión se agrupan en una segunda tanda, no en micro-parches.
- Producción solo se actualiza cuando el preview de la tanda está aprobado.

## Checklist antes de publicar una tanda

1. Inicio y Catálogo en móvil.
2. Búsqueda, filtros, marcas y navegación.
3. Producto simple y multipresentación.
4. Fotos por presentación.
5. Favoritos y carrito.
6. Checkout y Mis pedidos.
7. Panel: Productos, Pedidos y Clientes.
8. Búsquedas del panel: escribir, limpiar con X, Escape y volver al listado completo.
9. Supabase: sin datos huérfanos, negativos, duplicados o agregados de cliente inconsistentes.
10. PWA/Service Worker y caché versionados.

## Regla de estabilidad

No declarar una incidencia como resuelta solo porque desapareció el síntoma puntual. Revisar el flujo completo relacionado y sus estados vacíos, recarga, navegación, móvil y persistencia de datos.
