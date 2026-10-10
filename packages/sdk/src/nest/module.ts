import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  type Provider,
} from "@nestjs/common";
import { MetricsStore } from "@api-obs/observability";
import type { CreateIjnutOptions } from "../create";
import { IjnutController } from "./controller";
import { IjnutMetricsMiddleware } from "./metrics.middleware";
import { IjnutServiceKeyGuard } from "./service-key.guard";
import { IJNUT_OPTIONS, IJNUT_STORE } from "./tokens";

export type IjnutModuleAsyncOptions = {
  imports?: DynamicModule["imports"];
  inject?: unknown[];
  useFactory: (
    ...args: unknown[]
  ) => CreateIjnutOptions | Promise<CreateIjnutOptions>;
};

@Module({})
export class IjnutModule implements NestModule {
  static forRoot(options: CreateIjnutOptions = {}): DynamicModule {
    return {
      module: IjnutModule,
      providers: [
        { provide: IJNUT_OPTIONS, useValue: options },
        {
          provide: IJNUT_STORE,
          useFactory: (opts: CreateIjnutOptions) =>
            opts.store ??
            new MetricsStore({
              maxRequests: Number(process.env.METRICS_MAX_REQUESTS ?? 1000),
            }),
          inject: [IJNUT_OPTIONS],
        },
        IjnutServiceKeyGuard,
        IjnutMetricsMiddleware,
      ],
      controllers: [IjnutController],
      exports: [IJNUT_STORE, IJNUT_OPTIONS],
    };
  }

  static forRootAsync(options: IjnutModuleAsyncOptions): DynamicModule {
    const asyncProviders: Provider[] = [
      {
        provide: IJNUT_OPTIONS,
        useFactory: options.useFactory,
        inject: (options.inject ?? []) as never[],
      },
      {
        provide: IJNUT_STORE,
        useFactory: (opts: CreateIjnutOptions) =>
          opts.store ??
          new MetricsStore({
            maxRequests: Number(process.env.METRICS_MAX_REQUESTS ?? 1000),
          }),
        inject: [IJNUT_OPTIONS],
      },
      IjnutServiceKeyGuard,
      IjnutMetricsMiddleware,
    ];

    return {
      module: IjnutModule,
      imports: options.imports ?? [],
      providers: asyncProviders,
      controllers: [IjnutController],
      exports: [IJNUT_STORE, IJNUT_OPTIONS],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IjnutMetricsMiddleware).forRoutes("*");
  }
}
