# Tasks

## 1. Scroll bloqueado

- [x] 1.1 Prueba que reproduce el `overflow: hidden` del `body` después de guardar una nota en PC y en el celular (D6). *Resultado*: no se reprodujo con el código de `main` (07039b5, publicado en Amplify a las 08:08 del 16-10-2026, que ya trae el diálogo con scroll de `corregir-interfaz-web`); en Chrome a 1366 px el `body` queda sin `overflow: hidden` al guardar. Queda `scroll.test.tsx` como regresión.
- [ ] 1.2 (Solo si se reproduce en la versión publicada) Cierre con transición (`open={false}` y desmontaje en `onExited`) en `NuevaNotaEscritorio` y `DetalleNota`. Verificar que la prueba 1.1 pasa y revisar en Chrome a 1280 px.

## 2. Estado de salas (API y contrato)

- [x] 2.1 Esquemas en `packages/shared`: `EstadoSalaResponse`, `ResumenJardinResponse` y la alerta.
- [x] 2.2 `salas/reglas.ts`: última decisión válida, distribución, mediana, modas, alertas individuales y de sala (D1). Verificar con pruebas unitarias de los escenarios «Alerta con pares suficientes», «Pares insuficientes» y «Niño o niña sin decisión reciente».
- [x] 2.3 `GET /salas/estado` y `GET /jardin/resumen` (solo `directora`), con edades y notas de 30 días. Verificar con pruebas de «Sala de otro jardín» y «Educadora pide el resumen».
- [x] 2.4 `pnpm contract` para regenerar OpenAPI y orval.

## 3. Estado de salas (web)

- [x] 3.1 Estado de la sala en «Mi sala» (PC y celular): tarjetas por núcleo con distribución, mediana y cobertura, y niños o niñas con alerta resaltados (D2).
- [x] 3.2 `grupo` desde `GET /me`; pestaña «Jardín» para la directora, con tarjetas por sala y acceso al estado detallado; sin «Nueva nota» para la directora (D7).
- [x] 3.3 `csv.ts` con pruebas (separador, comillas, saltos de línea y BOM), y botones «Descargar CSV» en el estado de la sala, el jardín y la tabla de notas (D3).

## 4. Aprender de las correcciones

- [x] 4.1 `ejemplos` opcional en `MensajeCapturaSchema` (máximo 5).
- [x] 4.2 Consulta de ejemplos (`EjemplosService`) en `DespachadorService`, con `EJEMPLOS_CORRECCIONES` (por defecto 5) (D4). Verificar con pruebas de «Corrección previa en el mismo jardín», «Otro jardín» y «Ejemplos desactivados».
- [x] 4.3 `ContextoDesdeMensaje` en `apps/pipeline`, orden por coincidencia de palabras y `ejemplosUsados` en `procesamiento`. Verificar con pruebas de «Mensaje con ejemplos» y «Mensaje antiguo».
- [ ] 4.4 (Pendiente) Medición: 5 notas sintéticas parecidas a una corrección, clasificadas con y sin ejemplos (prueba en vivo opcional con `RUN_BEDROCK_LIVE=1`). Informar la cifra en el README.

## 5. Cuentas

- [x] 5.1 Módulo `cuentas` (listar, invitar, reenviar, desactivar y reactivar) con el cliente Cognito, `@Grupos('directora')`, jardín desde el token y 501 en `AUTH_MODE=local` (D5). Verificar con pruebas usando un cliente simulado: «Invitar a una educadora», «Jardín en el cuerpo», «Correo ya registrado» y «Cuenta de otro jardín».
- [x] 5.2 Permisos `cognito-idp` mínimos para el rol de tarea de la API en `app-stack.ts`, y su prueba en `prod-stacks.test.ts`. Revisar con `pnpm aws:prod:diff`.
- [x] 5.3 Web: pestaña «Equipo» (lista, invitar, desactivar o reactivar y reenviar).
- [x] 5.4 Web: pantalla «Crea tu contraseña» con `confirmSignIn`. Verificar con pruebas de «Primer ingreso con contraseña temporal» y «Contraseña que no cumple la política».

## 6. Documentación e integración

- [x] 6.1 README y `docs/guia-aws.md`: vista de la directora, alertas (reglas de demostración, no diagnóstico), CSV, aprendizaje con ejemplos y creación de cuentas (reemplaza el paso manual con `admin-create-user`).
- [x] 6.2 Correr `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` y `pnpm build` sin errores. Revisado en Chrome a 1366 px: «Mi sala» con estado por área (educadora) y «Jardín» y «Equipo» (directora, modo local).
- [x] 6.3 `openspec validate panel-directora-y-aprendizaje --strict --no-interactive`.
- [ ] 6.4 Después del despliegue: invitar una cuenta sintética en producción, ingresar con la contraseña temporal y revisar la vista «Jardín» con la directora de prueba.
