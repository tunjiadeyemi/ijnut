# Build context: monorepo root
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/observability/package.json packages/observability/
COPY apps/demo-api/package.json apps/demo-api/
COPY apps/dashboard apps/dashboard
RUN pnpm install --frozen-lockfile

RUN pnpm --filter dashboard build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/dashboard
EXPOSE 3001
CMD ["pnpm", "start"]
