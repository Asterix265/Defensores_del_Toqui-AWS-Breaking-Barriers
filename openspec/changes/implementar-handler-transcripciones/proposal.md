## Why

Las educadoras necesitan convertir sus notas de voz en texto sin transcribirlas manualmente. El pipeline actual solo ejecuta `eco.handler`: comprobar que una captura llegó no produce una transcripción ni la guarda en Aurora.

## What Changes

- Implementar una primera entrega de audio en S3 → Amazon Transcribe → texto → persistencia mediante la API y Prisma.
- Coordinar el trabajo asíncrono con Step Functions, con espera, consulta de estado, errores y reintentos acotados.
- Definir contratos validados, identidad estable de la captura y escritura idempotente para soportar eventos duplicados.
- Aplicar el Guardrail configurado al texto antes de persistir la versión anonimizada; conservar referencias al origen para trazabilidad.
- Implementar un endpoint autenticado de servicio a servicio para que la Lambda fuera de la VPC pueda solicitar la escritura sin abrir Aurora.
- Probar con audios sintéticos del equipo y dobles de los servicios para desarrollo sin AWS.

Hechos: existen la infraestructura de producción, el handler de ejemplo y una base con la tabla técnica `Salud`. Supuestos iniciales: audios cortos en español (`es-US`, configurable), bucket privado en `us-east-1` y carga manual sintética para probar sin depender de la interfaz.

Fuera de alcance: fotos con Claude, video, generación de resúmenes, clasificación pedagógica, frontend, carga del dataset, búsqueda vectorial, Polly y despliegue de recursos durante esta preparación. Claude sigue siendo la opción prevista para una ampliación de fotos; no es necesario para transcribir audio.

Medición: registrar duración del audio, latencia hasta la persistencia, fallos y correcciones necesarias sobre una transcripción de referencia. Comparar el tiempo de revisión con una transcripción manual del mismo audio; no prometer la meta institucional de cero horas.

## Capabilities

### New Capabilities

- `transcripcion-audio`: recepción de una captura de audio, transcripción asíncrona, protección del texto y persistencia trazable e idempotente.

### Modified Capabilities

Ninguna especificación consolidada: `openspec/specs` todavía no contiene capacidades. Este cambio desarrolla una parte de las tareas 4.5, 4.6 y 7.4 propuestas en `definir-mvp-e1`; no declara terminado el MVP ni reemplaza sus requisitos de extracción pedagógica. Al integrar, se deben reconciliar esas tareas con la entrega real.

## Impact

- `packages/shared`: contratos zod de entrada, estado y resultado.
- `apps/pipeline`: handlers de Transcribe y entrega del resultado; dependencias AWS SDK v3 explícitas para compilar y probar.
- `apps/api`: módulo interno de transcripciones, autenticación de servicio y modelo/migración Prisma aditivos.
- `infra`: configuración de handlers, Step Functions, permisos y secreto de servicio en CDK.
- Documentación de ejecución local, pruebas sintéticas, costos, errores y limpieza. El despliegue será una acción posterior independiente.
