/**
 * Nearest-rank p95 over a list of duration samples (ms).
 * Empty list → 0. Single sample → that sample.
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0]!;

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[index]!;
}

export function p95(samples: number[]): number {
  return percentile(samples, 95);
}

export function p50(samples: number[]): number {
  return percentile(samples, 50);
}

export function p99(samples: number[]): number {
  return percentile(samples, 99);
}
