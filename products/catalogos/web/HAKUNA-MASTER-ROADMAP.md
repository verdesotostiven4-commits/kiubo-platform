# HAKUNA MATATA — MASTER ROADMAP

Última actualización: 2026-09-10
Producción: https://hakuna-matata-catalogo.vercel.app
Repo: verdesotostiven4-commits/kiubo-platform
Ruta: products/catalogos/web
Versión cliente actual: Catalog 10.3.x
Slug: hakuna-matata

Este archivo es la fuente de verdad operativa del proyecto. No volver a Catalog 7.x ni a la arquitectura de hotfixes antiguos. Mantener Catalog 10.x como runtime cliente estable y evolucionarlo por versiones consolidadas.

## ESTADO GENERAL

- [x] Catálogo cliente reconstruido sobre Catalog 10 limpio.
- [x] Búsqueda, favoritos, carrito, pedidos y multipresentaciones funcionales en base 10.x.
- [x] Home 10.3 con buscador, marcas, categorías, carrusel de 3 banners y destacados.
- [x] Modal de marcas rediseñado; eliminado bug del SVG negro gigante.
- [x] PWA instalable en Android y modo standalone configurado.
- [x] Fotos de presentación soportadas por image_url/image_path y fallback legacy KIUBO_PI.
- [x] Protección DB para no borrar imagen de presentación si el panel omite campos de imagen.
- [x] panel-v10-sync para persistir foto de presentación.
- [x] 7 productos Nestlé creados ocultos a falta de precio/foto final.
- [ ] Pulido final 10.3/10.4 en móvil real.
- [ ] Logos reales de marcas.
- [ ] Fotos faltantes y recuperación de fotos antiguas por presentación.
- [ ] Precios y activación de Nestlé.
- [ ] Revisión completa end-to-end cliente -> pedido -> panel.
- [ ] Limpieza futura del panel legado a Panel 10 consolidado.

## 1. REGLAS NO NEGOCIABLES

- Mobile first.
- Navegación instantánea; sin delays artificiales.
- Nada de overlays invisibles, saltos al inicio o listeners duplicados.
- No reactivar catalog-v7*.js como runtime cliente.
- No explicar bugs como “cache” sin evidencia.
- Producto con varias presentaciones debe permitir combinar cantidades en una sola apertura: ej. 2 jabas + 5 unidades.
- Cada presentación puede tener foto propia y el catálogo/carrito debe mostrar la foto correcta.
- Fotos de producto en cards: zona 1:1 + object-fit: contain; nunca cortar producto.
- Carrito mantiene líneas separadas por presentación.
- Inventario multipresentación se calcula en unidades base cuando corresponde.
- No inventar promociones, precios, categorías o stock.

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

### Pendiente / pulido
- [ ] Garantizar que el rail de marcas muestre primero Coca-Cola, Toni, Bubbaloo, Chiclets y Cheese Tris cuando existan.
- [ ] Sustituir tiles de texto por logos reales.
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
- [ ] Crear/recibir logos reales y subirlos a storage/repo.
- [ ] Conectar brand-assets-v10.js con URLs reales.
- [ ] Mostrar conteo real de productos por marca en modal si backend lo permite.
- [ ] Revisar todas las marcas para alias/nombres inconsistentes.

Marcas prioritarias: Coca-Cola, Toni, Bubbaloo, Chiclets, Cheese Tris, Nestlé, Chips Ahoy!, Club Social, Chiki, Barrilete, Apetitas, Cheetos y demás reales del catálogo.

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

- [x] Búsqueda global independiente de categoría/marca.
- [x] Sugerencias/resultados rápidos.
- [ ] Prueba escribiendo rápido “coca cola” sin perder teclas.
- [ ] Tocar resultado debe abrir/llevar al producto sin saltos.
- [ ] Revisar teclado móvil y cierre natural del panel.

## 6. PRESENTACIONES Y FOTOS

Modelo deseado por presentación:
- nombre
- unidades que contiene
- precio
- costo
- SKU
- orden
- predeterminada
- image_url
- image_path

Prioridad de imagen cliente:
1. presentation.image_url
2. metadata legacy KIUBO_PI
3. product.image_url

- [x] Coca-Cola 2 L Unidad reparada y persistida con foto propia.
- [x] Trigger DB preserva foto si actualización posterior omite imagen.
- [x] panel-v10-sync intenta persistir imagen inmediatamente.
- [ ] Auditar todas las presentaciones con image_url/image_path null.
- [ ] Recuperar assets antiguos de Storage cuando sea posible antes de pedir re-subida.
- [ ] Validar Coca-Cola vidrio y Coca-Cola Zero vidrio.
- [ ] Validar refresh del panel: la foto debe seguir en su presentación.
- [ ] Validar detalle: cambiar presentación cambia hero + miniatura.
- [ ] Validar carrito: usa imagen de la presentación elegida.

## 7. MULTIPRESENTACIÓN

Prueba de aceptación obligatoria:
- Coca-Cola 2 L: Jaba x9 = 2 y Unidad = 5 en una sola ficha -> Agregar todo.

