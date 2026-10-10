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
 * Build a cardinality-safe route pattern from the full path + Hono match.
 * Keeps mount prefixes (e.g. `/observability/overview`) so the dashboard
 * "Tools" filter can hide SDK traffic.
 */
function resolveRoutePattern(path: string, matchedRoutes: unknown): string {
  const matched = Array.isArray(matchedRoutes) ? matchedRoutes : [];
  let leaf: string | undefined;
  for (let i = matched.length - 1; i >= 0; i--) {
    const r = matched[i] as { path?: string };
    if (typeof r?.path === "string" && r.path.length > 0) {
      leaf = r.path.startsWith("/") ? r.path : `/${r.path}`;
      break;
    }
  }

  if (!leaf || !leaf.includes(":")) {
    return path || "/";
  }

  const leafParts = leaf.split("/").filter(Boolean);
  const pathParts = (path || "/").split("/").filter(Boolean);
  if (pathParts.length < leafParts.length) {
    return path || "/";
  }

  const prefixLen = pathParts.length - leafParts.length;
  const aligns = leafParts.every(
    (lp, i) => lp.startsWith(":") || lp === pathParts[prefixLen + i],
  );
  if (!aligns) {
    return path || "/";
  }

  return `/${[...pathParts.slice(0, prefixLen), ...leafParts].join("/")}`;
}

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
      const pattern = resolveRoutePattern(path, c.req.matchedRoutes);

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
