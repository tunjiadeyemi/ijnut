import type { RequestRecord, RequestSpan } from '@/shared/api/types';

export type SlowSqlSample = {
  sql: string;
  op?: string;
  durationMs: number;
  name: string;
  route: string;
  path: string;
  requestId: string;
  rowCount?: string;
};

/** Flatten db spans that carry SQL text, slowest first. */
export function collectSqlSpans(
  requests: RequestRecord[],
  limit = 20
): SlowSqlSample[] {
  const out: SlowSqlSample[] = [];
  for (const r of requests) {
    for (const s of r.spans ?? []) {
      if (s.type !== 'db') continue;
      const sql = s.meta?.sql?.trim();
      if (!sql) continue;
      out.push({
        sql,
        op: s.meta?.op,
        durationMs: s.durationMs,
        name: s.name,
        route: r.route,
        path: r.path,
        requestId: r.requestId,
        rowCount: s.meta?.rowCount
      });
    }
  }
  return out.sort((a, b) => b.durationMs - a.durationMs).slice(0, limit);
}

/** Detect possible N+1: same SQL shape many times on one request. */
export function detectRepeatedSql(
  spans: RequestSpan[] | undefined,
  minRepeats = 4
): Array<{ sql: string; count: number; totalMs: number }> {
  if (!spans?.length) return [];
  const map = new Map<string, { count: number; totalMs: number }>();
  for (const s of spans) {
    if (s.type !== 'db') continue;
    const sql = s.meta?.sql?.trim();
    if (!sql) continue;
    const cur = map.get(sql) ?? { count: 0, totalMs: 0 };
    cur.count += 1;
    cur.totalMs += s.durationMs;
    map.set(sql, cur);
  }
  return [...map.entries()]
    .filter(([, v]) => v.count >= minRepeats)
    .map(([sql, v]) => ({ sql, count: v.count, totalMs: v.totalMs }))
    .sort((a, b) => b.count - a.count);
}
