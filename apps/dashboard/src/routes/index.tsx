import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  Eraser,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
} from "lucide-react";
import { AgentReportCopyButton } from "@/components/AgentReportPanel";
import { AiChatPanel } from "@/components/AiChatPanel";
import { HoverIconLabel } from "@/components/HoverIconLabel";
import { OverviewCharts } from "@/components/OverviewCharts";
import { UpgradeGate } from "@/components/UpgradeGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { latencyTextClass } from "@/lib/latency";
import {
  clearHistory,
  fetchOverview,
  fetchRequests,
  fetchStressReports,
  getAuthState,
  getDashboardConfig,
  logout,
  runStressTest,
  type OverviewResponse,
  type RequestRecord,
  type RouteAggregate,
  type StressReport,
} from "@/lib/observability.functions";

/** Paths that are safe / useful to hammer on the Nest demo API. */
const DEMO_PATHS = [
  { method: "GET", path: "/ping", label: "GET /ping" },
  { method: "GET", path: "/slow", label: "GET /slow (deliberate delay)" },
  { method: "GET", path: "/health", label: "GET /health" },
  { method: "GET", path: "/items/42", label: "GET /items/42" },
  { method: "POST", path: "/admin/echo", label: "POST /admin/echo (expect 401)" },
] as const;

function isToolTraffic(routeOrPath: string): boolean {
  return routeOrPath.includes("/observability");
}

function errorBadgeVariant(rate: number) {
  if (rate > 0.05) return "danger" as const;
  if (rate > 0) return "warning" as const;
  return "success" as const;
}

function statusBadgeVariant(code: number) {
  if (code >= 500) return "danger" as const;
  if (code >= 400) return "warning" as const;
  return "success" as const;
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
  beforeLoad: async () => {
    const { authenticated } = await getAuthState();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => {
    const [overview, requests, stress, config] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports(),
      getDashboardConfig(),
    ]);
    return { overview, requests, stress, config };
  },
});

