import { Fragment, useState } from 'react';
import { ScrollText } from 'lucide-react';

import { statusBadgeVariant } from '../utils/badges';
import type { RequestRecord, RequestSpan } from '@/shared/api/types';

import { Badge } from '@/shared/components/ui/badge';
import { EmptyState } from '@/shared/components/EmptyState';
import { latencyTextClass } from '@/features/overview/lib/latency';
import { Table, TableBody, TableCell, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/utils';

type Props = {
  requests: RequestRecord[];
  className?: string;
};

function spanSummary(spans: RequestSpan[] | undefined): string | null {
  if (!spans?.length) return null;
  const db = spans.filter((s) => s.type === 'db').length;
  const cache = spans.filter((s) => s.type === 'cache').length;
  const parts: string[] = [];
  if (db) parts.push(`${db} sql`);
  if (cache) parts.push(`${cache} cache`);
  const other = spans.length - db - cache;
  if (other > 0) parts.push(`${other} other`);
  return parts.join(' · ');
}

function SpanBreakdown({ spans }: { spans: RequestSpan[] }) {
  const ordered = [...spans].sort((a, b) => b.durationMs - a.durationMs);
  return (
    <ul className="space-y-1.5 font-mono text-[11px] leading-relaxed">
      {ordered.map((s, i) => (
        <li key={`${s.name}-${i}`} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <span className={`shrink-0 tabular-nums ${latencyTextClass(s.durationMs)}`}>
            {Math.round(s.durationMs)}ms
          </span>
          <span className="text-muted-foreground shrink-0 uppercase">{s.type}</span>
          <span className="min-w-0 break-all text-foreground/90">
            {s.meta?.sql ?? s.name}
            {s.meta?.rowCount != null ? (
              <span className="text-muted-foreground"> · rows {s.meta.rowCount}</span>
            ) : null}
            {s.meta?.error === '1' ? (
              <span className="text-destructive"> · error</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RequestHistory({ requests, className }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section
      className={cn(
        'flex min-h-[14rem] min-w-0 flex-col gap-2 border-b border-border py-3 sm:min-h-[16rem] sm:py-4 lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:pr-6 xl:pr-8',
        className
      )}
    >
      <h2 className="shrink-0 border-b border-border pb-2 text-sm font-medium">History</h2>
      {requests.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No requests yet"
          description="Recent calls appear here with status and latency. Expand a row to see SQL and cache spans when instrumented."
          className="flex-1"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto max-h-none lg:max-h-none">
          <Table className="min-w-[16rem]">
            <TableBody>
              {requests.slice(0, 20).map((r) => {
                const rowKey = r.requestId + r.timestamp;
                const hasSpans = (r.spans?.length ?? 0) > 0;
                const open = openId === rowKey;
                const summary = spanSummary(r.spans);

                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      className={
                        hasSpans
                          ? 'hover:bg-muted/40 cursor-pointer'
                          : 'hover:bg-transparent'
                      }
                      onClick={() => {
                        if (!hasSpans) return;
                        setOpenId(open ? null : rowKey);
                      }}
                    >
                      <TableCell className="w-14 pl-0">
                        <Badge
                          variant={statusBadgeVariant(r.statusCode)}
                          className="font-mono text-[10px]"
                        >
                          {r.statusCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[8rem] sm:max-w-[12rem]">
                        <div className="truncate font-mono text-xs">{r.path}</div>
                        {summary ? (
                          <div className="text-muted-foreground truncate text-[10px]">
                            {summary}
                            {hasSpans ? (open ? ' · hide' : ' · spans') : null}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={`pr-0 text-right font-mono text-xs tabular-nums ${latencyTextClass(r.durationMs)}`}
                      >
                        {Math.round(r.durationMs)}
                      </TableCell>
                    </TableRow>
                    {open && r.spans?.length ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={3} className="bg-muted/20 px-0 pb-3 pt-0">
                          <SpanBreakdown spans={r.spans} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
