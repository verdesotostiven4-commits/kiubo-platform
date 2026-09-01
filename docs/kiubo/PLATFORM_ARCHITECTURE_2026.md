# KIUBO — Arquitectura de plataforma 2026

## Principio

**KIUBO es la cabeza del ecosistema.** POS, Control, Catálogos, Sites, Apps y futuros productos pertenecen a KIUBO, pero cada producto conserva límites técnicos y ciclos de despliegue independientes.

El repositorio privado `kiubo-platform` es la fuente de verdad. Los clientes no reciben forks del producto: se aíslan por tenant/cuenta y configuración.

## Modelo

```text
KIUBO
├─ KIUBO POS / Control       aplicación principal Next.js
├─ KIUBO Catálogos          catálogo + pedidos + proveedor
│  ├─ Hakuna Matata          primer catálogo operativo
│  └─ futuros catálogos      standalone o vinculados a tenant
├─ KIUBO Sites              futuro
├─ KIUBO Apps               futuro
└─ Soluciones personalizadas
```

## Repositorio

POS/Control permanece en la raíz para evitar una migración destructiva. Catálogos vive en `products/catalogos/`. Una migración futura a `apps/*`/`packages/*` solo se hará cuando el volumen lo justifique y como hito probado, no mientras se entrega un cliente.

## Cloud

Supabase es la capa operativa real. Auth, tenants, branches, roles, planes, settings y sync cloud están activos. Las transacciones críticas se ejecutan mediante RPCs server-side con autenticación, branch scope, validación de rol e idempotencia.

La aplicación mantiene capacidad offline/local como caché y cola, pero Supabase es la fuente cloud en producción.

## Catálogos

`catalog_accounts` separa identidad y operación de cada catálogo. Una cuenta puede ser standalone o vincularse a un tenant KIUBO. Routing guarda `public_base_url` y `allowed_origins` por cuenta.

`catalog-api` es el core de negocio compatible. `catalog-router` es la entrada canónica desde snapshot 4.2: valida CORS por cuenta, conserva el contexto del cliente y normaliza enlaces de seguimiento al dominio configurado. Esto permite publicar nuevos proveedores sin hardcodes específicos de Hakuna.

## Despliegues

Un mismo repositorio puede alimentar productos distintos. KIUBO Platform ignora commits que solo cambian Catálogos, Supabase o documentación. Catálogos mantiene deployment controlado/manual. El contenido del proveedor vive en Supabase y nunca necesita rebuild por sí mismo.

## Seguridad

- El navegador usa exclusivamente URL + publishable key.
- Service roles quedan en Edge Functions/backend.
- RLS separa tenants; Catálogos no expone sus tablas directamente al navegador.
- Pedidos recalculan precios en servidor.
- Operaciones críticas usan idempotencia.
- PIN de proveedor se guarda como hash con throttling individual/global.
- Sesiones son revocables y expiran.
- RPCs de plataforma verifican `is_platform_admin()` dentro del servidor.

## Entrega

KIUBO es SaaS administrado. Se entrega acceso/URLs/configuración/capacitación y soporte, no secretos ni infraestructura. El estándar está en `CLIENT_DELIVERY_STANDARD.md` y recuperación en `RECOVERY_RUNBOOK.md`.
