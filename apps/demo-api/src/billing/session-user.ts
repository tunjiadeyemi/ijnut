import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
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

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function resolveSessionUser(
  sessionToken: string | undefined,
): Promise<SessionUser | null> {
  const token = sessionToken?.trim();
  if (!token) return null;

  const result = await getPool().query<{
    id: string;
    email: string;
    name: string | null;
  }>(
    `SELECT u.id, u.email, u.name
     FROM session s
     JOIN "user" u ON u.id = s."userId"
     WHERE s.token = $1 AND s."expiresAt" > NOW()
     LIMIT 1`,
    [token],
  );
  return result.rows[0] ?? null;
}
