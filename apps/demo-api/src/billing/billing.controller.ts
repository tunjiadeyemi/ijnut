import { Body, Controller, Get, Headers, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../observability/admin-auth.guard";
import { resolveSessionUserId } from "../observability/ai-quota";
import { applyUserBilling, getBillingIds } from "./billing.store";

@Controller("observability/billing")
@UseGuards(AdminAuthGuard)
export class BillingController {
  @Get("me")
  async me(@Headers("x-ijnut-session-token") sessionToken?: string) {
    const userId = await resolveSessionUserId(sessionToken);
    if (!userId) {
      return { authenticated: false, customerId: null, subscriptionId: null };
    }
    const ids = await getBillingIds(userId);
    return { authenticated: true, ...ids };
  }

  /** Used by dashboard Bachs webhook — never from the browser. */
  @Post("apply")
  async apply(
    @Body()
    body: {
      userId?: string | null;
      customerId?: string | null;
      plan: "free" | "pro";
      nextCustomerId?: string | null;
      nextSubscriptionId?: string | null;
    },
  ) {
    await applyUserBilling(body);
    return { ok: true };
  }
}
