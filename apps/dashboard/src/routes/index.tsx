import { createFileRoute, redirect } from '@tanstack/react-router';

import { getAuthState } from '@/features/auth/functions';
import { getDashboardConfig } from '@/features/config/functions';
import { fetchStressReports } from '@/features/stress/functions';
import { fetchOverview, fetchRequests } from '@/features/overview/functions';

import { DashboardPage } from '@/features/dashboard/DashboardPage';

export const Route = createFileRoute('/')({
  component: DashboardRoute,
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (!authenticated) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const [overview, requests, stress, config] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports(),
      getDashboardConfig()
    ]);
    return { overview, requests, stress, config };
  }
});

function DashboardRoute() {
  const initial = Route.useLoaderData();
  return <DashboardPage initial={initial} />;
}
