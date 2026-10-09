/**
 * Session + AI access via the API (no dashboard → Postgres).
 */
import { getRequest } from '@tanstack/react-start/server';

import {
  getAiFreeLimit,
  getIjnutMode,
  getIjnutPlan,
  type IjnutPlan
} from '@/features/config/server';
import { getApiUrl, obsFetch } from '@/shared/api/client.server';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AuthSession = {
  session: {
    token: string;
    userId: string;
    expiresAt: string | Date;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    plan?: string | null;
    aiUsed?: number | null;
  };
};

export type AiAccess = {
  authenticated: boolean;
  needsAuth: boolean;
  plan: IjnutPlan;
  aiUsed: number;
  limit: number | null;
  remaining: number | null;
  gated: boolean;
  canConsume: boolean;
};

export async function getSession(): Promise<AuthSession | null> {
  try {
    const request = getRequest();
    const cookie = request.headers.get('cookie');
    if (!cookie) return null;

    const res = await fetch(`${getApiUrl()}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        cookie,
        accept: 'application/json',
        origin:
          process.env.BETTER_AUTH_URL?.trim() ||
          process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim() ||
          'http://127.0.0.1:3001'
      }
    });

    if (!res.ok) return null;
    const body = (await res.json()) as AuthSession | null;
    if (!body?.session?.token || !body?.user?.id) return null;
    return body;
  } catch {
    return null;
  }
}

/**
 * Authoritative AI access from the API (same rules as Gemini gate).
 */
export async function resolveAiAccess(
  session: AuthSession | null
): Promise<AiAccess> {
  const mode = getIjnutMode();
  const envPlan = getIjnutPlan();

  if (mode === 'selfhost' || envPlan === 'pro') {
    return {
      authenticated: Boolean(session?.user),
      needsAuth: false,
      plan: 'pro',
      aiUsed: 0,
      limit: null,
      remaining: null,
      gated: false,
      canConsume: true
    };
  }

  try {
    const status = await obsFetch<{
      authenticated: boolean;
      needsAuth: boolean;
      plan: IjnutPlan;
      aiUsed: number;
      limit: number | null;
      remaining: number | null;
      gated: boolean;
    }>('/observability/ai/status', {
      headers: session?.session?.token
        ? { 'X-Ijnut-Session-Token': session.session.token }
        : {}
    });

    return {
      authenticated: status.authenticated,
      needsAuth: status.needsAuth,
      plan: status.plan,
      aiUsed: status.aiUsed,
      limit: status.limit,
      remaining: status.remaining,
      gated: status.gated,
      canConsume: !status.needsAuth && (status.plan === 'pro' || (status.remaining ?? 0) > 0)
    };
  } catch {
    if (!session?.user) {
      return {
        authenticated: false,
        needsAuth: true,
        plan: 'free',
        aiUsed: 0,
        limit: getAiFreeLimit(),
        remaining: 0,
        gated: true,
        canConsume: false
      };
    }
    return {
      authenticated: true,
      needsAuth: false,
      plan: 'free',
      aiUsed: 0,
      limit: getAiFreeLimit(),
      remaining: 0,
      gated: true,
      canConsume: false
    };
  }
}

export function toPublicUser(session: AuthSession | null): PublicUser | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image
  };
}
