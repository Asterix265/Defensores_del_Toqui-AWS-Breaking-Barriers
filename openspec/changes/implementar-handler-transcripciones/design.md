## Context

El código local contiene `eco.handler`, una máquina con un único `LambdaInvoke` y disparo de S3 mediante EventBridge para `capturas/`. La API NestJS accede con Prisma y TLS a Aurora en subred aislada; las Lambdas están fuera de la VPC. La tabla actual es técnica (`Salud`). La propuesta general `definir-mvp-e1` ya prevé Transcribe y entrega del resultado mediante un endpoint interno.

Este diseño concreta solo la normalización de audio y su persistencia, sin completar el dominio de observaciones. El contexto histórico de OpenSpec que dice que no hay código está desactualizado; para este cambio prevalece la fuente local verificada. El dataset solo trae metadatos: los audios de prueba serán grabaciones sintéticas del equipo, con transcripción de referencia y procedencia documentadas.

## Goals / Non-Goals

**Goals:** audio sintético a texto persistido y trazable; espera fuera de Lambda; autenticación entre servicios; idempotencia y fallos verificables; desarrollo local con dobles explícitos.

**Non-Goals:** fotos, video, interfaz de carga, resúmenes, rúbricas, diagnósticos, embeddings, lectura en voz alta y despliegue como parte de la preparación.

## Decisions

### D1. Contrato y origen acotado

Normalizar el evento a un contrato zod con `idCaptura`, `bucket`, `key`, identidad del objeto, tipo `audio` e idioma. Recibir bucket y key del evento real, no únicamente una key renombrada como identificador. Decodificar la clave de acuerdo con el formato del evento utilizado; no aplicar reglas del evento S3 directo a EventBridge sin comprobarlas.

Validar bucket y prefijo permitidos, existencia, tamaño máximo de 10 MiB y formato inicial `wav`, `mp3`, `webm` o `m4a`, con MIME compatible. Verificar que el contenedor/códec de las muestras esté admitido por Transcribe. Un archivo de otro tipo se rechaza con error explícito; no se considera un audio por su extensión solamente. Idioma inicial configurable `es-US`; límite de duración inicial de cinco minutos comprobado al preparar las muestras y contra los metadatos disponibles del medio en ejecución antes de aceptarlo.

### D2. Un trabajo asíncrono, varias invocaciones cortas

Crear handlers para iniciar y consultar/finalizar la transcripción en `apps/pipeline/src/handlers`. Step Functions ejecuta: validar e iniciar → Wait de 10 segundos → consultar → Choice. Si sigue en proceso vuelve a Wait; si termina lee el JSON de Transcribe; si falla registra un código seguro. Acotar la espera a diez minutos y configurar un timeout global superior que reserve tiempo para notificar el fallo. No mantener una Lambda esperando con un bucle.

Los handlers usan AWS SDK v3 con dependencias explícitas, conservando el empaquetado ESM existente. Separar clientes externos de la lógica para pruebas con dobles; una simulación nunca se etiqueta como transcripción real.

Usar nombre de trabajo determinista derivado de bucket, key e identidad del objeto (VersionId si existe; ETag como alternativa). Ante conflicto de nombre, recuperar y comprobar el trabajo existente. Antes de iniciar o recoger el resultado verificar que el objeto conserva esa identidad; si cambió, fallar esa ejecución. No depender del nombre automático de ejecución de EventBridge para deduplicar. Para la primera entrega las claves de captura deben ser únicas e inmutables.

### D3. Resultado y protección de datos

Guardar resultados de Transcribe bajo `transcripciones/`, fuera del prefijo que dispara el pipeline. Configurar explícitamente el bucket de salida; nunca aceptar una URL de descarga arbitraria del evento. Extraer el texto literal del JSON; no resumirlo ni completar información. Si está vacío, marcar `sin_texto`, sin generar observaciones ni sugerir nivel.

Aplicar `ApplyGuardrail` al texto recogido usando el Guardrail y versión configurados. La versión persistida es el texto anonimizado; el original queda solo en el resultado privado temporal de S3 con el ciclo de vida de siete días. Guardrail evalúa el texto: no elimina datos del audio original ni garantiza reconocimiento perfecto. Si el filtrado bloquea o falla, no persistir el texto original como alternativa.

### D4. Persistencia a través de la API

Agregar un modelo técnico aditivo `TranscripcionCaptura` con identidad única de origen, `idCaptura`, bucket/key/identidad del audio, trabajo de Transcribe, estado (`procesando`, `completada`, `sin_texto`, `fallida`), texto anonimizado nullable, código de error seguro y marcas de tiempo. Mantener `Salud`. Este registro no es una observación confirmada ni incorpora identificadores de niños. Una futura relación con `Captura` se añadirá junto al dominio del MVP.

La Lambda entrega estados y resultados mediante `POST /internal/transcripciones`, accesible por el dominio CloudFront con prefijo externo `/api`. La API valida el contrato y hace un upsert transaccional por identidad de origen; cambios incompatibles para una identidad existente devuelven conflicto. Un reintento tardío no puede degradar un estado completado a procesando o fallido. La escritura confirma éxito solo después del commit. No crear un endpoint de lectura pública en esta entrega.

