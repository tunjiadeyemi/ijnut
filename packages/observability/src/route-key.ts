/**
 * Build a stable route key for cardinality-safe aggregates.
 * Prefer framework route patterns (`/:code`) over raw paths (`/aB3x`).
 */
export function routeKey(method: string, routeOrPath: string): string {
  const m = method.toUpperCase();
  const path = routeOrPath.startsWith("/") ? routeOrPath : `/${routeOrPath}`;
  return `${m} ${path}`;
}
