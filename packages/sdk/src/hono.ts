/**
 * Hono entry: `import { createIjnutHono } from '@ijnut/sdk/hono'`
 */
export { createIjnutHono } from "./hono/create";
export type { IjnutHonoInstance } from "./hono/create";

export { createHonoMetricsMiddleware } from "./hono/middleware";
export { createHonoObservabilityApp } from "./hono/app";

export type { CreateIjnutOptions } from "./create";
export type { MetricsMiddlewareOptions } from "./middleware";
export type { ObservabilityRouterOptions } from "./router";

export {
  MetricsStore,
  defaultStore,
  withSpan,
  addSpan,
  parseAllowlist,
  runStress,
} from "@api-obs/observability";
