# HAKUNA MATATA — MASTER ROADMAP

Última actualización: 2026-09-11
Producción: https://hakuna-matata-catalogo.vercel.app
Repo: verdesotostiven4-commits/kiubo-platform
Ruta: products/catalogos/web
Versión consolidada en `main`: Catalog / Panel 10.3.3
Slug: hakuna-matata

Este archivo es la fuente de verdad operativa del proyecto. No volver a Catalog 7.x como runtime cliente ni a la arquitectura de hotfixes antiguos. Mantener Catalog 10.x como runtime cliente estable y evolucionarlo por versiones consolidadas.

> Nota de despliegue 2026-09-11: 10.3.3 está fusionado en `main`, el Quality Gate pasó y el preview está READY. El dominio de producción seguía sirviendo 10.3.2 al cierre de esta actualización porque Vercel Hobby rechazó los nuevos builds por `build-rate-limit`. No confundir este límite de infraestructura con un fallo del código. En cuanto Vercel vuelva a aceptar builds, publicar el `main` actual o promover el preview READY sin reconstruir.

## ESTADO GENERAL

- [x] Catálogo cliente reconstruido sobre Catalog 10 limpio.
- [x] Búsqueda, favoritos, carrito, pedidos y multipresentaciones funcionales en base 10.x.
- [x] Home 10.3 con buscador, marcas, categorías, carrusel de 3 banners y destacados.
- [x] Modal de marcas rediseñado; eliminado bug del SVG negro gigante.
- [x] PWA instalable en Android y modo standalone configurado.
- [x] Icono genérico H retirado del manifest/favicon activo y reemplazado por la identidad real de Hakuna.
- [x] Primera tanda de logos reales/verificados conectada a `brand-assets-v10.js`.
- [x] Orden de marcas dinámico: solo prioriza marcas que realmente existen en el catálogo público.
- [x] Fotos de presentación soportadas por `image_url` / `image_path` y fallback legacy `KIUBO_PI`.
- [x] Protección DB para no borrar imagen de presentación si el panel omite campos de imagen.
- [x] `panel-v10-sync` con cola persistente y reintentos para foto de presentación.
- [x] Panel 10.3.3: limpiar búsquedas de Productos/Pedidos/Clientes reconstruye el listado y tiene recuperación automática si una capa legacy deja el DOM incompleto.
- [x] Panel móvil: Clientes accesible desde la navegación inferior.
- [x] Clientes: agregados de pedidos/valor corregidos para no contar pedidos cancelados y trigger de consistencia instalado en DB.
- [x] 7 productos Nestlé creados ocultos a falta de precio/foto final.
- [x] Prueba transaccional backend Coca-Cola 2 L: 2 Jaba x9 + 5 Unidad = $49.85; rollback limpio.
- [ ] Publicar 10.3.3 en el dominio productivo cuando Vercel libere el build-rate-limit.
- [ ] Pulido final 10.3/10.4 en móvil real.
- [ ] Completar logos reales faltantes.
- [ ] Completar fotos faltantes y recuperación segura de fotos antiguas por presentación.
- [ ] Precios y activación de Nestlé.
- [ ] Revisión completa end-to-end cliente -> pedido -> panel en producción móvil.
- [ ] Limpieza futura del panel legado a Panel 10 consolidado.

## 1. REGLAS NO NEGOCIABLES

- Mobile first.
- Navegación instantánea; sin delays artificiales.
- Nada de overlays invisibles, saltos al inicio o listeners duplicados.
- No reactivar `catalog-v7*.js` como runtime cliente.
- No explicar bugs como “cache” sin evidencia.
- Producto con varias presentaciones debe permitir combinar cantidades en una sola apertura: ej. 2 jabas + 5 unidades.
- Cada presentación puede tener foto propia y el catálogo/carrito debe mostrar la foto correcta.
- Fotos de producto en cards: zona 1:1 + `object-fit: contain`; nunca cortar producto.
- Carrito mantiene líneas separadas por presentación.
- Inventario multipresentación se calcula en unidades base cuando corresponde.
- No inventar promociones, precios, categorías o stock.
- Clientes nunca debe contar un pedido cancelado como compra válida/valor acumulado.
- Limpiar cualquier buscador debe restaurar el conjunto correcto del filtro activo; nunca dejar un subconjunto pegado.

## 2. HOME / INICIO

### Ya implementado
- [x] Header Hakuna + compartir.
- [x] CTA instalar PWA cuando disponible.
- [x] Buscador principal.
- [x] Rail de marcas.
- [x] Carrusel de tres banners funcionales.
- [x] Categorías rápidas.
- [x] Productos destacados.
- [x] CTA reales: Ver catálogo / Explorar productos / Ver marcas.
- [x] El rail prioriza Coca-Cola / Toni / Bubbaloo / Chiclets / Cheese Tris únicamente cuando esas marcas existen realmente.
- [x] Cuando una prioritaria no existe, el espacio se completa con marcas reales según presencia en catálogo.

