import { useAtom, useAtomValue } from 'jotai';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Filter,
} from 'lucide-react';
import {
  freshnessFilterAtom,
  filteredFreshnessAtom,
  freshnessStatsAtom,
  configLoadingAtom,
  searchQueryAtom,
} from '../../shared/store';
import { useVSCodeCommand, useOpenFile, usePostMessage, useFreshnessHistory } from '../../shared/hooks';
import { Button } from '../../shared/components/atoms/Button';
import { Skeleton } from '../../shared/components/atoms/Skeleton';
import { Badge } from '../../shared/components/atoms/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/components/atoms/Select';
import { SearchInput } from '../../shared/components/molecules/SearchInput';
import { StatusBadge } from '../../shared/components/molecules/StatusBadge';
import { EmptyState } from '../../shared/components/molecules/EmptyState';
import { FreshnessTimeline } from '../../shared/components/organisms/FreshnessTimeline';
import { formatRelativeTime, getFileName } from '../../shared/lib/utils';

function FreshnessHeader() {
  const stats = useAtomValue(freshnessStatsAtom);
  const runCommand = useVSCodeCommand();
  const postMessage = usePostMessage();

  const handleRegenerateStale = () => {
    postMessage({
      type: 'generation:start',
      payload: { paths: [], force: false },
    });
  };

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Documentation Freshness</h1>
        <p className="text-muted-foreground mt-1">
          {stats.fresh} fresh, {stats.stale} stale, {stats.orphaned} orphaned
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => runCommand('docdocs.checkFreshness')}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
        {stats.stale > 0 && (
          <Button onClick={handleRegenerateStale}>
            Regenerate {stats.stale} Stale
          </Button>
        )}
      </div>
    </div>
  );
}

function FreshnessStats() {
  const stats = useAtomValue(freshnessStatsAtom);
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-muted">
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <span className="text-sm text-muted-foreground">Fresh</span>
        </div>
        <p className="text-2xl font-semibold text-success">{stats.fresh}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-muted">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <span className="text-sm text-muted-foreground">Stale</span>
        </div>
        <p className="text-2xl font-semibold text-warning">{stats.stale}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-muted">
            <Trash2 className="h-4 w-4 text-error" />
          </div>
          <span className="text-sm text-muted-foreground">Orphaned</span>
        </div>
        <p className="text-2xl font-semibold text-error">{stats.orphaned}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded bg-muted">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Fresh Rate</span>
        </div>
        <p className="text-2xl font-semibold">
          {Math.round(stats.freshPercent * 100)}%
        </p>
      </div>
    </div>
  );
}

function FreshnessHistorySection() {
  const history = useFreshnessHistory();
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-4">Freshness History (14 Days)</h2>
      <FreshnessTimeline data={history} days={14} />
    </div>
  );
}

function FreshnessFilters() {
  const [filter, setFilter] = useAtom(freshnessFilterAtom);
  const [query, setQuery] = useAtom(searchQueryAtom);
  const filteredEntries = useAtomValue(filteredFreshnessAtom);

  return (
    <div className="flex items-center gap-4">
      <SearchInput
        placeholder="Search files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery('')}
        className="w-64"
      />
      <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <SelectTrigger className="w-40">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="fresh">Fresh Only</SelectItem>
          <SelectItem value="stale">Stale Only</SelectItem>
          <SelectItem value="orphaned">Orphaned Only</SelectItem>
        </SelectContent>
      </Select>
      <Badge variant="muted">
        {filteredEntries.length} file{filteredEntries.length !== 1 ? 's' : ''}
      </Badge>
    </div>
  );
}

function FreshnessList() {
  const filteredEntries = useAtomValue(filteredFreshnessAtom);
  const openFile = useOpenFile();
  const runCommand = useVSCodeCommand();

  if (filteredEntries.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No matching files"
        description="Try adjusting your filters or search query"
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      {filteredEntries.map(([path, entry]) => (
        <div
          key={path}
          className="flex items-center gap-4 p-3 hover:bg-list-hover"
        >
          <StatusBadge status={entry.status} showLabel={false} />
          <div className="min-w-0 flex-1">
            <button
              className="text-sm font-medium hover:underline truncate block text-left"
              onClick={() => openFile(path)}
            >
              {getFileName(path)}
            </button>
            <p className="text-xs text-muted-foreground truncate">{path}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">
              {entry.lastModified
                ? `Modified ${formatRelativeTime(entry.lastModified)}`
                : 'No modification date'}
            </p>
            <p className="text-xs text-muted-foreground">
              Checked {formatRelativeTime(entry.lastChecked)}
            </p>
          </div>
          {entry.status === 'stale' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCommand('docdocs.generateFile', [path])}
            >
              Regenerate
            </Button>
          )}
          {entry.status === 'orphaned' && (
            <Button variant="outline" size="sm" className="text-error">
              Delete
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FreshnessPage() {
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FreshnessHeader />
      <FreshnessStats />
      <FreshnessHistorySection />
      <FreshnessFilters />
      <FreshnessList />
    </div>
  );
}
