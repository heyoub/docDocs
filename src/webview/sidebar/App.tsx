/**
 * @fileoverview Sidebar panel - Mobile-style compact dashboard
 * Horizontal tabs with Overview, Actions, and Models pages
 */

import { useAtom, useAtomValue } from 'jotai';
import {
  FileText,
  RefreshCw,
  Eye,
  Zap,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Settings,
  LayoutDashboard,
  Sparkles,
  Cpu,
  Download,
  Play,
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
  sidebarTabAtom,
  type SidebarTab,
} from '../shared/store';
import {
  selectedModelAtom,
  downloadedModelsAtom,
  isAnyDownloadingAtom,
} from '../shared/store/models';
import { Button } from '../shared/components/atoms/Button';
import { Badge } from '../shared/components/atoms/Badge';
import { Progress } from '../shared/components/atoms/Progress';
import { Switch } from '../shared/components/atoms/Switch';
import { Skeleton } from '../shared/components/atoms/Skeleton';
import { ScrollArea } from '../shared/components/atoms/ScrollArea';
import { Tabs, TabsList, TabsTrigger } from '../shared/components/atoms/Tabs';
import { ActionCard } from '../shared/components/molecules/ActionCard';
import { StatCard } from '../shared/components/molecules/StatCard';
import { TooltipProvider } from '../shared/components/atoms/Tooltip';
import { formatPercent, formatRelativeTime, getFileName, cn } from '../shared/lib/utils';

// ============================================================================
// Tab Navigation
// ============================================================================

function TabNavigation() {
  const [activeTab, setActiveTab] = useAtom(sidebarTabAtom);

  const tabs: Array<{ id: SidebarTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'actions', label: 'Actions', icon: Play },
    { id: 'models', label: 'Models', icon: Cpu },
  ];

  return (
    <div className="border-b border-sidebar-border bg-sidebar/80 backdrop-blur-sm sticky top-0 z-10">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SidebarTab)}>
        <TabsList className="w-full justify-start rounded-none border-0 bg-transparent p-0 h-10">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'flex-1 gap-1.5 rounded-none border-b-2 border-transparent py-2.5',
                'data-[state=active]:border-primary data-[state=active]:bg-transparent',
                'data-[state=active]:text-primary data-[state=active]:shadow-none',
                'transition-all duration-200'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Generation Progress Banner
// ============================================================================

function GenerationProgress() {
  const progress = useAtomValue(generationProgressAtom);

  if (!progress || progress.status !== 'processing') {
    return null;
  }

  return (
    <div className="px-3 py-2.5 border-b border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="relative">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <Sparkles className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-primary animate-pulse" />
        </div>
        <span className="text-sm font-medium text-primary">Generating...</span>
      </div>
      <Progress value={progress.percent} className="h-1.5 bg-primary/20" />
      <p className="mt-1.5 text-xs text-muted-foreground truncate">
        {getFileName(progress.file)}
      </p>
    </div>
  );
}

// ============================================================================
// Overview Tab Content
// ============================================================================

