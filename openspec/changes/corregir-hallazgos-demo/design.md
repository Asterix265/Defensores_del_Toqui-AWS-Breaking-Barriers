# Design

## Context

La prueba de punta a punta del 16-10-2026 en el ambiente de demo dejó los hallazgos de `proposal.md`. Requisitos: `specs/registro-web/spec.md`.

## Goals / Non-Goals

**Goals:**
- Que la educadora vea el nombre real que escribió o dijo, sin que llegue a Claude.
- Que la directora no vea textos pensados para una educadora con sala.
- Que borrar una nota sea una decisión explícita.
- Que una pestaña abierta tome la versión nueva de la app sin pasos manuales.

**Non-Goals:**
- Reconstruir el nombre de las notas ya guardadas solo con el anonimizado.
- Cambiar el prompt o la validación de Claude.
- Cambiar el workflow de despliegue en este cambio (ver D4).

## Decisions

### D1. Nombres reales para la educadora, anonimizado para Claude
- **Lambda:** el orquestador agrega `textoOriginal` (el texto normalizado antes del Guardrail) al borrador que entrega. No se usa para clasificar ni para los ejemplos.
- **API, al recibir el borrador:** si la captura no tiene `texto` (audio y foto), guarda `textoOriginal` ahí. La retención lo borra a los 7 días, como el archivo.
- **API, al mostrar:** `GET /capturas/:id` devuelve las citas del borrador ubicadas en el original con `citaEnOriginal`. Esa función alinea el anonimizado con el original: los tramos literales coinciden y cada marcador cubre el dato que reemplazó. Si no se alinean, queda la cita de Claude.
- **API, al confirmar:** la observación guarda el texto original (`textoObservacion`, `notaBreve`) y las citas ubicadas en el original. La corrección sigue comparando solo IDs.
- **Web:** muestra `captura.texto` y las citas tal como llegan. Para notas anteriores, `textoLegible` convierte los marcadores en `[nombre]`, `[correo]`, `[teléfono]` y `[dirección]`.

*Alternativa descartada:* reemplazar `{NAME}` por el nombre del niño o niña de la nota. La nota puede nombrar a otra persona.
*Alternativa descartada:* conservar el original solo 7 días y mostrar `[nombre]` después en la ficha. El equipo prefirió ver siempre el nombre real (ver `proposal.md`).

### D2. Sin sala propia, cadena vacía
`RegistroApp` pasa `salaPropia = ''` a la directora. `SalaEscritorio` titula «Salas» cuando no hay sala propia, no calcula estado con «Todas las salas» y muestra «Elige una sala para ver su estado por área». Las comparaciones con `salaPropia` («tu sala») ya no coinciden con ninguna sala, así que la ficha tampoco lo muestra.

### D3. Confirmar el borrado en la revisión
`Revision` abre un `Dialog` propio antes de llamar a `descartar`. Se descartó reutilizar `useSalidaNota`, que modela salir sin decidir (la nota queda «Sin revisar»), no borrarla.

### D4. Publicar la web después de la API (propuesto, fuera de este cambio)
Hoy Amplify compila `main` por su cuenta y la web nueva queda en línea mientras `ToquiApp` todavía se despliega: en la demo, «Jardín» mostró «No se pudo cargar el estado del jardín» durante unos minutos. Propuesta:
- `pnpm aws:prod:amplify` desactiva el build automático de `main`;
- el rol `toqui-github-deploy` (`ToquiCiCd`) recibe `amplify:StartJob` y `amplify:GetJob` solo sobre `apps/dgsos3g6dvh6h/branches/main/jobs/*`;
- `desplegar.yml` deja de ignorar `apps/web/**` y, después del smoke, ejecuta un script que lanza el job de Amplify con el commit y espera su resultado.

El orden de aplicación importa: primero `aws:cicd:deploy`, luego el merge del workflow y al final `aws:prod:amplify`. Si se desactiva el build automático antes de que el workflow publique la web, la web deja de actualizarse. No se aplicó porque editar el workflow de despliegue requiere una autorización que esta sesión no tuvo.

### D5. Recargar al cambiar de service worker
`main.tsx` escucha `controllerchange` una vez, solo si la página ya tenía controlador, y recarga. Se descartó `virtual:pwa-register`, que exige la dependencia `workbox-window`.

## Risks / Trade-offs

- [Recarga inesperada] Si un service worker nuevo se activa con una nota en curso, la página se recarga. → Mitigación: el navegador busca actualizaciones al navegar, es decir, al abrir la app; una nota creada en la API queda «Sin revisar».
- [Nombres en Aurora sin plazo] La observación confirmada conserva los nombres. → Decisión explícita del equipo para la demo con datos sintéticos; con datos reales se revisa con Integra.
- [Texto que no se alinea] Si el Guardrail cambiara algo más que los datos, la cita queda con el marcador y la web la muestra con `[nombre]`.
