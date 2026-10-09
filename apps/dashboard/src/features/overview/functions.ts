import { createServerFn } from '@tanstack/react-start';

import { obsFetch } from '@/shared/api/client.server';
import type { OverviewResponse, RequestRecord } from '@/shared/api/types';
export type { OverviewResponse, RequestRecord, RouteAggregate } from '@/shared/api/types';

export const fetchOverview = createServerFn({ method: 'GET' }).handler(async () =>
  obsFetch<OverviewResponse>('/observability/overview')
);

export const fetchRequests = createServerFn({ method: 'GET' })
  .validator((data: { limit?: number; status?: number; path?: string }) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    params.set('limit', String(data.limit ?? 50));
    if (data.status != null) params.set('status', String(data.status));
    if (data.path) params.set('path', data.path);
    return obsFetch<{ requests: RequestRecord[] }>(`/observability/requests?${params}`);
  });

export const clearHistory = createServerFn({ method: 'POST' }).handler(async () =>
  obsFetch<{ ok: boolean; clearedAt: string }>('/observability/history', {
    method: 'DELETE'
  })
);
