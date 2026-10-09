import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { DemoController } from "./demo.controller";
import { ObservabilityModule } from "./observability/observability.module";
import { ObservabilityMiddleware } from "./observability/observability.middleware";
import { ShortenerModule } from "./shortener/shortener.module";
import { BillingModule } from "./billing/billing.module";

@Module({
  imports: [ObservabilityModule, ShortenerModule, BillingModule],
  controllers: [HealthController, DemoController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ObservabilityMiddleware).forRoutes("*");
  }
}
