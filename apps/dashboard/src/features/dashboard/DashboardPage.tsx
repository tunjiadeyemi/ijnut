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
import {
  MobileSidebar,
  mobileSectionLabel,
  type MobileSection
} from './components/MobileSidebar';
import { AiChatPanel } from '@/features/ai/components/AiChatPanel';
import { useIsDesktop } from './hooks/useIsDesktop';

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
  const isDesktop = useIsDesktop();
  const demoApiBase = initial.config.publicApiUrl;

  const initialRoutes = initial.overview?.routes ?? [];
  const initialRequests = initial.requests?.requests ?? [];
  const initialReports = initial.stress?.reports ?? [];

  const [overview, setOverview] = useState<OverviewResponse>({
    routes: initialRoutes,
    updatedAt: initial.overview?.updatedAt ?? new Date().toISOString()
  });
  const [requests, setRequests] = useState<RequestRecord[]>(initialRequests);
  const [reports, setReports] = useState<StressReport[]>(initialReports);
  const [beforeSnap, setBeforeSnap] = useState<RouteAggregate[] | null>(null);
  const [lastReport, setLastReport] = useState<StressReport | null>(
    initialReports[0] ?? null
  );
  const [running, setRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showToolTraffic, setShowToolTraffic] = useState(false);
  const [stressGate, setStressGate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>('metrics');

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

  const authSummary = {
    authenticated: initial.auth.authenticated,
    user: initial.auth.user
      ? { name: initial.auth.user.name, email: initial.auth.user.email }
      : null
  };

  async function refreshAll() {
    const [ov, req, st] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports()
    ]);
    setOverview({
      routes: ov?.routes ?? [],
      updatedAt: ov?.updatedAt ?? new Date().toISOString()
    });
    setRequests(req?.requests ?? []);
    const nextReports = st?.reports ?? [];
    setReports(nextReports);
    if (nextReports[0]) setLastReport(nextReports[0]);
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
    const result = await createPortal({
      data: { returnOrigin: window.location.origin }
    });
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

  function onRefresh() {
    startTransition(() => {
      void refreshAll().catch((e) =>
        toast.error(e instanceof Error ? e.message : 'Could not update')
      );
    });
  }

  return (
    <div className="mx-auto flex h-svh max-h-svh w-full max-w-[1600px] flex-col overflow-hidden px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4 lg:pb-4">
      <DashboardHeader
        overview={overview}
        requests={requests}
        stressReports={reports}
        showToolTraffic={showToolTraffic}
        autoRefresh={autoRefresh}
        busy={running || pending}
        clearDisabled={running}
        auth={authSummary}
        showBilling={initial.billing.hasCustomer}
        mobileSectionLabel={isDesktop ? undefined : mobileSectionLabel(mobileSection)}
        onOpenMobileNav={isDesktop ? undefined : () => setMobileNavOpen(true)}
        onAutoRefreshChange={setAutoRefresh}
        onRefresh={onRefresh}
        onClear={() => void onClearHistory()}
        onLogout={() => void onLogout()}
        onManageBilling={() => void onManageBilling()}
      />

      {!isDesktop ? (
        <MobileSidebar
          open={mobileNavOpen}
          section={mobileSection}
          overview={overview}
          requests={requests}
          stressReports={reports}
          showToolTraffic={showToolTraffic}
          clearDisabled={running}
          auth={authSummary}
          showBilling={initial.billing.hasCustomer}
          onClose={() => setMobileNavOpen(false)}
          onSectionChange={setMobileSection}
          onRefresh={onRefresh}
          onClear={() => void onClearHistory()}
          onLogout={() => void onLogout()}
          onManageBilling={() => void onManageBilling()}
        />
      ) : null}

      {!isDesktop ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {mobileSection === 'metrics' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <KpiStrip total={kpis.total} errors={kpis.errors} worstP95={kpis.worst} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <RoutesPanel
                  routes={visibleRoutes}
                  showToolTraffic={showToolTraffic}
                  onShowToolTrafficChange={setShowToolTraffic}
                  className="min-h-full border-b-0 py-3"
                />
              </div>
            </div>
          ) : null}

          {mobileSection === 'ask' ? (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden py-2">
              <AiChatPanel
                latestRequest={visibleRequests[0] ?? null}
                latestStress={lastReport ?? reports[0] ?? null}
              />
            </section>
          ) : null}

          {mobileSection === 'history' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <RequestHistory
                requests={visibleRequests}
                className="min-h-full border-b-0 py-3"
              />
            </div>
          ) : null}

          {mobileSection === 'load' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <StressPanel
                demoApiBase={demoApiBase}
                running={running}
                stressGate={stressGate}
                lastReport={lastReport}
                reports={reports}
                compare={compare}
                className="min-h-full py-3"
                onError={(message, title) => toast.error(message, title)}
                onRun={onRunStress}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <KpiStrip total={kpis.total} errors={kpis.errors} worstP95={kpis.worst} />

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)] overflow-hidden divide-x divide-border border-b border-border">
            <RoutesPanel
              routes={visibleRoutes}
              showToolTraffic={showToolTraffic}
              onShowToolTrafficChange={setShowToolTraffic}
            />
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden py-4 pl-6 xl:pl-8">
              <AiChatPanel
                latestRequest={visibleRequests[0] ?? null}
                latestStress={lastReport ?? reports[0] ?? null}
              />
            </section>
          </div>

          <div className="grid min-h-0 min-w-0 flex-[0.85] grid-cols-2 overflow-hidden divide-x divide-border">
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
      )}
    </div>
  );
}
