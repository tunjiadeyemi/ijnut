import { useNavigate } from '@tanstack/react-router';
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
};

export function DashboardPage({ initial }: { initial: DashboardLoaderData }) {
  const navigate = useNavigate();
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
            'Stress rate limit hit. On IJNUT Cloud free, wait a minute — or upgrade / self-host for higher caps.'
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
    await navigate({ to: '/login' });
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
    <div className="mx-auto flex h-svh max-h-svh w-full max-w-[1600px] flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
      <DashboardHeader
        overview={overview}
        requests={requests}
        stressReports={reports}
        showToolTraffic={showToolTraffic}
        autoRefresh={autoRefresh}
        busy={running || pending}
        clearDisabled={running}
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
      />

      <KpiStrip total={kpis.total} errors={kpis.errors} worstP95={kpis.worst} />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-b border-border lg:grid-cols-[1.35fr_0.9fr] lg:divide-x lg:divide-border">
        <RoutesPanel
          routes={visibleRoutes}
          showToolTraffic={showToolTraffic}
          onShowToolTrafficChange={setShowToolTraffic}
        />
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden py-4 lg:pl-8">
          <AiChatPanel
            latestRequest={visibleRequests[0] ?? null}
            latestStress={lastReport ?? reports[0] ?? null}
          />
        </section>
      </div>

      <div className="grid min-h-0 flex-[0.85] grid-cols-1 overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-border">
        <RequestHistory requests={visibleRequests} />
        <StressPanel
          demoApiBase={demoApiBase}
          running={running}
          stressGate={stressGate}
          cta={initial.config.cta}
          lastReport={lastReport}
          compare={compare}
          onError={(message, title) => toast.error(message, title)}
          onRun={onRunStress}
        />
      </div>
    </div>
  );
}
