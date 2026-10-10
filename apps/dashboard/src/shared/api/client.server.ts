/**
 * Server-only BFF helpers.
 * - OBSERVABILITY_API_URL → local metrics / stress (your API)
 * - IJNUT_CLOUD_AI_URL → optional Cloud AI sidecar (auth, AI, billing, memory)
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

/** Server-only token for local /observability/* — never from the browser. */
export function getObsAdminToken(): string | undefined {
  return (
    process.env.OBSERVABILITY_ADMIN_TOKEN?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    undefined
  );
}

/** Token for Cloud AI host (may match local, or IJNUT_CLOUD_AI_ADMIN_TOKEN). */
export function getCloudAiAdminToken(): string | undefined {
  return (
    process.env.IJNUT_CLOUD_AI_ADMIN_TOKEN?.trim() ||
    getObsAdminToken()
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
    getObsAdminToken(),
    path,
    init,
    'OBSERVABILITY_ADMIN_TOKEN (or ADMIN_TOKEN) is not configured on the server'
  );
}

/** Auth-adjacent AI + billing on the Cloud AI host (or local when unset). */
export async function cloudAiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  return apiFetch(
    getCloudAiUrl(),
    getCloudAiAdminToken(),
    path,
    init,
    'IJNUT_CLOUD_AI_ADMIN_TOKEN or OBSERVABILITY_ADMIN_TOKEN is not configured'
  );
}
