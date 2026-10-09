import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { DemoController } from "./demo.controller";
import { ObservabilityModule } from "./observability/observability.module";
import { ObservabilityMiddleware } from "./observability/observability.middleware";
import { ShortenerModule } from "./shortener/shortener.module";

@Module({
  imports: [ObservabilityModule, ShortenerModule],
  controllers: [HealthController, DemoController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ObservabilityMiddleware).forRoutes("*");
  }
}
