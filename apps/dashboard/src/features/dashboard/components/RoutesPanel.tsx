import { Route } from 'lucide-react';

import { errorBadgeVariant } from '../utils/badges';
import type { RouteAggregate } from '@/shared/api/types';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { EmptyState } from '@/shared/components/EmptyState';
import { latencyTextClass } from '@/features/overview/lib/latency';
import { OverviewCharts } from '@/features/overview/components/OverviewCharts';
import { cn } from '@/shared/lib/utils';

type Props = {
  routes: RouteAggregate[];
  showToolTraffic: boolean;
  onShowToolTrafficChange: (checked: boolean) => void;
  className?: string;
};

export function RoutesPanel({
  routes,
  showToolTraffic,
  onShowToolTrafficChange,
  className
}: Props) {
  return (
    <section
      className={cn(
        'flex min-h-[22rem] min-w-0 flex-col gap-3 border-b border-border py-4 lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:pr-8',
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border pb-2">
        <h2 className="text-sm font-medium">Routes</h2>
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Checkbox
            checked={showToolTraffic}
            onCheckedChange={(v) => onShowToolTrafficChange(v === true)}
          />
          Tools
        </label>
      </div>
      {routes.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No routes yet"
          description="Hit your API (or run a load test) with the observability middleware mounted. Aggregates and p95 show up here."
          className="flex-1"
        />
      ) : (
        <>
          <div className="shrink-0 border-b border-border pb-3">
            <OverviewCharts routes={routes} />
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
                {routes.map((r) => (
                  <TableRow key={r.key} className="hover:bg-transparent">
                    <TableCell className="max-w-[14rem] truncate pl-0 font-mono text-xs">
                      {r.key}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{r.count}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
