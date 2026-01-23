/**
 * Coverage-related hooks
 */

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { coverageAtom, coveragePercentAtom } from '../store';
import type { CoverageEntry } from '../../../protocol';

/**
 * Get full coverage report
 */
export function useCoverage() {
  return useAtomValue(coverageAtom);
}

/**
 * Get overall coverage percentage (0-1)
 */
export function useCoveragePercent(): number {
  return useAtomValue(coveragePercentAtom);
}

/**
 * Get coverage entries sorted by coverage (lowest first)
 */
export function useLowCoverageFiles(limit = 10): CoverageEntry[] {
  const coverage = useAtomValue(coverageAtom);
  return useMemo(() => {
    if (!coverage) return [];
    return [...coverage.byFile]
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, limit);
  }, [coverage, limit]);
}

/**
 * Get coverage by module
 */
export function useCoverageByModule(): Record<string, CoverageEntry> {
  const coverage = useAtomValue(coverageAtom);
  return coverage?.byModule ?? {};
}

/**
 * Get coverage statistics
 */
export function useCoverageStats() {
  const coverage = useAtomValue(coverageAtom);
  return useMemo(() => {
    if (!coverage) {
      return {
        totalFiles: 0,
        coveredFiles: 0,
        totalSymbols: 0,
        documentedSymbols: 0,
        coverage: 0,
        uncoveredFiles: 0,
      };
    }
    return {
      ...coverage.overall,
      uncoveredFiles: coverage.overall.totalFiles - coverage.overall.coveredFiles,
    };
  }, [coverage]);
}

/**
 * Check if coverage meets threshold
 */
export function useCoverageHealth(threshold = 0.7): {
  isHealthy: boolean;
  percentage: number;
  delta: number;
} {
  const percent = useCoveragePercent();
  return {
    isHealthy: percent >= threshold,
    percentage: percent,
    delta: percent - threshold,
  };
}
