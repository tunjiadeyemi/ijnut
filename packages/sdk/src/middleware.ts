import type { NextFunction, Request, Response } from "express";
import {
  MetricsStore,
  REQUEST_ID_HEADER,
  resolveRequestId,
  routeKey,
  runWithRequestContext,
  getRequestSpans,
} from "@api-obs/observability";
import { shouldIgnorePath } from "./ignore-path";

export type MetricsMiddlewareOptions = {
  store: MetricsStore;
  /**
   * Skip recording for paths that match (e.g. `/observability`).
   * Default: none (record everything, including observability traffic).
   */
  ignorePathPrefix?: string | string[];
};

/**
 * Express middleware: request id + timing into MetricsStore on `res.finish`.
 */
export function createMetricsMiddleware(
  options: MetricsMiddlewareOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const { store, ignorePathPrefix } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    runWithRequestContext(() => {
      const spanBucket = { spans: getRequestSpans() };
      const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, requestId);
      (req as Request & { requestId?: string }).requestId = requestId;

      const started = process.hrtime.bigint();

      res.on("finish", () => {
        const path = req.path || req.url?.split("?")[0] || "/";
        if (shouldIgnorePath(path, ignorePathPrefix)) return;

        const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
        const method = req.method;

        const routePath = req.route?.path as string | undefined;
        const pattern =
          typeof routePath === "string" && routePath.length > 0
            ? routePath.startsWith("/")
              ? routePath
              : `/${routePath}`
            : path;

        store.record({
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
  };
}
