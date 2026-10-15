## 1. API y empaquetado

- [x] 1.1 Entrypoint del contenedor con composición de `DATABASE_URL` y `prisma migrate deploy`; Dockerfile actualizado y verificado en local contra Postgres de Docker

## 2. Stacks

- [x] 2.1 `ToquiRed`: VPC pública + aislada sin NAT
- [x] 2.2 `ToquiDatos`: Aurora Serverless v2 con secreto y grupo de seguridad
- [x] 2.3 `ToquiApp`: S3, Cognito, Guardrail, Fargate + ALB restringido, pipeline con EventBridge y Step Functions, web con CloudFront
- [x] 2.4 Pruebas de aserción y `cdk synth` de los tres stacks

## 3. Scripts y despliegue

- [x] 3.1 Scripts `pnpm aws:prod:deploy`, `aws:prod:smoke`, `aws:prod:destroy` y selección de stack en los scripts compartidos
- [x] 3.2 Desplegar los tres stacks y verificar con la prueba de humo de producción

## 4. Documentación

- [x] 4.1 `docs/arquitectura-aws.md`, guía AWS, README y `definir-mvp-e1` (cambio a CloudFront) actualizados
- [x] 4.2 Validar con `openspec validate levantar-arquitectura-aws --strict --no-interactive`
