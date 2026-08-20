# KIUBO Foundation v1

> Estado: diseño técnico inicial. **No modifica producción ni la base de Barrio MAX.**
> Marca: KIUBO se usa como nombre provisional de producto hasta completar revisión formal de marca/nombre comercial.

## Objetivo
Construir una plataforma SaaS multiempresa para POS, inventario, caja, clientes, facturación, reportes y módulos premium, reutilizando lo mejor de Barrio MAX sin mezclar datos ni infraestructura.

## Principios no negociables
1. **Barrio MAX permanece separado.** No se migra ni se altera su producción para construir KIUBO.
2. **Una sola base de código comercial.** No crear forks por cliente.
3. **Aislamiento multiempresa real.** Toda entidad operativa pertenece a un `tenant_id` y, cuando aplique, a un `branch_id`.
4. **RLS por defecto.** Ningún usuario puede consultar datos de otro negocio.
5. **Contraseñas nunca administradas manualmente.** KIUBO administra cuentas, roles y licencias, no contraseñas en texto plano.
6. **Nada se borra por falta de pago.** La licencia puede suspender nuevas operaciones; los datos del negocio no se destruyen.
7. **El catálogo maestro es un activo de KIUBO.** Cada negocio conserva sus precios, stock y datos propios; no obtiene una descarga masiva de la biblioteca maestra.
8. **Facturación aislada por negocio.** RUC, establecimiento, punto de emisión, firma, secuenciales y configuración tributaria son independientes.
9. **Auditoría.** Acciones sensibles quedan registradas.
10. **Offline y recuperación** forman parte del núcleo del POS.

## Arquitectura objetivo
### Capa global KIUBO
- `platform_admins`
- `plans`
- `plan_features`
- `master_products`
- `master_product_media`
- `platform_audit_logs`

### Capa por negocio
- `tenants`
- `tenant_branding`
- `tenant_settings`
- `tenant_members`
- `branches`
- `subscriptions`
- `tenant_feature_overrides`
- `tenant_sri_config`
- `customers`
- `tenant_products`
- `inventory_movements`
- `cash_registers`
- `cash_sessions`
- `sales`
- `sale_items`
- `payments`
- `credit_accounts`
- `credit_movements`
- `invoices`
- `invoice_events`
- `tenant_audit_logs`

## Roles
### Plataforma
- `platform_owner`: control total de KIUBO.
- `platform_support`: soporte limitado, auditado.

### Negocio
- `owner`, `admin`, `manager`, `cashier`, `inventory`, `accounting`.

Los permisos se resuelven por acciones, no solo por nombre de rol.

## Ciclo de licencia
`TRIAL -> ACTIVE -> GRACE -> SUSPENDED -> CANCELLED`

- **TRIAL:** funciones habilitadas para prueba/piloto.
- **ACTIVE:** suscripción vigente.
- **GRACE:** periodo de cortesía.
- **SUSPENDED:** bloquea nuevas operaciones según política; conserva datos.
- **CANCELLED:** cuenta cerrada comercialmente; datos sujetos a política contractual/legal.

## Planes v1
### KIUBO Start
POS, productos, inventario básico, caja, clientes, reportes básicos, una sucursal y límite básico de usuarios.

### KIUBO Pro
Start + inventario avanzado, fiados/crédito, reportes avanzados, más usuarios y módulos premium habilitables.

### KIUBO Custom
Pro + branding, configuración especial, integraciones aprobadas, implementación/migración asistida y módulos compatibles con el producto central.

## Add-ons
- KIUBO Factura
- KIUBO Catalog
- sucursal adicional
- usuarios adicionales
- migración desde Excel/CSV
- carga inicial de productos
- soporte dedicado
- integraciones especiales

## KIUBO Control
Panel de plataforma: crear negocio/propietario, trial, activar/suspender, plan/módulos, vencimientos, branding, sucursales y auditoría. El soporte excepcional debe ser explícito, temporal y auditado.

## KIUBO Catalog
`master_products` contiene datos globales reutilizables; `tenant_products` contiene costo, precio, stock y reglas exclusivas de cada negocio/sucursal. El precio nunca se comparte entre negocios automáticamente.

## Clientes
V1: clientes aislados por `tenant_id`. No habrá una base global de cédulas reutilizable entre comercios en primera versión.

## Facturación
Cada negocio separa datos fiscales, firma/certificados, establecimiento, punto de emisión, secuenciales, ambiente, correo e historial de autorizaciones.

## Seguridad
RLS, secretos solo en servidor, menor privilegio, auditoría, rate limiting, validación server-side, idempotencia, backups y restauración probada.

## Offline
El POS usa cola local con IDs idempotentes. Al reconectar valida sesión/tenant, envía pendientes, servidor deduplica, confirma, actualiza y conserva conflictos para resolución segura. `online` no significa `sincronizado`.

## Piloto fundador
Solo después de aislamiento multiempresa, licencia/trial, ventas/inventario, backup/recuperación, auditoría mínima y onboarding. Su objetivo es validar facilidad de uso y soporte con un negocio externo antes de comercializar ampliamente.

## Criterios para producción comercial
- pruebas automáticas de aislamiento tenant;
- roles/permisos;
- venta idempotente;
- recuperación offline;
- cierre de caja reproducible;
- backup/restauración;
- observabilidad;
- términos y privacidad;
- identidad de marca confirmada.
