"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUEST_ID_HEADER = void 0;
exports.resolveRequestId = resolveRequestId;
const node_crypto_1 = require("node:crypto");
exports.REQUEST_ID_HEADER = "x-request-id";
/** Prefer inbound id; otherwise mint a UUID. */
function resolveRequestId(incoming) {
    if (typeof incoming === "string" && incoming.trim()) {
        return incoming.trim();
    }
    if (Array.isArray(incoming) && incoming[0]?.trim()) {
        return incoming[0].trim();
    }
    return (0, node_crypto_1.randomUUID)();
}
//# sourceMappingURL=request-id.js.map