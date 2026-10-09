/**
 * AI provider switch: gemini | cohere
 * AI_PROVIDER selects explicitly; otherwise first configured key wins (gemini, then cohere).
 */
import { chatWithCohere, isCohereConfigured } from "./ai-cohere";
import { chatWithGemini, isGeminiConfigured } from "./ai-gemini";
import type { AiProviderName, ChatMessage } from "./ai-types";

export type { AiProviderName, ChatMessage } from "./ai-types";
export { AI_SYSTEM_PROMPT } from "./ai-types";

export function resolveAiProvider(): AiProviderName | null {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "gemini" || raw === "google") {
    return isGeminiConfigured() ? "gemini" : null;
  }
  if (raw === "cohere") {
    return isCohereConfigured() ? "cohere" : null;
  }
  if (isGeminiConfigured()) return "gemini";
  if (isCohereConfigured()) return "cohere";
  return null;
}

export function isAiConfigured(): boolean {
  return resolveAiProvider() != null;
}

export async function chatWithAi(messages: ChatMessage[]): Promise<string> {
  const provider = resolveAiProvider();
  if (provider === "cohere") return chatWithCohere(messages);
  if (provider === "gemini") return chatWithGemini(messages);
  throw new Error(
    "No AI provider configured. Set AI_PROVIDER=gemini|cohere and the matching API key (GEMINI_API_KEY or COHERE_API_KEY).",
  );
}
