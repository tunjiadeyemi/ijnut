/**
 * Dashboard no longer opens Postgres — auth/billing/AI quota live on demo-api.
 */
export function getAuthDatabaseUrl(): string | undefined {
  return (
    process.env.AUTH_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || undefined
  );
}

export function getAuthPool(): never {
  throw new Error(
    'Dashboard must not open Postgres. Use the API (auth proxy / observability billing).'
  );
}
