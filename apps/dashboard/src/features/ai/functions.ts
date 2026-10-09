import { createServerFn } from '@tanstack/react-start';

import type { AiChatInput } from '@/shared/api/types';
import { obsFetch } from '@/shared/api/client.server';

export type { AiChatInput, AiChatTurn } from '@/shared/api/types';

type ApiAiStatus = {
  configured: boolean;
  mode: 'cloud' | 'selfhost';
  authenticated: boolean;
  needsAuth: boolean;
  plan: 'free' | 'pro';
  gated: boolean;
  limit: number | null;
  remaining: number | null;
  aiUsed: number;
};

type ApiAiChatResult =
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

async function sessionTokenForApi(): Promise<string | undefined> {
  const { getSession } = await import('@/features/auth/server/session.server');
  const session = await getSession();
  return session?.session?.token;
}

/**
 * AI status from the API (source of truth for Gemini + cloud quota).
 * Dashboard never calls Gemini locally — sharing the API URL alone is not enough
 * (ADMIN_TOKEN required); cloud free also needs a signed-in session.
 */
export const getAiStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { DEFAULT_GATE_CTA, getIjnutMode } = await import('@/features/config/server');
  const { isBachsConfigured } = await import('@/features/billing/server/bachs.server');

  const token = await sessionTokenForApi();
  const status = await obsFetch<ApiAiStatus>('/observability/ai/status', {
    headers: token ? { 'X-Ijnut-Session-Token': token } : {}
  });

  return {
    configured: status.configured,
    mode: status.mode ?? getIjnutMode(),
    authenticated: status.authenticated,
    needsAuth: status.needsAuth,
    plan: status.plan,
    gated: status.gated,
    limit: status.limit,
    remaining: status.remaining,
    aiUsed: status.aiUsed,
    billingConfigured: isBachsConfigured(),
    cta: { ...DEFAULT_GATE_CTA }
  };
});

export const askObservabilityAi = createServerFn({ method: 'POST' })
  .validator((data: AiChatInput) => data)
  .handler(async ({ data }) => {
    try {
      const token = await sessionTokenForApi();
      return await obsFetch<ApiAiChatResult>('/observability/ai', {
        method: 'POST',
        headers: token ? { 'X-Ijnut-Session-Token': token } : {},
        body: JSON.stringify({
          message: data.message,
          history: data.history,
          intent: data.intent,
          requestId: data.requestId,
          stressId: data.stressId
        })
      });
    } catch (err) {
      return {
        ok: false as const,
        gated: false as const,
        message: err instanceof Error ? err.message : 'AI request failed'
      };
    }
  });