function DashboardPage() {
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const toast = useToast();
  const demoApiBase = initial.config.publicApiUrl;
  const [overview, setOverview] = useState<OverviewResponse>(initial.overview);
  const [requests, setRequests] = useState<RequestRecord[]>(
    initial.requests.requests,
  );
  const [reports, setReports] = useState<StressReport[]>(
    initial.stress.reports,
  );
  const [beforeSnap, setBeforeSnap] = useState<RouteAggregate[] | null>(null);
  const [lastReport, setLastReport] = useState<StressReport | null>(
    initial.stress.reports[0] ?? null,
  );
  const [running, setRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showToolTraffic, setShowToolTraffic] = useState(false);
  const [useDemoApi, setUseDemoApi] = useState(true);
  const [stressGate, setStressGate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    target: demoApiBase,
    method: "GET",
    path: "/ping",
    connections: "20",
    durationSec: "5",
    headersText: "",
    bodyText: "",
  });

  function parseHeadersText(text: string): Record<string, string> | undefined {
    const headers: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(":");
      if (colon <= 0) continue;
      const key = trimmed.slice(0, colon).trim();
      const value = trimmed.slice(colon + 1).trim();
      if (key) headers[key] = value;
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  }

  function applyDemoPath(path: string) {
    const match = DEMO_PATHS.find((p) => p.path === path) ?? DEMO_PATHS[0];
    setForm((f) => ({
      ...f,
      target: demoApiBase,
      path: match.path,
      method: match.method,
    }));
  }

  function onToggleUseDemoApi(checked: boolean) {
    setUseDemoApi(checked);
    if (checked) {
      applyDemoPath(form.path);
    }
  }

  const visibleRoutes = useMemo(() => {
    if (showToolTraffic) return overview.routes;
    return overview.routes.filter((r) => !isToolTraffic(r.key));
  }, [overview.routes, showToolTraffic]);

  const visibleRequests = useMemo(() => {
    if (showToolTraffic) return requests;
    return requests.filter(
      (r) => !isToolTraffic(r.route) && !isToolTraffic(r.path),
    );
  }, [requests, showToolTraffic]);

  async function refreshAll() {
    const [ov, req, st] = await Promise.all([
      fetchOverview(),
      fetchRequests({ data: { limit: 40 } }),
      fetchStressReports(),
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
          toast.error(
            e instanceof Error ? e.message : "Refresh failed",
            "Could not update",
          ),
        );
      });
    }, 2500);
    return () => clearInterval(id);
  }, [autoRefresh, running, toast]);

  const compare = useMemo(() => {
    if (!beforeSnap || !lastReport?.routeSnapshot) return null;
    const key = lastReport.routeSnapshot.key;
    const before = beforeSnap.find((r) => r.key === key);
    const after = overview.routes.find((r) => r.key === key);
    return { key, before, after, report: lastReport };
  }, [beforeSnap, lastReport, overview.routes]);

  const kpis = useMemo(() => {
    const total = visibleRoutes.reduce((s, r) => s + r.count, 0);
    const errors = visibleRoutes.reduce((s, r) => s + r.errors, 0);
    const worst = visibleRoutes.reduce(
      (m, r) => (r.p95ms > m ? r.p95ms : m),
      0,
    );
    return { total, errors, worst };
  }, [visibleRoutes]);

  async function onRunStress(e: React.FormEvent) {
    e.preventDefault();
    const connections = Number(form.connections);
    const durationSec = Number(form.durationSec);
    if (
      !Number.isFinite(connections) ||
      connections < 1 ||
      !Number.isFinite(durationSec) ||
      durationSec < 1
    ) {
      toast.error("Enter at least 1 parallel user and 1 second.");
      return;
    }

    const headers = useDemoApi
      ? undefined
      : parseHeadersText(form.headersText);
    const bodyText =
      !useDemoApi && form.bodyText.trim() ? form.bodyText.trim() : undefined;

    if (bodyText) {
      try {
        JSON.parse(bodyText);
      } catch {
        toast.error("Body must be valid JSON.");
        return;
      }
    }

    setRunning(true);
    try {
      const snap = await fetchOverview();
      setBeforeSnap(snap.routes);
      setOverview(snap);

      const result = await runStressTest({
        data: {
          target: form.target,
          method: form.method,
          path: form.path,
          connections,
          durationSec,
          headers,
          body: bodyText,
        },
      });

      if (result && typeof result === "object" && "error" in result && result.error) {
        const failed = result as {
          error: true;
          status: number;
          message: string;
        };
        if (failed.status === 429) {
          setStressGate(
            "Stress rate limit hit. On IJNUT Cloud free, wait a minute — or upgrade / self-host for higher caps.",
          );
          toast.error("Too many stress tests. Wait about a minute.", "Slow down");
        } else {
          toast.error(failed.message, "Load test failed");
        }
      } else {
        setStressGate(null);
        setLastReport(result as StressReport);
        toast.success("Load test finished.", "Done");
      }
      await refreshAll();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Stress failed",
        "Load test failed",
      );
    } finally {
      setRunning(false);
    }
  }

  async function onLogout() {
    await logout();
    await navigate({ to: "/login" });
  }

  async function onClearHistory() {
    const ok = window.confirm(
      "Clear all recorded requests, route stats, and past load tests?",
    );
    if (!ok) return;
    try {
      await clearHistory();
      setBeforeSnap(null);
      setLastReport(null);
      await refreshAll();
      toast.success("History cleared.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not clear history",
      );
    }
  }
  return (
    <div className="mx-auto flex h-svh max-h-svh w-full max-w-[1600px] flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border pb-3">
        <h1 className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
          <Activity className="text-primary size-5" />
          IJNUT
        </h1>

        <dl className="text-muted-foreground mx-auto flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="font-mono font-medium text-foreground/70">n</dt>
            <dd>request count</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-mono font-medium text-foreground/70">err</dt>
            <dd>error rate</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-mono font-medium text-foreground/70">p95</dt>
            <dd>slowest 5% (ms)</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-mono font-medium text-foreground/70">rps</dt>
            <dd>req/s</dd>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-700">{"<100"}</span>
            <span className="text-amber-700">100–299</span>
            <span className="text-red-700">≥300</span>
            <span className="text-muted-foreground">ms</span>
          </div>
        </dl>

        <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <Checkbox
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={(v) => setAutoRefresh(v === true)}
            />
            Auto
          </label>
          {running || pending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <span className="bg-primary/70 size-1.5 rounded-full" />
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-0.5">
          <AgentReportCopyButton
            overview={overview}
            requests={requests}
            stressReports={reports}
            includeToolTraffic={showToolTraffic}
          />
          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2"
            aria-label="Refresh"
            onClick={() =>
              startTransition(() => {
                void refreshAll().catch((e) =>
                  toast.error(
                    e instanceof Error ? e.message : "Could not update",
                  ),
                );
              })
            }
          >
            <RefreshCw className="size-3.5 shrink-0" />
            <HoverIconLabel>Refresh</HoverIconLabel>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2"
            aria-label="Clear"
            disabled={running}
            onClick={() => void onClearHistory()}
          >
            <Eraser className="size-3.5 shrink-0" />
            <HoverIconLabel>Clear</HoverIconLabel>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="group h-8 px-2"
            aria-label="Log out"
            onClick={() => void onLogout()}
          >
            <LogOut className="size-3.5 shrink-0" />
            <HoverIconLabel>Log out</HoverIconLabel>
          </Button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-b border-border">
        <div className="px-0 py-3 pr-4 sm:pr-6">
          <div className="text-muted-foreground text-xs">Requests</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
            {kpis.total}
          </div>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <div className="text-muted-foreground text-xs">Errors</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
            {kpis.errors}
          </div>
        </div>
        <div className="px-4 py-3 pl-4 sm:pl-6">
          <div className="text-muted-foreground text-xs">Worst p95</div>
          <div
            className={`mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl ${latencyTextClass(kpis.worst > 0 ? kpis.worst : null)}`}
          >
            {kpis.worst > 0 ? `${kpis.worst.toFixed(0)}` : "—"}
            {kpis.worst > 0 ? (
              <span className="ml-1 text-sm font-normal opacity-70">ms</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-b border-border lg:grid-cols-[1.35fr_0.9fr] lg:divide-x lg:divide-border">
        <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-b border-border py-4 lg:border-b-0 lg:pr-8">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
            <h2 className="text-sm font-medium">Routes</h2>
            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={showToolTraffic}
                onCheckedChange={(v) => setShowToolTraffic(v === true)}
              />
              Tools
            </label>
          </div>
          <div className="shrink-0 border-b border-border pb-3">
            <OverviewCharts routes={visibleRoutes} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-0">Route</TableHead>
                  <TableHead className="text-right">n</TableHead>
                  <TableHead className="text-right">Err</TableHead>
                  <TableHead className="pr-0 text-right">p95</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground pl-0"
                    >
                      No traffic yet
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRoutes.map((r) => (
                    <TableRow key={r.key} className="hover:bg-transparent">
                      <TableCell className="max-w-[14rem] truncate pl-0 font-mono text-xs">
                        {r.key}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={errorBadgeVariant(r.errorRate)}
                          className="font-mono text-[10px]"
                        >
                          {(r.errorRate * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`pr-0 text-right font-mono text-xs tabular-nums ${latencyTextClass(r.p95ms)}`}
                      >
                        {r.p95ms.toFixed(0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden py-4 lg:pl-8">
          <AiChatPanel
            latestRequest={visibleRequests[0] ?? null}
            latestStress={lastReport ?? reports[0] ?? null}
          />
        </section>
      </div>

      <div className="grid min-h-0 flex-[0.85] grid-cols-1 overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-border">
        <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-b border-border py-4 lg:border-b-0 lg:pr-8">
          <h2 className="shrink-0 border-b border-border pb-2 text-sm font-medium">
            History
          </h2>
          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableBody>
                {visibleRequests.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground pl-0">
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRequests.slice(0, 20).map((r) => (
                    <TableRow
                      key={r.requestId + r.timestamp}
                      className="hover:bg-transparent"
                    >
                      <TableCell className="w-14 pl-0">
                        <Badge
                          variant={statusBadgeVariant(r.statusCode)}
                          className="font-mono text-[10px]"
                        >
                          {r.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                        {r.path}
                      </TableCell>
                      <TableCell
                        className={`pr-0 text-right font-mono text-xs tabular-nums ${latencyTextClass(r.durationMs)}`}
                      >
                        {Math.round(r.durationMs)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto py-4 lg:pl-8">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
            <h2 className="text-sm font-medium">Load</h2>
            <div
              role="radiogroup"
              aria-label="Target"
              className="border-border flex rounded-md border p-0.5 text-xs"
            >
              <button
                type="button"
                role="radio"
                aria-checked={useDemoApi}
                className={
                  useDemoApi
                    ? "bg-primary text-primary-foreground rounded-sm px-2.5 py-1 font-medium"
                    : "text-muted-foreground hover:text-foreground rounded-sm px-2.5 py-1"
                }
                onClick={() => onToggleUseDemoApi(true)}
              >
                Demo API
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!useDemoApi}
                className={
                  !useDemoApi
                    ? "bg-primary text-primary-foreground rounded-sm px-2.5 py-1 font-medium"
                    : "text-muted-foreground hover:text-foreground rounded-sm px-2.5 py-1"
                }
                onClick={() => onToggleUseDemoApi(false)}
              >
                Live
              </button>
            </div>
          </div>

          {stressGate ? (
            <UpgradeGate
              title="Stress limited"
              message={stressGate}
              cta={initial.config.cta}
            />
          ) : null}

          <form onSubmit={onRunStress} className="flex flex-col gap-3">
            {useDemoApi ? (
              <div className="space-y-1">
                <Label htmlFor="demo-path" className="text-xs">
                  Path
                </Label>
                <Select
                  id="demo-path"
                  value={
                    DEMO_PATHS.some((p) => p.path === form.path)
                      ? form.path
                      : DEMO_PATHS[0].path
                  }
                  onChange={(path) => applyDemoPath(path)}
                  options={DEMO_PATHS.map((p) => ({
                    value: p.path,
                    label: p.path,
                  }))}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_5.5rem_1fr]">
                  <div className="space-y-1">
                    <Label htmlFor="target" className="text-xs">
                      Base URL
                    </Label>
                    <Input
                      id="target"
                      value={form.target}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, target: e.target.value }))
                      }
                      placeholder="http://127.0.0.1:3000"
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="method" className="text-xs">
                      Method
                    </Label>
                    <Select
                      id="method"
                      value={form.method}
                      onChange={(method) =>
                        setForm((f) => ({ ...f, method }))
                      }
                      options={[
                        { value: "GET", label: "GET" },
                        { value: "POST", label: "POST" },
                        { value: "PUT", label: "PUT" },
                        { value: "PATCH", label: "PATCH" },
                        { value: "DELETE", label: "DELETE" },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="path" className="text-xs">
                      Path
                    </Label>
                    <Input
                      id="path"
                      value={form.path}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, path: e.target.value }))
                      }
                      placeholder="/ping"
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="headers" className="text-xs">
                    Headers
                  </Label>
                  <textarea
                    id="headers"
                    value={form.headersText}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, headersText: e.target.value }))
                    }
                    placeholder={"Authorization: Bearer …\nX-Api-Key: …"}
                    rows={2}
                    className="border-input bg-background placeholder:text-muted-foreground w-full resize-y rounded-md border px-2 py-1.5 font-mono text-xs leading-relaxed"
                  />
                </div>

                {form.method !== "GET" ? (
                  <div className="space-y-1">
                    <Label htmlFor="body" className="text-xs">
                      Body (JSON)
                    </Label>
                    <textarea
                      id="body"
                      value={form.bodyText}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bodyText: e.target.value }))
                      }
                      placeholder='{"url":"https://example.com"}'
                      rows={3}
                      className="border-input bg-background placeholder:text-muted-foreground w-full resize-y rounded-md border px-2 py-1.5 font-mono text-xs leading-relaxed"
                    />
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="w-20 space-y-1">
                <Label htmlFor="connections" className="text-xs">
                  Users
                </Label>
                <Input
                  id="connections"
                  type="number"
                  min={1}
                  max={100}
                  inputMode="numeric"
                  value={form.connections}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, connections: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
              <div className="w-20 space-y-1">
                <Label htmlFor="duration" className="text-xs">
                  Sec
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={60}
                  inputMode="numeric"
                  value={form.durationSec}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationSec: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={running}
                className="h-9"
              >
                {running ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Run
              </Button>
            </div>
          </form>

          {lastReport ? (
            <p className="text-muted-foreground border-t border-border pt-2 font-mono text-xs tabular-nums">
              {lastReport.requestsPerSec.toFixed(0)} rps · p95{" "}
              <span className={latencyTextClass(lastReport.p95ms)}>
                {lastReport.p95ms}ms
              </span>{" "}
              · err {lastReport.errors}
              {compare ? (
                <>
                  {" · "}
                  <span className={latencyTextClass(compare.before?.p95ms)}>
                    {compare.before?.p95ms ?? "—"}
                  </span>
                  →
                  <span className={latencyTextClass(compare.after?.p95ms)}>
                    {compare.after?.p95ms ?? "—"}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
