import { statusBadgeVariant } from '../utils/badges';
import type { RequestRecord } from '@/shared/api/types';

import { Badge } from '@/shared/components/ui/badge';
import { latencyTextClass } from '@/features/overview/lib/latency';
import { Table, TableBody, TableCell, TableRow } from '@/shared/components/ui/table';

type Props = {
  requests: RequestRecord[];
};

export function RequestHistory({ requests }: Props) {
  return (
    <section className="flex min-h-[16rem] min-w-0 flex-col gap-2 border-b border-border py-4 lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:pr-8">
      <h2 className="shrink-0 border-b border-border pb-2 text-sm font-medium">History</h2>
      <div className="max-h-64 min-h-0 flex-1 overflow-auto lg:max-h-none">
        <Table>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground pl-0">—</TableCell>
              </TableRow>
            ) : (
              requests.slice(0, 20).map((r) => (
                <TableRow key={r.requestId + r.timestamp} className="hover:bg-transparent">
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
  );
}
