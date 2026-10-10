import {
  Cell,
  Grid,
  Gridline,
  type CellProps,
  type GridlineProps,
  type GridProps
} from 'react-resizable-panels';

import { cn } from '@/shared/lib/utils';

export function ResizableGrid({ className, ...props }: GridProps) {
  return <Grid className={cn('h-full w-full', className)} {...props} />;
}

export function ResizableCell({ className, ...props }: CellProps) {
  return <Cell className={cn('min-h-0 min-w-0 overflow-hidden', className)} {...props} />;
}

export function ResizableGridline({ className, ...props }: GridlineProps) {
  return (
    <Gridline
      className={cn(
        'bg-border z-10 transition-colors hover:bg-primary/40',
        'aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px',
        className
      )}
      {...props}
    />
  );
}
