/** Latency bands for UI emphasis (ms). */
export const LATENCY_OK_MS = 100;
export const LATENCY_WARN_MS = 300;

export type LatencyLevel = 'ok' | 'warn' | 'high' | 'none';

export function latencyLevel(ms: number | null | undefined): LatencyLevel {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'none';
  if (ms < LATENCY_OK_MS) return 'ok';
  if (ms < LATENCY_WARN_MS) return 'warn';
  return 'high';
}

/** Text color classes for timing values (light + dark). */
export function latencyTextClass(ms: number | null | undefined): string {
  switch (latencyLevel(ms)) {
    case 'ok':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'warn':
      return 'text-amber-700 dark:text-amber-400';
    case 'high':
      return 'text-red-700 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}
