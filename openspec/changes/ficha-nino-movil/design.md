# Design

## Context

El flujo del celular vive en `apps/web/src/registro/`:

- `RegistroApp` decide la pantalla con un estado `vista` (`inicio | notas | nueva`) y guarda las notas en memoria.
- `BarraInferior` tiene Inicio · Grabar · Mis notas. Grabar llama a `nueva('audio')`.
- `NuevaNota` recorre las etapas captura → `nino` (elegir al niño o niña) → `revision`. Al guardar o cancelar, `RegistroApp` vuelve al Inicio.

Hoy no existe una pantalla que liste a los niños y niñas de la sala ni una forma de llegar a uno en particular. Motivación y alcance: ver `proposal.md`. Requisitos: `specs/ficha-nino/spec.md`.

## Goals / Non-Goals

**Goals:**
- Llegar a la ficha de cualquier niño o niña de la sala con dos interacciones desde cualquier pantalla del celular.
- Que el niño o niña preseleccionado solo exista en el flujo que se abrió desde su ficha.

**Non-Goals:**
- Router ni URLs por pantalla: la navegación sigue en el estado de `RegistroApp`, como el resto del mock.
- Recordar la pantalla al recargar.
- Filtrar las notas al seleccionar una tarjeta de área. Las tarjetas son solo informativas en esta versión.

## Decisions

### 1. Navegación por estado, con el niño o niña dentro de la vista
`Vista` suma `{ tipo: 'sala' }` y `{ tipo: 'ficha'; ninoId }`. La vista `nueva` suma un `ninoId` opcional, presente solo cuando se abrió desde la ficha. El destino al guardar o cancelar sale de ahí: si hay `ninoId`, se vuelve a la ficha; si no, al Inicio, como hoy.
*Alternativa descartada:* guardar un «niño actual» en el estado global de la app. Es justo lo que haría que Grabar de la barra herede el contexto y registre a nombre equivocado.

### 2. Grabar de la barra no recibe contexto
`BarraInferior` sigue llamando a `onGrabar()` sin argumentos y `RegistroApp` lo resuelve siempre como `{ tipo: 'nueva', formato: 'audio' }`, sin `ninoId`. La garantía queda en la forma de los datos, no en una condición que se pueda olvidar.

### 3. `NuevaNota` con niño o niña opcional
Una prop `ninoId?` se usa como valor inicial de la selección. Si viene, al capturar se pasa directo a `revision`, sin la etapa `nino`. El resto del flujo (revisión, área, confirmación) no cambia, así que la nota guardada es idéntica a la del modo general.
*Alternativa descartada:* un componente aparte para grabar desde la ficha. Duplicaría las etapas de captura y revisión.

### 4. Cálculo de áreas como función pura
Una función en `datos.ts` (o en un archivo propio si crece) recibe las notas, el niño o niña y `ahora`, y devuelve por área la cantidad de notas y la fecha de la última dentro de los 30 días, con las áreas sin notas primero. «Mi sala» y la ficha la reutilizan, y se prueba sin renderizar.

### 5. Barra con cuatro destinos
El orden es Inicio · Mi sala · (Grabar) · Mis notas. Grabar mantiene su estilo de botón central elevado. Para que quede a la altura del pulgar, los dos destinos de la izquierda y el de la derecha se reparten el espacio y Grabar no se mueve.

### 6. Fechas relativas reutilizan `formato.ts`
«Última: hoy / ayer / 12 oct» sale de `etiquetaDia` y `formatoCuando`, que ya existen.

## Risks / Trade-offs

- [Barra con tres destinos alrededor de un botón central: Grabar queda ligeramente descentrado o los destinos más angostos] → Probar en 360 px de ancho y mantener áreas táctiles de 44 px o más.
- [La sala de la educadora es fija en el mock (`SALA`)] → Coherente con el resto del mock; cuando exista la API, la sala vendrá de la sesión.
- [Áreas del dataset sintético (5) y no los núcleos de Integra] → Es la misma limitación del resto del mock, y la ficha no muestra niveles.
- [Las notas viven en memoria] → Al recargar se pierden las notas nuevas, igual que hoy.

## Open Questions

- Si la ficha debe ofrecer también foto o texto además de audio. Agregarlo después no cambia la regla de asociación: `ninoId` ya viaja en la vista `nueva`.
