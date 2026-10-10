import { latencyTextClass } from '@/features/overview/lib/latency';

type Props = {
  total: number;
  errors: number;
  worstP95: number;
};

export function KpiStrip({ total, errors, worstP95 }: Props) {
  return (
    <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-b border-border">
      <div className="min-w-0 px-0 py-2 pr-2 sm:py-3 sm:pr-6">
        <div className="text-muted-foreground text-[10px] sm:text-xs">Requests</div>
        <div className="mt-0.5 text-base font-semibold tabular-nums tracking-tight sm:text-2xl">
          {total}
        </div>
      </div>
      <div className="min-w-0 px-2 py-2 sm:px-6 sm:py-3">
        <div className="text-muted-foreground text-[10px] sm:text-xs">Errors</div>
        <div className="mt-0.5 text-base font-semibold tabular-nums tracking-tight sm:text-2xl">
          {errors}
        </div>
      </div>
      <div className="min-w-0 px-2 py-2 pl-2 sm:px-6 sm:py-3 sm:pl-6">
        <div className="text-muted-foreground text-[10px] sm:text-xs">Worst p95</div>
        <div
          className={`mt-0.5 text-base font-semibold tabular-nums tracking-tight sm:text-2xl ${latencyTextClass(worstP95 > 0 ? worstP95 : null)}`}
        >
          {worstP95 > 0 ? `${worstP95.toFixed(0)}` : '—'}
          {worstP95 > 0 ? (
            <span className="ml-0.5 text-xs font-normal opacity-70 sm:ml-1 sm:text-sm">ms</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
