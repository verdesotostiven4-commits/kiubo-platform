# KIUBO Panadería · Demostración para computadora

## ¿Qué recibimos de la clienta?

Se han transcrito **19 artículos con sus precios** de 9 capturas de WhatsApp, sin inventar precios ni fotografiar otros productos.
El listado editable está en `../catalogo-recibido-2026-10-26.csv`.

**Presentaciones a confirmar antes del uso real:**
- Melvas: USD 0,50 y USD 2,00 (en la demo se distinguen unidad/envase).
- Suspiros: USD 0,50 y USD 2,00 (unidad/envase).
- Torta de chocolate: USD 1,00 y USD 1,50 (mismo nombre, diferencia por confirmar).
- Texto «Hoy dog de manjar»: conservar como lo escribió la clienta hasta aclarar el nombre.

**Pendiente:** nombre comercial real, logo en alta calidad, fotografías originales sin marco de WhatsApp, existencia inicial por artículo, datos tributarios si contrataran facturación SRI. Los 50 artículos de stock de la demo **son inventados**, no cifras enviadas por la clienta.

## Probar en Windows / laptop SIN instalación técnica

1. Entrar a GitHub, abrir la rama `feat/kiubo-panaderia-demo-oct22` y usar **Code → Download ZIP**.
2. Extraer el ZIP; entrar a `products/panaderia/demo/`.
3. Abrir `index.html` con Microsoft Edge o Google Chrome, en pantalla grande.
4. Usar **Punto de venta** para simular la compra; presionar **F2** para buscar productos.
5. Probar efectivo, transferencia y mixto, revisar el **resumen de venta en pantalla** (sin impresión), **Caja y gastos** y **Reportes**.
6. Para reiniciar la demo, recargar la página: por diseño no guarda pagos ficticios.

No usar la demo como caja comercial, factura válida del SRI ni base de datos. No guarda datos reales.

## Instalación como aplicación de Windows (cuando tenga URL propia con HTTPS)

1. Abrir la dirección oficial de la aplicación en Chrome o Edge.
2. Usar **Instalar aplicación** o **Instalar este sitio como aplicación** desde el menú del navegador, si el navegador lo permite.
3. Crear acceso directo en escritorio/barra de tareas si se desea.
4. Al abrirla, se verá en su propia ventana sin barra de navegación.

El manifiesto e icono SVG de la demo son preparatorios. La instalación en Windows requiere publicar en HTTPS y probar Chrome/Edge en la computadora real. **No incluimos impresora en esta etapa.**

## Diseño para venta real

- Un solo punto de cobro habilitado al inicio. No habilitar un segundo equipo como caja sin bloqueo transaccional de terminal.
- La **nube es la fuente de verdad** para pagos, reportes e inventario. La PC guarda solo borradores limitados/caché; una caída de Internet **no** confirma una venta.
- Base de datos independiente de YUKI con movimientos atómicos e idempotentes (UUID), permisos RLS y auditoría.
- El acceso desde celular puede ser de consulta, no segunda caja de ventas.
- Confirmar sistema operativo Windows, método de impresión y estabilidad de Internet en pruebas presenciales.
- Facturación electrónica del SRI requiere implementación y prueba oficial; **la impresión de un ticket no la sustituye**.
- Hosting de producción debe permitir uso comercial; no activar facturación ni recursos de infraestructura sin presupuestarlos.
- Los productos por envase, unidad, docena o porción deben tener SKU propio; la denominación es temporal hasta que la clienta confirme.

## Calidad

```
node --check products/panaderia/demo/app.js
node products/panaderia/tests/smoke.mjs
```

La configuración del demo funciona como proyecto estático separado. No se toca la aplicación principal de YUKI ni su Supabase.
