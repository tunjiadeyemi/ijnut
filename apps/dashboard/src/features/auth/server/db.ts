import { Pool } from 'pg';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '../../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

let pool: Pool | null = null;

export function getAuthDatabaseUrl(): string | undefined {
  const url =
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function getAuthPool(): Pool {
  const connectionString = getAuthDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL (or AUTH_DATABASE_URL) is required for auth / AI quota'
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString });
  }
  return pool;
}
