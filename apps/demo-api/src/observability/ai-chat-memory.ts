/**
 * Persisted AI chat turns per user (Cloud AI value: memory you pay to keep).
 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

export type StoredChatTurn = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  const connectionString =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for AI chat memory");
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

export async function ensureAiChatSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS ai_chat_message (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ai_chat_message_user_created
          ON ai_chat_message ("userId", "createdAt" DESC);
      `);
      console.info("[ai-memory] ai_chat_message table ready");
    })().catch((err) => {
      schemaReady = null;
      console.error("[ai-memory] schema ensure failed", err);
      throw err;
    });
  }
  await schemaReady;
}

export async function loadChatHistory(
  userId: string,
  limit = 40,
): Promise<StoredChatTurn[]> {
  await ensureAiChatSchema();
  const result = await getPool().query<{
    role: string;
    content: string;
    createdAt: Date;
  }>(
    `SELECT role, content, "createdAt"
     FROM ai_chat_message
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC
     LIMIT $2`,
    [userId, limit],
  );

  return result.rows
    .reverse()
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    }));
}

export async function appendChatTurn(
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await ensureAiChatSchema();
  await getPool().query(
    `INSERT INTO ai_chat_message (id, "userId", role, content)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, role, content],
  );
}

export async function appendChatExchange(
  userId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  await appendChatTurn(userId, "user", userMessage);
  await appendChatTurn(userId, "assistant", assistantReply);
}
