# KIUBO Factura — SRI Foundation 2026

Fecha de revisión técnica: 2026-08-20.

## Baseline oficial usado
- Emisión electrónica: esquema **Off-line**.
- Ficha técnica enlazada directamente por el portal del SRI: **Versión 2.33, julio de 2026**.
- Factura XSD/XML: **2.1.0**.
- Ambientes separados: pruebas/certificación y producción.
- Firma electrónica requerida para comprobante válido.
- Tarifa general IVA vigente 15% mientras no exista modificación posterior; KIUBO no asume que todos los productos usan esa tarifa.

## Clave de acceso
Factura usa clave numérica de 49 dígitos: fecha, tipo `01`, RUC, ambiente, establecimiento+punto, secuencial, código numérico, emisión normal `1` y verificador módulo 11. El motor incluye vector `41261533 -> 6` y una clave conocida de 49 dígitos.

## Secuenciales
Se reservan por `tenant + sucursal + tipo de documento + establecimiento + punto de emisión`. Localmente existe contador para UX; producción debe usar reserva atómica en PostgreSQL mediante `reserve_sri_sequence`.

## IVA
Clasificación fiscal explícita y verificada por producto. Foundation contempla IVA 15%, 5%, 0%, no objeto y exento. Los precios POS se tratan como precios finales con impuesto incluido y se reconstruye base + impuesto para preflight.

## Consumidor final
Sin identificación: tipo `07`, identificación `9999999999999`, razón social `CONSUMIDOR FINAL`.

## Snapshot fiscal
Congela emisor, comprador, sucursal/punto, secuencial/clave, líneas, perfil tributario, bases/impuestos, total/medio de pago y baseline técnico.

## Firma y secretos
KIUBO no guarda en localStorage contraseña ni P12/PFX. En producción el backend construye XML, valida XSD, firma, transmite, consulta autorización, conserva XML/RIDE privado, audita y notifica. La `service_role` tampoco debe existir en navegador.

## Implementado
- configuración por negocio+sucursal;
- perfiles IVA;
- ambiente;
- secuencial local por sucursal;
- clave 49 dígitos + módulo 11;
- consumidor final;
- snapshot fiscal;
- bloqueo de venta ya preparada;
- schema cloud + reserva atómica;
- estados de transmisión;
- `npm run verify:sri`.

## Aún no productivo
- XML final/XSD;
- firma criptográfica;
- recepción/autorización SRI;
- reintentos/recuperación de estados;
- RIDE final;
- storage privado XML;
- email al cliente;
- certificación con contribuyente real.
