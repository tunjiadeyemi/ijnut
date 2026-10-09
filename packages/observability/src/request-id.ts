import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/** Prefer inbound id; otherwise mint a UUID. */
export function resolveRequestId(incoming?: string | string[] | null): string {
  if (typeof incoming === "string" && incoming.trim()) {
    return incoming.trim();
  }
  if (Array.isArray(incoming) && incoming[0]?.trim()) {
    return incoming[0].trim();
  }
  return randomUUID();
}
