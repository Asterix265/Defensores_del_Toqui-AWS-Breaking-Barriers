# Tasks

## 1. Datos y grabación

- [x] 1.1 Agregar `ninosDeSala(sala)` en `datos.ts` y definir `NINOS_DE_MI_SALA` con ella. Verificar que las pruebas existentes siguen pasando.
- [x] 1.2 Hacer que `NuevaNota` busque al niño o niña preseleccionado en `NINOS`, sin cambiar la grilla de elección. Verificar con una prueba del escenario «Grabar desde la ficha de otra sala».

## 2. Selector de sala

- [x] 2.1 Reemplazar el subtítulo de `MiSala` por un selector (botón con chevron de 44 px o más y `Menu`) con las salas de `SALAS`, la cantidad de niños y niñas y «Tu sala» en la propia. Verificar con pruebas de «Ver otra sala» e «Identificar la sala propia».
- [x] 2.2 Guardar `salaVista` en `RegistroApp` (por defecto `SALA`) y pasarlo a `MiSala`. Verificar con pruebas de «Volver de una ficha de otra sala» y «Grabar general tras ver otra sala».

## 3. Documentación e integración

- [x] 3.1 Actualizar el README («La web abre…») para mencionar el cambio de sala. Verificar que el texto describe lo que se ve en `pnpm dev`.
- [x] 3.2 Correr `pnpm lint`, `pnpm format:check`, `pnpm --filter @toqui/web typecheck`, `pnpm --filter @toqui/web test` y `pnpm --filter @toqui/web build` sin errores, y revisar «Mi sala» a 360 px con el menú abierto y cerrado.

## Workflow follow-up

- Validar con `openspec validate cambiar-sala-movil --strict --no-interactive`.
- Archivar después de `ficha-nino-movil`, porque modifica un requisito que ese cambio crea.
