/**
 * Observability service key — protects /observability/* (and related BFF calls).
 * Preferred env: OBSERVABILITY_SERVICE_KEY
 * Legacy aliases: ADMIN_TOKEN
 */
export function getObservabilityServiceKey(): string | undefined {
  return (
    process.env.OBSERVABILITY_SERVICE_KEY?.trim() ||
    process.env.ADMIN_TOKEN?.trim() ||
    undefined
  );
}
