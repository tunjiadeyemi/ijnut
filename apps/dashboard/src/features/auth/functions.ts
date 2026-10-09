import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { getApiUrl } from '@/shared/api/client.server';

/**
 * Auth state for UI. plan / aiRemaining come from the API — never client input.
 */
export const getAuthState = createServerFn({ method: 'GET' }).handler(async () => {
  const {
    getSession,
    resolveAiAccess,
    toPublicUser
  } = await import('./server/session.server');
  const { getIjnutMode } = await import('@/features/config/server');

  const session = await getSession();
  const access = await resolveAiAccess(session);

  let githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID?.trim());
  try {
    const { obsFetch } = await import('@/shared/api/client.server');
    const cfg = await obsFetch<{ githubConfigured: boolean }>(
      '/observability/auth/config'
    );
    githubConfigured = cfg.githubConfigured;
  } catch {
    // fall back to local env hint
  }

  return {
    authenticated: access.authenticated,
    user: toPublicUser(session),
    mode: getIjnutMode(),
    plan: access.plan,
    aiUsed: access.aiUsed,
    aiLimit: access.limit,
    aiRemaining: access.remaining,
    needsAuth: access.needsAuth,
    gated: access.gated,
    githubConfigured
  };
});

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  try {
    const request = getRequest();
    const cookie = request.headers.get('cookie') ?? '';
    await fetch(`${getApiUrl()}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        cookie,
        origin:
          process.env.BETTER_AUTH_URL?.trim() ||
          process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim() ||
          'http://127.0.0.1:3001',
        'content-type': 'application/json'
      },
      body: '{}'
    });
  } catch {
    // already signed out
  }
  return { ok: true as const };
});