### Pendiente / pulido
- [ ] Completar logos reales para marcas que todavía usan fallback de texto.
- [ ] Revisar composición de los 3 banners en pantallas estrechas.
- [ ] Evitar cualquier recorte lateral extraño en destacados.
- [ ] Ajustar snap/scroll horizontal de marcas, categorías y destacados.
- [ ] Revisar autoavance: vertical scroll no pausa; swipe horizontal manual sí; reanudar inmediatamente.
- [ ] Eliminar CLS/salto visual inicial.
- [ ] Mantener fondo crema/verde, blanco y coral como acento; no exagerar glassmorphism.

## 3. MARCAS

- [x] Modal “Encuentra tu marca”.
- [x] Buscador de marcas.
- [x] Filtro real por marca.
- [x] Fallback visual si una marca no tiene logo.
- [x] `brand-assets-v10.js` conectado a URLs verificadas.
- [x] Primera tanda real: Coca-Cola, Bubbaloo, Cheetos, Sprite, Fanta, Gatorade, Nestlé, Oreo, Dasani, Fuze Tea, Chips Ahoy!, Tostitos, Ruffles y Kinder Joy.
- [x] Toni deja de aparecer como prioridad si no existe en el catálogo.
- [ ] Completar logos reales de las marcas restantes sin usar imágenes inventadas/no verificadas.
- [ ] Mostrar conteo real de productos por marca en modal si aporta valor visual.
- [ ] Revisar todas las marcas para alias/nombres inconsistentes cuando se agreguen productos nuevos.

Marcas con fallback todavía aceptable hasta conseguir asset confiable incluyen varias como Cheese Tris, Chiclets, Club Social, Chiki, Barrilete, Apetitas, Doritos, Halls, Trident, Pony Malta y otras del catálogo real.

## 4. CATÁLOGO

- [x] Grid 2 columnas móvil.
- [x] Categorías.
- [x] Filtro de marca.
- [x] Favoritos.
- [x] Agregar / stepper.
- [x] Elegir para multipresentaciones.
- [x] Búsqueda global.
- [ ] Confirmar cards verdaderamente 1:1 en todos los tamaños.
- [ ] Revisar producto vertical alto sin clipping.
- [ ] Revisar placeholder “Foto pendiente”.
- [ ] Confirmar que ningún filtro deja el header con conteos/indicadores visuales raros.
- [ ] Revisar scroll state al volver de detalle/brand/modal.

## 5. BÚSQUEDA

### Cliente
- [x] Búsqueda global independiente de categoría/marca.
- [x] Sugerencias/resultados rápidos.
- [ ] Prueba final escribiendo rápido “coca cola” sin perder teclas en producción móvil.
- [ ] Tocar resultado debe abrir/llevar al producto sin saltos.
- [ ] Revisar teclado móvil y cierre natural del panel.

### Panel 10.3.3
- [x] Productos: botón X propio y evento nativo `search` de Chrome/Android manejados explícitamente.
- [x] Pedidos: limpiar búsqueda vuelve a renderizar el listado correcto.
- [x] Clientes: limpiar búsqueda vuelve a renderizar todos los clientes.
- [x] Escape limpia y vuelve a disparar el render.
- [x] Guard de integridad compara el DOM con el último bootstrap y usa un refresh seguro solo si el listado quedó incompleto.

## 6. PRESENTACIONES Y FOTOS

Modelo deseado por presentación:
- nombre
- unidades que contiene
- precio
- costo
- SKU
- orden
- predeterminada
- `image_url`
- `image_path`

Prioridad de imagen cliente:
1. `presentation.image_url`
2. metadata legacy `KIUBO_PI`
3. `product.image_url`

- [x] Coca-Cola 2 L Unidad reparada y persistida con foto propia.
- [x] Trigger DB preserva foto si actualización posterior omite imagen.
- [x] `panel-v10-sync` persiste imagen inmediatamente y conserva una cola local si falla red/sincronización.
- [x] UI del panel informa “Sincronizando foto…” y luego “Foto guardada automáticamente para esta presentación”.
- [x] Auditoría base: 172 productos / 209 presentaciones.
- [x] Recuperadas asociaciones antiguas con evidencia suficiente para Coca-Cola 2 L, Coca-Cola vidrio, Coca-Cola Zero vidrio, Dasani 6 L, Dasani chupón 1200 ml y Pony Malta Unidad, entre otras.
- [ ] Continuar recuperando assets antiguos solo cuando exista evidencia suficiente; nunca asignar imágenes al azar.
- [ ] Completar las presentaciones que realmente necesitan foto nueva con las imágenes que el usuario vaya consiguiendo.
- [ ] Validar refresh del panel: la foto debe seguir en su presentación.
- [ ] Validar detalle: cambiar presentación cambia hero + miniatura.
- [ ] Validar carrito: usa imagen de la presentación elegida.

