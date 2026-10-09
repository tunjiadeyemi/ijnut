"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultStore = exports.MetricsStore = void 0;
const p95_1 = require("./p95");
/**
 * In-memory metrics: ring buffer of recent requests + per-route aggregates.
 * Sync and cheap — safe on the request path for an MVP portfolio tool.
 */
class MetricsStore {
    maxRequests;
    maxSamplesPerRoute;
    buffer;
    writeIndex = 0;
    size = 0;
    routes = new Map();
    stressReports = [];
    maxStressReports = 20;
    constructor(options = {}) {
        this.maxRequests = options.maxRequests ?? 1000;
        this.maxSamplesPerRoute = options.maxSamplesPerRoute ?? 500;
        this.buffer = new Array(this.maxRequests);
    }
    record(entry) {
        this.buffer[this.writeIndex] = entry;
        this.writeIndex = (this.writeIndex + 1) % this.maxRequests;
        if (this.size < this.maxRequests)
            this.size += 1;
        const key = entry.route || `${entry.method} ${entry.path}`;
        let bucket = this.routes.get(key);
        if (!bucket) {
            bucket = { count: 0, errors: 0, totalMs: 0, samples: [] };
            this.routes.set(key, bucket);
        }
        bucket.count += 1;
        bucket.totalMs += entry.durationMs;
        if (entry.statusCode >= 400)
            bucket.errors += 1;
        bucket.samples.push(entry.durationMs);
        if (bucket.samples.length > this.maxSamplesPerRoute) {
            bucket.samples.shift();
        }
    }
    getOverview(sortBy = "p95ms") {
        const routes = [];
        for (const [key, bucket] of this.routes) {
            const avgMs = bucket.count === 0 ? 0 : bucket.totalMs / bucket.count;
            const errorRate = bucket.count === 0 ? 0 : bucket.errors / bucket.count;
            routes.push({
                key,
                count: bucket.count,
                errors: bucket.errors,
                errorRate,
                avgMs: Math.round(avgMs * 100) / 100,
                p95ms: Math.round((0, p95_1.p95)(bucket.samples) * 100) / 100,
            });
        }
        routes.sort((a, b) => b[sortBy] - a[sortBy]);
        return {
            routes,
            updatedAt: new Date().toISOString(),
        };
    }
    getRoute(key) {
        return this.getOverview().routes.find((r) => r.key === key);
    }
    getRecentRequests(filters = {}) {
        const limit = filters.limit ?? 50;
        const out = [];
        // Newest first: walk backward from last write.
        for (let i = 0; i < this.size && out.length < limit; i++) {
            const idx = (this.writeIndex - 1 - i + this.maxRequests) % this.maxRequests;
            const rec = this.buffer[idx];
            if (!rec)
                continue;
            if (filters.status !== undefined && rec.statusCode !== filters.status) {
                continue;
            }
            if (filters.path && !rec.path.includes(filters.path))
                continue;
            out.push(rec);
        }
        return out;
    }
    addStressReport(report) {
        this.stressReports.unshift(report);
        if (this.stressReports.length > this.maxStressReports) {
            this.stressReports.length = this.maxStressReports;
        }
    }
    listStressReports() {
        return [...this.stressReports];
    }
    getStressReport(id) {
        return this.stressReports.find((r) => r.id === id);
    }
    /** Snapshot helper for stress reports. */
    snapshotRoute(key) {
        const agg = this.getRoute(key);
        if (!agg)
            return undefined;
        return {
            key: agg.key,
            count: agg.count,
            p95ms: agg.p95ms,
            errors: agg.errors,
        };
    }
    /** Wipe route stats, recent requests, and past load-test reports. */
    clear() {
        this.buffer.fill(undefined);
        this.writeIndex = 0;
        this.size = 0;
        this.routes.clear();
        this.stressReports.length = 0;
    }
}
exports.MetricsStore = MetricsStore;
/** Process-wide default store (Nest provider can inject its own). */
exports.defaultStore = new MetricsStore();
//# sourceMappingURL=store.js.map