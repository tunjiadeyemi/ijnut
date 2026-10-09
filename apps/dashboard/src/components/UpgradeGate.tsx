export type GateCta = {
  upgrade: string;
  selfHost: string;
};

type Props = {
  title?: string;
  message: string;
  cta?: GateCta;
  className?: string;
};

export function UpgradeGate({
  title = "Limit reached",
  message,
  cta,
  className = "",
}: Props) {
  return (
    <div
      className={`rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm ${className}`}
      role="status"
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {message}
      </p>
      {cta ? (
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
          <li>{cta.upgrade}</li>
          <li>{cta.selfHost}</li>
        </ul>
      ) : null}
    </div>
  );
}
