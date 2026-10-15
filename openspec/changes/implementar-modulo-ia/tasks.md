## 1. Paquete `@toqui/ia`

- [ ] 1.1 Crear `packages/ia/package.json` espejo de `packages/shared/package.json` (nombre `@toqui/ia`, `private`, `"type": "module"`, `main`/`types`/`exports` hacia `dist/`, scripts `build`, `typecheck` y `test`), con dependencias `@toqui/shared` (`workspace:*`), `zod` (`catalog:`) y `@aws-sdk/client-bedrock-runtime`, y `typescript` y `vitest` (`catalog:`) como dev
- [ ] 1.2 Crear `packages/ia/tsconfig.json` y `packages/ia/tsconfig.build.json` equivalentes a los de `packages/shared` (NodeNext, `rootDir: src`, `outDir: dist`, build con declaraciones y sin `*.test.ts`)
- [ ] 1.3 Ejecutar `pnpm install` en la raíz y confirmar que `pnpm-lock.yaml` solo cambia por el paquete nuevo; no tocar `pnpm-workspace.yaml` (ya incluye `packages/*`)
- [ ] 1.4 Crear `packages/ia/src/index.ts` que reexporte la API pública definida en `design.md` D2; comprobar con `pnpm --filter @toqui/ia build` que genera `dist/index.js` y `dist/index.d.ts`

## 2. Tipos, errores y validación

- [ ] 2.1 Implementar `proveedor.ts` con `ManifestacionCatalogo`, `ContextoExtraccion`, `FormatoImagen`, `IaProvider`, `ConfigIa`, las constantes `MINIMO_TEXTO` (20), `MAXIMO_MANIFESTACIONES` (5), `SIN_TEXTO` y `TAMANO_MAXIMO_IMAGEN` (3,75 MB), y la función `borradorInsuficiente`
- [ ] 2.2 Implementar `errores.ts` con `ErrorIa` (`name = 'ErrorIa'`, campo `codigo`: `FOTO_NO_VALIDA`, `GUARDRAIL_NO_DISPONIBLE`, `CONFIGURACION_INVALIDA`)
- [ ] 2.3 Implementar `validacion.ts`: `PropuestaSchema` (zod), `ubicarCita` tolerante a mayúsculas, espacios repetidos y comillas o puntuación en los extremos, y `validar(propuesta, texto, contexto, opciones?)` que comprueba formato, nivel presente en el catálogo, entre 1 y `maxManifestaciones` sin repetir, ids del catálogo, todas del nivel propuesto y cita presente, devolviendo `{ ok, borrador | problemas }`; sin constantes de cantidad de niveles ni nombres de núcleos
- [ ] 2.4 Pruebas de `validar` y `ubicarCita`: propuesta válida, id inexistente, niveles mezclados, nivel fuera del catálogo, cita ausente, cita con diferencias menores, seis manifestaciones, repetidas, `evidenciaInsuficiente` que ignora el resto; con el catálogo del dataset (9×5) y con uno sintético de 8 niveles × 10 núcleos de nombres inventados

## 3. Normalización a texto

- [ ] 3.1 Implementar `normalizacion.ts` con `normalizarTexto` (recorta, colapsa espacios y saltos repetidos, NFC, sin alterar mayúsculas ni puntuación) y `textoDeTranscripcion` (lee `results.transcripts[].transcript`, une, recorta; cadena vacía si no hay; error claro si el JSON es inválido)
- [ ] 3.2 Pruebas de ambos con los ejemplos de la especificación (incluida la transcripción vacía y el JSON inválido)

## 4. Proveedor `fake`

- [ ] 4.1 Implementar `fake.ts` con `ProveedorFake`: puntuación por coincidencia de palabras (minúsculas, sin tildes, prefijo de 5 caracteres, ignorando palabras de menos de 4 letras) contra las manifestaciones del `nivelEsperado`; elige la de mayor puntaje con mínimo de 2 coincidencias y desempate por `id`; cita = primera oración de la nota (máx. 160 caracteres) ubicada con `ubicarCita`; evidencia insuficiente si el texto es corto o nada alcanza el mínimo; `proveedor: 'fake'` sin `modelo`; `normalizarFoto` devuelve una de dos lecturas fijas elegida por una semilla de los bytes
- [ ] 4.2 Pruebas: determinismo, el resultado supera `BorradorEntranteSchema.parse` y `validar`, sin coincidencias, texto corto, núcleos desconocidos, y la nota «Apiló cuatro bloques solo y aplaudió cuando no se cayeron» contra `MAN-L07-MF-01`

## 5. Proveedor `bedrock`

