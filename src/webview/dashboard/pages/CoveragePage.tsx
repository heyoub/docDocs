import { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { FileCode, FolderOpen, AlertCircle } from 'lucide-react';
import { coverageAtom, configLoadingAtom } from '../../shared/store';
import { useLowCoverageFiles, useCoverageStats } from '../../shared/hooks';
import { useVSCodeCommand, useOpenFile } from '../../shared/hooks';
import { Button } from '../../shared/components/atoms/Button';
import { Skeleton } from '../../shared/components/atoms/Skeleton';
import { Progress } from '../../shared/components/atoms/Progress';
import { Badge } from '../../shared/components/atoms/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/components/atoms/Tabs';
import { CoverageDonut } from '../../shared/components/organisms/CoverageDonut';
import { FileTree, type FileTreeNode } from '../../shared/components/organisms/FileTree';
import { EmptyState } from '../../shared/components/molecules/EmptyState';
import { formatPercent, getFileName } from '../../shared/lib/utils';

function CoverageHeader() {
  const stats = useCoverageStats();
  const runCommand = useVSCodeCommand();

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Documentation Coverage</h1>
        <p className="text-muted-foreground mt-1">
          {stats.documentedSymbols} of {stats.totalSymbols} symbols documented
        </p>
      </div>
      <Button onClick={() => runCommand('docdocs.showCoverage')}>
        Refresh Coverage
      </Button>
    </div>
  );
}

function CoverageSummary() {
  const stats = useCoverageStats();
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-1 flex items-center justify-center">
        <CoverageDonut value={stats.coverage} size="lg" />
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Files</p>
          <p className="text-2xl font-semibold">{stats.totalFiles}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Covered Files</p>
          <p className="text-2xl font-semibold text-success">{stats.coveredFiles}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Symbols</p>
          <p className="text-2xl font-semibold">{stats.totalSymbols}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Documented</p>
          <p className="text-2xl font-semibold text-success">{stats.documentedSymbols}</p>
        </div>
      </div>
    </div>
  );
}

function LowCoverageWarning() {
  const stats = useCoverageStats();

  if (stats.coverage >= 0.5) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-error/30 bg-error/10">
      <AlertCircle className="h-5 w-5 text-error shrink-0" />
      <div>
        <p className="font-medium text-error">Low Documentation Coverage</p>
        <p className="text-sm text-muted-foreground">
          Your project has less than 50% documentation coverage. Consider documenting more symbols to improve maintainability.
        </p>
      </div>
    </div>
  );
}

function LowCoverageFiles() {
  const lowCoverageFiles = useLowCoverageFiles(10);
  const openFile = useOpenFile();
  const runCommand = useVSCodeCommand();

  if (lowCoverageFiles.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold mb-4">Files Needing Attention</h2>
        <EmptyState
          icon={FileCode}
          title="All files covered"
          description="Great job! All your files have documentation."
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Files Needing Attention</h2>
        <Badge variant="warning">{lowCoverageFiles.length} files</Badge>
      </div>
      <div className="space-y-3">
        {lowCoverageFiles.map((file) => (
          <div
            key={file.path}
            className="flex items-center gap-3 rounded p-2 hover:bg-list-hover"
          >
            <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <button
                className="text-sm hover:underline truncate block text-left"
                onClick={() => openFile(file.path)}
              >
                {getFileName(file.path)}
              </button>
              <p className="text-xs text-muted-foreground">
                {file.documentedSymbols}/{file.totalSymbols} symbols
              </p>
            </div>
            <div className="w-24">
              <Progress value={file.coverage * 100} className="h-2" />
            </div>
            <span
              className={`text-sm font-medium w-12 text-right ${
                file.coverage < 0.5 ? 'text-error' : 'text-warning'
              }`}
            >
              {formatPercent(file.coverage)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runCommand('docdocs.generateFile', [file.path])}
            >
              Generate
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageByModule() {
  const coverage = useAtomValue(coverageAtom);
  const openFile = useOpenFile();

  if (!coverage || Object.keys(coverage.byModule).length === 0) {
    return null;
  }

  const modules = Object.entries(coverage.byModule).sort(
    ([, a], [, b]) => a.coverage - b.coverage
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-4">Coverage by Module</h2>
      <div className="space-y-3">
        {modules.map(([moduleName, data]) => (
          <div key={moduleName} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-warning" />
                <button
                  className="text-sm font-medium hover:underline"
                  onClick={() => openFile(data.path)}
                >
                  {moduleName}
                </button>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatPercent(data.coverage)}
              </span>
            </div>
            <Progress value={data.coverage * 100} className="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface TreeBuildNode {
  path: string;
  name: string;
  isFolder: boolean;
  status?: 'fresh' | 'stale' | 'orphaned' | 'missing';
  children?: Record<string, TreeBuildNode>;
}

function CoverageFileTree() {
  const coverage = useAtomValue(coverageAtom);
  const openFile = useOpenFile();
  const [selectedPath, setSelectedPath] = useState<string>();

  const treeNodes = useMemo<FileTreeNode[]>(() => {
    if (!coverage) return [];

    // Build tree from flat file list using intermediate type
    const root: Record<string, TreeBuildNode> = {};

    coverage.byFile.forEach((file) => {
      const parts = file.path.split('/');
      let current = root;

      parts.forEach((part, idx) => {
        const isLast = idx === parts.length - 1;
        const path = parts.slice(0, idx + 1).join('/');

        if (!current[part]) {
          current[part] = {
            path,
            name: part,
            isFolder: !isLast,
            children: isLast ? undefined : {},
            status: isLast
              ? file.coverage >= 0.8
                ? 'fresh'
                : file.coverage >= 0.5
                  ? 'stale'
                  : 'orphaned'
              : undefined,
          };
        }

        if (!isLast && current[part]?.children) {
          current = current[part]!.children!;
        }
      });
    });

    // Convert to array format for FileTreeNode
    const toArray = (obj: Record<string, TreeBuildNode>): FileTreeNode[] => {
      return Object.values(obj).map((node) => ({
        path: node.path,
        name: node.name,
        isFolder: node.isFolder,
        status: node.status,
        children: node.children ? toArray(node.children) : undefined,
      }));
    };

    return toArray(root);
  }, [coverage]);

  const handleSelect = (path: string) => {
    setSelectedPath(path);
    openFile(path);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold mb-4">File Explorer</h2>
      <FileTree
        nodes={treeNodes}
        selectedPath={selectedPath}
        onSelect={handleSelect}
        emptyMessage="No files with coverage data"
        className="h-80"
      />
    </div>
  );
}

export default function CoveragePage() {
  const isLoading = useAtomValue(configLoadingAtom);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CoverageHeader />
      <LowCoverageWarning />
      <CoverageSummary />

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="tree">Tree View</TabsTrigger>
          <TabsTrigger value="modules">By Module</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <LowCoverageFiles />
        </TabsContent>
        <TabsContent value="tree" className="mt-4">
          <CoverageFileTree />
        </TabsContent>
        <TabsContent value="modules" className="mt-4">
          <CoverageByModule />
        </TabsContent>
      </Tabs>
    </div>
  );
}
