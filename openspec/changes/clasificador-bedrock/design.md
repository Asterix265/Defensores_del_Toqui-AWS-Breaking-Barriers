## Context

- Flujo vigente en `main` (cambio `cola-ia-y-amplify`): la API encola cada captura en SQS y la Lambda `toqui-prod-proceso` (`apps/pipeline`) ejecuta `procesarCaptura` (`apps/pipeline/src/orquestador.ts`): normalizar (Transcribe o Textract) → **anonimizar** con el Guardrail (falla cerrada) → recuperar contexto → **clasificar** → validar → entregar a `POST /interno/capturas/:id/borrador`.
- El orquestador solo conoce **puertos** (`apps/pipeline/src/puertos.ts`). El puerto `Clasificador` es:

  ```ts
  interface Clasificador {
    readonly proveedor: string;
    readonly modelo?: string;
    clasificar(entrada: EntradaClasificacion): Promise<unknown>; // salida CRUDA del modelo
  }
  interface EntradaClasificacion {
    textoFuente: string;      // ya anonimizado; las citas deben salir literalmente de aquí
    edadMeses: number;
    nivelEsperado: number;
    catalogo: Manifestacion[]; // las únicas que se pueden proponer (catálogo completo del mensaje)
    contexto: { conocimiento: string[]; ejemplos: { textoFuente: string; nivel: number; idsManifestaciones: string[] }[] };
    correccion?: string[];    // problemas del intento anterior
  }
  ```

