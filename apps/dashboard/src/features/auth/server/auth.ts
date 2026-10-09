import { betterAuth } from 'better-auth';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { Pool } from 'pg';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

import { getAuthDatabaseUrl } from './db';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

function authSecret(): string {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    'dev-only-ijnut-auth-secret-change-me';
  if (secret.length < 32) {
    return `${secret}${'x'.repeat(32 - secret.length)}`;
  }
  return secret;
}

function authBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim() ||
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}

const connectionString = getAuthDatabaseUrl();
if (!connectionString) {
  console.warn(
    '[auth] DATABASE_URL missing — sign-in / AI quota will fail until Postgres is configured'
  );
}

const githubId = process.env.GITHUB_CLIENT_ID?.trim();
const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

export const auth = betterAuth({
  database: new Pool({
    connectionString:
      connectionString ?? 'postgres://postgres:postgres@127.0.0.1:5433/api_obs'
  }),
  secret: authSecret(),
  baseURL: authBaseUrl(),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const resendKey = process.env.RESEND_API_KEY?.trim();
      const from = process.env.RESEND_FROM?.trim() || 'IJNUT <onboarding@resend.dev>';
      if (!resendKey) {
        console.info(`[auth] Password reset for ${user.email}: ${url}`);
        return;
      }
      void fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: user.email,
          subject: 'Reset your IJNUT password',
          text: `Reset your password: ${url}`
        })
      }).catch((err) => console.error('[auth] Resend failed', err));
    }
  },
  socialProviders:
    githubId && githubSecret
      ? {
          github: {
            clientId: githubId,
            clientSecret: githubSecret
          }
        }
      : undefined,
  user: {
    additionalFields: {
      plan: {
        type: 'string',
        required: false,
        defaultValue: 'free',
        input: false,
        returned: true
      },
      aiUsed: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false,
        returned: true
      }
    }
  },
  plugins: [tanstackStartCookies()]
});

export type AuthSession = typeof auth.$Infer.Session;
