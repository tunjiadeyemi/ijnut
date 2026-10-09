/**
 * better-auth lives on demo-api. Dashboard proxies /api/auth/* here.
 * baseURL is the public dashboard URL (OAuth redirects / cookies via BFF).
 */
import { betterAuth } from "better-auth";
import { Pool } from "pg";

function authSecret(): string {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    "dev-only-ijnut-auth-secret-change-me";
  if (secret.length < 32) {
    return `${secret}${"x".repeat(32 - secret.length)}`;
  }
  return secret;
}

/** Public dashboard origin — OAuth callback hits the BFF, which proxies here. */
function authBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim() ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

function databaseUrl(): string {
  const url =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required for auth on demo-api");
  }
  return url;
}

function pgPool(): Pool {
  const connectionString = databaseUrl();
  const local =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");
  return new Pool({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
}

const githubId = process.env.GITHUB_CLIENT_ID?.trim();
const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
const dashboardOrigin = authBaseUrl();

export const auth = betterAuth({
  database: pgPool(),
  secret: authSecret(),
  baseURL: dashboardOrigin,
  trustedOrigins: [dashboardOrigin, "http://127.0.0.1:3001", "http://localhost:3001"],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const resendKey = process.env.RESEND_API_KEY?.trim();
      const from =
        process.env.RESEND_FROM?.trim() || "IJNUT <onboarding@resend.dev>";
      if (!resendKey) {
        console.info(`[auth] Password reset for ${user.email}: ${url}`);
        return;
      }
      void fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: "Reset your IJNUT password",
          text: `Reset your password: ${url}`,
        }),
      }).catch((err) => console.error("[auth] Resend failed", err));
    },
  },
  socialProviders:
    githubId && githubSecret
      ? {
          github: {
            clientId: githubId,
            clientSecret: githubSecret,
          },
        }
      : undefined,
  user: {
    additionalFields: {
      plan: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: false,
        returned: true,
      },
      aiUsed: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
        returned: true,
      },
      bachsCustomerId: {
        type: "string",
        required: false,
        defaultValue: undefined,
        input: false,
        returned: false,
      },
      bachsSubscriptionId: {
        type: "string",
        required: false,
        defaultValue: undefined,
        input: false,
        returned: false,
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;

export function isGithubAuthConfigured(): boolean {
  return Boolean(githubId && githubSecret);
}
