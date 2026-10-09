/**
 * Apply better-auth schema (user/session/account/verification + plan/aiUsed).
 * Usage: pnpm --filter dashboard auth:migrate
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(root, '../../.env') });
loadEnv({ path: resolve(root, '.env') });

const connectionString =
  process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error('[auth] DATABASE_URL (or AUTH_DATABASE_URL) is required');
  process.exit(1);
}

const auth = betterAuth({
  database: new Pool({ connectionString }),
  secret:
    process.env.BETTER_AUTH_SECRET?.trim() ||
    'dev-only-ijnut-auth-secret-change-me',
  baseURL: (process.env.BETTER_AUTH_URL ?? 'http://127.0.0.1:3001').replace(
    /\/$/,
    ''
  ),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      plan: {
        type: 'string',
        required: false,
        defaultValue: 'free',
        input: false
      },
      aiUsed: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false
      },
      bachsCustomerId: {
        type: 'string',
        required: false,
        input: false
      },
      bachsSubscriptionId: {
        type: 'string',
        required: false,
        input: false
      }
    }
  }
});

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

if (toBeCreated.length === 0 && toBeAdded.length === 0) {
  console.log('[auth] Schema already up to date');
  process.exit(0);
}

console.log(
  '[auth] Creating:',
  toBeCreated.map((t) => t.table).join(', ') || '(none)'
);
console.log(
  '[auth] Adding columns:',
  toBeAdded.map((t) => t.table).join(', ') || '(none)'
);
await runMigrations();
console.log('[auth] Migrations applied');
process.exit(0);
