# KIUBO — Commerce / Reporting / Branding v1

## Compras
- Una compra puede contener varias líneas.
- Al recibirla, cada línea incrementa stock y recalcula costo promedio ponderado.
- El documento conserva proveedor, tipo, número, fecha, vencimiento, notas y pago inicial.
- Los documentos repetidos del mismo proveedor se bloquean localmente por número.
- Los saldos quedan como pendiente, parcial o pagado.
- Los abonos a proveedores se registran por separado para no perder trazabilidad.

## Cuentas por pagar
Saldo = total de compra - pagos aplicados. Una fecha de vencimiento anterior a hoy marca el saldo como vencido. En producción, compra + inventario y pago + actualización de saldo deben ejecutarse en transacciones idempotentes del backend.

## Reportes
La interfaz admite rango de fechas y, para owner/admin/KIUBO Admin, consolidado de todas las sucursales. Incluye ventas, ticket promedio, utilidad bruta estimada, compras, cuentas por pagar, cuentas por cobrar, sesiones/movimientos de caja y comparativo por sucursal.

La utilidad mostrada es BRUTA: ingresos menos costo histórico de los productos vendidos. No debe presentarse como utilidad neta contable.

## Branding
Cada tenant tiene nombre visible, logo, color principal, color oscuro, acento y frase de comprobante. KIUBO Control conserva la marca corporativa; las pantallas operativas pueden heredar el branding del tenant activo.

## Pendiente cloud
- Persistir suppliers/purchases/purchase_items/supplier_payments y tenant_branding en backend dedicado.
- Validar RLS con dos tenants y varias sucursales.
- Generar endpoints/RPC transaccionales e idempotentes.
- Añadir almacenamiento seguro del logo con límites de tamaño/formato.
