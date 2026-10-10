import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { MetricsStore } from "@api-obs/observability";
import { createMetricsMiddleware } from "@ijnut/sdk";
import { METRICS_STORE } from "./metrics.token";

/**
 * Nest adapter around @ijnut/sdk metrics middleware.
 * Records on `res.finish` so guard 401/403/429 still land in the store.
 */
@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  private readonly handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  constructor(@Inject(METRICS_STORE) store: MetricsStore) {
    this.handler = createMetricsMiddleware({ store });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.handler(req, res, next);
  }
}
