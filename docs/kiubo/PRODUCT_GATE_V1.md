# KIUBO — Product Gate v1 (histórico)

> Este documento conserva la decisión comercial Start / Pro / Custom, pero su nota original de “backend todavía local” ya no aplica. El estado técnico vigente está en `CURRENT_STATUS.md` y `PRODUCTION_GATE_2026_09_01.md`.

## Planes

### Start
POS, productos, inventario, caja/equipo, clientes y reportes esenciales. Una sucursal por defecto.

### Pro
Start + compras/proveedores, fiados/CxC/CxP y módulos avanzados habilitados por plan.

### Custom
Pro + branding, múltiples sucursales y configuraciones especiales cotizadas sin crear forks del producto.

### Factura
Add-on separado. No se declara productivo únicamente por activar el flag: firma, SRI, contingencia y validación fiscal tienen su propio gate.

## Estado cloud

Auth, backend multi-tenant, RLS, sync y transacciones críticas ya están activos. Los cambios de plan desde KIUBO Control no eliminan datos; los permisos efectivos se resuelven por suscripción + overrides + rol.
