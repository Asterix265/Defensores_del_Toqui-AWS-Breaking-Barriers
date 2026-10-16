# Tasks

## 1. Bloqueantes

- [x] 1.1 Cuerpo desplazable y pie fijo en cada paso de `NuevaNota` y `SubirArchivo` (D1). Verificar con una prueba de revisión en el diálogo de PC que el botón «Está bien» existe y se puede usar.
- [x] 1.2 Hook `useVistaConHistorial` en `historial.ts` y uso en `RegistroApp` y `PanelSalas` (D2). Verificar con pruebas de «Volver de la ficha en el celular» y «Cerrar el diálogo en PC».
- [x] 1.3 `ConfirmarSalida` y estado en curso en `NuevaNota` y `NuevaNotaEscritorio` (D3). Verificar con pruebas de «Clic fuera del diálogo durante la grabación» y «Cerrar la revisión».

## 2. Errores visibles

- [x] 2.1 Correo sin desbordar en `TablaNotas`. Verificar con un correo largo a 1000 px.
- [x] 2.2 Etiqueta del texto según `procesamiento.simulado`. Verificar con pruebas de «Transcripción real» y «Procesamiento simulado».
- [x] 2.3 «Notas en las 8 áreas» a partir de `NUCLEOS.length` y scroll al inicio al cambiar de pantalla. Verificar con una prueba de la tarjeta.

## 3. Producto

- [x] 3.1 `RevisarCaptura`: «Mis notas» la abre en el celular y «Por revisar» en el panel (D4). Verificar con pruebas de «Retomar en el celular» y «Retomar en PC».
- [x] 3.2 Aviso de procesamiento breve, con detalles técnicos plegados.
- [x] 3.3 Detalle de solo lectura al abrir una fila de la tabla de notas.

## 4. Pulido

- [x] 4.1 Encabezados y filtros que pasan a una segunda línea entre 900 y 1100 px, y tabla sin columnas aplastadas.
- [x] 4.2 Salas en orden Sala Cuna → Nivel Medio → Transición (`ordenarSalas`). Verificado con una prueba unitaria. *Decisión*: el panel sigue partiendo en «Todas las salas», porque «Notas de las salas» es la vista de todo el jardín; filtrar por la sala propia por defecto ocultaría las notas de las demás.
- [x] 4.3 `viewport-fit=cover` en `index.html`.

## 5. Documentación e integración

- [x] 5.1 README: Atrás, retomar notas y «Por revisar».
- [x] 5.2 Correr `pnpm lint`, `pnpm format:check`, `pnpm --filter @toqui/web typecheck`, `pnpm --filter @toqui/web test` y `pnpm --filter @toqui/web build` sin errores. Revisado en Chrome a 1280 px (diálogo con scroll y pie fijo, Escape y Atrás con confirmación, «Por revisar») y a 606 px en vista de celular (Atrás desde la ficha, retomar en «Mis notas»). Pendiente: revisar a 360 px en un celular real.

## Workflow follow-up

- Validar con `openspec validate corregir-interfaz-web --strict --no-interactive`.
- Probar Atrás en el celular real (Android e iOS) antes de archivar.
