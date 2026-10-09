"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixedWindowRateLimiter = void 0;
/**
 * Simple fixed-window rate limiter (in-memory).
 * Enough for portfolio MVP; swap for Redis token bucket later.
 */
class FixedWindowRateLimiter {
    limit;
    windowMs;
    hits = new Map();
    constructor(limit, windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }
    /** Returns true if the request is allowed. */
    tryConsume(key) {
        const now = Date.now();
        let entry = this.hits.get(key);
        if (!entry || now - entry.windowStart >= this.windowMs) {
            entry = { count: 0, windowStart: now };
            this.hits.set(key, entry);
        }
        if (entry.count >= this.limit) {
            const retryAfterSec = Math.ceil((entry.windowStart + this.windowMs - now) / 1000);
            return { allowed: false, retryAfterSec: Math.max(retryAfterSec, 1) };
        }
        entry.count += 1;
        return { allowed: true, retryAfterSec: 0 };
    }
}
exports.FixedWindowRateLimiter = FixedWindowRateLimiter;
//# sourceMappingURL=rate-limit.js.map