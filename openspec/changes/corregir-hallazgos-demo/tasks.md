# Tasks

## 1. Web

- [x] 1.1 `textoLegible` en `formato.ts` y su uso en `registrar.ts`, `areas.ts`, `NuevaNota` y `DetalleNota`; texto original de las notas escritas (D1). Verificar con `formato.test.ts`.
- [x] 1.2 Sala propia vacía para la directora, título «Salas» y aviso para elegir sala (D2). Verificar con la prueba «en Salas no tiene «tu sala» y elige la sala para ver su estado».
- [x] 1.3 Confirmación de «Borrar nota» (D3). Verificar con la prueba de la foto en `RegistroApp.test.tsx` («Volver a la nota» y «Borrar»).
- [x] 1.4 Recarga al cambiar de service worker (D5). Verificar en el build que `sw.js` llama a `skipWaiting()` y `clientsClaim()`.

## 2. Verificación

- [x] 2.1 `pnpm --filter @toqui/web typecheck`, `test`, `build`, ESLint y Prettier.
- [ ] 2.2 Después del despliegue, repetir en la demo: nota escrita sin `{NAME}`, «Salas» de la directora y confirmación al borrar.

## 3. Pendiente fuera de este cambio

- [ ] 3.1 Publicar la web después de la API (D4): rol de `ToquiCiCd`, script de publicación, `desplegar.yml` y `aws:prod:amplify`, en ese orden.
- [ ] 3.2 Medir la clasificación con notas sintéticas que mezclen núcleos antes de cambiar el prompt.
- [ ] 3.3 Avisar al equipo de la nota de prueba confirmada el 16-10-2026 (06:16, Alex E.) en la demo.
