import type { OverviewResponse, RequestRecord, StressReport } from '@/shared/api/types';

function isToolTraffic(routeOrPath: string): boolean {
  return (
    routeOrPath.includes('/observability') ||
    /^(GET|POST|DELETE|PUT|PATCH) \/(overview|requests|stress|history)(\/|$)/.test(
      routeOrPath
    )
  );
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtMs(n: number): string {
  return `${n.toFixed(2)} ms`;
}

export type AgentReportInput = {
  overview: OverviewResponse;
  requests: RequestRecord[];
  stressReports: StressReport[];
  /** When false (default), hide /observability tool traffic. */
  includeToolTraffic?: boolean;
};

/**
 * Build a plain markdown observability report meant to be pasted into
 * Cursor / Claude / ChatGPT / any coding agent.
 */
export function buildAgentReportMarkdown(input: AgentReportInput): string {
  const includeTool = input.includeToolTraffic === true;

  const routes = input.overview.routes
    .filter((r) => includeTool || !isToolTraffic(r.key))
    .slice()
    .sort((a, b) => b.p95ms - a.p95ms);

  const requests = input.requests
    .filter((r) => includeTool || (!isToolTraffic(r.route) && !isToolTraffic(r.path)))
    .slice(0, 40);

  const slow = routes.filter((r) => r.p95ms >= 100).slice(0, 10);
  const errorProne = routes
    .filter((r) => r.errorRate > 0)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 10);

  const recentErrors = requests.filter((r) => r.statusCode >= 400).slice(0, 15);

  const withSpans = requests.filter((r) => (r.spans?.length ?? 0) > 0).slice(0, 8);

  const stress = input.stressReports.slice(0, 5);

  const lines: string[] = [];

  lines.push('# API Observability Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Metrics as of: ${input.overview.updatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Routes tracked: **${routes.length}**`);
  lines.push(`- Recent app requests in buffer: **${requests.length}**`);
  lines.push(`- Routes with errors: **${errorProne.length}**`);
  lines.push(`- Routes with p95 ≥ 100ms: **${slow.length}**`);
  lines.push(`- Load tests recorded: **${input.stressReports.length}**`);
  lines.push('');

  if (slow.length > 0) {
    lines.push('## Slowest routes (by p95)');
    lines.push('');
    lines.push('| Route | Count | Error rate | Avg | p95 |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const r of slow) {
      lines.push(
        `| \`${r.key}\` | ${r.count} | ${pct(r.errorRate)} | ${fmtMs(r.avgMs)} | ${fmtMs(r.p95ms)} |`
      );
    }
    lines.push('');
  } else {
    lines.push('## Slowest routes (by p95)');
    lines.push('');
    lines.push('No routes with p95 ≥ 100ms in the current window.');
    lines.push('');
    if (routes.length > 0) {
      lines.push('Top by p95 anyway:');
      lines.push('');
      lines.push('| Route | Count | Error rate | Avg | p95 |');
      lines.push('| --- | ---: | ---: | ---: | ---: |');
      for (const r of routes.slice(0, 8)) {
        lines.push(
          `| \`${r.key}\` | ${r.count} | ${pct(r.errorRate)} | ${fmtMs(r.avgMs)} | ${fmtMs(r.p95ms)} |`
        );
      }
      lines.push('');
    }
  }

  if (errorProne.length > 0) {
    lines.push('## Error-prone routes');
    lines.push('');
    lines.push('| Route | Count | Errors | Error rate | p95 |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const r of errorProne) {
      lines.push(
        `| \`${r.key}\` | ${r.count} | ${r.errors} | ${pct(r.errorRate)} | ${fmtMs(r.p95ms)} |`
      );
    }
    lines.push('');
  }

  if (recentErrors.length > 0) {
    lines.push('## Recent failing requests');
    lines.push('');
    lines.push('| Time | Status | Duration | Route | Path | Request ID |');
    lines.push('| --- | ---: | ---: | --- | --- | --- |');
    for (const r of recentErrors) {
      lines.push(
        `| ${r.timestamp} | ${r.statusCode} | ${fmtMs(r.durationMs)} | \`${r.route}\` | \`${r.path}\` | \`${r.requestId}\` |`
      );
    }
    lines.push('');
  }

  if (withSpans.length > 0) {
    lines.push('## Request timing breakdown (spans)');
    lines.push('');
    for (const r of withSpans) {
      lines.push(`### \`${r.method} ${r.path}\` — ${fmtMs(r.durationMs)} (status ${r.statusCode})`);
      lines.push('');
      for (const s of r.spans ?? []) {
        const meta = s.meta
          ? ` (${Object.entries(s.meta)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')})`
          : '';
        lines.push(`- **${s.type}** \`${s.name}\`: ${fmtMs(s.durationMs)}${meta}`);
      }
      lines.push('');
    }
  }

  if (stress.length > 0) {
    lines.push('## Load test results');
    lines.push('');
    for (const s of stress) {
      lines.push(`### ${s.id}`);
      lines.push('');
      lines.push(`- Throughput: **${s.requestsPerSec.toFixed(1)} req/s**`);
      lines.push(`- Latency: p50 ${fmtMs(s.p50ms)}, p95 ${fmtMs(s.p95ms)}, p99 ${fmtMs(s.p99ms)}`);
      lines.push(`- Errors: **${s.errors}**`);
      lines.push(
        `- Status codes: ${Object.entries(s.statusCodes)
          .map(([code, n]) => `${code}×${n}`)
          .join(', ')}`
      );
      if (s.routeSnapshot) {
        lines.push(
          `- Route snapshot: \`${s.routeSnapshot.key}\` count=${s.routeSnapshot.count}, p95=${fmtMs(s.routeSnapshot.p95ms)}, errors=${s.routeSnapshot.errors}`
        );
      }
      lines.push(`- Window: ${s.startedAt} → ${s.finishedAt}`);
      lines.push('');
    }
  } else {
    lines.push('## Load test results');
    lines.push('');
    lines.push('No load tests recorded yet.');
    lines.push('');
  }

  lines.push('## Full route table');
  lines.push('');
  if (routes.length === 0) {
    lines.push('No routes recorded yet. Hit the API, then regenerate.');
    lines.push('');
  } else {
    lines.push('| Route | Count | Errors | Error rate | Avg | p95 |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const r of routes) {
      lines.push(
        `| \`${r.key}\` | ${r.count} | ${r.errors} | ${pct(r.errorRate)} | ${fmtMs(r.avgMs)} | ${fmtMs(r.p95ms)} |`
      );
    }
    lines.push('');
  }

  lines.push('## Notes for the coding agent');
  lines.push('');
  lines.push(
    '- Prefer evidence in this report over guesses. If data is thin, say what to measure next.'
  );
  lines.push(
    '- Suggest concrete fixes (indexes, caching, N+1, rate limits, auth mistakes) tied to routes/spans above.'
  );
  lines.push('- Tool/dashboard traffic under `/observability` is excluded unless noted.');
  lines.push('');

  return lines.join('\n');
}

/** Prompt wrapper so paste into an agent is immediately actionable. */
export function buildAgentPastePayload(reportMarkdown: string): string {
  return [
    'You are a senior backend engineer reviewing API observability results.',
    '',
    'Using ONLY the report below:',
    '1. Rank the top 3 problems (latency, errors, or load-test regressions).',
    '2. For each, propose a concrete fix with where to change code.',
    '3. Call out any missing measurements you would want next.',
    '4. Keep the answer short and actionable.',
    '',
    '----- BEGIN OBSERVABILITY REPORT -----',
    reportMarkdown.trim(),
    '----- END OBSERVABILITY REPORT -----'
  ].join('\n');
}
