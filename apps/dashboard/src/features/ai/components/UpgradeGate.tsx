import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';

import { createCheckout } from '@/features/billing/functions';
import { Button } from '@/shared/components/ui/button';

export type GateCta = {
  upgrade: string;
  selfHost: string;
  signIn?: string;
};

type Props = {
  title?: string;
  message: string;
  cta?: GateCta;
  needsAuth?: boolean;
  billingConfigured?: boolean;
  className?: string;
};

export function UpgradeGate({
  title = 'Limit reached',
  message,
  cta,
  needsAuth,
  billingConfigured,
  className = ''
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubscribe() {
    setError(null);
    setPending(true);
    try {
      const result = await createCheckout({
        data: { returnOrigin: window.location.origin }
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`rounded-lg border border-border bg-background/95 px-3 py-2.5 text-sm shadow-sm ${className}`}
      role="status"
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{message}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {needsAuth ? (
          <Button asChild size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
        ) : null}
        {!needsAuth && billingConfigured ? (
          <Button type="button" size="sm" disabled={pending} onClick={() => void onSubscribe()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Subscribe
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-destructive mt-2 text-xs">{error}</p> : null}

      {cta ? (
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
          {needsAuth && cta.signIn ? <li>{cta.signIn}</li> : null}
          {!needsAuth ? <li>{cta.upgrade}</li> : null}
          <li>{cta.selfHost}</li>
        </ul>
      ) : null}
    </div>
  );
}
