import { Injectable } from "@nestjs/common";
import type { MetricsStore } from "@api-obs/observability";
import {
  AI_SYSTEM_PROMPT,
  chatWithAi,
  isAiConfigured,
  resolveAiProvider,
  type ChatMessage,
} from "./ai-provider";
import {
  appendChatExchange,
  createConversation,
  getOwnedConversation,
  getOrCreateLatestConversation,
  listConversations,
  loadChatHistory,
  normalizeApiScope,
  type AiConversation,
} from "./ai-chat-memory";
import {
  consumeAiMessage,
  getAiFreeLimit,
  getIjnutMode,
  resolveAiAccess,
  type AiAccess,
} from "./ai-quota";

/** Optional metrics snapshot from the caller's local API (Cloud AI sidecar). */
export type AiMetricsContext = {
  updatedAt?: string;
  routes?: unknown[];
  recentRequests?: unknown[];
  stressReports?: unknown[];
  /** Slowest db spans with SQL text (from caller's local API). */
  slowQueries?: unknown[];
  /** Same SQL shape repeated many times on one request (possible N+1). */
  repeatedSql?: unknown[];
};

export type AiChatBody = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  intent?: "chat" | "explain_request" | "summarize_stress" | "suggest_fixes";
  requestId?: string;
  stressId?: string;
  /** When set (dashboard → Cloud AI), used instead of this process's MetricsStore. */
  context?: AiMetricsContext;
  /** Active conversation (Cloud memory). */
  conversationId?: string;
  /** Normalized OBSERVABILITY_API_URL bucket. */
  apiScope?: string;
};

export type AiStatusResponse = {
  configured: boolean;
  provider: ReturnType<typeof resolveAiProvider>;
  mode: ReturnType<typeof getIjnutMode>;
  authenticated: boolean;
  needsAuth: boolean;
  plan: AiAccess["plan"];
  gated: boolean;
  limit: number | null;
  remaining: number | null;
  aiUsed: number;
};

export type AiChatResponse =
  | {
      ok: true;
      reply: string;
      remaining: number | null;
      conversationId?: string;
      title?: string | null;
    }
  | {
      ok: false;
      gated: boolean;
      needsAuth?: boolean;
      message: string;
      remaining?: number;
      cta?: {
        upgrade: string;
        selfHost: string;
        signIn: string;
      };
    };

const DEFAULT_GATE_CTA = {
  upgrade: "Subscribe for unlimited Cloud AI + chat memory via Bachs.",
  selfHost:
    "Or self-host AI: set GEMINI_API_KEY or COHERE_API_KEY on your local API (IJNUT_MODE=selfhost) — no IJNUT fees.",
  signIn: "Sign in to use Cloud AI (includes chat memory; 3 free messages).",
};

@Injectable()
export class AiService {
  status(access: AiAccess): AiStatusResponse {
    return {
      configured: isAiConfigured(),
      provider: resolveAiProvider(),
      mode: getIjnutMode(),
      authenticated: access.authenticated,
      needsAuth: access.needsAuth,
      plan: access.plan,
      gated: access.gated,
      limit: access.limit,
      remaining: access.remaining,
      aiUsed: access.aiUsed,
    };
  }

  async resolveAccess(sessionToken: string | undefined): Promise<AiAccess> {
    return resolveAiAccess(sessionToken);
  }

  async listConversations(
    sessionToken: string | undefined,
    apiScope: string | undefined,
  ): Promise<
    | { ok: true; conversations: AiConversation[]; apiScope: string }
    | { ok: false; needsAuth: true; message: string }
  > {
    const access = await resolveAiAccess(sessionToken);
    if (!access.userId) {
      return {
        ok: false,
        needsAuth: true,
        message: "Sign in to load Cloud AI conversations.",
      };
    }
    const scope = normalizeApiScope(apiScope);
    try {
      const conversations = await listConversations(access.userId, scope, 20);
      return { ok: true, conversations, apiScope: scope };
    } catch (err) {
      console.error("[ai] list conversations failed", err);
      return { ok: true, conversations: [], apiScope: scope };
    }
  }

