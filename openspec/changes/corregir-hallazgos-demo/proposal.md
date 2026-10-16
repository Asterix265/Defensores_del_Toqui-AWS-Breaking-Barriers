# Proposal

## Why

La prueba de punta a punta en el ambiente de demo (Amplify, 16-10-2026), con la directora y la educadora sintéticas de `JAR-0001`, encontró problemas que confunden a quien usa la app o hacen perder trabajo:

- La revisión de la nota, las tarjetas «Por revisar», el detalle y la ficha muestran `{NAME} apiló…`. El pipeline guarda la nota anonimizada por el Guardrail (`apps/pipeline/src/orquestador.ts`), y la web muestra el marcador tal cual, incluso en notas escritas, cuya versión original la API ya devuelve en `texto`.
- La directora ve «Mi sala» y «Sala Cuna 1 (tu sala)» aunque no tiene sala. Con «Todas las salas», el estado por área muestra solo la primera sala, sin decirlo.
- «Borrar nota» descarta con un clic, sin confirmación ni forma de deshacerlo.
- Una pestaña abierta antes de un despliegue sigue con el JS viejo: el service worker nuevo toma el control (`autoUpdate`), pero la página no se recarga. Así apareció una maqueta antigua que pedía un código por correo.

## What Changes

- Los marcadores del Guardrail (`{NAME}`, `{EMAIL}`, `{PHONE}`, `{ADDRESS}`) se muestran como `[nombre]`, `[correo]`, `[teléfono]` y `[dirección]` en la revisión, las citas, el detalle, las tarjetas y la ficha. En una nota escrita, la revisión y el detalle muestran el texto original.
- Sin sala propia (directora), la pestaña se llama «Salas», no aparece «tu sala» y, con «Todas las salas», se pide elegir una sala para ver su estado por área.
- «Borrar nota» pide confirmación («¿Borrar la nota?»), con «Volver a la nota» y «Borrar».
- La web se recarga una vez cuando un service worker nuevo toma el control de una pestaña abierta.

**Hechos**: `GET /capturas/:id` devuelve `texto` (original, solo en notas escritas) y `borrador.textoFuente` (anonimizado). Las observaciones confirmadas guardan el texto anonimizado como `notaBreve`. El `sw.js` generado llama a `skipWaiting()` y `clientsClaim()`. La directora siempre ve el panel (`RegistroApp`), que recibía como sala propia la primera sala del jardín.

**Supuestos**: «[nombre]» es comprensible para la educadora sin explicación adicional. Recargar al cambiar de controlador ocurre al abrir la app después de un despliegue, no a mitad de una nota, porque el navegador busca actualizaciones del service worker al navegar.

**Exclusiones**:
- Guardar el texto original de audio y foto (cambiaría la decisión de privacidad D5 del pipeline).
- La calidad de la clasificación de Claude (una cita repetida en dos manifestaciones, el conteo no tomado como Pensamiento Matemático): requiere medir con notas sintéticas antes de tocar el prompt.
- La nota de prueba confirmada en la demo (dato, no código).
- El orden del despliegue: la web de Amplify sale antes que la API. Se propone publicar la web desde el workflow `desplegar.yml`, después de la API y del smoke; el cambio del workflow y del rol de despliegue queda para quien tenga permiso de editarlos (ver `design.md`, D4).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `registro-web`: textos anonimizados legibles, vista de salas sin sala propia, confirmación al borrar y recarga tras actualizar la app.

## Impact

- Código: `apps/web/src/main.tsx` y `apps/web/src/registro/` (`formato`, `registrar`, `areas`, `NuevaNota`, `RegistroApp`, `panel/DetalleNota`, `panel/SalaEscritorio`).
- Pruebas: Vitest con Testing Library y MSW en `apps/web`.
- Sin dependencias nuevas, sin cambios de API, base de datos ni AWS.
- **Medición del beneficio**: en la demo, ninguna pantalla de la educadora muestra `{NAME}`; borrar una nota requiere dos acciones; la directora no ve «tu sala». No se promete reducción de horas de documentación.
