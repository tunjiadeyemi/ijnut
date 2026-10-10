/**
 * Bachs billing — lives on demo-api (secrets + product id).
 * Docs: https://docs.bachs.io
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { applyUserBilling } from './billing.store';

function secretKeyFromEnv(): string | undefined {
  return process.env.BACHS_SECRET_KEY?.trim() || process.env.BACHS_API_KEY?.trim() || undefined;
}

export function isBachsConfigured(): boolean {
  return Boolean(secretKeyFromEnv() && process.env.BACHS_PRODUCT_ID?.trim());
}

function secretKey(): string {
  const key = secretKeyFromEnv();
  if (!key) {
    throw new Error('BACHS_SECRET_KEY (or BACHS_API_KEY) is not configured on the API');
  }
  return key;
}

function apiBase(): string {
  const key = secretKey();
  if (process.env.BACHS_API_BASE?.trim()) {
    return process.env.BACHS_API_BASE.trim().replace(/\/$/, '');
  }
  return key.startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io';
}

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
    'Bachs needs a public success/cancel URL. Set IJNUT_PUBLIC_DASHBOARD_URL or BACHS_RETURN_URL on the API (https://…), not localhost.'
  );
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
    throw new Error(formatBachsError(body, res.status));
  }

  return body as T;
}

export async function createProCheckout(opts: {
  userId: string;
  email: string;
  name?: string;
}): Promise<string> {
  const productId = process.env.BACHS_PRODUCT_ID?.trim();
  if (!productId) throw new Error('BACHS_PRODUCT_ID is not configured on the API');

  const base = checkoutReturnBaseUrl();
  const name = opts.name?.trim();
  const session = await bachsFetch<{ checkout_url?: string }>('/v1/checkout-sessions', {
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
  });

  if (!session.checkout_url) {
    throw new Error('Bachs did not return a checkout_url');
  }
  return session.checkout_url;
}

export async function createCustomerPortalSession(customerId: string): Promise<string> {
  const base = checkoutReturnBaseUrl();
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

export function verifyBachsSignature(opts: {
  rawBody: string;
  signatureHeader?: string | null;
  signatureV2Header?: string | null;
  timestampHeader?: string | null;
  toleranceSeconds?: number;
}): boolean {
  const secret = process.env.BACHS_WEBHOOK_SECRET?.trim() || secretKeyFromEnv();
  if (!secret) return false;
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

function metadataUserId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  return typeof m.userId === 'string' && m.userId ? m.userId : null;
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

      await applyUserBilling({
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
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
      const subscriptionId = typeof data.id === 'string' ? data.id : null;
      await applyUserBilling({
        customerId,
        plan: active ? 'pro' : 'free',
        nextSubscriptionId: subscriptionId
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
      await applyUserBilling({
        customerId,
        plan: 'free'
      });
      break;
    }
    default:
      break;
  }
}
