import { Activity, Eraser, Loader2, LogOut, RefreshCw } from 'lucide-react';
import type { OverviewResponse, RequestRecord, StressReport } from '@/shared/api/types';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { HoverIconLabel } from '@/shared/components/HoverIconLabel';
import { AgentReportCopyButton } from '@/features/ai/components/AgentReportPanel';

type Props = {
  overview: OverviewResponse;
  requests: RequestRecord[];
  stressReports: StressReport[];
  showToolTraffic: boolean;
  autoRefresh: boolean;
  busy: boolean;
  clearDisabled: boolean;
  onAutoRefreshChange: (checked: boolean) => void;
  onRefresh: () => void;
  onClear: () => void;
  onLogout: () => void;
};

export function DashboardHeader({
  overview,
  requests,
  stressReports,
  showToolTraffic,
  autoRefresh,
  busy,
  clearDisabled,
  onAutoRefreshChange,
  onRefresh,
  onClear,
  onLogout
}: Props) {
  return (
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
          <span className="text-emerald-700">{'<100'}</span>
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
            onCheckedChange={(v) => onAutoRefreshChange(v === true)}
          />
          Auto
        </label>
        {busy ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <span className="bg-primary/70 size-1.5 rounded-full" />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-0.5">
        <AgentReportCopyButton
          overview={overview}
          requests={requests}
          stressReports={stressReports}
          includeToolTraffic={showToolTraffic}
        />
        <Button
          variant="ghost"
          size="sm"
          className="group h-8 px-2"
          aria-label="Refresh"
          onClick={onRefresh}
        >
          <RefreshCw className="size-3.5 shrink-0" />
          <HoverIconLabel>Refresh</HoverIconLabel>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="group h-8 px-2"
          aria-label="Clear"
          disabled={clearDisabled}
          onClick={onClear}
        >
          <Eraser className="size-3.5 shrink-0" />
          <HoverIconLabel>Clear</HoverIconLabel>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="group h-8 px-2"
          aria-label="Log out"
          onClick={onLogout}
        >
          <LogOut className="size-3.5 shrink-0" />
          <HoverIconLabel>Log out</HoverIconLabel>
        </Button>
      </div>
    </header>
  );
}