Autenticación de servicio propuesta: secreto aleatorio en Secrets Manager, firma HMAC-SHA256 sobre método, ruta normalizada, timestamp y digest de los bytes del cuerpo; comparación constante y ventana de cinco minutos. Firmar de nuevo cada reintento. La idempotencia hace inocua la repetición del mismo mensaje; un cuerpo alterado no es aceptado. Limitar el cuerpo a 128 KiB y el texto a 20.000 caracteres. La API recibe el secreto por inyección ECS y la Lambda tiene lectura solo del secreto correspondiente. No confiar en que el nombre `internal` o el origen CloudFront autentiquen al emisor. El guard de servicio se aplica también fuera de AWS y no se sustituye por el futuro login de educadoras.

Alternativa descartada para esta entrega: escribir directamente desde una Lambda dentro de la VPC. Exigiría nuevos permisos de red y conectividad a S3, Secrets Manager y servicios de IA mediante endpoints o NAT. Mantener solo la API conectada a Aurora reutiliza la arquitectura y la decisión D6 del MVP.

### D5. Reintentos, límites y observabilidad

Reintentar con backoff únicamente errores transitorios de servicios y entrega HTTP (429/5xx/red), con máximo tres intentos por operación. Errores de entrada, firma o contrato son terminales. Un `Catch` entrega el estado fallido con código estable sin incluir el contenido del audio; si también falla la entrega, la ejecución termina fallida de forma visible y su identidad permite reprocesar sin duplicados. Un timeout de tarea se captura; documentar además la detección de timeout global de ejecución y el reproceso porque no se captura desde dentro de la misma máquina.

Logs con IDs, estado, latencia y códigos; sin cuerpos, texto, firmas, secretos ni nombres personales. No volcar transcripciones en el historial de Step Functions: mantener el texto dentro del handler de finalización y devolver solo IDs/estado tras entregarlo. Evitar registrar datos completos de ejecución en CloudWatch.

### D6. Infraestructura, costo y limpieza

Región `us-east-1`. CDK configura variables, secreto, handlers, permisos y máquina. S3: lectura solo de capturas y resultados necesarios; Transcribe: iniciar/consultar trabajos, con recursos acotados donde el servicio lo admita; Bedrock: `ApplyGuardrail` solo sobre el recurso configurado; Secrets Manager: lectura del secreto de servicio solo para la Lambda que entrega y el rol de ejecución ECS. La autorización de escritura del resultado por Transcribe se debe comprobar con una prueba real, incluyendo la política del bucket o rol de acceso que corresponda. El rol de Step Functions solo invoca sus handlers. No abrir el puerto de Aurora ni el ALB al público.

Los incrementos provienen de minutos de Transcribe, uso de Guardrail, transiciones de Step Functions, invocaciones Lambda, S3 y el secreto. Sin Claude ni NAT nuevos. Antes del despliegue registrar tarifas vigentes, número/duración de muestras y estimación; no tratar créditos como costo cero. Limitar las pruebas a muestras cortas y detener reintentos agotados.

Eliminar objetos y trabajos de prueba al finalizar la verificación; conservar la expiración S3 de siete días y documentar la limpieza de filas técnicas de demostración y el secreto. Usar la limpieza existente de CDK al terminar el evento, coordinada con el equipo; no destruir recursos compartidos al probar este cambio.

## Risks / Trade-offs

- [Ruido o acento chileno] → comparar con referencias sintéticas en español y exigir revisión humana; conservar texto extraído separado de futuras interpretaciones.
- [Objeto reemplazado durante una ejecución] → claves inmutables, comprobación de identidad y fallo explícito; no mezclar el texto de una versión con otra.
- [Duplicación de eventos o entrega tras timeout] → nombre determinista, restricción única y transiciones monotónicas en la API.
- [Endpoint sin autenticación existente] → implementar y probar la firma antes de habilitar la entrega; no reutilizar una sesión de educadora.
- [Anonimización modifica el texto] → distinguir la versión anonimizada del original temporal y medir correcciones sobre muestras sin datos reales.
- [Trabajo simultáneo en el MVP] → modelo técnico aditivo, contrato compartido y conciliación de tareas de `definir-mvp-e1` al integrar.

## Migration Plan

1. Contratos y pruebas locales; luego migración aditiva y endpoint autenticado.
2. Handlers con dobles, pruebas del flujo y síntesis CDK sin desplegar.
3. En una acción posterior coordinada: crear secreto, desplegar primero API compatible y migración, luego activar la nueva máquina. No habilitar el pipeline antes de que el endpoint responda correctamente.
4. Verificar una muestra sintética, duplicado, fallo y rechazo de firma; comprobar una sola fila y su texto anonimizado.
5. Reversión: detener el disparo nuevo y volver al paso de ejemplo conservando tabla y registros; no borrar datos con una migración inversa automática.

## Open Questions

- Confirmar acceso y cuotas de Transcribe y Guardrail en la cuenta antes de la prueba real.
- Ajustar límites y `es-US` según las grabaciones sintéticas; cualquier ampliación de formatos debe aportar una muestra comprobada.
- Coordinar el identificador definitivo de `Captura` con el responsable del dominio antes de añadir su relación; la primera entrega usa identidad técnica sin datos de niños.
- Concretar el presupuesto de prueba y responsable de despliegue antes de activar recursos. Estas comprobaciones no impiden preparar contratos y pruebas locales.
