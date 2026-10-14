# Imagen de la API. Construir desde la raíz del repo:
#   docker build -f apps/api/Dockerfile -t toqui-api .
FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @toqui/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @toqui/shared build \
  && pnpm --filter @toqui/api prisma:generate \
  && pnpm --filter @toqui/api build \
  && pnpm --filter @toqui/api deploy --prod --legacy /out

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
