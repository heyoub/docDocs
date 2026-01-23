import * as React from 'react';
import { cn, formatPercent } from '../../lib/utils';

export interface CoverageDonutProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

function CoverageDonut({
  value,
  size = 'md',
  showLabel = true,
  label = 'Coverage',
  className,
  ...props
}: CoverageDonutProps) {
  const clampedValue = Math.max(0, Math.min(1, value));
  const percentage = clampedValue * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (clampedValue * circumference);

  const sizeConfig = {
    sm: { container: 'w-16 h-16', text: 'text-sm', label: 'text-xs' },
    md: { container: 'w-24 h-24', text: 'text-xl', label: 'text-xs' },
    lg: { container: 'w-32 h-32', text: 'text-2xl', label: 'text-sm' },
  };

  const getColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-error';
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        sizeConfig[size].container,
        className
      )}
      {...props}
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn('transition-all duration-500', getColor())}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-semibold', sizeConfig[size].text, getColor())}>
          {formatPercent(clampedValue, 0)}
        </span>
        {showLabel && (
          <span
            className={cn('text-muted-foreground', sizeConfig[size].label)}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export { CoverageDonut };
