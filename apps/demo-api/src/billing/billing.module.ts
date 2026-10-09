import { Module } from "@nestjs/common";
import { AdminAuthGuard } from "../observability/admin-auth.guard";
import { BillingController } from "./billing.controller";

@Module({
  controllers: [BillingController],
  providers: [AdminAuthGuard],
})
export class BillingModule {}
