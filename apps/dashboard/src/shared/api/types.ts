export type RouteAggregate = {
  key: string;
  count: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  p95ms: number;
};

export type OverviewResponse = {
  routes: RouteAggregate[];
  updatedAt: string;
};

export type RequestSpan = {
  name: string;
  durationMs: number;
  type: "db" | "cache" | "http" | "other";
  meta?: Record<string, string>;
};

export type RequestRecord = {
  method: string;
  route: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  requestId: string;
  spans?: RequestSpan[];
};

export type StressReport = {
  id: string;
  requestsPerSec: number;
  p50ms: number;
  p95ms: number;
  p99ms: number;
  errors: number;
  statusCodes: Record<string, number>;
  startedAt: string;
  finishedAt: string;
  routeSnapshot?: {
    key: string;
    count: number;
    p95ms: number;
    errors: number;
  };
};

export type StressInput = {
  target: string;
  method: string;
  path: string;
  connections: number;
  durationSec: number;
  headers?: Record<string, string>;
  body?: string;
};

export type AiChatTurn = { role: "user" | "assistant"; content: string };

export type AiConversation = {
  id: string;
  apiScope: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatInput = {
  message: string;
  history?: AiChatTurn[];
  intent?: "chat" | "explain_request" | "summarize_stress" | "suggest_fixes";
  requestId?: string;
  stressId?: string;
  conversationId?: string;
  apiScope?: string;
};
