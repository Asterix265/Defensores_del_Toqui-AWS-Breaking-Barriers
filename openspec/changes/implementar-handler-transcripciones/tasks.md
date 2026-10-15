## 1. Contratos y muestras

- [ ] 1.1 Agregar contratos zod compartidos para entrada de audio, identidad del objeto, estados y entrega; probar entradas válidas y rechazo de bucket, prefijo, formato, tamaño y duración fuera de límites.
- [ ] 1.2 Preparar muestras sintéticas cortas, con transcripción de referencia y procedencia documentada; incluir voz en español, silencio y un identificador ficticio para probar el filtro.
- [ ] 1.3 Agregar configuración validada y dependencias explícitas de AWS SDK v3; mantener un modo de pruebas con dobles sin credenciales.

## 2. Persistencia y autenticación

- [ ] 2.1 Crear el modelo técnico `TranscripcionCaptura` y su migración aditiva, con identidad única, origen, texto anonimizado, estado y tiempos; comprobar migración en PostgreSQL local sin eliminar `Salud`.
- [ ] 2.2 Implementar el servicio de upsert transaccional y probar duplicados, conflicto de origen y protección de un estado completado frente a mensajes tardíos.
- [ ] 2.3 Implementar `POST /internal/transcripciones` con validación del contrato, límites de cuerpo y autenticación HMAC; probar firma válida, cuerpo alterado, firma ausente y timestamp vencido.

## 3. Handlers de audio

- [ ] 3.1 Implementar validación del objeto e inicio de Transcribe con nombre determinista, idioma configurable y resultado bajo `transcripciones/`; probar un trabajo nuevo, uno existente compatible y un objeto reemplazado.
- [ ] 3.2 Implementar consulta de estado y lectura acotada del JSON privado de Transcribe; probar en curso, completado, fallo, salida inválida y texto vacío.
- [ ] 3.3 Aplicar Guardrail al texto y entregar el resultado anonimizado a la API con firma renovada en cada intento; probar bloqueo del filtro, reintento HTTP y ausencia de texto en logs y salidas de tareas.

## 4. Orquestación e infraestructura

- [ ] 4.1 Reemplazar el paso eco por inicio, espera, consulta y finalización en Step Functions; agregar límites de tiempo, reintentos transitorios y rutas de fallo, sin reactivar el pipeline desde sus propios resultados.
- [ ] 4.2 Configurar en CDK handlers, variables, secreto de servicio, IAM y entrega por CloudFront; mantener Aurora privada y limitar lectura de secretos y objetos a los recursos necesarios.
- [ ] 4.3 Agregar comprobaciones de síntesis para la máquina, IAM, retención, prefijos y ausencia de acceso directo de Lambda a Aurora; verificar que la configuración del servicio permita escribir el resultado de Transcribe.

## 5. Validación e integración

- [ ] 5.1 Ejecutar pruebas de integración locales API → PostgreSQL y pruebas con dobles del flujo completo, incluyendo entrega repetida, error del filtro y API caída; confirmar una sola fila para la misma identidad.
- [ ] 5.2 Ejecutar lint, tipos, pruebas de los paquetes afectados, build, regeneración del contrato si corresponde y síntesis CDK; registrar resultados y corregir fallos atribuibles al cambio.
- [ ] 5.3 Actualizar documentación de uso, muestras, costos estimados con tarifas vigentes, configuración, métricas, fallos y limpieza; conciliar las tareas cubiertas de `definir-mvp-e1` sin marcar el resto del MVP como completado.
- [ ] 5.4 En una acción posterior coordinada, verificar acceso/cuotas y presupuesto, desplegar primero API/migración y luego pipeline; comprobar una muestra, un duplicado y un fallo con datos sintéticos, registrar latencia y diferencias respecto de la referencia y limpiar las muestras.
- [ ] 5.5 Validar `openspec validate implementar-handler-transcripciones --strict --no-interactive`; al completar la implementación y sus verificaciones, sincronizar especificaciones y archivar el cambio.
