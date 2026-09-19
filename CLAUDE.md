# Reglas de trabajo para KIUBO

- Trabaja siempre sobre la rama `claude-work`.
- Nunca trabajes directamente sobre `main`.
- No hagas push ni deploy automáticamente.
- Puedes hacer todos los cambios locales que necesites y probarlos las veces que haga falta.
- Solo haz push cuando yo diga: "quiero verlo", "sube preview" o algo equivalente.
- Solo pasa cambios a producción cuando yo diga expresamente: "publica".

## Forma de trabajar

- Trabaja con autonomía.
- No me preguntes por cada archivo o cambio pequeño.
- Si la tarea es sencilla, revisa solo lo necesario para no gastar contexto de forma inútil.
- Si la tarea es compleja, analiza todo lo necesario sin limitarte por ahorrar tokens.
- Prioriza que el resultado quede bien hecho antes que ahorrar tokens.
- Antes de cambiar algo importante, entiende cómo funciona la parte relacionada.
- No rompas funcionalidades que ya funcionan.

## Calidad

- Ejecuta las pruebas, build, lint o verificaciones necesarias según el cambio.
- Corrige los errores que provoquen tus cambios antes de terminar.
- En cambios visuales revisa especialmente móvil, responsive y UX/UI.
- Mantén el diseño profesional y consistente con el proyecto.

## Supabase

- Cuando sea necesario, revisa también base de datos, RLS, funciones y migraciones.
- No borres datos reales.
- No hagas cambios destructivos en producción sin que yo lo ordene.
- Los cambios de base de datos deben quedar reproducibles mediante migraciones cuando corresponda.

## Seguridad

- No expongas claves, tokens, contraseñas ni archivos `.env`.
- No subas secretos a GitHub.

## Al terminar una tarea

Dime brevemente:
1. Qué cambiaste.
2. Qué probaste.
3. Si hay algún problema pendiente.
4. Si está listo para que yo lo revise.