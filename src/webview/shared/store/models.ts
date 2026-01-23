/**
 * Jotai Store - Model Management State
 */

import { atom } from 'jotai';
import type {
  ModelInfo,
  CachedModelInfo,
  ModelRecommendation,
  SystemCapabilities,
  DownloadProgress,
} from '../../../protocol';

// ============================================================================
// Model Registry State
// ============================================================================

/**
 * All available models from the registry
 */
export const modelRegistryAtom = atom<ModelInfo[]>([]);

/**
 * Models that have been downloaded and cached
 */
export const cachedModelsAtom = atom<CachedModelInfo[]>([]);

/**
 * Model recommendations based on system capabilities
 */
export const modelRecommendationsAtom = atom<ModelRecommendation[]>([]);

/**
 * Currently selected model ID
 */
export const selectedModelIdAtom = atom<string | null>(null);

// ============================================================================
// System State
// ============================================================================

/**
 * Detected system capabilities
 */
export const systemCapabilitiesAtom = atom<SystemCapabilities | null>(null);

/**
 * Total cache size in bytes
 */
export const cacheSizeAtom = atom<number>(0);

/**
 * Cache limit in bytes
 */
export const cacheLimitAtom = atom<number>(5 * 1024 * 1024 * 1024); // 5GB default

// ============================================================================
// Download State
// ============================================================================

/**
 * Active download progress for each model
 */
export const downloadProgressAtom = atom<Record<string, DownloadProgress>>({});

// ============================================================================
// Loading State
// ============================================================================

/**
 * Whether model state is loading
 */
export const modelsLoadingAtom = atom(true);

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Models with their cached status
 */
export const availableModelsAtom = atom((get) => {
  const registry = get(modelRegistryAtom);
  const cached = get(cachedModelsAtom);
  const recommendations = get(modelRecommendationsAtom);
  const downloads = get(downloadProgressAtom);
  const selectedId = get(selectedModelIdAtom);

  return registry.map((model) => {
    const cachedInfo = cached.find((c) => c.modelId === model.id);
    const recommendation = recommendations.find((r) => r.modelId === model.id);
    const download = downloads[model.id];

    return {
      ...model,
      isCached: !!cachedInfo,
      cachedInfo,
      recommendation,
      downloadProgress: download,
      isSelected: model.id === selectedId,
      isDownloading: download?.status === 'downloading',
    };
  });
});

/**
 * Models grouped by category
 */
export const modelsByCategoryAtom = atom((get) => {
  const models = get(availableModelsAtom);

  return {
    code: models.filter((m) => m.category === 'code'),
    general: models.filter((m) => m.category === 'general'),
    reasoning: models.filter((m) => m.category === 'reasoning'),
    embedding: models.filter((m) => m.category === 'embedding'),
  };
});

/**
 * Only cached/downloaded models
 */
export const downloadedModelsAtom = atom((get) => {
  return get(availableModelsAtom).filter((m) => m.isCached);
});

/**
 * Currently selected model (full info)
 */
export const selectedModelAtom = atom((get) => {
  const selectedId = get(selectedModelIdAtom);
  if (!selectedId) return null;

  return get(availableModelsAtom).find((m) => m.id === selectedId) ?? null;
});

/**
 * Whether any model is currently downloading
 */
export const isAnyDownloadingAtom = atom((get) => {
  const downloads = get(downloadProgressAtom);
  return Object.values(downloads).some((d) => d.status === 'downloading');
});

/**
 * Cache usage percentage
 */
export const cacheUsagePercentAtom = atom((get) => {
  const size = get(cacheSizeAtom);
  const limit = get(cacheLimitAtom);
  return limit > 0 ? Math.round((size / limit) * 100) : 0;
});

/**
 * Formatted cache size
 */
export const formattedCacheSizeAtom = atom((get) => {
  const bytes = get(cacheSizeAtom);
  return formatBytes(bytes);
});

/**
 * Formatted cache limit
 */
export const formattedCacheLimitAtom = atom((get) => {
  const bytes = get(cacheLimitAtom);
  return formatBytes(bytes);
});

/**
 * Best recommended model
 */
export const bestRecommendedModelAtom = atom((get) => {
  const recommendations = get(modelRecommendationsAtom);
  if (recommendations.length === 0) return null;

  const bestRec = recommendations[0];
  return get(availableModelsAtom).find((m) => m.id === bestRec.modelId) ?? null;
});

// ============================================================================
// Filter State
// ============================================================================

export type ModelCategoryFilter = 'all' | 'code' | 'general' | 'reasoning' | 'embedding';
export type ModelStatusFilter = 'all' | 'downloaded' | 'not-downloaded';

export const modelCategoryFilterAtom = atom<ModelCategoryFilter>('all');
export const modelStatusFilterAtom = atom<ModelStatusFilter>('all');
export const modelSearchQueryAtom = atom('');

/**
 * Filtered models based on current filters
 */
export const filteredModelsAtom = atom((get) => {
  const models = get(availableModelsAtom);
  const categoryFilter = get(modelCategoryFilterAtom);
  const statusFilter = get(modelStatusFilterAtom);
  const query = get(modelSearchQueryAtom).toLowerCase();

  return models.filter((model) => {
    // Category filter
    if (categoryFilter !== 'all' && model.category !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'downloaded' && !model.isCached) {
      return false;
    }
    if (statusFilter === 'not-downloaded' && model.isCached) {
      return false;
    }

    // Search filter
    if (query) {
      const searchText = `${model.name} ${model.description} ${model.id}`.toLowerCase();
      if (!searchText.includes(query)) {
        return false;
      }
    }

    return true;
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
