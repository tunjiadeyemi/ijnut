import type { Span } from "./spans";
/** Single recorded request sample (ring buffer entry). */
export interface RequestRecord {
    method: string;
    /** Normalized route pattern when available, e.g. `GET /:code`. */
    route: string;
    /** Actual path, e.g. `/aB3x`. */
    path: string;
    statusCode: number;
    durationMs: number;
    timestamp: string;
    requestId: string;
    apiKeyId?: string;
    userId?: string;
    /** Timed sub-steps (db/cache/…) when instrumented. */
    spans?: Span[];
}
/** Aggregates for one `METHOD /pattern` key. */
export interface RouteAggregate {
    key: string;
    count: number;
    errors: number;
    errorRate: number;
    avgMs: number;
    p95ms: number;
}
export interface OverviewResponse {
    routes: RouteAggregate[];
    updatedAt: string;
}
export interface StressRequestBody {
    target: string;
    method?: string;
    path: string;
    headers?: Record<string, string>;
    /** Raw request body (e.g. JSON string). Used for POST/PUT/PATCH/DELETE. */
    body?: string;
    connections?: number;
    durationSec?: number | null;
    amount?: number | null;
}
export interface RouteSnapshot {
    key: string;
    count: number;
    p95ms: number;
    errors: number;
}
export interface StressReport {
    id: string;
    requestsPerSec: number;
    p50ms: number;
    p95ms: number;
    p99ms: number;
    errors: number;
    statusCodes: Record<string, number>;
    startedAt: string;
    finishedAt: string;
    routeSnapshot?: RouteSnapshot;
}
export interface MetricsStoreOptions {
    /** Ring buffer capacity. Default 1000. */
    maxRequests?: number;
    /** How many duration samples to keep per route for p95. Default 500. */
    maxSamplesPerRoute?: number;
}
//# sourceMappingURL=types.d.ts.map