- [ ] 5.1 Implementar `prompt.ts`: mensaje de sistema (estimación pedagógica para revisión de la educadora, no diagnóstico, no inferir más allá de lo escrito, citas literales, `evidenciaInsuficiente` si no hay respaldo, los textos entre llaves como `{NAME}` son datos anonimizados), esquema JSON de la herramienta `registrar_borrador`, `mensajeExtraccion(texto, contexto)` con edad, nivel esperado, catálogo agrupado por nivel con su núcleo tal como viene, y nota entre delimitadores; instrucción de lectura de foto sin nombres ni rasgos físicos
- [ ] 5.2 Implementar `bedrock.ts` con `ProveedorBedrock` según `design.md` D4 a D7: texto corto sin llamadas; `ApplyGuardrail` (`source: 'INPUT'`) con falla cerrada (`GUARDRAIL_NO_DISPONIBLE` si intervino sin texto, sin continuar con el original); `ConverseCommand` con herramienta y `toolChoice: { auto: {} }`; validación con `validar`; un reintento enviando los problemas (`toolResult` con `status: 'error'` o texto si no hubo `toolUse`); evidencia insuficiente tras el segundo fallo o una respuesta sin contenido; propagación sin envolver de los errores del SDK
- [ ] 5.3 Implementar `mapearCita` (`design.md` D5): convertir marcadores `\{[A-Za-z0-9_-]+\}` en `.+?` dentro de una expresión regular escapada, insensible a mayúsculas y a espacios repetidos, y devolver el fragmento tal cual está en el texto original; devolver el borrador con `textoFuente` original, `proveedor: 'bedrock'` y `modelo`
- [ ] 5.4 Implementar `normalizarFoto` de Bedrock: validar formato (`jpeg`/`png`) y tamaño antes de llamar y lanzar `ErrorIa('FOTO_NO_VALIDA')` con mensaje legible; `ConverseCommand` multimodal con bytes de la imagen; devolver el texto o `(sin texto reconocible)` si viene vacío
- [ ] 5.5 Implementar `crearProveedor(config)` en `index.ts` o `fabrica.ts`: `fake` o `bedrock`; `bedrock` exige `guardrail` salvo `sinGuardrail: true` (`CONFIGURACION_INVALIDA`); no leer `process.env`; aceptar `cliente` inyectable
- [ ] 5.6 Pruebas con cliente simulado (`send` que responde según el tipo de comando): anonimización antes del modelo y citas mapeadas al original, solicitud sin identificadores (inspeccionar el comando enviado), reintento con problemas, dos fallos con evidencia insuficiente, texto corto sin llamadas, Guardrail sin resultado, Guardrail sin cambios, falta de Guardrail en la configuración, foto muy pesada y de formato inválido, foto sin actividad, respuesta sin herramienta, propagación de `ThrottlingException` sin consumir el reintento, y el mensaje de sistema no diagnóstico

## 6. Verificación

- [ ] 6.1 Prueba opcional contra Bedrock real (`describe.skipIf(!process.env.RUN_BEDROCK_LIVE)`) con `AWS_PROFILE=toqui`, `BEDROCK_GUARDRAIL_ID` y `BEDROCK_GUARDRAIL_VERSION` de `pnpm aws:env`, con una nota sintética; ejecutarla si hay credenciales, anotar el resultado (incluido si el modelo acepta `toolChoice` forzado) en las notas de `definir-mvp-e1` y no ejecutarla en CI
- [ ] 6.2 Ejecutar desde la raíz `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm contract` (este último no debe generar diferencias en `apps/api/openapi.json` ni en `apps/web/src/api/generated`); corregir lo que falle dentro de `packages/ia`
- [ ] 6.3 Confirmar con `git diff --stat main` que el cambio solo toca `packages/ia/`, `pnpm-lock.yaml`, `openspec/changes/` y la documentación; no se modifica `apps/`, `infra/` ni `packages/shared/`

## 7. Documentación y cierre

- [ ] 7.1 Agregar al README una sección de `packages/ia` con propósito, API pública resumida, el hecho de que hoy solo la Lambda lo usará y los comandos verificados (`pnpm --filter @toqui/ia build|typecheck|test` y la prueba opcional con `RUN_BEDROCK_LIVE=1`); no inventar comandos
- [ ] 7.2 Agregar «Notas de implementación» a `openspec/changes/definir-mvp-e1/tasks.md` para 4.3, 4.4 y 4.7 (qué quedó en `packages/ia`, qué falta para la Persona C y la B) y marcarlas solo si corresponde a lo realmente implementado y probado
- [ ] 7.3 Ajustar en `openspec/changes/definir-mvp-e1/design.md` las decisiones D7 y D8 para reflejar: Guardrail antes de Claude, texto original persistido con citas mapeadas, `crearProveedor` con configuración explícita, y que la API de Nest no usa el módulo por ahora
- [ ] 7.4 Ejecutar `openspec validate implementar-modulo-ia --strict --no-interactive` y dejar el resultado sin errores
- [ ] 7.5 Entregar a la Persona C: la firma final (copiar el bloque de `design.md` D2 actualizado si cambió algo) y la lista de errores transitorios que Step Functions debe reintentar
