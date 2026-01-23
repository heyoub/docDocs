/**
 * Message Protocol for Extension ↔ Webview Communication
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface DocDocsConfig {
  output: {
    directory: string;
    formats: string[];
  };
  ml: {
    enabled: boolean;
    model: string;
  };
  codeLens: {
    enabled: boolean;
  };
  statusBar: {
    enabled: boolean;
    freshnessThreshold: number;
  };
  watch: {
    enabled: boolean;
    debounceMs: number;
  };
  extraction: {
    treeSitterFallback: boolean;
    timeout: number;
  };
}

// ============================================================================
// Freshness Types
// ============================================================================

export type FreshnessStatus = 'fresh' | 'stale' | 'orphaned' | 'missing';

export interface FreshnessEntry {
  path: string;
  status: FreshnessStatus;
  sourceHash?: string;
  docHash?: string;
  lastChecked: string;
  lastModified?: string;
}

export type FreshnessMap = Record<string, FreshnessEntry>;

// ============================================================================
// Coverage Types
// ============================================================================

export interface CoverageEntry {
  path: string;
  totalSymbols: number;
  documentedSymbols: number;
  coverage: number;
}

export interface CoverageReport {
  overall: {
    totalFiles: number;
    coveredFiles: number;
    totalSymbols: number;
    documentedSymbols: number;
    coverage: number;
  };
  byFile: CoverageEntry[];
  byModule: Record<string, CoverageEntry>;
}

// ============================================================================
// Generation Types
// ============================================================================

export interface GenerationProgress {
  file: string;
  current: number;
  total: number;
  percent: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface GenerationResult {
  files: string[];
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

// ============================================================================
// Recent Activity Types
// ============================================================================

export interface RecentDoc {
  path: string;
  name: string;
  action: 'generated' | 'modified' | 'viewed';
  timestamp: string;
}

// ============================================================================
// Freshness History Types
// ============================================================================

export interface FreshnessHistoryEntry {
  date: string;
  fresh: number;
  stale: number;
  orphaned: number;
  total: number;
}

export type FreshnessHistory = FreshnessHistoryEntry[];

// ============================================================================
// Snapshot/Changelog Types
// ============================================================================

export interface Snapshot {
  id: string;
  name: string;
  timestamp: string;
  fileCount: number;
}

export interface ChangelogEntry {
  type: 'added' | 'removed' | 'modified';
  symbol: string;
  file: string;
  details?: string;
}

// ============================================================================
// Extension → Webview Messages
// ============================================================================

export type ToWebview =
  | { type: 'config:update'; payload: DocDocsConfig }
  | { type: 'freshness:update'; payload: FreshnessMap }
  | { type: 'freshnessHistory:update'; payload: FreshnessHistory }
  | { type: 'coverage:update'; payload: CoverageReport }
  | { type: 'generation:progress'; payload: GenerationProgress }
  | { type: 'generation:complete'; payload: GenerationResult }
  | { type: 'recentDocs:update'; payload: RecentDoc[] }
  | { type: 'snapshots:update'; payload: Snapshot[] }
  | { type: 'watchMode:update'; payload: { enabled: boolean; files: string[] } }
  | { type: 'theme:update'; payload: { kind: 'light' | 'dark' | 'high-contrast' } }
  | { type: 'initialData'; payload: InitialData };

// ============================================================================
// Webview → Extension Messages
// ============================================================================

export type ToExtension =
  | { type: 'ready' }
  | { type: 'request:initialData' }
  | { type: 'config:save'; payload: Partial<DocDocsConfig> }
  | { type: 'command:run'; payload: { command: string; args?: unknown[] } }
  | { type: 'file:open'; payload: { path: string } }
  | { type: 'snapshot:create'; payload: { name: string } }
  | { type: 'snapshot:compare'; payload: { fromId: string; toId: string } }
  | { type: 'generation:start'; payload: { paths: string[]; force?: boolean } }
  | { type: 'generation:cancel' };

// ============================================================================
// Initial Data Bundle
// ============================================================================

export interface InitialData {
  config: DocDocsConfig;
  freshness: FreshnessMap;
  freshnessHistory: FreshnessHistory;
  coverage: CoverageReport;
  recentDocs: RecentDoc[];
  snapshots: Snapshot[];
  watchMode: { enabled: boolean; files: string[] };
  theme: { kind: 'light' | 'dark' | 'high-contrast' };
}
