/**
 * ModelManager - Main model picker UI component
 * Ollama-style interface for browsing, downloading, and managing models
 */

import * as React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  Search,
  HardDrive,
  Cpu,
  Zap,
  RefreshCw,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Tabs, TabsList, TabsTrigger } from '../atoms/Tabs';
import { Skeleton } from '../atoms/Skeleton';
import { ModelCard, type ModelCardStatus } from '../molecules/ModelCard';
import { usePostMessage } from '../../hooks';
import {
  filteredModelsAtom,
  modelCategoryFilterAtom,
  modelSearchQueryAtom,
  systemCapabilitiesAtom,
  formattedCacheSizeAtom,
  formattedCacheLimitAtom,
  cacheUsagePercentAtom,
  selectedModelIdAtom,
  bestRecommendedModelAtom,
  modelsLoadingAtom,
  type ModelCategoryFilter,
} from '../../store/models';
import type { ModelInfo, DownloadProgress, ModelRecommendation } from '../../../../protocol';

// ============================================================================
// Types
// ============================================================================

interface ExtendedModelInfo extends ModelInfo {
  isCached: boolean;
  isSelected: boolean;
  isDownloading: boolean;
  downloadProgress?: DownloadProgress;
  recommendation?: ModelRecommendation;
}

// ============================================================================
// Helper Components
// ============================================================================

function SystemInfoCard() {
  const system = useAtomValue(systemCapabilitiesAtom);
  const cacheSize = useAtomValue(formattedCacheSizeAtom);
  const cacheLimit = useAtomValue(formattedCacheLimitAtom);
  const cacheUsage = useAtomValue(cacheUsagePercentAtom);
  const bestModel = useAtomValue(bestRecommendedModelAtom);

  if (!system) {
    return (
      <div className="border border-border rounded-lg p-4 mb-4">
        <Skeleton className="h-16" />
      </div>
    );
  }

  const formatRAM = (bytes: number) => `${Math.round(bytes / (1024 * 1024 * 1024))}GB`;

  return (
    <div className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm mb-2">Your System</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>RAM:</span>
              <span className="text-foreground">{formatRAM(system.totalRAM)}</span>
              <span className="text-muted-foreground">
                ({formatRAM(system.availableRAM)} free)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>GPU:</span>
              {system.hasWebGPU ? (
                <span className="flex items-center gap-1 text-green-500">
                  <Zap className="h-3 w-3" />
                  WebGPU
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Cpu className="h-3 w-3" />
                  CPU Only
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Cache:</span>
              <span className="text-foreground">{cacheSize}</span>
              <span>/ {cacheLimit}</span>
              <span>({cacheUsage}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Platform:</span>
              <span className="text-foreground">
                {system.isWSL ? 'Linux (WSL)' : system.platform}
              </span>
            </div>
          </div>
          {bestModel && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <p className="text-xs">
                <span className="text-muted-foreground">Recommended: </span>
                <span className="text-foreground font-medium">{bestModel.name}</span>
                {bestModel.recommendation && (
                  <span className="text-muted-foreground ml-1">
                    (score: {bestModel.recommendation.score})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchAndFilter() {
  const searchQuery = useAtomValue(modelSearchQueryAtom);
  const setSearchQuery = useSetAtom(modelSearchQueryAtom);
  const categoryFilter = useAtomValue(modelCategoryFilterAtom);
  const setCategoryFilter = useSetAtom(modelCategoryFilterAtom);

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ModelCategoryFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function ModelGrid() {
  const models = useAtomValue(filteredModelsAtom) as ExtendedModelInfo[];
  const selectedModelId = useAtomValue(selectedModelIdAtom);
  const postMessage = usePostMessage();
  const isLoading = useAtomValue(modelsLoadingAtom);

  const handleDownload = (modelId: string) => {
    postMessage({ type: 'model:download', payload: { modelId } });
  };

  const handleCancel = (modelId: string) => {
    postMessage({ type: 'model:download:cancel', payload: { modelId } });
  };

  const handleSelect = (modelId: string) => {
    postMessage({ type: 'model:select', payload: { modelId } });
  };

  const handleDelete = (modelId: string) => {
    if (confirm('Delete this model from cache? You can re-download it later.')) {
      postMessage({ type: 'model:delete', payload: { modelId } });
    }
  };

  const getStatus = (model: ExtendedModelInfo): ModelCardStatus => {
    if (model.isDownloading) return 'downloading';
    if (model.id === selectedModelId) return 'selected';
    if (model.isCached) return 'downloaded';
    return 'not-downloaded';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-12">
        <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No models found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  // Sort models: recommended first, then by recommendation score
  const sortedModels = [...models].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    const scoreA = a.recommendation?.score ?? 0;
    const scoreB = b.recommendation?.score ?? 0;
    return scoreB - scoreA;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sortedModels.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          status={getStatus(model)}
          progress={model.downloadProgress}
          recommendation={model.recommendation}
          onDownload={() => handleDownload(model.id)}
          onCancel={() => handleCancel(model.id)}
          onSelect={() => handleSelect(model.id)}
          onDelete={() => handleDelete(model.id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface ModelManagerProps {
  className?: string;
}

export function ModelManager({ className }: ModelManagerProps) {
  const postMessage = usePostMessage();
  const isLoading = useAtomValue(modelsLoadingAtom);

  // Request model state on mount
  React.useEffect(() => {
    postMessage({ type: 'models:requestState' });
  }, [postMessage]);

  const handleRefresh = () => {
    postMessage({ type: 'models:requestState' });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">ML Models</h3>
          <p className="text-sm text-muted-foreground">
            Download and manage models for documentation generation
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <SystemInfoCard />
      <SearchAndFilter />
      <ModelGrid />
    </div>
  );
}
