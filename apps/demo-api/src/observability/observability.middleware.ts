import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import {
  MetricsStore,
  REQUEST_ID_HEADER,
  resolveRequestId,
  routeKey,
  runWithRequestContext,
  getRequestSpans,
} from "@api-obs/observability";
import { METRICS_STORE } from "./metrics.token";

/**
 * Request-id + timing. Records on `res.finish` so guard 401/403/429
 * still land in the metrics store. Spans collected via AsyncLocalStorage.
 */
@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  constructor(@Inject(METRICS_STORE) private readonly store: MetricsStore) {}

  use(req: Request, res: Response, next: NextFunction): void {
    runWithRequestContext(() => {
      // Hold a reference — finish may run outside ALS
      const spanBucket = { spans: getRequestSpans() };
      const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, requestId);
      (req as Request & { requestId?: string }).requestId = requestId;

      const started = process.hrtime.bigint();

      res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
        const method = req.method;
        const path = req.path || req.url?.split("?")[0] || "/";

        const routePath = req.route?.path as string | undefined;
        const pattern =
          typeof routePath === "string" && routePath.length > 0
            ? routePath.startsWith("/")
              ? routePath
              : `/${routePath}`
            : path;

        this.store.record({
          method,
          route: routeKey(method, pattern),
          path,
          statusCode: res.statusCode || 500,
          durationMs: Math.round(durationMs * 100) / 100,
          timestamp: new Date().toISOString(),
          requestId,
          userId: (req as Request & { userId?: string }).userId,
          apiKeyId: (req as Request & { apiKeyId?: string }).apiKeyId,
          spans: [...spanBucket.spans],
        });
      });

      next();
    });
  }
}
