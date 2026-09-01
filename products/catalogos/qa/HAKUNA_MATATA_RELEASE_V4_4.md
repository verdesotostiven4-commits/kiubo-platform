# QA de release · Hakuna Matata / KIUBO Catálogos v4.4

## Infraestructura

- [x] Código respaldado en `kiubo-platform`.
- [x] Catálogo y panel servidos por Vercel.
- [x] Datos en Supabase.
- [x] Edge `catalog-router` activo.
- [x] RLS activo en tablas de catálogo.
- [x] Rate limiting de pedidos.
- [x] Throttle global + por cliente para PIN.
- [x] Sesiones del proveedor revocables.
- [x] Operaciones de pedido validadas en servidor.

## Identidad

- [x] Paleta Hakuna definida.
- [x] Textos principales definidos.
- [x] Símbolo v1 creado.
- [x] Lockup horizontal creado.
- [x] Tema visual premium separado de los estilos genéricos de KIUBO Catálogos.
- [x] PWA/manifest alineado a la marca en el source v4.4.
- [ ] Aprobación visual final del cliente.

## Catálogo público

Verificar después del deployment v4.4:

- [ ] Logo correcto en header.
- [ ] Hero correcto y sin saltos visuales.
- [ ] Categorías desplazables en móvil.
- [ ] Vista grid/lista.
- [ ] Búsqueda por producto/marca/categoría.
- [ ] Favoritos persistentes.
- [ ] Carrito persistente.
- [ ] Cantidades editables.
- [ ] Productos agotados no se pueden agregar.
- [ ] Checkout en 3 pasos.
- [ ] Validación de WhatsApp y campos requeridos.
- [ ] Entrega/retiro.
- [ ] Pedido mínimo.
- [ ] WhatsApp de confirmación.
- [ ] Link de seguimiento.
- [ ] Offline banner y recuperación de conexión.
- [ ] Responsive 320 px, móvil común, tablet y desktop.

## Panel del proveedor

Verificar después del deployment v4.4:

- [ ] Acceso con PIN de 4 dígitos.
- [ ] Error de PIN sin filtrar información sensible.
- [ ] Dashboard carga estadísticas.
- [ ] Crear producto.
- [ ] Editar producto.
- [ ] Subir/cambiar fotografía.
- [ ] Cambiar disponibilidad.
- [ ] Archivar/restaurar producto.
- [ ] Crear/editar/eliminar categoría.
- [ ] Pedidos: filtros, búsqueda, detalle y estados.
- [ ] Clientes: búsqueda y métricas.
- [ ] Configuración de negocio.
- [ ] Cambio de PIN.
- [ ] Revocación de sesiones.
- [ ] Navegación móvil inferior.
- [ ] Sidebar desktop.

## Seguimiento

- [ ] Token válido carga pedido.
- [ ] Token inválido no expone datos.
- [ ] Línea de tiempo refleja el estado correcto.
- [ ] Pedido cancelado se representa correctamente.
- [ ] Actualización automática funciona.

## PWA / caché

- [x] Service worker mantiene fallback offline.
- [x] Release v4.4 cambia la clave de caché.
- [x] `hakuna.theme.css` entra en el shell offline del source v4.4.
- [x] Nuevos assets de marca entran en el shell offline del source v4.4.
- [ ] Confirmar instalación PWA después del deployment.

## Contenido para go-live

No son bloqueos técnicos. Dependen del cliente:

- [ ] Productos reales.
- [ ] Precios reales.
- [ ] Fotografías reales.
- [ ] Categorías definitivas.
- [ ] Confirmación del WhatsApp final.
- [ ] Aprobación de logo/identidad.

## Gate final

No declarar “go-live comercial definitivo” hasta completar un pedido controlado de extremo a extremo después del deployment v4.4: catálogo → pedido → Supabase → panel → cambio de estado → seguimiento.
