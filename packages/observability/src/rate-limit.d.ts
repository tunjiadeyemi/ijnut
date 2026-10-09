/**
 * Simple fixed-window rate limiter (in-memory).
 * Enough for portfolio MVP; swap for Redis token bucket later.
 */
export declare class FixedWindowRateLimiter {
    private readonly limit;
    private readonly windowMs;
    private readonly hits;
    constructor(limit: number, windowMs: number);
    /** Returns true if the request is allowed. */
    tryConsume(key: string): {
        allowed: boolean;
        retryAfterSec: number;
    };
}
//# sourceMappingURL=rate-limit.d.ts.map