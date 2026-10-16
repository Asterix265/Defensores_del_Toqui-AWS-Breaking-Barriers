## Context

- Desafío E-1 de Fundación Integra: reducir el tiempo de documentación de las educadoras (línea base declarada: 4 h semanales) sin perder la trazabilidad del aprendizaje. Fuentes y diferencias en `docs/contexto-desafio.md` y `docs/contexto-hackaton.md`.
- Evaluación de la hackatón: innovación técnica 25 %, impacto social 25 %, factibilidad y sustentabilidad 20 %, escalabilidad 15 %, presentación 15 %.
- Plazo: desarrollo del 14 al 16 de octubre de 2026; cierre de código el 16 a las 10:15.
- Equipo: 6 personas con Windows, macOS y Linux. Cuentas AWS del evento; la gestión de IAM está pendiente.
- Datos: dataset sintético público (20 jardines, 500 niños y niñas, 2.950 observaciones; ruta de 9 niveles y 5 dominios; 90 manifestaciones). Los formatos multimedia son solo metadatos.
- El repositorio solo tiene documentación y OpenSpec; no hay código.

## Goals / Non-Goals

**Goals:**
- Una demo de extremo a extremo: captura (texto, audio, foto) → borrador con manifestaciones citadas → confirmación o corrección → trayectoria actualizada → indicadores de tiempo y acuerdo.
- Un entorno local reproducible en los tres sistemas operativos sin depender de AWS.
- Una arquitectura stateless y basada en eventos que pueda presentarse como escalable a la operación de Integra.
- Protección de datos visible: autenticación, aislamiento por jardín, archivos privados y modelo sin identificadores.

**Non-Goals:**
- Diagnóstico, tamizaje o detección automática de rezagos.
- Mapeo entre la rúbrica institucional (10 núcleos × 8 niveles) y la ruta sintética (5 dominios × 9 niveles).
- Reentrenamiento o *fine-tuning* de modelos.
- Visión por computador propia (poses o movimiento).
- Integración con sistemas reales de Integra ni uso de datos reales.
- Alta disponibilidad multirregión y planes de recuperación ante desastres.

## Decisions

### D1. Monorepo pnpm con Node 24 LTS
Estructura: `apps/web`, `apps/api`, `apps/pipeline`, `packages/shared`, `infra`, `scripts/seed`. Versiones fijadas con `.node-version` y `packageManager` (Corepack); fin de línea LF mediante `.gitattributes`; comandos solo como scripts de `package.json` ejecutados con Node.
- *Alternativas:* varios repositorios (más coordinación de la que permite el plazo); Node 26 (no es LTS y Lambda podría no tener el runtime).

### D2. Frontend React + Vite + TypeScript como PWA
Optimizado para móvil: la educadora graba y fotografía desde el celular. Login con el componente `Authenticator` de Amplify UI. Se publica en S3 + CloudFront (decisión del 15-10-2026 en `levantar-arquitectura-aws`: un solo dominio HTTPS para la web y la API, todo en CDK).
- *Alternativas:* app nativa (requiere publicar en tiendas); Next.js (no necesitamos renderizado en servidor).

### D3. Backend NestJS stateless en ECS Fargate detrás de un ALB
Módulos implementados: `auth` (identidad y grupos), `catalogo` (niños, manifestaciones y trayectoria), `capturas` (captura, borrador, confirmación y endpoint interno), `pipeline` (modo inline con `fake`) y `seed` (carga del dataset); `metricas` queda pendiente. Reglas stateless: sin disco local, sin sesiones ni caché en memoria, sin tareas programadas internas y configuración solo por entorno. Autoescalado por CPU o solicitudes.
- *Alternativas:* FastAPI (el ecosistema de datos de Python no se aprovecha y obliga a dos lenguajes); NestJS en Lambda (*cold starts* y conexiones a Postgres más difíciles).

### D4. PostgreSQL con Prisma; Aurora Serverless v2 en AWS
El modelo es relacional (jardines, educadoras, niños, niveles, manifestaciones, observaciones, vínculos) y las consultas son analíticas (trayectorias, agregados por sala, huecos). En local se usa `postgres:17` en Docker. Aurora va en subredes privadas, accesible solo desde las tareas de Fargate, con capacidad mínima de 0,5 ACU durante el evento. Prisma maneja el esquema y las migraciones.

