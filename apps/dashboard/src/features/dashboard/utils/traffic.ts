import type {
  OverviewResponse,
  RequestRecord,
  RouteAggregate,
  StressReport,
} from "@/shared/api/types";

/** SDK / dashboard self-traffic (hidden unless Tools is checked). */
export function isToolTraffic(routeOrPath: string): boolean {
  return (
    routeOrPath.includes("/observability") ||
    // Older Hono SDK builds stripped the mount prefix from the route key
    /^(GET|POST|DELETE|PUT|PATCH) \/(overview|requests|stress|history)(\/|$)/.test(
      routeOrPath,
    )
  );
}

export function filterVisibleRoutes(
  routes: RouteAggregate[],
  showToolTraffic: boolean,
): RouteAggregate[] {
  if (showToolTraffic) return routes;
  return routes.filter((r) => !isToolTraffic(r.key));
}

export function filterVisibleRequests(
  requests: RequestRecord[],
  showToolTraffic: boolean,
): RequestRecord[] {
  if (showToolTraffic) return requests;
  return requests.filter(
    (r) => !isToolTraffic(r.route) && !isToolTraffic(r.path),
  );
}

export function computeKpis(routes: RouteAggregate[]) {
  const total = routes.reduce((s, r) => s + r.count, 0);
  const errors = routes.reduce((s, r) => s + r.errors, 0);
  const worst = routes.reduce((m, r) => (r.p95ms > m ? r.p95ms : m), 0);
  return { total, errors, worst };
}

export function buildRouteCompare(
  beforeSnap: RouteAggregate[] | null,
  lastReport: StressReport | null,
  routes: OverviewResponse["routes"],
) {
  if (!beforeSnap || !lastReport?.routeSnapshot) return null;
  const key = lastReport.routeSnapshot.key;
  const before = beforeSnap.find((r) => r.key === key);
  const after = routes.find((r) => r.key === key);
  return { key, before, after, report: lastReport };
}
