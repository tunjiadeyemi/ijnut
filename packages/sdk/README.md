# `@ijnut/sdk`

Drop-in observability for Node APIs: request metrics (count / error % / p95), recent request log, and an allowlisted stress runner — with an HTTP API the IJNUT dashboard can talk to.

## Install (monorepo)

```bash
pnpm add @ijnut/sdk --filter your-api
# peer: express
```

From this repo after `pnpm install` + `pnpm --filter @ijnut/sdk build`.

## Quick start (Express)

```ts
import express from "express";
import { createIjnut } from "@ijnut/sdk";

const app = express();

const ijnut = createIjnut({
  serviceKey: process.env.OBSERVABILITY_SERVICE_KEY, // required for /observability/*
  stressAllowlist: "127.0.0.1,localhost,elioe.tech",
});

// Record every inbound request (mount early)
app.use(ijnut.middleware());
app.use(express.json());

// Dashboard talks here with Authorization: Bearer <service key>
app.use("/observability", ijnut.router());

app.get("/ping", (_req, res) => res.json({ ok: true }));
app.listen(3000);
```

Point the IJNUT dashboard at your API:

```env
OBSERVABILITY_API_URL=https://your-api.example
OBSERVABILITY_SERVICE_KEY=same-as-on-your-api
```

## What you get

| Piece | Purpose |
|--------|---------|
| `ijnut.middleware()` | `x-request-id` + timing → in-memory metrics store |
| `ijnut.router()` | `GET /overview`, `/requests`, `POST /stress`, … |
| `ijnut.store` | Same store the middleware writes to |
| Service key | Protects `/observability/*` (except `/health`) |

## Stress allowlist

`POST /observability/stress` only hammers hosts you list (`stressAllowlist` or `STRESS_ALLOWLIST`). That stops your API from becoming an open load gun.

## Spans (optional)

```ts
import { withSpan } from "@ijnut/sdk";

await withSpan("db.query", "db", async () => {
  // …
});
```

## NestJS

Use the Express-compatible middleware via Nest’s middleware consumer, or mount `ijnut.router()` on the underlying Express instance. The demo app in this monorepo (`apps/demo-api`) shows a Nest wiring that shares the same store primitives.

## Env

| Variable | Role |
|----------|------|
| `OBSERVABILITY_SERVICE_KEY` | Protects `/observability/*` (legacy: `ADMIN_TOKEN`) |
| `STRESS_ALLOWLIST` | Comma-separated hosts |
| `STRESS_MAX_CONNECTIONS` / `STRESS_MAX_DURATION_SEC` | Caps |
| `STRESS_RATE_LIMIT_PER_MIN` | Stress POST rate limit |
