import type { MetricsStoreOptions, OverviewResponse, RequestRecord, RouteAggregate, StressReport } from "./types";
/**
 * In-memory metrics: ring buffer of recent requests + per-route aggregates.
 * Sync and cheap — safe on the request path for an MVP portfolio tool.
 */
export declare class MetricsStore {
    private readonly maxRequests;
    private readonly maxSamplesPerRoute;
    private readonly buffer;
    private writeIndex;
    private size;
    private readonly routes;
    private readonly stressReports;
    private readonly maxStressReports;
    constructor(options?: MetricsStoreOptions);
    record(entry: RequestRecord): void;
    getOverview(sortBy?: "p95ms" | "errorRate"): OverviewResponse;
    getRoute(key: string): RouteAggregate | undefined;
    getRecentRequests(filters?: {
        limit?: number;
        status?: number;
        path?: string;
    }): RequestRecord[];
    addStressReport(report: StressReport): void;
    listStressReports(): StressReport[];
    getStressReport(id: string): StressReport | undefined;
    /** Snapshot helper for stress reports. */
    snapshotRoute(key: string): {
        key: string;
        count: number;
        p95ms: number;
        errors: number;
    } | undefined;
    /** Wipe route stats, recent requests, and past load-test reports. */
    clear(): void;
}
/** Process-wide default store (Nest provider can inject its own). */
export declare const defaultStore: MetricsStore;
//# sourceMappingURL=store.d.ts.map