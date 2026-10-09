import type { MetricsStore } from "./store";
import type { StressReport, StressRequestBody } from "./types";
export interface StressRunnerOptions {
    allowlist: Set<string>;
    maxConnections: number;
    maxDurationSec: number;
    maxAmount: number;
}
export interface RunStressResult {
    report: StressReport;
}
/**
 * Embedded autocannon runner. Fine for portfolio; isolate in prod
 * so load generation doesn't contend with the API process CPU.
 */
export declare function runStress(body: StressRequestBody, store: MetricsStore, options: StressRunnerOptions): Promise<RunStressResult>;
//# sourceMappingURL=stress.d.ts.map