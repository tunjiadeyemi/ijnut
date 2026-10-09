/**
 * Server-only session + AI authorization.
 * plan / aiRemaining are derived from the DB — never from client input.
 */
import { getRequest } from '@tanstack/react-start/server';

import {
  getAiFreeLimit,
  getIjnutMode,
  getIjnutPlan,
  type IjnutPlan
} from '@/features/config/server';
import { auth, type AuthSession } from './auth';
import { getAuthPool } from './db';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AiAccess = {
  authenticated: boolean;
  needsAuth: boolean;
  plan: IjnutPlan;
  aiUsed: number;
  limit: number | null;
  remaining: number | null;
  gated: boolean;
  canConsume: boolean;
};

function userPlan(raw: unknown): IjnutPlan {
  return raw === 'pro' ? 'pro' : 'free';
}

function userAiUsed(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    return session;
  } catch {
    return null;
  }
}

async function loadUserQuota(
  userId: string
): Promise<{ plan: IjnutPlan; aiUsed: number }> {
  const pool = getAuthPool();
  const result = await pool.query<{ plan: string | null; aiUsed: number | null }>(
    `SELECT plan, "aiUsed" FROM "user" WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    plan: userPlan(row?.plan),
    aiUsed: userAiUsed(row?.aiUsed)
  };
}

/**
 * Authoritative AI access from env + DB.
 * Ignores any client-supplied plan/remaining and does not trust stale session fields.
 */
export async function resolveAiAccess(
  session: AuthSession | null
): Promise<AiAccess> {
  const mode = getIjnutMode();
  const envPlan = getIjnutPlan();

  // Self-host / deployment-wide pro: unlimited (BYO key).
  if (mode === 'selfhost' || envPlan === 'pro') {
    return {
      authenticated: Boolean(session?.user),
      needsAuth: false,
      plan: 'pro',
      aiUsed: 0,
      limit: null,
      remaining: null,
      gated: false,
      canConsume: true
    };
  }

  if (!session?.user) {
    return {
      authenticated: false,
      needsAuth: true,
      plan: 'free',
      aiUsed: 0,
      limit: getAiFreeLimit(),
      remaining: 0,
      gated: true,
      canConsume: false
    };
  }

  const { plan, aiUsed } = await loadUserQuota(session.user.id);

  if (plan === 'pro') {
    return {
      authenticated: true,
      needsAuth: false,
      plan: 'pro',
      aiUsed,
      limit: null,
      remaining: null,
      gated: false,
      canConsume: true
    };
  }

  const limit = getAiFreeLimit();
  const remaining = Math.max(0, limit - aiUsed);

  return {
    authenticated: true,
    needsAuth: false,
    plan: 'free',
    aiUsed,
    limit,
    remaining,
    gated: true,
    canConsume: remaining > 0
  };
}

/**
 * Atomically consume one free AI message. Returns null if denied / exhausted.
 * Enforces limit in SQL so concurrent requests cannot overspend.
 */
export async function consumeAiMessage(
  userId: string,
  limit: number
): Promise<{ aiUsed: number; remaining: number } | null> {
  const pool = getAuthPool();
  const result = await pool.query<{ aiUsed: number }>(
    `UPDATE "user"
     SET "aiUsed" = COALESCE("aiUsed", 0) + 1, "updatedAt" = NOW()
     WHERE id = $1
       AND COALESCE(plan, 'free') <> 'pro'
       AND COALESCE("aiUsed", 0) < $2
     RETURNING "aiUsed"`,
    [userId, limit]
  );

  if (result.rowCount !== 1 || !result.rows[0]) {
    return null;
  }

  const aiUsed = Number(result.rows[0].aiUsed);
  return {
    aiUsed,
    remaining: Math.max(0, limit - aiUsed)
  };
}

export function toPublicUser(session: AuthSession | null): PublicUser | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image
  };
}
