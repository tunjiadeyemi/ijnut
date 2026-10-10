/**
 * Persisted AI chat turns per user + conversation (Cloud AI value: memory you pay to keep).
 * Conversations are bucketed by apiScope (normalized OBSERVABILITY_API_URL).
 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

export type StoredChatTurn = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  apiScope: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
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

/** Normalize OBSERVABILITY_API_URL into a stable conversation bucket key. */
export function normalizeApiScope(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "legacy";
  try {
    const absolute = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(absolute);
    let host = u.hostname.toLowerCase();
    if (host === "127.0.0.1" || host === "0.0.0.0") host = "localhost";
    const port = u.port ? `:${u.port}` : "";
    const path = u.pathname.replace(/\/$/, "") || "";
    return `${u.protocol}//${host}${port}${path}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/$/, "") || "legacy";
  }
}

function titleFromMessage(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  if (t.length <= 60) return t;
  return `${t.slice(0, 57)}...`;
}

export async function ensureAiChatSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getPool();

      await db.query(`
        CREATE TABLE IF NOT EXISTS ai_chat_conversation (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          "apiScope" TEXT NOT NULL,
          title TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ai_chat_conversation_user_scope_updated
          ON ai_chat_conversation ("userId", "apiScope", "updatedAt" DESC);
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS ai_chat_message (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Add conversationId if missing (existing installs).
      await db.query(`
        ALTER TABLE ai_chat_message
          ADD COLUMN IF NOT EXISTS "conversationId" TEXT
          REFERENCES ai_chat_conversation(id) ON DELETE CASCADE;
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS ai_chat_message_user_created
          ON ai_chat_message ("userId", "createdAt" DESC);
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS ai_chat_message_conversation_created
          ON ai_chat_message ("conversationId", "createdAt" DESC);
      `);

      // Migrate orphan messages into one legacy conversation per user.
      const orphans = await db.query<{ userId: string }>(
        `SELECT DISTINCT "userId" FROM ai_chat_message WHERE "conversationId" IS NULL`,
      );
      for (const row of orphans.rows) {
        const convId = randomUUID();
        await db.query(
          `INSERT INTO ai_chat_conversation (id, "userId", "apiScope", title)
           VALUES ($1, $2, 'legacy', 'Previous chat')`,
          [convId, row.userId],
        );
        await db.query(
          `UPDATE ai_chat_message SET "conversationId" = $1
           WHERE "userId" = $2 AND "conversationId" IS NULL`,
          [convId, row.userId],
        );
        const latest = await db.query<{ createdAt: Date }>(
          `SELECT "createdAt" FROM ai_chat_message
           WHERE "conversationId" = $1
           ORDER BY "createdAt" DESC LIMIT 1`,
          [convId],
        );
        if (latest.rows[0]) {
          await db.query(
            `UPDATE ai_chat_conversation SET "updatedAt" = $1 WHERE id = $2`,
            [latest.rows[0].createdAt, convId],
          );
        }
      }

      console.info("[ai-memory] ai_chat_conversation + ai_chat_message ready");
    })().catch((err) => {
      schemaReady = null;
      console.error("[ai-memory] schema ensure failed", err);
      throw err;
    });
  }
  await schemaReady;
}

export async function listConversations(
  userId: string,
  apiScope: string,
  limit = 20,
): Promise<AiConversation[]> {
  await ensureAiChatSchema();
  const scope = normalizeApiScope(apiScope);
  const result = await getPool().query<{
    id: string;
    apiScope: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT id, "apiScope", title, "createdAt", "updatedAt"
     FROM ai_chat_conversation
     WHERE "userId" = $1 AND "apiScope" = $2
     ORDER BY "updatedAt" DESC
     LIMIT $3`,
    [userId, scope, limit],
  );

  return result.rows.map((r) => ({
    id: r.id,
    apiScope: r.apiScope,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createConversation(
  userId: string,
  apiScope: string,
): Promise<AiConversation> {
  await ensureAiChatSchema();
  const scope = normalizeApiScope(apiScope);
  const id = randomUUID();
  const result = await getPool().query<{
    id: string;
    apiScope: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `INSERT INTO ai_chat_conversation (id, "userId", "apiScope")
     VALUES ($1, $2, $3)
     RETURNING id, "apiScope", title, "createdAt", "updatedAt"`,
    [id, userId, scope],
  );
  const r = result.rows[0];
  return {
    id: r.id,
    apiScope: r.apiScope,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Ensure a conversation exists for user+scope; create if list empty. */
export async function getOrCreateLatestConversation(
  userId: string,
  apiScope: string,
): Promise<AiConversation> {
  const list = await listConversations(userId, apiScope, 1);
  if (list[0]) return list[0];
  return createConversation(userId, apiScope);
}

export async function getOwnedConversation(
  userId: string,
  conversationId: string,
  apiScope?: string,
): Promise<AiConversation | null> {
  await ensureAiChatSchema();
  const params: unknown[] = [conversationId, userId];
  let sql = `
    SELECT id, "apiScope", title, "createdAt", "updatedAt"
    FROM ai_chat_conversation
    WHERE id = $1 AND "userId" = $2`;
  if (apiScope != null && apiScope !== "") {
    params.push(normalizeApiScope(apiScope));
    sql += ` AND "apiScope" = $3`;
  }
  const result = await getPool().query<{
    id: string;
    apiScope: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(sql, params);
  const r = result.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    apiScope: r.apiScope,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function loadChatHistory(
  userId: string,
  conversationId: string,
  limit = 40,
): Promise<StoredChatTurn[]> {
  await ensureAiChatSchema();
  const owned = await getOwnedConversation(userId, conversationId);
  if (!owned) return [];

  const result = await getPool().query<{
    role: string;
    content: string;
    createdAt: Date;
  }>(
    `SELECT role, content, "createdAt"
     FROM ai_chat_message
     WHERE "userId" = $1 AND "conversationId" = $2
     ORDER BY "createdAt" DESC
     LIMIT $3`,
    [userId, conversationId, limit],
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
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await ensureAiChatSchema();
  await getPool().query(
    `INSERT INTO ai_chat_message (id, "userId", "conversationId", role, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), userId, conversationId, role, content],
  );
}

export async function appendChatExchange(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  await ensureAiChatSchema();
  const db = getPool();
  await appendChatTurn(userId, conversationId, "user", userMessage);
  await appendChatTurn(userId, conversationId, "assistant", assistantReply);

  const conv = await getOwnedConversation(userId, conversationId);
  if (conv && !conv.title) {
    await db.query(
      `UPDATE ai_chat_conversation
       SET title = $1, "updatedAt" = NOW()
       WHERE id = $2 AND "userId" = $3`,
      [titleFromMessage(userMessage), conversationId, userId],
    );
  } else {
    await db.query(
      `UPDATE ai_chat_conversation SET "updatedAt" = NOW()
       WHERE id = $1 AND "userId" = $2`,
      [conversationId, userId],
    );
  }
}
