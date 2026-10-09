# Build context: monorepo root
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/observability packages/observability
COPY apps/demo-api apps/demo-api
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile

# turbo ^build ensures @api-obs/observability dist exists (gitignored; not in the image context)
RUN pnpm exec turbo run build --filter=demo-api

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/demo-api
EXPOSE 3000
CMD ["node", "dist/main.js"]
