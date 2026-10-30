# Hakuna: entrega y devolución de pedidos

Esta tanda cambia inventario, pagos, pedidos y avisos. Las pruebas de desarrollo usan datos sintéticos; todavía hay que validar el conjunto en un entorno aislado y revisar un preview antes de llevarlo al negocio.

## Comportamiento

- El inventario físico se descuenta al entregar. Los pedidos abiertos reservan cantidades de la misma unidad base, también cuando usan jabas u otras presentaciones.
- La edición de un pedido nuevo actualiza las reservas. Una devolución posterior a la entrega recupera solo las unidades devueltas; la cancelación recupera lo que todavía está entregado.
- Para Hakuna, el recorrido es recibido → confirmado → entregado. Un pedido antiguo en preparación o despachado también puede pasar directamente a entregado. Los demás catálogos mantienen sus transiciones originales.
- El alta o edición de producto, sus presentaciones y stock se guardan en una sola transacción; un reintento desde el mismo formulario usa la misma operación. Al editar se compara el stock que se vio al abrir el formulario con el actual: un conflicto cancela todos los cambios de ese guardado y pide revisar. Las fotos que se guardan automáticamente son operaciones independientes y podrían haberse guardado antes.
- Los clientes antiguos deben actualizar la aplicación antes de guardar un producto. Para cuentas con inventario al entregar, las rutas antiguas `save_stock` y `save_presentations` responden `client_update_required` (409) sin escribir; solo se permite guardar mediante el RPC transaccional `save_product`. Comprobar esta compatibilidad y la actualización PWA 10.20.0 antes de publicar.
- Al subir una foto nueva no se elimina la anterior antes de guardar su asociación. Por seguridad, quedan archivos antiguos sin limpieza automática; revisar ocupación de almacenamiento y planificar una limpieza que primero verifique referencias y respaldo. Una foto distinta para cada presentación requiere guardar primero el producto y la presentación.
- Si ya se había registrado un pago, el reintegro que corresponda queda pendiente de coordinar: la aplicación no hace transferencias. Después de devolver el dinero, Mayra puede registrar el importe manualmente. Mientras haya un reintegro pendiente, el pedido cancelado no se puede reabrir; al reabrir uno reintegrado, el pago queda pendiente.
- Los avisos dependen de permisos del navegador, de una suscripción válida y del servicio de notificaciones. Deben comprobarse en los dispositivos reales después de desplegar; no se puede obligar al cliente a conceder permiso.
- Las notificaciones pendientes esperan cada vez más entre reintentos cuando no hay suscriptores y dejan de intentarse al cumplir 24 horas. Una suscripción nueva despierta los avisos pendientes; comprobar el comportamiento real y el costo del worker antes de activarlo.

## Previsualización

La vista aislada se genera con `node scripts/build-hakuna-safe-preview.mjs <directorio-nuevo>`; usa datos ficticios en el navegador, PIN de prueba `1234` y no envía avisos reales. Verificar cliente y panel móvil: catálogo, presentaciones, carrito, crédito, mapa y dirección escrita, seguimiento, cambios, devoluciones y restauración de existencias. Esta vista no verifica las funciones ni la base reales: debe complementarse con una prueba de integración en un entorno aislado. Una vista que solo cambie el frontend mientras siga conectado al backend anterior no valida este ciclo.

El mapa gris reportado en PC motivó una observación de tamaño del lienzo, comprobación de la hoja de estilos y un botón para cambiar al mapa alternativo. Las pruebas automáticas usan mapas simulados; todavía hace falta comprobar el mapa visualmente en PC y móvil con red real. La vista sintética no implementa el guardado completo de productos/fotos, por lo que esa prueba necesita un backend aislado compatible.

## Preparación para producción, después de aprobar el preview

1. Confirmar proyecto, dominio y versión activa. Hacer una copia verificable de las tablas de catálogo, pedidos, movimientos, existencias y suscripciones en almacenamiento protegido.
2. Revisar pedidos abiertos y actividad reciente de inventario. La primera migración detiene la conversión si hubo ajustes manuales posteriores a pedidos ya descontados; en ese caso se investigan las diferencias antes de continuar, sin inventar cantidades.
3. Aplicar las dos migraciones de `20261030` y desplegar las funciones `catalog-notify` y `catalog-api` como una única tanda coordinada. La función pública `catalog-notify` requiere verificación JWT de plataforma desactivada para la suscripción; el envío interno valida su propia credencial. Mantener compatibilidad con clientes anteriores durante la actualización.
4. Si el proyecto admite `pg_cron`, `pg_net` y Vault, preparar `supabase/manual/hakuna_notification_scheduler.sql` y configurar el worker con la URL del proyecto correspondiente. Este paso permite reintentos en segundo plano y no se instala automáticamente. Si no se configura, los cambios de pedido intentan enviar avisos al momento, pero los reintentos dependen de actividad posterior.
5. Verificar físicamente con Mayra: activar avisos en su dispositivo, crear un pedido de prueba acordado, confirmar sin descontar stock, entregar una vez, registrar una devolución parcial y revisar el seguimiento y las notificaciones. No usar productos ni pedidos reales sin coordinación.
6. Revisar logs y comparar las existencias y reservas con la copia inicial. Si algo falla, detener la entrega y analizar los movimientos antes de revertir: reinstalar código antiguo por sí solo no revierte las transacciones ni la conversión de inventario.
