# KIUBO Platform — Foundation V1

Checkpoint visual y técnico aislado para KIUBO.

## Objetivos de esta fase
- UI base de KIUBO y KIUBO Control.
- Vista POS de referencia.
- Contrato `Data Provider` para desarrollar sin tocar Supabase de Barrio MAX.
- Preparación para multiempresa, planes, licencias, Catalog y Factura.
- Despliegues Git desactivados durante la construcción inicial.

## Ejecutar local
```bash
npm install
npm run dev
```

## Backend
Actualmente usa `localProvider`. Cuando exista un proyecto Supabase independiente para KIUBO, se reemplaza el proveedor detrás del mismo contrato. No se debe apuntar este proyecto al Supabase productivo de Barrio MAX.

## Rutas
- `/` presentación Foundation
- `/login` acceso de referencia
- `/control` KIUBO Control
- `/pos` punto de venta visual

## Regla de trabajo
Agrupar cambios por hitos grandes y desplegar solo checkpoints útiles.
