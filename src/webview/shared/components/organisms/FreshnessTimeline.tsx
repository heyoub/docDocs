import * as React from 'react';
import { cn } from '../../lib/utils';
import type { FreshnessStatus } from '../../../../protocol';

export interface FreshnessTimelineEntry {
  date: string;
  fresh: number;
  stale: number;
  orphaned: number;
  total: number;
}

export interface FreshnessTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  data: FreshnessTimelineEntry[];
  days?: number;
}

const statusColors: Record<FreshnessStatus | 'total', string> = {
  fresh: 'bg-success',
  stale: 'bg-warning',
  orphaned: 'bg-error',
  missing: 'bg-muted',
  total: 'bg-primary',
};

function FreshnessTimeline({
  data,
  days = 14,
  className,
  ...props
}: FreshnessTimelineProps) {
  // Get last N days of data or pad with empty
  const timelineData = React.useMemo(() => {
    const result: FreshnessTimelineEntry[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;

      const existing = data.find((d) => d.date.startsWith(dateStr));
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          date: dateStr,
          fresh: 0,
          stale: 0,
          orphaned: 0,
          total: 0,
        });
      }
    }
    return result;
  }, [data, days]);

  const maxTotal = Math.max(...timelineData.map((d) => d.total), 1);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={cn('space-y-3', className)} {...props}>
      {/* Chart */}
      <div className="flex items-end gap-1 h-32">
        {timelineData.map((entry) => {
          const height = entry.total > 0 ? (entry.total / maxTotal) * 100 : 0;
          const freshHeight = entry.total > 0 ? (entry.fresh / entry.total) * 100 : 0;
          const staleHeight = entry.total > 0 ? (entry.stale / entry.total) * 100 : 0;
          const orphanedHeight = entry.total > 0 ? (entry.orphaned / entry.total) * 100 : 0;

          return (
            <div
              key={entry.date}
              className="flex-1 flex flex-col justify-end group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                <div className="bg-card border border-border rounded px-2 py-1 text-xs shadow-lg whitespace-nowrap">
                  <p className="font-medium">{formatDate(entry.date)}</p>
                  <p className="text-success">Fresh: {entry.fresh}</p>
                  <p className="text-warning">Stale: {entry.stale}</p>
                  <p className="text-error">Orphaned: {entry.orphaned}</p>
                </div>
              </div>

              {/* Stacked bar */}
              <div
                className="w-full rounded-t overflow-hidden flex flex-col-reverse transition-all hover:opacity-80"
                style={{ height: `${height}%`, minHeight: entry.total > 0 ? '4px' : '0' }}
              >
                <div
                  className={statusColors.fresh}
                  style={{ height: `${freshHeight}%` }}
                />
                <div
                  className={statusColors.stale}
                  style={{ height: `${staleHeight}%` }}
                />
                <div
                  className={statusColors.orphaned}
                  style={{ height: `${orphanedHeight}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1 text-xs text-muted-foreground">
        {timelineData.map((entry, idx) => (
          <div key={entry.date} className="flex-1 text-center truncate">
            {idx === 0 || idx === timelineData.length - 1 || idx === Math.floor(timelineData.length / 2)
              ? formatDate(entry.date)
              : ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success" />
          <span>Fresh</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning" />
          <span>Stale</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-error" />
          <span>Orphaned</span>
        </div>
      </div>
    </div>
  );
}

export { FreshnessTimeline };
