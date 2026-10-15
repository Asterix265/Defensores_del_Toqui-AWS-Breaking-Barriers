# Imagen de la API. Construir desde la raíz del repo:
#   docker build -f apps/api/Dockerfile -t toqui-api .
FROM node:24-slim AS build
WORKDIR /repo
# OpenSSL igual que en la imagen final, para que Prisma elija el mismo motor.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/ia/package.json packages/ia/
RUN pnpm install --frozen-lockfile --filter @toqui/api...
COPY packages/shared packages/shared
COPY packages/ia packages/ia
COPY apps/api apps/api
RUN pnpm --filter @toqui/shared build \
  && pnpm --filter @toqui/ia build \
  && pnpm --filter @toqui/api prisma:generate \
  && pnpm --filter @toqui/api build \
  && pnpm --filter @toqui/api deploy --prod --legacy /out
# Descarga el motor de migraciones de Prisma durante el build (en ejecución no hay permisos).
RUN cd /out && node_modules/.bin/prisma version
# Bundle oficial de CA de RDS para verificar TLS contra Aurora.
RUN node -e "fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => require('fs').writeFileSync('/out/rds-ca.pem', t))"

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
# OpenSSL lo usa el motor de migraciones de Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/rds-ca.pem ./rds-ca.pem
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=build /repo/apps/api/docker-entrypoint.mjs ./docker-entrypoint.mjs
USER node
EXPOSE 3000
CMD ["node", "docker-entrypoint.mjs"]
