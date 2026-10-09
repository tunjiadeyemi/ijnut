import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { AdminAuthGuard } from "./admin-auth.guard";
import { METRICS_STORE } from "./metrics.token";
import { StressRateLimitGuard } from "./stress-rate-limit.guard";

@Controller("observability")
export class ObservabilityController {
  constructor(@Inject(METRICS_STORE) private readonly store: MetricsStore) {}

  /** Public liveness for the observability surface. */
  @Get("health")
  health() {
    return { ok: true, service: "observability" };
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

    try {
      const { report } = await runStress(body, this.store, {
        allowlist,
        maxConnections: Number(process.env.STRESS_MAX_CONNECTIONS ?? 100),
        maxDurationSec: Number(process.env.STRESS_MAX_DURATION_SEC ?? 60),
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
