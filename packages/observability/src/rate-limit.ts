/**
 * Simple fixed-window rate limiter (in-memory).
 * Enough for portfolio MVP; swap for Redis token bucket later.
 */
export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if the request is allowed. */
  tryConsume(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    let entry = this.hits.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      entry = { count: 0, windowStart: now };
      this.hits.set(key, entry);
    }

    if (entry.count >= this.limit) {
      const retryAfterSec = Math.ceil(
        (entry.windowStart + this.windowMs - now) / 1000,
      );
      return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
    }

    entry.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  }
}
