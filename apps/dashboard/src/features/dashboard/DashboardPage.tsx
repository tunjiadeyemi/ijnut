import { useEffect, useMemo, useState, useTransition } from 'react';

import {
  buildRouteCompare,
  computeKpis,
  filterVisibleRequests,
  filterVisibleRoutes
} from './utils/traffic';
import {
  clearHistory,
  fetchOverview,
  fetchRequests,
  type OverviewResponse,
  type RequestRecord,
  type RouteAggregate
} from '@/features/overview/functions';
import { logout } from '@/features/auth/functions';
import { createPortal } from '@/features/billing/functions';
import type { StressInput } from '@/shared/api/types';
import { getDashboardConfig } from '@/features/config/functions';
import { fetchStressReports, runStressTest, type StressReport } from '@/features/stress/functions';

import { KpiStrip } from './components/KpiStrip';
import { RoutesPanel } from './components/RoutesPanel';
import { StressPanel } from './components/StressPanel';
import { useToast } from '@/shared/components/ui/toast';
import { RequestHistory } from './components/RequestHistory';
import { DashboardHeader } from './components/DashboardHeader';
import { AiChatPanel } from '@/features/ai/components/AiChatPanel';

export type DashboardLoaderData = {
  overview: OverviewResponse;
  requests: { requests: RequestRecord[] };
  stress: { reports: StressReport[] };
  config: Awaited<ReturnType<typeof getDashboardConfig>>;
  auth: Awaited<ReturnType<typeof import('@/features/auth/functions').getAuthState>>;
  billing: Awaited<ReturnType<typeof import('@/features/billing/functions').getBillingStatus>>;
};

export function DashboardPage({
  initial,
  checkout
}: {
  initial: DashboardLoaderData;
  checkout?: 'success' | 'cancel';
}) {
  const toast = useToast();
  const demoApiBase = initial.config.publicApiUrl;

  const [overview, setOverview] = useState<OverviewResponse>(initial.overview);
  const [requests, setRequests] = useState<RequestRecord[]>(initial.requests.requests);
  const [reports, setReports] = useState<StressReport[]>(initial.stress.reports);
  const [beforeSnap, setBeforeSnap] = useState<RouteAggregate[] | null>(null);
  const [lastReport, setLastReport] = useState<StressReport | null>(
    initial.stress.reports[0] ?? null
  );
  const [running, setRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showToolTraffic, setShowToolTraffic] = useState(false);
  const [stressGate, setStressGate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleRoutes = useMemo(
    () => filterVisibleRoutes(overview.routes, showToolTraffic),
    [overview.routes, showToolTraffic]
  );
  const visibleRequests = useMemo(
    () => filterVisibleRequests(requests, showToolTraffic),
    [requests, showToolTraffic]
  );
  const kpis = useMemo(() => computeKpis(visibleRoutes), [visibleRoutes]);
  const compare = useMemo(
    () => buildRouteCompare(beforeSnap, lastReport, overview.routes),
    [beforeSnap, lastReport, overview.routes]
  );

  async function refreshAll() {
    const [ov, req, st] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports()
    ]);
    setOverview(ov);
    setRequests(req.requests);
    setReports(st.reports);
    if (st.reports[0]) setLastReport(st.reports[0]);
  }

  useEffect(() => {
    if (!autoRefresh && !running) return;
    const id = setInterval(() => {
      startTransition(() => {
        void refreshAll().catch((e) =>
          toast.error(e instanceof Error ? e.message : 'Refresh failed', 'Could not update')
        );
      });
    }, 2500);
    return () => clearInterval(id);
  }, [autoRefresh, running, toast]);

  useEffect(() => {
    if (checkout === 'success') {
      toast.success('Subscription active — unlimited AI unlocked.', 'Welcome to Pro');
      window.history.replaceState({}, '', '/');
    } else if (checkout === 'cancel') {
      toast.error('Checkout canceled.', 'No charge');
      window.history.replaceState({}, '', '/');
    }
  }, [checkout, toast]);

  async function onRunStress(input: StressInput) {
    setRunning(true);
    try {
      const snap = await fetchOverview();
      setBeforeSnap(snap.routes);
      setOverview(snap);

      const result = await runStressTest({ data: input });

      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const failed = result as {
          error: true;
          status: number;
          message: string;
        };
        if (failed.status === 429) {
          setStressGate(
            'Stress rate limit hit on your local API. Wait a minute, or raise STRESS_RATE_LIMIT_PER_MIN.'
          );
          toast.error('Too many stress tests. Wait about a minute.', 'Slow down');
        } else {
          toast.error(failed.message, 'Load test failed');
        }
      } else {
        setStressGate(null);
        setLastReport(result as StressReport);
        toast.success('Load test finished.', 'Done');
      }
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stress failed', 'Load test failed');
    } finally {
      setRunning(false);
    }
  }

  async function onLogout() {
    await logout();
    window.location.assign('/');
  }

  async function onManageBilling() {
    const result = await createPortal();
    if (!result.ok) {
      toast.error(result.message, 'Billing');
      return;
    }
    window.location.assign(result.url);
  }

  async function onClearHistory() {
    const ok = window.confirm('Clear all recorded requests, route stats, and past load tests?');
    if (!ok) return;
    try {
      await clearHistory();
      setBeforeSnap(null);
      setLastReport(null);
      await refreshAll();
      toast.success('History cleared.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear history');
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col px-3 py-3 sm:px-6 sm:py-4 lg:h-svh lg:max-h-svh lg:overflow-hidden">
      <DashboardHeader
        overview={overview}
        requests={requests}
        stressReports={reports}
        showToolTraffic={showToolTraffic}
        autoRefresh={autoRefresh}
        busy={running || pending}
        clearDisabled={running}
        auth={{
          authenticated: initial.auth.authenticated,
          user: initial.auth.user
            ? { name: initial.auth.user.name, email: initial.auth.user.email }
            : null
        }}
        showBilling={initial.billing.hasCustomer}
        onAutoRefreshChange={setAutoRefresh}
        onRefresh={() =>
          startTransition(() => {
            void refreshAll().catch((e) =>
              toast.error(e instanceof Error ? e.message : 'Could not update')
            );
          })
        }
        onClear={() => void onClearHistory()}
        onLogout={() => void onLogout()}
        onManageBilling={() => void onManageBilling()}
      />

      <KpiStrip total={kpis.total} errors={kpis.errors} worstP95={kpis.worst} />

      <div className="flex flex-col border-b border-border lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[1.35fr_0.9fr] lg:overflow-hidden lg:divide-x lg:divide-border">
        <RoutesPanel
          routes={visibleRoutes}
          showToolTraffic={showToolTraffic}
          onShowToolTrafficChange={setShowToolTraffic}
        />
        <section className="flex min-h-[20rem] min-w-0 flex-col border-b border-border py-4 lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:pl-8">
          <AiChatPanel
            latestRequest={visibleRequests[0] ?? null}
            latestStress={lastReport ?? reports[0] ?? null}
          />
        </section>
      </div>

      <div className="flex flex-col pb-6 lg:grid lg:min-h-0 lg:flex-[0.85] lg:grid-cols-2 lg:overflow-hidden lg:divide-x lg:divide-border lg:pb-0">
        <RequestHistory requests={visibleRequests} />
        <StressPanel
          demoApiBase={demoApiBase}
          running={running}
          stressGate={stressGate}
          lastReport={lastReport}
          reports={reports}
          compare={compare}
          onError={(message, title) => toast.error(message, title)}
          onRun={onRunStress}
        />
      </div>
    </div>
  );
}