- El orquestador valida lo que devuelve el clasificador con `validarClasificacion` (`apps/pipeline/src/validacion.ts`) y, si hay problemas, vuelve a llamar con `correccion` (hasta 2 intentos); si vuelve a fallar entrega «evidencia insuficiente». Los errores que lanza el clasificador **se propagan**: el handler `proceso` los trata como transitorios y SQS reintenta (hasta `maxReceiveCount: 3`). **`validarClasificacion` exige esta forma exacta**: `{ nivelSugerido: 1..9 | null, evidenciaInsuficiente: boolean, manifestaciones: { idManifestacion, cita }[] (máx. 5) }`; con evidencia insuficiente, `nivelSugerido` debe ser `null` y la lista vacía; sin ella, debe haber nivel y al menos una manifestación, todas del nivel sugerido, y cada `cita` debe cumplir `textoFuente.includes(cita)` (comparación **exacta**).
- Hoy el único proveedor es `ClasificadorFake` (`apps/pipeline/src/ia/fake.ts`); `config.ts` define `IA_PROVIDER: z.enum(['fake'])` y `dependencias.ts#crearIa` solo tiene el caso `fake`. La Lambda **ya tiene** `bedrock:InvokeModel` (modelos Anthropic y perfiles de inferencia) y `bedrock:ApplyGuardrail`, y `infra/lib/app-stack.ts` fija `IA_PROVIDER: 'fake'`, un `timeout` de 120 s y `MODELOS.extraccion = 'us.anthropic.claude-sonnet-5'`.
- `@toqui/ia` (`packages/ia`, PR #19) ya contiene lo que hace falta, pero **no exportado**: `NOMBRE_HERRAMIENTA`, `SISTEMA_EXTRACCION`, `HERRAMIENTA_BORRADOR` (esquema JSON de la herramienta `registrar_borrador`, con campos `evidenciaInsuficiente`, `nivel` y `manifestaciones`), `mensajeExtraccion`, `etiquetaNota` y `ubicarCita` (tolerante a mayúsculas, espacios repetidos y comillas en los extremos; devuelve el fragmento tal cual está en el texto). `index.ts` solo exporta `crearProveedor`, `ErrorIa`, `normalizarTexto`, `textoDeTranscripcion`, `validar` y tipos. **Ojo**: la herramienta devuelve `nivel`, mientras que el puerto espera `nivelSugerido`.
- `@toqui/ia` tiene `"main": "./dist/index.js"`: otro paquete que lo importe necesita que su `dist/` exista (como `@toqui/shared`). Hoy la CI compila solo `@toqui/shared` antes de los tipos y las pruebas.
- Audio: `TranscriptorAws` espera hasta 90 s a Transcribe (la Lambda tiene 120 s). Con Claude después (hasta dos llamadas), 120 s no alcanza.
- Plazo: cierre de código el 16-10-2026 a las 10:15. Prioridad: que `bedrock` esté **listo y probado con cliente simulado**, y activarlo en producción solo tras la prueba en vivo.

## Goals / Non-Goals

**Goals:**

- Que la Lambda pueda clasificar con Claude eligiendo `IA_PROVIDER=bedrock`, sin tocar el orquestador, el handler ni los demás adaptadores.
- Reutilizar el prompt y la herramienta de `@toqui/ia` en vez de duplicarlos.
- Que la salida del adaptador pase `validarClasificacion` en el primer intento cuando el modelo cita casi literalmente.
- Que `fake` siga siendo el valor por defecto en local y en producción hasta la prueba en vivo.
- Que activar `bedrock` en producción sea un cambio de una línea, reversible sin redesplegar.

**Non-Goals:**

- Cambiar el orquestador, la validación, el Guardrail, el handler, la API, la web o `packages/shared`.
- Leer fotos con Claude (`LECTOR_FOTO=ia` con `bedrock` se rechaza; la foto la lee Textract).
- Memoria y base de conocimiento (el prompt solo **acepta** esos datos cuando existan).
- Registrar tokens consumidos o costo por nota.
- Desplegar, o ejecutar la prueba en vivo contra Bedrock.
- Modificar `ProveedorBedrock` ni `crearProveedor`, que siguen como están (otro consumidor futuro, p. ej. el modo inline de la API).

## Decisions

### D1. Función de bajo nivel en `@toqui/ia`: `clasificarConClaude`

Archivo nuevo `packages/ia/src/clasificador.ts`, exportado desde `packages/ia/src/index.ts`.

```ts
export interface EjemploCaso {
  textoFuente: string;
  nivel: number;
  idsManifestaciones: string[];
}

/** Entrada de la clasificación. Nombres alineados con el puerto `Clasificador` de apps/pipeline. */
export interface EntradaClaude {
  /** Texto YA anonimizado: las citas deben salir literalmente de aquí. */
  textoFuente: string;
  edadMeses: number;
  nivelEsperado: number;
  catalogo: ManifestacionCatalogo[];
  /** Fragmentos de la base de conocimiento (máximo 5; opcional). */
  conocimiento?: string[];
  /** Casos parecidos del mismo jardín (máximo 5; opcional). */
  ejemplos?: EjemploCaso[];
  /** Problemas del intento anterior, para que el modelo los corrija (opcional). */
  correccion?: string[];
}

export interface OpcionesClaude {
  /** Tiempo máximo de la llamada a Converse. Por defecto 60 000 ms. */
  tiempoMaximoMs?: number;
}

/** Devuelve la salida cruda con la forma de `validarClasificacion`; NO la valida. */
export async function clasificarConClaude(
  cliente: Pick<BedrockRuntimeClient, 'send'>,
  modelo: string,
  entrada: EntradaClaude,
  opciones?: OpcionesClaude,
): Promise<unknown>;
```

Comportamiento, en este orden:

1. Construye `system` y el mensaje de usuario con las funciones de D2.
2. Llama **una vez** a `ConverseCommand`:
   `{ modelId: modelo, system: [{ text }], messages: [{ role: 'user', content: [{ text }] }], toolConfig: { tools: [{ toolSpec: HERRAMIENTA_BORRADOR }], toolChoice: { auto: {} } }, inferenceConfig: { maxTokens: 1500 } }`.
   Usa `cliente.send(comando, { abortSignal: AbortSignal.timeout(tiempoMaximoMs ?? 60_000) })`. `toolChoice` queda en `auto` porque `us.anthropic.claude-sonnet-5` rechaza forzar la herramienta (pendiente de confirmar en la prueba en vivo).
3. Busca el bloque `toolUse` con `name === NOMBRE_HERRAMIENTA` en `output.message.content`. Si no hay (el modelo respondió solo texto) o su `input` no es un objeto, devuelve `{}`: el orquestador lo verá como respuesta inválida y reintentará con `correccion`.
4. **Normaliza** el objeto (D3) y lo devuelve.

No hay Guardrail, validación ni reintento aquí: eso ya lo hace el orquestador. Los errores del SDK **no se capturan**.

- *Alternativa:* usar `ProveedorBedrock.extraer`. Se descarta: repetiría Guardrail (ya aplicado por el orquestador), validación y reintento, hasta 4 llamadas al modelo por nota, y devolvería un borrador completo en vez de la salida cruda que pide el puerto.
- *Alternativa:* copiar el prompt a `apps/pipeline`. Se descarta: dos copias divergirían.

### D2. Prompt con el contexto del puerto

En `packages/ia/src/prompt.ts` se agregan (sin cambiar `mensajeExtraccion`, `SISTEMA_EXTRACCION` ni sus pruebas actuales):

- `sistemaClasificacion(entrada: EntradaClaude): string`: devuelve `SISTEMA_EXTRACCION` y, solo si hay datos, agrega una línea por cada tipo:
  - con `conocimiento` no vacío: «Recibes fragmentos de la base de conocimiento del catálogo (descripciones de niveles y núcleos): úsalos solo como contexto, nunca como fuente de citas.»
  - con `ejemplos` no vacío: «Recibes casos parecidos de decisiones previas de educadoras del mismo jardín: úsalos como referencia, sin copiar su nivel si la nota actual describe otra cosa.»
  - con `correccion` no vacío: «Tu intento anterior no fue válido; corrige los problemas indicados.»
- `mensajeClasificacion(entrada: EntradaClaude): string`: igual que `mensajeExtraccion` (edad, nivel esperado, catálogo agrupado por nivel con su núcleo, nota delimitada con `etiquetaNota`), con estas secciones **opcionales** antes de la nota, en este orden:
  1. `Fragmentos de la base de conocimiento (contexto, no fuente de citas):` y una línea `- {fragmento}` por cada uno (máximo 5; cada uno recortado a 800 caracteres con `…`).
  2. `Casos parecidos de decisiones previas del jardín (referencia):` y una línea `- Nota: «{textoFuente recortado a 400 caracteres}» → nivel {nivel}, manifestaciones {ids separados por coma}` (máximo 5).
  3. `Tu intento anterior no fue válido. Corrige estos problemas y vuelve a llamar a la herramienta registrar_borrador:` y una línea `- {problema}` por cada uno.

  Refactoriza lo común (catálogo y delimitación) en funciones internas compartidas con `mensajeExtraccion`; la salida de `mensajeExtraccion` debe quedar **idéntica byte a byte** (las pruebas actuales lo verifican).

Solo se toman campos explícitos de la entrada: nunca ids de captura, jardín, usuario ni niño o niña.

### D3. Normalización de la salida del modelo

Dentro de `clasificarConClaude`, sobre una copia superficial del `input` de la herramienta:

1. Si trae `nivel` y no trae `nivelSugerido`, copia el valor a `nivelSugerido`; elimina `nivel`.
2. Si `evidenciaInsuficiente === true`: fuerza `nivelSugerido = null` y `manifestaciones = []` (igual que `validar` de `@toqui/ia`, que ignora lo demás en ese caso). Así un modelo que marca evidencia insuficiente pero deja una manifestación suelta no cae en un reintento inútil.
3. Si `manifestaciones` es un arreglo, cada elemento con `cita` de tipo `string` se reemplaza por `ubicarCita(cita, textoFuente) ?? cita`: el fragmento **literal** del texto cuando se encuentra (tolerando mayúsculas, espacios repetidos y comillas o puntuación en los extremos) y, si no se encuentra, la cita original, para que `validarClasificacion` la rechace y el modelo pueda corregir.
4. No toca ningún otro campo ni inventa valores faltantes: si falta `evidenciaInsuficiente` o `nivelSugerido`, lo reportará la validación del orquestador.

### D4. Adaptador `ClasificadorBedrock`

Archivo nuevo `apps/pipeline/src/ia/bedrock.ts`:

```ts
export class ClasificadorBedrock implements Clasificador {
  readonly proveedor = 'bedrock';
  constructor(
    private readonly cliente: Pick<BedrockRuntimeClient, 'send'>,
    readonly modelo: string,
  ) {}

  clasificar(entrada: EntradaClasificacion): Promise<unknown> {
    return clasificarConClaude(this.cliente, this.modelo, {
      textoFuente: entrada.textoFuente,
      edadMeses: entrada.edadMeses,
      nivelEsperado: entrada.nivelEsperado,
      catalogo: entrada.catalogo,
      conocimiento: entrada.contexto.conocimiento,
      ejemplos: entrada.contexto.ejemplos,
      correccion: entrada.correccion,
    });
  }
}
```

`proveedor = 'bedrock'` y `modelo` son lo que `declararProcesamiento` y el borrador usan para rotular la extracción como «completada» (no simulada). El adaptador **no** captura errores: los del SDK suben tal cual y el handler los reintenta.

### D5. Configuración y selección del proveedor

- `apps/pipeline/src/config.ts`: `IA_PROVIDER: z.enum(['fake', 'bedrock']).default('fake')` y `MODELO_EXTRACCION: z.string().min(1).default('us.anthropic.claude-sonnet-5')` (mismo nombre estilo que `GUARDRAIL_ID` y `BUCKET_CAPTURAS`; el valor por defecto coincide con `MODELOS.extraccion` de la infraestructura). Se agrega un `.refine` que rechaza `IA_PROVIDER=bedrock` con `LECTOR_FOTO=ia` y el mensaje «La lectura de fotos con IA no está disponible con bedrock: usa LECTOR_FOTO=textract».
- `apps/pipeline/src/dependencias.ts`: se crea **un solo** `BedrockRuntimeClient` por contenedor y se comparte entre `AnonimizadorGuardrail` y `ClasificadorBedrock`. `crearIa` recibe ese cliente y agrega el caso `bedrock` → `{ clasificador: new ClasificadorBedrock(cliente, env.MODELO_EXTRACCION) }`. Para `bedrock` no hay `lectorImagen` propio: como la configuración ya prohíbe `LECTOR_FOTO=ia` con `bedrock`, `crearDependencias` siempre usa Textract en ese caso (hágase explícito el tipo: `lectorImagen` opcional en el resultado de `crearIa`, y un error claro si `LECTOR_FOTO=ia` y no hay lector).
- El comentario de `crearIa` («Para integrar Claude en Bedrock: agregar `bedrock`…») se reemplaza por uno que describa el estado real.

### D6. Build y CI: `@toqui/ia` antes que `@toqui/pipeline`

`apps/pipeline/package.json` agrega `"@toqui/ia": "workspace:*"`. Como `@toqui/ia` resuelve a `dist/`, hay que compilarlo antes de tipos, pruebas y empaquetado:

- `.github/workflows/ci.yml`, paso «Preparar paquetes generados»: `pnpm --filter "@toqui/ia..." build && pnpm --filter @toqui/api prisma:generate` (el filtro `...` compila `@toqui/ia` y sus dependencias, `@toqui/shared`).
- `package.json` raíz: `setup` usa `pnpm --filter "@toqui/ia..." build` en lugar de solo `@toqui/shared`; `aws:prod:deploy` usa `pnpm --filter "@toqui/pipeline..." build` en lugar de `@toqui/shared build && @toqui/pipeline build`. `dev`, `db:seed` y `contract` no cambian (la API y la web no usan `@toqui/ia`).
- `apps/pipeline/build.mjs` **no cambia**: esbuild empaqueta `@toqui/ia` dentro de `proceso.mjs` y mantiene `@aws-sdk/*` como `external` (el runtime de Lambda ya lo incluye).

### D7. Infraestructura: activación controlada

En `infra/lib/app-stack.ts`:

- Nueva constante exportada, junto a `MODELOS`:

  ```ts
  /** Proveedor de IA de la Lambda de proceso. Pasar a 'bedrock' solo tras la prueba en vivo. */
  export const IA_PROVIDER_PROCESO: 'fake' | 'bedrock' = 'fake';
  ```

- En el `environment` de la Lambda: `IA_PROVIDER: IA_PROVIDER_PROCESO` y `MODELO_EXTRACCION: MODELOS.extraccion`.
- `timeoutProceso`: de `Duration.seconds(120)` a `Duration.seconds(180)`. El `visibilityTimeout` de la cola ya se calcula como 6 veces el `timeout` (pasa de 720 s a 1080 s) y no necesita otro cambio. Motivo: audio = hasta 90 s de Transcribe + Guardrail + hasta dos llamadas a Claude de hasta 60 s.
- Permisos: **sin cambios** (la Lambda ya puede invocar Claude y aplicar el Guardrail).
- En `infra/lib/prod-stacks.test.ts`: la prueba de la Lambda comprueba `IA_PROVIDER` igual a `IA_PROVIDER_PROCESO`, la presencia de `MODELO_EXTRACCION` y el nuevo `Timeout` de 180; la de la cola, el nuevo `VisibilityTimeout` de 1080.
- **No se despliega** en este cambio.

### D8. Errores y reintentos (resumen del comportamiento resultante)

| Situación | Qué ocurre |
|---|---|
| Claude responde válido | Se entrega el borrador con `proveedor: 'bedrock'` y `modelo` |
| Respuesta sin herramienta, con ids o niveles inválidos o citas no localizables | `validarClasificacion` la rechaza; el orquestador llama de nuevo con `correccion` (2 intentos en total); si falla, evidencia insuficiente |
| `ThrottlingException`, `ServiceUnavailableException`, `ModelTimeoutException`, `InternalServerException`, expiración del `AbortSignal` (60 s) | Se propaga; el handler la trata como transitoria y SQS reintenta el mensaje (hasta 3 veces; el último intento informa error a la educadora) |
| `AccessDeniedException` o `ValidationException` (p. ej. modelo no habilitado) | Se propaga igual; tras los intentos la educadora ve «No se pudo procesar la nota». No se trata aparte |

### D9. Prueba en vivo opcional

`packages/ia/src/clasificador.live.test.ts`, con `describe.skipIf(process.env.RUN_BEDROCK_LIVE !== '1')`. Usa `new BedrockRuntimeClient({ region: 'us-east-1' })` con el perfil de `AWS_PROFILE` y el modelo de `BEDROCK_MODEL_EXTRACCION` (por defecto `us.anthropic.claude-sonnet-5`). Casos: una nota con una conducta clara (espera propuesta válida, citas literales), una nota sin conducta («participó bien», espera evidencia insuficiente) y una nota con una etiqueta `</nota>` (no debe romper). Imprime el nivel y las manifestaciones propuestas **sin** el texto de la nota. **Quien implementa no la ejecuta**: la ejecuta quien revisa, con aviso por el costo (centavos).

## Guía de implementación (reglas para quien aplique este cambio)

- **Rutas permitidas**: `packages/ia/**`, `apps/pipeline/**`, `infra/lib/app-stack.ts`, `infra/lib/prod-stacks.test.ts`, `package.json` (raíz, solo los scripts `setup` y `aws:prod:deploy`), `.github/workflows/ci.yml`, `pnpm-lock.yaml`, `README.md`, `docs/arquitectura-aws.md`, `openspec/changes/clasificador-bedrock/tasks.md` (marcar tareas) y `openspec/changes/cola-ia-y-amplify/tasks.md` (solo una nota en la tarea 4.2). **Prohibido** tocar `apps/api`, `apps/web`, `packages/shared`, `infra/scripts` y el resto de `infra/lib`. Si algo parece exigirlo, detenerse y preguntar.
- No hacer commits, `git push` ni abrir PR: dejar los cambios sin commitear.
- **No ejecutar** nada contra AWS: ni la prueba en vivo, ni `aws ...`, ni despliegues, ni `pnpm aws:*`. No leer ni escribir credenciales; no agregar `.env`.
- El log nunca incluye el texto de la nota, las citas ni nombres (ver `registro-log.ts`). Datos de prueba sintéticos, con nombres y RUT obviamente ficticios.
- Todo en español (comentarios y mensajes), imports internos con extensión `.js`, estilo de los archivos vecinos.
- No inventar comandos en el README: documentar solo los que se ejecutaron.
- Si una decisión de este diseño choca con lo que se ve en el código, elegir la opción más conservadora, anotarla y reportarla.

## Risks / Trade-offs

- [Nunca se probó contra Bedrock real: el esquema `type: ['integer','null']`, `toolChoice: auto` y el formato de la respuesta son supuestos] → la prueba en vivo (D9) va antes de activar `bedrock`; `IA_PROVIDER_PROCESO` queda en `fake`; el orquestador degrada a evidencia insuficiente si la respuesta no valida.
- [Timeout de la Lambda en la ruta de audio] → 180 s y llamadas con `AbortSignal` de 60 s; si una llamada expira, el mensaje se reintenta.
- [Los reintentos de SQS tardan: el `visibilityTimeout` es de 18 minutos] → los errores transitorios de Bedrock ya los absorbe el reintento interno del SDK; el reintento de la cola es el último recurso. Para la demo, la prueba en vivo debe confirmar que no hay throttling con `maxConcurrency: 5`.
- [Calidad del prompt sin evaluar con casos reales] → la prueba en vivo incluye casos básicos; el ajuste fino del prompt es trabajo posterior con un conjunto de notas de prueba.
- [El catálogo completo (90 manifestaciones) va en cada llamada, unos miles de tokens de entrada] → aceptable para el volumen de la demo; el costo exacto no está calculado y debe verificarse con la calculadora de AWS antes de abrir el uso.
- [`ClasificadorBedrock` y `ProveedorBedrock` coexisten con prompts compartidos pero comportamientos distintos (el segundo devuelve el texto original con citas mapeadas)] → se documenta; el cambio no toca `ProveedorBedrock`. Hay una pregunta abierta sobre qué `textoFuente` se guarda a largo plazo; este cambio mantiene el comportamiento de `main` (anonimizado).

## Migration Plan

1. Fusionar este cambio a `main`: el código queda listo y la producción **sigue con `fake`** (comportamiento sin cambios; solo suben el `timeout` y la variable `MODELO_EXTRACCION`).
2. Quien despliega (`pnpm aws:prod:deploy`) lo incluye en su despliegue normal. No hace falta esperar este cambio para desplegar.
3. Prueba en vivo (D9) con el perfil `toqui` y revisión de los resultados.
4. Si sale bien: un PR de una línea cambia `IA_PROVIDER_PROCESO` a `'bedrock'` y se vuelve a desplegar `ToquiApp` (solo cambia la Lambda).
5. **Reversión rápida** sin redesplegar: en la consola de Lambda, `toqui-prod-proceso` → Configuración → Variables de entorno, poner `IA_PROVIDER=fake`. Reversión definitiva: volver la constante a `'fake'`.

## Resultado de la prueba en vivo (16-10-2026)

- Con el perfil `toqui`, `us.anthropic.claude-sonnet-5-5` responde `AccessDeniedException`: la cuenta del evento tiene una lista de modelos permitidos (`ws-bedrock-model-allowlist-policy-1`) que incluye Sonnet 5, Opus 5 y Fable 5, pero no Sonnet 5.5 ni Haiku 5.5. **El modelo de extracción pasa a `us.anthropic.claude-sonnet-5`** (`MODELOS.extraccion`, valor por defecto de `MODELO_EXTRACCION`, `infra/scripts/comun.ts` y `.env.example`).
- Con `us.anthropic.claude-sonnet-5`, `clasificador.live.test.ts` pasa 3 de 3: conducta clara (nivel 7, `MAN-L07-MF-01`, cita literal), «participó bien» (evidencia insuficiente) y nota con `</nota>` (no propone el nivel 9 que pedía el texto inyectado). Cada llamada tarda entre 2,6 y 4,9 s. El esquema con `type: ['integer', 'null']` y `toolChoice: auto` funcionan.
- Si una llamada falla, el error del SDK trae la solicitud firmada (token de sesión y firma) y vitest la imprimía completa. Las dos pruebas en vivo pasan ahora por `pruebas/sin-credenciales.ts`, que relanza solo el nombre y el mensaje.
- Sin probar todavía: el Guardrail de producción, la Lambda real (su rol podría no tener la misma lista de modelos) y `MODELOS.resumen` (Haiku 5.5, también denegado; aún no se usa).

## Open Questions

- ~~¿El modelo acepta el esquema y `toolChoice: auto`?~~ Sí, con Sonnet 5 (ver el resultado de la prueba en vivo).
- ~~¿Latencia real?~~ Entre 2,6 y 4,9 s por llamada con el catálogo completo. Aun así conviene bajar `tiempoMaximoMs` (hoy 60 s) para que el peor caso de audio quepa en 180 s.
- ¿El rol de la Lambda `toqui-prod-proceso` tiene la misma lista de modelos permitidos que el rol de participante? Comprobarlo antes de activar `bedrock`.
- ¿Conviene subir `maxAttempts` del cliente de Bedrock por encima de 3 para absorber picos de throttling? Decidir con datos de la prueba.
- ¿Qué `textoFuente` se guarda a largo plazo, el anonimizado (hoy) o el original con citas mapeadas (`ProveedorBedrock`)? No bloquea este cambio.
