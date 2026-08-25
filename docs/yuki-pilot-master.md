# KIUBO · YUKI Pilot Master

Estado: **Custom · Early Partner Pilot**  
Objetivo: dejar YUKI operativo con KIUBO para ventas reales sin facturación electrónica en esta primera entrega.

## Fuente de verdad del piloto

Este documento es la bitácora maestra. Antes de repetir o rediseñar trabajo, revisar aquí qué está listo, qué está en construcción, qué está bloqueado y qué queda para después.

## Datos confirmados de YUKI

- Nombre comercial: **YUKI**
- Dirección: **Calle San Cristóbal y Roberto Schiess, Santa Cruz, Galápagos**
- Teléfono: **098 155 9128**
- Administrador confirmado: **Richard Campo Verde**
- Perfil: cafetería / comida rápida / yogurt / panes de yuca / sánduches / especialidades / combos / bebidas
- Canales operativos objetivo: **local, para llevar y domicilio**
- Métodos iniciales objetivo: **efectivo, transferencia y fiado**
- Pago mixto: **NO habilitar hasta persistir el desglose real efectivo/transferencia**
- Facturación electrónica/SRI: **fuera del alcance de la primera entrega**
- Logo: pendiente de URL/archivo oficial. No redibujar ni recrear. Usar exactamente el activo oficial que entregue YUKI.
- Impresora térmica: pendiente de confirmar marca/modelo/ancho/conexión. El software debe quedar preparado para impresión estándar del sistema, con diseño 80 mm y adaptación 58 mm.

## Qué debe poder hacer YUKI en el día 1

1. Iniciar sesión en su espacio YUKI.
2. Abrir caja con fondo inicial.
3. Crear un pedido desde POS de forma rápida.
4. Identificar el pedido como local / para llevar / domicilio.
5. Añadir productos por categorías gastronómicas.
6. Añadir nombre/teléfono/nota cuando aplique, sin volverlos obligatorios para venta rápida.
7. Cobrar en efectivo o transferencia; fiado solo cuando exista cliente.
8. Guardar venta, caja y pedido de forma durable aun con conectividad inestable.
9. Imprimir recibo de cliente y, cuando haya impresora, comanda simple.
10. Consultar ventas recientes y cierre de caja.
11. Cerrar caja con comparación esperado vs contado.
12. Cerrar/reabrir KIUBO sin perder productos, pedidos, ventas ni cola de sincronización.

## Flujo operativo recomendado

### Caja

Abrir turno → fondo inicial → ventas/pedidos → movimientos → conteo final → cierre → diferencia (cuadrada / sobra / falta).

### Pedido

Estados de servicio iniciales:

- `local`
- `takeaway`
- `delivery`

Para no convertir la primera entrega en un KDS completo, el pedido puede iniciar y cobrarse desde la misma estación de caja. El modelo debe quedar preparado para separar caja/cocina después.

Campos mínimos del pedido:

- número humano de pedido
- sucursal
- fecha/hora
- tipo de servicio
- productos/cantidades
- notas generales y/o por ítem
- cliente opcional
- teléfono opcional
- dirección opcional para domicilio
- total
- método de pago
- usuario que tomó/cobró
- estado operativo

### Impresión

**Recibo cliente**

- logo oficial YUKI cuando esté disponible
- nombre YUKI
- dirección
- teléfono
- pedido/venta
- fecha/hora
- productos
- cantidades
- total
- método de pago
- tipo de servicio
- frase configurable
- texto explícito de recibo/pedido, no comprobante tributario electrónico

**Comanda**

- PEDIDO #
- hora
- LOCAL / PARA LLEVAR / DOMICILIO
- productos en tipografía grande
- cantidades
- notas
- nombre cliente cuando exista
- sin precios salvo que se configure lo contrario

## Menú inicial inferido de material recibido

### Yogurts · $4.50

- Mora
- Fresa
- Melón
- Tomate de árbol
- Banana
- Naranjilla
- Maracuyá
- Mango

### Sánduches

- Pollo Cremoso · $8.95
- Carne Brava · $9.90
- La Fresca · $7.75

### Especialidades

- Tortillas de yuca / verde rellenas de queso · $6.25
- Tortillas de yuca rellena de pollo / verde rellena de carne · $6.95
- Muchines de queso · $6.25
- Corviche Manaba · $6.95

### Combos

- Combo 1 · $5.75
- Combo 2 · $7.50
- Combo 3 · $7.50
- Combo 4 · $14.00

### Bebidas

- Café americano caliente / frío · $3.25
- Cappuccino · $3.00
- Espresso · $3.00
- Té · $3.00
- Smoothies · $4.00
- Jugo de frutas · $3.50
- Colas · $2.25
- Agua con gas · $2.65

> Los nombres, precios, tamaños y variantes deben confirmarse antes de tratarlos como catálogo productivo definitivo. Las capturas sirven como base de preparación, no como sustituto de una revisión final del menú.

## Branding Custom YUKI

KIUBO sigue siendo el producto. El workspace se personaliza sin convertir cada negocio en una app distinta.

