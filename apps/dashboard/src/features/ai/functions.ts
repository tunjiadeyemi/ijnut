import { createServerFn } from '@tanstack/react-start';

import type { AiChatInput } from '@/shared/api/types';
import { cloudAiFetch, obsFetch } from '@/shared/api/client.server';

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

export type AiStatusResult = {
  configured: boolean | null;
  mode: 'cloud' | 'selfhost';
  authenticated: boolean;
  needsAuth: boolean;
  plan: 'free' | 'pro';
  gated: boolean;
  limit: number | null;
  remaining: number | null;
  aiUsed: number;
  billingConfigured: boolean;
  cta: {
    upgrade: string;
    selfHost: string;
    signIn: string;
  };
  /** Set when the dashboard could not reach Cloud AI /ai/status */
  statusError?: string;
};

async function sessionTokenForApi(): Promise<string | undefined> {
  const { getSession } = await import('@/features/auth/server/session.server');
  const session = await getSession();
  return session?.session?.token;
}

/** Snapshot local metrics so Cloud AI can reason about the user's API. */
async function localMetricsContext(): Promise<{
  updatedAt?: string;
  routes?: unknown[];
  recentRequests?: unknown[];
  stressReports?: unknown[];
}> {
  try {
    const [overview, requests, stress] = await Promise.all([
      obsFetch<{ updatedAt?: string; routes?: unknown[] }>('/observability/overview'),
      obsFetch<{ requests?: unknown[] }>('/observability/requests?limit=40'),
      obsFetch<{ reports?: unknown[] }>('/observability/stress')
    ]);
    return {
      updatedAt: overview.updatedAt,
      routes: (overview.routes ?? []).slice(0, 25),
      recentRequests: (requests.requests ?? []).slice(0, 25),
      stressReports: (stress.reports ?? []).slice(0, 5)
    };
  } catch {
    return {};
  }
}

/**
 * AI status from Cloud AI host (quota + configured providers).
 * Metrics still come from the local observability API.
 */
export const getAiStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AiStatusResult> => {
    const { DEFAULT_GATE_CTA, getIjnutMode } = await import('@/features/config/server');
    const { isBachsConfigured } = await import('@/features/billing/server/bachs.server');

    const billingConfigured = await isBachsConfigured();
    const cta = { ...DEFAULT_GATE_CTA };

    try {
      const token = await sessionTokenForApi();
      const status = await cloudAiFetch<ApiAiStatus>('/observability/ai/status', {
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
        billingConfigured,
        cta
      };
    } catch (err) {
      return {
        configured: null,
        mode: getIjnutMode(),
        authenticated: false,
        needsAuth: getIjnutMode() === 'cloud',
        plan: 'free',
        gated: getIjnutMode() === 'cloud',
        limit: null,
        remaining: null,
        aiUsed: 0,
        billingConfigured,
        cta,
        statusError:
          err instanceof Error ? err.message : 'Could not reach Cloud AI status'
      };
    }
  }
);

export const getAiHistory = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const token = await sessionTokenForApi();
    if (!token) {
      return { ok: false as const, needsAuth: true as const, messages: [] as const };
    }
    const result = await cloudAiFetch<
      | { ok: true; messages: Array<{ role: 'user' | 'assistant'; content: string }> }
      | { ok: false; needsAuth?: boolean; message?: string }
    >('/observability/ai/history', {
      headers: { 'X-Ijnut-Session-Token': token }
    });
    if (!result.ok) {
      return { ok: false as const, needsAuth: true as const, messages: [] as const };
    }
    return { ok: true as const, messages: result.messages };
  } catch {
    return { ok: true as const, messages: [] as const };
  }
});

export const askObservabilityAi = createServerFn({ method: 'POST' })
  .validator((data: AiChatInput) => data)
  .handler(async ({ data }) => {
    try {
      const token = await sessionTokenForApi();
      const context = await localMetricsContext();
      return await cloudAiFetch<ApiAiChatResult>('/observability/ai', {
        method: 'POST',
        headers: token ? { 'X-Ijnut-Session-Token': token } : {},
        body: JSON.stringify({
          message: data.message,
          history: data.history,
          intent: data.intent,
          requestId: data.requestId,
          stressId: data.stressId,
          context
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
