/**
 * Server-only BFF helpers.
 * - OBSERVABILITY_API_URL → local metrics / stress (your API)
 * - IJNUT_CLOUD_AI_URL → optional Cloud AI sidecar (auth, AI, billing, memory)
 */

import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

// App .env first (preferred); root only fills missing keys. Never override real env.
loadEnv({ path: resolve(process.cwd(), '.env'), override: false });
loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false });

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

/** Local (or single-host) observability API — metrics, stress, shortener. */
export function getApiUrl(): string {
  return normalizeBaseUrl(process.env.OBSERVABILITY_API_URL ?? 'http://127.0.0.1:3000');
}

/**
 * Cloud AI host: auth, /observability/ai*, billing.
 * Defaults to the same as getApiUrl() when unset (full self-host or all-in-one).
 */
export function getCloudAiUrl(): string {
  const cloud = process.env.IJNUT_CLOUD_AI_URL?.trim();
  if (cloud) return normalizeBaseUrl(cloud);
  return getApiUrl();
}

export function usesSplitCloudAi(): boolean {
  const cloud = process.env.IJNUT_CLOUD_AI_URL?.trim();
  if (!cloud) return false;
  return normalizeBaseUrl(cloud) !== getApiUrl();
}

/** Server-only observability service key for local /observability/* — never from the browser. */
export function getObservabilityServiceKey(): string | undefined {
  return (
    process.env.OBSERVABILITY_SERVICE_KEY?.trim() ||
    process.env.OBSERVABILITY_ADMIN_TOKEN?.trim() || // legacy
    process.env.ADMIN_TOKEN?.trim() || // legacy
    undefined
  );
}

/** @deprecated use getObservabilityServiceKey */
export function getObsAdminToken(): string | undefined {
  return getObservabilityServiceKey();
}

/** Service key for Cloud AI host (may match local). */
export function getCloudAiServiceKey(): string | undefined {
  return (
    process.env.IJNUT_CLOUD_AI_SERVICE_KEY?.trim() ||
    process.env.IJNUT_CLOUD_AI_ADMIN_TOKEN?.trim() || // legacy
    getObservabilityServiceKey()
  );
}

async function apiFetch<T>(
  baseUrl: string,
  adminToken: string | undefined,
  path: string,
  init: RequestInit = {},
  missingTokenMessage: string
): Promise<T> {
  if (!adminToken) {
    const err = new Error(missingTokenMessage) as Error & { status?: number };
    err.status = 500;
    throw err;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${adminToken}`,
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

/** Metrics / stress on the local observability API. */
export async function obsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch(
    getApiUrl(),
    getObservabilityServiceKey(),
    path,
    init,
    'OBSERVABILITY_SERVICE_KEY is not configured on the dashboard server'
  );
}

/** Auth-adjacent AI + billing on the Cloud AI host (or local when unset). */
export async function cloudAiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  return apiFetch(
    getCloudAiUrl(),
    getCloudAiServiceKey(),
    path,
    init,
    'IJNUT_CLOUD_AI_SERVICE_KEY or OBSERVABILITY_SERVICE_KEY is not configured'
  );
}
