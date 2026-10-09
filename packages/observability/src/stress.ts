import autocannon = require("autocannon");
import { randomUUID } from "node:crypto";
import type { MetricsStore } from "./store";
import type { StressReport, StressRequestBody } from "./types";
import { assertTargetAllowed } from "./stress-allowlist";

export interface StressRunnerOptions {
  allowlist: Set<string>;
  maxConnections: number;
  maxDurationSec: number;
  maxAmount: number;
}

export interface RunStressResult {
  report: StressReport;
}

function joinUrl(base: URL, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return new URL(p, base).toString();
}

/**
 * Embedded autocannon runner. Fine for portfolio; isolate in prod
 * so load generation doesn't contend with the API process CPU.
 */
export async function runStress(
  body: StressRequestBody,
  store: MetricsStore,
  options: StressRunnerOptions,
): Promise<RunStressResult> {
  const base = assertTargetAllowed(body.target, options.allowlist);
  const method = (body.method ?? "GET").toUpperCase();
  const url = joinUrl(base, body.path);

  const connections = Math.min(
    Math.max(body.connections ?? 10, 1),
    options.maxConnections,
  );

  const durationSec = body.durationSec ?? null;
  const amount = body.amount ?? null;

  if (durationSec == null && amount == null) {
    throw new Error("Provide durationSec or amount");
  }

  if (durationSec != null && durationSec > options.maxDurationSec) {
    throw new Error(`durationSec capped at ${options.maxDurationSec}`);
  }
  if (amount != null && amount > options.maxAmount) {
    throw new Error(`amount capped at ${options.maxAmount}`);
  }

  const startedAt = new Date().toISOString();
  const id = `stress_${randomUUID().slice(0, 8)}`;

  const headers: Record<string, string> = { ...(body.headers ?? {}) };
  const payload =
    typeof body.body === "string" && body.body.trim().length > 0
      ? body.body
      : undefined;

  if (
    payload &&
    !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")
  ) {
    headers["content-type"] = "application/json";
  }

  const result = await new Promise<autocannon.Result>((resolve, reject) => {
    const instance = autocannon(
      {
        url,
        method: method as autocannon.Options["method"],
        headers,
        body: payload,
        connections,
        duration: durationSec ?? undefined,
        amount: amount ?? undefined,
        timeout: 10,
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      },
    );
    // Ensure the promise settles if autocannon emits errors
    instance.on("error", reject);
  });

  const finishedAt = new Date().toISOString();

  const statusCodes: Record<string, number> = {};
  for (const [code, count] of Object.entries(result.statusCodeStats ?? {})) {
    const n =
      typeof count === "number"
        ? count
        : ((count as { count?: number }).count ?? 0);
    statusCodes[code] = n;
  }

  // Don't treat 3xx (e.g. shortener 302) as errors — only transport failures + 4xx/5xx
  let httpErrors = 0;
  for (const [code, n] of Object.entries(statusCodes)) {
    const c = Number(code);
    if (c >= 400) httpErrors += n;
  }
  const errors = (result.errors ?? 0) + (result.timeouts ?? 0) + httpErrors;

  // Infer route key from method + path pattern hint (caller path as-is)
  const routeKeyGuess = `${method} ${body.path.includes(":") ? body.path : body.path}`;
  // Prefer normalized shortener pattern when path looks like a code
  const snapshotKey =
    method === "GET" && /^\/[A-Za-z0-9_-]{4,16}$/.test(body.path)
      ? "GET /:code"
      : routeKeyGuess;

  // @types/autocannon Histogram omits p95; runtime autocannon includes it
  const latency = result.latency as autocannon.Result["latency"] & {
    p95?: number;
  };

  const report: StressReport = {
    id,
    requestsPerSec: result.requests?.average ?? 0,
    p50ms: latency?.p50 ?? 0,
    p95ms: latency?.p95 ?? latency?.p90 ?? 0,
    p99ms: latency?.p99 ?? 0,
    errors,
    statusCodes:
      Object.keys(statusCodes).length > 0
        ? statusCodes
        : summarizeStatusBands(result),
    startedAt,
    finishedAt,
    routeSnapshot: store.snapshotRoute(snapshotKey),
  };

  store.addStressReport(report);
  return { report };
}

function summarizeStatusBands(result: autocannon.Result): Record<string, number> {
  const out: Record<string, number> = {};
  const bands = ["1xx", "2xx", "3xx", "4xx", "5xx"] as const;
  for (const b of bands) {
    const n = result[b];
    if (typeof n === "number" && n > 0) out[b] = n;
  }
  return out;
}
