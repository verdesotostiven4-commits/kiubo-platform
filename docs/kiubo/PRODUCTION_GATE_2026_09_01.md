# KIUBO — Production Gate 2026-09-01

Este documento define el punto mínimo para considerar KIUBO listo para un piloto/cliente real sin confundir “se ve bien” con “está operativamente protegido”.

## Gate A — Plataforma cloud

- Auth y Data Mode en Supabase.
- Health endpoint 200 y validación de Auth + data plane.
- Tenants, sucursales, membresías, planes, suscripciones y RLS activos.
- KIUBO Control capaz de crear negocio, matriz, propietario y trial sin manipular la base manualmente.

**Estado:** aprobado.

## Gate B — Operaciones críticas

- Venta + stock atómica e idempotente.
- Reverso de venta protegido.
- Caja/finanzas atómicas.
- Compra + stock/costo y pagos a proveedor protegidos.
- Ajuste de inventario atómico, con row lock, branch scope e idempotencia.
- Sync por cursor/revisión con branch scope.

**Estado:** aprobado después de instalar `apply_inventory_adjustments_v2` en producción.

## Gate C — Seguridad y aislamiento

- RLS multi-tenant.
- RPCs sensibles requieren usuario autenticado y validan tenant/rol/branch dentro del servidor.
- `pull_sync_changes_v2` sin permiso `anon`.
- Políticas RLS optimizadas para `auth.uid()` y sin SELECT duplicados innecesarios.
- Catálogos sin acceso directo de cliente a tablas; Edge Functions median la operación.
- PIN de proveedor hasheado, sesiones revocables y throttling individual/global.

**Estado:** aprobado con una mejora de consola pendiente: activar Leaked Password Protection en Supabase Auth.

## Gate D — KIUBO Catálogos reutilizable

- `catalog_accounts` admite dominio/base URL y orígenes por cuenta.
- Puede vincularse opcionalmente a un tenant KIUBO.
- Platform admin dispone de RPCs para listar, crear, enlazar y actualizar routing de catálogos.
- `catalog-router` activo para CORS por cuenta y enlaces de seguimiento por dominio.
- Hakuna conserva compatibilidad con el API core actual hasta su siguiente publicación visual.

**Estado:** aprobado para siguiente tenant usando el snapshot 4.2/router.

## Gate E — Deployments y recuperación

- GitHub es fuente de verdad.
- Cambios se agrupan en checkpoints coherentes.
- Vercel principal ignora commits que solo cambian Catálogos, Supabase o documentación.
- Cambios de contenido del proveedor no consumen deployments.
- Existe runbook de recuperación y checkpoint recuperable de Catálogos.

**Estado:** aprobado.

## Gate F — Entrega al cliente

El cliente recibe acceso, URLs, usuarios, datos/configuración, guía, capacitación y soporte. No recibe secretos internos ni acceso administrativo a la infraestructura central de KIUBO salvo acuerdo contractual específico.

**Estado:** aprobado como estándar de entrega.

## Fuera de este gate

- Branding/identidad final de Hakuna Matata: siguiente fase.
- Catálogo real/fotografías: siguiente fase junto al cliente.
- Factura electrónica/SRI: add-on independiente; no se declara productivo hasta completar su propio gate fiscal.
- Marca/dominio/legal/comercial de KIUBO: gate de lanzamiento público, no bloqueo técnico del cliente privado actual.
