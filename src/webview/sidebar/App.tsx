import { useAtomValue } from 'jotai';
import {
  FileText,
  RefreshCw,
  Eye,
  Zap,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useVSCodeMessaging, useVSCodeCommand, useOpenFile, useThemeClass } from '../shared/hooks';
import {
  freshnessStatsAtom,
  coveragePercentAtom,
  recentDocsAtom,
  watchModeAtom,
  isGeneratingAtom,
  generationProgressAtom,
  configLoadingAtom,
} from '../shared/store';
import { SidebarLayout, SidebarSection } from '../shared/components/templates/SidebarLayout';
import { Button } from '../shared/components/atoms/Button';
import { Badge } from '../shared/components/atoms/Badge';
import { Progress } from '../shared/components/atoms/Progress';
import { Switch } from '../shared/components/atoms/Switch';
import { Skeleton } from '../shared/components/atoms/Skeleton';
import { ActionCard } from '../shared/components/molecules/ActionCard';
import { StatCard } from '../shared/components/molecules/StatCard';
import { TooltipProvider } from '../shared/components/atoms/Tooltip';
import { formatPercent, formatRelativeTime, getFileName } from '../shared/lib/utils';

function QuickActions() {
  const runCommand = useVSCodeCommand();
  const isGenerating = useAtomValue(isGeneratingAtom);

  return (
    <SidebarSection title="Quick Actions">
      <div className="space-y-2">
        <ActionCard
          icon={FileText}
          title="Generate Docs"
          description="Generate documentation for current file"
          onClick={() => runCommand('docdocs.generateFile')}
          disabled={isGenerating}
          variant="primary"
        />
        <ActionCard
          icon={Eye}
          title="Preview"
          description="Preview documentation"
          onClick={() => runCommand('docdocs.preview')}
        />
        <ActionCard
          icon={RefreshCw}
          title="Check Freshness"
          description="Scan for stale documentation"
          onClick={() => runCommand('docdocs.checkFreshness')}
        />
      </div>
    </SidebarSection>
  );
}

function StatsOverview() {
  const freshnessStats = useAtomValue(freshnessStatsAtom);
  const coveragePercent = useAtomValue(coveragePercentAtom);
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return (
      <SidebarSection title="Statistics">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </SidebarSection>
    );
  }

  return (
    <SidebarSection
      title="Statistics"
      badge={
        <Badge variant={coveragePercent >= 0.7 ? 'success' : 'warning'}>
          {formatPercent(coveragePercent)}
        </Badge>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Coverage"
          value={formatPercent(coveragePercent)}
          variant={coveragePercent >= 0.7 ? 'success' : coveragePercent >= 0.5 ? 'warning' : 'error'}
        />
        <StatCard
          label="Fresh"
          value={`${freshnessStats.fresh}/${freshnessStats.total}`}
          variant={freshnessStats.freshPercent >= 0.8 ? 'success' : 'warning'}
        />
      </div>
      {freshnessStats.stale > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{freshnessStats.stale} stale doc{freshnessStats.stale !== 1 ? 's' : ''} need updating</span>
        </div>
      )}
    </SidebarSection>
  );
}

function RecentDocs() {
  const recentDocs = useAtomValue(recentDocsAtom);
  const openFile = useOpenFile();

  if (recentDocs.length === 0) {
    return (
      <SidebarSection title="Recent Docs">
        <p className="text-xs text-muted-foreground px-1">
          No recent documentation activity
        </p>
      </SidebarSection>
    );
  }

  return (
    <SidebarSection
      title="Recent Docs"
      badge={<Badge variant="muted">{recentDocs.length}</Badge>}
    >
      <div className="space-y-1">
        {recentDocs.slice(0, 5).map((doc) => (
          <button
            key={doc.path}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-list-hover"
            onClick={() => openFile(doc.path)}
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate">{getFileName(doc.path)}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(doc.timestamp)}
              </p>
            </div>
            {doc.action === 'generated' && (
              <CheckCircle className="h-3 w-3 text-success shrink-0" />
            )}
          </button>
        ))}
      </div>
    </SidebarSection>
  );
}

function WatchStatus() {
  const watchMode = useAtomValue(watchModeAtom);
  const runCommand = useVSCodeCommand();

  return (
    <SidebarSection
      title="Watch Mode"
      badge={
        watchMode.enabled ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="muted">Off</Badge>
        )
      }
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Zap className={watchMode.enabled ? 'h-4 w-4 text-success' : 'h-4 w-4 text-muted-foreground'} />
          <span className="text-sm">Auto-regenerate</span>
        </div>
        <Switch
          checked={watchMode.enabled}
          onCheckedChange={() => runCommand('docdocs.toggleWatch')}
        />
      </div>
      {watchMode.enabled && watchMode.files.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground px-1">
          Watching {watchMode.files.length} file{watchMode.files.length !== 1 ? 's' : ''}
        </p>
      )}
    </SidebarSection>
  );
}

function GenerationProgress() {
  const progress = useAtomValue(generationProgressAtom);

  if (!progress || progress.status !== 'processing') {
    return null;
  }

  return (
    <div className="px-3 py-2 border-b border-sidebar-border bg-primary/10">
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">Generating...</span>
      </div>
      <Progress value={progress.percent} className="h-1" />
      <p className="mt-1 text-xs text-muted-foreground truncate">
        {getFileName(progress.file)}
      </p>
    </div>
  );
}

function DashboardLink() {
  const runCommand = useVSCodeCommand();

  return (
    <div className="p-3 border-t border-sidebar-border">
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => runCommand('docdocs.openDashboard')}
      >
        <ExternalLink className="h-4 w-4" />
        Open Dashboard
      </Button>
    </div>
  );
}

export default function App() {
  useVSCodeMessaging();
  useThemeClass();

  return (
    <TooltipProvider>
      <SidebarLayout>
        <GenerationProgress />
        <QuickActions />
        <StatsOverview />
        <RecentDocs />
        <WatchStatus />
        <DashboardLink />
      </SidebarLayout>
    </TooltipProvider>
  );
}
