import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

/** Compact empty panel — no card chrome; fits dashboard sections. */
export function EmptyState({ icon: Icon, title, description, className = '' }: Props) {
  return (
    <div
      className={`text-muted-foreground flex flex-col items-center justify-center gap-2 px-4 py-10 text-center ${className}`}
      role="status"
    >
      <Icon className="size-8 opacity-40" strokeWidth={1.25} aria-hidden />
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="max-w-[18rem] text-xs leading-relaxed">{description}</p>
    </div>
  );
}
