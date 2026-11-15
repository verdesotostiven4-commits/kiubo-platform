# DeliScias Galapagueñas — KIUBO Panadería

Aplicación PWA **separada del POS de YUKI**, preparada para un único equipo Windows.

## Estado real
- Interfaz responsive y marca de la clienta.
- 19 productos con sus precios originales, sin inventar existencias.
- Ventas en efectivo, transferencia y pago mixto; caja, gastos, cierre, reportes y anulaciones que conservan historial.
- Datos **locales en IndexedDB**, exportación CSV, copia completa JSON y recuperación.
- Manifest, Service Worker y aviso **Nueva versión disponible** cuando la app se publique en HTTPS.
- **No está conectada a Supabase, no tiene autenticación, sincronización ni backup remoto**. No entregar como caja real todavía.
- Facturación SRI pendiente de RUC y requisitos legales; no incluida.
- No incluye impresora ni múltiples cajas.

## Probar localmente
Desde la carpeta `products/panaderia/app`, iniciar un servidor web local, por ejemplo:

```bash
python -m http.server 18765
```

Abrir `http://localhost:18765/` con Chrome o Edge y probar los flujos. **No abrir desde el interior de un archivo ZIP.**

Para instalar como PWA y recibir nuevas versiones por Internet, publicar esta carpeta en un origen HTTPS comercialmente permitido, con un nombre de proyecto independiente (no redeploy de YUKI).

## Siguiente hito antes de cobrar dinero real
1. Configurar en el Supabase existente tablas aisladas por negocio, RLS y login de la propietaria.
2. Hacer ventas, caja y anulación exclusivamente con transacciones server-side idempotentes.
3. Backups automáticos y restauración probada, control de fallos de Internet y verificación presencial.
4. Publicar en hosting HTTPS gratuito que permita uso comercial, y probar instalación/actualización en Windows.

Reglas: no copiar datos de YUKI, no crear planes de pago, no mezclar la contabilidad local de evaluación con operaciones reales sin migración verificada.