function OverviewContent() {
  const freshnessStats = useAtomValue(freshnessStatsAtom);
  const coveragePercent = useAtomValue(coveragePercentAtom);
  const recentDocs = useAtomValue(recentDocsAtom);
  const watchMode = useAtomValue(watchModeAtom);
  const selectedModel = useAtomValue(selectedModelAtom);
  const isLoading = useAtomValue(configLoadingAtom);
  const openFile = useOpenFile();
  const runCommand = useVSCodeCommand();

  if (isLoading) {
    return (
      <div className="p-3 space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Stats Grid */}
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

      {/* Stale Warning */}
      {freshnessStats.stale > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning border border-warning/20">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{freshnessStats.stale} stale doc{freshnessStats.stale !== 1 ? 's' : ''} need updating</span>
        </div>
      )}

      {/* Watch Mode */}
      <div className="rounded-lg border border-border bg-card/50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={cn(
              'h-4 w-4 transition-colors',
              watchMode.enabled ? 'text-success' : 'text-muted-foreground'
            )} />
            <span className="text-sm font-medium">Watch Mode</span>
            {watchMode.enabled && (
              <Badge variant="success" className="text-[10px] px-1.5 py-0">Active</Badge>
            )}
          </div>
          <Switch
            checked={watchMode.enabled}
            onCheckedChange={() => runCommand('docdocs.toggleWatch')}
          />
        </div>
        {watchMode.enabled && watchMode.files.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Watching {watchMode.files.length} file{watchMode.files.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Active Model */}
      {selectedModel && (
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">ML Model</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{selectedModel.name}</p>
          <Badge variant="muted" className="mt-1.5 text-[10px]">{selectedModel.size}</Badge>
        </div>
      )}

      {/* Recent Activity */}
      {recentDocs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Recent Activity
          </h3>
          <div className="space-y-1">
            {recentDocs.slice(0, 4).map((doc) => (
              <button
                key={doc.path}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-list-hover transition-colors"
                onClick={() => openFile(doc.path)}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{getFileName(doc.path)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(doc.timestamp)}
                  </p>
                </div>
                {doc.action === 'generated' && (
                  <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Actions Tab Content
// ============================================================================

function ActionsContent() {
  const runCommand = useVSCodeCommand();
  const isGenerating = useAtomValue(isGeneratingAtom);

  return (
    <div className="p-3 space-y-2">
      <ActionCard
        icon={FileText}
        title="Generate Docs"
        description="Document current file"
        onClick={() => runCommand('docdocs.generateFile')}
        disabled={isGenerating}
        variant="primary"
      />
      <ActionCard
        icon={Sparkles}
        title="Generate Workspace"
        description="Document entire workspace"
        onClick={() => runCommand('docdocs.generateWorkspace')}
        disabled={isGenerating}
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
        description="Scan for stale docs"
        onClick={() => runCommand('docdocs.checkFreshness')}
      />
      <ActionCard
        icon={AlertTriangle}
        title="Lint Docs"
        description="Check documentation quality"
        onClick={() => runCommand('docdocs.lint')}
      />
    </div>
  );
}

// ============================================================================
// Models Tab Content
// ============================================================================

function ModelsContent() {
  const selectedModel = useAtomValue(selectedModelAtom);
  const downloadedModels = useAtomValue(downloadedModelsAtom);
  const isDownloading = useAtomValue(isAnyDownloadingAtom);
  const runCommand = useVSCodeCommand();

  return (
    <div className="p-3 space-y-3">
      {/* Current Model */}
      {selectedModel ? (
        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedModel.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedModel.size} • {selectedModel.category}</p>
            </div>
            <Badge variant="success" className="text-[10px]">Active</Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{selectedModel.description}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <Cpu className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No Model Selected</p>
          <p className="text-xs text-muted-foreground">Open settings to download a model</p>
        </div>
      )}

      {/* Downloaded Models Count */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          {downloadedModels.length} model{downloadedModels.length !== 1 ? 's' : ''} cached
        </span>
        {isDownloading && (
          <Badge variant="warning" className="text-[10px] gap-1">
            <Download className="h-3 w-3 animate-bounce" />
            Downloading
          </Badge>
        )}
      </div>

      {/* Quick Links */}
      <div className="space-y-1.5 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => runCommand('docdocs.openDashboard')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Browse All Models
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Bottom Bar (Settings + Open Dashboard)
// ============================================================================

function BottomBar() {
  const runCommand = useVSCodeCommand();

  return (
    <div className="border-t border-sidebar-border bg-sidebar/80 backdrop-blur-sm p-2">
      <div className="flex gap-2">
        {/* Settings - 1/4 width */}
        <Button
          variant="ghost"
          size="sm"
          className="w-1/4 gap-1.5"
          onClick={() => runCommand('docdocs.openDashboard')}
          title="Open Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* Open Dashboard - 3/4 width */}
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-2 bg-primary hover:bg-primary/90"
          onClick={() => runCommand('docdocs.openDashboard')}
        >
          <ExternalLink className="h-4 w-4" />
          <span className="font-medium">Open Dashboard</span>
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Content Router
// ============================================================================

function TabContent() {
  const activeTab = useAtomValue(sidebarTabAtom);

  switch (activeTab) {
    case 'overview':
      return <OverviewContent />;
    case 'actions':
      return <ActionsContent />;
    case 'models':
      return <ModelsContent />;
    default:
      return <OverviewContent />;
  }
}

// ============================================================================
// Main App
// ============================================================================

export default function App() {
  useVSCodeMessaging();
  useThemeClass();

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        {/* Header with Tabs */}
        <TabNavigation />

        {/* Generation Progress (shown above content when active) */}
        <GenerationProgress />

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <TabContent />
        </ScrollArea>

        {/* Bottom Bar */}
        <BottomBar />
      </div>
    </TooltipProvider>
  );
}
