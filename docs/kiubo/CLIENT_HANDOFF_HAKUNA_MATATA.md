# Entrega al cliente · Hakuna Matata

Producto: **KIUBO Catálogos**
Cliente: **Hakuna Matata**
Estado técnico: **listo para revisión y carga de contenido real**

## Accesos

- Catálogo público: `https://hakuna-matata-catalogo.vercel.app/`
- Panel del proveedor: `https://hakuna-matata-catalogo.vercel.app/panel`
- Seguimiento de pedido: `https://hakuna-matata-catalogo.vercel.app/pedido`

El PIN del proveedor se entrega únicamente por canal privado; no se documenta en el repositorio.

## Qué puede hacer el proveedor sin depender de KIUBO

Desde el panel puede:

- crear y editar productos;
- archivar/restaurar productos;
- subir fotografías;
- cambiar precios y disponibilidad;
- organizar categorías;
- revisar pedidos;
- cambiar estados de pedidos;
- revisar clientes;
- editar nombre, textos, WhatsApp y colores;
- cargar/cambiar logo;
- definir pedido mínimo;
- abrir/cerrar temporalmente pedidos;
- cambiar el PIN y revocar sesiones.

Estos cambios se guardan en Supabase y se reflejan en el catálogo sin hacer deployment de Vercel.

## Estado actual de contenido

El catálogo contiene productos de demostración para que el cliente evalúe distribución, navegación y experiencia. Antes del go-live comercial definitivo se reemplazan por:

- catálogo real;
- precios reales;
- fotografías reales;
- disponibilidad real;
- categorías finales.

Esto no requiere modificar la aplicación.

## Flujo recomendado de puesta en marcha

1. El cliente revisa catálogo y panel.
2. Se aprueba o ajusta la identidad visual.
3. Se cargan productos, fotos, precios y categorías reales.
4. Se realiza un pedido de prueba controlado.
5. Se verifica que aparezca en el panel.
6. Se cambia el estado del pedido y se comprueba seguimiento.
7. Se elimina/cancela el pedido de prueba si corresponde.
8. Se entrega acceso definitivo y una capacitación corta.
9. Se comparte el enlace público con los compradores.

## Operación diaria

### Producto nuevo

Panel → Productos → Nuevo producto → completar nombre, categoría, precio, unidad, estado y foto → Guardar.

### Pedido nuevo

Panel → Pedidos → abrir pedido → revisar detalle → actualizar estado según avance.

### Producto temporalmente agotado

Cambiar el estado a “Agotado”. No es necesario borrar el producto.

### Producto retirado

Archivar. Puede restaurarse después si vuelve al catálogo.

## Seguridad

- El PIN nunca se guarda en texto plano en la base.
- Las sesiones del proveedor son revocables.
- Existe limitación de intentos de PIN.
- Los pedidos se calculan y validan del lado servidor.
- Las operaciones sensibles de catálogo pasan por funciones de backend.
- El acceso directo a tablas de catálogo está restringido.

## Soporte y continuidad

El código fuente oficial vive dentro del repositorio privado de KIUBO. La base de datos vive en Supabase y el frontend en Vercel. En caso de incidente existe un runbook de recuperación dentro de `docs/kiubo/RECOVERY_RUNBOOK.md`.

## Qué NO se entrega a un cliente SaaS estándar

No se entregan credenciales maestras de Vercel, Supabase, GitHub, service-role keys ni acceso a infraestructura de otros clientes. El cliente recibe su acceso, su contenido, su panel y su operación dentro de KIUBO.

## Cierre de entrega

La entrega se considera terminada cuando el cliente aprueba la identidad, confirma que su catálogo real está cargado, completa un pedido de prueba de extremo a extremo y recibe sus accesos definitivos.
