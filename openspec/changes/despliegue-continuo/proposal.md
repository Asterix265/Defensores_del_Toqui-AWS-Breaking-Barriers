## Why

El backend de producción se despliega a mano desde una máquina del equipo con `pnpm aws:prod:deploy`, y cada despliegue tarda de 12 a 15 minutos. El del 16-10-2026, que activó Claude en la Lambda, tardó 287 s solo en `ToquiApp`, más el build y la subida de la imagen. Revisado en la cuenta y en el código el 16-10-2026:

- el target group de la API (`ApiTgInterno`) espera 300 s al desconectar la tarea vieja (`deregistration_delay` por defecto) y pide 5 chequeos de salud cada 30 s (unos 150 s) antes de dar por sana la nueva;
- el `.dockerignore` es una lista de exclusión: `README.md`, `apps/pipeline`, `packages/ia`, `infra`, `.github`, etc. entran al contexto de la imagen y a su hash. Un cambio solo en la Lambda o en la documentación reconstruye la imagen y reemplaza la tarea de la API, aunque el `Dockerfile` solo copie `apps/api` y `packages/shared`;
- `apps/pipeline/dist` no se limpia antes de compilar: el zip de la Lambda llevaba seis handlers viejos;
- la web ya se publica sola en Amplify con cada push a `main`; el backend no.

El usuario pidió el 16-10-2026 que front y back se desplieguen solos y más rápido, con despliegue totalmente automático (sin aprobación manual), `cdk deploy` normal (sin hotswap) y aceptando el desfase entre front y back.

## What Changes

- **Despliegue más rápido:** chequeo de salud del ALB cada 10 s con 2 aciertos, `deregistration_delay` de 30 s, `.dockerignore` como lista de inclusión (solo lo que copia el `Dockerfile` de la API) y build del pipeline que limpia `dist`.
- **Despliegue automático del backend:** un stack nuevo `ToquiCiCd` con el proveedor OIDC de GitHub y el rol `toqui-github-deploy`, que solo puede asumir la rama `main` del repositorio. Un workflow `desplegar.yml` que en cada push a `main` (salvo cambios solo de docs, OpenSpec, Markdown o web) corre la CI, revisa las migraciones nuevas, despliega `ToquiRed`, `ToquiDatos` y `ToquiApp` y corre el smoke.
- **Protección de migraciones destructivas:** el despliegue falla si una migración nueva contiene `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` o `DELETE FROM` y ningún mensaje de commit del rango lleva `[migracion-destructiva]`.
- **Scripts de infra sin el perfil `toqui` en la CI:** `cdk.mjs` y `comun.ts` solo fijan `AWS_PROFILE=toqui` cuando no hay credenciales en el entorno.
- `ci.yml` pasa a ser reutilizable (`workflow_call`) y deja de correr en `push` a `main`, que ahora cubre `desplegar.yml`.

## Capabilities

### New Capabilities

- `despliegue-continuo`: tiempos del despliegue de la API, despliegue automático del backend desde `main` y su protección ante migraciones destructivas.

### Modified Capabilities

Ninguna.

## Impact

- **Hechos:** el rol de ejecución de CloudFormation del bootstrap (`cdk-hnb659fds-cfn-exec-role`) tiene `AdministratorAccess`; `main` no tiene protección de rama; el repositorio es privado y de la cuenta personal `Asterix265`. La cuenta no tenía un proveedor OIDC.
- **Riesgo aceptado:** quien puede hacer push a `main` puede, en la práctica, cambiar cualquier recurso de la cuenta a través del despliegue. Proteger `main` le corresponde al dueño del repositorio.
- **Supuestos:** la SCP del evento permite crear el proveedor OIDC y el rol (el simulador de IAM no evalúa SCP); hay runners `ubuntu-24.04-arm` para el repositorio privado.
- **Exclusiones:** aprobación manual, hotswap, caché de capas de Docker en la CI, despliegue de la web desde el workflow y protección de rama.
- **Código:** `infra/lib/{app-stack,cicd-stack}.ts`, `infra/bin/app.ts`, `infra/scripts/{cdk.mjs,comun.ts}`, `infra/package.json`, pruebas de infra, `.dockerignore`, `apps/pipeline/build.mjs`, `.github/workflows/{ci,desplegar}.yml` y documentación.
- **Despliegue:** el primer despliegue reconstruye la imagen de la API (el hash cambia con el `.dockerignore`) y modifica el target group sin reemplazarlo.
