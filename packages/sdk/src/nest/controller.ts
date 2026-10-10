import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  MetricsStore,
  FixedWindowRateLimiter,
  parseAllowlist,
  runStress,
  type StressRequestBody,
} from "@api-obs/observability";
import type { CreateIjnutOptions } from "../create";
import { IjnutServiceKeyGuard } from "./service-key.guard";
import { IJNUT_OPTIONS, IJNUT_STORE } from "./tokens";

@Controller("observability")
export class IjnutController {
  private readonly limiter: FixedWindowRateLimiter;

  constructor(
    @Inject(IJNUT_STORE) private readonly store: MetricsStore,
    @Inject(IJNUT_OPTIONS) private readonly options: CreateIjnutOptions,
  ) {
    const perMin = Number(
      this.options.stressRateLimitPerMin ??
        process.env.STRESS_RATE_LIMIT_PER_MIN ??
        10,
    );
    this.limiter = new FixedWindowRateLimiter(perMin, 60_000);
  }

  @Get("health")
  health() {
    return { ok: true, service: "observability", sdk: "@ijnut/sdk", runtime: "nest" };
  }

  @Get("overview")
  @UseGuards(IjnutServiceKeyGuard)
  overview() {
    return this.store.getOverview("p95ms");
  }

  @Delete("history")
  @UseGuards(IjnutServiceKeyGuard)
  clearHistory() {
    this.store.clear();
    return { ok: true, clearedAt: new Date().toISOString() };
  }

  @Get("requests")
  @UseGuards(IjnutServiceKeyGuard)
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
  @UseGuards(IjnutServiceKeyGuard)
  routeDetail(@Param("key") key: string) {
    const decoded = decodeURIComponent(key);
    return { route: this.store.getRoute(decoded) ?? null };
  }

  @Get("stress")
  @UseGuards(IjnutServiceKeyGuard)
  listStress() {
    return { reports: this.store.listStressReports() };
  }

  @Get("stress/:id")
  @UseGuards(IjnutServiceKeyGuard)
  getStress(@Param("id") id: string) {
    const report = this.store.getStressReport(id);
    if (!report) throw new NotFoundException(`Unknown stress id: ${id}`);
    return report;
  }

  @Post("stress")
  @UseGuards(IjnutServiceKeyGuard)
  async runStress(@Body() body: StressRequestBody) {
    const { allowed, retryAfterSec } = this.limiter.tryConsume("stress");
    if (!allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too Many Requests",
          message: `Stress rate limit exceeded. Retry after ${retryAfterSec}s`,
          retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!body?.target || !body?.path) {
      throw new BadRequestException("target and path are required");
    }

    const allowlist = parseAllowlist(
      this.options.stressAllowlist ?? process.env.STRESS_ALLOWLIST,
      this.options.demoPublicUrl ?? process.env.DEMO_PUBLIC_URL,
    );

    try {
      const { report } = await runStress(body, this.store, {
        allowlist,
        maxConnections: Number(
          this.options.maxConnections ??
            process.env.STRESS_MAX_CONNECTIONS ??
            100,
        ),
        maxDurationSec: Number(
          this.options.maxDurationSec ??
            process.env.STRESS_MAX_DURATION_SEC ??
            60,
        ),
        maxAmount: Number(
          this.options.maxAmount ?? process.env.STRESS_MAX_AMOUNT ?? 50_000,
        ),
      });
      return report;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : "Stress run failed",
      );
    }
  }
}
