import * as React from 'react';
import { CheckCircle, AlertTriangle, Trash2, FileQuestion } from 'lucide-react';
import { Badge, type BadgeProps } from '../atoms/Badge';
import { cn } from '../../lib/utils';
import type { FreshnessStatus } from '../../../../protocol';

const statusConfig: Record<
  FreshnessStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    variant: BadgeProps['variant'];
    label: string;
  }
> = {
  fresh: {
    icon: CheckCircle,
    variant: 'success',
    label: 'Fresh',
  },
  stale: {
    icon: AlertTriangle,
    variant: 'warning',
    label: 'Stale',
  },
  orphaned: {
    icon: Trash2,
    variant: 'error',
    label: 'Orphaned',
  },
  missing: {
    icon: FileQuestion,
    variant: 'outline',
    label: 'Missing',
  },
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: FreshnessStatus;
  showLabel?: boolean;
  showIcon?: boolean;
}

function StatusBadge({
  status,
  showLabel = true,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn('gap-1', className)} {...props}>
      {showIcon && <Icon className="h-3 w-3" />}
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

export { StatusBadge };
