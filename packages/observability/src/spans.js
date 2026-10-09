"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = void 0;
exports.runWithRequestContext = runWithRequestContext;
exports.getRequestSpans = getRequestSpans;
exports.addSpan = addSpan;
exports.withSpan = withSpan;
const node_async_hooks_1 = require("node:async_hooks");
exports.requestContext = new node_async_hooks_1.AsyncLocalStorage();
function runWithRequestContext(fn) {
    return exports.requestContext.run({ spans: [] }, fn);
}
function getRequestSpans() {
    return exports.requestContext.getStore()?.spans ?? [];
}
function addSpan(span) {
    const store = exports.requestContext.getStore();
    if (!store)
        return;
    store.spans.push({
        ...span,
        durationMs: Math.round(span.durationMs * 100) / 100,
    });
}
/** Time an async piece of work and attach it to the current request. */
async function withSpan(name, type, fn, meta) {
    const started = process.hrtime.bigint();
    try {
        return await fn();
    }
    finally {
        const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
        addSpan({ name, type, durationMs, meta });
    }
}
//# sourceMappingURL=spans.js.map