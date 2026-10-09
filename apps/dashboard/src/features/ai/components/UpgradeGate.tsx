import { Link } from '@tanstack/react-router';

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
  className?: string;
};

export function UpgradeGate({
  title = 'Limit reached',
  message,
  cta,
  needsAuth,
  className = ''
}: Props) {
  return (
    <div
      className={`rounded-lg border border-border bg-background/95 px-3 py-2.5 text-sm shadow-sm ${className}`}
      role="status"
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{message}</p>
      {needsAuth ? (
        <Link
          to="/login"
          className="text-primary mt-2 inline-block text-xs font-medium underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      ) : null}
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
