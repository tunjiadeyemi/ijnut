/**
 * Build a stable route key for cardinality-safe aggregates.
 * Prefer framework route patterns (`/:code`) over raw paths (`/aB3x`).
 */
export declare function routeKey(method: string, routeOrPath: string): string;
//# sourceMappingURL=route-key.d.ts.map