import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { FixedWindowRateLimiter } from "@api-obs/observability";

/**
 * Rate limit expensive AI endpoints (chat + new conversation).
 * Buckets by session token when present, else client IP.
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowRateLimiter;

  constructor() {
    const perMin = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 30);
    this.limiter = new FixedWindowRateLimiter(
      Number.isFinite(perMin) && perMin > 0 ? Math.floor(perMin) : 30,
      60_000,
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const session = req.header("x-ijnut-session-token")?.trim();
    const ip =
      (typeof req.ip === "string" && req.ip) ||
      req.socket?.remoteAddress ||
      "unknown";
    const bucket = session ? `sess:${session.slice(0, 48)}` : `ip:${ip}`;

    const { allowed, retryAfterSec } = this.limiter.tryConsume(bucket);
    if (!allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too Many Requests",
          message: `AI rate limit exceeded. Retry after ${retryAfterSec}s`,
          retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