Tablas propias del MVP además de las del dataset: `captura`, `borrador` (sugerencia de la IA), `observacion` con columnas `origen` (`dataset` | `app`), `id_captura` y citas por vínculo, `correccion` (diferencia entre sugerencia y decisión) y `evento_tiempo`.
- *Alternativas:* DynamoDB (cada consulta nueva exige rediseñar índices); Drizzle con Data API (evita VPC, pero el equipo ya conoce Prisma; Fargate hace innecesaria la Data API).

### D5. Contrato zod + OpenAPI + orval
Los esquemas zod en `packages/shared` son la fuente de verdad. La API usa `nestjs-zod` para validar y generar OpenAPI (Swagger en `/docs`). `pnpm contract` exporta `openapi.json` y orval genera el cliente, los hooks de TanStack Query y los mocks MSW. Los modelos de Prisma no se exponen tal cual.
- *Alternativas:* DTOs con class-validator (duplica tipos con el frontend); tRPC (amarra el cliente a TypeScript y no produce OpenAPI estándar para Integra).

### D6. Pipeline asíncrono: S3 → Step Functions → Lambdas TypeScript
La carga en S3 dispara la ejecución: la clave es `capturas/<id_captura>.<ext>` y el texto escrito también se guarda ahí como `.txt`, para que todos los formatos entren por el mismo camino. Pasos: normalizar a texto (Transcribe `es-US` para audio; Claude multimodal en Bedrock para foto, con imagen reducida mediante `sharp`) → extraer → validar → entregar el borrador a la API mediante un endpoint interno (`POST /interno/capturas/:id/borrador` y `/error`), autorizado con el secreto compartido `PIPELINE_TOKEN` en la cabecera `x-pipeline-token`, ya que las Lambdas llegan por CloudFront sin token de Cognito. Las Lambdas quedan fuera de la VPC y solo la API accede a la base. El nombre de ejecución es el `id_captura`, lo que garantiza la idempotencia.
- *Alternativas:* procesar dentro de la API (rompe el principio stateless y bloquea solicitudes); Lambdas dentro de la VPC (exige endpoints o NAT).

### D7. Extracción acotada al catálogo y validada con zod
El prompt recibe el texto, la edad en meses y las manifestaciones de los niveles esperado ±1 para la edad. La respuesta debe ser JSON estructurado. La validación zod comprueba que los IDs existan, que cada cita aparezca en el texto, que el nivel esté entre 1 y 9 y que las manifestaciones sean coherentes con ese nivel. Ante un fallo se hace un reintento y, si persiste, el borrador queda como «evidencia insuficiente». Bedrock Guardrails filtra información personal. Modelos Claude (Sonnet para extraer, Haiku para resúmenes) según disponibilidad en la cuenta; los IDs exactos se fijan en configuración. Actualización (`implementar-modulo-ia`): el Guardrail se aplica antes de Claude y falla cerrado (sin texto anonimizado no se llama al modelo); el borrador entrega como `textoFuente` el texto original normalizado, con las citas mapeadas desde la versión anonimizada que ve el modelo; la salida estructurada usa la herramienta `registrar_borrador` de Converse, y los niveles válidos salen del catálogo recibido.
- *Alternativas:* texto libre (no trazable); clasificación del nivel sin manifestaciones (no explicable).

### D8. Proveedores intercambiables
La interfaz `IaProvider` tiene dos implementaciones: `fake` (respuestas deterministas a partir del catálogo) y `bedrock`. El pipeline local corre los mismos pasos en secuencia dentro del proceso de la API cuando `PIPELINE_MODE=inline`; con `fake`, audio y foto usan lecturas simuladas y se procesan al crear la captura, sin esperar el archivo. Con esto, 4 de las 6 personas trabajan sin AWS. Actualización (`implementar-modulo-ia`): el módulo puro `packages/ia` ofrece `crearProveedor` con configuración explícita (`fake` o `bedrock`, sin leer `process.env`); por ahora solo lo usará la Lambda `procesar`, y la API de Nest conserva su propio `fake` para `PIPELINE_MODE=inline`.

### D9. Autenticación con Cognito
User Pool con grupos `educadora` y `directora` y atributo `custom:id_jardin`. Un *guard* global de Nest con `aws-jwt-verify` valida los tokens, y un *guard* de recurso filtra por jardín. `AUTH_MODE=local` existe solo para desarrollo y bloquea el arranque fuera de él; sin token usa la educadora fija de `JAR-0001` y acepta `Bearer local:<grupo>:<JAR-XXXX>` para probar otros usuarios. Se exige el token de id (trae `custom:id_jardin`). Un niño o niña de otro jardín responde 403; una captura de otro jardín, 404. Solo quien registró una captura la confirma o la descarta. Los usuarios de la demo son sintéticos y se crean con un script.

