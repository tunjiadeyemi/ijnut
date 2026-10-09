import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { latencyLevel } from '@/features/overview/lib/latency';
import type { RouteAggregate } from '@/features/overview/functions';
import { useTheme } from '@/shared/components/ThemeProvider';

const BAR_FILL: Record<'ok' | 'warn' | 'high' | 'none', string> = {
  ok: 'oklch(0.55 0.14 155)',
  warn: 'oklch(0.72 0.14 75)',
  high: 'oklch(0.58 0.2 25)',
  none: 'oklch(0.55 0.08 160)'
};

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function OverviewCharts({ routes }: { routes: RouteAggregate[] }) {
  const { resolved } = useTheme();
  const top = [...routes]
    .sort((a, b) => b.p95ms - a.p95ms)
    .slice(0, 6)
    .map((r) => ({
      name: r.key.length > 14 ? `${r.key.slice(0, 12)}…` : r.key,
      full: r.key,
      p95: Number(r.p95ms.toFixed(1))
    }));

  if (top.length === 0) return null;

  const grid = cssVar('--chart-grid', 'oklch(0.9 0.01 160)');
  const tick = cssVar('--chart-tick', 'oklch(0.5 0.02 160)');
  const axis = cssVar('--chart-axis', 'oklch(0.88 0.01 160)');
  const cursor = cssVar('--chart-cursor', 'oklch(0.95 0.01 160)');
  const tipBorder = cssVar('--chart-tooltip-border', 'oklch(0.9 0.01 160)');
  const tipBg = cssVar('--card', 'oklch(1 0 0)');
  const tipFg = cssVar('--card-foreground', 'oklch(0.22 0.02 160)');

  return (
    <div key={resolved} className="h-36 w-full min-w-0 sm:h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: tick }}
            axisLine={{ stroke: axis }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: tick }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: cursor }}
            formatter={(value) => [`${value} ms`, 'p95']}
            labelFormatter={(_, payload) => String(payload?.[0]?.payload?.full ?? '')}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${tipBorder}`,
              background: tipBg,
              color: tipFg,
              fontSize: 12
            }}
          />
          <Bar dataKey="p95" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {top.map((entry) => (
              <Cell key={entry.full} fill={BAR_FILL[latencyLevel(entry.p95)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
