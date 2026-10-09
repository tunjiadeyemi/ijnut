import { createServerFn } from '@tanstack/react-start';

import type {
  AiChatInput,
  OverviewResponse,
  RequestRecord,
  StressReport
} from '@/shared/api/types';
import { obsFetch } from '@/shared/api/client.server';

export type { AiChatInput, AiChatTurn } from '@/shared/api/types';

export const getAiStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { isGeminiConfigured } = await import('./server/gemini.server');
  const { DEFAULT_GATE_CTA, getIjnutMode } = await import('@/features/config/server');
  const { getSession, resolveAiAccess } = await import('./server/ai-quota.server');
  const { isBachsConfigured } = await import('@/features/billing/server/bachs.server');

  const session = await getSession();
  const access = await resolveAiAccess(session);

  return {
    configured: isGeminiConfigured(),
    mode: getIjnutMode(),
    authenticated: access.authenticated,
    needsAuth: access.needsAuth,
    plan: access.plan,
    gated: access.gated,
    limit: access.limit,
    remaining: access.remaining,
    aiUsed: access.aiUsed,
    billingConfigured: isBachsConfigured(),
    cta: { ...DEFAULT_GATE_CTA }
  };
});

export const askObservabilityAi = createServerFn({ method: 'POST' })
  .validator((data: AiChatInput) => data)
  .handler(async ({ data }) => {
    try {
      const { AI_SYSTEM_PROMPT, chatWithGemini } = await import('./server/gemini.server');
      const { DEFAULT_GATE_CTA, getAiFreeLimit } = await import('@/features/config/server');
      const { consumeAiMessage, getSession, resolveAiAccess } =
        await import('./server/ai-quota.server');

      // Authorize from DB only — ignore any client plan/remaining claims.
      const session = await getSession();
      const access = await resolveAiAccess(session);

      if (!access.canConsume) {
        if (access.needsAuth) {
          return {
            ok: false as const,
            gated: true as const,
            needsAuth: true as const,
            message: 'Sign in to use AI on IJNUT Cloud (3 free messages).',
            cta: { ...DEFAULT_GATE_CTA },
            remaining: 0
          };
        }
        return {
          ok: false as const,
          gated: true as const,
          needsAuth: false as const,
          message: `Free AI limit reached (${access.limit} messages). Subscribe or self-host with your own Gemini key.`,
          cta: { ...DEFAULT_GATE_CTA },
          remaining: 0
        };
      }

      const [overview, requestsPayload, stressPayload] = await Promise.all([
        obsFetch<OverviewResponse>('/observability/overview'),
        obsFetch<{ requests: RequestRecord[] }>('/observability/requests?limit=40'),
        obsFetch<{ reports: StressReport[] }>('/observability/stress')
      ]);

      const appRequests = requestsPayload.requests.filter(
        (r) => !r.path.includes('/observability')
      );
      const appRoutes = overview.routes.filter((r) => !r.key.includes('/observability'));

      let focusNote = '';
      if (data.intent === 'explain_request' && data.requestId) {
        const req = appRequests.find((r) => r.requestId === data.requestId);
        focusNote = req
          ? `User wants an explanation of this request:\n${JSON.stringify(req, null, 2)}`
          : `User asked to explain requestId=${data.requestId} but it was not in the recent buffer.`;
      } else if (data.intent === 'summarize_stress') {
        const report =
          (data.stressId && stressPayload.reports.find((r) => r.id === data.stressId)) ||
          stressPayload.reports[0];
        focusNote = report
          ? `User wants a plain-language summary of this load test:\n${JSON.stringify(report, null, 2)}`
          : 'User asked to summarize a load test, but no stress reports exist yet.';
      } else if (data.intent === 'suggest_fixes') {
        focusNote =
          'User wants practical fix suggestions based on the metrics below (errors, slow p95, cache vs db if spans exist).';
      }

      const context = {
        updatedAt: overview.updatedAt,
        routes: appRoutes.slice(0, 25),
        recentRequests: appRequests.slice(0, 25),
        stressReports: stressPayload.reports.slice(0, 5)
      };

      const history = (data.history ?? []).slice(-8).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const reply = await chatWithGemini([
        { role: 'system', content: AI_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Live metrics context (JSON):\n${JSON.stringify(context)}\n\n${focusNote}`
        },
        ...history,
        { role: 'user', content: data.message }
      ]);

      let remaining = access.remaining;
      if (access.gated && access.plan === 'free' && session?.user) {
        const consumed = await consumeAiMessage(session.user.id, getAiFreeLimit());
        if (!consumed) {
          return {
            ok: false as const,
            gated: true as const,
            needsAuth: false as const,
            message: `Free AI limit reached (${access.limit} messages). Subscribe or self-host with your own Gemini key.`,
            cta: { ...DEFAULT_GATE_CTA },
            remaining: 0
          };
        }
        remaining = consumed.remaining;
      }

      return {
        ok: true as const,
        reply,
        remaining
      };
    } catch (err) {
      return {
        ok: false as const,
        gated: false as const,
        message: err instanceof Error ? err.message : 'AI request failed'
      };
    }
  });
