import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ActionCardProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: 'default' | 'primary' | 'secondary';
}

function ActionCard({
  icon: Icon,
  title,
  description,
  variant = 'default',
  className,
  disabled,
  ...props
}: ActionCardProps) {
  return (
    <button
      className={cn(
        'flex items-start gap-3 rounded border p-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variant === 'default' && 'border-border bg-card hover:bg-list-hover',
        variant === 'primary' &&
          'border-primary/30 bg-primary/10 hover:bg-primary/20',
        variant === 'secondary' &&
          'border-secondary bg-secondary hover:bg-secondary-hover',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      disabled={disabled}
      {...props}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded',
          variant === 'default' && 'bg-muted',
          variant === 'primary' && 'bg-primary/20 text-primary',
          variant === 'secondary' && 'bg-muted'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}

export { ActionCard };
