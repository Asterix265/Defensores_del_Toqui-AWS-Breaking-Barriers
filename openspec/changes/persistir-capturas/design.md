# Design

## Context

`POST /capturas` crea la captura en `procesando` y, para audio y foto, devuelve un PUT firmado a `capturas/<id>.<ext>`. En modo `aws`, el objeto en S3 dispara EventBridge → Step Functions, que entrega el borrador al endpoint interno. En modo `inline`, `CapturasController` programa el pipeline al crear, sin esperar el archivo, y el proveedor `fake` devuelve frases fijas para audio y foto.

## Decisions

### 1. `POST /capturas/:id/subida` para el modo inline
La web lo llama después del PUT. La API hace `HeadObject`: si el objeto no está, responde 409; si el tipo o el tamaño no coinciden con lo declarado, 422. Con el objeto confirmado programa el pipeline con el tipo y los bytes. Es idempotente: si la captura ya no está en `procesando` o ya tiene borrador, devuelve el detalle sin reprocesar. En modo `aws` solo devuelve el detalle.
*Alternativa descartada:* procesar al crear (como hoy), porque el borrador declararía un archivo que quizá nunca llegó.

### 2. `procesamiento` en el borrador
JSON con `simulado`, `entrada` (formato, tipo, bytes, clave S3) y `pasos` (`transcripcion`, `lectura_imagen`, `extraccion`) con estado `no_implementado | simulado | completado` y un detalle legible. Lo escribe quien genera el borrador (pipeline inline o, más adelante, el pipeline de AWS por el endpoint interno, donde es opcional). La web lo muestra tal cual, sin inferir nada del proveedor.

### 3. Texto de ejemplo más aviso
Para audio y foto, el `textoFuente` es un texto de ejemplo para que la extracción simulada proponga algo con cita. La revisión lo rotula como ejemplo y muestra el aviso con los pasos no implementados; así la demo conserva la propuesta y nadie confunde el ejemplo con lo que se grabó.

### 4. Captura en el navegador
Audio con `MediaRecorder` en el primer tipo soportado entre `audio/webm`, `audio/mp4` y `audio/ogg` (se quitan los parámetros de códec). Foto con `<input type="file" accept="image/*" capture="environment">`; si no es JPEG o PNG, o supera 10 MB, se redibuja en un canvas como JPEG. La vista previa usa una URL local del archivo, sin volver a pedirlo a S3.

### 5. La captura se crea al elegir al niño o niña
El orden de pantallas no cambia: capturar → elegir → revisar. Al presionar «Seguir con X» la web crea la captura, sube el archivo, avisa la subida y consulta `GET /capturas/:id` cada segundo hasta salir de `procesando` (máximo 30 s). Con estado `error`, la revisión parte sin propuesta y la educadora elige a mano, como permite la API.

### 6. El navegador solo sube a S3
El frontend sube el original con la URL firmada y nunca lo descarga: la vista previa usa `URL.createObjectURL` del archivo recién capturado, y `GET /capturas/:id/archivo` queda en la API sin uso desde la web. Lo que vuelve es el resultado procesado (el borrador). `POST /capturas/:id/subida` es un paso temporal del modo `inline`; con el pipeline de AWS, S3 dispara el procesamiento por EventBridge y ese aviso deja de ser necesario (en modo `aws` ya no hace nada).

### 7. Una sola captura por intento
`Procesando` crea la captura en un efecto. En desarrollo, StrictMode ejecuta los efectos dos veces y la API recibía dos `POST /capturas` (notas gemelas en `borrador_listo`). La promesa del registro se guarda en un `ref` por intento y ambos efectos la reutilizan; las pruebas de la web renderizan con StrictMode para detectarlo.

### 8. Ubicación en S3
Los originales quedan en `capturas/<id_captura>.<ext>` (audio y foto juntos; «captura» es cualquier nota). Separarlos por formato (`capturas/audio/…`, `capturas/foto/…`) queda como decisión pendiente del equipo: solo cambia `claveCaptura()` en la API, la regla de EventBridge sigue sirviendo, y el pipeline de AWS deberá tomar el id desde el nombre del archivo.

### 9. Listas y cachés
Tras confirmar o descartar se invalidan las consultas de capturas y la trayectoria del niño o niña. «Mis notas» muestra las capturas propias que no fueron descartadas, con su estado.

## Risks

- Credenciales AWS en cada máquina para subir archivos; sin ellas, audio y foto fallan con un mensaje claro y el texto sigue funcionando.
- Una captura creada cuya subida falla queda en `procesando`; no se limpia en esta versión.
