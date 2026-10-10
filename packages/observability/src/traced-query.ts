/**
 * Trace SQL (or SQL-like) queries onto the current request via spans.
 * Prefer this over hand-rolled withSpan for every query.
 *
 * Never put secrets or raw user PII into span meta — only the statement shape
 * (with $1 placeholders) and safe aggregates (rowCount).
 */
import { addSpan } from "./spans";

export type TracedQueryOptions = {
  /** Span name. Default: db.<op> from the SQL verb. */
  name?: string;
  /** Extra safe metadata (merged with sql / op / rowCount). */
  meta?: Record<string, string>;
};

type QueryResultLike = {
  rowCount?: number | null;
  rows?: unknown[];
};

/** Collapse whitespace; keep $n placeholders as-is. */
export function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

export function inferSqlOp(sql: string): string {
  const m = normalizeSql(sql).match(
    /^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|TRUNCATE|BEGIN|COMMIT|ROLLBACK)\b/i,
  );
  return (m?.[1] ?? "QUERY").toUpperCase();
}

/**
 * Run `db.query(sql, params)` and record a `db` span with normalized SQL + rowCount.
 * Works with `pg` Pool/Client and anything with a matching `query` signature.
 */
export async function tracedQuery<R = unknown>(
  db: { query: (text: string, values?: unknown[]) => Promise<R> },
  sql: string,
  params?: unknown[],
  options?: TracedQueryOptions,
): Promise<R> {
  const normalized = normalizeSql(sql);
  const op = inferSqlOp(normalized);
  const name = options?.name?.trim() || `db.${op.toLowerCase()}`;
  const started = process.hrtime.bigint();

  try {
    const result = await db.query(sql, params);
    const like = result as QueryResultLike;
    const rowCount =
      typeof like.rowCount === "number"
        ? like.rowCount
        : Array.isArray(like.rows)
          ? like.rows.length
          : undefined;
    addSpan({
      name,
      type: "db",
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
      meta: {
        sql: normalized,
        op,
        ...(rowCount != null ? { rowCount: String(rowCount) } : {}),
        ...(options?.meta ?? {}),
      },
    });
    return result;
  } catch (err) {
    addSpan({
      name,
      type: "db",
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
      meta: {
        sql: normalized,
        op,
        error: "1",
        ...(options?.meta ?? {}),
      },
    });
    throw err;
  }
}
