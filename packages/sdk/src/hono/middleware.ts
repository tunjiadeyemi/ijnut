import type { MiddlewareHandler } from "hono";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
  routeKey,
  runWithRequestContext,
  getRequestSpans,
} from "@api-obs/observability";
import { shouldIgnorePath } from "../ignore-path";
import type { MetricsMiddlewareOptions } from "../middleware";

/**
 * Hono middleware: request id + timing into MetricsStore after `next()`.
 */
export function createHonoMetricsMiddleware(
  options: MetricsMiddlewareOptions,
): MiddlewareHandler {
  const { store, ignorePathPrefix } = options;

  return async (c, next) =>
    runWithRequestContext(async () => {
      const spanBucket = { spans: getRequestSpans() };
      const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));
      c.header(REQUEST_ID_HEADER, requestId);

      const started = process.hrtime.bigint();
      await next();

      const path = c.req.path || "/";
      if (shouldIgnorePath(path, ignorePathPrefix)) return;

      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const method = c.req.method;

      const matched = c.req.matchedRoutes;
      const last = matched?.[matched.length - 1];
      const routePath =
        (last && "path" in last && typeof last.path === "string"
          ? last.path
          : undefined) || path;
      const pattern = routePath.startsWith("/") ? routePath : `/${routePath}`;

      store.record({
        method,
        route: routeKey(method, pattern),
        path,
        statusCode: c.res.status || 500,
        durationMs: Math.round(durationMs * 100) / 100,
        timestamp: new Date().toISOString(),
        requestId,
        spans: [...spanBucket.spans],
      });
    });
}

export type { MetricsMiddlewareOptions };
