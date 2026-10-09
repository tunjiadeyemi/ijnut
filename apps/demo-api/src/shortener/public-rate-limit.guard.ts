import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { FixedWindowRateLimiter } from "@api-obs/observability";
import type { Request } from "express";

/**
 * Rate-limits public POST /shorten so 429 shows up in metrics.
 * Default: 10 creates / minute / IP (override with SHORTEN_RATE_LIMIT_PER_MIN).
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowRateLimiter;

  constructor() {
    const perMin = Number(process.env.SHORTEN_RATE_LIMIT_PER_MIN ?? 10);
    this.limiter = new FixedWindowRateLimiter(perMin, 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "local";

    const { allowed, retryAfterSec } = this.limiter.tryConsume(`shorten:${ip}`);
    if (!allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too Many Requests",
          message: `Shorten rate limit exceeded. Retry after ${retryAfterSec}s`,
          retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
