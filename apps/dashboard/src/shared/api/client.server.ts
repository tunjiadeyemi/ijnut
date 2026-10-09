/**
 * Server-only BFF helpers. Obs API uses operator ADMIN_TOKEN from env —
 * guests and logged-in users both load metrics without pasting a key.
 */

import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

/** Ensure absolute URL — host-only Railway values need https:// */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return 'http://127.0.0.1:3000';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (
    trimmed.startsWith('127.') ||
    trimmed.startsWith('localhost') ||
    trimmed.startsWith('0.0.0.0')
  ) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function getApiUrl(): string {
  return normalizeBaseUrl(process.env.OBSERVABILITY_API_URL ?? 'http://127.0.0.1:3000');
}

/** Server-only token for /observability/* — never from the browser. */
export function getObsAdminToken(): string | undefined {
  return (
    process.env.OBSERVABILITY_ADMIN_TOKEN?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    undefined
  );
}

export async function obsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getObsAdminToken();
  if (!token) {
    const err = new Error(
      'OBSERVABILITY_ADMIN_TOKEN (or ADMIN_TOKEN) is not configured on the server'
    ) as Error & { status?: number };
    err.status = 500;
    throw err;
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
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
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${res.status}`;
    const err = new Error(message) as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body as T;
}
