import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  MetricsStore,
  parseAllowlist,
  runStress,
  type StressRequestBody,
} from "@api-obs/observability";
import { isGithubAuthConfigured } from "../auth/auth";
import { AdminAuthGuard } from "./admin-auth.guard";
import { CloudAiGatewayGuard } from "./cloud-ai-gateway.guard";
import { AiRateLimitGuard } from "./ai-rate-limit.guard";
import { AiService, type AiChatBody } from "./ai.service";
import { METRICS_STORE } from "./metrics.token";
import { StressRateLimitGuard } from "./stress-rate-limit.guard";

@Controller("observability")
export class ObservabilityController {
  constructor(
    @Inject(METRICS_STORE) private readonly store: MetricsStore,
    private readonly ai: AiService,
  ) {}

  /** Public liveness for the observability surface. */
  @Get("health")
  health() {
    return { ok: true, service: "observability" };
  }

  /** Auth feature flags for the dashboard BFF (no secrets). */
  @Get("auth/config")
  @UseGuards(CloudAiGatewayGuard)
  authConfig() {
    return { githubConfigured: isGithubAuthConfigured() };
  }

  @Get("overview")
  @UseGuards(AdminAuthGuard)
  overview() {
    return this.store.getOverview("p95ms");
  }

  /** Clear routes, recent requests, and load-test reports. */
  @Delete("history")
  @UseGuards(AdminAuthGuard)
  clearHistory() {
    this.store.clear();
    return { ok: true, clearedAt: new Date().toISOString() };
  }

  @Get("requests")
  @UseGuards(AdminAuthGuard)
  requests(
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("path") path?: string,
  ) {
    return {
      requests: this.store.getRecentRequests({
        limit: limit ? Number(limit) : 50,
        status: status ? Number(status) : undefined,
        path,
      }),
    };
  }

  @Get("routes/:key")
  @UseGuards(AdminAuthGuard)
  routeDetail(@Param("key") key: string) {
    const decoded = decodeURIComponent(key);
    const route = this.store.getRoute(decoded);
    if (!route) {
      return { route: null };
    }
    return { route };
  }

  @Get("stress")
  @UseGuards(AdminAuthGuard)
  listStress() {
    return { reports: this.store.listStressReports() };
  }

  @Get("stress/:id")
  @UseGuards(AdminAuthGuard)
  getStress(@Param("id") id: string) {
    const report = this.store.getStressReport(id);
    if (!report) throw new NotFoundException(`Unknown stress id: ${id}`);
    return report;
  }

  /**
   * AI status — cloud mode is login/quota gated; selfhost still uses the service key.
   * Session: X-Ijnut-Session-Token.
   */
  @Get("ai/status")
  @UseGuards(CloudAiGatewayGuard)
  async aiStatus(
    @Headers("x-ijnut-session-token") sessionToken?: string,
  ) {
    try {
      const access = await this.ai.resolveAccess(sessionToken);
      return this.ai.status(access);
    } catch (err) {
      console.error("[observability] ai/status failed", err);
      // Never 500 the dashboard — degrade to signed-out cloud gate.
      return this.ai.status({
        authenticated: false,
        needsAuth: true,
        plan: "free",
        aiUsed: 0,
        limit: Number(process.env.IJNUT_AI_FREE_LIMIT ?? 3) || 3,
        remaining: 0,
        gated: true,
        canConsume: false,
        userId: null,
      });
    }
  }

  /**
   * List Cloud AI conversations for the signed-in user + apiScope bucket.
   */
  @Get("ai/conversations")
  @UseGuards(CloudAiGatewayGuard)
  async aiConversations(
    @Headers("x-ijnut-session-token") sessionToken?: string,
    @Query("apiScope") apiScope?: string,
  ) {
    return this.ai.listConversations(sessionToken, apiScope);
  }

  /**
   * Start a new empty conversation in the given apiScope bucket.
   */
  @Post("ai/conversations")
  @UseGuards(CloudAiGatewayGuard, AiRateLimitGuard)
  async aiCreateConversation(
    @Headers("x-ijnut-session-token") sessionToken?: string,
    @Body() body?: { apiScope?: string },
  ) {
    return this.ai.createConversation(sessionToken, body?.apiScope);
  }

  /**
   * Persisted Cloud AI chat memory for one conversation (requires session).
   */
  @Get("ai/history")
  @UseGuards(CloudAiGatewayGuard)
  async aiHistory(
    @Headers("x-ijnut-session-token") sessionToken?: string,
    @Query("conversationId") conversationId?: string,
    @Query("apiScope") apiScope?: string,
  ) {
    return this.ai.history(sessionToken, conversationId, apiScope);
  }

  /**
   * AI chat — cloud: sign-in + quota + memory; selfhost: service key + BYO provider.
   * Metrics context may be supplied in the body (local API → Cloud AI sidecar).
   */
  @Post("ai")
  @UseGuards(CloudAiGatewayGuard, AiRateLimitGuard)
  async askAi(
    @Body() body: AiChatBody,
    @Headers("x-ijnut-session-token") sessionToken?: string,
  ) {
    try {
      return await this.ai.chat(
        this.store,
        body ?? { message: "" },
        sessionToken,
      );
    } catch (err) {
      console.error("[observability] ai chat failed", err);
      return {
        ok: false as const,
        gated: false as const,
        message: err instanceof Error ? err.message : "AI request failed",
      };
    }
  }

  @Post("stress")
  @UseGuards(AdminAuthGuard, StressRateLimitGuard)
  async runStress(@Body() body: StressRequestBody) {
    if (!body?.target || !body?.path) {
      throw new BadRequestException("target and path are required");
    }

    const allowlist = parseAllowlist(
      process.env.STRESS_ALLOWLIST,
      process.env.DEMO_PUBLIC_URL,
    );

    // Stress always runs on the caller's API — no Cloud plan caps.
    const maxConnections = Number(process.env.STRESS_MAX_CONNECTIONS ?? 100);
    const maxDurationSec = Number(process.env.STRESS_MAX_DURATION_SEC ?? 60);

    try {
      const { report } = await runStress(body, this.store, {
        allowlist,
        maxConnections,
        maxDurationSec,
        maxAmount: Number(process.env.STRESS_MAX_AMOUNT ?? 50_000),
      });
      return report;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Stress run failed",
      );
    }
  }
}
