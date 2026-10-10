/**
 * Bachs secrets live on the Cloud AI API. Dashboard only asks if billing is on
 * (for UpgradeGate) — checkout/portal/webhooks go through that host.
 */
import { cloudAiFetch } from '@/shared/api/client.server';

export async function isBachsConfigured(): Promise<boolean> {
  try {
    const status = await cloudAiFetch<{ configured: boolean }>(
      '/observability/billing/status'
    );
    return status.configured;
  } catch {
    return false;
  }
}
