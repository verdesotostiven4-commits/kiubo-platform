# YUKI: nombres mostrados e inventario de durazno

Estado: diagnóstico comprobado con lecturas de producción; corrección local preparada en `claude-work`. Pendiente autorización para subir/publicar y prueba en el navegador del negocio.

## Base de la revisión

- Producción consultada: `kiubo-platform-ebon.vercel.app`, despliegue `dpl_6Nd7C6AxSBYBvV2mq2gTrVXMzdhk`.
- Código de ese despliegue: `f737ecacc71791867ed227f9ae92b60e37660959`, rama `fix/yuki-paid-table-resurrection-20261028`. Se usó esta versión como base para conservar las correcciones anteriores de mesas, PWA y reportes.
- Base de datos: proyecto KIUBO, negocio YUKI con zona `Pacific/Galapagos`, sucursal Matriz.
- Corte de datos: 28 de octubre de 2026, 20:57:55 de Galápagos / 21:57:55 de Ecuador continental (`2026-10-29T02:57:55.287Z`). El día del negocio empieza a las 06:00 UTC.
- Muestra: 93 filas de productos, 38 ventas, 147 movimientos de inventario y 42 pedidos creados durante ese día hasta el corte. El negocio siguió operando después del corte.
- Todas las consultas a datos de producción fueron de lectura. No se modificaron productos, recetas, ventas, saldos ni existencias reales.

## Nombres

| Texto original comprobado | Texto en la fotografía |
| --- | --- |
| Baguette, código `INS-MTKSFAR1` | Varita, mismo código |
| Yogurt Coco | Coco de yogur |
| Botón `＋ Reponer stock` en el código | Culata reponer |

Los originales de estos ejemplos permanecen guardados. La diferencia entre el texto del código/datos y el de las fotografías apunta con fuerza a una traducción automática de la página. No se inspeccionó directamente el estado del traductor en el navegador de Richard, por lo que esa última comprobación sigue pendiente.

La corrección añade `translate="no"` y `notranslate` en HTML y body, y la meta `google=notranslate`. No renombra registros ni intenta sobrescribir nodos que haya modificado una extensión. El HTML generado se comprobó con esos tres controles y `lang="es"`.

Referencias de implementación: [HTML Standard, atributo translate](https://html.spec.whatwg.org/multipage/dom.html#attr-translate) y [documentación de Chromium Translate](https://www.chromium.org/developers/design-documents/translate/).

Mitigación inmediata para el equipo actual: desactivar la traducción de esa página o restaurar el idioma original. No requiere borrar almacenamiento del sitio.

## Inventario: causa reproducida

Existen dos productos activos distintos:

- `tp-0823baf8-71d9-44ca-bb69-178df353980d`: **Yogurt de Durazno**, con receta de una pulpa de durazno y una porción de yogur natural.
- `tp-d3e84ff1-0b49-40b6-92a6-a83006eeebe9`: **Yogurt Durazno**, sin receta y con `trackStock=false`.

El selector anterior ofrecía por separado `de Durazno` y `Durazno`. Al seleccionar `Durazno`, el cálculo encontraba el producto sin receta, sin descontar ingredientes para ese sabor. Se reprodujo antes del cambio: un Combo 4 con Durazno/Mango/Mora consumía 15 panes, dos porciones de yogur y ninguna pulpa de durazno, aunque se habían vendido tres yogures.

| Venta | Fecha/hora en Galápagos | Movimiento esperado según la receta existente | Movimiento guardado |
| --- | --- | --- | --- |
| `sale-c69b7ffd-74ea-4c9c-b2ef-97715edba1ef` | 28/10, 17:54:26 | Yogur natural: 3; pulpa de durazno: 1 | Yogur natural: 2; pulpa de durazno: 0 |
| `sale-3055fda4-04ee-409a-a5ea-48d5c9c5576c` | 28/10, 20:09:07 | Yogur natural: 4; pulpa de durazno: 1 | Yogur natural: 3; pulpa de durazno: 0 |

En estas 38 ventas faltan, por tanto, descuentos por **dos porciones de yogur natural y dos de pulpa de durazno**. Es una diferencia entre ventas/recetas y movimientos registrados; no sustituye un conteo físico. No se aplicó una corrección retroactiva.

En el corte, las cadenas de movimientos de los productos controlados no mostraron saltos y el saldo final coincidió con el stock guardado. Por ejemplo: Pan de Yuca, `62 + 238 − 273 = 27`; Yogurt Natural, `94 − 6 de ajustes − 53 de ventas = 35`. La consistencia de ese historial no detectaba por sí sola el consumo omitido por una receta ausente.

## Corrección preparada

1. El selector y el cálculo comparten la misma forma de reconocer `Yogurt Durazno` / `Yogurt de Durazno`; el selector muestra un solo sabor Durazno.
2. Si existe una única receta configurada equivalente, un duplicado sin receta no puede ocultarla. El orden de llegada de los datos no cambia el resultado.
3. Si un mismo sabor tiene recetas distintas, se pide revisar su configuración en lugar de seleccionar una arbitrariamente.
4. Los sabores sin receta se rechazan antes de agregar, guardar o cobrar. Se vuelve a comprobar contra los datos locales recientes antes de registrar el cobro.
5. La venta directa de una entrada sin receta usada como sabor de un combo con inventario también muestra un aviso. En los datos revisados esto incluye el duplicado sin receta de Durazno y el producto vendible Yogurt Natural, cuya receta está vacía. No se les inventó una receta.
6. Las etiquetas antiguas `de Durazno`, los sabores repetidos y las cantidades de varios combos siguen siendo interpretables.

No se cambiaron RPCs, permisos, migraciones ni datos reales. Los clientes con la versión anterior conservan su comportamiento hasta recibir la actualización. Los movimientos históricos continúan mostrándose como fueron registrados.

## Validación

- `npm run verify`: TypeScript y suite completa aprobados.
- `npm run build`: verificación previa y compilación de producción aprobadas.
- Nueva regresión `verify:yuki-flavor-inventory`: fallo original reproducido antes del cambio; caso corregido, orden inverso de datos, etiquetas antiguas, sabores repetidos, recetas ausentes/ambiguas y separación entre negocios comprobados.
- Se ejecutaron los manejadores reales `addDirect`, `saveOrder` y `checkout` extraídos del código: una selección sin receta es rechazada antes de modificar productos, pedidos, ventas o cola de sincronización.
- Las pruebas existentes de reservas, inventario, pagos, sincronización, mesas cobradas y reportes siguen aprobadas.
- HTML renderizado: `lang=es`, `translate=no` en HTML/body y meta Google `notranslate` comprobados.
- Prueba visual interactiva: pendiente. No había un ejecutable de Chromium disponible y su descarga no produjo un archivo válido. No se afirma haber completado una prueba de navegador ni una venta real de extremo a extremo.

## Pendientes concretos

- Publicar únicamente después de la instrucción explícita del usuario, conforme a `CLAUDE.md`; hasta entonces no hay push, PR ni despliegue nuevo.
- Verificar el idioma original y el selector de Durazno en el navegador de Richard tras la actualización.
- Confirmar existencias físicas y registrar, si corresponde, un ajuste con motivo; no reconstruir ni reescribir ventas anteriores.
- Configurar explícitamente las entradas vendibles sin receta que se quieran utilizar. No archivar duplicados ni cambiar sus recetas sin decidir cuál se conserva.
