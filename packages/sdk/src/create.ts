import { Router, type RequestHandler } from "express";
import { MetricsStore } from "@api-obs/observability";
import { createMetricsMiddleware } from "./middleware";
import { createObservabilityRouter } from "./router";
import { resolveServiceKey } from "./service-key";

export type CreateIjnutOptions = {
  /** Observability service key. Defaults to OBSERVABILITY_SERVICE_KEY / ADMIN_TOKEN. */
  serviceKey?: string;
  /** Shared metrics store. Defaults to a new in-memory store. */
  store?: MetricsStore;
  /** Comma-separated hosts or env STRESS_ALLOWLIST. */
  stressAllowlist?: string;
  demoPublicUrl?: string;
  maxConnections?: number;
  maxDurationSec?: number;
  maxAmount?: number;
  stressRateLimitPerMin?: number;
  /** Path prefixes skipped by the metrics middleware (optional). */
  ignorePathPrefix?: string | string[];
};

export type IjnutInstance = {
  store: MetricsStore;
  serviceKey: string | undefined;
  /** Record inbound request metrics. Mount early: `app.use(ijnut.middleware())`. */
  middleware: () => RequestHandler;
  /** HTTP API. Mount at `/observability`: `app.use('/observability', ijnut.router())`. */
  router: () => ReturnType<typeof createObservabilityRouter>;
  /**
   * Convenience router: metrics middleware + `/observability/*` routes.
   * `app.use(ijnut.mount())`
   */
  mount: () => ReturnType<typeof Router>;
}

/**
 * Create an IJNUT observability instance for an Express (or Express-compatible) app.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createIjnut } from '@ijnut/sdk';
 *
 * const app = express();
 * const ijnut = createIjnut({
 *   serviceKey: process.env.OBSERVABILITY_SERVICE_KEY,
 *   stressAllowlist: '127.0.0.1,localhost,elioe.tech',
 * });
 *
 * app.use(ijnut.middleware());
 * app.use(express.json());
 * app.use('/observability', ijnut.router());
 * ```
 */
export function createIjnut(options: CreateIjnutOptions = {}): IjnutInstance {
  const store =
    options.store ??
    new MetricsStore({
      maxRequests: Number(process.env.METRICS_MAX_REQUESTS ?? 1000),
    });
  const serviceKey = resolveServiceKey(options.serviceKey);

  const middleware = () =>
    createMetricsMiddleware({
      store,
      ignorePathPrefix: options.ignorePathPrefix,
    });

  const router = () =>
    createObservabilityRouter({
      store,
      serviceKey,
      stressAllowlist: options.stressAllowlist,
      demoPublicUrl: options.demoPublicUrl,
      maxConnections: options.maxConnections,
      maxDurationSec: options.maxDurationSec,
      maxAmount: options.maxAmount,
      stressRateLimitPerMin: options.stressRateLimitPerMin,
    });

  const mount = () => {
    const root = Router();
    root.use(middleware());
    root.use("/observability", router());
    return root;
  };

  return {
    store,
    serviceKey,
    middleware,
    router,
    mount,
  };
}
