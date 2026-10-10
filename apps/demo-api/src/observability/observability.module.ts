import { Module } from "@nestjs/common";
import { MetricsStore } from "@api-obs/observability";
import { METRICS_STORE } from "./metrics.token";
import { ObservabilityController } from "./observability.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { CloudAiGatewayGuard } from "./cloud-ai-gateway.guard";
import { AiService } from "./ai.service";
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
    CloudAiGatewayGuard,
    StressRateLimitGuard,
    AiService,
  ],
  exports: [METRICS_STORE, CloudAiGatewayGuard],
})
export class ObservabilityModule {}
