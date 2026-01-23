/**
 * React hooks for VS Code Webview API
 */

import { useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import {
  onMessage,
  notifyReady,
  requestInitialData,
  runCommand,
  openFile,
  saveConfig,
  postMessage,
} from '../lib/vscode';
import type { ToWebview, DocDocsConfig, ToExtension } from '../../../protocol';
import {
  configAtom,
  configLoadingAtom,
  freshnessAtom,
  freshnessHistoryAtom,
  coverageAtom,
  recentDocsAtom,
  snapshotsAtom,
  watchModeAtom,
  themeAtom,
  generationProgressAtom,
  // Model atoms
  modelRegistryAtom,
  cachedModelsAtom,
  modelRecommendationsAtom,
  systemCapabilitiesAtom,
  selectedModelIdAtom,
  downloadProgressAtom,
  cacheSizeAtom,
  cacheLimitAtom,
  modelsLoadingAtom,
} from '../store';

/**
 * Hook to initialize VS Code communication and sync state
 */
export function useVSCodeMessaging(): void {
  const setConfig = useSetAtom(configAtom);
  const setConfigLoading = useSetAtom(configLoadingAtom);
  const setFreshness = useSetAtom(freshnessAtom);
  const setFreshnessHistory = useSetAtom(freshnessHistoryAtom);
  const setCoverage = useSetAtom(coverageAtom);
  const setRecentDocs = useSetAtom(recentDocsAtom);
  const setSnapshots = useSetAtom(snapshotsAtom);
  const setWatchMode = useSetAtom(watchModeAtom);
  const setTheme = useSetAtom(themeAtom);
  const setGenerationProgress = useSetAtom(generationProgressAtom);
  // Model state setters
  const setModelRegistry = useSetAtom(modelRegistryAtom);
  const setCachedModels = useSetAtom(cachedModelsAtom);
  const setModelRecommendations = useSetAtom(modelRecommendationsAtom);
  const setSystemCapabilities = useSetAtom(systemCapabilitiesAtom);
  const setSelectedModelId = useSetAtom(selectedModelIdAtom);
  const setDownloadProgress = useSetAtom(downloadProgressAtom);
  const setCacheSize = useSetAtom(cacheSizeAtom);
  const setCacheLimit = useSetAtom(cacheLimitAtom);
  const setModelsLoading = useSetAtom(modelsLoadingAtom);

  useEffect(() => {
    const handleMessage = (message: ToWebview) => {
      switch (message.type) {
        case 'initialData':
          setConfig(message.payload.config);
          setFreshness(message.payload.freshness);
          setFreshnessHistory(message.payload.freshnessHistory);
          setCoverage(message.payload.coverage);
          setRecentDocs(message.payload.recentDocs);
          setSnapshots(message.payload.snapshots);
          setWatchMode(message.payload.watchMode);
          setTheme(message.payload.theme.kind);
          setConfigLoading(false);
          // Handle model state from initial data
          if (message.payload.models) {
            setModelRegistry(message.payload.models.registry);
            setCachedModels(message.payload.models.cached);
            setModelRecommendations(message.payload.models.recommendations);
            setSystemCapabilities(message.payload.models.system);
            setSelectedModelId(message.payload.models.selectedModelId);
            setDownloadProgress(message.payload.models.downloads);
            setCacheSize(message.payload.models.cacheSize);
            setCacheLimit(message.payload.models.cacheLimit);
            setModelsLoading(false);
          }
          break;
        case 'config:update':
          setConfig(message.payload);
          break;
        case 'freshness:update':
          setFreshness(message.payload);
          break;
        case 'freshnessHistory:update':
          setFreshnessHistory(message.payload);
          break;
        case 'coverage:update':
          setCoverage(message.payload);
          break;
        case 'recentDocs:update':
          setRecentDocs(message.payload);
          break;
        case 'snapshots:update':
          setSnapshots(message.payload);
          break;
        case 'watchMode:update':
          setWatchMode(message.payload);
          break;
        case 'theme:update':
          setTheme(message.payload.kind);
          break;
        case 'generation:progress':
          setGenerationProgress(message.payload);
          break;
        case 'generation:complete':
          setGenerationProgress(null);
          break;
        // Model management messages
        case 'models:registry':
          setModelRegistry(message.payload);
          break;
        case 'models:cache':
          setCachedModels(message.payload);
          break;
        case 'models:recommendations':
          setModelRecommendations(message.payload);
          break;
        case 'models:system':
          setSystemCapabilities(message.payload);
          break;
        case 'models:state':
          setModelRegistry(message.payload.registry);
          setCachedModels(message.payload.cached);
          setModelRecommendations(message.payload.recommendations);
          setSystemCapabilities(message.payload.system);
          setSelectedModelId(message.payload.selectedModelId);
          setDownloadProgress(message.payload.downloads);
          setCacheSize(message.payload.cacheSize);
          setCacheLimit(message.payload.cacheLimit);
          setModelsLoading(false);
          break;
        case 'model:download:start':
          setDownloadProgress((prev) => ({
            ...prev,
            [message.payload.modelId]: {
              modelId: message.payload.modelId,
              percent: 0,
              downloadedBytes: 0,
              totalBytes: 0,
              speed: '',
              eta: 'Starting...',
              status: 'downloading',
            },
          }));
          break;
        case 'model:download:progress':
          setDownloadProgress((prev) => ({
            ...prev,
            [message.payload.modelId]: message.payload,
          }));
          break;
        case 'model:download:complete':
          setDownloadProgress((prev) => {
            const { [message.payload.modelId]: _, ...rest } = prev;
            return rest;
          });
          // Refresh cache list
          postMessage({ type: 'models:requestState' });
          break;
        case 'model:download:error':
          setDownloadProgress((prev) => ({
            ...prev,
            [message.payload.modelId]: {
              modelId: message.payload.modelId,
              percent: 0,
              downloadedBytes: 0,
              totalBytes: 0,
              speed: '',
              eta: '',
              status: 'error',
              error: message.payload.error,
            },
          }));
          break;
        case 'model:selected':
          setSelectedModelId(message.payload.modelId);
          break;
      }
    };

    const unsubscribe = onMessage(handleMessage);

    // Notify extension that webview is ready
    notifyReady();

    // Request initial data
    requestInitialData();

    return unsubscribe;
  }, [
    setConfig,
    setConfigLoading,
    setFreshness,
    setFreshnessHistory,
    setCoverage,
    setRecentDocs,
    setSnapshots,
    setWatchMode,
    setTheme,
    setGenerationProgress,
    setModelRegistry,
    setCachedModels,
    setModelRecommendations,
    setSystemCapabilities,
    setSelectedModelId,
    setDownloadProgress,
    setCacheSize,
    setCacheLimit,
    setModelsLoading,
  ]);
}

/**
 * Hook for running VS Code commands
 */
export function useVSCodeCommand(): (
  command: string,
  args?: unknown[]
) => void {
  return useCallback((command: string, args?: unknown[]) => {
    runCommand(command, args);
  }, []);
}

/**
 * Hook for opening files in VS Code
 */
export function useOpenFile(): (path: string) => void {
  return useCallback((path: string) => {
    openFile(path);
  }, []);
}

/**
 * Hook for saving configuration
 */
export function useSaveConfig(): (config: Partial<DocDocsConfig>) => void {
  return useCallback((config: Partial<DocDocsConfig>) => {
    saveConfig(config as Record<string, unknown>);
  }, []);
}

/**
 * Hook for posting raw messages
 */
export function usePostMessage(): (message: ToExtension) => void {
  return useCallback((message: ToExtension) => {
    postMessage(message);
  }, []);
}
