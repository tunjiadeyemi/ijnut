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
  consumeAiMessage,
  getAiFreeLimit,
  getIjnutMode,
  resolveAiAccess,
  type AiAccess,
} from "./ai-quota";

export type AiChatBody = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  intent?: "chat" | "explain_request" | "summarize_stress" | "suggest_fixes";
  requestId?: string;
  stressId?: string;
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
  upgrade: "Subscribe on IJNUT Cloud for unlimited AI via Bachs.",
  selfHost:
    "Or self-host: docker compose up --build, set GEMINI_API_KEY or COHERE_API_KEY on the API — no IJNUT fees.",
  signIn: "Sign in to unlock 3 free AI messages on Cloud.",
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

    if (!access.canConsume) {
      if (access.needsAuth) {
        return {
          ok: false,
          gated: true,
          needsAuth: true,
          message: "Sign in to use AI on IJNUT Cloud (3 free messages).",
          cta: { ...DEFAULT_GATE_CTA },
          remaining: 0,
        };
      }
      return {
        ok: false,
        gated: true,
        needsAuth: false,
        message: `Free AI limit reached (${access.limit} messages). Subscribe or self-host with your own Gemini key.`,
        cta: { ...DEFAULT_GATE_CTA },
        remaining: 0,
      };
    }

    const message = body.message?.trim();
    if (!message) {
      return { ok: false, gated: false, message: "message is required" };
    }

    // Consume quota BEFORE calling Gemini so concurrent requests cannot overspend.
    let remaining = access.remaining;
    if (access.gated && access.plan === "free" && access.userId) {
      const consumed = await consumeAiMessage(access.userId, getAiFreeLimit());
      if (!consumed) {
        return {
          ok: false,
          gated: true,
          needsAuth: false,
          message: `Free AI limit reached (${access.limit} messages). Subscribe or self-host with your own Gemini key.`,
          cta: { ...DEFAULT_GATE_CTA },
          remaining: 0,
        };
      }
      remaining = consumed.remaining;
    }

    const overview = store.getOverview("p95ms");
    const requests = store.getRecentRequests({ limit: 40 });
    const stressReports = store.listStressReports();

    const appRequests = requests.filter((r) => !r.path.includes("/observability"));
    const appRoutes = overview.routes.filter(
      (r) => !r.key.includes("/observability"),
    );

    let focusNote = "";
    if (body.intent === "explain_request" && body.requestId) {
      const req = appRequests.find((r) => r.requestId === body.requestId);
      focusNote = req
        ? `User wants an explanation of this request:\n${JSON.stringify(req, null, 2)}`
        : `User asked to explain requestId=${body.requestId} but it was not in the recent buffer.`;
    } else if (body.intent === "summarize_stress") {
      const report =
        (body.stressId && stressReports.find((r) => r.id === body.stressId)) ||
        stressReports[0];
      focusNote = report
        ? `User wants a plain-language summary of this load test:\n${JSON.stringify(report, null, 2)}`
        : "User asked to summarize a load test, but no stress reports exist yet.";
    } else if (body.intent === "suggest_fixes") {
      focusNote =
        "User wants practical fix suggestions based on the metrics below (errors, slow p95, cache vs db if spans exist).";
    }

    const context = {
      updatedAt: overview.updatedAt,
      routes: appRoutes.slice(0, 25),
      recentRequests: appRequests.slice(0, 25),
      stressReports: stressReports.slice(0, 5),
    };

    const history = (body.history ?? []).slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const messages: ChatMessage[] = [
      { role: "system", content: AI_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Live metrics context (JSON):\n${JSON.stringify(context)}\n\n${focusNote}`,
      },
      ...history,
      { role: "user", content: message },
    ];

    try {
      const reply = await chatWithAi(messages);
      return { ok: true, reply, remaining };
    } catch (err) {
      return {
        ok: false,
        gated: false,
        message: err instanceof Error ? err.message : "AI request failed",
      };
    }
  }
}
