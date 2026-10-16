# Tasks

## 1. Web

- [x] 1.1 `textoLegible` en `formato.ts` para notas anteriores, en `registrar.ts`, `areas.ts`, `NuevaNota` y `DetalleNota` (D1). Verificar con `formato.test.ts`.
- [x] 1.5 `citaEnOriginal` en `@toqui/shared` y `textoOriginal` en el borrador entrante; `pnpm contract` (D1). Verificar con `anonimizacion.test.ts`.
- [x] 1.6 La Lambda entrega `textoOriginal`; la API lo guarda en la captura, devuelve las citas en el original y la observación guarda texto y citas originales (D1). Verificar con las pruebas del pipeline y la e2e «audio: guarda la transcripción original…».
- [x] 1.2 Sala propia vacía para la directora, título «Salas» y aviso para elegir sala (D2). Verificar con la prueba «en Salas no tiene «tu sala» y elige la sala para ver su estado».
- [x] 1.3 Confirmación de «Borrar nota» (D3). Verificar con la prueba de la foto en `RegistroApp.test.tsx` («Volver a la nota» y «Borrar»).
- [x] 1.4 Recarga al cambiar de service worker (D5). Verificar en el build que `sw.js` llama a `skipWaiting()` y `clientsClaim()`.

## 2. Verificación

- [x] 2.1 Tipos, pruebas y build de `shared`, `pipeline`, `api` (e2e con Postgres local) y `web`; ESLint, Prettier y contrato.
- [ ] 2.2 Después del despliegue, repetir en la demo: notas de texto, audio y foto con nombre real, «Salas» de la directora y confirmación al borrar.

## 3. Pendiente fuera de este cambio

- [ ] 3.1 Publicar la web después de la API (D4): rol de `ToquiCiCd`, script de publicación, `desplegar.yml` y `aws:prod:amplify`, en ese orden.
- [ ] 3.2 Medir la clasificación con notas sintéticas que mezclen núcleos antes de cambiar el prompt.
- [ ] 3.3 Avisar al equipo de la nota de prueba confirmada el 16-10-2026 (06:16, Alex E.) en la demo.
