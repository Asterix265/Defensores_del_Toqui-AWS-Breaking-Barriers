# Tasks

## 1. Piezas compartidas

- [x] 1.1 Exportar `AreasNino` y `UltimasNotas` desde `FichaNino.tsx` y usarlas en la ficha móvil. Verificar que las pruebas de `FichaNino.test.tsx` siguen pasando sin cambios.
- [x] 1.2 Separar `ChipsSala` de `FiltrosPanel`, con la cantidad definida por quien lo usa. Verificar que las pruebas de `PanelSalas.test.tsx` siguen pasando.
- [x] 1.3 Agregar `ninoId` opcional a `NuevaNotaEscritorio` y pasarlo a `NuevaNota`.

## 2. Pestañas y navegación

- [x] 2.1 Agregar a `CabeceraPanel` las pestañas «Mi sala» · «Mis notas» con los íconos del celular, y a `PanelSalas` el estado `seccion`, `ninoAbierto`, `sala` compartida y `nueva`. Mover la vista de notas a `panel/NotasSalas.tsx`. Verificar con pruebas de «Vista inicial», «Cambiar a Mi sala» y «Sala compartida entre pestañas».

## 3. Mi sala y ficha en escritorio

- [x] 3.1 Crear `panel/SalaEscritorio.tsx` con tarjetas por niño o niña («N áreas sin notas»), agrupadas por sala con «Todas las salas». Verificar con pruebas de «Filtrar Mi sala», «Todas las salas agrupadas» y «Áreas sin notas».
- [x] 3.2 Crear `panel/FichaEscritorio.tsx` en dos columnas (áreas y últimas notas), con volver a «Mi sala» y «Nueva nota para X». Verificar con pruebas de «Abrir la ficha», «Ver todas las notas», «Volver a Mi sala», «Pestaña Mi sala con una ficha abierta», «Nota desde la ficha» y «Nueva nota general».

## 4. Documentación e integración

- [x] 4.1 Actualizar el README («La web abre…») para describir las pestañas de escritorio.
- [ ] 4.2 Correr `pnpm lint`, `pnpm format:check`, `pnpm --filter @toqui/web typecheck`, `pnpm --filter @toqui/web test` y `pnpm --filter @toqui/web build` sin errores, y revisar en el navegador a 1280 px y a 900 px las dos pestañas y la ficha.

## 5. Vista general, métricas por sala y retroalimentación

- [x] 5.1 Agregar la pestaña «Vista general» (inicial para `directora`; `educadora` sigue partiendo en «Mis notas») con una fila por sala: niños y niñas, edades, nivel promedio simple, para revisar, sin nivel y notas de 7 días. Verificar con pruebas de «Vista inicial de la directora» y «Abrir una sala desde la vista general».
- [x] 5.2 Mostrar en «Mi sala» el nivel promedio simple (núcleos con nivel, igual peso) y las métricas de cada sala, y resaltar «para revisar» por rezago relativo. Verificar con pruebas de «Nivel promedio simple» y de `niveles.test.ts`.
- [x] 5.3 «Descargar CSV» en «Mi sala» y «Vista general», con `nivel_promedio_simple`, bloqueado con datos incompletos. Verificar con la prueba de «Trayectoria que no carga».
- [x] 5.4 Retroalimentación por área en la ficha según la nota más reciente, sin niveles. Verificar con `sugerencias.test.ts` y «Abrir la ficha».
- [x] 5.5 Validar con corepack. Resultado del 16-10-2026: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build` y `corepack pnpm format:check` sin errores. En `corepack pnpm test`, `apps/web` pasa 13 archivos y 100 pruebas; el resto pasa salvo `apps/api/test/registro.e2e.spec.ts`, que necesita Postgres en `127.0.0.1:5432` (falla del entorno). Las del front también pasan solas con `corepack pnpm --filter @toqui/web test`. Con varias corridas de pruebas en paralelo en la misma máquina aparecen timeouts de 5 s, también en `main`.

## Workflow follow-up

- Validar con `openspec validate vista-nino-escritorio --strict --no-interactive`.
