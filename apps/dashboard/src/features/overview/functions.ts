import { createServerFn } from '@tanstack/react-start';

import { obsFetch } from '@/shared/api/client.server';
import type { OverviewResponse, RequestRecord } from '@/shared/api/types';
export type { OverviewResponse, RequestRecord, RouteAggregate } from '@/shared/api/types';

export const fetchOverview = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const body = await obsFetch<Partial<OverviewResponse>>('/observability/overview');
    return {
      routes: Array.isArray(body?.routes) ? body.routes : [],
      updatedAt: typeof body?.updatedAt === 'string' ? body.updatedAt : new Date().toISOString()
    } satisfies OverviewResponse;
  } catch {
    return { routes: [], updatedAt: new Date().toISOString() } satisfies OverviewResponse;
  }
});

export const fetchRequests = createServerFn({ method: 'GET' })
  .validator((data: { limit?: number; status?: number; path?: string }) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    params.set('limit', String(data.limit ?? 50));
    if (data.status != null) params.set('status', String(data.status));
    if (data.path) params.set('path', data.path);
    try {
      const body = await obsFetch<{ requests?: RequestRecord[] }>(
        `/observability/requests?${params}`
      );
      return { requests: Array.isArray(body?.requests) ? body.requests : [] };
    } catch {
      return { requests: [] as RequestRecord[] };
    }
  });

export const clearHistory = createServerFn({ method: 'POST' }).handler(async () =>
  obsFetch<{ ok: boolean; clearedAt: string }>('/observability/history', {
    method: 'DELETE'
  })
);
