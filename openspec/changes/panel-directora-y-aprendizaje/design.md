# Design

## Context

La API expone niños y niñas, catálogo, trayectoria individual y capturas. No hay agregados por sala ni por jardín. La identidad trae `grupo` (`educadora` o `directora`) e `idJardin`, pero ninguna persona está vinculada a una sala: la sala propia se guarda en el dispositivo. El pipeline recibe un mensaje autosuficiente y tiene el puerto `FuenteContexto`, que hoy devuelve `ContextoVacio`. El User Pool no permite autorregistro y la web corta el ingreso en el desafío `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED`. Motivación: `proposal.md`. Requisitos: `specs/*/spec.md`.

## Goals / Non-Goals

**Goals:**
- Reglas de alerta idénticas a las de `metodologia.md`, calculadas con las valoraciones vigentes, tanto del dataset como de la app.
- Que la directora administre su equipo sin la terminal ni la consola de AWS.
- Que cada corrección de una tía mejore las propuestas siguientes de su jardín, con trazabilidad.

**Non-Goals:**
- Promedios de nivel o puntajes: no se agrega un nivel de rúbrica nuevo.
- Reentrenar el modelo o usar búsqueda vectorial.
- Vincular personas a salas en la base de datos.

## Decisions

### D1. Estado de sala calculado en la API al consultar
`GET /salas/estado?sala=<salaGrupo>&corte=<fecha opcional>` toma, para cada niño o niña matriculado al corte (`fechaIngreso` ≤ corte) y cada núcleo, la última valoración con `nivelValidado`, `fechaCorte` ≤ corte y `fechaDecision` de hasta 45 días antes del corte (igual que `build_summaries` de `generador.py`). Una prueba compara el resultado con `alertas.csv` del dataset al corte 2026-10-15. Con eso calcula, por núcleo, la distribución, la mediana, las modas, la cobertura y las alertas individuales (mediana de pares que excluye al niño o niña, mínimo 5 pares, brecha de 2 o más). `GET /jardin/resumen` (solo `directora`) repite el cálculo para las salas del jardín y agrega las alertas de sala (mismo nivel educativo y núcleo, mínimo 2 salas con información contando la evaluada, referencia = mediana de las otras, brecha de 1,5 o más; así lo calcula `generador.py` del dataset), las edades en meses al corte y las notas de los últimos 30 días. Los umbrales son constantes con nombre en `salas/reglas.ts`, con pruebas unitarias propias.
*Alternativa descartada:* cargar las tablas `alertas` y `resumen_salas` del dataset, porque quedarían congeladas y no reflejarían lo que confirman las tías en la app.
Volumen: un jardín tiene unos 84 niños o niñas × 8 núcleos y 3 cortes, del orden de 2.000 valoraciones. Se resuelve con una sola consulta y en memoria.

### D2. Lenguaje de las alertas
La alerta se presenta como «Para revisar en contexto»: muestra la brecha, la mediana de referencia y la cantidad de pares, junto con la `accion_sugerida` de la metodología. Nunca se presenta como «rezago» ni como diagnóstico. Un niño o niña sin decisión válida aparece como «Sin decisión reciente», no con nivel bajo.

### D3. CSV generado en la web
Una función `aCsv(filas, columnas)` en `apps/web/src/registro/csv.ts` escapa comillas, comas y saltos de línea, antepone un apóstrofo a las celdas que empiezan con `=`, `+`, `-`, `@`, tabulación o retorno (salvo números negativos) para que Excel no las ejecute como fórmula, antepone un BOM para Excel y usa `;` como separador, porque Excel en español lo espera. Se descarga con `Blob` y `URL.createObjectURL`. Cada pantalla exporta lo que muestra, con sus filtros: estado de la sala (niño o niña, núcleo, nivel, fecha de corte, alerta), resumen del jardín (una fila por sala y núcleo) y notas. El archivo incluye nombres ficticios del dataset. Se advierte que contiene datos de niños y niñas.
*Alternativa descartada:* un endpoint CSV en la API, que duplicaría las consultas sin ventaja para el volumen de un jardín.

### D4. Ejemplos de correcciones en el mensaje de la cola
`DespachadorService.mensaje` agrega `ejemplos` (máximo 5) desde `correcciones` unida a `borradores` y `capturas`: mismo `idJardin`, niño o niña del mismo nivel educativo, decisión `confirmada` o `corregida`, ordenados primero por `corregida` y después por fecha descendente, dentro de los últimos 90 días. Cada ejemplo lleva `textoFuente` (ya anonimizado, recortado a 400 caracteres), `nivel` e `idsManifestaciones` de `final`. Se excluyen las manifestaciones que no están en el catálogo del mensaje. En la Lambda, `ContextoDesdeMensaje` devuelve esos ejemplos ordenados por coincidencia de palabras con la nota actual (sin dependencias nuevas). El prompt ya sabe usarlos. El modo inline usa el proveedor simulado por palabras clave y no recibe ejemplos. El `procesamiento` del borrador registra cuántos ejemplos se usaron, para la trazabilidad.
*Alternativa descartada:* un endpoint interno para que la Lambda pida los ejemplos, porque rompe el mensaje autosuficiente y suma una llamada de red. También se descarta el ajuste fino, que no está disponible en la cuenta del evento y no cabe en el plazo.
Privacidad: los ejemplos nunca llevan IDs de niño o niña, captura ni usuario. El texto ya pasó por el Guardrail.

