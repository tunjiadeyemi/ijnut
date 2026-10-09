import { createFileRoute } from '@tanstack/react-router';

import { getAuthState } from '@/features/auth/functions';
import { getDashboardConfig } from '@/features/config/functions';
import { fetchStressReports } from '@/features/stress/functions';
import { fetchOverview, fetchRequests } from '@/features/overview/functions';

import { DashboardPage } from '@/features/dashboard/DashboardPage';

export const Route = createFileRoute('/')({
  component: DashboardRoute,
  loader: async () => {
    const [overview, requests, stress, config, auth] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports(),
      getDashboardConfig(),
      getAuthState()
    ]);
    return { overview, requests, stress, config, auth };
  }
});

function DashboardRoute() {
  const initial = Route.useLoaderData();
  return <DashboardPage initial={initial} />;
}
