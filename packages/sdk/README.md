# `@ijnut/sdk`

Drop-in observability for Node APIs: request metrics (count / error % / p95), recent request log, and an allowlisted stress runner — with an HTTP API the IJNUT dashboard can talk to.

## Install

```bash
pnpm add @ijnut/sdk
# peer: express and/or hono (both optional — install the one you use)
```

## Quick start (Hono)

```ts
import { Hono } from "hono";
import { createIjnutHono } from "@ijnut/sdk/hono";

const app = new Hono();
const ijnut = createIjnutHono({
  serviceKey: process.env.OBSERVABILITY_SERVICE_KEY,
  stressAllowlist: "127.0.0.1,localhost,your-api.example",
});

app.use("*", ijnut.middleware());
app.route("/observability", ijnut.app());
```

## Quick start (Express)

```ts
import express from "express";
import { createIjnut } from "@ijnut/sdk";

const app = express();

const ijnut = createIjnut({
  serviceKey: process.env.OBSERVABILITY_SERVICE_KEY, // required for /observability/*
  stressAllowlist: "127.0.0.1,localhost,your-api.example",
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

## Paste into your AI agent

Copy the block below into Cursor / Claude / ChatGPT (or any coding agent) in your backend repo:

````md
Integrate @ijnut/sdk into this Node API so the IJNUT dashboard can show metrics and run allowlisted load tests.

## Goals
1. Record every inbound request (timing + request id).
2. Expose `/observability/*` (overview, requests, stress) protected by a service key.
3. Do not break existing routes, auth, or CORS.

## Install
- `pnpm add @ijnut/sdk` (or npm/yarn).
- Peers: install `express`, `hono`, or use Nest — match this project.

## Framework pick (use the one this repo uses)
- **Express:** `createIjnut` from `@ijnut/sdk`
  - `app.use(ijnut.middleware())` early (before most routes).
  - `app.use("/observability", ijnut.router())`.
- **Hono:** `createIjnutHono` from `@ijnut/sdk/hono`
  - `app.use("*", ijnut.middleware())` then `app.route("/observability", ijnut.app())`.
- **NestJS:** `IjnutModule.forRoot({...})` from `@ijnut/sdk/nest`
  - Registers global metrics middleware + `/observability` controller.

## Config
- `serviceKey: process.env.OBSERVABILITY_SERVICE_KEY` (long random secret).
- `stressAllowlist`: hosts this API may load-test (e.g. `127.0.0.1,localhost,your-api.example` or `STRESS_ALLOWLIST`).
- Keep `/observability/health` public; all other `/observability/*` require `Authorization: Bearer <service key>`.

## Optional (recommended)
- Wrap DB calls with `tracedQuery(pool, sql, params)` or ORM calls with `withSpan(name, "db", fn)` so the dashboard can show SQL/cache timing.
- Never put secrets or raw PII in span `meta` — use `$1` placeholders in SQL.

## Dashboard wiring (document for the human)
```env
OBSERVABILITY_API_URL=<public origin of THIS API>
OBSERVABILITY_SERVICE_KEY=<same secret as on the API>
```

## Done when
- `GET /observability/health` → `{ ok: true }`
- `GET /observability/overview` with Bearer key → 200 JSON
- Same without key → 401
- Hit a normal app route; overview route counts increase after refresh

Read npm docs for `@ijnut/sdk` if imports differ. Prefer minimal diffs; match this repo’s style.
````

## What you get

| Piece | Purpose |
|--------|---------|
| `ijnut.middleware()` | `x-request-id` + timing → in-memory metrics store |
| `ijnut.router()` | `GET /overview`, `/requests`, `POST /stress`, … |
| `ijnut.store` | Same store the middleware writes to |
| Service key | Protects `/observability/*` (except `/health`) |

## Stress allowlist

`POST /observability/stress` only hammers hosts you list (`stressAllowlist` or `STRESS_ALLOWLIST`). That stops your API from becoming an open load gun.

## Spans (timing breakdowns)

Mount middleware first (`ijnut.middleware()`). Spans attach to the **current request** and show up in the dashboard History row (expand) and in Cloud AI context (`slowQueries`).

Import helpers from `@ijnut/sdk` (same from `@ijnut/sdk/hono` and `@ijnut/sdk/nest`).

### `tracedQuery` — SQL (recommended)

Wraps `pool.query` / `client.query` (node-postgres style). Records a `db` span with normalized SQL, op, duration, and `rowCount`. **Do not** put secrets or raw user PII in `meta` — keep `$1` placeholders.

```ts
import { Pool } from "pg";
import { tracedQuery } from "@ijnut/sdk";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// SELECT
const { rows } = await tracedQuery<{ rows: { id: string; email: string }[] }>(
  pool,
  `SELECT id, email FROM users WHERE id = $1`,
  [userId],
  { name: "db.select.users" }, // optional; default is db.select / db.insert / …
);

// INSERT
await tracedQuery(
  pool,
  `INSERT INTO orders (user_id, total) VALUES ($1, $2)`,
  [userId, total],
  { name: "db.insert.orders" },
);

// Extra safe tags (never secrets)
await tracedQuery(pool, `SELECT 1`, [], {
  name: "db.ping",
  meta: { table: "—" },
});
```

**Nest / Hono handlers** — call it inside the request handler the same way; middleware already opened the request context:

```ts
// Nest example
@Get("items/:id")
async getItem(@Param("id") id: string) {
  const { rows } = await tracedQuery(
    this.pool,
    `SELECT * FROM items WHERE id = $1`,
    [id],
    { name: "db.select.items" },
  );
  return rows[0] ?? null;
}
```

### `withSpan` — cache, HTTP, or any async work

Use when it is not a SQL `query()` call:

```ts
import { withSpan } from "@ijnut/sdk";

const cached = await withSpan(
  "redis.get",
  "cache", // "db" | "cache" | "http" | "other"
  () => redis.get(`user:${id}`),
  { key: "user:*" }, // safe meta only
);

const upstream = await withSpan(
  "http.payments",
  "http",
  () => fetch("https://payments.example/charge", { method: "POST", body }),
  { host: "payments.example" },
);
```

### `addSpan` — when you already timed something

```ts
import { addSpan } from "@ijnut/sdk";

const started = performance.now();
// … work …
addSpan({
  name: "hash.password",
  type: "other",
  durationMs: performance.now() - started,
});
```

### What the dashboard shows

| Span | Typical use |
|------|-------------|
| `db` + `meta.sql` | From `tracedQuery` — SQL text + ms + rows |
| `cache` | Redis / memory cache via `withSpan` |
| `http` | Outbound calls via `withSpan` |
| `other` | CPU / custom work |

If spans are empty, the helper ran **outside** a request (no middleware context), or you never called `tracedQuery` / `withSpan`.

### Tip: ORMs (Prisma, Drizzle, …)

`tracedQuery` expects a driver-style `query(sql, params)` (e.g. node-postgres). Most ORMs don’t expose that on every call, so:

1. **Wrap ORM calls with `withSpan`** — timing + model/op in `meta` (no SQL text):

```ts
const user = await withSpan(
  "db.user.findUnique",
  "db",
  () => prisma.user.findUnique({ where: { id } }),
  { model: "User", op: "findUnique" },
);
```

2. **Raw SQL** — keep using `tracedQuery(pool, …)` (or `withSpan` around `$queryRaw`).

3. **Drizzle / Kysely on a `pg` Pool** — wrap `pool.query` once with `addSpan` + `normalizeSql` / `inferSqlOp` (or route through `tracedQuery`) before `drizzle(pool)`, so generated SQL is recorded automatically.

4. **Prisma SQL text** — use Prisma query events / logging (`$on("query")`) and `addSpan({ type: "db", meta: { sql } })`; don’t expect `tracedQuery` on the Prisma client itself.

## Quick start (NestJS)

```ts
import { Module } from "@nestjs/common";
import { IjnutModule } from "@ijnut/sdk/nest";

@Module({
  imports: [
    IjnutModule.forRoot({
      serviceKey: process.env.OBSERVABILITY_SERVICE_KEY,
      stressAllowlist: "127.0.0.1,localhost,your-api.example",
    }),
  ],
})
export class AppModule {}
```

This registers metrics middleware on all routes and `/observability/*` (service-key protected). Inject the store with `@Inject(IJNUT_STORE)`.

## Exports

| Import | Runtime |
|--------|---------|
| `@ijnut/sdk` | Express (`createIjnut`) |
| `@ijnut/sdk/hono` | Hono (`createIjnutHono`) |
| `@ijnut/sdk/nest` | NestJS (`IjnutModule`) |

## Env

| Variable | Role |
|----------|------|
| `OBSERVABILITY_SERVICE_KEY` | Protects `/observability/*` (legacy: `ADMIN_TOKEN`) |
| `STRESS_ALLOWLIST` | Comma-separated hosts |
| `STRESS_MAX_CONNECTIONS` / `STRESS_MAX_DURATION_SEC` | Caps |
| `STRESS_RATE_LIMIT_PER_MIN` | Stress POST rate limit |
