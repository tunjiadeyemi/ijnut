import { Pool } from "pg";

/** Fail fast / log clearly if Railway Postgres is missing auth tables. */
export async function checkAuthDatabase(): Promise<void> {
  const connectionString =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("[auth] DATABASE_URL is not set — GitHub/email sign-in will 500");
    return;
  }

  const local =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");
  const pool = new Pool({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });

  try {
    await pool.query(`SELECT 1 FROM "user" LIMIT 1`);
    await pool.query(`SELECT 1 FROM session LIMIT 1`);
    console.info("[auth] Postgres auth tables OK");
  } catch (err) {
    console.error(
      "[auth] Postgres auth schema missing or unreachable. Run: pnpm --filter dashboard auth:migrate (against this DATABASE_URL).",
      err,
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}
