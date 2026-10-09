import { latencyTextClass } from '@/features/overview/lib/latency';

type Props = {
  total: number;
  errors: number;
  worstP95: number;
};

export function KpiStrip({ total, errors, worstP95 }: Props) {
  return (
    <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-b border-border">
      <div className="px-0 py-3 pr-4 sm:pr-6">
        <div className="text-muted-foreground text-xs">Requests</div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
          {total}
        </div>
      </div>
      <div className="px-4 py-3 sm:px-6">
        <div className="text-muted-foreground text-xs">Errors</div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
          {errors}
        </div>
      </div>
      <div className="px-4 py-3 pl-4 sm:pl-6">
        <div className="text-muted-foreground text-xs">Worst p95</div>
        <div
          className={`mt-0.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl ${latencyTextClass(worstP95 > 0 ? worstP95 : null)}`}
        >
          {worstP95 > 0 ? `${worstP95.toFixed(0)}` : '—'}
          {worstP95 > 0 ? <span className="ml-1 text-sm font-normal opacity-70">ms</span> : null}
        </div>
      </div>
    </div>
  );
}
