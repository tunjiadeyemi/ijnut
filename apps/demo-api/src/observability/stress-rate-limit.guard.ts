import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { FixedWindowRateLimiter } from "@api-obs/observability";

@Injectable()
export class StressRateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowRateLimiter;

  constructor() {
    const perMin = Number(process.env.STRESS_RATE_LIMIT_PER_MIN ?? 1);
    this.limiter = new FixedWindowRateLimiter(perMin, 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    // Single admin bucket for MVP (one shared token)
    const { allowed, retryAfterSec } = this.limiter.tryConsume("admin");
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
    return true;
  }
}
