# Tasks

## 1. API

- [x] 1.1 `GET /niveles` con nombre y rango de edad de cada nivel, con prueba e2e
- [x] 1.2 Agregar `observaciones` (fecha, formato, origen, nivel, nota breve y manifestaciones) a la trayectoria, de la más reciente a la más antigua, con prueba e2e
- [x] 1.3 Tratar las variables de entorno vacías como no definidas, con prueba unitaria
- [x] 1.4 Regenerar `openapi.json` y el cliente orval con `pnpm contract`

## 2. Web

- [x] 2.1 `api.ts`: hooks de niños y niñas, catálogo, niveles y observaciones; errores HTTP como excepción
- [x] 2.2 Quitar de `datos.ts` las salas, los niños y las notas inventados; `Nota` con nivel, manifestaciones citadas y sugerencia
- [x] 2.3 `propuesta.ts`: nivel esperado por edad y manifestación del catálogo con cita
- [x] 2.4 Revisión con nivel (subir o bajar), manifestaciones (quitar o agregar del nivel, máximo 5) y evidencia insuficiente
- [x] 2.5 Ficha y «Mi sala» con las observaciones de la API más las notas de la sesión
- [x] 2.6 «Mis notas», panel de escritorio y reporte CSV con nivel y manifestaciones
- [x] 2.7 Pantallas de carga y de error de la API
- [x] 2.8 Pruebas Vitest con MSW y fixtures sintéticos

## 3. Pendiente (siguientes cambios)

- [ ] 3.1 Guardar las notas confirmadas en la API (síncrono, o con `POST /capturas` cuando exista el procesamiento)
- [ ] 3.2 Procesamiento real: captura → borrador de la IA en la API, reemplazando `propuesta.ts`
- [ ] 3.3 Sala e identidad de la educadora desde `/me` (con Cognito)
- [ ] 3.4 Grabación de audio y foto reales

## 4. Verificación

- [x] 4.1 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, pruebas de la API y de la web, y build de la web
- [x] 4.2 Probar la API local a través del proxy de Vite (`/api/ninos`, `/api/niveles`, `/api/ninos/:id/trayectoria`)
- [ ] 4.3 Recorrer el flujo en el navegador con la base local

## Workflow follow-up

- Validar con `openspec validate conectar-web-api --strict --no-interactive`.
- Archivar después de `ficha-nino-movil` y `cambiar-sala-movil`, porque modifica requisitos de `ficha-nino` que esos cambios crean y modifican.
