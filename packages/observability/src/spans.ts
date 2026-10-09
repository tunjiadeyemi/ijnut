import { AsyncLocalStorage } from "node:async_hooks";

export type SpanType = "db" | "cache" | "http" | "other";

export interface Span {
  name: string;
  durationMs: number;
  type: SpanType;
  /** Safe, redacted metadata (never put secrets here). */
  meta?: Record<string, string>;
}

type RequestCtx = { spans: Span[] };

export const requestContext = new AsyncLocalStorage<RequestCtx>();

export function runWithRequestContext<T>(fn: () => T): T {
  return requestContext.run({ spans: [] }, fn);
}

export function getRequestSpans(): Span[] {
  return requestContext.getStore()?.spans ?? [];
}

export function addSpan(span: Span): void {
  const store = requestContext.getStore();
  if (!store) return;
  store.spans.push({
    ...span,
    durationMs: Math.round(span.durationMs * 100) / 100,
  });
}

/** Time an async piece of work and attach it to the current request. */
export async function withSpan<T>(
  name: string,
  type: SpanType,
  fn: () => Promise<T>,
  meta?: Record<string, string>,
): Promise<T> {
  const started = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    addSpan({ name, type, durationMs, meta });
  }
}
