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
// Model Management Types
// ============================================================================

export type ModelCategory = 'code' | 'general' | 'reasoning' | 'embedding';
export type ModelProvider = 'huggingface' | 'local';

export interface ModelRequirements {
  minRAM: string;
  supportsWebGPU: boolean;
  supportsCPU: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ModelProvider;
  size: string;
  sizeBytes: number;
  description: string;
  category: ModelCategory;
  recommended?: boolean;
  requirements: ModelRequirements;
  downloadUrl: string;
}

export interface CachedModelInfo {
  modelId: string;
  path: string;
  sizeBytes: number;
  downloadedAt: number;
  lastUsedAt: number;
}

export interface ModelRecommendation {
  modelId: string;
  score: number;
  reason: string;
  warnings?: string[];
}

export interface SystemCapabilities {
  totalRAM: number;
  availableRAM: number;
  hasWebGPU: boolean;
  gpuName?: string | undefined;
  gpuVRAM?: number | undefined;
  platform: 'win32' | 'darwin' | 'linux';
  isWSL: boolean;
}

export interface DownloadProgress {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: string;
  eta: string;
  status: 'downloading' | 'extracting' | 'complete' | 'error' | 'cancelled';
  error?: string;
}

export interface ModelManagerState {
  registry: ModelInfo[];
  cached: CachedModelInfo[];
  recommendations: ModelRecommendation[];
  system: SystemCapabilities | null;
  selectedModelId: string | null;
  downloads: Record<string, DownloadProgress>;
  cacheSize: number;
  cacheLimit: number;
}

// ============================================================================
// Vector Search Types
// ============================================================================

export type ContentType = 'code' | 'docs' | 'comments' | 'commits' | 'prs';
export type HierarchyLevel = 'project' | 'module' | 'file' | 'symbol';

export interface VectorSearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  contentTypes?: ContentType[];
  levels?: HierarchyLevel[];
  pathPattern?: string;
  language?: string;
  hybrid?: boolean;
  rerank?: boolean;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  contentType: ContentType;
  level: HierarchyLevel;
  filePath: string;
  symbolName?: string;
  symbolKind?: string;
  lineRange?: { start: number; end: number };
  score: number;
  highlights?: string[];
}

export interface VectorSearchResponse {
  results: VectorSearchResult[];
  query: string;
  totalMatches: number;
  searchTimeMs: number;
}

// ============================================================================
// Indexer Types
// ============================================================================

export type IndexerState = 'idle' | 'indexing' | 'paused' | 'error';

export interface IndexerStatus {
  state: IndexerState;
  currentFile?: string;
  filesProcessed: number;
  filesTotal: number;
  chunksIndexed: number;
  errorsCount: number;
  startedAt?: number;
  eta?: number;
  lastError?: string;
}

export interface IndexerStats {
  totalChunks: number;
  byContentType: Record<ContentType, number>;
  byLevel: Record<HierarchyLevel, number>;
  totalSizeBytes: number;
  lastIndexedAt: number;
}

// ============================================================================
// Incoherence Types
// ============================================================================

export type IncoherenceType =
  | 'outdated'
  | 'missing'
  | 'mismatch'
  | 'incomplete'
  | 'orphaned'
  | 'semantic-drift';

export interface Incoherence {
  id: string;
  filePath: string;
  symbolName?: string;
  type: IncoherenceType;
  severity: number;
  description: string;
  suggestedFix?: string;
  codeSnippet?: string;
  docSnippet?: string;
  lineRange?: { start: number; end: number };
}

export interface IncoherenceSummary {
  totalFiles: number;
  filesWithIssues: number;
  totalIncoherences: number;
  byType: Record<IncoherenceType, number>;
  bySeverity: { high: number; medium: number; low: number };
  averageCoherence: number;
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
  | { type: 'initialData'; payload: InitialData }
  // Model management messages
  | { type: 'models:registry'; payload: ModelInfo[] }
  | { type: 'models:cache'; payload: CachedModelInfo[] }
  | { type: 'models:recommendations'; payload: ModelRecommendation[] }
  | { type: 'models:system'; payload: SystemCapabilities }
  | { type: 'models:state'; payload: ModelManagerState }
  | { type: 'model:download:start'; payload: { modelId: string } }
  | { type: 'model:download:progress'; payload: DownloadProgress }
  | { type: 'model:download:complete'; payload: { modelId: string; path: string } }
  | { type: 'model:download:error'; payload: { modelId: string; error: string } }
  | { type: 'model:selected'; payload: { modelId: string | null } }
  // Vector search messages
  | { type: 'vector:search:results'; payload: VectorSearchResponse }
  | { type: 'vector:indexer:status'; payload: IndexerStatus }
  | { type: 'vector:indexer:stats'; payload: IndexerStats }
  | { type: 'vector:incoherence:summary'; payload: IncoherenceSummary }
  | { type: 'vector:incoherence:file'; payload: { filePath: string; incoherences: Incoherence[] } };

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
  | { type: 'generation:cancel' }
  // Model management messages
  | { type: 'models:requestState' }
  | { type: 'models:reportWebGPU'; payload: { hasWebGPU: boolean; gpuName?: string; gpuVRAM?: number } }
  | { type: 'model:download'; payload: { modelId: string } }
  | { type: 'model:download:cancel'; payload: { modelId: string } }
  | { type: 'model:delete'; payload: { modelId: string } }
  | { type: 'model:select'; payload: { modelId: string } }
  // Vector search messages
  | { type: 'vector:search'; payload: VectorSearchOptions }
  | { type: 'vector:indexer:start' }
  | { type: 'vector:indexer:pause' }
  | { type: 'vector:indexer:resume' }
  | { type: 'vector:indexer:clear' }
  | { type: 'vector:indexer:status' }
  | { type: 'vector:incoherence:analyze'; payload?: { filePath?: string } };

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
  models: ModelManagerState;
}
