## Context

Producción son tres stacks de CDK (`ToquiRed`, `ToquiDatos` y `ToquiApp`) que se despliegan a mano con `pnpm aws:prod:deploy` y el perfil `toqui`. La API corre en Fargate (ARM64, una tarea, `minHealthyPercent` 100 y circuit breaker) detrás de un ALB interno. Antes de la API corre el contenedor `migraciones`, que aplica Prisma con el administrador. La web la publica Amplify en cada push a `main`. La CI (`ci.yml`) verifica en cada PR y en cada push a `main`, pero no despliega. Hechos y decisiones del usuario en `proposal.md`.

## Goals / Non-Goals

**Goals:**

- Bajar el tiempo de un despliegue que cambia la API y evitar que un cambio ajeno a la API la reemplace.
- Desplegar el backend solo en cada push relevante a `main`, con credenciales temporales y sin llaves guardadas en GitHub.
- No desplegar código viejo encima de uno nuevo ni aplicar sin aviso una migración que borra datos.

**Non-Goals:**

- Aprobación manual, GitHub Environments y protección de rama (le corresponden al dueño del repositorio).
- Hotswap, caché de capas de Docker en la CI y despliegue de la web desde el workflow.

## Decisions

### D1. Tiempos del target group

Chequeo de salud cada 10 s, con 2 aciertos y un timeout de 5 s, y `deregistration_delay` de 30 s. Las peticiones de la API duran milisegundos, así que esperar 300 s a que terminen no aporta nada. Se mantienen `overrideLogicalId('ApiTgInterno')`, porque cambiarlo reemplaza el target group, `minHealthyPercent` 100 / `maxHealthyPercent` 200 y el circuit breaker.

### D2. `.dockerignore` como lista de inclusión

`*` y luego `!` para los manifiestos de la raíz, `apps/api` y `packages/shared`; después se excluyen `node_modules`, `dist`, `coverage`, `.env*`, `*.tsbuildinfo` y `apps/api/src/generated` (lo regenera el `Dockerfile`, y así el hash es igual en local y en la CI). Se comprobó con `FileSystem.copyDirectory` de CDK (`IgnoreMode.DOCKER`) y con BuildKit que `*` + `!apps/api` vuelve a incluir la carpeta sin `!apps`.

- *Consecuencia:* un archivo sin versionar dentro de `apps/api` o `packages/shared` entra a la imagen. El despliegue manual se hace desde un `main` limpio.

### D3. Identidad de GitHub: `ToquiCiCd`

- `iam.OidcProviderNative` (recurso nativo de CloudFormation, sin Lambda de custom resource) para `token.actions.githubusercontent.com`.
- Rol `toqui-github-deploy` con trust `StringEquals` en `aud = sts.amazonaws.com` y `sub = repo:Asterix265/Defensores_del_Toqui-AWS-Breaking-Barriers:ref:refs/heads/main`. El job no usa `environment:`, porque cambiaría el `sub`.
- Permisos: `sts:AssumeRole` y `sts:TagSession` sobre los roles `deploy`, `file-publishing`, `image-publishing` y `lookup` del bootstrap; `cloudformation:DescribeStacks` sobre `CDKToolkit` y `Toqui*`; y, para el smoke, `sqs:SendMessage` sobre `toqui-prod-capturas` y `logs:FilterLogEvents` sobre `/toqui/prod/proceso`. Los ARN se arman con nombres fijos, sin referencias entre stacks, para no crear Exports que bloqueen las salidas de `ToquiApp`.
- *Riesgo:* CloudFormation ejecuta con `cfn-exec-role` (`AdministratorAccess`). Quien puede hacer push a `main` es, en la práctica, admin de la cuenta. Se documenta y se acepta para la hackatón: es una cuenta del evento con recursos sintéticos.
- Se despliega una sola vez a mano (`pnpm --filter @toqui/infra aws:cicd:deploy`).

### D4. Workflow `desplegar.yml`

- `on: push` a `main` con `paths-ignore` (`docs/**`, `openspec/**`, `**/*.md` y `apps/web/**`), y `workflow_dispatch`. Es un workflow aparte para poder apagarlo con `gh workflow disable desplegar.yml` sin tocar la CI.
- `concurrency: { group: despliegue-prod, cancel-in-progress: false }` a nivel del workflow. A nivel del job, el `verificar` de un push nuevo podría terminar antes y un push viejo desplegaría después. GitHub deja una ejecución en curso y una pendiente; la pendiente la reemplaza la más nueva, que despliega `HEAD`.
- Job `verificar` que reutiliza `ci.yml` (`workflow_call`). `ci.yml` deja de correr en `push` a `main`.
- Job `desplegar` en `ubuntu-24.04-arm`: construye el pipeline y comprueba `dist/proceso.mjs` (sin él, CDK sintetiza una Lambda que siempre falla). Luego asume el rol con `aws-actions/configure-aws-credentials` fijada por SHA, corre `pnpm --filter @toqui/infra run aws:prod:deploy --require-approval never` (con `run` explícito y sin `--`: con `--filter` y sin `run`, pnpm 11 toma la opción como propia y falla, y con `--` la pasa literal y CDK deja de leerla) y `pnpm aws:prod:smoke`. Son los mismos scripts que en local.
- *Alternativa descartada:* un filtro de rutas dentro del job con `github.event.before`. Si una ejecución pendiente era reemplazada por un push solo de docs, los cambios del push reemplazado no se desplegaban.

### D5. Revisión de migraciones

La base es el `headSha` del último despliegue exitoso (`gh run list`), o `b724e9f` si todavía no hay ninguno. Con `set -euo pipefail`:

- falla si la base no es ancestro del commit actual;
- toma solo las líneas agregadas de migraciones nuevas (`--diff-filter=A`), para no coincidir con `ON DELETE` ni con comentarios;
- busca la marca en `git log --format=%B` de todo el rango, porque los merges solo llevan el título del PR;
- usa here-strings en vez de tuberías, para que un error de `git` no se confunda con «sin coincidencias» y que `grep -q` no falle por SIGPIPE.

### D6. Perfil solo en local

`cdk.mjs` y `comun.ts` fijan `AWS_PROFILE=toqui` solo si no hay `AWS_ACCESS_KEY_ID` ni `AWS_WEB_IDENTITY_TOKEN_FILE` en el entorno y `CI` no es `true`.

## Risks / Trade-offs

- **SCP del evento:** si rechaza el proveedor OIDC o el rol, el despliegue sigue siendo manual. Lo de D1 y D2 vale igual.
- **Rollback:** el circuit breaker de ECS no deshace migraciones, y la tarea vieja convive un rato con el esquema nuevo. `/health` responde 200 aunque la API esté degradada: una API sin base la detecta el smoke, que no revierte. La reversión es `git revert` y push, o `pnpm aws:prod:deploy` local.
- **Desfase front/back:** Amplify publica en unos 2,5 min aunque la CI falle, y el back queda listo en unos 10 min. Los cambios de contrato deben ser aditivos.
- **Sin CI en el push:** un push directo a `main` que solo toca web o docs no corre la CI (`main` no está protegida).
- **Costo:** el smoke hace una llamada a Claude Opus 5 por despliegue.
- **Tiempos:** sin caché de capas, se estiman 9–12 min desde el push hasta producción cuando cambia la API (sin medir).
- **Limpieza:** apagar `desplegar.yml` y destruir `ToquiCiCd` antes que los stacks de producción; si no, el siguiente push los vuelve a crear, Aurora incluida.
