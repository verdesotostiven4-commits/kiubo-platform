# KIUBO — Checklist de recuperación y pruebas antes de piloto

Este checklist es obligatorio antes de habilitar un negocio externo en producción.

## Ventas / offline
- [ ] Crear una venta sin Internet y confirmar que queda localmente guardada.
- [ ] Cerrar/reabrir la PWA y confirmar que la venta sigue disponible.
- [ ] Volver a Internet y confirmar que la misma `operationId` se procesa una sola vez.
- [ ] Repetir el envío de la misma operación y confirmar idempotencia del backend.
- [ ] Cortar Internet entre venta e inventario remoto y confirmar una sola transacción.
- [ ] Simular respuesta HTTP perdida después de commit servidor; reintentar sin duplicar venta ni stock.

## Inventario / compras
- [ ] Recibir compra multi-item y validar stock final.
- [ ] Validar costo promedio ponderado.
- [ ] Reintentar la misma compra sin duplicar mercadería.
- [ ] Registrar pago parcial y final a proveedor.
- [ ] Confirmar que el saldo no puede quedar negativo.
- [ ] Intentar documento repetido del mismo proveedor y validar bloqueo.

## Caja
- [ ] Abrir caja, vender en efectivo, registrar ingreso/egreso y cerrar.
- [ ] Confirmar efectivo esperado y diferencia contra contado.
- [ ] Probar dos sucursales y verificar que sus cajas nunca se mezclan.

## Multiempresa / RLS
- [ ] Tenant A no puede leer datos de Tenant B.
- [ ] Usuario limitado a Sucursal A no puede operar Sucursal B.
- [ ] Cajero no puede administrar usuarios/branding/configuración fiscal.
- [ ] Inventario no puede emitir facturas ni cobrar ventas.
- [ ] KIUBO Admin usa ruta privilegiada auditada.

## SRI / Factura
- [ ] `npm run verify:sri` pasa.
- [ ] Clave de acceso contiene exactamente 49 dígitos.
- [ ] Secuencial se reserva atómicamente por tenant+sucursal+establecimiento+punto.
- [ ] Una venta no puede originar dos facturas activas.
- [ ] IVA de cada producto está explícitamente verificado.
- [ ] Total fiscal coincide con la venta.
- [ ] XML valida contra XSD oficial vigente.
- [ ] Certificado P12/PFX y contraseña nunca llegan al navegador.
- [ ] Firma XML solo en backend seguro.
- [ ] Probar recepción/autorización/rechazo/timeout/reconsulta en certificación.
- [ ] Guardar XML firmado, autorizado y RIDE privadamente.

## Backups / restauración
- [ ] Exportar backup local y restaurarlo en perfil limpio.
- [ ] Verificar conteos de productos, clientes, ventas, créditos, compras y movimientos.
- [ ] Un restore no debe reenviar como nuevas operaciones ya confirmadas.
- [ ] Crear backup cloud antes de migraciones destructivas.
- [ ] Ensayar restauración a entorno temporal.

## Criterio de salida
El piloto comercial solo inicia cuando pasan los checks críticos de aislamiento, offline/idempotencia, backup/restore y, si Factura está activa, certificación SRI. Barrio MAX no forma parte de estas pruebas.
