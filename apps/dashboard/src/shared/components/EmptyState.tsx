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
      className={`text-muted-foreground flex flex-col items-center justify-center gap-2 px-3 py-8 text-center sm:px-4 sm:py-10 ${className}`}
      role="status"
    >
      <Icon className="size-7 opacity-40 sm:size-8" strokeWidth={1.25} aria-hidden />
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="max-w-[16rem] text-xs leading-relaxed sm:max-w-[18rem]">{description}</p>
    </div>
  );
}
