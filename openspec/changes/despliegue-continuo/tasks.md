## 1. Despliegue más rápido

- [x] 1.1 Target group de la API: chequeo de salud cada 10 s con 2 aciertos y timeout de 5 s, y `deregistration_delay` de 30 s, sin cambiar su id lógico (D1). Verificar con `prod-stacks.test.ts`
- [x] 1.2 `.dockerignore` como lista de inclusión (D2). Verificar que el hash del asset de la imagen no cambia al modificar `README.md` y sí al modificar `apps/api/src`, que `cdk.out/asset.<hash>/` solo contiene lo esperado y que `docker build -f apps/api/Dockerfile .` compila
- [x] 1.3 `apps/pipeline/build.mjs` borra `dist` antes de compilar. Verificar que un archivo viejo en `dist` desaparece
- [ ] 1.4 `pnpm aws:prod:diff`: el target group se modifica sin reemplazo y `ToquiRed`/`ToquiDatos` no cambian. Desplegar con aviso al equipo, medir el tiempo de `ToquiApp` (antes, 287 s) y correr `pnpm aws:prod:smoke`

## 2. Despliegue automático

- [x] 2.1 `cdk.mjs` y `comun.ts` solo fijan el perfil `toqui` sin credenciales en el entorno (D6)
- [x] 2.2 Stack `ToquiCiCd` con el proveedor OIDC y el rol `toqui-github-deploy`, y el script `aws:cicd:deploy` (D3). Verificar con `cicd-stack.test.ts`: trust restringida a `main` y sin políticas administradas
- [x] 2.3 `ci.yml` con `workflow_call` y sin `push`; `desplegar.yml` con `paths-ignore`, `concurrency` a nivel del workflow, revisión de migraciones y despliegue (D4, D5). Verificar la revisión de migraciones en local: falla con el rango que agregó `20261016100000_dataset_nucleos`, pasa con la marca y con un rango sin migraciones, y falla con una base que no es ancestro
- [ ] 2.4 Desplegar `ToquiCiCd` a mano y comprobar el rol en IAM
- [ ] 2.5 Tras el merge: el push a `main` despliega y el smoke termina en verde; un push solo de `docs/` no dispara el workflow

## 3. Documentación y cierre

- [x] 3.1 `docs/arquitectura-aws.md` y `README.md`: despliegue continuo, riesgo del rol, marca `[migracion-destructiva]`, cómo apagarlo, límites y orden de limpieza; quitar «CI/CD de despliegue» de Pendiente
- [ ] 3.2 Validar con `openspec validate despliegue-continuo --strict --no-interactive`
