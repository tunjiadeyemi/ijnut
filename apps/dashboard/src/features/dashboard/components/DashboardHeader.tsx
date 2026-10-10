import {
  CreditCard,
  Eraser,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  RefreshCw,
  Telescope
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { OverviewResponse, RequestRecord, StressReport } from '@/shared/api/types';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { HoverIconLabel } from '@/shared/components/HoverIconLabel';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { AgentReportCopyButton } from '@/features/ai/components/AgentReportPanel';

type AuthSummary = {
  authenticated: boolean;
  user: { name: string; email: string } | null;
};

type Props = {
  overview: OverviewResponse;
  requests: RequestRecord[];
  stressReports: StressReport[];
  showToolTraffic: boolean;
  autoRefresh: boolean;
  busy: boolean;
  clearDisabled: boolean;
  auth: AuthSummary;
  showBilling?: boolean;
  /** Current mobile section label (small screens only). */
  mobileSectionLabel?: string;
  onOpenMobileNav?: () => void;
  onResetPanels?: () => void;
  onAutoRefreshChange: (checked: boolean) => void;
  onRefresh: () => void;
  onClear: () => void;
  onLogout: () => void;
  onManageBilling?: () => void;
};

export function DashboardHeader({
  overview,
  requests,
  stressReports,
  showToolTraffic,
  autoRefresh,
  busy,
  clearDisabled,
  auth,
  showBilling,
  mobileSectionLabel,
  onOpenMobileNav,
  onResetPanels,
  onAutoRefreshChange,
  onRefresh,
  onClear,
  onLogout,
  onManageBilling
}: Props) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-border pb-3 sm:gap-2">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {onOpenMobileNav ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 lg:hidden"
            aria-label="Open sections"
            onClick={onOpenMobileNav}
          >
            <Menu className="size-5" />
          </Button>
        ) : null}

        <div className="min-w-0 shrink-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Telescope className="text-primary size-5 shrink-0" />
            IJNUT
          </h1>
          {mobileSectionLabel ? (
            <p className="text-muted-foreground truncate text-[11px] lg:hidden">
              {mobileSectionLabel}
            </p>
          ) : null}
        </div>

        <div className="text-muted-foreground ml-auto flex shrink-0 items-center gap-2 text-xs sm:order-last sm:ml-0">
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

        <div className="hidden w-full shrink-0 flex-wrap items-center justify-end gap-0.5 sm:ml-auto sm:w-auto lg:flex">
          <ThemeToggle />
          <AgentReportCopyButton
            overview={overview}
            requests={requests}
            stressReports={stressReports}
            includeToolTraffic={showToolTraffic}
          />
          {onResetPanels ? (
            <Button
              variant="ghost"
              size="sm"
              className="group h-8 px-2"
              aria-label="Reset panels"
              onClick={onResetPanels}
            >
              <LayoutGrid className="size-3.5 shrink-0" />
              <HoverIconLabel>Reset panels</HoverIconLabel>
            </Button>
          ) : null}
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
          {showBilling && onManageBilling ? (
            <Button
              variant="ghost"
              size="sm"
              className="group h-8 px-2"
              aria-label="Billing"
              onClick={onManageBilling}
            >
              <CreditCard className="size-3.5 shrink-0" />
              <HoverIconLabel>Billing</HoverIconLabel>
            </Button>
          ) : null}
          {auth.authenticated ? (
            <Button
              variant="ghost"
              size="sm"
              className="group h-8 px-2"
              aria-label="Log out"
              title={auth.user?.email}
              onClick={onLogout}
            >
              <LogOut className="size-3.5 shrink-0" />
              <HoverIconLabel>Log out</HoverIconLabel>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="group h-8 px-2" asChild>
              <Link to="/login" aria-label="Sign in">
                <LogIn className="size-3.5 shrink-0" />
                <HoverIconLabel>Sign in</HoverIconLabel>
              </Link>
            </Button>
          )}
        </div>
      </div>

      <dl className="text-muted-foreground hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs md:flex">
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
          <span className="text-emerald-700 dark:text-emerald-400">{'<100'}</span>
          <span className="text-amber-700 dark:text-amber-400">100–299</span>
          <span className="text-red-700 dark:text-red-400">≥300</span>
          <span className="text-muted-foreground">ms</span>
        </div>
      </dl>
    </header>
  );
}
