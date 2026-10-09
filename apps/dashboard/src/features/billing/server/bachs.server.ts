/**
 * Bachs billing for IJNUT Cloud Pro.
 * Docs: https://docs.bachs.io — sandbox https://sandbox-api.bachs.io
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

import { obsFetch } from '@/shared/api/client.server';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

function secretKeyFromEnv(): string | undefined {
  return (
    process.env.BACHS_SECRET_KEY?.trim() ||
    process.env.BACHS_API_KEY?.trim() ||
    undefined
  );
}

export function isBachsConfigured(): boolean {
  return Boolean(secretKeyFromEnv() && process.env.BACHS_PRODUCT_ID?.trim());
}

function secretKey(): string {
  const key = secretKeyFromEnv();
  if (!key) throw new Error('BACHS_SECRET_KEY (or BACHS_API_KEY) is not configured');
  return key;
}

function apiBase(): string {
  const key = secretKey();
  if (process.env.BACHS_API_BASE?.trim()) {
    return process.env.BACHS_API_BASE.trim().replace(/\/$/, '');
  }
  return key.startsWith('sk_live_')
    ? 'https://api.bachs.io'
    : 'https://sandbox-api.bachs.io';
}

export function getDashboardBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim() ||
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}

async function bachsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers
    }
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    const message = formatBachsError(body, res.status);
    throw new Error(message);
  }

  return body as T;
}

function formatBachsError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    const detail = o.detail ?? o.message;
    if (typeof detail === 'string' && detail.trim()) {
      const code = typeof o.error_code === 'string' ? ` (${o.error_code})` : '';
      return `Bachs: ${detail}${code}`;
    }
  }
  return `Bachs error ${status}`;
}

/** Bachs rejects loopback success/cancel URLs — prefer a public dashboard origin. */
function checkoutReturnBaseUrl(): string {
  const candidates = [
    process.env.BACHS_RETURN_URL?.trim(),
    process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim(),
    process.env.BETTER_AUTH_URL?.trim()
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const base = raw.replace(/\/$/, '');
    try {
      const u = new URL(base);
      const host = u.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local')
      ) {
        continue;
      }
      return base;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Bachs needs a public success/cancel URL. Set IJNUT_PUBLIC_DASHBOARD_URL or BACHS_RETURN_URL to your hosted dashboard (https://…), not localhost.'
  );
}

export async function createProCheckout(opts: {
  userId: string;
  email: string;
  name?: string;
}): Promise<string> {
  const productId = process.env.BACHS_PRODUCT_ID?.trim();
  if (!productId) throw new Error('BACHS_PRODUCT_ID is not configured');

  const base = checkoutReturnBaseUrl();
  // Recurring products require a customer identity (email).
  const name = opts.name?.trim();
  const session = await bachsFetch<{ checkout_url?: string }>(
    '/v1/checkout-sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: opts.email,
          ...(name ? { name } : {})
        },
        success_url: `${base}/?checkout=success`,
        cancel_url: `${base}/?checkout=cancel`,
        metadata: { userId: opts.userId }
      })
    }
  );

  if (!session.checkout_url) {
    throw new Error('Bachs did not return a checkout_url');
  }
  return session.checkout_url;
}

