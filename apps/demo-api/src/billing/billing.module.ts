import { Module } from "@nestjs/common";
import { AdminAuthGuard } from "../observability/admin-auth.guard";
import { CloudAiGatewayGuard } from "../observability/cloud-ai-gateway.guard";
import { BillingController } from "./billing.controller";

@Module({
  controllers: [BillingController],
  providers: [AdminAuthGuard, CloudAiGatewayGuard],
})
export class BillingModule {}
