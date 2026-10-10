# API Observability Lite (IJNUT)

Drop-in TypeScript observability for APIs: per-route count / error % / avg / **p95**, recent request log, admin-secured HTTP API, **TanStack Start** dashboard, and a **built-in stress runner** (autocannon) — wired to a NestJS URL shortener so metrics are real under load.

> Portfolio story: load-test redirect **cache hit vs miss**, surface 401/429 in metrics, paste an **agent report** into Cursor, and document bottlenecks with numbers in [`RESULTS.md`](./RESULTS.md).

## Choose a path

| Path | What you run | Who pays |
|------|----------------|----------|
| **Self-host** (default) | Local API + dashboard; BYO `GEMINI_API_KEY` / `COHERE_API_KEY` | You |
| **Cloud AI** (optional) | Local API for metrics/stress + hosted Cloud AI for chat | Operator — gated AI + **chat memory**; subscribe or self-host AI |
| **Cloud AI pro** | Same, after Bachs subscribe (`plan=pro`) | Operator (unlimited Cloud AI) |

**Metrics, stress, and allowlists always run on your API** (`pnpm` / Docker). Cloud only sells authenticated AI (quota + persisted memory). Stress is never paywalled.

## Features

- Request timing + `x-request-id` on every request
- In-memory ring buffer + per-route aggregates (p95 from rolling samples)
- `GET /observability/overview` & `/requests` behind admin auth
- `POST /observability/stress` with **allowlist**, **caps**, and **rate limit (429)**
- Demo URL shortener: Postgres source of truth, Redis cache, `X-Cache: HIT|MISS|BYPASS`
- Dashboard open to guests; optional **better-auth** (email/password + GitHub + password reset)
- BFF uses server `OBSERVABILITY_SERVICE_KEY` for `/observability/*` (never paste the service key in the UI)
- Demo / Live base URL, custom methods, headers, body; calm 100svh metrics UI
- Optional **Gemini chat** (explain requests, summarize load tests, suggest fixes)
- **Agent report** — markdown snapshot you can copy into Cursor / any coding agent
- Cloud AI: **3 lifetime messages** after sign-in + **persisted chat memory**, then subscribe CTA; self-host unlimited with BYO keys

## Embed in your API (`@ijnut/sdk`)

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

**Express:** `createIjnut` from `@ijnut/sdk`  
**NestJS:** `IjnutModule.forRoot(...)` from `@ijnut/sdk/nest`  

See [`packages/sdk/README.md`](./packages/sdk/README.md).

Then point the dashboard at your API (`OBSERVABILITY_API_URL` + matching `OBSERVABILITY_SERVICE_KEY`).

### Paste into your AI agent

Copy this into Cursor / Claude / ChatGPT in **your** backend repo to wire up the middleware:

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

## Monorepo layout

```text
api-observability-lite/
  apps/
    demo-api/          NestJS shortener + observability routes + stress
    dashboard/         TanStack Start UI (port 3001)
  packages/
    sdk/               @ijnut/sdk — Express middleware + /observability router
    observability/     Core store, p95, stress runner, allowlist, rate limiter
  docker-compose.yml   Postgres + Redis + API + dashboard
```

## Quickstart — self-host (recommended)

```bash
cp apps/demo-api/.env.example apps/demo-api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
# or: cp .env.example .env  (combined local file)
# set GEMINI_API_KEY or COHERE_API_KEY (+ AI_PROVIDER) on the API if you want AI
docker compose up --build
```

| Service   | URL |
|-----------|-----|
| Dashboard | http://localhost:3001 |
| Demo API  | http://localhost:3000 |
| Health    | http://localhost:3000/health |

Open the dashboard as a guest. Sign in (email or GitHub) only if you want Cloud AI. Obs API uses `OBSERVABILITY_SERVICE_KEY` on the server BFF (default `change-me`).

```bash
pnpm docker:down
pnpm docker:stack              # compose up -d --build
pnpm docker:up                 # Postgres + Redis only (for local pnpm dev)
pnpm --filter dashboard auth:migrate   # better-auth tables (once)
```

### Local apps (infra in Docker)

```bash
pnpm install
cp apps/demo-api/.env.example apps/demo-api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
pnpm docker:up                 # postgres :5433 + redis :6379
pnpm --filter dashboard auth:migrate   # once (or API auto-migrates on boot)
pnpm dev
# API → :3000   Dashboard → :3001
```

## Quickstart — Cloud AI + local API

Run **your** API locally (metrics/stress/allowlist). Point the dashboard at a hosted Cloud AI API for sign-in, gated chat, and memory.

```bash
# Terminal A — local observability API
cp apps/demo-api/.env.example apps/demo-api/.env
# IJNUT_MODE=selfhost  (default) — no AI keys required if using Cloud AI
pnpm docker:up && pnpm --filter demo-api dev

# Terminal B — dashboard
cp apps/dashboard/.env.example apps/dashboard/.env
# OBSERVABILITY_API_URL=http://127.0.0.1:3000
# OBSERVABILITY_SERVICE_KEY=<local metrics service key>
# IJNUT_CLOUD_AI_URL=https://your-cloud-ai.up.railway.app
# IJNUT_MODE=cloud
# (no Cloud AI service key — sign in for trials / subscribe)
pnpm --filter dashboard dev
```

