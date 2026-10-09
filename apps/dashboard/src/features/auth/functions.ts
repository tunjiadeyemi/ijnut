import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

/**
 * Auth state for UI. plan / aiRemaining are computed on the server from the
 * session + DB — never taken from client input.
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
  const githubConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()
  );

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
  const { auth } = await import('./server/auth');
  try {
    const request = getRequest();
    await auth.api.signOut({ headers: request.headers });
  } catch {
    // already signed out
  }
  return { ok: true as const };
});
