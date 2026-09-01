# KIUBO — Recovery Runbook

## Objetivo

Recuperar servicio sin improvisar ni destruir datos. Primero se identifica qué capa falló: código, deployment, Edge Function, base de datos, configuración o datos del cliente.

## 1. Incidente de frontend / deployment

1. No tocar Supabase si el problema es únicamente visual o de build.
2. Revisar el último commit y logs de Vercel.
3. Si el release actual está roto, volver al último deployment READY conocido o revertir el commit como checkpoint controlado.
4. Confirmar `/api/health` antes de reabrir el flujo normal.
5. Registrar causa y corrección; no encadenar microdeployments durante el incidente.

## 2. Incidente de Edge Function

1. Verificar estado y logs de la función afectada.
2. Comparar versión desplegada con `supabase/functions/` en Git.
3. Redeploy de la última versión conocida solamente si el problema está en código de Edge.
4. Para Catálogos, `catalog-api` es el core compatible y `catalog-router` es la capa de routing/CORS por cuenta. Un fallo del router no autoriza a exponer service role en el navegador.

## 3. Incidente de migración / esquema

1. Detener nuevos cambios de esquema.
2. Consultar `supabase_migrations` y el estado real de funciones/tablas antes de aplicar cualquier SQL.
3. No reaplicar a ciegas las migraciones históricas 0001–0021: parte del cloud original fue activado antes de que el tracking quedara completo.
4. Usar migraciones aditivas/idempotentes para corregir drift.
5. Validar funciones críticas y permisos después del cambio.

## 4. Incidente de datos

1. No borrar registros para “arreglar” inconsistencias.
2. Preservar IDs, `operationId`, `sync_receipts` y auditoría: son la defensa contra duplicados.
3. Determinar tenant y branch afectados antes de cualquier corrección.
4. Si hace falta restauración de datos, usar las capacidades de backup/PITR disponibles en el plan de Supabase y probar la restauración en un entorno separado antes de reemplazar producción.
5. Si el plan no incluye el nivel de recuperación requerido por el SLA comercial, subir el plan o implementar exportación externa antes de prometer ese SLA.

## 5. Catálogos

El contenido operativo vive en tablas `catalog_*` y las imágenes en `catalog-assets-v4`. Git contiene código/migraciones, no sustituye un backup de datos de clientes.

Antes de recuperar un catálogo se verifica: `catalog_accounts`, categorías, productos, pedidos, order items, clientes, sesiones, actividad y objetos del bucket. Nunca se restaura un PIN en texto plano; se establece uno nuevo mediante el flujo seguro si fuese necesario.

## 6. Validación posterior

- `/api/health` = 200.
- Vercel sin runtime errors críticos.
- Edge Functions requeridas = ACTIVE.
- Funciones transaccionales críticas existen y `anon` no puede ejecutarlas.
- Login en dispositivo nuevo.
- Venta/stock/caja o pedido de prueba según el producto afectado.
- No quedaron registros de prueba persistidos si la prueba fue técnica.

## Regla de secretos

Nunca pegar service roles, contraseñas, PIN, tokens de sesión o claves privadas en Git, documentación entregable, logs públicos o mensajes a clientes.
