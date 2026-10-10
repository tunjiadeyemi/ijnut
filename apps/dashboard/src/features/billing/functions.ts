import { createServerFn } from '@tanstack/react-start';

async function sessionHeaders(): Promise<Record<string, string>> {
  const { getSession } = await import('@/features/auth/server/session.server');
  const session = await getSession();
  const token = session?.session?.token;
  return token ? { 'X-Ijnut-Session-Token': token } : {};
}

export const getBillingStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { cloudAiFetch } = await import('@/shared/api/client.server');
  const { getSession, resolveAiAccess } = await import(
    '@/features/auth/server/session.server'
  );

  const session = await getSession();
  const access = await resolveAiAccess(session);
  const headers = await sessionHeaders();

  let configured = false;
  let hasCustomer = false;
  try {
    const status = await cloudAiFetch<{ configured: boolean }>(
      '/observability/billing/status'
    );
    configured = status.configured;
    if (session?.user) {
      const me = await cloudAiFetch<{
        authenticated: boolean;
        customerId: string | null;
      }>('/observability/billing/me', { headers });
      hasCustomer = Boolean(me.customerId);
    }
  } catch {
    configured = false;
  }

  return {
    configured,
    authenticated: access.authenticated,
    plan: access.plan,
    hasCustomer
  };
});

export const createCheckout = createServerFn({ method: 'POST' })
  .validator((data: { returnOrigin?: string }) => data)
  .handler(async ({ data }) => {
    const { cloudAiFetch } = await import('@/shared/api/client.server');
    const headers = await sessionHeaders();
    try {
      return await cloudAiFetch<
        | { ok: true; url: string }
        | { ok: false; message: string; needsAuth?: boolean }
      >('/observability/billing/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ returnOrigin: data.returnOrigin })
      });
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Could not start checkout'
      };
    }
  });

export const createPortal = createServerFn({ method: 'POST' })
  .validator((data: { returnOrigin?: string }) => data)
  .handler(async ({ data }) => {
    const { cloudAiFetch } = await import('@/shared/api/client.server');
    const headers = await sessionHeaders();
    try {
      return await cloudAiFetch<
        | { ok: true; url: string }
        | { ok: false; message: string; needsAuth?: boolean }
      >('/observability/billing/portal', {
        method: 'POST',
        headers,
        body: JSON.stringify({ returnOrigin: data.returnOrigin })
      });
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : 'Could not open billing portal'
      };
    }
  });
