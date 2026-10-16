# Design

## Context

`RegistroApp` (celular) y `PanelSalas` (escritorio) guardan la pantalla actual en estado de React; el navegador no registra esos cambios. `NuevaNota` encadena las etapas de captura, elección del niño o niña, procesamiento y revisión. En PC, `NuevaNotaEscritorio` la muestra dentro de un `Dialog` de alto fijo. `Pantalla` (`componentes.tsx`) no se desplaza: en el celular desplaza la página, pero en el diálogo el contenido queda recortado. Motivación: `proposal.md`. Requisitos: `specs/registro-web/spec.md`.

## Goals / Non-Goals

**Goals:**
- Atrás se comporta como en una app: retrocede dentro de ella.
- Ninguna nota se pierde sin que la educadora lo decida.
- Retomar un borrador reutiliza la misma revisión.

**Non-Goals:**
- Rutas en la URL o enlaces profundos.
- Descargar el audio o la foto de una nota guardada.
- Nombre del jardín desde la API.

## Decisions

### D1. Cuerpo desplazable y pie de acciones fijo
`Pantalla` recibe el contenido como hijos. Cada paso de la nota separa un cuerpo con `flex: 1; minHeight: 0; overflowY: auto` y un pie `flexShrink: 0` con los botones principales, el mismo patrón que ya usa «¿De quién es?». En el celular el pie queda `position: sticky; bottom: 0` con fondo, así que «Seguir con…» o «Está bien» siempre están a mano.
*Alternativa descartada:* dar scroll al papel completo del diálogo, porque los botones quedarían al final y habría que desplazarse para confirmar.

### D2. Historial con `pushState`, sin router
Un hook `useVistaConHistorial(inicial)` guarda la vista en `history.state`:
- `ir(v)` hace `pushState` y lleva el scroll al inicio;
- `popstate` restaura la vista guardada, o la inicial si no hay ninguna;
- al montar, `replaceState` marca la entrada inicial.

Los botones «volver» propios de la app usan `history.back()`, así el historial no crece con idas y vueltas. La URL no cambia, de modo que Amplify no necesita reglas nuevas. En el panel, la vista incluye la sección, la ficha abierta y el diálogo: Atrás cierra primero el diálogo.
*Alternativa descartada:* un router (React Router o wouter), que suma una dependencia y reglas de reescritura para una necesidad que el historial ya cubre.

### D3. Confirmar la salida según la etapa
`NuevaNota` informa si hay trabajo en curso (grabando, texto escrito, niño o niña por elegir, procesando). Cerrar en ese estado (Cancelar, la ×, clic fuera del diálogo, Escape o Atrás) abre `ConfirmarSalida`. En la revisión la nota ya existe en la API: cerrar no la descarta, y la confirmación avisa que queda «Sin revisar». Con Atrás, la app vuelve a poner la entrada del historial mientras se decide.

### D4. Revisar una captura existente
`RevisarCaptura` consulta `GET /capturas/:id` y muestra la misma `Revision`, sin vista previa local. «Mis notas» (celular) abre las notas `borrador_listo` y `error`. El panel lista las notas «Por revisar» de la educadora sobre la tabla. Confirmar o descartar invalidan las consultas de notas, como hoy.

## Risks / Trade-offs

- [El historial guarda vistas con IDs de niños o niñas que ya no existen] → si la vista restaurada no encuentra al niño o niña, se muestra «Mi sala», igual que hoy.
- [Diferencias de `popstate` entre navegadores móviles] → se prueba en Chrome de Android y en Safari de iOS antes de archivar.
- [Una nota en revisión cerrada por error] → queda «Sin revisar» y se retoma desde «Mis notas».

## Open Questions

- El nombre del jardín en la cabecera queda para un cambio de API.
