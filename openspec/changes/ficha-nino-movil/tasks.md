# Tasks

## 1. Resumen de áreas por niño o niña

- [x] 1.1 Agregar la función pura que, dadas las notas, un niño o niña y `ahora`, devuelve por área la cantidad de notas y la fecha de la última en los últimos 30 días, con las áreas sin notas primero. Verificar con pruebas Vitest que cubran un área con notas, un área sin notas y una nota de hace 40 días que no cuenta.
- [x] 1.2 Ajustar `notasDeEjemplo` para que al menos un niño o niña de la sala tenga notas en varias áreas y otra sin notas, de modo que la demo muestre ambos casos. Verificar que `datos.test.ts` y las pruebas existentes siguen pasando.

## 2. Pestaña «Mi sala»

- [x] 2.1 Extender `BarraInferior` a Inicio · Mi sala · (Grabar) · Mis notas, con Grabar centrado y áreas táctiles de 44 px o más. Verificar a 360 px de ancho en el navegador que nada se corta.
- [x] 2.2 Crear la pantalla «Mi sala» con los niños y niñas de `NINOS_DE_MI_SALA` y, en cada uno, «N áreas sin notas» cuando N > 0. Verificar con una prueba que solo aparecen niños y niñas de la sala y que el conteo coincide con el resumen de 1.1.

## 3. Ficha del niño o niña

- [x] 3.1 Crear la ficha según el diseño B: encabezado con volver a «Mi sala», avatar, nombre y botón de grabar; tarjetas de área (las sin notas primero, rotuladas como invitación a observar, sin niveles); y las 3 últimas notas con «Ver las N». Verificar con pruebas de los escenarios «Área con notas», «Área sin notas», «Ver todas las notas» y «Niño o niña sin notas».
- [x] 3.2 Agregar a `RegistroApp` las vistas `sala` y `ficha`, con «Mi sala» activa en la barra mientras se ve una ficha. Verificar con una prueba que interactuar con el ícono de un niño o niña en «Mi sala» abre su ficha.

## 4. Grabar con y sin niño o niña

- [x] 4.1 Agregar a `NuevaNota` la prop opcional `ninoId`, que salta la etapa de elegir niño o niña. Verificar con una prueba que, con `ninoId`, tras capturar se llega directo a la revisión con ese nombre.
- [x] 4.2 Llevar `ninoId` en la vista `nueva` solo desde el botón de la ficha y volver a la ficha al guardar o cancelar. Verificar con una prueba del escenario «Nota para el niño o niña en pantalla» que la nota aparece entre las últimas de la ficha.
- [x] 4.3 Reemplazar los textos de la interfaz con «Toca» en `NuevaNota.tsx` («Toca un niño o niña», «Toca para terminar») y `MisNotas.tsx` por «Elige a un niño o niña» y «Presiona…». Verificar que `grep -rn "Toca" apps/web/src` no encuentra nada y actualizar las pruebas que buscan esos textos.
- [x] 4.4 Verificar con una prueba del escenario «Grabar general con una ficha abierta» que Grabar de la barra, con una ficha abierta, lleva a elegir niño o niña sin nadie preseleccionado.

## 5. Documentación e integración

- [x] 5.1 Actualizar el README («La web abre…») para mencionar «Mi sala» y la ficha. Verificar que el texto describe lo que se ve en `pnpm dev`.
- [x] 5.2 Correr `pnpm lint`, `pnpm format:check`, `pnpm --filter @toqui/web typecheck`, `pnpm --filter @toqui/web test` y `pnpm --filter @toqui/web build` sin errores, y recorrer en el celular (DevTools) Mi sala → ficha → grabar → volver a la ficha, y ficha → Grabar de la barra → elegir niño o niña.

## Workflow follow-up

- Validar con `openspec validate ficha-nino-movil --strict --no-interactive`.
- Archivar el cambio después de la revisión del PR. `definir-mvp-e1` y `levantar-stack-base` siguen sin archivar; al archivar este, se crea `openspec/specs/ficha-nino/`.
