# KIUBO — Arquitectura comercial

## Qué ve cada persona

### Visitante
Entra a la web pública y puede revisar inicio, funciones, cómo funciona, planes, solicitud de demo y acceso al login.

### Prospecto
Se registra en el pipeline interno de KIUBO Control con origen, necesidad, plan probable, seguimiento y etapa comercial.

### Cliente en trial
Se crea su negocio aislado, se vincula al prospecto y se completa onboarding: datos, branding, catálogo, usuarios, caja, capacitación, SRI si aplica, backup y go-live.

### Cliente activo
Ingresa a la app con sus usuarios/roles y solo ve su tenant/sucursales/módulos.

### Equipo KIUBO
Usa Control + Prospectos para administrar licencias, módulos, clientes, trials y seguimiento.

## Sitio vs app
En fase inicial web pública y aplicación pueden compartir el mismo proyecto Next.js. Esto reduce costo y despliegues. La separación por dominio/subdominio es una decisión de infraestructura posterior.

## Captura web
Mientras no exista backend comercial dedicado, el formulario de demo prepara la solicitud y puede enviarla por canales configurables. Cuando exista backend, el formulario deberá crear automáticamente el prospecto en el CRM.

## Regla de datos
Prospectos comerciales y datos reales de clientes nunca deben vivir en la base de Barrio MAX. El CRM local actual es Foundation de desarrollo y deberá migrar al backend KIUBO dedicado antes del lanzamiento público.