export async function createCustomerPortalSession(
  customerId: string
): Promise<string> {
  const base = getDashboardBaseUrl();
  const portal = await bachsFetch<{ url?: string; portal_url?: string }>(
    `/v1/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ return_url: `${base}/` })
    }
  );
  const url = portal.url || portal.portal_url;
  if (!url) throw new Error('Bachs did not return a portal URL');
  return url;
}

export async function setUserBilling(opts: {
  userId?: string | null;
  customerId?: string | null;
  plan: 'free' | 'pro';
  nextCustomerId?: string | null;
  nextSubscriptionId?: string | null;
}): Promise<void> {
  await obsFetch('/observability/billing/apply', {
    method: 'POST',
    body: JSON.stringify(opts)
  });
}

export async function getBillingIds(userId: string): Promise<{
  customerId: string | null;
  subscriptionId: string | null;
}> {
  // userId is implied by the session token on the API; keep arg for call-site clarity.
  void userId;
  const { getSession } = await import('@/features/auth/server/session.server');
  const session = await getSession();
  const token = session?.session?.token;
  const result = await obsFetch<{
    authenticated: boolean;
    customerId: string | null;
    subscriptionId: string | null;
  }>('/observability/billing/me', {
    headers: token ? { 'X-Ijnut-Session-Token': token } : {}
  });
  return {
    customerId: result.customerId,
    subscriptionId: result.subscriptionId
  };
}

function metadataUserId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  return typeof m.userId === 'string' && m.userId ? m.userId : null;
}

/** Prefer X-Bachs-Signature-V2; fall back to timestamp + X-Bachs-Signature. */
export function verifyBachsSignature(opts: {
  rawBody: string;
  signatureHeader?: string | null;
  signatureV2Header?: string | null;
  timestampHeader?: string | null;
  toleranceSeconds?: number;
}): boolean {
  const secret = process.env.BACHS_WEBHOOK_SECRET?.trim() || secretKey();
  const tolerance = opts.toleranceSeconds ?? 300;

  if (opts.signatureV2Header) {
    const parts = opts.signatureV2Header.split(',').map((p) => p.trim());
    const map = new Map<string, string[]>();
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq);
      const v = part.slice(eq + 1);
      const list = map.get(k) ?? [];
      list.push(v);
      map.set(k, list);
    }
    const t = map.get('t')?.[0];
    const signatures = map.get('v1') ?? [];
    if (!t || signatures.length === 0) return false;
    const timestamp = Number(t);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Date.now() / 1000 - timestamp) > tolerance) return false;

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${opts.rawBody}`, 'utf8')
      .digest('hex');

    return signatures.some((sig) => {
      try {
        const a = Buffer.from(expected);
        const b = Buffer.from(sig);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
  }

  if (opts.signatureHeader && opts.timestampHeader) {
    const timestamp = Number(opts.timestampHeader);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Date.now() / 1000 - timestamp) > tolerance) return false;

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${opts.rawBody}`, 'utf8')
      .digest('hex');
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(opts.signatureHeader);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  return false;
}

type BachsWebhook = {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
};

export async function handleBachsEvent(event: BachsWebhook): Promise<void> {
  const data = event.data ?? {};

  switch (event.type) {
    case 'collection.succeeded':
    case 'checkout.completed':
    case 'customer.subscription.created': {
      const userId =
        metadataUserId(data.metadata) ||
        metadataUserId((data.checkout as { metadata?: unknown } | undefined)?.metadata);
      const customerId =
        (typeof data.customer_id === 'string' && data.customer_id) ||
        (typeof (data.customer as { id?: string } | undefined)?.id === 'string'
          ? (data.customer as { id: string }).id
          : null);
      const subscriptionId =
        (typeof data.subscription_id === 'string' && data.subscription_id) ||
        (typeof data.id === 'string' && data.id.startsWith('sub_') ? data.id : null);

      if (!userId && !customerId) {
        console.warn(`[bachs] ${event.type} missing user/customer linkage`);
        return;
      }

      await setUserBilling({
        userId,
        customerId,
        plan: 'pro',
        nextCustomerId: customerId,
        nextSubscriptionId: subscriptionId
      });
      break;
    }
    case 'customer.subscription.updated': {
      const status = typeof data.status === 'string' ? data.status : '';
      const active = status === 'active' || status === 'trialing';
      const customerId =
        typeof data.customer_id === 'string' ? data.customer_id : null;
      const subscriptionId =
        typeof data.id === 'string' ? data.id : null;
      await setUserBilling({
        customerId,
        plan: active ? 'pro' : 'free',
        nextSubscriptionId: subscriptionId
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const customerId =
        typeof data.customer_id === 'string' ? data.customer_id : null;
      await setUserBilling({
        customerId,
        plan: 'free'
      });
      break;
    }
    default:
      break;
  }
}
