/**
 * Gemini chat via Google's OpenAI-compatible endpoint.
 * Lives on demo-api so cloud quota cannot be bypassed by a rogue dashboard.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
      "GEMINI_API_KEY is not set on the API. Add it to the demo-api / root .env.",
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

export const AI_SYSTEM_PROMPT = `You are an assistant inside IJNUT.
You help developers understand API performance using ONLY the metrics JSON provided in the conversation.

You can:
1) Explain why a request looks slow/fast (use spans when present: db vs cache vs other).
2) Summarize a load/stress test report in plain language.
3) Answer questions about routes, errors, p95, and recent requests.
4) Suggest practical fixes (indexes, caching, rate limits, auth mistakes) — clearly labeled as suggestions, not guarantees.

Rules:
- Be concise and use simple words.
- If data is missing, say what is missing instead of guessing.
- Never invent SQL results or metrics that are not in the context.
- Do not ask the user to paste secrets. Do not request API keys.
- Prefer short bullet points when listing findings.`;
