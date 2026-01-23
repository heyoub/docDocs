import { useAtomValue, useSetAtom } from 'jotai';
import {
  FileText,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import {
  freshnessStatsAtom,
  coveragePercentAtom,
  recentDocsAtom,
  watchModeAtom,
  isGeneratingAtom,
  generationProgressAtom,
  configLoadingAtom,
  activePageAtom,
} from '../../shared/store';
import { useVSCodeCommand, useOpenFile } from '../../shared/hooks';
import { Button } from '../../shared/components/atoms/Button';
import { Progress } from '../../shared/components/atoms/Progress';
import { Skeleton } from '../../shared/components/atoms/Skeleton';
import { Separator } from '../../shared/components/atoms/Separator';
import { StatCard } from '../../shared/components/molecules/StatCard';
import { ActionCard } from '../../shared/components/molecules/ActionCard';
import { CoverageDonut } from '../../shared/components/organisms/CoverageDonut';
import { formatRelativeTime, getFileName } from '../../shared/lib/utils';

function WelcomeHeader() {
  const runCommand = useVSCodeCommand();
  const isGenerating = useAtomValue(isGeneratingAtom);

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Documentation Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage your project's documentation
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => runCommand('docdocs.generateWorkspace')}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate All
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function GenerationProgressBanner() {
  const progress = useAtomValue(generationProgressAtom);

  if (!progress || progress.status !== 'processing') {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <p className="font-medium">Generating documentation...</p>
          <p className="text-sm text-muted-foreground">
            {progress.current} of {progress.total} files
          </p>
        </div>
        <span className="text-lg font-semibold text-primary">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} className="mt-3" />
    </div>
  );
}

function StatsGrid() {
  const freshnessStats = useAtomValue(freshnessStatsAtom);
  const coveragePercent = useAtomValue(coveragePercentAtom);
  const watchMode = useAtomValue(watchModeAtom);
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        label="Documentation Coverage"
        value={`${Math.round(coveragePercent * 100)}%`}
        variant={coveragePercent >= 0.7 ? 'success' : coveragePercent >= 0.5 ? 'warning' : 'error'}
        trend={{ direction: 'up', value: '+5%' }}
      />
      <StatCard
        label="Fresh Documents"
        value={freshnessStats.fresh}
        description={`of ${freshnessStats.total} total`}
        variant="success"
      />
      <StatCard
        label="Stale Documents"
        value={freshnessStats.stale}
        variant={freshnessStats.stale > 0 ? 'warning' : 'default'}
        description={freshnessStats.stale > 0 ? 'Need updating' : 'All up to date'}
      />
      <StatCard
        label="Watch Mode"
        value={watchMode.enabled ? 'Active' : 'Off'}
        variant={watchMode.enabled ? 'success' : 'default'}
        description={watchMode.enabled ? `${watchMode.files.length} files` : 'Not monitoring'}
      />
    </div>
  );
}

function CoverageOverview() {
  const coveragePercent = useAtomValue(coveragePercentAtom);
  const setActivePage = useSetAtom(activePageAtom);
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Coverage</h2>
        <Button variant="ghost" size="sm" onClick={() => setActivePage('coverage')}>
          View Details
        </Button>
      </div>
      <div className="flex items-center gap-6">
        <CoverageDonut value={coveragePercent} size="lg" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-sm">Documented</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <span className="text-sm">Undocumented</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {coveragePercent >= 0.8
              ? 'Great coverage! Keep it up.'
              : coveragePercent >= 0.6
                ? 'Good progress. Consider documenting more.'
                : 'Documentation needs attention.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FreshnessOverview() {
  const freshnessStats = useAtomValue(freshnessStatsAtom);
  const setActivePage = useSetAtom(activePageAtom);
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Freshness Status</h2>
        <Button variant="ghost" size="sm" onClick={() => setActivePage('freshness')}>
          View Details
        </Button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm">Fresh</span>
          </div>
          <span className="font-medium">{freshnessStats.fresh}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm">Stale</span>
          </div>
          <span className="font-medium">{freshnessStats.stale}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 text-center text-error">×</span>
            <span className="text-sm">Orphaned</span>
          </div>
          <span className="font-medium">{freshnessStats.orphaned}</span>
        </div>
        <Separator className="my-2" />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Freshness Rate</span>
          <span className="font-medium">
            {Math.round(freshnessStats.freshPercent * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const runCommand = useVSCodeCommand();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          icon={FileText}
          title="Generate File"
          description="Document current file"
          onClick={() => runCommand('docdocs.generateFile')}
        />
        <ActionCard
          icon={RefreshCw}
          title="Regenerate Stale"
          description="Update outdated docs"
          onClick={() => runCommand('docdocs.checkFreshness')}
        />
        <ActionCard
          icon={Zap}
          title="Toggle Watch"
          description="Auto-update on save"
          onClick={() => runCommand('docdocs.toggleWatch')}
        />
        <ActionCard
          icon={TrendingUp}
          title="View Coverage"
          description="See detailed report"
          onClick={() => runCommand('docdocs.showCoverage')}
        />
      </div>
    </div>
  );
}

function RecentActivity() {
  const recentDocs = useAtomValue(recentDocsAtom);
  const openFile = useOpenFile();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-4">Recent Activity</h2>
      {recentDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity</p>
      ) : (
        <div className="space-y-2">
          {recentDocs.slice(0, 5).map((doc) => (
            <button
              key={doc.path}
              className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-list-hover"
              onClick={() => openFile(doc.path)}
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{getFileName(doc.path)}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.action} · {formatRelativeTime(doc.timestamp)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <WelcomeHeader />
      <GenerationProgressBanner />
      <StatsGrid />
      <div className="grid grid-cols-2 gap-6">
        <CoverageOverview />
        <FreshnessOverview />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <QuickActions />
        <RecentActivity />
      </div>
    </div>
  );
}
