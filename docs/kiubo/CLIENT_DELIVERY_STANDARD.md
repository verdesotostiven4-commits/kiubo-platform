# KIUBO — Estándar de entrega a clientes

## Principio

KIUBO se entrega como servicio administrado. El cliente debe poder operar su negocio sin depender de soporte para tareas normales, pero no necesita ni debe recibir acceso a la infraestructura privada de la plataforma.

## Lo que recibe el cliente

1. URL oficial de su producto KIUBO y, si aplica, URL pública del catálogo.
2. Cuenta del propietario y mecanismo seguro para definir/recuperar su acceso.
3. Sucursales y usuarios configurados según el plan contratado.
4. Productos/datos importados según el alcance acordado.
5. Métodos de pago, caja, inventario y ajustes operativos configurados.
6. Branding contratado: logo, colores y datos comerciales cuando aplique.
7. Catálogo/pedidos configurados si ese producto forma parte del servicio.
8. Capacitación breve orientada a tareas reales: abrir, vender, corregir, cerrar, revisar y pedir soporte.
9. Checklist de go-live y canal de soporte.
10. Política de respaldo/continuidad y condiciones del servicio.

## Lo que NO se entrega por defecto

- Repositorio GitHub de KIUBO.
- Service role de Supabase, claves privadas, hashes, tokens o secretos.
- Acceso de administrador a Vercel/Supabase de la plataforma.
- Credenciales internas de KIUBO Control.
- Código fuente, salvo contrato Custom que incluya expresamente cesión/licencia de código.

## Checklist de go-live

- Propietario puede iniciar sesión desde un dispositivo nuevo.
- Roles de empleados probados con privilegios mínimos.
- Sucursal correcta seleccionada.
- Venta de prueba completa sin duplicados.
- Stock cambia una sola vez y el reverso restaura correctamente.
- Caja abre, registra movimientos y cierra con conciliación.
- Compra/pago a proveedor se refleja una sola vez.
- Ajuste manual de inventario registra motivo y movimiento.
- Modo offline/reconexión probado cuando el producto lo requiera.
- Catálogo: crear/editar producto, foto, disponibilidad y pedido de prueba.
- Seguimiento de pedido probado.
- Datos comerciales y WhatsApp revisados.
- Dispositivo/impresora probados si forman parte del alcance.
- Cliente conoce cómo contactar soporte y qué información enviar ante un incidente.

## Entrega de KIUBO Catálogos

El proveedor recibe su panel privado y el cliente final recibe únicamente el catálogo público. El proveedor puede administrar productos, fotos, precios, categorías, disponibilidad, pedidos, clientes, textos e identidad sin deployments de Vercel.

Un catálogo puede operar de forma independiente o vinculado a un tenant KIUBO. Cada cuenta mantiene dominio/orígenes propios, datos separados y sesiones independientes.

## Cambios posteriores

Los cambios de contenido son operación normal y no generan un release. Los cambios de software se agrupan en un lote, se prueban y se publican como checkpoint. Un hotfix crítico puede romper esta regla únicamente para evitar pérdida de datos, caída del servicio o una vulnerabilidad.
