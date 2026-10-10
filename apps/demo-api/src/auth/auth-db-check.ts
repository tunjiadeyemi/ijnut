import { getMigrations } from "better-auth/db/migration";
import { auth } from "./auth";

/**
 * Create better-auth tables/columns on startup if missing (Railway-friendly).
 */
export async function ensureAuthSchema(): Promise<void> {
  try {
    const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(
      auth.options,
    );

    if (toBeCreated.length === 0 && toBeAdded.length === 0) {
      console.info("[auth] Postgres schema up to date");
      return;
    }

    console.info(
      "[auth] Migrating tables:",
      toBeCreated.map((t) => t.table).join(", ") || "(none)",
    );
    console.info(
      "[auth] Migrating columns:",
      toBeAdded.map((t) => t.table).join(", ") || "(none)",
    );
    await runMigrations();
    console.info("[auth] Migrations applied");
  } catch (err) {
    console.error(
      "[auth] Schema migrate failed — GitHub/email sign-in will 500 until DATABASE_URL is reachable and migrate succeeds.",
      err,
    );
  }

  try {
    const { ensureAiChatSchema } = await import(
      "../observability/ai-chat-memory"
    );
    await ensureAiChatSchema();
  } catch (err) {
    console.error("[auth] AI chat memory schema ensure failed", err);
  }
}
