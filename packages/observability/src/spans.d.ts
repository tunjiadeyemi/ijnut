import { AsyncLocalStorage } from "node:async_hooks";
export type SpanType = "db" | "cache" | "http" | "other";
export interface Span {
    name: string;
    durationMs: number;
    type: SpanType;
    /** Safe, redacted metadata (never put secrets here). */
    meta?: Record<string, string>;
}
type RequestCtx = {
    spans: Span[];
};
export declare const requestContext: AsyncLocalStorage<RequestCtx>;
export declare function runWithRequestContext<T>(fn: () => T): T;
export declare function getRequestSpans(): Span[];
export declare function addSpan(span: Span): void;
/** Time an async piece of work and attach it to the current request. */
export declare function withSpan<T>(name: string, type: SpanType, fn: () => Promise<T>, meta?: Record<string, string>): Promise<T>;
export {};
//# sourceMappingURL=spans.d.ts.map