/**
 * Gemini chat via Google's OpenAI-compatible endpoint.
 */
import type { ChatMessage } from "./ai-types";

const RETIRED_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
]);

const DEFAULT_MODEL = "gemini-2.5-flash";

function resolveModel(): string {
  const raw = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (RETIRED_MODELS.has(raw)) return DEFAULT_MODEL;
  return raw;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function extractErrorMessage(body: unknown, status: number): string {
  if (Array.isArray(body) && body[0] && typeof body[0] === "object") {
    const first = body[0] as { error?: { message?: unknown } };
    if (first.error?.message != null) return String(first.error.message);
  }
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { message?: unknown } }).error;
    if (err?.message != null) return String(err.message);
  }
  return `Gemini HTTP ${status}`;
}

export async function chatWithGemini(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set on the API. Add it to demo-api env.",
    );
  }

  const base = (
    process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai"
  ).replace(/\/$/, "");
  const model = resolveModel();

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
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

  const content = (
    body as {
      choices?: Array<{ message?: { content?: string } }>;
    }
  )?.choices?.[0]?.message?.content;

  if (!content?.trim()) {
    throw new Error("Gemini returned an empty reply");
  }

  return content.trim();
}