## 7. MULTIPRESENTACIÓN

Prueba de aceptación obligatoria:
- Coca-Cola 2 L: Jaba x9 = 2 y Unidad = 5 en una sola ficha -> Agregar todo.

- [x] Arquitectura base soporta varias presentaciones.
- [x] Backend verificado transaccionalmente: Jaba x9 ×2 + Unidad ×5 = $49.85 y rollback sin pedido falso persistido.
- [x] El RPC calcula unidades base por presentación.
- [ ] Verificar combinación simultánea desde UI en producción móvil.
- [ ] Verificar que líneas del carrito permanezcan separadas desde UI.
- [ ] Verificar foto específica por línea desde UI.
- [ ] Completar checkout real controlado cuando Mayra pueda revisarlo.

## 8. FAVORITOS

- [x] Persistencia local.
- [x] Diseño 10.3 con subtítulo y cards.
- [ ] Verificar refresh.
- [ ] Verificar quitar/agregar corazón sin salto.
- [ ] Estado vacío bonito y CTA al catálogo.

## 9. PEDIDOS

- [x] Estado vacío rediseñado.
- [x] Persistencia/historial base del cliente.
- [x] Estados reales confirmados en backend: `new`, `confirmed`, `preparing`, `dispatched`, `delivered`, `cancelled`.
- [x] Cambio de estado/cancelación ahora mantiene agregados de Clientes sincronizados por trigger DB.
- [ ] Probar pedido completo real desde catálogo móvil.
- [ ] Confirmar pedido aparece en “Mis pedidos”.
- [ ] Confirmar pedido llega al panel proveedor.
- [ ] Diseñar cards de pedidos existentes al mismo nivel visual que el empty state.

## 10. CARRITO

- [x] Líneas por presentación.
- [x] Cantidad +/-.
- [x] Limpiar carrito.
- [x] Botón eliminar línea añadido en 10.3.
- [x] Total estimado y continuar.
- [x] Cálculo backend de la combinación crítica verificado.
- [ ] Verificar subtotal/total desde UI móvil.
- [ ] Confirmación elegante para “Limpiar”.
- [ ] Estado vacío con CTA.
- [ ] Verificar imagen correcta por presentación.

## 11. PWA / EXPERIENCIA APP

- [x] `manifest.webmanifest`.
- [x] display standalone.
- [x] beforeinstallprompt Android.
- [x] ayuda iOS para “Agregar a pantalla de inicio”.
- [x] service worker versionado y network-first para app shell.
- [x] Icono genérico H retirado de la instalación activa y reemplazado por el logo real Hakuna.
- [x] Favicon y Apple icon apuntan a la identidad real actual.
- [x] Service worker actualizado a shell 10.3.3 en `main`.
- [ ] Crear assets locales finales 192x192, 512x512 y maskable, para no depender del JPEG remoto.
- [ ] Splash/boot visual final.
- [ ] Confirmar que CTA instalar no aparece en standalone en todos los navegadores objetivo.
- [ ] Probar apertura desde WhatsApp/Telegram -> navegador -> instalar -> standalone.

Nota: no es posible quitar la barra del navegador en la primera apertura de un link normal. Standalone PWA es la solución correcta.

## 12. PANEL PROVEEDOR

Panel actual sigue siendo legacy por capas. No refactorizar todo de golpe mientras Mayra necesita operar.

- [x] Editor productos.
- [x] Presentaciones múltiples.
- [x] Foto por presentación UI.
- [x] `panel-v10-sync` con retry persistente.
- [x] Panel 10.3.3 añade una capa de estabilidad sin reescribir todavía todo el panel legacy.
- [x] Limpiar buscador de Productos después de editar/subir foto restaura el listado completo del filtro activo.
- [x] La X nativa de `type=search` de Chrome/Android ya no puede dejar un único producto pegado.
- [x] Mismo comportamiento endurecido para búsqueda de Pedidos y Clientes.
- [x] Clientes aparece en la bottom-nav móvil; antes quedaba solo en la navegación desktop.
- [ ] Aclarar visualmente “Presentación 1: Jaba”, “Presentación 2: Unidad”, etc. para que no parezca duplicado.
- [ ] Reducir confusión entre foto general y foto de presentación.
- [ ] Auditar costo/venta/unidades en uso real.
- [ ] Futuro: Panel 10 consolidado y retirar capas v5/v6/v7 gradualmente.

