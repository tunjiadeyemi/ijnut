/**
 * IJNUT deployment mode + public API URL (server-only).
 * cloud = you host the API (gate Gemini/stress); selfhost = their box, their keys.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

export type IjnutMode = 'cloud' | 'selfhost';
export type IjnutPlan = 'free' | 'pro';

export const DEFAULT_GATE_CTA: {
  upgrade: string;
  selfHost: string;
  signIn: string;
} = {
  upgrade: 'Subscribe on IJNUT Cloud for unlimited AI via Bachs.',
  selfHost:
    'Or self-host: docker compose up --build, set your own GEMINI_API_KEY — no IJNUT fees.',
  signIn: 'Sign in to unlock 3 free AI messages on Cloud.'
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

/** URL stress / Demo API UI should use (public hostname, not docker-internal). */
export function getPublicApiUrl(): string {
  return normalizeBaseUrl(
    process.env.IJNUT_PUBLIC_API_URL?.trim() ||
      process.env.DEMO_PUBLIC_URL?.trim() ||
      process.env.OBSERVABILITY_API_URL?.trim() ||
      'http://127.0.0.1:3000'
  );
}

export function isAiGated(): boolean {
  return getIjnutMode() === 'cloud' && getIjnutPlan() === 'free';
}
