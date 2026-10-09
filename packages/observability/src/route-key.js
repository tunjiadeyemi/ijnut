"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeKey = routeKey;
/**
 * Build a stable route key for cardinality-safe aggregates.
 * Prefer framework route patterns (`/:code`) over raw paths (`/aB3x`).
 */
function routeKey(method, routeOrPath) {
    const m = method.toUpperCase();
    const path = routeOrPath.startsWith("/") ? routeOrPath : `/${routeOrPath}`;
    return `${m} ${path}`;
}
//# sourceMappingURL=route-key.js.map