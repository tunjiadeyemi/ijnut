import { createServerFn } from '@tanstack/react-start';

import { obsFetch } from '@/shared/api/client.server';
import type { StressInput, StressReport } from '@/shared/api/types';
export type { StressInput, StressReport } from '@/shared/api/types';

export const fetchStressReports = createServerFn({ method: 'GET' }).handler(async () =>
  obsFetch<{ reports: StressReport[] }>('/observability/stress')
);

export const runStressTest = createServerFn({ method: 'POST' })
  .validator((data: StressInput) => data)
  .handler(async ({ data }) => {
    if (
      !Number.isInteger(data.connections) ||
      data.connections < 1 ||
      !Number.isFinite(data.durationSec) ||
      data.durationSec < 1
    ) {
      return {
        error: true as const,
        status: 400,
        message: 'Enter at least 1 parallel user and 1 second.'
      };
    }

    try {
      return await obsFetch<StressReport>('/observability/stress', {
        method: 'POST',
        body: JSON.stringify({
          target: data.target,
          method: data.method,
          path: data.path,
          connections: data.connections,
          durationSec: data.durationSec,
          headers: data.headers,
          body: data.body
        })
      });
    } catch (err) {
      const e = err as Error & { status?: number; body?: unknown };
      return {
        error: true as const,
        status: e.status ?? 500,
        message: e.message
      };
    }
  });
