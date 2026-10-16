# Design

## Context

La prueba de punta a punta del 16-10-2026 en el ambiente de demo dejó los hallazgos de `proposal.md`. Requisitos: `specs/registro-web/spec.md`.

## Goals / Non-Goals

**Goals:**
- Que la educadora nunca lea un marcador técnico del Guardrail.
- Que la directora no vea textos pensados para una educadora con sala.
- Que borrar una nota sea una decisión explícita.
- Que una pestaña abierta tome la versión nueva de la app sin pasos manuales.

**Non-Goals:**
- Guardar o reconstruir el texto original de audio y foto.
- Cambiar el prompt o la validación de Claude.
- Cambiar el workflow de despliegue en este cambio (ver D4).

## Decisions

### D1. Marcadores legibles en la web
`textoLegible` (`formato.ts`) reemplaza solo los cuatro marcadores que configura el Guardrail (`NAME`, `EMAIL`, `PHONE`, `ADDRESS`, en `infra/lib/componentes.ts`) por una etiqueta entre corchetes, y deja intactas otras llaves. Se aplica al mostrar: el extracto de las notas (`registrar.ts`), la nota breve de las observaciones (`areas.ts`), el texto y las citas de la revisión y del detalle. En notas escritas, revisión y detalle prefieren `captura.texto`, el original.
*Alternativa descartada:* reemplazar `{NAME}` por el nombre del niño o niña de la nota. La nota puede nombrar a otra persona, y el resultado parecería texto de la educadora.

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
- [Corchetes en citas] Una cita muestra `[nombre]` aunque el texto original tuviera el nombre. → Es lo que respalda la cita: la evidencia se extrajo del texto anonimizado.
