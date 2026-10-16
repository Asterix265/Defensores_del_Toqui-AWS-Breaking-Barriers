# Proposal

## Why

La prueba de punta a punta en el ambiente de demo (Amplify, 16-10-2026), con la directora y la educadora sintéticas de `JAR-0001`, encontró problemas que confunden a quien usa la app o hacen perder trabajo:

- La revisión de la nota, las tarjetas «Por revisar», el detalle y la ficha muestran `{NAME} apiló…`. El pipeline guarda la nota anonimizada por el Guardrail (`apps/pipeline/src/orquestador.ts`), y la web muestra el marcador tal cual, incluso en notas escritas, cuya versión original la API ya devuelve en `texto`.
- La directora ve «Mi sala» y «Sala Cuna 1 (tu sala)» aunque no tiene sala. Con «Todas las salas», el estado por área muestra solo la primera sala, sin decirlo.
- «Borrar nota» descarta con un clic, sin confirmación ni forma de deshacerlo.
- Una pestaña abierta antes de un despliegue sigue con el JS viejo: el service worker nuevo toma el control (`autoUpdate`), pero la página no se recarga. Así apareció una maqueta antigua que pedía un código por correo.

## What Changes

- La educadora ve el nombre real en todas las pantallas. Claude sigue recibiendo solo el texto anonimizado:
  - la Lambda entrega a la API también el texto original (`textoOriginal`: transcripción o lectura de la foto), y la API lo guarda como texto de la captura;
  - la API devuelve las citas del borrador ubicadas en el original (`citaEnOriginal`, en `@toqui/shared`);
  - la observación confirmada guarda el texto y las citas originales, sin plazo de borrado (decisión del equipo del 16-10-2026).
- Las notas anteriores, que solo guardaron el anonimizado, muestran `[nombre]`, `[correo]`, `[teléfono]` y `[dirección]` en lugar de los marcadores.
- Sin sala propia (directora), la pestaña se llama «Salas», no aparece «tu sala» y, con «Todas las salas», se pide elegir una sala para ver su estado por área.
- «Borrar nota» pide confirmación («¿Borrar la nota?»), con «Volver a la nota» y «Borrar».
- La web se recarga una vez cuando un service worker nuevo toma el control de una pestaña abierta.

**Hechos**: `GET /capturas/:id` devolvía `texto` (original, solo en notas escritas) y `borrador.textoFuente` (anonimizado). Las observaciones confirmadas guardaban el texto anonimizado como `notaBreve`, a propósito: la retención borra el texto de la captura a los 7 días. Los ejemplos de correcciones que van a Claude solo llevan el `textoFuente` anonimizado y los IDs, nunca las citas. El `sw.js` generado llama a `skipWaiting()` y `clientsClaim()`. La directora siempre ve el panel (`RegistroApp`), que recibía como sala propia la primera sala del jardín.

**Decisión del equipo (16-10-2026)**: los nombres reales se conservan en la observación confirmada, sin plazo de borrado, para que la educadora siempre los vea. Cambia la decisión anterior (solo anonimizado en Aurora). Son datos sintéticos en la demo; con datos reales habría que revisarlo con Integra.

**Supuestos**: el Guardrail cambia solo los datos que reemplaza y deja igual el resto del texto, así que el original y el anonimizado se pueden alinear. Si no se alinean, la cita queda como la devolvió Claude. Recargar al cambiar de controlador ocurre al abrir la app después de un despliegue, no a mitad de una nota, porque el navegador busca actualizaciones del service worker al navegar.

**Exclusiones**:
- Recuperar el nombre de las notas que ya se guardaron anonimizadas (no se tiene el original).
- La calidad de la clasificación de Claude (una cita repetida en dos manifestaciones, el conteo no tomado como Pensamiento Matemático): requiere medir con notas sintéticas antes de tocar el prompt.
- La nota de prueba confirmada en la demo (dato, no código).
- El orden del despliegue: la web de Amplify sale antes que la API. Se propone publicar la web desde el workflow `desplegar.yml`, después de la API y del smoke; el cambio del workflow y del rol de despliegue queda para quien tenga permiso de editarlos (ver `design.md`, D4).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `registro-web`: nombres reales en la app, vista de salas sin sala propia, confirmación al borrar y recarga tras actualizar la app.

## Impact

- Código: `packages/shared` (`anonimizacion.ts` y `textoOriginal` en `BorradorEntranteSchema`), `apps/pipeline/src/orquestador.ts`, `apps/api/src/capturas/capturas.service.ts`, `apps/web/src/main.tsx` y `apps/web/src/registro/` (`formato`, `registrar`, `areas`, `NuevaNota`, `RegistroApp`, `panel/DetalleNota`, `panel/SalaEscritorio`).
- Contrato: `pnpm contract` (el DTO del borrador entrante suma `textoOriginal` opcional).
- Pruebas: Vitest en `packages/shared`, `apps/pipeline` y `apps/web`; e2e de la API con Postgres local.
- Sin dependencias nuevas ni migraciones. La Lambda y la API se redespliegan con `ToquiApp`.
- **Medición del beneficio**: en la demo, ninguna pantalla de la educadora muestra `{NAME}`; borrar una nota requiere dos acciones; la directora no ve «tu sala». No se promete reducción de horas de documentación.