### D10. Aprendizaje por correcciones sin reentrenar
Siempre se registran la sugerencia y la decisión final (tabla `correccion`) y se calcula el acuerdo. Como opción, se agregan embeddings (Titan Embeddings) en pgvector y se recuperan hasta 5 correcciones similares del mismo jardín como ejemplos en el prompt.
- *Alternativa:* *fine-tuning* (lento, opaco y no reversible).

### D11. Infraestructura con AWS CDK en TypeScript, `us-east-1`
Stacks implementados en `levantar-arquitectura-aws`: `ToquiRed` (VPC), `ToquiDatos` (Aurora y Secrets Manager) y `ToquiApp` (S3, Cognito, Guardrail, Fargate + ALB, Step Functions + Lambda y web en S3 + CloudFront); ver `docs/arquitectura-aws.md`. Roles IAM de mínimo privilegio por componente. Se usa `us-east-1` por la disponibilidad de modelos con datos sintéticos; en producción habría que reevaluar la residencia de los datos.
- *Costo esperado en el evento:* unos pocos dólares diarios (Fargate mínimo, ALB, Aurora 0,5 ACU, uso por demanda de Transcribe y Bedrock); hay que verificarlo con la calculadora antes de desplegar.
- *Limpieza:* `cdk destroy` de todos los stacks; bucket y base configurados con `RemovalPolicy.DESTROY` solo en el entorno de la hackatón.

### D12. Video como opcional
Si hay tiempo, se probará Amazon Nova (entrada de video) o Bedrock Data Automation. Como alternativa, ffmpeg para separar el audio y extraer fotogramas. Su salida entra al mismo paso de extracción.

### D13. Prioridades
- **Imprescindible:** carga del dataset, captura de texto y audio, extracción con citas (`fake` y `bedrock`), confirmación y corrección, trayectoria.
- **Debería:** foto, Cognito, resumen del grupo, huecos de evidencia, tiempos y acuerdo, despliegue en AWS.
- **Si sobra tiempo:** video, pgvector con ejemplos, evaluación con métricas completas, prueba de carga.

## Risks / Trade-offs

- [Acceso a modelos de Bedrock o cuotas no habilitadas a tiempo] → solicitar acceso apenas exista la cuenta; el proveedor `fake` permite seguir y ensayar la demo.
- [Transcribe con acento chileno] → probar temprano con `es-US`; los audios de la demo son grabados por el equipo y se pueden ajustar.
- [El modelo inventa manifestaciones o citas] → validación zod contra el catálogo y el texto, reintento y estado de evidencia insuficiente.
- [Interpretación diagnóstica de la herramienta] → lenguaje rotulado como estimación pedagógica, confirmación humana obligatoria, sin alertas de rezago.
- [Infraestructura retrasa la demo] → la demo puede correr en local; el despliegue va como «debería» y queda a cargo de una sola persona.
- [Aurora pausada o lenta al iniciar] → capacidad mínima de 0,5 ACU durante el evento.
- [Conflictos entre 6 personas en un repo] → módulos de Nest con responsables, contrato acordado temprano y ramas cortas con PR.
- [El dataset no está en la ruta documentada] → `DATASET_DIR` configurable con un error explícito.
- [Correcciones inconsistentes influyen en sugerencias futuras] → ejemplos limitados al jardín, auditables y excluibles.

## Migration Plan

Proyecto nuevo, sin migración de datos. Despliegue: `cdk bootstrap` → `cdk deploy` por stacks (datos, almacenamiento, auth, pipeline, api, web) → migraciones de Prisma → carga del dataset → creación de usuarios de demo. Para revertir se vuelve a desplegar la versión anterior de la imagen o del stack. Al terminar el evento se hace `cdk destroy` y se verifica que no queden recursos.

## Open Questions

- Permisos IAM concretos de la cuenta del evento (Identity Center o usuarios) y quién tiene permisos de despliegue.
- Modelos Claude y Nova habilitados y cuotas en la cuenta.
- Existencia y límites de créditos o presupuesto de la cuenta del evento.
- Ventana de edad del catálogo enviado al modelo (nivel esperado ±1 o ±2) según los resultados de la evaluación.
- Supuestos para proyectar el tiempo semanal (observaciones por niño y semana, tamaño del grupo).
