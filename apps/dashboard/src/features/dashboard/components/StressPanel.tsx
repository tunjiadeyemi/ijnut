import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';

import { DEMO_PATHS } from '../utils/constants';
import { formatClockTime } from '../utils/format';
import { parseHeadersText } from '../utils/headers';
import type { RouteAggregate, StressInput, StressReport } from '@/shared/api/types';

import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { latencyTextClass } from '@/features/overview/lib/latency';

type Compare = {
  before?: RouteAggregate;
  after?: RouteAggregate;
} | null;

type Props = {
  demoApiBase: string;
  running: boolean;
  stressGate: string | null;
  lastReport: StressReport | null;
  reports: StressReport[];
  compare: Compare;
  onError: (message: string, title?: string) => void;
  onRun: (input: StressInput) => Promise<void>;
};

function statusCodesSummary(codes: Record<string, number> | undefined): string {
  if (!codes) return '—';
  const parts = Object.entries(codes)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([code, n]) => `${code}×${n}`);
  return parts.length ? parts.join(' ') : '—';
}

export function StressPanel({
  demoApiBase,
  running,
  stressGate,
  lastReport,
  reports,
  compare,
  onError,
  onRun
}: Props) {
  const [useDemoApi, setUseDemoApi] = useState(true);
  const [form, setForm] = useState({
    target: demoApiBase,
    method: 'GET',
    path: '/ping',
    connections: '20',
    durationSec: '5',
    headersText: '',
    bodyText: ''
  });

  function applyDemoPath(path: string) {
    const match = DEMO_PATHS.find((p) => p.path === path) ?? DEMO_PATHS[0];
    setForm((f) => ({
      ...f,
      target: demoApiBase,
      path: match.path,
      method: match.method
    }));
  }

  function onToggleUseDemoApi(checked: boolean) {
    setUseDemoApi(checked);
    if (checked) applyDemoPath(form.path);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const connections = Number(form.connections);
    const durationSec = Number(form.durationSec);
    if (
      !Number.isFinite(connections) ||
      connections < 1 ||
      !Number.isFinite(durationSec) ||
      durationSec < 1
    ) {
      onError('Enter at least 1 parallel user and 1 second.');
      return;
    }

    const headers = useDemoApi ? undefined : parseHeadersText(form.headersText);
    const bodyText = !useDemoApi && form.bodyText.trim() ? form.bodyText.trim() : undefined;

    if (bodyText) {
      try {
        JSON.parse(bodyText);
      } catch {
        onError('Body must be valid JSON.');
        return;
      }
    }

    await onRun({
      target: form.target,
      method: form.method,
      path: form.path,
      connections,
      durationSec,
      headers,
      body: bodyText
    });
  }

  return (
    <section className="flex min-w-0 flex-col gap-2 py-4 lg:min-h-0 lg:overflow-y-auto lg:pl-8">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
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
                ? 'bg-primary text-primary-foreground rounded-sm px-2.5 py-1 font-medium'
                : 'text-muted-foreground hover:text-foreground rounded-sm px-2.5 py-1'
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
                ? 'bg-primary text-primary-foreground rounded-sm px-2.5 py-1 font-medium'
                : 'text-muted-foreground hover:text-foreground rounded-sm px-2.5 py-1'
            }
            onClick={() => onToggleUseDemoApi(false)}
          >
            Live
          </button>
        </div>
      </div>

      {stressGate ? (
        <p className="text-muted-foreground rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          {stressGate}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {useDemoApi ? (
          <div className="space-y-1">
            <Label htmlFor="demo-path" className="text-xs">
              Path
            </Label>
            <Select
              id="demo-path"
              value={DEMO_PATHS.some((p) => p.path === form.path) ? form.path : DEMO_PATHS[0].path}
              onChange={(path) => applyDemoPath(path)}
              options={DEMO_PATHS.map((p) => ({
                value: p.path,
                label: p.path
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
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
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
                  onChange={(method) => setForm((f) => ({ ...f, method }))}
                  options={[
                    { value: 'GET', label: 'GET' },
                    { value: 'POST', label: 'POST' },
                    { value: 'PUT', label: 'PUT' },
                    { value: 'PATCH', label: 'PATCH' },
                    { value: 'DELETE', label: 'DELETE' }
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
                  onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, headersText: e.target.value }))}
                placeholder={'Authorization: Bearer …\nX-Api-Key: …'}
                rows={2}
                className="border-input bg-background placeholder:text-muted-foreground w-full resize-y rounded-md border px-2 py-1.5 font-mono text-xs leading-relaxed"
              />
            </div>

            {form.method !== 'GET' ? (
              <div className="space-y-1">
                <Label htmlFor="body" className="text-xs">
                  Body (JSON)
                </Label>
                <textarea
                  id="body"
                  value={form.bodyText}
                  onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, connections: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, durationSec: e.target.value }))}
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm" disabled={running} className="h-9">
            {running ? <Loader2 className="animate-spin" /> : <Play className="size-3.5" />}
            Run
          </Button>
        </div>
      </form>

      {lastReport ? (
        <div className="border-t border-border pt-3">
          <p className="text-foreground mb-2 text-xs font-medium">Load test result</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">RPS</dt>
              <dd>{lastReport.requestsPerSec.toFixed(1)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">p50</dt>
              <dd className={latencyTextClass(lastReport.p50ms)}>{lastReport.p50ms}ms</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">p95</dt>
              <dd className={latencyTextClass(lastReport.p95ms)}>{lastReport.p95ms}ms</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">p99</dt>
              <dd className={latencyTextClass(lastReport.p99ms)}>{lastReport.p99ms}ms</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Errors</dt>
              <dd>{lastReport.errors}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="break-all">{statusCodesSummary(lastReport.statusCodes)}</dd>
            </div>
          </dl>
          {!useDemoApi ? (
            <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
              Live targets only produce this report. Routes / request history need the
              observability middleware on that API.
            </p>
          ) : null}
          {compare?.before || compare?.after ? (
            <p className="text-muted-foreground mt-2 font-mono text-[11px] tabular-nums">
              Demo route p95:{' '}
              <span className={latencyTextClass(compare.before?.p95ms)}>
                {compare.before?.p95ms ?? '—'}
              </span>
              →
              <span className={latencyTextClass(compare.after?.p95ms)}>
                {compare.after?.p95ms ?? '—'}
              </span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground border-t border-border pt-2 text-xs">
          No load test yet — run one to see RPS and latency here.
        </p>
      )}

      {reports.length > 1 ? (
        <ul className="text-muted-foreground max-h-24 space-y-1 overflow-y-auto border-t border-border pt-2 font-mono text-[11px] tabular-nums">
          {reports.slice(0, 5).map((r) => (
            <li key={r.id}>
              {r.requestsPerSec.toFixed(1)} rps · p95 {r.p95ms}ms · err {r.errors} ·{' '}
              {formatClockTime(r.finishedAt)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
