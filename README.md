# API Observability Lite (IJNUT)

Drop-in TypeScript observability for Node APIs: per-route count / error % / avg / **p95**, recent request log, service-key secured `/observability/*` HTTP API, **TanStack Start** dashboard, allowlisted **stress runner** (autocannon), and optional **Cloud AI** (explain requests, summarize load tests, suggest fixes).

## Summary

> **Steps (details below):**
>
> 1. **Quick start** — run the dashboard locally and point Cloud AI at the hosted API.
> 2. **Instrument your backend** — install `@ijnut/sdk` middleware so metrics and stress run on *your* API (or use this repo’s demo API while you try the UI).
> 3. **Wire the dashboard** — `OBSERVABILITY_API_URL` + `OBSERVABILITY_SERVICE_KEY` → your metrics API; `IJNUT_CLOUD_AI_URL` → Cloud AI.
> 4. **Use it** — open the dashboard, generate traffic, run load tests, Ask / agent report.

| Piece | Where it runs |
|-------|----------------|
| Metrics, stress, allowlist | **Your** API (or local `demo-api`) |
| Dashboard UI | Local (or your deploy) |
| Sign-in, gated Ask, chat memory | [Hosted Cloud AI](https://demo-api-production-b361.up.railway.app) (or self-host) |

Stress is never paywalled. Cloud AI is login-gated (free tier, then subscribe — or BYO keys in full self-host).

## Quick start (recommended: local + Cloud AI)

Run the **dashboard** (and optionally the demo API) on your machine. Use the hosted Cloud AI for sign-in and Ask:

**Cloud AI API:** https://demo-api-production-b361.up.railway.app

```bash
pnpm install
cp apps/dashboard/.env.example apps/dashboard/.env
```

In `apps/dashboard/.env`:

```env
# Metrics / stress — your instrumented API (or local demo-api on :3000)
OBSERVABILITY_API_URL=http://127.0.0.1:3000
OBSERVABILITY_SERVICE_KEY=replace-with-long-random-secret

# Hosted Cloud AI (auth + Ask + memory)
IJNUT_CLOUD_AI_URL=https://demo-api-production-b361.up.railway.app
IJNUT_MODE=cloud

BETTER_AUTH_URL=http://127.0.0.1:3001
COOKIE_SECURE=false
```

You still need a metrics API with the middleware (step below). Fastest demo:

```bash
cp apps/demo-api/.env.example apps/demo-api/.env
# Match OBSERVABILITY_SERVICE_KEY to the dashboard
# IJNUT_MODE=selfhost on the local API (metrics only; AI goes to Cloud AI URL)
pnpm docker:up
pnpm --filter demo-api dev   # → :3000
pnpm --filter dashboard dev  # → :3001
```

Open http://localhost:3001 — browse as a guest for metrics/stress. **Sign in** for Cloud AI (free messages + chat memory).

> Without middleware on some backend, the dashboard has nothing to show. Use `demo-api` above, or install `@ijnut/sdk` on your own API next.

### Optional: full self-host (no Cloud AI URL)

```bash
cp apps/demo-api/.env.example apps/demo-api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
# Set GEMINI_API_KEY or COHERE_API_KEY (+ AI_PROVIDER) on the API for local Ask
# Leave IJNUT_CLOUD_AI_URL unset; IJNUT_MODE=selfhost
docker compose up --build
# Dashboard http://localhost:3001 · API http://localhost:3000
```

```bash
pnpm docker:up                 # Postgres + Redis only
pnpm docker:stack              # full compose
pnpm docker:down
pnpm --filter dashboard auth:migrate   # better-auth tables (once)
pnpm dev                       # API :3000 + dashboard :3001
```

## Embed in your API (`@ijnut/sdk`)

Install the middleware on the Node API you want to observe. Peers: NestJS, Express, or Hono — pick what your project uses.

```bash
pnpm add @ijnut/sdk
```

**NestJS:**

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

**Node.js (Express):**

```ts
import express from "express";
import { createIjnut } from "@ijnut/sdk";

const app = express();
const ijnut = createIjnut({
  serviceKey: process.env.OBSERVABILITY_SERVICE_KEY,
  stressAllowlist: "127.0.0.1,localhost,your-api.example",
});

app.use(ijnut.middleware());
app.use(express.json());
app.use("/observability", ijnut.router());

app.get("/ping", (_req, res) => res.json({ ok: true }));
app.listen(3000);
```

**Hono:**

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

Point the dashboard at that API (`OBSERVABILITY_API_URL` + matching `OBSERVABILITY_SERVICE_KEY`). More detail: [`packages/sdk/README.md`](./packages/sdk/README.md).

### Paste into your AI agent

Copy this into Cursor / Claude / ChatGPT in **your** backend repo:

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
- **NestJS:** `IjnutModule.forRoot({...})` from `@ijnut/sdk/nest`
  - Registers global metrics middleware + `/observability` controller.
- **Node.js / Express:** `createIjnut` from `@ijnut/sdk`
  - `app.use(ijnut.middleware())` early (before most routes).
  - `app.use("/observability", ijnut.router())`.
- **Hono:** `createIjnutHono` from `@ijnut/sdk/hono`
  - `app.use("*", ijnut.middleware())` then `app.route("/observability", ijnut.app())`.

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

## Features

- Request timing + `x-request-id` on every request
- In-memory ring buffer + per-route aggregates (p95 from rolling samples)
- `GET /observability/overview` & `/requests` behind service-key auth
- `POST /observability/stress` with **allowlist**, **caps**, and **rate limit (429)**
- Demo URL shortener: Postgres + Redis cache, `X-Cache: HIT|MISS|BYPASS`
- Dashboard open to guests; optional **better-auth** (email/password + GitHub)
- BFF keeps `OBSERVABILITY_SERVICE_KEY` server-side (never in the browser)
- Optional AI chat + **agent report** (markdown snapshot for coding agents)
- Cloud AI: free tier after sign-in + persisted chat memory; self-host unlimited with BYO keys

## Monorepo layout

```text
api-observability-lite/
  apps/
    demo-api/          NestJS shortener + observability + stress (+ optional Cloud AI host)
    dashboard/         TanStack Start UI (port 3001)
  packages/
    sdk/               @ijnut/sdk — Nest / Express / Hono
    observability/     Core store, p95, stress runner, allowlist, rate limiter
  docker-compose.yml   Postgres + Redis + API + dashboard
```

## Smoke checks

```bash
curl -s http://127.0.0.1:3000/health

curl -s -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:3000/observability/overview
# → 401

curl -s -H "Authorization: Bearer $OBSERVABILITY_SERVICE_KEY" \
  http://127.0.0.1:3000/observability/overview | python3 -m json.tool

curl -s -X POST http://127.0.0.1:3000/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
curl -sI http://127.0.0.1:3000/<code>   # X-Cache: MISS then HIT
```

## Architecture

```text
Browser (dashboard :3001)
  → TanStack Start server functions
  → Metrics API /observability/*  (service key → stress rate limit → handler)
  → optional Cloud AI host (session auth → Ask / billing)

Browser / autocannon
  → Your API business routes
        → observability middleware (requestId + timing)
        → handler
        → metrics recorded

Stress runner (inside the metrics API)
  → hammers allowlisted targets only
```

## Env vars

Per service (preferred):

- [`apps/demo-api/.env.example`](./apps/demo-api/.env.example) — API  
- [`apps/dashboard/.env.example`](./apps/dashboard/.env.example) — dashboard BFF  

Optional combined local file: [`.env.example`](./.env.example).

| Variable | Where | Purpose |
|----------|--------|---------|
| `OBSERVABILITY_SERVICE_KEY` | Metrics API + Dashboard | Key for metrics/stress `/observability/*` |
| `OBSERVABILITY_API_URL` | Dashboard | Metrics / stress API origin |
| `IJNUT_CLOUD_AI_URL` | Dashboard | Cloud AI host (auth / AI / billing); sign in — no shared AI service key required |
| `IJNUT_CLOUD_AI_SERVICE_KEY` | Dashboard | Optional; omit for login-only Cloud AI |
| `BETTER_AUTH_SECRET` | Cloud AI API | Signs session cookies |
| `BETTER_AUTH_URL` | Both | Public **dashboard** origin (OAuth + cookies) |
| `DATABASE_URL` / `REDIS_URL` | API | Postgres + Redis |
| `AI_PROVIDER` / `GEMINI_*` / `COHERE_*` | AI host | AI provider keys |
| `BACHS_*` / `GITHUB_*` | Cloud AI API | Billing, OAuth |
| `IJNUT_MODE` / `IJNUT_PLAN` | AI host (+ dashboard hint) | `cloud` gates AI; `selfhost` = BYO unlimited |
| `COOKIE_SECURE` | Dashboard | `true` only behind HTTPS |

**Never** put the observability service key or auth secrets in `VITE_*`.

## Try the demo

1. Dashboard → generate traffic (or run stress) → routes / history update.
2. Stress twice quickly → **429** (raise `STRESS_RATE_LIMIT_PER_MIN` if needed).
3. Cloud AI: sign in → free messages + memory → subscribe via [Bachs](https://bachs.io/) for unlimited Ask (when configured).
4. **Agent report** → copy into your coding agent for a bottleneck write-up.
5. Example numbers from a local hit-vs-miss run: [`RESULTS.md`](./RESULTS.md).

## Tradeoffs (v1)

1. **In-memory metrics** reset on process restart; multi-instance needs shared aggregation.
2. **Stress colocated** with the API shares CPU — fine for demos; isolate the runner in production.
3. **Route normalization** is required or cardinality explodes.
4. **Observability service key** stays server-side in the dashboard BFF.
5. Stress **allowlist** + caps prevent open-proxy abuse.
6. Cloud AI quota is **per-user**; chat memory is persisted on the AI host.

## Scripts

| Command | What it does |
|---------|----------------|
| `pnpm docker:up` | Postgres + Redis only |
| `pnpm docker:stack` | Full stack (`compose up -d --build`) |
| `pnpm docker:down` | Tear down Compose |
| `pnpm dev` | API + dashboard (local) |
| `pnpm build` | Turbo build all packages |
