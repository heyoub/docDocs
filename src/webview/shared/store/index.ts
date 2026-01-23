/**
 * Jotai Store - Atomic State Management
 */

import { atom } from 'jotai';
import type {
  DocDocsConfig,
  FreshnessMap,
  FreshnessHistory,
  CoverageReport,
  RecentDoc,
  Snapshot,
  GenerationProgress,
} from '../../../protocol';

// ============================================================================
// Configuration State
// ============================================================================

export const configAtom = atom<DocDocsConfig | null>(null);

export const configLoadingAtom = atom(true);

// ============================================================================
// Freshness State
// ============================================================================

export const freshnessAtom = atom<FreshnessMap>({});

export const freshnessStatsAtom = atom((get) => {
  const freshness = get(freshnessAtom);
  const entries = Object.values(freshness);
  const total = entries.length;
  const fresh = entries.filter((e) => e.status === 'fresh').length;
  const stale = entries.filter((e) => e.status === 'stale').length;
  const orphaned = entries.filter((e) => e.status === 'orphaned').length;
  const missing = entries.filter((e) => e.status === 'missing').length;

  return {
    total,
    fresh,
    stale,
    orphaned,
    missing,
    freshPercent: total > 0 ? fresh / total : 0,
  };
});

export const freshnessHistoryAtom = atom<FreshnessHistory>([]);

// ============================================================================
// Coverage State
// ============================================================================

export const coverageAtom = atom<CoverageReport | null>(null);

export const coveragePercentAtom = atom((get) => {
  const coverage = get(coverageAtom);
  return coverage?.overall.coverage ?? 0;
});

// ============================================================================
// Recent Docs State
// ============================================================================

export const recentDocsAtom = atom<RecentDoc[]>([]);

// ============================================================================
// Snapshots State
// ============================================================================

export const snapshotsAtom = atom<Snapshot[]>([]);

// ============================================================================
// Watch Mode State
// ============================================================================

export const watchModeAtom = atom<{ enabled: boolean; files: string[] }>({
  enabled: false,
  files: [],
});

// ============================================================================
// Theme State
// ============================================================================

export type ThemeKind = 'light' | 'dark' | 'high-contrast';

export const themeAtom = atom<ThemeKind>('dark');

// ============================================================================
// Generation State
// ============================================================================

export const generationProgressAtom = atom<GenerationProgress | null>(null);

export const isGeneratingAtom = atom((get) => {
  const progress = get(generationProgressAtom);
  return progress !== null && progress.status === 'processing';
});

// ============================================================================
// UI State
// ============================================================================

export const sidebarCollapsedAtom = atom(false);

export const commandPaletteOpenAtom = atom(false);

export const activePageAtom = atom<
  'overview' | 'coverage' | 'freshness' | 'changelog' | 'settings'
>('overview');

// ============================================================================
// Filters & Search
// ============================================================================

export const searchQueryAtom = atom('');

export const freshnessFilterAtom = atom<'all' | 'fresh' | 'stale' | 'orphaned'>(
  'all'
);

export const filteredFreshnessAtom = atom((get) => {
  const freshness = get(freshnessAtom);
  const filter = get(freshnessFilterAtom);
  const query = get(searchQueryAtom).toLowerCase();

  return Object.entries(freshness).filter(([path, entry]) => {
    const matchesFilter = filter === 'all' || entry.status === filter;
    const matchesQuery = !query || path.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });
});

// ============================================================================
// Re-export Model Store
// ============================================================================

export * from './models';