YUKI debe poder definir mediante datos, no código:

- logo URL
- nombre comercial
- color principal
- color secundario
- color acento
- frase de recibo
- teléfono
- dirección
- Instagram opcional
- perfil de negocio `food_service`
- capacidades habilitadas

No incrustar el logo como dibujo generado, base64 hardcodeado ni JSX manual. Guardar la URL oficial en branding/storage y renderizar exactamente ese recurso.

## Capacidades YUKI primera entrega

Habilitar:

- dashboard
- pos
- orders
- cash
- products/menu
- basic_inventory
- customers
- credits
- reports_basic
- receipts
- offline_sync

Mantener deshabilitado inicialmente:

- electronic_invoicing
- recipe_inventory
- kitchen_display
- table_map
- advanced_delivery
- reservations
- split/mixed_payment

## Inventario gastronómico

No descontar ingredientes de forma ficticia en la primera entrega.

Dos clases operativas:

1. **Vendibles con stock directo:** botella, lata, agua, empaque, producto terminado contado por unidad.
2. **Elaborados:** sandwich, yogurt preparado, especialidades, combos.

Para elaborados, registrar la venta desde el día 1, pero el descuento automático de ingredientes queda para Recipe/BOM V1.

Futuro Recipe/BOM V1:

- receta por producto
- unidad de medida
- rendimiento
- merma
- costo teórico
- consumo por venta
- sustituciones/variantes
- stock de ingredientes

## Estabilidad obligatoria para piloto

Antes de declarar YUKI listo:

- venta offline → reinicio → reconexión → sincronización
- doble clic/doble envío no duplica venta
- pago no se duplica aunque cambie operationId
- cierre de navegador no pierde operación pendiente
- stock directo no queda negativo por carrera
- caja conserva flujos físicos al anular ventas
- actualización de KIUBO no borra datos locales
- revocación de usuario/sucursal purga datos que ya no debe conservar
- producción estable separada de ramas de desarrollo

## Estrategia de despliegue desde el primer negocio real

- `main` = producción estable usada por negocios.
- ramas de trabajo = desarrollo sin impacto a clientes.
- feature branches no despliegan automáticamente mientras se conserva cuota.
- todo el lote actual se valida antes de entrar a `main`.
- merge final con squash para que el lote llegue a `main` como un solo commit lógico.
- cambios de alto riesgo detrás de capacidades/feature flags por tenant.
- evitar despliegues durante horas fuertes del negocio cuando sea posible.

## Estado de implementación

### Ya existente en KIUBO / base disponible

- Supabase auth / multi-tenant
- sucursales y roles
- Products V2
- POS retail base
- caja y fiados
- compras/proveedores
- ajustes de inventario
- reportes base
- sincronización incremental
- recuperación offline/durabilidad
- transacciones de venta/stock
- reconciliación de caja en rama piloto
- anulaciones auditables en rama piloto
- protección de pagos idempotentes en rama piloto
- feature-branch deployments desactivados durante este lote

### En construcción para YUKI Pilot

- perfil `food_service`
- pedidos local/para llevar/domicilio
- categorías de menú optimizadas para touch
- recibo/comanda imprimible
- branding YUKI por datos
- instalación/entrega operativa
- QA rápido específico de YUKI

### Pendiente crítico de información

- URL o archivo oficial del logo transparente
- confirmar impresora térmica (si existe)
- confirmar dispositivo principal y navegador/Windows
- correo de acceso del administrador
- confirmar si habrá más usuarios además de Richard
- confirmar precios/nombres finales del menú
- confirmar frase de ticket; provisional segura: `Hecho con cariño para ti`
- Instagram opcional

### Fuera de primera entrega

- SRI/facturación electrónica
- recetas/ingredientes automáticos
- KDS completo
- plano/mesas avanzadas
- delivery con repartidores
- reservas
- pagos mixtos hasta persistir desglose real

## Checklist de entrega física

1. Comprobar internet y navegador actualizado.
2. Iniciar sesión con cuenta real de YUKI.
3. Instalar PWA en PC/laptop.
4. Verificar nombre/logo/branch YUKI.
5. Revisar menú/precios con administrador.
6. Revisar impresora; instalarla en Windows si existe.
7. Abrir caja de prueba.
8. Crear pedido local de prueba.
9. Crear pedido para llevar de prueba.
10. Crear pedido domicilio de prueba.
11. Cobrar efectivo y transferencia de prueba.
12. Imprimir recibo/comanda si hay impresora.
13. Revisar venta, caja y reporte.
14. Probar cierre/reapertura de aplicación.
15. Probar brevemente desconexión/reconexión antes de operar en serio.
16. Eliminar/anular únicamente datos de prueba mediante flujo auditable; no borrar historial productivo.
17. Entregar acceso y explicación corta.

## Regla de lanzamiento

No publicar cambios de YUKI a producción por presión de horario si los quality gates/build no pasan. Si el lote nuevo no está validado, usar la última producción estable y activar capacidades nuevas únicamente cuando estén seguras.