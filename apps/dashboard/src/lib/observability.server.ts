/**
 * Server-only BFF helpers. Admin token never goes to the browser bundle.
 * Prefer session cookie from login gate; never expose via VITE_*.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { getCookie } from "@tanstack/react-start/server";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

export const ADMIN_COOKIE = "obs_admin_token";

export function getApiUrl(): string {
  return (
    process.env.OBSERVABILITY_API_URL ?? "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

/** Token from httpOnly login cookie only (gate UI). */
export function getSessionToken(): string | undefined {
  return getCookie(ADMIN_COOKIE);
}

export async function validateAdminToken(token: string): Promise<boolean> {
  const res = await fetch(`${getApiUrl()}/observability/overview`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return res.ok;
}

export async function obsFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getSessionToken();
  if (!token) {
    const err = new Error("Not authenticated") as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${res.status}`;
    const err = new Error(message) as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body as T;
}
