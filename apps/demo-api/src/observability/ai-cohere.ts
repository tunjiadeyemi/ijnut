/**
 * Cohere Chat API v2 — https://docs.cohere.com/reference/chat
 */
import type { ChatMessage } from "./ai-types";

const DEFAULT_MODEL = "command-r-plus";

function resolveModel(): string {
  return process.env.COHERE_MODEL?.trim() || DEFAULT_MODEL;
}

export function cohereApiKey(): string | undefined {
  return (
    process.env.COHERE_API_KEY?.trim() ||
    process.env.CO_API_KEY?.trim() ||
    undefined
  );
}

export function isCohereConfigured(): boolean {
  return Boolean(cohereApiKey());
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as {
      message?: unknown;
      detail?: unknown;
      error?: { message?: unknown };
    };
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.detail === "string" && o.detail.trim()) return o.detail;
    if (o.error?.message != null) return String(o.error.message);
  }
  return `Cohere HTTP ${status}`;
}

function extractText(body: unknown): string | null {
  const message = (body as { message?: { content?: unknown } })?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const b = block as { type?: string; text?: string };
        if (b.type === "text" && typeof b.text === "string") return b.text;
        if (typeof b.text === "string") return b.text;
        return "";
      })
      .filter(Boolean);
    const joined = parts.join("").trim();
    return joined || null;
  }
  // Older shapes
  const text = (body as { text?: string })?.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  return null;
}

export async function chatWithCohere(messages: ChatMessage[]): Promise<string> {
  const apiKey = cohereApiKey();
  if (!apiKey) {
    throw new Error(
      "COHERE_API_KEY (or CO_API_KEY) is not set on the API. Add it to demo-api env.",
    );
  }

  const base = (
    process.env.COHERE_BASE_URL ?? "https://api.cohere.com"
  ).replace(/\/$/, "");
  const model = resolveModel();

  const res = await fetch(`${base}/v2/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      stream: false,
    }),
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(body, res.status));
  }

  const content = extractText(body);
  if (!content) {
    throw new Error("Cohere returned an empty reply");
  }
  return content;
}
