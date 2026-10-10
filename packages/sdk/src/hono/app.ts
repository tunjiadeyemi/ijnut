import { Hono } from "hono";
import {
  MetricsStore,
  FixedWindowRateLimiter,
  parseAllowlist,
  runStress,
  type StressRequestBody,
} from "@api-obs/observability";
import type { ObservabilityRouterOptions } from "../router";

function extractServiceKey(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  const header =
    c.req.header("x-observability-service-key") || c.req.header("x-admin-key");
  if (header?.trim()) return header.trim();
  const auth = c.req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/**
 * Hono app for `/observability/*` (mount with `app.route('/observability', ijnut.app())`).
 */
export function createHonoObservabilityApp(
  options: ObservabilityRouterOptions,
): Hono {
  const app = new Hono();
  const {
    store,
    serviceKey,
    stressAllowlist = process.env.STRESS_ALLOWLIST,
    demoPublicUrl = process.env.DEMO_PUBLIC_URL,
    maxConnections = Number(process.env.STRESS_MAX_CONNECTIONS ?? 100),
    maxDurationSec = Number(process.env.STRESS_MAX_DURATION_SEC ?? 60),
    maxAmount = Number(process.env.STRESS_MAX_AMOUNT ?? 50_000),
    stressRateLimitPerMin = Number(process.env.STRESS_RATE_LIMIT_PER_MIN ?? 10),
  } = options;

  const limiter = new FixedWindowRateLimiter(stressRateLimitPerMin, 60_000);

  app.get("/health", (c) =>
    c.json({ ok: true, service: "observability", sdk: "@ijnut/sdk", runtime: "hono" }),
  );

  app.use("*", async (c, next) => {
    // Mounted under /observability — path may be /health or /observability/health
    if (c.req.method === "GET" && /(^|\/)health$/.test(c.req.path)) {
      await next();
      return;
    }
    if (!serviceKey) {
      return c.json(
        { statusCode: 401, message: "OBSERVABILITY_SERVICE_KEY is not configured" },
        401,
      );
    }
    const provided = extractServiceKey(c);
    if (!provided || provided !== serviceKey) {
      return c.json(
        {
          statusCode: 401,
          message: "Invalid or missing observability service key",
        },
        401,
      );
    }
    await next();
  });

  app.get("/overview", (c) => c.json(store.getOverview("p95ms")));

  app.delete("/history", (c) => {
    store.clear();
    return c.json({ ok: true, clearedAt: new Date().toISOString() });
  });

  app.get("/requests", (c) => {
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
    const status = c.req.query("status")
      ? Number(c.req.query("status"))
      : undefined;
    const path = c.req.query("path") ?? undefined;
    return c.json({
      requests: store.getRecentRequests({ limit, status, path }),
    });
  });

  app.get("/routes/:key", (c) => {
    const decoded = decodeURIComponent(c.req.param("key"));
    const route = store.getRoute(decoded);
    return c.json({ route: route ?? null });
  });

  app.get("/stress", (c) => c.json({ reports: store.listStressReports() }));

  app.get("/stress/:id", (c) => {
    const report = store.getStressReport(c.req.param("id"));
    if (!report) {
      return c.json(
        {
          statusCode: 404,
          message: `Unknown stress id: ${c.req.param("id")}`,
        },
        404,
      );
    }
    return c.json(report);
  });

  app.post("/stress", async (c) => {
    const { allowed, retryAfterSec } = limiter.tryConsume("stress");
    if (!allowed) {
      return c.json(
        {
          statusCode: 429,
          error: "Too Many Requests",
          message: `Stress rate limit exceeded. Retry after ${retryAfterSec}s`,
          retryAfterSec,
        },
        429,
      );
    }

    let body: StressRequestBody;
    try {
      body = (await c.req.json()) as StressRequestBody;
    } catch {
      return c.json({ statusCode: 400, message: "Invalid JSON body" }, 400);
    }

    if (!body?.target || !body?.path) {
      return c.json(
        { statusCode: 400, message: "target and path are required" },
        400,
      );
    }

    const allowlist = parseAllowlist(stressAllowlist, demoPublicUrl);

    try {
      const { report } = await runStress(body, store, {
        allowlist,
        maxConnections,
        maxDurationSec,
        maxAmount,
      });
      return c.json(report);
    } catch (err) {
      return c.json(
        {
          statusCode: 400,
          message: err instanceof Error ? err.message : "Stress run failed",
        },
        400,
      );
    }
  });

  return app;
}
