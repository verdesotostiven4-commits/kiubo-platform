# KIUBO — Current status

Fecha: 2026-09-01

## Estado general

KIUBO ya opera como plataforma cloud multiempresa. El repositorio privado `kiubo-platform` es la fuente de verdad del ecosistema y la aplicación principal está desplegada en Vercel con Supabase como proveedor real de Auth y datos.

La arquitectura comercial queda separada por producto: KIUBO POS / Control en la raíz, KIUBO Catálogos en `products/catalogos/`, y espacio para Sites, Apps y soluciones personalizadas sin crear una copia del código por cliente.

## Cloud activo

Producción usa `NEXT_PUBLIC_KIUBO_AUTH_MODE=supabase` y `NEXT_PUBLIC_KIUBO_DATA_MODE=supabase`. El health check valida Supabase Auth y, desde este Production Gate, también el plano de datos mediante `catalog-router`.

La base ya contiene tenants, sucursales, miembros, planes, suscripciones, overrides, branding, settings, sincronización por revisiones y recibos idempotentes. KIUBO Control aprovisiona negocios e invita propietarios mediante Supabase Auth.

## Transacciones críticas

El Data Provider enruta operaciones sensibles a RPCs atómicos: ventas, reversos, caja/finanzas, compras/pagos a proveedor, ajustes de inventario y sincronización. El Production Gate corrigió el drift detectado en producción y desplegó `apply_inventory_adjustments_v2`, que el cliente ya esperaba pero no estaba instalado en la base.

Los RPCs de operación requieren usuario autenticado, validan tenant/branch/rol según el flujo y usan recibos idempotentes para evitar duplicados.

## KIUBO Catálogos

Hakuna Matata continúa como primer catálogo operativo. El contenido demo sigue siendo reemplazable sin deployment. Se añadieron `public_base_url`, `allowed_origins` y vínculo opcional a tenant en `catalog_accounts`, además de RPCs de administración exclusivos para platform admin.

`catalog-router` v1 está activo en Supabase. Centraliza CORS por cuenta, conserva el API existente como core compatible y reescribe el enlace de seguimiento usando el dominio configurado para cada catálogo. El snapshot canónico 4.2 apunta al router; la publicación visual de Hakuna se hará en el siguiente lote de branding para no consumir un deployment extra solo por infraestructura.

## Seguridad

- RLS está activo en la capa multiempresa.
- El acceso directo a tablas `catalog_*` sigue cerrado a `anon` y `authenticated`; la Edge Function usa service role en servidor.
- `pull_sync_changes_v2` ya no puede ejecutarse como `anon`.
- PIN de proveedor permanece hasheado, con throttle individual y global.
- Las sesiones de proveedor expiran y son revocables.
- Las políticas RLS con `auth.uid()` fueron optimizadas para evitar reevaluación por fila.
- Las políticas duplicadas de SELECT fueron separadas por acción sin perder aislamiento.

Los warnings restantes del Security Advisor sobre `SECURITY DEFINER` son esperados para RPCs cliente que elevan permisos únicamente después de validar Auth/RLS/roles dentro de la función. No deben silenciarse quitando controles. El único hardening externo pendiente es activar Leaked Password Protection en Supabase Auth desde la configuración del proyecto.

## Deployments

La regla operativa es: **un lote aprobado → una validación completa → un deployment de producción por producto, cuando sea técnicamente posible**.

El proyecto principal usa `ignoreCommand` para no reconstruir KIUBO POS / Control cuando un commit solo modifica `products/catalogos/**`, `supabase/**` o `docs/**`. Los catálogos mantienen publicación controlada; los cambios de productos, fotos, precios y configuración viven en Supabase y no requieren Vercel.

## Entrega al cliente

KIUBO se entrega como SaaS: acceso del propietario, URL, usuarios, configuración, importación de datos cuando aplique, capacitación, checklist de go-live y soporte. GitHub, service roles, Vercel interno, secretos y credenciales de infraestructura no se entregan al cliente salvo contrato explícito de desarrollo con cesión de código.

## Gates que NO bloquean Hakuna / POS base

Factura electrónica/SRI permanece como add-on separado y no debe venderse como productivo hasta completar firma, transmisión, autorización, contingencia y validación fiscal server-side. Branding final de Hakuna Matata es la siguiente fase comercial y no forma parte de este Production Gate.
