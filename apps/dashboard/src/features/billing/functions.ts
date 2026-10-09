import { createServerFn } from '@tanstack/react-start';

export const getBillingStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { isBachsConfigured, getBillingIds } = await import('./server/bachs.server');
  const { getSession, resolveAiAccess } = await import(
    '@/features/auth/server/session.server'
  );

  const session = await getSession();
  const access = await resolveAiAccess(session);
  const ids = session?.user ? await getBillingIds(session.user.id) : null;

  return {
    configured: isBachsConfigured(),
    authenticated: access.authenticated,
    plan: access.plan,
    hasCustomer: Boolean(ids?.customerId)
  };
});

export const createCheckout = createServerFn({ method: 'POST' }).handler(async () => {
  const { getSession } = await import('@/features/auth/server/session.server');
  const { createProCheckout, isBachsConfigured } = await import('./server/bachs.server');

  if (!isBachsConfigured()) {
    return { ok: false as const, message: 'Bachs is not configured on this server.' };
  }

  const session = await getSession();
  if (!session?.user) {
    return {
      ok: false as const,
      message: 'Sign in before subscribing.',
      needsAuth: true as const
    };
  }

  try {
    const url = await createProCheckout({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name
    });
    return { ok: true as const, url };
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : 'Could not start checkout'
    };
  }
});

export const createPortal = createServerFn({ method: 'POST' }).handler(async () => {
  const { getSession } = await import('@/features/auth/server/session.server');
  const {
    createCustomerPortalSession,
    getBillingIds,
    isBachsConfigured
  } = await import('./server/bachs.server');

  if (!isBachsConfigured()) {
    return { ok: false as const, message: 'Bachs is not configured on this server.' };
  }

  const session = await getSession();
  if (!session?.user) {
    return { ok: false as const, message: 'Sign in required.', needsAuth: true as const };
  }

  const ids = await getBillingIds(session.user.id);
  if (!ids.customerId) {
    return {
      ok: false as const,
      message: 'No Bachs customer yet — subscribe first.'
    };
  }

  try {
    const url = await createCustomerPortalSession(ids.customerId);
    return { ok: true as const, url };
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : 'Could not open billing portal'
    };
  }
});
