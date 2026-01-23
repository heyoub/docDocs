import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-badge text-badge-foreground ring-transparent',
        secondary: 'bg-secondary text-secondary-foreground ring-secondary/50',
        success: 'bg-success/15 text-success ring-success/30',
        warning: 'bg-warning/15 text-warning ring-warning/30',
        error: 'bg-error/15 text-error ring-error/30',
        info: 'bg-info/15 text-info ring-info/30',
        outline: 'bg-transparent text-foreground ring-border',
        primary: 'bg-primary/15 text-primary ring-primary/30',
        muted: 'bg-muted text-muted-foreground ring-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
