# API Observability Lite (IJNUT)

Drop-in TypeScript observability for APIs: per-route count / error % / avg / **p95**, recent request log, admin-secured HTTP API, **TanStack Start** dashboard, and a **built-in stress runner** (autocannon) — wired to a NestJS URL shortener so metrics are real under load.

> Portfolio story: load-test redirect **cache hit vs miss**, surface 401/429 in metrics, paste an **agent report** into Cursor, and document bottlenecks with numbers in [`RESULTS.md`](./RESULTS.md).

## Choose a path

| Path | What you run | Who pays for Gemini / stress CPU |
|------|----------------|----------------------------------|
| **Self-host** (default) | Full stack on your machine / VPS | You (bring your own `GEMINI_API_KEY`) |
| **IJNUT Cloud** (optional) | Dashboard only → operator’s hosted API | Operator — free tier is **gated**; upgrade or self-host when limited |
| **Cloud pro** | Same hosted API with `IJNUT_PLAN=pro` | Operator (paid later; flag unlocks limits today) |

Core metrics and the shortener stay available on free Cloud (guests welcome). **Gemini chat** and aggressive **stress** are what get limited — those are the cost drivers.

## Features

- Request timing + `x-request-id` on every request
- In-memory ring buffer + per-route aggregates (p95 from rolling samples)
- `GET /observability/overview` & `/requests` behind admin auth
- `POST /observability/stress` with **allowlist**, **caps**, and **rate limit (429)**
- Demo URL shortener: Postgres source of truth, Redis cache, `X-Cache: HIT|MISS|BYPASS`
- Dashboard open to guests; optional **better-auth** (email/password + GitHub + password reset)
- BFF uses server `OBSERVABILITY_ADMIN_TOKEN` for `/observability/*` (never paste admin key in the UI)
- Demo / Live base URL, custom methods, headers, body; calm 100svh metrics UI
- Optional **Gemini chat** (explain requests, summarize load tests, suggest fixes)
- **Agent report** — markdown snapshot you can copy into Cursor / any coding agent
- Cloud free: **3 lifetime AI messages** after sign-in, then dim panel + subscribe CTA; self-host unlimited with BYO Gemini

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

Open the dashboard as a guest. Sign in (email or GitHub) only if you want Cloud AI. Obs API still uses `ADMIN_TOKEN` on the server BFF (default `change-me`).

```bash
pnpm docker:down
pnpm docker:stack              # compose up -d --build
pnpm docker:up                 # Postgres + Redis only (for local pnpm dev)
pnpm --filter dashboard auth:migrate   # better-auth tables (once)
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

Open the hosted dashboard as a guest (metrics/stress/agent report). Sign in for **3 free AI messages**, then subscribe CTA (or self-host with your own Gemini key). Stress stays rate-limited on free Cloud.

**Host operators:** set `IJNUT_MODE=cloud`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, GitHub OAuth secrets, keep `STRESS_ALLOWLIST` tight, and set `GEMINI_API_KEY` on the dashboard. Until you deploy, the open-source path is self-host only — no VPS required for contributors.

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
| `IJNUT_AI_FREE_LIMIT` | Lifetime free Gemini chats per signed-in Cloud user (default `3`) |
| `IJNUT_PUBLIC_API_URL` | Public API URL for Demo stress targets |
| `ADMIN_TOKEN` / `OBSERVABILITY_ADMIN_TOKEN` | Protects `/observability/*` (server BFF only) |
| `OBSERVABILITY_API_URL` | Dashboard → API base URL (`http://api:3000` in Compose) |
| `DATABASE_URL` | Postgres for shortener + better-auth (host port **5433** with infra-only compose) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Auth crypto + public dashboard URL |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth |
| `RESEND_API_KEY` | Optional password-reset email (else link is logged) |
| `BACHS_SECRET_KEY` / `BACHS_PRODUCT_ID` / `BACHS_WEBHOOK_SECRET` | Cloud Pro checkout via [Bachs](https://bachs.io/) (optional) |
| `REDIS_URL` | Redis for redirect cache |
| `STRESS_ALLOWLIST` | Hosts stress may target |
| `STRESS_MAX_CONNECTIONS` / `STRESS_MAX_DURATION_SEC` | Safety caps (cloud free defaults lower if unset) |
| `GEMINI_API_KEY` | AI chat (self-host: yours; cloud: operator’s, gated) |
| `COOKIE_SECURE` | Set `true` only behind HTTPS |

**Never** put the admin token or auth secrets in `VITE_*` / public client env. `plan` / `aiRemaining` are authorized on the server only.

## Demo tips

1. Dashboard (guest) → create a short code via Demo API, warm Redis, run stress → hit vs miss ([`RESULTS.md`](./RESULTS.md)).
2. Stress twice quickly → **429** (and Cloud free shows upgrade/self-host CTA).
3. Cloud: sign in → 3 AI messages → panel dims → **Subscribe** ([Bachs](https://bachs.io/)) → webhook sets `plan=pro`.
4. `DELETE /shorten/:code` with `x-api-key: demo-user` → **403**; missing key → **401**.
5. **Agent report** → copy into Cursor and ask for a bottleneck write-up.

## Tradeoffs (v1)

1. **In-memory metrics** die on restart; multi-instance needs shared aggregation.
2. **Stress colocated** with the API skews CPU — fine for portfolio; isolate the runner in production.
3. **Route normalization** is required or cardinality explodes.
4. **Admin token** stays server-side in the dashboard BFF.
5. Stress **allowlist** + caps prevent open-proxy abuse (this is not a public load gun).
6. Cloud AI quota is **per-user in Postgres** (`aiUsed`); Bachs webhook sets `plan=pro` (or env `IJNUT_PLAN=pro`).

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
