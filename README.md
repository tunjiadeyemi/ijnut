# API Observability Lite

Drop-in TypeScript observability for APIs: per-route count / error % / avg / **p95**, recent request log, admin-secured HTTP API, **TanStack Start** dashboard, and a **built-in stress runner** (autocannon) — wired to a NestJS URL shortener so metrics are real under load.

> Portfolio story: load-test redirect **cache hit vs miss**, surface 401/429 in metrics, paste an **agent report** into Cursor, and document bottlenecks with numbers in [`RESULTS.md`](./RESULTS.md).

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

**pnpm workspaces** wire packages; **Turborepo** orchestrates `dev` / `build`.

## Quickstart (Docker — full stack)

One command once Docker Desktop is running:

```bash
cp .env.example .env          # optional Gemini key, change ADMIN_TOKEN
docker compose up --build
```

| Service   | URL |
|-----------|-----|
| Dashboard | http://localhost:3001 |
| Demo API  | http://localhost:3000 |
| Health    | http://localhost:3000/health |

Login with `ADMIN_TOKEN` (default `change-me`). Gemini chat is optional — set `GEMINI_API_KEY` in `.env` and recreate the dashboard container.

```bash
docker compose down            # stop
pnpm docker:stack              # same as compose up -d --build
pnpm docker:up                 # Postgres + Redis only (for local pnpm dev)
```

## Quickstart (local apps)

### Prerequisites

- Node 20+
- pnpm 9+
- Docker Desktop (Postgres + Redis)

### 1. Install & infra

```bash
pnpm install
cp .env.example .env
pnpm docker:up                 # postgres :5433 + redis :6379
```

### 2. Run API + dashboard

```bash
pnpm dev
# API        → http://127.0.0.1:3000
# Dashboard  → http://127.0.0.1:3001
```

Or separately: `pnpm --filter demo-api dev` / `pnpm --filter dashboard dev`.

### 3. Smoke checks

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

Open http://127.0.0.1:3001 → login with `change-me`.

## Architecture

```text
Browser (dashboard :3001)
  → TanStack Start server functions (holds OBSERVABILITY_ADMIN_TOKEN)
  → Demo API /observability/*  (auth → stress rate limit → handler)

Browser / autocannon
  → Demo API business routes
        → observability middleware (requestId + timing on res.finish)
        → handler (shorten / redirect)
        → metrics recorded

Stress runner (inside demo-api process for MVP)
  → hammers allowlisted target only
  → same middleware records live metrics
```

## Env vars

See [`.env.example`](./.env.example). Important ones:

| Variable | Purpose |
|----------|---------|
| `ADMIN_TOKEN` | Protects `/observability/*` |
| `OBSERVABILITY_ADMIN_TOKEN` | Dashboard server-side copy (must match) |
| `OBSERVABILITY_API_URL` | Dashboard → API base URL (`http://api:3000` in Compose) |
| `DATABASE_URL` | Postgres (host port **5433** when using infra-only compose) |
| `REDIS_URL` | Redis for redirect cache |
| `STRESS_ALLOWLIST` | Hosts stress may target |
| `STRESS_MAX_CONNECTIONS` / `STRESS_MAX_DURATION_SEC` | Safety caps |
| `GEMINI_API_KEY` | Optional AI chat + richer agent reports |
| `COOKIE_SECURE` | Set `true` only behind HTTPS |

**Never** put the admin token in `VITE_*` / public client env.

## Demo tips

1. Dashboard → login with `ADMIN_TOKEN` → create a short code, warm Redis, run stress → hit vs miss ([`RESULTS.md`](./RESULTS.md)).
2. Stress twice quickly → **429**; spam `POST /shorten` → **429**.
3. `DELETE /shorten/:code` with `x-api-key: demo-user` → **403**; missing key → **401**.
4. **Agent report** → copy into Cursor and ask for a bottleneck write-up.

## Tradeoffs (v1)

1. **In-memory metrics** die on restart; multi-instance needs shared aggregation.
2. **Stress colocated** with the API skews CPU — fine for portfolio; isolate the runner in production.
3. **Route normalization** is required or cardinality explodes.
4. **Admin token** stays server-side in the dashboard BFF.
5. Stress **allowlist** + caps prevent open-proxy abuse (this is not a public load gun).

## Scripts

| Command | What it does |
|---------|----------------|
| `pnpm docker:up` | Postgres + Redis only |
| `pnpm docker:stack` | Full stack (`compose up -d --build`) |
| `pnpm docker:down` | Tear down Compose |
| `pnpm dev` | API + dashboard (local) |
| `pnpm build` | Turbo build all packages |

## Resume one-liner

> Built API Observability Lite: drop-in request metrics (p95/errors per route), admin-secured TanStack Start dashboard with Gemini + agent reports, and allowlisted stress testing — load-tested redirect cache hit vs miss and documented bottlenecks with real numbers.
