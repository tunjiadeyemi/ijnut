import { createFileRoute } from '@tanstack/react-router';

import { getAuthState } from '@/features/auth/functions';
import { getBillingStatus } from '@/features/billing/functions';
import { getDashboardConfig } from '@/features/config/functions';
import { fetchStressReports } from '@/features/stress/functions';
import { fetchOverview, fetchRequests } from '@/features/overview/functions';

import { DashboardPage } from '@/features/dashboard/DashboardPage';

type HomeSearch = { checkout?: 'success' | 'cancel' };

export const Route = createFileRoute('/')({
  component: DashboardRoute,
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    checkout:
      search.checkout === 'success' || search.checkout === 'cancel'
        ? search.checkout
        : undefined
  }),
  loader: async () => {
    const [overview, requests, stress, config, auth, billing] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports(),
      getDashboardConfig(),
      getAuthState(),
      getBillingStatus()
    ]);
    return { overview, requests, stress, config, auth, billing };
  }
});

function DashboardRoute() {
  const initial = Route.useLoaderData();
  const { checkout } = Route.useSearch();
  return <DashboardPage initial={initial} checkout={checkout} />;
}
