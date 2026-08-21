# KIUBO — Product Gate v1

Fecha: 2026-08-20

## Este hito añade
- Inicio/dashboard real para cada negocio (`/app`).
- Separación de módulos por Start / Pro / Custom.
- Factura como módulo independiente del plan.
- Cambio de plan desde KIUBO Control sin borrar información.
- Onboarding guiado persistente por negocio.
- Pantalla interna Plan y módulos.
- Navegación móvil inferior para la PWA.
- Control de acceso a rutas según rol + plan.

## Reglas de preview
### Start
POS, productos, inventario, caja/equipo, clientes y reportes esenciales. Sin fiado habilitado por defecto, sin compras profesionales, sin branding Custom ni múltiples sucursales.

### Pro
Todo Start + compras/proveedores, fiados/CxC/CxP y Catalog inteligente.

### Custom
Todo Pro + branding y múltiples sucursales. Configuraciones especiales se cotizan sin crear forks del producto.

### Factura
Add-on separado. El flag `invoice` debe estar activo. La Foundation fiscal todavía no firma/transmite al SRI en producción.

## Importante
El aislamiento actual de UI no sustituye RLS. La seguridad real se completa únicamente con Auth + backend multi-tenant + RLS. El almacenamiento sigue local en este preview.

## Siguiente gate técnico
1. backend dedicado;
2. Supabase/Auth provider real;
3. RLS multiempresa y sucursal;
4. sync offline/cloud idempotente;
5. invitaciones de usuarios;
6. CRM y onboarding cloud;
7. luego completar SRI server-side.
