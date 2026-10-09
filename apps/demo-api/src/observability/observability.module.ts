import { Module } from "@nestjs/common";
import { MetricsStore } from "@api-obs/observability";
import { METRICS_STORE } from "./metrics.token";
import { ObservabilityController } from "./observability.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { StressRateLimitGuard } from "./stress-rate-limit.guard";

@Module({
  controllers: [ObservabilityController],
  providers: [
    {
      provide: METRICS_STORE,
      useFactory: () =>
        new MetricsStore({
          maxRequests: Number(process.env.METRICS_MAX_REQUESTS ?? 1000),
        }),
    },
    AdminAuthGuard,
    StressRateLimitGuard,
  ],
  exports: [METRICS_STORE],
})
export class ObservabilityModule {}
