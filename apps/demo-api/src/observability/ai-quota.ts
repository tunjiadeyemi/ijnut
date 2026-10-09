/**
 * Server-authoritative AI access for cloud freemium.
 * Quota lives in the shared better-auth Postgres `user` table.
 * Never throws — DB failures degrade to needsAuth / deny.
 */
import { Pool } from "pg";

export type IjnutMode = "cloud" | "selfhost";
export type IjnutPlan = "free" | "pro";

export type AiAccess = {
  authenticated: boolean;
  needsAuth: boolean;
  plan: IjnutPlan;
  aiUsed: number;
  limit: number | null;
  remaining: number | null;
  gated: boolean;
  canConsume: boolean;
  userId: string | null;
};

let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for cloud AI quota");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      // Railway / managed Postgres often require SSL
      ssl: connectionString.includes("localhost") ||
        connectionString.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export function getIjnutMode(): IjnutMode {
  const raw = (process.env.IJNUT_MODE ?? "selfhost").trim().toLowerCase();
  return raw === "cloud" ? "cloud" : "selfhost";
}

export function getIjnutPlan(): IjnutPlan {
  const raw = (process.env.IJNUT_PLAN ?? "free").trim().toLowerCase();
  return raw === "pro" ? "pro" : "free";
}

export function getAiFreeLimit(): number {
  const n = Number(process.env.IJNUT_AI_FREE_LIMIT ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

function userPlan(raw: unknown): IjnutPlan {
  return raw === "pro" ? "pro" : "free";
}

function userAiUsed(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function guestAccess(): AiAccess {
  return {
    authenticated: false,
    needsAuth: true,
    plan: "free",
    aiUsed: 0,
    limit: getAiFreeLimit(),
    remaining: 0,
    gated: true,
    canConsume: false,
    userId: null,
  };
}

/**
 * Resolve a better-auth session token → user id (expiresAt must be in the future).
 */
export async function resolveSessionUserId(
  sessionToken: string | undefined,
): Promise<string | null> {
  const token = sessionToken?.trim();
  if (!token) return null;

  const result = await getPool().query<{ userId: string }>(
    `SELECT "userId" FROM session
     WHERE token = $1 AND "expiresAt" > NOW()
     LIMIT 1`,
    [token],
  );
  return result.rows[0]?.userId ?? null;
}

async function loadUserQuota(
  userId: string,
): Promise<{ plan: IjnutPlan; aiUsed: number }> {
  const result = await getPool().query<{
    plan: string | null;
    aiUsed: number | null;
  }>(`SELECT plan, "aiUsed" FROM "user" WHERE id = $1`, [userId]);
  const row = result.rows[0];
  return {
    plan: userPlan(row?.plan),
    aiUsed: userAiUsed(row?.aiUsed),
  };
}

export async function resolveAiAccess(
  sessionToken: string | undefined,
): Promise<AiAccess> {
  const mode = getIjnutMode();
  const envPlan = getIjnutPlan();

  // Self-host / deployment-wide pro: unlimited (BYO Gemini on the API).
  if (mode === "selfhost" || envPlan === "pro") {
    const userId = await resolveSessionUserId(sessionToken).catch(() => null);
    return {
      authenticated: Boolean(userId),
      needsAuth: false,
      plan: "pro",
      aiUsed: 0,
      limit: null,
      remaining: null,
      gated: false,
      canConsume: true,
      userId,
    };
  }

  let userId: string | null = null;
  try {
    userId = await resolveSessionUserId(sessionToken);
  } catch (err) {
    console.error("[ai-quota] session lookup failed", err);
    return guestAccess();
  }

  if (!userId) {
    return guestAccess();
  }

  try {
    const { plan, aiUsed } = await loadUserQuota(userId);

    if (plan === "pro") {
      return {
        authenticated: true,
        needsAuth: false,
        plan: "pro",
        aiUsed,
        limit: null,
        remaining: null,
        gated: false,
        canConsume: true,
        userId,
      };
    }

    const limit = getAiFreeLimit();
    const remaining = Math.max(0, limit - aiUsed);

    return {
      authenticated: true,
      needsAuth: false,
      plan: "free",
      aiUsed,
      limit,
      remaining,
      gated: true,
      canConsume: remaining > 0,
      userId,
    };
  } catch (err) {
    console.error("[ai-quota] user quota lookup failed", err);
    return guestAccess();
  }
}

/**
 * Atomically consume one free AI message. Returns null if denied / exhausted.
 */
export async function consumeAiMessage(
  userId: string,
  limit: number,
): Promise<{ aiUsed: number; remaining: number } | null> {
  try {
    const result = await getPool().query<{ aiUsed: number }>(
      `UPDATE "user"
       SET "aiUsed" = COALESCE("aiUsed", 0) + 1, "updatedAt" = NOW()
       WHERE id = $1
         AND COALESCE(plan, 'free') <> 'pro'
         AND COALESCE("aiUsed", 0) < $2
       RETURNING "aiUsed"`,
      [userId, limit],
    );

    if (result.rowCount !== 1 || !result.rows[0]) {
      return null;
    }

    const aiUsed = Number(result.rows[0].aiUsed);
    return {
      aiUsed,
      remaining: Math.max(0, limit - aiUsed),
    };
  } catch (err) {
    console.error("[ai-quota] consume failed", err);
    return null;
  }
}
