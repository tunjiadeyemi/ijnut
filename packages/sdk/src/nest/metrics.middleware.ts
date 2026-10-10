import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { MetricsStore } from "@api-obs/observability";
import type { CreateIjnutOptions } from "../create";
import { createMetricsMiddleware } from "../middleware";
import { IJNUT_OPTIONS, IJNUT_STORE } from "./tokens";

@Injectable()
export class IjnutMetricsMiddleware implements NestMiddleware {
  private readonly handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  constructor(
    @Inject(IJNUT_STORE) store: MetricsStore,
    @Inject(IJNUT_OPTIONS) options: CreateIjnutOptions,
  ) {
    this.handler = createMetricsMiddleware({
      store,
      ignorePathPrefix: options.ignorePathPrefix,
    });
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.handler(req, res, next);
  }
}
