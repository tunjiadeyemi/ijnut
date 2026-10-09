import { Module } from "@nestjs/common";
import { ShortenerController } from "./shortener.controller";
import { ShortenerService } from "./shortener.service";
import { PublicRateLimitGuard } from "./public-rate-limit.guard";

@Module({
  controllers: [ShortenerController],
  providers: [ShortenerService, PublicRateLimitGuard],
  exports: [ShortenerService],
})
export class ShortenerModule {}
