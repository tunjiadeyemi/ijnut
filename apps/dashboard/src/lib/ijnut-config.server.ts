/**
 * IJNUT deployment mode + public API URL (server-only).
 * cloud = you host the API (gate Gemini/stress); selfhost = their box, their keys.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

export type IjnutMode = "cloud" | "selfhost";
export type IjnutPlan = "free" | "pro";

export const DEFAULT_GATE_CTA: { upgrade: string; selfHost: string } = {
  upgrade:
    "Unlock higher AI and stress limits on IJNUT Cloud (set IJNUT_PLAN=pro).",
  selfHost:
    "Or self-host: docker compose up --build, set your own GEMINI_API_KEY — no IJNUT fees.",
};

export function getIjnutMode(): IjnutMode {
  const raw = (process.env.IJNUT_MODE ?? "selfhost").trim().toLowerCase();
  return raw === "cloud" ? "cloud" : "selfhost";
}

export function getIjnutPlan(): IjnutPlan {
  const raw = (process.env.IJNUT_PLAN ?? "free").trim().toLowerCase();
  return raw === "pro" ? "pro" : "free";
}

/** URL stress / Demo API UI should use (public hostname, not docker-internal). */
export function getPublicApiUrl(): string {
  return (
    process.env.IJNUT_PUBLIC_API_URL?.trim() ||
    process.env.DEMO_PUBLIC_URL?.trim() ||
    process.env.OBSERVABILITY_API_URL?.trim() ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

export function getAiDailyLimit(): number {
  if (getIjnutMode() === "selfhost") return Number.POSITIVE_INFINITY;
  if (getIjnutPlan() === "pro") {
    return Number(process.env.IJNUT_AI_DAILY_LIMIT_PRO ?? 200);
  }
  return Number(process.env.IJNUT_AI_DAILY_LIMIT ?? 5);
}

export function isAiGated(): boolean {
  return getIjnutMode() === "cloud" && getIjnutPlan() === "free";
}
