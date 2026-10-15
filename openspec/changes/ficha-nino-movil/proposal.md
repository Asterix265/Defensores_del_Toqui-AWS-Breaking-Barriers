# Proposal

## Why

En el mock de «Registro Simple» la educadora puede registrar, pero no puede ver qué lleva anotado de un niño o niña ni en qué áreas aún no tiene notas, que es lo que necesita para decidir a quién observar. Además, falta fijar qué hace el botón Grabar cuando hay un niño o niña en pantalla. La premisa de la solución es que la tía anote rápido, con el celular a mano y la atención en la sala. Un botón que registrara para quien está en pantalla haría que la nota de otro niño o niña quede a nombre equivocado.

## What Changes

- Nueva pestaña **«Mi sala»** en la barra inferior (Inicio · Mi sala · Grabar · Mis notas) con la lista de los niños y niñas de la sala de la educadora. En cada uno indica cuántas áreas siguen sin registros en los últimos 30 días.
- Nueva **ficha del niño o niña** (diseño B, «áreas primero»): para cada una de las 5 áreas del dataset sintético, la cantidad de notas de los últimos 30 días y la fecha de la última. Las áreas sin registros van primero y se rotulan como sugerencia de observación, no como rezago. Debajo van las últimas notas del niño o niña.
- **Grabar desde la ficha**: el botón de grabar de la ficha abre la grabación de audio con ese niño o niña ya elegido. Se salta el paso de elegirlo y, al terminar, vuelve a su ficha.
- **Grabar de la barra inferior**: siempre abre el modo general, en el que se elige al niño o niña después de capturar, aunque haya una ficha abierta. Es una decisión de la premisa de solución: el botón a la altura del pulgar nunca hereda el contexto de la pantalla.
- Los textos de la interfaz dejan de usar «toca»: «Toca un niño o niña» pasa a «Elige a un niño o niña», y los demás a «Presiona…».
- Sigue siendo un mock: datos sintéticos, notas en memoria y sin conexión a la API.

**Hechos**: hoy el mock no muestra notas por niño o niña, y la barra inferior tiene Inicio · Grabar · Mis notas. Grabar abre la grabación de audio y después pide elegir al niño o niña. La spec `trayectoria-aprendizaje` de `definir-mvp-e1` exige distinguir «sin registro» de «no logrado».

**Supuestos**: cada niño o niña pertenece a una sola sala a la vez. La sala de la educadora es la sala fija del mock. La ventana de 30 días es la que propone `definir-mvp-e1` para los huecos de evidencia.

**Decisiones pendientes**: si la ficha debe permitir también foto o texto para el niño o niña en pantalla. Por ahora graba audio, igual que el botón general.

**Exclusiones**: niveles, «esperado para su edad» o cualquier otra estimación de desarrollo, porque no se equipara la ruta sintética con la rúbrica institucional. También quedan fuera la edad en meses (el mock no la tiene), la asistencia, el reproductor de audio y la foto dentro de las notas, la vista de escritorio y la conexión con la API.

## Capabilities

### New Capabilities

- `ficha-nino`: consulta, desde el celular de la educadora, de las notas de un niño o niña de su sala y de las áreas sin registros recientes, y la regla de a quién se asocia una nota según el botón de grabar que se use.

### Modified Capabilities

(ninguna; `openspec/specs/` aún no tiene capacidades archivadas)

## Impact

- Código: `apps/web/src/registro/`, con pantallas nuevas «Mi sala» y ficha, la barra inferior con cuatro destinos, `NuevaNota` con un niño o niña opcional ya elegido y la navegación de `RegistroApp`.
- Pruebas: Vitest + Testing Library en `apps/web`.
- Documentación: README, en lo que la web muestra en el celular.
- Sin dependencias nuevas, sin cambios de API, de base de datos ni de AWS.
- **Medición del beneficio**: se cuentan las interacciones desde la ficha hasta la nota guardada, que deben ser una menos que en el modo general porque no se elige al niño o niña. Se verifica con una prueba que, desde cualquier pantalla, Grabar de la barra inferior lleva al modo general. No se promete reducción de horas de documentación; eso requiere la instrumentación de `medicion-impacto`.
