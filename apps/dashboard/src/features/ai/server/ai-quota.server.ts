/**
 * In-memory daily AI quota for IJNUT Cloud free tier.
 * Resets at UTC midnight. Pro / selfhost skip via getAiDailyLimit().
 */
import { createHash } from 'node:crypto';
import { getAiDailyLimit, isAiGated } from '@/features/config/server';

type Bucket = { day: string; count: number };

const buckets = new Map<string, Bucket>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function keyFor(subject: string): string {
  return createHash('sha256').update(subject).digest('hex').slice(0, 24);
}

export type QuotaSnapshot = {
  gated: boolean;
  limit: number;
  used: number;
  remaining: number;
};

export function getQuotaSnapshot(subject: string): QuotaSnapshot {
  const limit = getAiDailyLimit();
  const gated = isAiGated();
  if (!Number.isFinite(limit)) {
    return { gated: false, limit: Infinity, used: 0, remaining: Infinity };
  }

  const key = keyFor(subject || 'anon');
  const day = utcDay();
  let bucket = buckets.get(key);
  if (!bucket || bucket.day !== day) {
    bucket = { day, count: 0 };
    buckets.set(key, bucket);
  }

  return {
    gated,
    limit,
    used: bucket.count,
    remaining: Math.max(0, limit - bucket.count)
  };
}

/** Returns false if over quota (does not increment). */
export function canConsumeAi(subject: string): boolean {
  const snap = getQuotaSnapshot(subject);
  if (!snap.gated) return true;
  return snap.remaining > 0;
}

export function consumeAi(subject: string): QuotaSnapshot {
  const limit = getAiDailyLimit();
  if (!Number.isFinite(limit) || !isAiGated()) {
    return getQuotaSnapshot(subject);
  }

  const key = keyFor(subject || 'anon');
  const day = utcDay();
  let bucket = buckets.get(key);
  if (!bucket || bucket.day !== day) {
    bucket = { day, count: 0 };
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return getQuotaSnapshot(subject);
}
