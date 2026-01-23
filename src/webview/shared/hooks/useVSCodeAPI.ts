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
