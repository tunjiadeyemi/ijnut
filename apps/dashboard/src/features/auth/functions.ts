import { createServerFn } from '@tanstack/react-start';
import { deleteCookie, setCookie } from '@tanstack/react-start/server';
import { ADMIN_COOKIE, getSessionToken, validateAdminToken } from '@/shared/api/client.server';

export const getAuthState = createServerFn({ method: 'GET' }).handler(async () => ({
  authenticated: Boolean(getSessionToken())
}));

/**
 * Validate key against demo-api (401 if wrong), then set httpOnly cookie.
 * Key is never returned to the client in JSON — only stored as cookie.
 */
export const loginWithAdminKey = createServerFn({ method: 'POST' })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const token = data.token?.trim();
    if (!token) {
      return { ok: false as const, message: 'Please enter your admin password' };
    }

    const valid = await validateAdminToken(token);
    if (!valid) {
      return {
        ok: false as const,
        message: 'Wrong password. Check ADMIN_TOKEN in your .env file.'
      };
    }

    setCookie(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.COOKIE_SECURE === 'true'
    });

    return { ok: true as const };
  });

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  deleteCookie(ADMIN_COOKIE, { path: '/' });
  return { ok: true as const };
});
