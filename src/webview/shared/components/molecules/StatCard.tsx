import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

function StatCard({
  label,
  value,
  trend,
  description,
  variant = 'default',
  className,
  ...props
}: StatCardProps) {
  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
        ? TrendingDown
        : Minus;

  return (
    <div
      className={cn(
        'rounded border border-border bg-card p-3',
        className
      )}
      {...props}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p
          className={cn(
            'text-2xl font-semibold',
            variant === 'default' && 'text-foreground',
            variant === 'success' && 'text-success',
            variant === 'warning' && 'text-warning',
            variant === 'error' && 'text-error'
          )}
        >
          {value}
        </p>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs',
              trend.direction === 'up' && 'text-success',
              trend.direction === 'down' && 'text-error',
              trend.direction === 'neutral' && 'text-muted-foreground'
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trend.value}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export { StatCard };