### Clientes / consistencia de datos
- [x] UNIQUE `(account_id, phone)` confirmado.
- [x] Sin teléfonos/negocios vacíos en la auditoría actual de Hakuna.
- [x] Sin teléfonos duplicados.
- [x] `order_count`, `total_spent`, `first_order_at`, `last_order_at` recalculados usando pedidos no cancelados.
- [x] Trigger `catalog_orders_customer_stats_sync` mantiene esas métricas consistentes en cambios de estado/total/teléfono y borrados.
- [x] `first_order_at` / `last_order_at` ahora admiten NULL para que reset de historial con 0 pedidos sea válido.
- [x] Funciones auxiliares de sincronización revocadas a roles públicos/anon/authenticated.
- [x] Trigger probado dentro de transacción y rollback: cambio temporal a cancelado recalculó correctamente y no dejó datos de prueba.

## 13. PRODUCTOS NESTLÉ PENDIENTES

Creados ocultos a falta de precio/foto final:

- [x] 12456207 — Amor Wafers Pekes Leche 130 g — Caja x54.
- [x] 12217906 — Galak Galleta Sánduche 87,5 g — Caja x72.
- [x] 11495358 — Muecas Chocolate 100 g — Caja x64.
- [x] 11495357 — Muecas Vainilla 100 g — Caja x64.
- [x] 12224201 — Nestlé Galleta Sal 380 g — Caja x26.
- [x] 12573303 — Nestlé Galleta Sal 140 g — Caja x28.
- [x] 12519408 — Ricas Galleta 58 g — Caja x100.

Pendiente por producto:
- [ ] precio real
- [ ] foto 1:1 profesional
- [ ] confirmar si solo caja o también unidad
- [ ] activar visible cuando esté completo

No agregar el producto rojo cortado de la captura hasta tener datos legibles.

## 14. CONTENIDO / ASSETS QUE REQUIEREN MATERIAL EXTERNO

- [ ] Logos reales restantes que todavía no tengan fuente confiable.
- [ ] Fotos de productos faltantes (el usuario indicó que se encargará de buscarlas).
- [ ] Precios Nestlé.
- [ ] Nuevos productos que Mayra envíe.

Mientras falten estos assets, la app debe usar fallback elegante y nunca mostrar información inventada.

## 15. PRUEBAS OBLIGATORIAS ANTES DE “LISTO”

### Producto simple
- [ ] Abrir.
- [ ] Agregar.
- [ ] +/-.
- [ ] Favorito.

### Multipresentación
- [ ] Elegir 2+ presentaciones en una sola apertura UI.
- [ ] Agregar cantidades distintas.
- [ ] Fotos correctas.
- [x] Total/backend crítico verificado con transacción y rollback.

### Navegación
- [ ] Inicio -> Catálogo -> Favoritos -> Pedidos -> Carrito instantáneo.
- [ ] Ningún botón manda arriba por error.
- [ ] Ningún overlay invisible.

### Búsqueda
- [ ] Cliente: escribir rápido.
- [ ] Cliente: global.
- [ ] Cliente: tocar resultado.
- [x] Panel: limpiar producto/pedido/cliente está endurecido en 10.3.3.

### Marcas
- [x] modal.
- [x] búsqueda/filtro base.
- [x] logos reales parciales + fallback.
- [ ] completar assets faltantes.

### Carrito / checkout
- [ ] quitar línea.
- [ ] limpiar.
- [ ] total UI.
- [ ] continuar.
- [ ] pedido creado real controlado.
- [ ] pedido visible en cliente.
- [ ] pedido visible en panel.

### PWA
- [ ] prompt Android final.
- [ ] instalar.
- [ ] abrir standalone.
- [x] manifest ya no usa la H genérica.
- [ ] confirmar icono en instalación nueva real.
- [ ] actualización SW 10.3.3 cuando producción pueda desplegar.

## 16. ORDEN DE EJECUCIÓN

1. Publicar 10.3.3 apenas Vercel deje de bloquear builds o promover el preview READY sin rebuild.
2. Validar en el móvil real el fix de limpiar búsqueda y acceso a Clientes.
3. Continuar logos reales faltantes sin inventar assets.
4. Completar fotos por presentación conforme el usuario las consiga.
5. Probar multipresentación + carrito + checkout completo en producción.
6. Completar Nestlé cuando Mayra mande precios.
7. Pulir pedidos existentes y estados.
8. Pulir panel de presentaciones.
9. Consolidar Panel 10 después de estabilizar operación.

## 17. CRITERIO FINAL DE ENTREGA

Hakuna Matata queda “terminado” cuando un cliente puede recibir el link, encontrar productos rápido, filtrar por marca/categoría, combinar presentaciones, armar carrito, confirmar pedido, ver seguimiento y opcionalmente instalar la PWA; y Mayra puede gestionar productos/presentaciones/fotos/pedidos/clientes desde el panel sin que ninguna foto, cantidad, pedido, búsqueda o agregado de cliente quede inconsistente al refrescar o cambiar estados.
