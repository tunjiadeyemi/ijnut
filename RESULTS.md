# Load test results

Real numbers from the embedded stress runner (`POST /observability/stress`) against the Nest URL shortener on this machine.

## Environment

| Item | Value |
|------|--------|
| Date (UTC) | 2026-10-09 |
| Host | macOS, Intel Core i7-8569U @ 2.80GHz |
| Node | v20.19.4 |
| Docker | Postgres 16 + Redis 7 (`pnpm docker:up`) |
| Demo API | `http://127.0.0.1:3000` (same process as stress runner) |
| Load tool | autocannon (in-process via observability package) |

**Caveat:** colocating the stress runner with the API shares CPU. Absolute req/s is not comparable to a dedicated load generator on another host — relative **hit vs miss** is what matters here.

## Setup commands

```bash
pnpm docker:up
pnpm --filter demo-api dev

# create a short link
curl -s -X POST http://127.0.0.1:3000/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/results-demo"}'
# → code SMb_Rg (example from this run)
```

Admin auth for stress:

```bash
export AUTH="Authorization: Bearer change-me"
```

## Scenario A — Redis cache HIT

Warm the cache, then hammer the redirect.

```bash
# warm
curl -sI http://127.0.0.1:3000/SMb_Rg | grep X-Cache   # MISS then HIT

curl -s -X POST http://127.0.0.1:3000/observability/stress \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "target": "http://127.0.0.1:3000",
    "method": "GET",
    "path": "/SMb_Rg",
    "connections": 40,
    "durationSec": 5
  }'
```

### Result (`stress_c6c2ed88`)

| Metric | Value |
|--------|--------|
| requests/sec | **3478.2** |
| p50 latency | 10 ms |
| p95 latency | **15 ms** |
| p99 latency | 21 ms |
| errors | 0 |
| status codes | `302` × 17386 |
| route snapshot | `GET /:code` count 17396, middleware p95 ≈ 5.8 ms |

## Scenario B — Postgres path (cache bypass)

Same URL and load shape, but every request skips Redis via demo header `x-cache-mode: bypass` (always hits Postgres). This approximates a sustained **cache miss / uncached** path under load.

```bash
curl -s -X POST http://127.0.0.1:3000/observability/stress \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "target": "http://127.0.0.1:3000",
    "method": "GET",
    "path": "/SMb_Rg",
    "connections": 40,
    "durationSec": 5,
    "headers": { "x-cache-mode": "bypass" }
  }'
```

### Result (`stress_60e6d0a8`)

| Metric | Value |
|--------|--------|
| requests/sec | **2552** |
| p50 latency | 14 ms |
| p95 latency | **18 ms** |
| p99 latency | 25 ms |
| errors | 0 |
| status codes | `302` × 12757 |
| route snapshot | `GET /:code` cumulative count 30195, middleware p95 ≈ 7.8 ms |

## Comparison

| | Cache HIT (Redis) | Cache BYPASS (Postgres) | Delta |
|--|-------------------|-------------------------|-------|
| req/s | 3478 | 2552 | HIT ≈ **1.36×** throughput |
| p95 | 15 ms | 18 ms | miss/bypass ~**20%** slower p95 |
| p50 | 10 ms | 14 ms | |

### Takeaways

1. Redis-backed redirects sustain higher throughput and lower latency under the same connection count.
2. Middleware route key stays `GET /:code` (not per-code cardinality).
3. 302s are expected; stress report does **not** count 3xx as errors.
4. Stress runner + API in one process understates absolute capacity but still shows the cache effect clearly.

## Auth / rate limit checks (also verified)

| Check | Result |
|--------|--------|
| `GET /observability/overview` without token | **401** |
| Second stress within 1/min window (default `STRESS_RATE_LIMIT_PER_MIN=1`) | **429** |
| Unauthorized `POST /admin/echo` | **401** recorded in metrics |

## Reproduce notes

- Default stress rate limit is **1 run / minute**. For back-to-back RESULTS runs locally: `STRESS_RATE_LIMIT_PER_MIN=10 pnpm --filter demo-api dev`.
- Postgres is mapped to host **5433** in this repo (`DATABASE_URL=...@127.0.0.1:5433/...`) to avoid clashing with other local Postgres on 5432.
- Dashboard BFF: `pnpm --filter dashboard dev` → http://127.0.0.1:3001 (observability service key server-side only).
- Optional AI chat (Gemini): set `GEMINI_API_KEY` in root `.env`, restart dashboard; panel is on the right (explain / summarize / suggest + free chat).
- Agent report: dashboard **Copy for agent** pastes a prompt + markdown metrics snapshot into your clipboard.
