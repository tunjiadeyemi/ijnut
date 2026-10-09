import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/components/ThemeProvider';
import { Button } from '@/shared/components/ui/button';
import { HoverIconLabel } from '@/shared/components/HoverIconLabel';

type Props = {
  className?: string;
  /** Compact icon-only (login). Default: hover label like dashboard actions. */
  compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: Props) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? 'icon' : 'sm'}
      className={compact ? className : `group h-8 px-2 ${className ?? ''}`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      {dark ? <Sun className="size-3.5 shrink-0" /> : <Moon className="size-3.5 shrink-0" />}
      {!compact ? <HoverIconLabel>{dark ? 'Light' : 'Dark'}</HoverIconLabel> : null}
    </Button>
  );
}
