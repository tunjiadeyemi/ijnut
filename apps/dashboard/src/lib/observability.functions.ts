import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  setCookie,
} from "@tanstack/react-start/server";
import {
  ADMIN_COOKIE,
  getSessionToken,
  obsFetch,
  validateAdminToken,
} from "./observability.server";

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

export const getAuthState = createServerFn({ method: "GET" }).handler(
  async () => ({ authenticated: Boolean(getSessionToken()) }),
);

/**
 * Validate key against demo-api (401 if wrong), then set httpOnly cookie.
 * Key is never returned to the client in JSON — only stored as cookie.
 */
export const loginWithAdminKey = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const token = data.token?.trim();
    if (!token) {
      return { ok: false as const, message: "Please enter your admin password" };
    }

    const valid = await validateAdminToken(token);
    if (!valid) {
      return {
        ok: false as const,
        message: "Wrong password. Check ADMIN_TOKEN in your .env file.",
      };
    }

    setCookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      // Opt-in: local / Docker HTTP needs insecure cookies
      secure: process.env.COOKIE_SECURE === "true",
    });

    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(ADMIN_COOKIE, { path: "/" });
  return { ok: true as const };
});

export const fetchOverview = createServerFn({ method: "GET" }).handler(
  async () => obsFetch<OverviewResponse>("/observability/overview"),
);

export const fetchRequests = createServerFn({ method: "GET" })
  .validator((data: { limit?: number; status?: number; path?: string }) => data)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    params.set("limit", String(data.limit ?? 50));
    if (data.status != null) params.set("status", String(data.status));
    if (data.path) params.set("path", data.path);
    return obsFetch<{ requests: RequestRecord[] }>(
      `/observability/requests?${params}`,
    );
  });

export const fetchStressReports = createServerFn({ method: "GET" }).handler(
  async () => obsFetch<{ reports: StressReport[] }>("/observability/stress"),
);

export const clearHistory = createServerFn({ method: "POST" }).handler(
  async () =>
    obsFetch<{ ok: boolean; clearedAt: string }>("/observability/history", {
      method: "DELETE",
    }),
);

export const runStressTest = createServerFn({ method: "POST" })
  .validator((data: StressInput) => data)
  .handler(async ({ data }) => {
    try {
      return await obsFetch<StressReport>("/observability/stress", {
        method: "POST",
        body: JSON.stringify({
          target: data.target,
          method: data.method,
          path: data.path,
          connections: data.connections,
          durationSec: data.durationSec,
          headers: data.headers,
          body: data.body,
        }),
      });
    } catch (err) {
      const e = err as Error & { status?: number; body?: unknown };
      return {
        error: true as const,
        status: e.status ?? 500,
        message: e.message,
        body: e.body,
      };
    }
  });

export type AiChatTurn = { role: "user" | "assistant"; content: string };

export type AiChatInput = {
  message: string;
  history?: AiChatTurn[];
  /** Optional focus: explain one request, summarize a stress id, etc. */
  intent?: "chat" | "explain_request" | "summarize_stress" | "suggest_fixes";
  requestId?: string;
  stressId?: string;
};

export const getAiStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isGeminiConfigured } = await import("./gemini.server");
    return { configured: isGeminiConfigured() };
  },
);

export const askObservabilityAi = createServerFn({ method: "POST" })
  .validator((data: AiChatInput) => data)
  .handler(async ({ data }) => {
    try {
      const { AI_SYSTEM_PROMPT, chatWithGemini } = await import(
        "./gemini.server"
      );


      const [overview, requestsPayload, stressPayload] = await Promise.all([
        obsFetch<OverviewResponse>("/observability/overview"),
        obsFetch<{ requests: RequestRecord[] }>(
          "/observability/requests?limit=40",
        ),
        obsFetch<{ reports: StressReport[] }>("/observability/stress"),
      ]);

      // Hide tool traffic from AI context by default (same idea as UI)
      const appRequests = requestsPayload.requests.filter(
        (r) => !r.path.includes("/observability"),
      );
      const appRoutes = overview.routes.filter(
        (r) => !r.key.includes("/observability"),
      );

      let focusNote = "";
      if (data.intent === "explain_request" && data.requestId) {
        const req = appRequests.find((r) => r.requestId === data.requestId);
        focusNote = req
          ? `User wants an explanation of this request:\n${JSON.stringify(req, null, 2)}`
          : `User asked to explain requestId=${data.requestId} but it was not in the recent buffer.`;
      } else if (data.intent === "summarize_stress") {
        const report =
          (data.stressId &&
            stressPayload.reports.find((r) => r.id === data.stressId)) ||
          stressPayload.reports[0];
        focusNote = report
          ? `User wants a plain-language summary of this load test:\n${JSON.stringify(report, null, 2)}`
          : "User asked to summarize a load test, but no stress reports exist yet.";
      } else if (data.intent === "suggest_fixes") {
        focusNote =
          "User wants practical fix suggestions based on the metrics below (errors, slow p95, cache vs db if spans exist).";
      }

      const context = {
        updatedAt: overview.updatedAt,
        routes: appRoutes.slice(0, 25),
        recentRequests: appRequests.slice(0, 25),
        stressReports: stressPayload.reports.slice(0, 5),
      };

      const history = (data.history ?? []).slice(-8).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const reply = await chatWithGemini([

        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Live metrics context (JSON):\n${JSON.stringify(context)}\n\n${focusNote}`,
        },
        ...history,
        { role: "user", content: data.message },
      ]);

      return { ok: true as const, reply };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "AI request failed",
      };
    }
  });
