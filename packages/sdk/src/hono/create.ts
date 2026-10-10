import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono";
import { MetricsStore } from "@api-obs/observability";
import type { CreateIjnutOptions } from "../create";
import { resolveServiceKey } from "../service-key";
import { createHonoMetricsMiddleware } from "./middleware";
import { createHonoObservabilityApp } from "./app";

export type IjnutHonoInstance = {
  store: MetricsStore;
  serviceKey: string | undefined;
  /** `app.use('*', ijnut.middleware())` — mount early. */
  middleware: () => MiddlewareHandler;
  /** `app.route('/observability', ijnut.app())` */
  app: () => Hono;
};

/**
 * IJNUT for Hono (Node). Use this on elioe / any Hono API.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { createIjnutHono } from '@ijnut/sdk/hono';
 *
 * const app = new Hono();
 * const ijnut = createIjnutHono({
 *   serviceKey: process.env.OBSERVABILITY_SERVICE_KEY,
 *   stressAllowlist: 'elioe.tech,127.0.0.1,localhost',
 * });
 *
 * app.use('*', ijnut.middleware());
 * app.route('/observability', ijnut.app());
 * ```
 */
export function createIjnutHono(
  options: CreateIjnutOptions = {},
): IjnutHonoInstance {
  const store =
    options.store ??
    new MetricsStore({
      maxRequests: Number(process.env.METRICS_MAX_REQUESTS ?? 1000),
    });
  const serviceKey = resolveServiceKey(options.serviceKey);

  return {
    store,
    serviceKey,
    middleware: () =>
      createHonoMetricsMiddleware({
        store,
        ignorePathPrefix: options.ignorePathPrefix,
      }),
    app: () =>
      createHonoObservabilityApp({
        store,
        serviceKey,
        stressAllowlist: options.stressAllowlist,
        demoPublicUrl: options.demoPublicUrl,
        maxConnections: options.maxConnections,
        maxDurationSec: options.maxDurationSec,
        maxAmount: options.maxAmount,
        stressRateLimitPerMin: options.stressRateLimitPerMin,
      }),
  };
}