- [x] Arquitectura base soporta varias presentaciones.
- [ ] Verificar combinación simultánea en producción móvil.
- [ ] Verificar precio total y unidades reservadas.
- [ ] Verificar que líneas del carrito permanezcan separadas.
- [ ] Verificar stock base si varias presentaciones consumen la misma unidad base.

## 8. FAVORITOS

- [x] Persistencia local.
- [x] Diseño 10.3 con subtítulo y cards.
- [ ] Verificar refresh.
- [ ] Verificar quitar/agregar corazón sin salto.
- [ ] Estado vacío bonito y CTA al catálogo.

## 9. PEDIDOS

- [x] Estado vacío rediseñado.
- [x] Persistencia/historial base del cliente.
- [ ] Probar pedido completo real.
- [ ] Confirmar pedido aparece en “Mis pedidos”.
- [ ] Confirmar pedido llega al panel proveedor.
- [ ] Revisar estados reales soportados por backend; no inventar estados.
- [ ] Diseñar cards de pedidos existentes al mismo nivel visual que el empty state.

## 10. CARRITO

- [x] Líneas por presentación.
- [x] Cantidad +/-.
- [x] Limpiar carrito.
- [x] Botón eliminar línea añadido en 10.3.
- [x] Total estimado y continuar.
- [ ] Verificar subtotal por línea y total con multipresentación.
- [ ] Confirmación elegante para “Limpiar”.
- [ ] Estado vacío con CTA.
- [ ] Verificar imagen correcta por presentación.

## 11. PWA / EXPERIENCIA APP

- [x] manifest.webmanifest.
- [x] display standalone.
- [x] beforeinstallprompt Android.
- [x] ayuda iOS para “Agregar a pantalla de inicio”.
- [x] service worker versionado y network-first para app shell.
- [ ] Sustituir icono genérico H por logo Hakuna real en instalación.
- [ ] Crear iconos 192x192, 512x512 y maskable finales.
- [ ] Apple touch icon final.
- [ ] Splash/boot visual final.
- [ ] No mostrar CTA instalar si ya está standalone.
- [ ] Probar apertura desde WhatsApp/Telegram -> navegador -> instalar -> standalone.

Nota: no es posible quitar la barra del navegador en la primera apertura de un link normal. Standalone PWA es la solución correcta.

## 12. PANEL PROVEEDOR

Panel actual sigue siendo legacy por capas. No refactorizar todo de golpe mientras Mayra necesita operar.

- [x] Editor productos.
- [x] Presentaciones múltiples.
- [x] Foto por presentación UI.
- [x] panel-v10-sync.
- [ ] Aclarar visualmente “Presentación 1: Jaba”, “Presentación 2: Unidad”, etc. para que no parezca duplicado.
- [ ] Verificar guardado de foto directo + Guardar producto + refresh.
- [ ] Reducir confusión entre foto general y foto de presentación.
- [ ] Auditar costo/venta/unidades.
- [ ] Futuro: Panel 10 consolidado y retirar capas v5/v6/v7 gradualmente.

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

- [ ] Logos reales de marcas.
- [ ] Fotos de productos faltantes.
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
- [ ] Elegir 2+ presentaciones en una sola apertura.
- [ ] Agregar cantidades distintas.
- [ ] Fotos correctas.
- [ ] Total correcto.

### Navegación
- [ ] Inicio -> Catálogo -> Favoritos -> Pedidos -> Carrito instantáneo.
- [ ] Ningún botón manda arriba por error.
- [ ] Ningún overlay invisible.

### Búsqueda
- [ ] escribir rápido.
- [ ] global.
- [ ] tocar resultado.

### Marcas
- [ ] modal.
- [ ] búsqueda.
- [ ] filtro.
- [ ] quitar filtro.
- [ ] volver sin saltos.

### Carrito / checkout
- [ ] quitar línea.
- [ ] limpiar.
- [ ] total.
- [ ] continuar.
- [ ] pedido creado.
- [ ] pedido visible en cliente.
- [ ] pedido visible en panel.

### PWA
- [ ] prompt Android.
- [ ] instalar.
- [ ] abrir standalone.
- [ ] icono correcto.
- [ ] actualización SW.

## 16. ORDEN DE EJECUCIÓN

1. Estabilizar/pulir 10.3 en móvil real.
2. Corregir icono PWA y pequeños problemas visuales de Home/rails/cards.
3. Auditar fotos de presentación y recuperar asociaciones antiguas.
4. Probar multipresentación + carrito + checkout completo.
5. Completar logos reales de marcas cuando estén disponibles.
6. Completar Nestlé cuando Mayra mande precios.
7. Completar fotos pendientes.
8. Pulir pedidos existentes y estados.
9. Pulir panel de presentaciones.
10. Consolidar Panel 10 después de estabilizar operación.

## 17. CRITERIO FINAL DE ENTREGA

Hakuna Matata queda “terminado” cuando un cliente puede recibir el link, encontrar productos rápido, filtrar por marca/categoría, combinar presentaciones, armar carrito, confirmar pedido, ver seguimiento y opcionalmente instalar la PWA; y Mayra puede gestionar productos/presentaciones/fotos/pedidos desde el panel sin que ninguna foto, cantidad o pedido se pierda al refrescar.