Sign in for **3 free Cloud AI messages** (memory persists). Subscribe via Bachs for unlimited Cloud AI, or set keys on the local API with `IJNUT_MODE=selfhost` and omit `IJNUT_CLOUD_AI_URL`.

**Cloud AI operators:** deploy demo-api with `IJNUT_MODE=cloud`, `BETTER_AUTH_SECRET`, OAuth, `GEMINI_API_KEY` or `COHERE_API_KEY`, and Bachs. AI/billing are login-gated for customers (no shared service key required on their dashboard).

## Smoke checks (self-host)

```bash
curl -s http://127.0.0.1:3000/health

curl -s -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:3000/observability/overview
# → 401

curl -s -H "Authorization: Bearer change-me" \
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
  → Demo API /observability/*  (auth → stress rate limit → handler)

Browser / autocannon
  → Demo API business routes
        → observability middleware (requestId + timing on res.finish)
        → handler (shorten / redirect)
        → metrics recorded

Stress runner (inside demo-api)
  → hammers allowlisted target only
```

## Env vars

Per service (preferred):

- [`apps/demo-api/.env.example`](./apps/demo-api/.env.example) — API  
- [`apps/dashboard/.env.example`](./apps/dashboard/.env.example) — dashboard BFF  

Optional combined local file: [`.env.example`](./.env.example).

| Variable | Where | Purpose |
|----------|--------|---------|
| `OBSERVABILITY_SERVICE_KEY` | Metrics API + Dashboard | Key for metrics/stress `/observability/*` (legacy: `ADMIN_TOKEN`) |
| `OBSERVABILITY_API_URL` | Dashboard | Local API (metrics / stress) |
| `IJNUT_CLOUD_AI_URL` | Dashboard | Optional Cloud AI host (auth / AI / billing); customers sign in |
| `IJNUT_CLOUD_AI_SERVICE_KEY` | Dashboard | Optional; omit for login-only Cloud AI (split URL) |
| `BETTER_AUTH_SECRET` | Cloud AI API | Signs session cookies (not a user password) |
| `BETTER_AUTH_URL` | Both | Public **dashboard** origin (OAuth + cookies) |
| `DATABASE_URL` / `REDIS_URL` | API | Postgres + Redis |
| `AI_PROVIDER` / `GEMINI_*` / `COHERE_*` | AI host | AI (`gemini` or `cohere`) |
| `BACHS_*` / `GITHUB_*` | Cloud AI API | Billing, OAuth |
| `IJNUT_MODE` / `IJNUT_PLAN` | AI host (+ dashboard mode hint) | `cloud` gates AI; `selfhost` = BYO unlimited |
| `COOKIE_SECURE` | Dashboard | `true` only behind HTTPS |

**Never** put the observability service key or auth secrets in `VITE_*`. `plan` / `aiRemaining` are authorized on the Cloud AI API only.

## Demo tips

1. Dashboard (guest) → create a short code via Demo API, warm Redis, run stress → hit vs miss ([`RESULTS.md`](./RESULTS.md)).
2. Stress twice quickly → **429** (local rate limit — raise `STRESS_RATE_LIMIT_PER_MIN`).
3. Cloud AI: sign in → 3 messages + memory → panel dims → **Subscribe** ([Bachs](https://bachs.io/)) → webhook sets `plan=pro`.
4. `DELETE /shorten/:code` with `x-api-key: demo-user` → **403**; missing key → **401**.
5. **Agent report** → copy into Cursor and ask for a bottleneck write-up.

## Tradeoffs (v1)

1. **In-memory metrics** die on restart; multi-instance needs shared aggregation.
2. **Stress colocated** with the API skews CPU — fine for portfolio; isolate the runner in production.
3. **Route normalization** is required or cardinality explodes.
4. **Observability service key** stays server-side in the dashboard BFF.
5. Stress **allowlist** + caps prevent open-proxy abuse (this is not a public load gun).
6. Cloud AI quota is **per-user** (`aiUsed`); chat memory in `ai_chat_message`; Bachs sets `plan=pro`.

## Scripts

| Command | What it does |
|---------|----------------|
| `pnpm docker:up` | Postgres + Redis only |
| `pnpm docker:stack` | Full stack (`compose up -d --build`) |
| `pnpm docker:down` | Tear down Compose |
| `pnpm dev` | API + dashboard (local) |
| `pnpm build` | Turbo build all packages |

## Resume one-liner

> Built API Observability Lite (IJNUT): drop-in request metrics (p95/errors per route), admin-secured TanStack Start dashboard with Cloud AI + chat memory (or BYO keys), allowlisted stress testing on your API — load-tested redirect cache hit vs miss with real numbers.
