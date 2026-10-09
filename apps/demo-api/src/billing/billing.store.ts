import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for billing");
  }
  if (!pool) {
    const local =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1");
    pool = new Pool({
      connectionString,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function getBillingIds(userId: string): Promise<{
  customerId: string | null;
  subscriptionId: string | null;
}> {
  const result = await getPool().query<{
    bachsCustomerId: string | null;
    bachsSubscriptionId: string | null;
  }>(
    `SELECT "bachsCustomerId", "bachsSubscriptionId" FROM "user" WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    customerId: row?.bachsCustomerId ?? null,
    subscriptionId: row?.bachsSubscriptionId ?? null,
  };
}

export async function applyUserBilling(opts: {
  userId?: string | null;
  customerId?: string | null;
  plan: "free" | "pro";
  nextCustomerId?: string | null;
  nextSubscriptionId?: string | null;
}): Promise<void> {
  if (opts.userId) {
    await getPool().query(
      `UPDATE "user"
       SET plan = $2,
           "bachsCustomerId" = COALESCE($3, "bachsCustomerId"),
           "bachsSubscriptionId" = COALESCE($4, "bachsSubscriptionId"),
           "updatedAt" = NOW()
       WHERE id = $1`,
      [
        opts.userId,
        opts.plan,
        opts.nextCustomerId ?? null,
        opts.nextSubscriptionId ?? null,
      ],
    );
    return;
  }

  if (opts.customerId) {
    await getPool().query(
      `UPDATE "user"
       SET plan = $2,
           "bachsSubscriptionId" = COALESCE($3, "bachsSubscriptionId"),
           "updatedAt" = NOW()
       WHERE "bachsCustomerId" = $1`,
      [opts.customerId, opts.plan, opts.nextSubscriptionId ?? null],
    );
  }
}
