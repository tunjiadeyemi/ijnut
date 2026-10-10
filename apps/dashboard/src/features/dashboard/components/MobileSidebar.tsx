import { useEffect } from 'react';
import {
  Activity,
  Bot,
  CreditCard,
  Eraser,
  LogIn,
  LogOut,
  RefreshCw,
  Route,
  ScrollText,
  X
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

import type { OverviewResponse, RequestRecord, StressReport } from '@/shared/api/types';
import { Button } from '@/shared/components/ui/button';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { AgentReportCopyButton } from '@/features/ai/components/AgentReportPanel';
import { cn } from '@/shared/lib/utils';

export type MobileSection = 'metrics' | 'ask' | 'history' | 'load';

const SECTIONS: {
  id: MobileSection;
  label: string;
  hint: string;
  icon: typeof Route;
}[] = [
  { id: 'metrics', label: 'Metrics', hint: 'Routes & KPIs', icon: Route },
  { id: 'ask', label: 'Ask', hint: 'Cloud AI', icon: Bot },
  { id: 'history', label: 'History', hint: 'Recent requests', icon: ScrollText },
  { id: 'load', label: 'Load', hint: 'Stress tests', icon: Activity }
];

type AuthSummary = {
  authenticated: boolean;
  user: { name: string; email: string } | null;
};

type Props = {
  open: boolean;
  section: MobileSection;
  overview: OverviewResponse;
  requests: RequestRecord[];
  stressReports: StressReport[];
  showToolTraffic: boolean;
  clearDisabled: boolean;
  auth: AuthSummary;
  showBilling?: boolean;
  onClose: () => void;
  onSectionChange: (section: MobileSection) => void;
  onRefresh: () => void;
  onClear: () => void;
  onLogout: () => void;
  onManageBilling?: () => void;
};

export function MobileSidebar({
  open,
  section,
  overview,
  requests,
  stressReports,
  showToolTraffic,
  clearDisabled,
  auth,
  showBilling,
  onClose,
  onSectionChange,
  onRefresh,
  onClear,
  onLogout,
  onManageBilling
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn('fixed inset-0 z-50 lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          'absolute inset-0 bg-background/70 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard sections"
        className={cn(
          'border-border bg-background absolute inset-y-0 left-0 flex w-[min(18.5rem,88vw)] flex-col border-r shadow-lg transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
          <p className="text-sm font-semibold tracking-tight">Sections</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Sections">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  onSectionChange(item.id);
                  onClose();
                }}
              >
                <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground block text-[11px]">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-border flex flex-col gap-0.5 border-t p-2">
          <div className="flex items-center gap-1 px-1 py-1">
            <ThemeToggle />
            <AgentReportCopyButton
              overview={overview}
              requests={requests}
              stressReports={stressReports}
              includeToolTraffic={showToolTraffic}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 justify-start px-3"
            onClick={() => {
              onRefresh();
              onClose();
            }}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 justify-start px-3"
            disabled={clearDisabled}
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            <Eraser className="size-3.5" />
            Clear history
          </Button>
          {showBilling && onManageBilling ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start px-3"
              onClick={() => {
                onManageBilling();
                onClose();
              }}
            >
              <CreditCard className="size-3.5" />
              Billing
            </Button>
          ) : null}
          {auth.authenticated ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start px-3"
              title={auth.user?.email}
              onClick={() => {
                onLogout();
                onClose();
              }}
            >
              <LogOut className="size-3.5" />
              Log out
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 justify-start px-3"
              asChild
            >
              <Link to="/login" onClick={onClose}>
                <LogIn className="size-3.5" />
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

export function mobileSectionLabel(section: MobileSection): string {
  return SECTIONS.find((s) => s.id === section)?.label ?? 'Metrics';
}
