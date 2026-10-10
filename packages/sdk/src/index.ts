/**
 * @ijnut/sdk — drop-in API observability for Node.
 */

export { createIjnut } from "./create";
export type { CreateIjnutOptions, IjnutInstance } from "./create";

export { createMetricsMiddleware } from "./middleware";
export type { MetricsMiddlewareOptions } from "./middleware";

export { createObservabilityRouter } from "./router";
export type { ObservabilityRouterOptions } from "./router";

export {
  resolveServiceKey,
  extractServiceKey,
  requireServiceKey,
} from "./service-key";

// Re-export core primitives so apps only need @ijnut/sdk
export {
  MetricsStore,
  defaultStore,
  parseAllowlist,
  assertTargetAllowed,
  runStress,
  FixedWindowRateLimiter,
  routeKey,
  REQUEST_ID_HEADER,
  resolveRequestId,
  requestContext,
  runWithRequestContext,
  getRequestSpans,
  addSpan,
  withSpan,
  percentile,
  p50,
  p95,
  p99,
} from "@api-obs/observability";

export type {
  MetricsStoreOptions,
  OverviewResponse,
  RequestRecord,
  RouteAggregate,
  RouteSnapshot,
  StressReport,
  StressRequestBody,
  Span,
  SpanType,
  StressRunnerOptions,
  RunStressResult,
} from "@api-obs/observability";
