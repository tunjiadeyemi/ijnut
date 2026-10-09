/**
 * Bachs secrets live on demo-api. Dashboard only asks the API if billing is on
 * (for UpgradeGate) — checkout/portal/webhooks go through the API.
 */
import { obsFetch } from '@/shared/api/client.server';

export async function isBachsConfigured(): Promise<boolean> {
  try {
    const status = await obsFetch<{ configured: boolean }>(
      '/observability/billing/status'
    );
    return status.configured;
  } catch {
    return false;
  }
}
