import { Router, type Request, type Response, type NextFunction } from "express";
import {
  MetricsStore,
  FixedWindowRateLimiter,
  parseAllowlist,
  runStress,
  type StressRequestBody,
} from "@api-obs/observability";
import { requireServiceKey } from "./service-key";

export type ObservabilityRouterOptions = {
  store: MetricsStore;
  serviceKey: string | undefined;
  stressAllowlist?: string;
  demoPublicUrl?: string;
  maxConnections?: number;
  maxDurationSec?: number;
  maxAmount?: number;
  stressRateLimitPerMin?: number;
};

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

/**
 * Express router mounted at `/observability` (or any base path).
 * Protects all routes except `GET /health` with the service key.
 */
export function createObservabilityRouter(
  options: ObservabilityRouterOptions,
): Router {
  const router = Router();
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
  const auth = requireServiceKey(serviceKey);

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "observability", sdk: "@ijnut/sdk" });
  });

  router.use(auth);

  router.get("/overview", (_req, res) => {
    res.json(store.getOverview("p95ms"));
  });

  router.delete("/history", (_req, res) => {
    store.clear();
    res.json({ ok: true, clearedAt: new Date().toISOString() });
  });

  router.get("/requests", (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const status = req.query.status ? Number(req.query.status) : undefined;
    const path =
      typeof req.query.path === "string" ? req.query.path : undefined;
    res.json({
      requests: store.getRecentRequests({ limit, status, path }),
    });
  });

  router.get("/routes/:key", (req, res) => {
    const decoded = decodeURIComponent(req.params.key);
    const route = store.getRoute(decoded);
    res.json({ route: route ?? null });
  });

  router.get("/stress", (_req, res) => {
    res.json({ reports: store.listStressReports() });
  });

  router.get("/stress/:id", (req, res) => {
    const report = store.getStressReport(req.params.id);
    if (!report) {
      res.status(404).json({
        statusCode: 404,
        message: `Unknown stress id: ${req.params.id}`,
      });
      return;
    }
    res.json(report);
  });

  router.post(
    "/stress",
    asyncHandler(async (req, res) => {
      const { allowed, retryAfterSec } = limiter.tryConsume("stress");
      if (!allowed) {
        res.status(429).json({
          statusCode: 429,
          error: "Too Many Requests",
          message: `Stress rate limit exceeded. Retry after ${retryAfterSec}s`,
          retryAfterSec,
        });
        return;
      }

      const body = (req.body ?? {}) as StressRequestBody;
      if (!body?.target || !body?.path) {
        res.status(400).json({
          statusCode: 400,
          message: "target and path are required",
        });
        return;
      }

      const allowlist = parseAllowlist(stressAllowlist, demoPublicUrl);

      try {
        const { report } = await runStress(body, store, {
          allowlist,
          maxConnections,
          maxDurationSec,
          maxAmount,
        });
        res.json(report);
      } catch (err) {
        res.status(400).json({
          statusCode: 400,
          message: err instanceof Error ? err.message : "Stress run failed",
        });
      }
    }),
  );

  return router;
}
