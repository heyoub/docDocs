/**
 * Freshness-related hooks
 */

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import {
  freshnessAtom,
  freshnessStatsAtom,
  freshnessHistoryAtom,
  filteredFreshnessAtom,
} from '../store';
import type { FreshnessEntry, FreshnessStatus } from '../../../protocol';

/**
 * Get all freshness data
 */
export function useFreshness() {
  return useAtomValue(freshnessAtom);
}

/**
 * Get freshness statistics
 */
export function useFreshnessStats() {
  return useAtomValue(freshnessStatsAtom);
}

/**
 * Get filtered freshness data
 */
export function useFilteredFreshness() {
  return useAtomValue(filteredFreshnessAtom);
}

/**
 * Get freshness history for timeline
 */
export function useFreshnessHistory() {
  return useAtomValue(freshnessHistoryAtom);
}

/**
 * Get freshness for a specific file
 */
export function useFreshnessForFile(path: string): FreshnessEntry | undefined {
  const freshness = useAtomValue(freshnessAtom);
  return freshness[path];
}

/**
 * Get files by freshness status
 */
export function useFilesByStatus(status: FreshnessStatus): [string, FreshnessEntry][] {
  const freshness = useAtomValue(freshnessAtom);
  return useMemo(
    () => Object.entries(freshness).filter(([, entry]) => entry.status === status),
    [freshness, status]
  );
}

/**
 * Get stale files count for quick display
 */
export function useStaleCount(): number {
  const stats = useFreshnessStats();
  return stats.stale;
}

/**
 * Check if documentation health is good (above threshold)
 */
export function useFreshnessHealth(threshold = 0.8): {
  isHealthy: boolean;
  percentage: number;
} {
  const stats = useFreshnessStats();
  return {
    isHealthy: stats.freshPercent >= threshold,
    percentage: stats.freshPercent,
  };
}
