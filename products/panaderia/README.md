# KIUBO Panadería — producto independiente (borrador)

**Estado:** prototipo de demostración, sin integración de cobros reales. **No desplegar como caja real.**

## Decisiones arquitectónicas

- Identidad provisional: «Panadería Demo». Cuando la clienta envíe logotipo, nombre y productos, se personaliza sin modificar ninguna tabla ni cliente de YUKI.
- Producto aislado en `products/panaderia/`; no importa datos ni almacenamiento del POS de YUKI.
- PWA instalable, **online-first** para confirmar ventas. Supabase/PostgreSQL será autoridad para ventas, pagos, movimientos de caja, inventario y auditoría. IndexedDB **solo** para catálogo limitado, preferencias y borradores seguros, no para el historial contable completo.
- Primera entrega: **una tienda, una caja, una propietaria**. La administración desde celular puede ser solo lectura. No se activan múltiples cajeros simultáneos ni operación offline de ventas sin pruebas adicionales.
- Cada venta real se confirmará mediante una **RPC transaccional** con UUID idempotente, precios revisados en el servidor, pagos explícitos, stock y sesión de caja en una sola transacción. Un timeout obliga a consultar por UUID antes de reintentar.
- Capturar importes en **centavos enteros**; no depender de flotantes de la interfaz.
- Guardar eventos de stock por producto terminado; recetas/insumos/producción por lotes se modelan separadamente si la panadería los necesita. Vender un pan terminado **no** vuelve a descontar ingredientes.
- Sin conexión: conservar borradores, mostrar estado claro y **no** confirmar cobros hasta recuperar confirmación del servidor. No simular una venta exitosa al desconectarse.
- Lecturas incrementales y paginadas; nunca descargar ventas históricas completas en cada apertura de pantalla.
- Auditoría, política de permisos en backend y copias restaurables son requisitos previos al uso real.
- Facturación electrónica SRI, nómina, contabilidad tributaria, reservas complejas y producción con recetas quedan fuera del MVP hasta confirmar alcance y verificar integraciones legales.

## MVP dirigido a una panadería pequeña

1. Catálogo: producto, unidad/presentación, precio en centavos, stock de producto terminado (opcional), estado.
2. POS: carrito rápido, venta en efectivo, transferencia o mixta, resumen en pantalla sin valor tributario, anulaciones controladas.
3. Caja: apertura/cierre, efectivo esperado, transferencias recibidas, gastos/egresos.
4. Reportes: ventas cobradas, medios de pago, productos vendidos, gastos y diferencias de caja. Utilidad solo cuando existan costos fiables.
5. Configuración: identidad gráfica, nombre, contacto, zona horaria Ecuador continental.

## Qué contiene este primer demo

- Interfaz independiente con productos **ficticios** e interacciones de venta, catálogo, caja y reportes.
- Los datos viven **en memoria** y se reinician al recargar; no se recibe dinero real, no se sincroniza y no emite facturas oficiales.
- Ningún token, API key, RUC real o información de otra empresa.

## Criterios obligatorios antes de permitir cobros reales

- Pruebas automatizadas: doble clic en cobrar, reintento por timeout, 2 sesiones, corte de red en fases críticas, pagos mixtos, reversos, cierre de caja, stock, permisos y restauración de respaldo.
- Prueba presencial con la PC real del negocio y recuperación tras actualización.
- Confirmación expresa del alcance de SRI por separado.
- Costos reales de infraestructura y backups validados antes de prometer soporte mensual.

## Infraestructura y costos

- **No crear proyecto Supabase todavía.** Primero validar disponibilidad del plan y cuota en cuenta propietaria. Free puede pausarse por inactividad y no trae backups automáticos; Pro cobra compute por proyecto adicional.
- Vercel Hobby no permite usos comerciales. Usar infraestructura que permita uso comercial y presupuestar hosting, dominio, base de datos y respaldo.
- El desarrollo del demo no afecta el deployment KIUBO POS/YUKI. Un despliegue futuro de Panadería tendrá root y configuración propios.

## Siguiente integración

1. Recibir logo, nombre y productos; actualizar la configuración del demo.
2. Aprobar la experiencia con la clienta.
3. Crear esquema y funciones de cobro **en un proyecto independiente** con pruebas antes de tener clientes reales.
4. Preparar plan mensual y pago único con alcance, mantenimiento correctivo y extras documentados.

Referencia de origen: lecciones de incidentes KIUBO/YUKI; no deben copiarse tablas ni datos históricos de YUKI.
