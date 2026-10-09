"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.percentile = percentile;
exports.p95 = p95;
exports.p50 = p50;
exports.p99 = p99;
/**
 * Nearest-rank p95 over a list of duration samples (ms).
 * Empty list → 0. Single sample → that sample.
 */
function percentile(samples, p) {
    if (samples.length === 0)
        return 0;
    if (samples.length === 1)
        return samples[0];
    const sorted = [...samples].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length) - 1;
    const index = Math.min(Math.max(rank, 0), sorted.length - 1);
    return sorted[index];
}
function p95(samples) {
    return percentile(samples, 95);
}
function p50(samples) {
    return percentile(samples, 50);
}
function p99(samples) {
    return percentile(samples, 99);
}
//# sourceMappingURL=p95.js.map