import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Redirect,
  UseGuards,
} from "@nestjs/common";
import { AdminAuthGuard } from "../observability/admin-auth.guard";
import { CloudAiGatewayGuard } from "../observability/cloud-ai-gateway.guard";
import {
  assertSafeBillingReturnTo,
  createCustomerPortalSession,
  createProCheckout,
  isBachsConfigured,
} from "./bachs.client";
import { applyUserBilling, getBillingIds } from "./billing.store";
import { resolveSessionUser } from "./session-user";

@Controller("observability/billing")
export class BillingController {
  /**
   * Public bounce for Bachs success/cancel when the dashboard is on localhost.
   * Bachs cannot redirect to loopback; it hits the public API, which 302s to `to`.
   */
  @Get("return")
  @Redirect()
  returnToLocal(@Query("to") to?: string) {
    if (!to?.trim()) {
      throw new BadRequestException("Missing to");
    }
    try {
      return { url: assertSafeBillingReturnTo(to), statusCode: 302 };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Invalid return URL",
      );
    }
  }

  @Get("status")
  @UseGuards(CloudAiGatewayGuard)
  status() {
    return { configured: isBachsConfigured() };
  }

  @Get("me")
  @UseGuards(CloudAiGatewayGuard)
  async me(@Headers("x-ijnut-session-token") sessionToken?: string) {
    const user = await resolveSessionUser(sessionToken);
    if (!user) {
      return { authenticated: false, customerId: null, subscriptionId: null };
    }
    const ids = await getBillingIds(user.id);
    return { authenticated: true, ...ids };
  }

  @Post("checkout")
  @UseGuards(CloudAiGatewayGuard)
  async checkout(
    @Headers("x-ijnut-session-token") sessionToken?: string,
    @Body() body?: { returnOrigin?: string },
  ) {
    if (!isBachsConfigured()) {
      return {
        ok: false as const,
        message: "Bachs is not configured on the API.",
      };
    }
    const user = await resolveSessionUser(sessionToken);
    if (!user) {
      return {
        ok: false as const,
        message: "Sign in before subscribing.",
        needsAuth: true as const,
      };
    }
    try {
      const url = await createProCheckout({
        userId: user.id,
        email: user.email,
        name: user.name ?? undefined,
        returnOrigin: body?.returnOrigin,
      });
      return { ok: true as const, url };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Could not start checkout",
      };
    }
  }

  @Post("portal")
  @UseGuards(CloudAiGatewayGuard)
  async portal(
    @Headers("x-ijnut-session-token") sessionToken?: string,
    @Body() body?: { returnOrigin?: string },
  ) {
    if (!isBachsConfigured()) {
      return {
        ok: false as const,
        message: "Bachs is not configured on the API.",
      };
    }
    const user = await resolveSessionUser(sessionToken);
    if (!user) {
      return {
        ok: false as const,
        message: "Sign in required.",
        needsAuth: true as const,
      };
    }
    const ids = await getBillingIds(user.id);
    if (!ids.customerId) {
      return {
        ok: false as const,
        message: "No Bachs customer yet — subscribe first.",
      };
    }
    try {
      const url = await createCustomerPortalSession(
        ids.customerId,
        body?.returnOrigin,
      );
      return { ok: true as const, url };
    } catch (err) {
      return {
        ok: false as const,
        message:
          err instanceof Error ? err.message : "Could not open billing portal",
      };
    }
  }

  /** Internal apply — also used if something still posts plan updates. */
  @Post("apply")
  @UseGuards(AdminAuthGuard)
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