  async createConversation(
    sessionToken: string | undefined,
    apiScope: string | undefined,
  ): Promise<
    | { ok: true; conversation: AiConversation }
    | { ok: false; needsAuth?: true; message: string }
  > {
    const access = await resolveAiAccess(sessionToken);
    if (!access.userId) {
      return {
        ok: false,
        needsAuth: true,
        message: "Sign in to start a Cloud AI conversation.",
      };
    }
    try {
      const conversation = await createConversation(
        access.userId,
        normalizeApiScope(apiScope),
      );
      return { ok: true, conversation };
    } catch (err) {
      console.error("[ai] create conversation failed", err);
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : "Could not create conversation",
      };
    }
  }

  async history(
    sessionToken: string | undefined,
    conversationId: string | undefined,
    apiScope: string | undefined,
  ): Promise<
    | {
        ok: true;
        messages: Array<{ role: "user" | "assistant"; content: string }>;
        conversationId: string | null;
      }
    | { ok: false; needsAuth: true; message: string }
  > {
    const access = await resolveAiAccess(sessionToken);
    if (!access.userId) {
      return {
        ok: false,
        needsAuth: true,
        message: "Sign in to load Cloud AI chat memory.",
      };
    }
    try {
      let convId = conversationId?.trim() || null;
      if (!convId && apiScope) {
        const latest = await getOrCreateLatestConversation(
          access.userId,
          apiScope,
        );
        convId = latest.id;
      }
      if (!convId) {
        return { ok: true, messages: [], conversationId: null };
      }
      const owned = await getOwnedConversation(
        access.userId,
        convId,
        apiScope,
      );
      if (!owned) {
        return { ok: true, messages: [], conversationId: null };
      }
      const rows = await loadChatHistory(access.userId, owned.id, 40);
      return {
        ok: true,
        conversationId: owned.id,
        messages: rows.map((r) => ({ role: r.role, content: r.content })),
      };
    } catch (err) {
      console.error("[ai] load history failed", err);
      return { ok: true, messages: [], conversationId: null };
    }
  }

  async chat(
    store: MetricsStore,
    body: AiChatBody,
    sessionToken: string | undefined,
  ): Promise<AiChatResponse> {
    if (!isAiConfigured()) {
      return {
        ok: false,
        gated: false,
        message:
          "No AI provider configured. Set AI_PROVIDER=gemini|cohere and GEMINI_API_KEY or COHERE_API_KEY on the API.",
      };
    }

    const access = await resolveAiAccess(sessionToken);
    const mode = getIjnutMode();

    // Cloud AI always requires a signed-in user (quota + memory).
    if (mode === "cloud" && !access.userId) {
      return {
        ok: false,
        gated: true,
        needsAuth: true,
        message: "Sign in to use Cloud AI (chat memory + free tier).",
        cta: { ...DEFAULT_GATE_CTA },
        remaining: 0,
      };
    }

    if (!access.canConsume) {
      if (access.needsAuth) {
        return {
          ok: false,
          gated: true,
          needsAuth: true,
          message: "Sign in to use Cloud AI (3 free messages).",
          cta: { ...DEFAULT_GATE_CTA },
          remaining: 0,
        };
      }
      return {
        ok: false,
        gated: true,
        needsAuth: false,
        message: `Free AI limit reached (${access.limit} messages). Subscribe or self-host with your own API key.`,
        cta: { ...DEFAULT_GATE_CTA },
        remaining: 0,
      };
    }

    const message = body.message?.trim();
    if (!message) {
      return { ok: false, gated: false, message: "message is required" };
    }

    let conversation: AiConversation | null = null;
    if (mode === "cloud" && access.userId) {
      const scope = normalizeApiScope(body.apiScope);
      const convId = body.conversationId?.trim();
      if (!convId) {
        return {
          ok: false,
          gated: false,
          message: "conversationId is required for Cloud AI chat memory",
        };
      }
      conversation = await getOwnedConversation(access.userId, convId, scope);
      if (!conversation) {
        return {
          ok: false,
          gated: false,
          message: "Conversation not found or apiScope mismatch",
        };
      }
    }

    let remaining = access.remaining;
    if (access.gated && access.plan === "free" && access.userId) {
      const consumed = await consumeAiMessage(access.userId, getAiFreeLimit());
      if (!consumed) {
        return {
          ok: false,
          gated: true,
          needsAuth: false,
          message: `Free AI limit reached (${access.limit} messages). Subscribe or self-host with your own API key.`,
          cta: { ...DEFAULT_GATE_CTA },
          remaining: 0,
        };
      }
      remaining = consumed.remaining;
    }

    const context = this.buildContext(store, body);
    const focusNote = this.focusNote(body, context);

    // Prefer server memory (Cloud); fall back to client-sent history.
    let history = (body.history ?? []).slice(-8);
    if (mode === "cloud" && access.userId && conversation) {
      try {
        const stored = await loadChatHistory(
          access.userId,
          conversation.id,
          16,
        );
        if (stored.length > 0) {
          history = stored.map((t) => ({
            role: t.role,
            content: t.content,
          }));
        }
      } catch (err) {
        console.error("[ai] memory load failed; using client history", err);
      }
    }

    const messages: ChatMessage[] = [
      { role: "system", content: AI_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Live metrics context (JSON):\n${JSON.stringify(context)}\n\n${focusNote}`,
      },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    try {
      const reply = await chatWithAi(messages);

      if (mode === "cloud" && access.userId && conversation) {
        void appendChatExchange(
          access.userId,
          conversation.id,
          message,
          reply,
        ).catch((err) => console.error("[ai] memory persist failed", err));
      }

      return {
        ok: true,
        reply,
        remaining,
        conversationId: conversation?.id,
        title: conversation?.title,
      };
    } catch (err) {
      return {
        ok: false,
        gated: false,
        message: err instanceof Error ? err.message : "AI request failed",
      };
    }
  }

  private buildContext(store: MetricsStore, body: AiChatBody) {
    if (body.context && typeof body.context === "object") {
      return {
        updatedAt: body.context.updatedAt ?? new Date().toISOString(),
        routes: (body.context.routes ?? []).slice(0, 25),
        recentRequests: (body.context.recentRequests ?? []).slice(0, 25),
        stressReports: (body.context.stressReports ?? []).slice(0, 5),
        slowQueries: (body.context.slowQueries ?? []).slice(0, 20),
        repeatedSql: (body.context.repeatedSql ?? []).slice(0, 10),
      };
    }

    const overview = store.getOverview("p95ms");
    const requests = store.getRecentRequests({ limit: 40 });
    const stressReports = store.listStressReports();
    const appRequests = requests.filter((r) => !r.path.includes("/observability"));
    const appRoutes = overview.routes.filter(
      (r) => !r.key.includes("/observability"),
    );
    const { slowQueries, repeatedSql } = extractSqlInsights(appRequests);

    return {
      updatedAt: overview.updatedAt,
      routes: appRoutes.slice(0, 25),
      recentRequests: appRequests.slice(0, 25),
      stressReports: stressReports.slice(0, 5),
      slowQueries,
      repeatedSql,
    };
  }

  private focusNote(body: AiChatBody, context: ReturnType<AiService["buildContext"]>) {
    const requests = (context.recentRequests ?? []) as Array<{
      requestId?: string;
    }>;
    const stressReports = (context.stressReports ?? []) as Array<{ id?: string }>;

    if (body.intent === "explain_request" && body.requestId) {
      const req = requests.find((r) => r.requestId === body.requestId);
      return req
        ? `User wants an explanation of this request (call out db/SQL spans and whether they dominate latency):\n${JSON.stringify(req, null, 2)}`
        : `User asked to explain requestId=${body.requestId} but it was not in the recent buffer.`;
    }
    if (body.intent === "summarize_stress") {
      const report =
        (body.stressId && stressReports.find((r) => r.id === body.stressId)) ||
        stressReports[0];
      return report
        ? `User wants a plain-language summary of this load test:\n${JSON.stringify(report, null, 2)}`
        : "User asked to summarize a load test, but no stress reports exist yet.";
    }
    if (body.intent === "suggest_fixes") {
      return "User wants practical fix and system-design suggestions based on the metrics below. Prioritize slowQueries / repeatedSql (N+1), then route p95 and errors. Suggest indexes, caching, batching, or schema changes only when evidence supports them. End with an ## Agent brief section the user can copy for their coding agent. Do not offer to implement the changes yourself.";
    }
    return "";
  }
}

type SpanLike = {
  name?: string;
  type?: string;
  durationMs?: number;
  meta?: Record<string, string>;
};

type RequestLike = {
  requestId?: string;
  route?: string;
  path?: string;
  spans?: SpanLike[];
};

function extractSqlInsights(requests: RequestLike[]) {
  const slowQueries: Array<{
    sql: string;
    op?: string;
    durationMs: number;
    name: string;
    route?: string;
    path?: string;
    requestId?: string;
    rowCount?: string;
  }> = [];
  const repeatedSql: Array<{
    sql: string;
    count: number;
    totalMs: number;
    requestId?: string;
    path?: string;
  }> = [];

  for (const r of requests) {
    const sqlCounts = new Map<string, { count: number; totalMs: number }>();
    for (const s of r.spans ?? []) {
      if (s.type !== "db") continue;
      const sql = s.meta?.sql?.trim();
      if (!sql || typeof s.durationMs !== "number") continue;
      slowQueries.push({
        sql,
        op: s.meta?.op,
        durationMs: s.durationMs,
        name: s.name ?? "db",
        route: r.route,
        path: r.path,
        requestId: r.requestId,
        rowCount: s.meta?.rowCount,
      });
      const cur = sqlCounts.get(sql) ?? { count: 0, totalMs: 0 };
      cur.count += 1;
      cur.totalMs += s.durationMs;
      sqlCounts.set(sql, cur);
    }
    for (const [sql, v] of sqlCounts) {
      if (v.count >= 4) {
        repeatedSql.push({
          sql,
          count: v.count,
          totalMs: v.totalMs,
          requestId: r.requestId,
          path: r.path,
        });
      }
    }
  }

  slowQueries.sort((a, b) => b.durationMs - a.durationMs);
  repeatedSql.sort((a, b) => b.count - a.count);

  return {
    slowQueries: slowQueries.slice(0, 20),
    repeatedSql: repeatedSql.slice(0, 10),
  };
}
