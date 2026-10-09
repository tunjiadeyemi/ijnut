# API Observability Lite (IJNUT)

Drop-in TypeScript observability for APIs: per-route count / error % / avg / **p95**, recent request log, admin-secured HTTP API, **TanStack Start** dashboard, and a **built-in stress runner** (autocannon) — wired to a NestJS URL shortener so metrics are real under load.

> Portfolio story: load-test redirect **cache hit vs miss**, surface 401/429 in metrics, paste an **agent report** into Cursor, and document bottlenecks with numbers in [`RESULTS.md`](./RESULTS.md).

## Choose a path

| Path | What you run | Who pays for Gemini / stress CPU |
|------|----------------|----------------------------------|
| **Self-host** (default) | Full stack on your machine / VPS | You (bring your own `GEMINI_API_KEY`) |
| **IJNUT Cloud** (optional) | Dashboard only → operator’s hosted API | Operator — free tier is **gated**; upgrade or self-host when limited |
| **Cloud pro** | Same hosted API with `IJNUT_PLAN=pro` | Operator (paid later; flag unlocks limits today) |

Core metrics, login, and the shortener stay available on free Cloud. **Gemini chat** and aggressive **stress** are what get limited — those are the cost drivers.

## Features

- Request timing + `x-request-id` on every request
- In-memory ring buffer + per-route aggregates (p95 from rolling samples)
- `GET /observability/overview` & `/requests` behind admin auth
- `POST /observability/stress` with **allowlist**, **caps**, and **rate limit (429)**
- Demo URL shortener: Postgres source of truth, Redis cache, `X-Cache: HIT|MISS|BYPASS`
- Dashboard login: admin key → validated by demo-api → httpOnly cookie (BFF)
- Demo / Live base URL, custom methods, headers, body; calm 100svh metrics UI
- Optional **Gemini chat** (explain requests, summarize load tests, suggest fixes)
- **Agent report** — markdown snapshot you can copy into Cursor / any coding agent
- Cloud free: daily AI quota + stricter stress defaults; CTA to upgrade or self-host

## Monorepo layout

```text
api-observability-lite/
  apps/
    demo-api/          NestJS shortener + observability routes + stress
    dashboard/         TanStack Start UI (port 3001)
  packages/
    observability/     Shared store, p95, stress runner, allowlist, rate limiter
  docker-compose.yml   Postgres + Redis + API + dashboard
```

## Quickstart — self-host (recommended)

```bash
cp .env.example .env          # set GEMINI_API_KEY if you want AI
docker compose up --build
```

| Service   | URL |
|-----------|-----|
| Dashboard | http://localhost:3001 |
| Demo API  | http://localhost:3000 |
| Health    | http://localhost:3000/health |

Login with `ADMIN_TOKEN` (default `change-me`).

```bash
pnpm docker:down
pnpm docker:stack              # compose up -d --build
pnpm docker:up                 # Postgres + Redis only (for local pnpm dev)
```

### Local apps (infra in Docker)

```bash
pnpm install
cp .env.example .env
pnpm docker:up                 # postgres :5433 + redis :6379
pnpm dev
# API → :3000   Dashboard → :3001
```

## Quickstart — try IJNUT Cloud (no Docker for you)

When a public API is deployed (VPS/PaaS running this Compose stack):

```bash
pnpm install
cp .env.example .env
# Point at the hosted API (example — replace with the real URL when live)
# OBSERVABILITY_API_URL=https://api.ijnut.example
# IJNUT_PUBLIC_API_URL=https://api.ijnut.example
# IJNUT_MODE=cloud
# IJNUT_PLAN=free
pnpm --filter dashboard dev
```

Login with the demo admin token the operator publishes. Metrics/login/shortener work; AI hits a **daily cap**; stress is rate-limited — upgrade (`IJNUT_PLAN=pro` on the host) or self-host with your own Gemini key.

**Host operators:** set `IJNUT_MODE=cloud`, keep `STRESS_ALLOWLIST` tight (only your public host), low `STRESS_RATE_LIMIT_PER_MIN`, and set `GEMINI_API_KEY` on the dashboard service. Until you deploy, the open-source path is self-host only — no VPS required for contributors.

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

See [`.env.example`](./.env.example). Important ones:

| Variable | Purpose |
|----------|---------|
| `IJNUT_MODE` | `selfhost` (default) or `cloud` |
| `IJNUT_PLAN` | `free` or `pro` (cloud AI/stress limits) |
| `IJNUT_AI_DAILY_LIMIT` | Cloud free Gemini chats per UTC day (default `5`) |
| `IJNUT_PUBLIC_API_URL` | Public API URL for Demo stress targets |
| `ADMIN_TOKEN` | Protects `/observability/*` |
| `OBSERVABILITY_API_URL` | Dashboard → API base URL (`http://api:3000` in Compose) |
| `DATABASE_URL` | Postgres (host port **5433** when using infra-only compose) |
| `REDIS_URL` | Redis for redirect cache |
| `STRESS_ALLOWLIST` | Hosts stress may target |
| `STRESS_MAX_CONNECTIONS` / `STRESS_MAX_DURATION_SEC` | Safety caps (cloud free defaults lower if unset) |
| `GEMINI_API_KEY` | AI chat (self-host: yours; cloud: operator’s, gated) |
| `COOKIE_SECURE` | Set `true` only behind HTTPS |

**Never** put the admin token in `VITE_*` / public client env.

## Demo tips

1. Dashboard → login with `ADMIN_TOKEN` → create a short code, warm Redis, run stress → hit vs miss ([`RESULTS.md`](./RESULTS.md)).
2. Stress twice quickly → **429** (and Cloud free shows upgrade/self-host CTA).
3. `DELETE /shorten/:code` with `x-api-key: demo-user` → **403**; missing key → **401**.
4. **Agent report** → copy into Cursor and ask for a bottleneck write-up.

## Tradeoffs (v1)

1. **In-memory metrics** die on restart; multi-instance needs shared aggregation.
2. **Stress colocated** with the API skews CPU — fine for portfolio; isolate the runner in production.
3. **Route normalization** is required or cardinality explodes.
4. **Admin token** stays server-side in the dashboard BFF.
5. Stress **allowlist** + caps prevent open-proxy abuse (this is not a public load gun).
6. Cloud AI quota is **in-process** (resets on restart / not shared across replicas yet).

## Scripts

| Command | What it does |
|---------|----------------|
| `pnpm docker:up` | Postgres + Redis only |
| `pnpm docker:stack` | Full stack (`compose up -d --build`) |
| `pnpm docker:down` | Tear down Compose |
| `pnpm dev` | API + dashboard (local) |
| `pnpm build` | Turbo build all packages |

## Resume one-liner

> Built API Observability Lite (IJNUT): drop-in request metrics (p95/errors per route), admin-secured TanStack Start dashboard with Gemini + agent reports, allowlisted stress testing, and a pay-or-self-host gate on Cloud AI/stress — load-tested redirect cache hit vs miss with real numbers.