### D5. Cuentas administradas por la directora con Cognito Admin API
Módulo `cuentas` con `@Grupos('directora')`:
- `GET /cuentas` usa `ListUsers` con el filtro `custom:id_jardin` del jardín. `ListUsers` no filtra por atributos personalizados, así que se lista y se filtra en la API; con decenas de usuarios alcanza.
- `POST /cuentas` recibe `{ email, nombre, grupo }` y llama a `AdminCreateUser`, con `email_verified=true`, `name`, `custom:id_jardin` del token (nunca del cuerpo) y `DesiredDeliveryMediums: ['EMAIL']`, seguido de `AdminAddUserToGroup`. Si la asignación del grupo falla, la cuenta queda sin grupo (no aparece en la lista y no puede usar la API) y se responde 503. Al volver a invitar ese correo, si la cuenta es del mismo jardín, sigue en `FORCE_CHANGE_PASSWORD` y `AdminListGroupsForUser` no devuelve grupos de la app, se asigna el grupo pedido y se reenvía la contraseña temporal; en otro caso, 409. Se prefiere esta reparación a borrar la cuenta, para no darle `AdminDeleteUser` al rol de la API.
- `POST /cuentas/:usuario/desactivacion` y `/activacion` llaman a `AdminDisableUser` y `AdminEnableUser`, después de comprobar con `AdminGetUser` que la cuenta es del mismo jardín. Ninguna directora puede desactivarse a sí misma.

En `AUTH_MODE=local` el módulo responde 501 con un mensaje claro. El rol de tarea de la API recibe solo esas acciones, sobre el ARN del pool (`ToquiApp`).
En la web, `iniciarSesion` devuelve `nueva_clave` y conserva el desafío. La pantalla «Crea tu contraseña» llama a `confirmSignIn({ challengeResponse })`, con las mismas reglas de la política del pool, y deja entrar.
*Alternativas descartadas:* el autorregistro, porque cualquiera podría declararse de un jardín ajeno y ver datos de niños y niñas; un Lambda de pre-registro con código de invitación, porque suma más piezas que la Admin API.

### D6. Scroll bloqueado
El síntoma aparece cuando el diálogo de la nota se desmonta en el mismo ciclo en que `history.back()` dispara `popstate` y abre o cierra el `Snackbar`. El `ModalManager` de MUI queda con el `overflow: hidden` del `body`. Primero se reproduce con una prueba (Testing Library: guardar nota en PC → `document.body.style.overflow` vacío). El arreglo es cerrar el diálogo con `open={false}` y desmontarlo en `TransitionProps.onExited`, en lugar de desmontarlo de golpe. Si eso no alcanza, se limpia el estilo del `body` en el efecto de desmontaje del panel.

### D7. Navegación de la directora
`PanelSalas` y `RegistroApp` reciben el `grupo` de `GET /me`. Para `directora` se agregan las secciones «Jardín» (inicial) y «Equipo». La directora conserva «Mi sala» y «Notas» para ver una sala. La API no permite que una directora registre notas (`@Grupos('educadora')`), así que la directora no ve el botón «Nueva nota».

## Risks / Trade-offs

- [Pocas decisiones válidas por sala dejan las alertas sin calcular] → se muestra «Sin pares suficientes (n de 5)» en lugar de ocultarlas.
- [Los ejemplos refuerzan una corrección equivocada] → solo cuentan decisiones del mismo jardín y nivel educativo de los últimos 90 días, y la tía sigue revisando cada propuesta. Se puede apagar con `EJEMPLOS_CORRECCIONES=0`.
- [Un prompt más largo cuesta más tokens] → 5 ejemplos de hasta 400 caracteres suman cerca de 2 KB más por llamada, frente a los ~40 KB del catálogo. Impacto menor.
- [Cognito envía el correo de invitación sin SES, con un límite de 50 al día y posible llegada a spam] → para la demo alcanza. Si no llega, la directora puede reenviar con `MessageAction: RESEND`, que se expone como «Reenviar invitación».
- [El CSV con nombres sale del sistema] → los nombres del dataset son ficticios y la descarga muestra un aviso. Para uso real se requeriría una política de Integra.

## Migration Plan

1. Contrato y API con pruebas; regenerar el cliente (`pnpm contract`).
2. Pipeline: `ContextoDesdeMensaje`. Los mensajes antiguos sin `ejemplos` siguen siendo válidos (campo opcional).
3. Infraestructura: permisos de Cognito para la tarea de la API; `cdk diff` antes del despliegue.
4. Web. El despliegue va por `desplegar.yml` al hacer merge a `main`.
5. Reversión: revertir el merge. No hay migraciones de datos. Las cuentas creadas quedan en Cognito y se pueden desactivar.

## Open Questions

- Si Integra quiere otros umbrales de alerta, se cambian las constantes de `reglas.ts`.
- La vinculación persona–sala en la base queda para un cambio posterior.
