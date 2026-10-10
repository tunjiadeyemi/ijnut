/**
 * IJNUT deployment mode + public API URL (server-only).
 * cloud = Cloud AI sidecar (gated AI + memory + billing); metrics/stress stay on local API.
 * selfhost = BYO AI keys on the same API as metrics.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env'), override: false });
loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false });

export type IjnutMode = 'cloud' | 'selfhost';
export type IjnutPlan = 'free' | 'pro';

export const DEFAULT_GATE_CTA: {
  upgrade: string;
  selfHost: string;
  signIn: string;
} = {
  upgrade: 'Subscribe for unlimited Cloud AI + chat memory via Bachs.',
  selfHost:
    'Or self-host AI: run your API locally with GEMINI_API_KEY / COHERE_API_KEY and IJNUT_MODE=selfhost — no IJNUT fees.',
  signIn: 'Sign in to use Cloud AI (chat memory; 3 free messages).'
};

export function getIjnutMode(): IjnutMode {
  const raw = (process.env.IJNUT_MODE ?? 'selfhost').trim().toLowerCase();
  return raw === 'cloud' ? 'cloud' : 'selfhost';
}

export function getIjnutPlan(): IjnutPlan {
  const raw = (process.env.IJNUT_PLAN ?? 'free').trim().toLowerCase();
  return raw === 'pro' ? 'pro' : 'free';
}

/** Lifetime free AI messages per Cloud user (not daily). */
export function getAiFreeLimit(): number {
  const n = Number(process.env.IJNUT_AI_FREE_LIMIT ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

/** Ensure absolute URL — host-only Railway values need https:// */
function normalizeBaseUrl(raw: string): string {
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

/**
 * Suggested stress target — same as OBSERVABILITY_API_URL.
 * In Docker Compose the BFF uses http://api:3000; remap that host to localhost
 * so the browser can reach the published port.
 */
export function getPublicApiUrl(): string {
  const base = normalizeBaseUrl(
    process.env.OBSERVABILITY_API_URL?.trim() || 'http://127.0.0.1:3000'
  );
  try {
    const u = new URL(base);
    if (u.hostname === 'api') {
      u.hostname = 'localhost';
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    // ignore
  }
  return base;
}

export function isAiGated(): boolean {
  return getIjnutMode() === 'cloud' && getIjnutPlan() === 'free';
}
