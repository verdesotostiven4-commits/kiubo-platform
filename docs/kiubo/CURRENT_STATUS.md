# KIUBO — Current status

Fecha: 2026-08-20

## Repositorio
KIUBO ya vive en un repositorio comercial independiente. La aplicación está en la raíz del repo para que Vercel pueda desplegarla con Root Directory `./`.

## Estado funcional Foundation
Incluye web pública, login local de desarrollo, KIUBO Control, CRM de prospectos, multiempresa/multisucursal, POS, inventario/kardex, caja, clientes, fiados, compras/proveedores/CxP, reportes, branding, backup/restore, cola offline/sync preparada y Foundation SRI.

## Backend
Foundation usa almacenamiento local/offline. No existe todavía backend cloud productivo. El contrato Data/Auth Provider permite conectar un backend dedicado después sin reescribir las pantallas.

## Despliegues
`vercel.json` mantiene despliegues Git automáticos desactivados durante construcción. Los previews se realizan solo en checkpoints útiles.

## Gates pendientes
1. primer preview Vercel independiente;
2. corregir cualquier error de build/UI detectado;
3. backend dedicado + Auth + RLS;
4. sync cloud real e idempotente;
5. completar SRI server-side;
6. validar nombre/marca;
7. piloto externo;
8. términos/privacidad/cobros antes de venta pública.

## Aislamiento
Barrio MAX conserva su repo, base y deployment. No se usan datos reales de Barrio MAX en KIUBO.
